// ============================================================
// FILE: apps/api/src/modules/reports/report-data-sources.ts
//
// Field registry for all report data sources.
// Each source defines its base table, selectable fields,
// available joins, and computed/virtual columns.
//
// The ReportQueryBuilder uses this registry to build dynamic SQL.
// ============================================================

export type FieldType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';
export type AggregateType = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';

export interface DataSourceField {
  key: string;
  label: string;
  type: FieldType;
  /** SQL expression to select this field (relative to alias) */
  sqlExpr: string;
  /** If this field requires a JOIN, reference the join key */
  join?: string;
  /** Which aggregates make sense for this field */
  aggregates?: AggregateType[];
  /** Can this field be used as a dimension / group-by? */
  groupable?: boolean;
  /** Can this field be used in filters? */
  filterable?: boolean;
  /** Is this a computed/virtual field? */
  computed?: boolean;
}

export interface DataSourceJoin {
  /** SQL JOIN clause (use {schema} placeholder) */
  sql: string;
  /** Alias used in the join */
  alias: string;
}

export interface DataSourceDefinition {
  key: string;
  label: string;
  /** Base table name (without schema) */
  table: string;
  /** Table alias used in queries */
  alias: string;
  /** Default WHERE clause fragment (e.g., soft-delete filter) */
  baseWhere?: string;
  fields: DataSourceField[];
  joins: Record<string, DataSourceJoin>;
}

// ============================================================
// DATA SOURCE DEFINITIONS
// ============================================================

