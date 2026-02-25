// ============================================================
// FILE: apps/api/src/modules/reports/report-query-builder.ts
//
// Converts a ReportConfig JSON definition into a parameterized
// SQL query. Supports:
//   - Tabular reports (raw rows with fields)
//   - Summary reports (grouped aggregations)
//   - Matrix reports (pivot table style)
//   - Cross-module CTE-based reports
//   - Date grouping (day/week/month/quarter/year)
//   - Relative date filters (this_month, last_30_days, etc.)
//   - Record-level access (RBAC) filtering
// ============================================================

import { Logger } from '@nestjs/common';
import { DATA_SOURCES, CROSS_MODULE_CTE, DataSourceField, DataSourceDefinition } from './report-data-sources';

const logger = new Logger('ReportQueryBuilder');

// ============================================================
// TYPES
// ============================================================

export interface ReportMeasure {
  field: string;
  aggregate: 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';
  label?: string;
  format?: 'currency' | 'number' | 'percent';
}

export interface ReportDimension {
  field: string;
  type: 'field' | 'date';
  dateGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  label?: string;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' |
            'contains' | 'not_contains' | 'starts_with' |
            'in' | 'not_in' | 'is_null' | 'is_not_null' |
            'between' | 'relative_date';
  value: any;
  dateRelative?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_quarter' |
                 'this_year' | 'last_7_days' | 'last_30_days' | 'last_90_days' |
                 'last_month' | 'last_quarter' | 'last_year' | 
                 'next_month' | 'next_quarter';
}

export interface ReportOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface ReportConfig {
  measures?: ReportMeasure[];
  dimensions?: ReportDimension[];
  fields?: string[];          // For tabular reports: raw column selection
  filters?: ReportFilter[];
  orderBy?: ReportOrderBy[];
  limit?: number;
  pivotField?: string;        // For matrix reports
}

export interface BuildContext {
  schema: string;
  dataSource: string;
  config: ReportConfig;
  reportType: 'tabular' | 'summary' | 'matrix';
  /** Optional RBAC filter (e.g., "o.owner_id = 'uuid'") */
  accessFilter?: string;
  /** Runtime filter overrides from the viewer */
  runtimeFilters?: ReportFilter[];
}

export interface BuiltQuery {
  sql: string;
  params: any[];
  /** Column metadata for the frontend */
  columns: Array<{ key: string; label: string; format?: string }>;
}

// ============================================================
// MAIN BUILDER
// ============================================================

export function buildReportQuery(ctx: BuildContext): BuiltQuery {
  const { schema, dataSource, config, reportType } = ctx;

  // Cross-module reports use a special CTE-based path
  if (dataSource === 'cross_module') {
    return buildCrossModuleQuery(ctx);
  }

  const ds = DATA_SOURCES[dataSource];
  if (!ds) {
    throw new Error(`Unknown data source: ${dataSource}`);
  }

  switch (reportType) {
    case 'tabular':
      return buildTabularQuery(ctx, ds);
    case 'summary':
      return buildSummaryQuery(ctx, ds);
    case 'matrix':
      return buildMatrixQuery(ctx, ds);
    default:
      return buildSummaryQuery(ctx, ds);
  }
}

// ============================================================
// TABULAR QUERY (raw rows)
// ============================================================

