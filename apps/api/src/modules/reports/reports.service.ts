// ============================================================
// FILE: apps/api/src/modules/reports/reports.service.ts
//
// Full CRUD for report definitions + execute engine + export.
// Follows project patterns: raw SQL, parameterized queries,
// DataSource injection, audit logging.
// ============================================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { RecordScopeService } from '../../common/services/record-scope.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DATA_SOURCES, getDataSourcesForFrontend } from './report-data-sources';
import { buildReportQuery, ReportConfig, ReportFilter, BuildContext } from './report-query-builder';

// ── DTOs ──
export interface CreateReportDto {
  name: string;
  description?: string;
  category?: string;
  reportType?: string;
  chartType?: string;
  dataSource: string;
  config: ReportConfig;
  isPublic?: boolean;
  folderId?: string;
}

export interface UpdateReportDto {
  name?: string;
  description?: string;
  category?: string;
  reportType?: string;
  chartType?: string;
  dataSource?: string;
  config?: ReportConfig;
  isPublic?: boolean;
  folderId?: string;
}

export interface QueryReportsDto {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  dataSource?: string;
  folderId?: string;
  isSystem?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export interface ExecuteReportDto {
  /** Report definition to execute (for preview / unsaved reports) */
  dataSource: string;
  reportType: string;
  config: ReportConfig;
  /** Runtime filter overrides */
  runtimeFilters?: ReportFilter[];
}

export interface ScheduleReportDto {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  recipients: string[];
  format?: 'csv' | 'xlsx';
  isActive?: boolean;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private recordScopeService: RecordScopeService,
  ) {}

  // ============================================================
  // DATA SOURCES (for builder UI)
  // ============================================================

  getDataSources() {
    return getDataSourcesForFrontend();
  }

  // ============================================================
  // FOLDERS
  // ============================================================