export const DATA_SOURCES: Record<string, DataSourceDefinition> = {

  // ─────────────────────────────────────────────────
  // OPPORTUNITIES
  // ─────────────────────────────────────────────────
  opportunities: {
    key: 'opportunities',
    label: 'Opportunities',
    table: 'opportunities',
    alias: 'o',
    baseWhere: 'o.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'o.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'name', label: 'Name', type: 'text', sqlExpr: 'o.name', groupable: true, filterable: true },
      { key: 'amount', label: 'Amount', type: 'currency', sqlExpr: 'o.amount', aggregates: ['sum', 'avg', 'min', 'max'], filterable: true },
      { key: 'probability', label: 'Probability', type: 'percent', sqlExpr: 'o.probability', aggregates: ['avg', 'min', 'max'], filterable: true },
      { key: 'weighted_amount', label: 'Weighted Amount', type: 'currency', sqlExpr: 'COALESCE(o.amount, 0) * COALESCE(o.probability, 0) / 100', aggregates: ['sum', 'avg'], computed: true },
      { key: 'close_date', label: 'Close Date', type: 'date', sqlExpr: 'o.close_date', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'o.created_at', groupable: true, filterable: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', sqlExpr: 'o.updated_at', filterable: true },
      { key: 'won_at', label: 'Won Date', type: 'datetime', sqlExpr: 'o.won_at', groupable: true, filterable: true },
      { key: 'lost_at', label: 'Lost Date', type: 'datetime', sqlExpr: 'o.lost_at', groupable: true, filterable: true },
      { key: 'closed_at', label: 'Closed Date', type: 'datetime', sqlExpr: 'COALESCE(o.won_at, o.lost_at)', groupable: true, filterable: true, computed: true },
      { key: 'source', label: 'Source', type: 'text', sqlExpr: 'o.source', groupable: true, filterable: true },
      { key: 'type', label: 'Type', type: 'text', sqlExpr: 'o.type', groupable: true, filterable: true },
      { key: 'industry', label: 'Industry', type: 'text', sqlExpr: 'o.industry', groupable: true, filterable: true },
      { key: 'forecast_category', label: 'Forecast Category', type: 'text', sqlExpr: 'o.forecast_category', groupable: true, filterable: true },
      { key: 'currency', label: 'Currency', type: 'text', sqlExpr: 'o.currency', groupable: true, filterable: true },
      { key: 'next_step', label: 'Next Step', type: 'text', sqlExpr: 'o.next_step', filterable: true },
      { key: 'tags', label: 'Tags', type: 'text', sqlExpr: 'o.tags', filterable: true },
      { key: 'outcome', label: 'Outcome', type: 'text', sqlExpr: "CASE WHEN o.won_at IS NOT NULL THEN 'won' WHEN o.lost_at IS NOT NULL THEN 'lost' ELSE 'open' END", groupable: true, filterable: true, computed: true },
      { key: 'days_to_close', label: 'Days to Close', type: 'number', sqlExpr: "EXTRACT(EPOCH FROM (COALESCE(o.won_at, o.lost_at) - o.created_at)) / 86400", aggregates: ['avg', 'min', 'max'], computed: true },
      { key: 'days_inactive', label: 'Days Since Update', type: 'number', sqlExpr: "EXTRACT(EPOCH FROM (NOW() - o.updated_at)) / 86400", aggregates: ['avg', 'max'], filterable: true, computed: true },
      { key: 'last_activity_at', label: 'Last Activity', type: 'datetime', sqlExpr: 'o.updated_at', filterable: true },
      // Joined fields
      { key: 'stage_name', label: 'Stage', type: 'text', sqlExpr: 'ps.name', join: 'stages', groupable: true, filterable: true },
      { key: 'stage_sort', label: 'Stage Order', type: 'number', sqlExpr: 'ps.sort_order', join: 'stages' },
      { key: 'pipeline_name', label: 'Pipeline', type: 'text', sqlExpr: 'pip.name', join: 'pipelines', groupable: true, filterable: true },
      { key: 'owner_name', label: 'Owner', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'owner_id', label: 'Owner ID', type: 'text', sqlExpr: 'o.owner_id', filterable: true },
      { key: 'account_name', label: 'Account', type: 'text', sqlExpr: 'a.name', join: 'accounts', groupable: true, filterable: true },
      { key: 'account_id', label: 'Account ID', type: 'text', sqlExpr: 'o.account_id', filterable: true },
      { key: 'close_reason_name', label: 'Close Reason', type: 'text', sqlExpr: 'cr.name', join: 'close_reasons', groupable: true, filterable: true },
      { key: 'contact_name', label: 'Primary Contact', type: 'text', sqlExpr: "CONCAT(c.first_name, ' ', c.last_name)", join: 'contacts', groupable: true, filterable: true },
    ],
    joins: {
      stages:        { sql: 'LEFT JOIN "{schema}".pipeline_stages ps ON o.stage_id = ps.id', alias: 'ps' },
      pipelines:     { sql: 'LEFT JOIN "{schema}".pipelines pip ON o.pipeline_id = pip.id', alias: 'pip' },
      users:         { sql: 'LEFT JOIN "{schema}".users u ON o.owner_id = u.id', alias: 'u' },
      accounts:      { sql: 'LEFT JOIN "{schema}".accounts a ON o.account_id = a.id', alias: 'a' },
      close_reasons: { sql: 'LEFT JOIN "{schema}".opportunity_close_reasons cr ON o.close_reason_id = cr.id', alias: 'cr' },
      contacts:      { sql: 'LEFT JOIN "{schema}".contacts c ON o.primary_contact_id = c.id', alias: 'c' },
    },
  },

  // ─────────────────────────────────────────────────
  // LEADS
  // ─────────────────────────────────────────────────
  leads: {
    key: 'leads',
    label: 'Leads',
    table: 'leads',
    alias: 'l',
    baseWhere: 'l.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'l.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'first_name', label: 'First Name', type: 'text', sqlExpr: 'l.first_name', filterable: true },
      { key: 'last_name', label: 'Last Name', type: 'text', sqlExpr: 'l.last_name', filterable: true },
      { key: 'full_name', label: 'Full Name', type: 'text', sqlExpr: "CONCAT(l.first_name, ' ', l.last_name)", groupable: false, filterable: true, computed: true },
      { key: 'email', label: 'Email', type: 'text', sqlExpr: 'l.email', filterable: true },
      { key: 'company', label: 'Company', type: 'text', sqlExpr: 'l.company', groupable: true, filterable: true },
      { key: 'job_title', label: 'Job Title', type: 'text', sqlExpr: 'l.job_title', groupable: true, filterable: true },
      { key: 'score', label: 'Lead Score', type: 'number', sqlExpr: 'l.score', aggregates: ['sum', 'avg', 'min', 'max'], filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'l.created_at', groupable: true, filterable: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', sqlExpr: 'l.updated_at', filterable: true },
      { key: 'converted_at', label: 'Converted Date', type: 'datetime', sqlExpr: 'l.converted_at', groupable: true, filterable: true, aggregates: ['count'] },
      { key: 'disqualified_at', label: 'Disqualified Date', type: 'datetime', sqlExpr: 'l.disqualified_at', filterable: true },
      { key: 'city', label: 'City', type: 'text', sqlExpr: 'l.city', groupable: true, filterable: true },
      { key: 'state', label: 'State', type: 'text', sqlExpr: 'l.state', groupable: true, filterable: true },
      { key: 'country', label: 'Country', type: 'text', sqlExpr: 'l.country', groupable: true, filterable: true },
      { key: 'tags', label: 'Tags', type: 'text', sqlExpr: 'l.tags', filterable: true },
      { key: 'do_not_contact', label: 'Do Not Contact', type: 'boolean', sqlExpr: 'l.do_not_contact', filterable: true },
      // Computed
      { key: 'age_days', label: 'Age (Days)', type: 'number', sqlExpr: "EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400", aggregates: ['avg', 'min', 'max'], computed: true },
      { key: 'age_bucket', label: 'Age Bucket', type: 'text', sqlExpr: "CASE WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 7 THEN '0-7 days' WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 14 THEN '7-14 days' WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 30 THEN '14-30 days' WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 60 THEN '30-60 days' ELSE '60+ days' END", groupable: true, computed: true },
      { key: 'age_bucket_sort', label: 'Age Bucket Sort', type: 'number', sqlExpr: "CASE WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 7 THEN 1 WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 14 THEN 2 WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 30 THEN 3 WHEN EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 86400 < 60 THEN 4 ELSE 5 END", computed: true },
      { key: 'response_time_hours', label: 'Response Time (hrs)', type: 'number', sqlExpr: "EXTRACT(EPOCH FROM (COALESCE((SELECT MIN(created_at) FROM \"{schema}\".activities WHERE entity_type = 'leads' AND entity_id = l.id), NOW()) - l.created_at)) / 3600", aggregates: ['avg', 'min', 'max'], computed: true },
      // Joined
      { key: 'stage_name', label: 'Stage', type: 'text', sqlExpr: 'ps.name', join: 'stages', groupable: true, filterable: true },
      { key: 'stage_sort', label: 'Stage Order', type: 'number', sqlExpr: 'ps.sort_order', join: 'stages' },
      { key: 'pipeline_name', label: 'Pipeline', type: 'text', sqlExpr: 'pip.name', join: 'pipelines', groupable: true, filterable: true },
      { key: 'source_name', label: 'Source', type: 'text', sqlExpr: 'ls.name', join: 'sources', groupable: true, filterable: true },
      { key: 'owner_name', label: 'Owner', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'owner_id', label: 'Owner ID', type: 'text', sqlExpr: 'l.owner_id', filterable: true },
      { key: 'priority_name', label: 'Priority', type: 'text', sqlExpr: 'lp.name', join: 'priorities', groupable: true, filterable: true },
    ],
    joins: {
      stages:     { sql: 'LEFT JOIN "{schema}".pipeline_stages ps ON l.stage_id = ps.id', alias: 'ps' },
      pipelines:  { sql: 'LEFT JOIN "{schema}".pipelines pip ON l.pipeline_id = pip.id', alias: 'pip' },
      sources:    { sql: 'LEFT JOIN "{schema}".lead_sources ls ON l.source = ls.id::text', alias: 'ls' },
      users:      { sql: 'LEFT JOIN "{schema}".users u ON l.owner_id = u.id', alias: 'u' },
      priorities: { sql: 'LEFT JOIN "{schema}".lead_priorities lp ON l.priority_id = lp.id', alias: 'lp' },
    },
  },

  // ─────────────────────────────────────────────────
  // CONTACTS
  // ─────────────────────────────────────────────────
  contacts: {
    key: 'contacts',
    label: 'Contacts',
    table: 'contacts',
    alias: 'ct',
    baseWhere: 'ct.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'ct.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'first_name', label: 'First Name', type: 'text', sqlExpr: 'ct.first_name', filterable: true },
      { key: 'last_name', label: 'Last Name', type: 'text', sqlExpr: 'ct.last_name', filterable: true },
      { key: 'full_name', label: 'Full Name', type: 'text', sqlExpr: "CONCAT(ct.first_name, ' ', ct.last_name)", computed: true, filterable: true },
      { key: 'email', label: 'Email', type: 'text', sqlExpr: 'ct.email', filterable: true },
      { key: 'phone', label: 'Phone', type: 'text', sqlExpr: 'ct.phone', filterable: true },
      { key: 'company', label: 'Company', type: 'text', sqlExpr: 'ct.company', groupable: true, filterable: true },
      { key: 'job_title', label: 'Job Title', type: 'text', sqlExpr: 'ct.job_title', groupable: true, filterable: true },
      { key: 'source', label: 'Source', type: 'text', sqlExpr: 'ct.source', groupable: true, filterable: true },
      { key: 'city', label: 'City', type: 'text', sqlExpr: 'ct.city', groupable: true, filterable: true },
      { key: 'state', label: 'State', type: 'text', sqlExpr: 'ct.state', groupable: true, filterable: true },
      { key: 'country', label: 'Country', type: 'text', sqlExpr: 'ct.country', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'ct.created_at', groupable: true, filterable: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', sqlExpr: 'ct.updated_at', filterable: true },
      { key: 'tags', label: 'Tags', type: 'text', sqlExpr: 'ct.tags', filterable: true },
      { key: 'do_not_contact', label: 'Do Not Contact', type: 'boolean', sqlExpr: 'ct.do_not_contact', filterable: true },
      // Joined
      { key: 'owner_name', label: 'Owner', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'owner_id', label: 'Owner ID', type: 'text', sqlExpr: 'ct.owner_id', filterable: true },
      { key: 'account_name', label: 'Account', type: 'text', sqlExpr: 'a.name', join: 'accounts', groupable: true, filterable: true },
    ],
    joins: {
      users:    { sql: 'LEFT JOIN "{schema}".users u ON ct.owner_id = u.id', alias: 'u' },
      accounts: { sql: 'LEFT JOIN "{schema}".accounts a ON ct.account_id = a.id', alias: 'a' },
    },
  },

  // ─────────────────────────────────────────────────
  // ACCOUNTS
  // ─────────────────────────────────────────────────
  accounts: {
    key: 'accounts',
    label: 'Accounts',
    table: 'accounts',
    alias: 'ac',
    baseWhere: 'ac.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'ac.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'name', label: 'Name', type: 'text', sqlExpr: 'ac.name', groupable: true, filterable: true },
      { key: 'industry', label: 'Industry', type: 'text', sqlExpr: 'ac.industry', groupable: true, filterable: true },
      { key: 'type', label: 'Type', type: 'text', sqlExpr: 'ac.type', groupable: true, filterable: true },
      { key: 'website', label: 'Website', type: 'text', sqlExpr: 'ac.website', filterable: true },
      { key: 'phone', label: 'Phone', type: 'text', sqlExpr: 'ac.phone', filterable: true },
      { key: 'annual_revenue', label: 'Annual Revenue', type: 'currency', sqlExpr: 'ac.annual_revenue', aggregates: ['sum', 'avg', 'min', 'max'], filterable: true },
      { key: 'employees', label: 'Employees', type: 'number', sqlExpr: 'ac.employees', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'city', label: 'City', type: 'text', sqlExpr: 'ac.city', groupable: true, filterable: true },
      { key: 'state', label: 'State', type: 'text', sqlExpr: 'ac.state', groupable: true, filterable: true },
      { key: 'country', label: 'Country', type: 'text', sqlExpr: 'ac.country', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'ac.created_at', groupable: true, filterable: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', sqlExpr: 'ac.updated_at', filterable: true },
      { key: 'tags', label: 'Tags', type: 'text', sqlExpr: 'ac.tags', filterable: true },
      // Joined
      { key: 'owner_name', label: 'Owner', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'owner_id', label: 'Owner ID', type: 'text', sqlExpr: 'ac.owner_id', filterable: true },
      { key: 'parent_name', label: 'Parent Account', type: 'text', sqlExpr: 'pa.name', join: 'parent', groupable: true, filterable: true },
    ],
    joins: {
      users:  { sql: 'LEFT JOIN "{schema}".users u ON ac.owner_id = u.id', alias: 'u' },
      parent: { sql: 'LEFT JOIN "{schema}".accounts pa ON ac.parent_id = pa.id', alias: 'pa' },
    },
  },

  // ─────────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────────
  tasks: {
    key: 'tasks',
    label: 'Tasks',
    table: 'tasks',
    alias: 't',
    baseWhere: 't.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 't.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'title', label: 'Title', type: 'text', sqlExpr: 't.title', filterable: true },
      { key: 'description', label: 'Description', type: 'text', sqlExpr: 't.description', filterable: true },
      { key: 'status', label: 'Status', type: 'text', sqlExpr: 't.status', groupable: true, filterable: true },
      { key: 'task_status', label: 'Task Status', type: 'text', sqlExpr: "CASE WHEN t.completed_at IS NOT NULL THEN 'Completed' WHEN t.due_date < NOW() AND t.completed_at IS NULL THEN 'Overdue' ELSE 'Open' END", groupable: true, filterable: true, computed: true },
      { key: 'priority', label: 'Priority', type: 'text', sqlExpr: 't.priority', groupable: true, filterable: true },
      { key: 'due_date', label: 'Due Date', type: 'datetime', sqlExpr: 't.due_date', groupable: true, filterable: true },
      { key: 'completed_at', label: 'Completed Date', type: 'datetime', sqlExpr: 't.completed_at', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 't.created_at', groupable: true, filterable: true },
      { key: 'entity_type', label: 'Related Module', type: 'text', sqlExpr: 't.related_entity_type', groupable: true, filterable: true },
      // Joined
      { key: 'task_type_name', label: 'Task Type', type: 'text', sqlExpr: 'tt.name', join: 'task_types', groupable: true, filterable: true },
      { key: 'status_name', label: 'Status', type: 'text', sqlExpr: 'ts.name', join: 'task_statuses', groupable: true, filterable: true },
      { key: 'priority_name', label: 'Priority', type: 'text', sqlExpr: 'tp.name', join: 'task_priorities', groupable: true, filterable: true },
      { key: 'owner_name', label: 'Assigned To', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'owner_id', label: 'Assigned To ID', type: 'text', sqlExpr: 't.assigned_to', filterable: true },
      { key: 'created_by_name', label: 'Created By', type: 'text', sqlExpr: "CONCAT(cu.first_name, ' ', cu.last_name)", join: 'created_by', groupable: true },
    ],
    joins: {
      task_types:      { sql: 'LEFT JOIN "{schema}".task_types tt ON t.task_type_id = tt.id', alias: 'tt' },
      task_statuses:   { sql: 'LEFT JOIN "{schema}".task_statuses ts ON t.status_id = ts.id', alias: 'ts' },
      task_priorities: { sql: 'LEFT JOIN "{schema}".task_priorities tp ON t.priority_id = tp.id', alias: 'tp' },
      users:           { sql: 'LEFT JOIN "{schema}".users u ON t.assigned_to = u.id', alias: 'u' },
      created_by:      { sql: 'LEFT JOIN "{schema}".users cu ON t.created_by = cu.id', alias: 'cu' },
    },
  },

  // ─────────────────────────────────────────────────
  // ACTIVITIES
  // ─────────────────────────────────────────────────
  activities: {
    key: 'activities',
    label: 'Activities',
    table: 'activities',
    alias: 'av',
    baseWhere: 'TRUE',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'av.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'activity_type', label: 'Type', type: 'text', sqlExpr: 'av.activity_type', groupable: true, filterable: true },
      { key: 'title', label: 'Title', type: 'text', sqlExpr: 'av.title', filterable: true },
      { key: 'entity_type', label: 'Module', type: 'text', sqlExpr: 'av.entity_type', groupable: true, filterable: true },
      { key: 'created_at', label: 'Date', type: 'datetime', sqlExpr: 'av.created_at', groupable: true, filterable: true },
      // Joined
      { key: 'performed_by_name', label: 'Performed By', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'performed_by', label: 'Performed By ID', type: 'text', sqlExpr: 'av.performed_by', filterable: true },
    ],
    joins: {
      users: { sql: 'LEFT JOIN "{schema}".users u ON av.performed_by = u.id', alias: 'u' },
    },
  },

  // ─────────────────────────────────────────────────
  // OPPORTUNITY PRODUCTS (line items)
  // ─────────────────────────────────────────────────
  opportunity_products: {
    key: 'opportunity_products',
    label: 'Opportunity Products',
    table: 'opportunity_line_items',
    alias: 'oli',
    baseWhere: 'TRUE',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'oli.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'quantity', label: 'Quantity', type: 'number', sqlExpr: 'oli.quantity', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'unit_price', label: 'Unit Price', type: 'currency', sqlExpr: 'oli.unit_price', aggregates: ['avg', 'min', 'max'], filterable: true },
      { key: 'line_total', label: 'Line Total', type: 'currency', sqlExpr: 'oli.total_price', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'oli.created_at', groupable: true, filterable: true },
      // Joined
      { key: 'product_name', label: 'Product', type: 'text', sqlExpr: 'p.name', join: 'products', groupable: true, filterable: true },
      { key: 'product_code', label: 'Product Code', type: 'text', sqlExpr: 'p.code', join: 'products', groupable: true, filterable: true },
      { key: 'opp_name', label: 'Opportunity', type: 'text', sqlExpr: 'opp.name', join: 'opportunities', groupable: true, filterable: true },
      { key: 'opp_won_at', label: 'Opp Won Date', type: 'datetime', sqlExpr: 'opp.won_at', join: 'opportunities', filterable: true },
      { key: 'opp_owner_name', label: 'Opp Owner', type: 'text', sqlExpr: "CONCAT(ou.first_name, ' ', ou.last_name)", join: 'opp_owner', groupable: true },
    ],
    joins: {
      products:      { sql: 'LEFT JOIN "{schema}".products p ON oli.product_id = p.id', alias: 'p' },
      opportunities: { sql: 'LEFT JOIN "{schema}".opportunities opp ON oli.opportunity_id = opp.id', alias: 'opp' },
      opp_owner:     { sql: 'LEFT JOIN "{schema}".users ou ON opp.owner_id = ou.id', alias: 'ou' },
    },
  },

  // ─────────────────────────────────────────────────
  // TARGETS (base: target_assignments + joins to targets & target_progress)
  // ─────────────────────────────────────────────────
  targets: {
    key: 'targets',
    label: 'Targets',
    table: 'target_assignments',
    alias: 'ta',
    baseWhere: 'ta.is_active = true',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'ta.id', aggregates: ['count'], filterable: true },
      { key: 'target_value', label: 'Target Value', type: 'currency', sqlExpr: 'ta.target_value', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'actual_value', label: 'Actual Value', type: 'currency', sqlExpr: 'COALESCE(tp.actual_value, 0)', join: 'progress', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'percentage', label: 'Attainment %', type: 'percent', sqlExpr: 'COALESCE(tp.percentage, 0)', join: 'progress', aggregates: ['avg', 'min', 'max'], filterable: true },
      { key: 'pace_status', label: 'Pace', type: 'text', sqlExpr: 'tp.pace_status', join: 'progress', groupable: true, filterable: true },
      { key: 'metric_type', label: 'Metric Type', type: 'text', sqlExpr: 'tdef.metric_type', join: 'target_def', groupable: true, filterable: true },
      { key: 'metric_key', label: 'Metric', type: 'text', sqlExpr: 'tdef.metric_key', join: 'target_def', groupable: true, filterable: true },
      { key: 'target_name', label: 'Target Name', type: 'text', sqlExpr: 'tdef.name', join: 'target_def', groupable: true, filterable: true },
      { key: 'period_type', label: 'Period Type', type: 'text', sqlExpr: 'tdef.period', join: 'target_def', groupable: true, filterable: true },
      { key: 'scope_type', label: 'Scope', type: 'text', sqlExpr: 'ta.scope_type', groupable: true, filterable: true },
      { key: 'period_start', label: 'Period Start', type: 'date', sqlExpr: 'ta.period_start', groupable: true, filterable: true },
      { key: 'period_end', label: 'Period End', type: 'date', sqlExpr: 'ta.period_end', filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'ta.created_at', groupable: true, filterable: true },
      // Joined
      { key: 'assignee_name', label: 'Assigned To', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'team_name', label: 'Team', type: 'text', sqlExpr: 'tm.name', join: 'teams', groupable: true, filterable: true },
    ],
    joins: {
      target_def: { sql: 'LEFT JOIN "{schema}".targets tdef ON ta.target_id = tdef.id', alias: 'tdef' },
      progress:   { sql: 'LEFT JOIN "{schema}".target_progress tp ON tp.assignment_id = ta.id', alias: 'tp' },
      users:      { sql: 'LEFT JOIN "{schema}".users u ON ta.user_id = u.id', alias: 'u' },
      teams:      { sql: 'LEFT JOIN "{schema}".teams tm ON ta.team_id = tm.id', alias: 'tm' },
    },
  },

  // ─────────────────────────────────────────────────
  // PROJECTS
  // ─────────────────────────────────────────────────
  projects: {
    key: 'projects',
    label: 'Projects',
    table: 'projects',
    alias: 'pr',
    baseWhere: 'pr.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'pr.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'name', label: 'Name', type: 'text', sqlExpr: 'pr.name', groupable: true, filterable: true },
      { key: 'budget', label: 'Budget', type: 'currency', sqlExpr: 'pr.budget', aggregates: ['sum', 'avg', 'min', 'max'], filterable: true },
      { key: 'status_name', label: 'Status', type: 'text', sqlExpr: 'ps.name', join: 'statuses', groupable: true, filterable: true },
      { key: 'start_date', label: 'Start Date', type: 'date', sqlExpr: 'pr.start_date', groupable: true, filterable: true },
      { key: 'end_date', label: 'End Date', type: 'date', sqlExpr: 'pr.end_date', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'pr.created_at', groupable: true, filterable: true },
      { key: 'owner_name', label: 'Owner', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'account_name', label: 'Account', type: 'text', sqlExpr: 'ac.name', join: 'accounts', groupable: true, filterable: true },
    ],
    joins: {
      statuses: { sql: 'LEFT JOIN "{schema}".project_statuses ps ON pr.status_id = ps.id', alias: 'ps' },
      users: { sql: 'LEFT JOIN "{schema}".users u ON pr.owner_id = u.id', alias: 'u' },
      accounts: { sql: 'LEFT JOIN "{schema}".accounts ac ON pr.account_id = ac.id', alias: 'ac' },
    },
  },

  // ─────────────────────────────────────────────────
  // PROJECT TASKS
  // ─────────────────────────────────────────────────
  project_tasks: {
    key: 'project_tasks',
    label: 'Project Tasks',
    table: 'project_tasks',
    alias: 'ptask',
    baseWhere: 'ptask.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'ptask.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'title', label: 'Title', type: 'text', sqlExpr: 'ptask.title', filterable: true },
      { key: 'priority', label: 'Priority', type: 'text', sqlExpr: 'ptask.priority', groupable: true, filterable: true },
      { key: 'status_name', label: 'Status', type: 'text', sqlExpr: 'pts.name', join: 'task_statuses', groupable: true, filterable: true },
      { key: 'due_date', label: 'Due Date', type: 'date', sqlExpr: 'ptask.due_date', groupable: true, filterable: true },
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number', sqlExpr: 'ptask.estimated_hours', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'ptask.created_at', groupable: true, filterable: true },
      { key: 'assignee_name', label: 'Assignee', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
      { key: 'project_name', label: 'Project', type: 'text', sqlExpr: 'pr.name', join: 'projects', groupable: true, filterable: true },
    ],
    joins: {
      task_statuses: { sql: 'LEFT JOIN "{schema}".project_task_statuses pts ON ptask.status_id = pts.id', alias: 'pts' },
      users: { sql: 'LEFT JOIN "{schema}".users u ON ptask.assignee_id = u.id', alias: 'u' },
      projects: { sql: 'LEFT JOIN "{schema}".projects pr ON ptask.project_id = pr.id', alias: 'pr' },
    },
  },

  // ─────────────────────────────────────────────────
  // INVOICES
  // ─────────────────────────────────────────────────
  invoices: {
    key: 'invoices',
    label: 'Invoices',
    table: 'invoices',
    alias: 'inv',
    baseWhere: 'inv.deleted_at IS NULL',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'inv.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'total_amount', label: 'Total Amount', type: 'currency', sqlExpr: 'inv.total_amount', aggregates: ['sum', 'avg', 'min', 'max'], filterable: true },
      { key: 'amount_paid', label: 'Amount Paid', type: 'currency', sqlExpr: 'inv.amount_paid', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'amount_due', label: 'Amount Due', type: 'currency', sqlExpr: 'inv.amount_due', aggregates: ['sum', 'avg'], filterable: true },
      { key: 'status', label: 'Status', type: 'text', sqlExpr: 'inv.status', groupable: true, filterable: true },
      { key: 'issue_date', label: 'Issue Date', type: 'date', sqlExpr: 'inv.issue_date', groupable: true, filterable: true },
      { key: 'due_date', label: 'Due Date', type: 'date', sqlExpr: 'inv.due_date', groupable: true, filterable: true },
      { key: 'paid_at', label: 'Paid Date', type: 'datetime', sqlExpr: 'inv.paid_at', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'inv.created_at', groupable: true, filterable: true },
      { key: 'account_name', label: 'Account', type: 'text', sqlExpr: 'ac.name', join: 'accounts', groupable: true, filterable: true },
      { key: 'currency', label: 'Currency', type: 'text', sqlExpr: 'inv.currency', groupable: true, filterable: true },
    ],
    joins: {
      accounts: { sql: 'LEFT JOIN "{schema}".accounts ac ON inv.account_id = ac.id', alias: 'ac' },
    },
  },

  // ─────────────────────────────────────────────────
  // FORM BOOKINGS
  // ─────────────────────────────────────────────────
  form_bookings: {
    key: 'form_bookings',
    label: 'Bookings',
    table: 'form_bookings',
    alias: 'fb',
    baseWhere: 'TRUE',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'fb.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'invitee_name', label: 'Invitee', type: 'text', sqlExpr: 'fb.invitee_name', filterable: true },
      { key: 'invitee_email', label: 'Email', type: 'text', sqlExpr: 'fb.invitee_email', filterable: true },
      { key: 'status', label: 'Status', type: 'text', sqlExpr: 'fb.status', groupable: true, filterable: true },
      { key: 'location_type', label: 'Location Type', type: 'text', sqlExpr: 'fb.location_type', groupable: true, filterable: true },
      { key: 'start_time', label: 'Start Time', type: 'datetime', sqlExpr: 'fb.start_time', groupable: true, filterable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sqlExpr: 'fb.created_at', groupable: true, filterable: true },
      { key: 'form_name', label: 'Booking Page', type: 'text', sqlExpr: 'f.name', join: 'forms', groupable: true, filterable: true },
      { key: 'host_name', label: 'Host', type: 'text', sqlExpr: "CONCAT(u.first_name, ' ', u.last_name)", join: 'users', groupable: true, filterable: true },
    ],
    joins: {
      forms: { sql: 'LEFT JOIN "{schema}".forms f ON fb.form_id = f.id', alias: 'f' },
      users: { sql: 'LEFT JOIN "{schema}".users u ON fb.host_user_id = u.id', alias: 'u' },
    },
  },

  // ─────────────────────────────────────────────────
  // FORM SUBMISSIONS
  // ─────────────────────────────────────────────────
  form_submissions: {
    key: 'form_submissions',
    label: 'Form Submissions',
    table: 'form_submissions',
    alias: 'fs',
    baseWhere: 'TRUE',
    fields: [
      { key: 'id', label: 'ID', type: 'text', sqlExpr: 'fs.id', aggregates: ['count', 'count_distinct'], filterable: true },
      { key: 'created_at', label: 'Submitted At', type: 'datetime', sqlExpr: 'fs.created_at', groupable: true, filterable: true },
      { key: 'form_name', label: 'Form', type: 'text', sqlExpr: 'f.name', join: 'forms', groupable: true, filterable: true },
      { key: 'ip_address', label: 'IP Address', type: 'text', sqlExpr: 'fs.ip_address', filterable: true },
    ],
    joins: {
      forms: { sql: 'LEFT JOIN "{schema}".forms f ON fs.form_id = f.id', alias: 'f' },
    },
  },
};