function buildTabularQuery(ctx: BuildContext, ds: DataSourceDefinition): BuiltQuery {
  const { schema, config } = ctx;
  const params: any[] = [];
  let paramIdx = 1;

  // Determine which fields to select
  const fieldKeys = config.fields && config.fields.length > 0
    ? config.fields
    : ds.fields.filter(f => !f.computed || config.fields?.includes(f.key)).slice(0, 15).map(f => f.key);

  // Collect required joins
  const requiredJoins = new Set<string>();
  const selectedFields: DataSourceField[] = [];

  for (const key of fieldKeys) {
    const field = ds.fields.find(f => f.key === key);
    if (field) {
      selectedFields.push(field);
      if (field.join) requiredJoins.add(field.join);
    }
  }

  // Also check filter fields for joins
  const allFilters = [...(config.filters || []), ...(ctx.runtimeFilters || [])];
  for (const filter of allFilters) {
    const field = ds.fields.find(f => f.key === filter.field);
    if (field?.join) requiredJoins.add(field.join);
  }

  // Build SELECT
  const selectCols = selectedFields.map(f => `${f.sqlExpr.replace(/\{schema\}/g, schema)} AS "${f.key}"`);

  // Build FROM + JOINs
  const fromClause = `"${schema}".${ds.table} ${ds.alias}`;
  const joinClauses = Array.from(requiredJoins)
    .map(jk => ds.joins[jk]?.sql.replace(/\{schema\}/g, schema) || '')
    .filter(Boolean);

  // Build WHERE
  const { whereClause, whereParams } = buildWhereClause(ds, allFilters, schema, paramIdx);
  params.push(...whereParams);
  paramIdx += whereParams.length;

  let where = ds.baseWhere || 'TRUE';
  if (whereClause) where += ` AND ${whereClause}`;
  if (ctx.accessFilter) where += ` AND ${ctx.accessFilter}`;

  // Build ORDER BY
  const orderBy = buildOrderBy(ds, config.orderBy, selectedFields);

  // Build LIMIT
  const limitClause = config.limit ? `LIMIT ${config.limit}` : 'LIMIT 1000';

  const sql = [
    `SELECT ${selectCols.join(', ')}`,
    `FROM ${fromClause}`,
    ...joinClauses,
    `WHERE ${where}`,
    orderBy ? `ORDER BY ${orderBy}` : '',
    limitClause,
  ].filter(Boolean).join('\n');

  return {
    sql,
    params,
    columns: selectedFields.map(f => ({ key: f.key, label: f.label, format: f.type })),
  };
}

// ============================================================
// SUMMARY QUERY (grouped aggregations)
// ============================================================

function buildSummaryQuery(ctx: BuildContext, ds: DataSourceDefinition): BuiltQuery {
  const { schema, config } = ctx;
  const params: any[] = [];
  let paramIdx = 1;

  const measures = config.measures || [];
  const dimensions = config.dimensions || [];
  const allFilters = [...(config.filters || []), ...(ctx.runtimeFilters || [])];

  // Collect required joins
  const requiredJoins = new Set<string>();
  const allFieldKeys = [
    ...measures.map(m => m.field),
    ...dimensions.map(d => d.field),
    ...allFilters.map(f => f.field),
    ...(config.orderBy || []).map(o => o.field),
  ];

  for (const key of allFieldKeys) {
    const field = ds.fields.find(f => f.key === key);
    if (field?.join) requiredJoins.add(field.join);
  }

  // Build SELECT — dimensions first, then measures
  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const columns: Array<{ key: string; label: string; format?: string }> = [];

  // Dimensions
  for (const dim of dimensions) {
    const field = ds.fields.find(f => f.key === dim.field);
    if (!field) continue;

    const expr = field.sqlExpr.replace(/\{schema\}/g, schema);

    if (dim.type === 'date' && dim.dateGranularity) {
      const dateExpr = buildDateTrunc(expr, dim.dateGranularity);
      selectParts.push(`${dateExpr} AS "${dim.field}"`);
      groupByParts.push(dateExpr);
    } else {
      selectParts.push(`${expr} AS "${dim.field}"`);
      groupByParts.push(expr);
    }
    columns.push({ key: dim.field, label: dim.label || field.label, format: field.type });
  }

  // Measures
  for (const measure of measures) {
    const field = ds.fields.find(f => f.key === measure.field);
    if (!field) continue;

    const expr = field.sqlExpr.replace(/\{schema\}/g, schema);
    const aggExpr = buildAggregate(expr, measure.aggregate);
    const aliasKey = `${measure.field}_${measure.aggregate}`;
    selectParts.push(`${aggExpr} AS "${aliasKey}"`);
    columns.push({
      key: aliasKey,
      label: measure.label || `${measure.aggregate}(${field.label})`,
      format: measure.format || field.type,
    });
  }

  if (selectParts.length === 0) {
    // Fallback: just count all
    selectParts.push('COUNT(*) AS "total_count"');
    columns.push({ key: 'total_count', label: 'Count', format: 'number' });
  }

  // Build FROM + JOINs
  const fromClause = `"${schema}".${ds.table} ${ds.alias}`;
  const joinClauses = Array.from(requiredJoins)
    .map(jk => ds.joins[jk]?.sql.replace(/\{schema\}/g, schema) || '')
    .filter(Boolean);

  // Build WHERE
  const { whereClause, whereParams } = buildWhereClause(ds, allFilters, schema, paramIdx);
  params.push(...whereParams);
  paramIdx += whereParams.length;

  let where = ds.baseWhere || 'TRUE';
  if (whereClause) where += ` AND ${whereClause}`;
  if (ctx.accessFilter) where += ` AND ${ctx.accessFilter}`;

  // Build ORDER BY (reference aggregate aliases or dimension expressions)
  const orderBy = buildSummaryOrderBy(config.orderBy, dimensions, measures, ds, schema);

  // Build LIMIT
  const limitClause = config.limit ? `LIMIT ${config.limit}` : '';

  const sql = [
    `SELECT ${selectParts.join(', ')}`,
    `FROM ${fromClause}`,
    ...joinClauses,
    `WHERE ${where}`,
    groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : '',
    orderBy ? `ORDER BY ${orderBy}` : '',
    limitClause,
  ].filter(Boolean).join('\n');

  return { sql, params, columns };
}