  async getFolders(schema: string) {
    const rows = await this.dataSource.query(
      `SELECT id, name, parent_id, is_system, created_at
       FROM "${schema}".report_folders
       ORDER BY is_system DESC, name ASC`,
    );
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      parentId: r.parent_id,
      isSystem: r.is_system,
      createdAt: r.created_at,
    }));
  }

  async createFolder(schema: string, name: string, parentId?: string, userId?: string) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schema}".report_folders (name, parent_id, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, parentId || null, userId || null],
    );
    return { id: row.id, name: row.name, parentId: row.parent_id };
  }

  async deleteFolder(schema: string, id: string) {
    // Move reports in this folder to root (null)
    await this.dataSource.query(
      `UPDATE "${schema}".reports SET folder_id = NULL WHERE folder_id = $1`,
      [id],
    );
    await this.dataSource.query(
      `DELETE FROM "${schema}".report_folders WHERE id = $1 AND is_system = false`,
      [id],
    );
    return { deleted: true };
  }

  // ============================================================
  // CRUD
  // ============================================================

  async findAll(schema: string, query: QueryReportsDto, user: JwtPayload) {
    const {
      page = 1, limit = 50, search, category,
      dataSource: dsFilter, folderId, isSystem, sortBy = 'name', sortOrder = 'ASC',
    } = query;

    let whereClause = 'TRUE';
    const params: any[] = [];
    let paramIdx = 1;

    // Visibility: user can see system reports, their own, and public reports
    whereClause += ` AND (r.is_system = true OR r.is_public = true OR r.created_by = $${paramIdx})`;
    params.push(user.sub);
    paramIdx++;

    if (search) {
      whereClause += ` AND (r.name ILIKE $${paramIdx} OR r.description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (category) {
      whereClause += ` AND r.category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    if (dsFilter) {
      whereClause += ` AND r.data_source = $${paramIdx}`;
      params.push(dsFilter);
      paramIdx++;
    }

    if (folderId === 'null' || folderId === '') {
      whereClause += ' AND r.folder_id IS NULL';
    } else if (folderId) {
      whereClause += ` AND r.folder_id = $${paramIdx}`;
      params.push(folderId);
      paramIdx++;
    }

    if (isSystem !== undefined) {
      whereClause += ` AND r.is_system = $${paramIdx}`;
      params.push(isSystem);
      paramIdx++;
    }

    // Count
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".reports r WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    // Sort
    const sortMap: Record<string, string> = {
      name: 'r.name', category: 'r.category', created_at: 'r.created_at',
      updated_at: 'r.updated_at', data_source: 'r.data_source',
    };
    const orderCol = sortMap[sortBy] || 'r.name';
    const order = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const rows = await this.dataSource.query(
      `SELECT r.*, 
              f.name as folder_name,
              u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schema}".reports r
       LEFT JOIN "${schema}".report_folders f ON r.folder_id = f.id
       LEFT JOIN "${schema}".users u ON r.created_by = u.id
       WHERE ${whereClause}
       ORDER BY r.is_system DESC, ${orderCol} ${order}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatReport(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(schema: string, id: string, user: JwtPayload) {
    const [row] = await this.dataSource.query(
      `SELECT r.*, 
              f.name as folder_name,
              u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM "${schema}".reports r
       LEFT JOIN "${schema}".report_folders f ON r.folder_id = f.id
       LEFT JOIN "${schema}".users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Report not found');

    // Check visibility
    if (!row.is_system && !row.is_public && row.created_by !== user.sub) {
      throw new ForbiddenException('You do not have access to this report');
    }

    return this.formatReport(row);
  }

  async create(schema: string, userId: string, dto: CreateReportDto) {
    if (!DATA_SOURCES[dto.dataSource] && dto.dataSource !== 'cross_module') {
      throw new BadRequestException(`Invalid data source: ${dto.dataSource}`);
    }

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schema}".reports
       (name, description, category, report_type, chart_type, data_source, config, is_public, folder_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        dto.category || 'custom',
        dto.reportType || 'summary',
        dto.chartType || 'bar',
        dto.dataSource,
        JSON.stringify(dto.config),
        dto.isPublic !== false,
        dto.folderId || null,
        userId,
      ],
    );

    await this.auditService.log(schema, {
      action: 'create',
      entityType: 'reports',
      entityId: row.id,
      performedBy: userId,
      changes: {},
      newValues: { name: dto.name, dataSource: dto.dataSource },
    });

    return this.formatReport(row);
  }

  async update(schema: string, id: string, userId: string, dto: UpdateReportDto) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('Report not found');

    // Cannot edit system reports directly — clone instead
    if (existing.is_system) {
      throw new BadRequestException('System reports cannot be edited. Clone the report to customize it.');
    }

    // Only owner or admin can edit
    if (existing.created_by !== userId) {
      throw new ForbiddenException('Only the report creator can edit this report');
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.category !== undefined) { sets.push(`category = $${idx++}`); params.push(dto.category); }
    if (dto.reportType !== undefined) { sets.push(`report_type = $${idx++}`); params.push(dto.reportType); }
    if (dto.chartType !== undefined) { sets.push(`chart_type = $${idx++}`); params.push(dto.chartType); }
    if (dto.dataSource !== undefined) { sets.push(`data_source = $${idx++}`); params.push(dto.dataSource); }
    if (dto.config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(dto.config)); }
    if (dto.isPublic !== undefined) { sets.push(`is_public = $${idx++}`); params.push(dto.isPublic); }
    if (dto.folderId !== undefined) { sets.push(`folder_id = $${idx++}`); params.push(dto.folderId || null); }

    if (sets.length === 0) return this.formatReport(existing);

    sets.push(`updated_at = NOW()`);

    const [row] = await this.dataSource.query(
      `UPDATE "${schema}".reports SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...params, id],
    );

    await this.auditService.log(schema, {
      action: 'update',
      entityType: 'reports',
      entityId: id,
      performedBy: userId,
      changes: { name: { from: existing.name, to: row.name } },
      previousValues: { name: existing.name },
      newValues: { name: row.name },
    });

    return this.formatReport(row);
  }

  async delete(schema: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('Report not found');

    if (existing.is_system) {
      throw new BadRequestException('System reports cannot be deleted');
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".reports WHERE id = $1`,
      [id],
    );

    await this.auditService.log(schema, {
      action: 'delete',
      entityType: 'reports',
      entityId: id,
      performedBy: userId,
      changes: {},
      previousValues: { name: existing.name },
    });

    return { deleted: true };
  }

  async clone(schema: string, id: string, userId: string, newName?: string) {
    const original = await this.findOneRaw(schema, id);
    if (!original) throw new NotFoundException('Report not found');

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schema}".reports
       (name, description, category, report_type, chart_type, data_source, config, is_system, is_public, folder_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10)
       RETURNING *`,
      [
        newName || `${original.name} (Copy)`,
        original.description,
        original.category,
        original.report_type,
        original.chart_type,
        original.data_source,
        JSON.stringify(original.config),
        true,
        original.folder_id,
        userId,
      ],
    );

    return this.formatReport(row);
  }

  // ============================================================
  // EXECUTE REPORT
  // ============================================================

  async execute(schema: string, id: string, user: JwtPayload, runtimeFilters?: ReportFilter[]) {
    const report = await this.findOneRaw(schema, id);
    if (!report) throw new NotFoundException('Report not found');

    return this.executeConfig(schema, {
      dataSource: report.data_source,
      reportType: report.report_type,
      config: report.config,
      runtimeFilters,
    }, user);
  }

  async executeConfig(schema: string, dto: ExecuteReportDto, user: JwtPayload) {
    const { dataSource, reportType, config, runtimeFilters } = dto;

    // Build RBAC access filter
    let accessFilter: string | undefined;
    if (dataSource !== 'cross_module') {
      const ds = DATA_SOURCES[dataSource];
      if (ds) {
        // Map data source to RBAC module
        const rbacModule = this.mapDataSourceToModule(dataSource);
        const ownerCol = this.getOwnerColumn(ds);
        if (ownerCol) {
          accessFilter = await this.recordScopeService.buildWhereClause(
            user, rbacModule, schema, ownerCol,
          );
        }
      }
    }

    const ctx: BuildContext = {
      schema,
      dataSource,
      config,
      reportType: (reportType as any) || 'summary',
      accessFilter,
      runtimeFilters,
    };

    const built = buildReportQuery(ctx);

    this.logger.debug(`Executing report SQL:\n${built.sql}`);
    this.logger.debug(`Params: ${JSON.stringify(built.params)}`);

    try {
      const rows = await this.dataSource.query(built.sql, built.params);

      // Post-process: convert numeric strings to numbers
      const data = rows.map((row: any) => {
        const processed: Record<string, any> = {};
        for (const col of built.columns) {
          let val = row[col.key];
          if (val !== null && val !== undefined) {
            if (['currency', 'number', 'percent'].includes(col.format || '')) {
              val = parseFloat(val);
              if (isNaN(val)) val = 0;
            }
            // Format dates as ISO strings
            if (val instanceof Date) {
              val = val.toISOString();
            }
          }
          processed[col.key] = val;
        }
        return processed;
      });

      return {
        data,
        columns: built.columns,
        totalRows: data.length,
      };
    } catch (err: any) {
      this.logger.error(`Report execution error: ${err.message}`);
      this.logger.error(`SQL: ${built.sql}`);
      throw new BadRequestException(`Report execution failed: ${err.message}`);
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  async exportReport(schema: string, id: string, user: JwtPayload, format: 'csv' | 'xlsx' = 'csv') {
    const result = await this.execute(schema, id, user);
    const report = await this.findOneRaw(schema, id);

    if (format === 'csv') {
      return this.generateCSV(result.data, result.columns, report?.name || 'report');
    }
    // xlsx would need a library like exceljs — return CSV for now
    return this.generateCSV(result.data, result.columns, report?.name || 'report');
  }

  private generateCSV(
    data: any[],
    columns: Array<{ key: string; label: string; format?: string }>,
    _name: string,
  ): { content: string; filename: string; mimeType: string } {
    const headers = columns.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row =>
      columns.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      }).join(',')
    );

    return {
      content: [headers, ...rows].join('\n'),
      filename: `${_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv',
    };
  }

  // ============================================================
  // SCHEDULES
  // ============================================================

  async getSchedules(schema: string, reportId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".report_schedules WHERE report_id = $1 ORDER BY created_at DESC`,
      [reportId],
    );
    return rows.map((r: any) => this.formatSchedule(r));
  }

  async upsertSchedule(schema: string, reportId: string, userId: string, dto: ScheduleReportDto) {
    // Check if schedule exists
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schema}".report_schedules WHERE report_id = $1 LIMIT 1`,
      [reportId],
    );

    const nextRun = this.calculateNextRun(dto);

    if (existing) {
      const [row] = await this.dataSource.query(
        `UPDATE "${schema}".report_schedules SET
          frequency = $1, day_of_week = $2, day_of_month = $3,
          time_of_day = $4, recipients = $5, format = $6,
          is_active = $7, next_run_at = $8, updated_at = NOW()
         WHERE report_id = $9 RETURNING *`,
        [
          dto.frequency, dto.dayOfWeek || 1, dto.dayOfMonth || 1,
          dto.timeOfDay || '08:00:00', dto.recipients, dto.format || 'csv',
          dto.isActive !== false, nextRun, reportId,
        ],
      );
      return this.formatSchedule(row);
    }

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schema}".report_schedules
       (report_id, frequency, day_of_week, day_of_month, time_of_day, recipients, format, is_active, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        reportId, dto.frequency, dto.dayOfWeek || 1, dto.dayOfMonth || 1,
        dto.timeOfDay || '08:00:00', dto.recipients, dto.format || 'csv',
        dto.isActive !== false, nextRun, userId,
      ],
    );
    return this.formatSchedule(row);
  }

  async deleteSchedule(schema: string, reportId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schema}".report_schedules WHERE report_id = $1`,
      [reportId],
    );
    return { deleted: true };
  }

  // ============================================================
  // REPORT LIBRARY (pre-built)
  // ============================================================

  async getLibrary(schema: string) {
    const rows = await this.dataSource.query(
      `SELECT r.*, f.name as folder_name
       FROM "${schema}".reports r
       LEFT JOIN "${schema}".report_folders f ON r.folder_id = f.id
       WHERE r.is_system = true
       ORDER BY f.name ASC, r.name ASC`,
    );

    // Group by folder
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      const folder = row.folder_name || 'Other';
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(this.formatReport(row));
    }

    return grouped;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async findOneRaw(schema: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schema}".reports WHERE id = $1`,
      [id],
    );
    return row || null;
  }

  private mapDataSourceToModule(dataSource: string): string {
    const map: Record<string, string> = {
      opportunities: 'opportunities',
      leads: 'leads',
      contacts: 'contacts',
      accounts: 'accounts',
      tasks: 'tasks',
      activities: 'tasks',       // activities share task access scope
      opportunity_products: 'opportunities',
      targets: 'targets',
    };
    return map[dataSource] || 'reports';
  }

  private getOwnerColumn(ds: any): string | null {
    const ownerField = ds.fields.find((f: any) => f.key === 'owner_id');
    return ownerField ? ownerField.sqlExpr : null;
  }

  private calculateNextRun(dto: ScheduleReportDto): Date {
    const now = new Date();
    const [hours, minutes] = (dto.timeOfDay || '08:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      switch (dto.frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + (7 - next.getDay() + (dto.dayOfWeek || 1)) % 7 || 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          next.setDate(dto.dayOfMonth || 1);
          break;
      }
    }
    return next;
  }

  private formatReport(row: any) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      reportType: row.report_type,
      chartType: row.chart_type,
      dataSource: row.data_source,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      isSystem: row.is_system,
      isPublic: row.is_public,
      createdBy: row.created_by,
      creatorName: row.creator_first_name ? `${row.creator_first_name} ${row.creator_last_name}` : null,
      folderId: row.folder_id,
      folderName: row.folder_name || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private formatSchedule(row: any) {
    return {
      id: row.id,
      reportId: row.report_id,
      frequency: row.frequency,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
      timeOfDay: row.time_of_day,
      recipients: row.recipients,
      format: row.format,
      isActive: row.is_active,
      lastSentAt: row.last_sent_at,
      nextRunAt: row.next_run_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}