// ============================================================
// CROSS-MODULE (virtual data source)
// Uses CTEs to combine data from multiple tables
// ============================================================

/**
 * Cross-module reports are handled specially in the query builder.
 * They use CTEs to aggregate data from multiple sources per user.
 */
export const CROSS_MODULE_CTE = {
  key: 'cross_module',
  label: 'Cross-Module Performance',
  /**
   * Generate the CTE SQL for cross-module reports
   */
  buildCTE(schema: string, dateFilter: string): string {
    return `
      WITH user_activities AS (
        SELECT performed_by as user_id, COUNT(*) as activity_count
        FROM "${schema}".activities
        WHERE ${dateFilter || 'TRUE'}
        GROUP BY performed_by
      ),
      user_deals AS (
        SELECT owner_id as user_id,
          COUNT(*) FILTER (WHERE won_at IS NOT NULL) as deals_won,
          COALESCE(SUM(amount) FILTER (WHERE won_at IS NOT NULL), 0) as revenue_won,
          COUNT(*) as total_deals,
          CASE WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE won_at IS NOT NULL)::float / COUNT(*)::float) * 100
            ELSE 0
          END as conversion_rate
        FROM "${schema}".opportunities
        WHERE deleted_at IS NULL AND ${dateFilter || 'TRUE'}
        GROUP BY owner_id
      ),
      user_leads AS (
        SELECT owner_id as user_id, COUNT(*) as leads_created
        FROM "${schema}".leads
        WHERE deleted_at IS NULL AND ${dateFilter || 'TRUE'}
        GROUP BY owner_id
      ),
      user_targets AS (
        SELECT ta.user_id,
          AVG(CASE WHEN ta.target_value > 0 THEN (COALESCE(tp.actual_value, 0) / ta.target_value) * 100 ELSE 0 END) as target_attainment
        FROM "${schema}".target_assignments ta
        LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
        WHERE ta.is_active = true AND ta.user_id IS NOT NULL
        GROUP BY ta.user_id
      )
      SELECT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        COALESCE(ua.activity_count, 0) as activity_count,
        COALESCE(ud.deals_won, 0) as deals_won,
        COALESCE(ud.revenue_won, 0) as revenue_won,
        COALESCE(ud.total_deals, 0) as total_deals,
        COALESCE(ud.conversion_rate, 0) as conversion_rate,
        COALESCE(ul.leads_created, 0) as leads_created,
        COALESCE(ut.target_attainment, 0) as target_attainment
      FROM "${schema}".users u
      LEFT JOIN user_activities ua ON ua.user_id = u.id
      LEFT JOIN user_deals ud ON ud.user_id = u.id
      LEFT JOIN user_leads ul ON ul.user_id = u.id
      LEFT JOIN user_targets ut ON ut.user_id = u.id
      WHERE u.status = 'active' AND u.deleted_at IS NULL
    `;
  },
};

// ============================================================
// HELPER: Get data source for frontend
// ============================================================
export function getDataSourcesForFrontend(): Array<{
  key: string;
  label: string;
  fields: Array<{ key: string; label: string; type: FieldType; groupable: boolean; aggregates: AggregateType[] }>;
}> {
  return Object.values(DATA_SOURCES).map(ds => ({
    key: ds.key,
    label: ds.label,
    fields: ds.fields
      .filter(f => f.key !== 'age_bucket_sort' && f.key !== 'stage_sort') // hide internal sort fields
      .map(f => ({
        key: f.key,
        label: f.label,
        type: f.type,
        groupable: f.groupable ?? false,
        filterable: f.filterable ?? false,
        aggregates: f.aggregates || (f.type === 'text' ? ['count', 'count_distinct'] : ['count', 'sum', 'avg', 'min', 'max']),
      })),
  }));
}