// ============================================================
// MATRIX QUERY (pivot)
// ============================================================

function buildMatrixQuery(ctx: BuildContext, ds: DataSourceDefinition): BuiltQuery {
  // Matrix uses the summary query as base; pivot is handled on the frontend
  // by reshaping the grouped data. We return flat grouped data here.
  return buildSummaryQuery(ctx, ds);
}

// ============================================================
// CROSS-MODULE QUERY
// ============================================================

function buildCrossModuleQuery(ctx: BuildContext): BuiltQuery {
  const { schema, config } = ctx;

  // Build date filter for the CTE
  const allFilters = [...(config.filters || []), ...(ctx.runtimeFilters || [])];
  const dateFilter = buildCrossModuleDateFilter(allFilters, schema);

  const cteSQL = CROSS_MODULE_CTE.buildCTE(schema, dateFilter);

  // Build outer query from CTE result
  const measures = config.measures || [];
  const dimensions = config.dimensions || [];

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const columns: Array<{ key: string; label: string; format?: string }> = [];

  // Map dimension fields to CTE columns
  for (const dim of dimensions) {
    selectParts.push(`cm.${dim.field} AS "${dim.field}"`);
    groupByParts.push(`cm.${dim.field}`);
    columns.push({ key: dim.field, label: dim.label || dim.field, format: 'text' });
  }

  // Map measure fields
  for (const measure of measures) {
    const aggExpr = buildAggregate(`cm.${measure.field}`, measure.aggregate);
    const aliasKey = `${measure.field}_${measure.aggregate}`;
    selectParts.push(`${aggExpr} AS "${aliasKey}"`);
    columns.push({
      key: aliasKey,
      label: measure.label || measure.field,
      format: measure.format || 'number',
    });
  }

  if (selectParts.length === 0) {
    selectParts.push('cm.*');
  }

  // Order
  const orderParts: string[] = [];
  for (const ob of (config.orderBy || [])) {
    const dir = ob.direction === 'ASC' ? 'ASC' : 'DESC';
    // Check if referencing an aggregate alias
    const matchMeasure = measures.find(m => `${m.field}_${m.aggregate}` === ob.field || m.field === ob.field);
    if (matchMeasure) {
      orderParts.push(`"${matchMeasure.field}_${matchMeasure.aggregate}" ${dir}`);
    } else {
      orderParts.push(`cm.${ob.field} ${dir}`);
    }
  }

  const sql = [
    `WITH cm AS (${cteSQL})`,
    `SELECT ${selectParts.join(', ')}`,
    'FROM cm',
    groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : '',
    orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : '',
    config.limit ? `LIMIT ${config.limit}` : '',
  ].filter(Boolean).join('\n');

  return { sql, params: [], columns };
}

// ============================================================
// HELPERS
// ============================================================

function buildDateTrunc(expr: string, granularity: string): string {
  switch (granularity) {
    case 'day':     return `DATE_TRUNC('day', ${expr})`;
    case 'week':    return `DATE_TRUNC('week', ${expr})`;
    case 'month':   return `DATE_TRUNC('month', ${expr})`;
    case 'quarter': return `DATE_TRUNC('quarter', ${expr})`;
    case 'year':    return `DATE_TRUNC('year', ${expr})`;
    default:        return `DATE_TRUNC('month', ${expr})`;
  }
}

function buildAggregate(expr: string, aggregate: string): string {
  switch (aggregate) {
    case 'count':          return `COUNT(${expr})`;
    case 'count_distinct': return `COUNT(DISTINCT ${expr})`;
    case 'sum':            return `COALESCE(SUM(${expr}), 0)`;
    case 'avg':            return `COALESCE(AVG(${expr}), 0)`;
    case 'min':            return `MIN(${expr})`;
    case 'max':            return `MAX(${expr})`;
    default:               return `COUNT(${expr})`;
  }
}

function buildWhereClause(
  ds: DataSourceDefinition,
  filters: ReportFilter[],
  schema: string,
  startParamIdx: number,
): { whereClause: string; whereParams: any[] } {
  const parts: string[] = [];
  const params: any[] = [];
  let idx = startParamIdx;

  for (const filter of filters) {
    const field = ds.fields.find(f => f.key === filter.field);
    if (!field) {
      logger.warn(`Filter field "${filter.field}" not found in data source "${ds.key}"`);
      continue;
    }

    const expr = field.sqlExpr.replace(/\{schema\}/g, schema);

    switch (filter.operator) {
      case 'eq':
        parts.push(`${expr} = $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'neq':
        parts.push(`${expr} != $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'gt':
        parts.push(`${expr} > $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'gte':
        parts.push(`${expr} >= $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'lt':
        parts.push(`${expr} < $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'lte':
        parts.push(`${expr} <= $${idx}`);
        params.push(filter.value);
        idx++;
        break;

      case 'contains':
        parts.push(`${expr} ILIKE $${idx}`);
        params.push(`%${filter.value}%`);
        idx++;
        break;

      case 'not_contains':
        parts.push(`${expr} NOT ILIKE $${idx}`);
        params.push(`%${filter.value}%`);
        idx++;
        break;

      case 'starts_with':
        parts.push(`${expr} ILIKE $${idx}`);
        params.push(`${filter.value}%`);
        idx++;
        break;

      case 'in':
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => `$${idx++}`);
          parts.push(`${expr} IN (${placeholders.join(', ')})`);
          params.push(...filter.value);
        }
        break;

      case 'not_in':
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => `$${idx++}`);
          parts.push(`${expr} NOT IN (${placeholders.join(', ')})`);
          params.push(...filter.value);
        }
        break;

      case 'is_null':
        parts.push(`${expr} IS NULL`);
        break;

      case 'is_not_null':
        parts.push(`${expr} IS NOT NULL`);
        break;

      case 'between':
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          parts.push(`${expr} BETWEEN $${idx} AND $${idx + 1}`);
          params.push(filter.value[0], filter.value[1]);
          idx += 2;
        }
        break;

      case 'relative_date':
        const dateExpr = buildRelativeDateFilter(expr, filter.dateRelative || 'this_month');
        if (dateExpr) parts.push(dateExpr);
        break;

      default:
        logger.warn(`Unknown filter operator: ${filter.operator}`);
    }
  }

  return {
    whereClause: parts.length > 0 ? parts.join(' AND ') : '',
    whereParams: params,
  };
}

function buildRelativeDateFilter(expr: string, relative: string): string {
  switch (relative) {
    case 'today':
      return `${expr}::date = CURRENT_DATE`;
    case 'yesterday':
      return `${expr}::date = CURRENT_DATE - INTERVAL '1 day'`;
    case 'this_week':
      return `${expr} >= DATE_TRUNC('week', CURRENT_DATE) AND ${expr} < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`;
    case 'this_month':
      return `${expr} >= DATE_TRUNC('month', CURRENT_DATE) AND ${expr} < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
    case 'this_quarter':
      return `${expr} >= DATE_TRUNC('quarter', CURRENT_DATE) AND ${expr} < DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months'`;
    case 'this_year':
      return `${expr} >= DATE_TRUNC('year', CURRENT_DATE) AND ${expr} < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'`;
    case 'last_7_days':
      return `${expr} >= CURRENT_DATE - INTERVAL '7 days'`;
    case 'last_30_days':
      return `${expr} >= CURRENT_DATE - INTERVAL '30 days'`;
    case 'last_90_days':
      return `${expr} >= CURRENT_DATE - INTERVAL '90 days'`;
    case 'last_month':
      return `${expr} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND ${expr} < DATE_TRUNC('month', CURRENT_DATE)`;
    case 'last_quarter':
      return `${expr} >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months') AND ${expr} < DATE_TRUNC('quarter', CURRENT_DATE)`;
    case 'last_year':
      return `${expr} >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AND ${expr} < DATE_TRUNC('year', CURRENT_DATE)`;
    case 'next_quarter':
      return `${expr} >= DATE_TRUNC('quarter', CURRENT_DATE + INTERVAL '3 months') AND ${expr} < DATE_TRUNC('quarter', CURRENT_DATE + INTERVAL '3 months') + INTERVAL '3 months'`;
    case 'next_month':
      return `${expr} >= DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') AND ${expr} < DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '1 month'`;
    default:
      return '';
  }
}

function buildCrossModuleDateFilter(filters: ReportFilter[], _schema: string): string {
  for (const f of filters) {
    if (f.operator === 'relative_date' && f.dateRelative) {
      return buildRelativeDateFilter('created_at', f.dateRelative);
    }
  }
  return 'TRUE';
}

function buildOrderBy(
  ds: DataSourceDefinition,
  orderBy: ReportOrderBy[] | undefined,
  selectedFields: DataSourceField[],
): string {
  if (!orderBy || orderBy.length === 0) return '';

  const parts: string[] = [];
  for (const ob of orderBy) {
    const field = ds.fields.find(f => f.key === ob.field);
    if (field) {
      const dir = ob.direction === 'ASC' ? 'ASC' : 'DESC';
      parts.push(`${field.sqlExpr} ${dir}`);
    }
  }
  return parts.join(', ');
}

function buildSummaryOrderBy(
  orderBy: ReportOrderBy[] | undefined,
  dimensions: ReportDimension[],
  measures: ReportMeasure[],
  ds: DataSourceDefinition,
  schema: string,
): string {
  if (!orderBy || orderBy.length === 0) return '';

  const parts: string[] = [];
  for (const ob of orderBy) {
    const dir = ob.direction === 'ASC' ? 'ASC' : 'DESC';

    // Check if it's an aggregate alias (e.g., "amount_sum", "id_count")
    const matchMeasure = measures.find(m => `${m.field}_${m.aggregate}` === ob.field);
    if (matchMeasure) {
      parts.push(`"${ob.field}" ${dir}`);
      continue;
    }

    // Check if it's a dimension field (already in GROUP BY)
    const dim = dimensions.find(d => d.field === ob.field);
    if (dim) {
      const dimField = ds.fields.find(f => f.key === ob.field);
      if (dimField) {
        const expr = dimField.sqlExpr.replace(/\{schema\}/g, schema);
        if (dim.type === 'date' && dim.dateGranularity) {
          parts.push(`${buildDateTrunc(expr, dim.dateGranularity)} ${dir}`);
        } else {
          parts.push(`${expr} ${dir}`);
        }
      }
      continue;
    }

    // Field exists in data source but NOT in dimensions → wrap in MIN() for GROUP BY safety
    const rawField = ds.fields.find(f => f.key === ob.field);
    if (rawField) {
      const expr = rawField.sqlExpr.replace(/\{schema\}/g, schema);
      parts.push(`MIN(${expr}) ${dir}`);
      continue;
    }

    // Fallback: try as literal alias
    parts.push(`"${ob.field}" ${dir}`);
  }
  return parts.join(', ');
}