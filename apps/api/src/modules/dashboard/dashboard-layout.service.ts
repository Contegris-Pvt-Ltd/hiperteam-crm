// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard-layout.service.ts
// ============================================================
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { ReportsService } from '../reports/reports.service';
import * as crypto from 'crypto';

@Injectable()
export class DashboardLayoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly reportsService: ReportsService,
  ) {}

  // ── Dashboards ─────────────────────────────────────────────

  async listDashboards(schemaName: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT d.*,
              COUNT(w.id)::int AS widget_count
       FROM "${schemaName}".user_dashboards d
       LEFT JOIN "${schemaName}".user_dashboard_widgets w ON w.dashboard_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.sort_order ASC, d.created_at ASC`,
      [userId],
    );
    return rows.map((r: any) => this.fmtDashboard(r));
  }

  async createDashboard(schemaName: string, userId: string, name: string) {
    const [{ max_order }] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order
       FROM "${schemaName}".user_dashboards WHERE user_id = $1`,
      [userId],
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".user_dashboards
         (user_id, name, sort_order, is_default)
       VALUES ($1, $2, $3, false) RETURNING *`,
      [userId, name, (max_order ?? -1) + 1],
    );
    await this.auditService.log(schemaName, {
      entityType: 'user_dashboard', entityId: row.id,
      action: 'create', changes: {}, newValues: { name },
      performedBy: userId,
    });
    return this.fmtDashboard({ ...row, widget_count: 0 });
  }

  async updateDashboard(
    schemaName: string,
    id: string,
    userId: string,
    dto: { name?: string; sortOrder?: number; isDefault?: boolean; tabFilters?: any },
  ) {
    if (dto.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".user_dashboards
         SET is_default = false WHERE user_id = $1`,
        [userId],
      );
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;
    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sortOrder); }
    if (dto.isDefault !== undefined) { sets.push(`is_default = $${idx++}`); params.push(dto.isDefault); }
    if (dto.tabFilters !== undefined) { sets.push(`tab_filters = $${idx++}`); params.push(JSON.stringify(dto.tabFilters)); }

    if (sets.length > 1) {
      params.push(id, userId);
      await this.dataSource.query(
        `UPDATE "${schemaName}".user_dashboards
         SET ${sets.join(', ')}
         WHERE id = $${idx} AND user_id = $${idx + 1}`,
        params,
      );
      await this.auditService.log(schemaName, {
        entityType: 'user_dashboard', entityId: id,
        action: 'update', changes: {},
        newValues: { name: dto.name, sortOrder: dto.sortOrder, isDefault: dto.isDefault },
        performedBy: userId,
      });
    }
    return this.getDashboard(schemaName, id, userId);
  }

  async deleteDashboard(schemaName: string, id: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".user_dashboards WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".user_dashboards
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    await this.auditService.log(schemaName, {
      entityType: 'user_dashboard', entityId: id,
      action: 'delete', changes: {}, newValues: { name: existing?.name },
      performedBy: userId,
    });
    return { deleted: true };
  }

  async getDashboard(schemaName: string, id: string, userId: string) {
    const [row] = await this.dataSource.query(
      `SELECT d.*, COUNT(w.id)::int AS widget_count
       FROM "${schemaName}".user_dashboards d
       LEFT JOIN "${schemaName}".user_dashboard_widgets w ON w.dashboard_id = d.id
       WHERE d.id = $1 AND d.user_id = $2
       GROUP BY d.id`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Dashboard not found');
    return this.fmtDashboard(row);
  }

  // ── Widgets ────────────────────────────────────────────────

  async listWidgets(schemaName: string, dashboardId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_dashboard_widgets
       WHERE dashboard_id = $1
       ORDER BY created_at ASC`,
      [dashboardId],
    );
    return rows.map((r: any) => this.fmtWidget(r));
  }

  async createWidget(schemaName: string, dashboardId: string, dto: {
    title?: string;
    widgetType?: string;
    position?: any;
    dataSource?: string;
    reportType?: string;
    chartType?: string;
    config?: any;
    displayConfig?: any;
    filterSensitivity?: any;
    refreshInterval?: number;
  }, userId?: string) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".user_dashboard_widgets
         (dashboard_id, title, widget_type, position, data_source,
          report_type, chart_type, config, display_config,
          filter_sensitivity, refresh_interval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        dashboardId,
        dto.title || null,
        dto.widgetType || 'chart',
        JSON.stringify(dto.position || { x: 0, y: 0, w: 6, h: 4 }),
        dto.dataSource || null,
        dto.reportType || 'summary',
        dto.chartType || 'bar',
        JSON.stringify(dto.config || {}),
        JSON.stringify(dto.displayConfig || {}),
        JSON.stringify(dto.filterSensitivity || { respondsToDashboardDateRange: true, respondsToDashboardScope: true }),
        dto.refreshInterval ?? 0,
      ],
    );
    if (userId) {
      await this.auditService.log(schemaName, {
        entityType: 'user_dashboard_widget', entityId: row.id,
        action: 'create', changes: {},
        newValues: { title: dto.title, widgetType: dto.widgetType, dataSource: dto.dataSource, dashboardId },
        performedBy: userId,
      });
    }
    return this.fmtWidget(row);
  }

  async updateWidget(schemaName: string, widgetId: string, dto: {
    title?: string;
    widgetType?: string;
    position?: any;
    dataSource?: string;
    reportType?: string;
    chartType?: string;
    config?: any;
    displayConfig?: any;
    filterSensitivity?: any;
    refreshInterval?: number;
  }, userId?: string) {
    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { sets.push(`title = $${idx++}`); params.push(dto.title); }
    if (dto.widgetType !== undefined) { sets.push(`widget_type = $${idx++}`); params.push(dto.widgetType); }
    if (dto.position !== undefined) { sets.push(`position = $${idx++}`); params.push(JSON.stringify(dto.position)); }
    if (dto.dataSource !== undefined) { sets.push(`data_source = $${idx++}`); params.push(dto.dataSource); }
    if (dto.reportType !== undefined) { sets.push(`report_type = $${idx++}`); params.push(dto.reportType); }
    if (dto.chartType !== undefined) { sets.push(`chart_type = $${idx++}`); params.push(dto.chartType); }
    if (dto.config !== undefined) { sets.push(`config = $${idx++}`); params.push(JSON.stringify(dto.config)); }
    if (dto.displayConfig !== undefined) { sets.push(`display_config = $${idx++}`); params.push(JSON.stringify(dto.displayConfig)); }
    if (dto.filterSensitivity !== undefined) { sets.push(`filter_sensitivity = $${idx++}`); params.push(JSON.stringify(dto.filterSensitivity)); }
    if (dto.refreshInterval !== undefined) { sets.push(`refresh_interval = $${idx++}`); params.push(dto.refreshInterval); }

    params.push(widgetId);
    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".user_dashboard_widgets
       SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (userId) {
      await this.auditService.log(schemaName, {
        entityType: 'user_dashboard_widget', entityId: widgetId,
        action: 'update', changes: {},
        newValues: { title: dto.title, widgetType: dto.widgetType, dataSource: dto.dataSource },
        performedBy: userId,
      });
    }
    return this.fmtWidget(row);
  }

  async deleteWidget(schemaName: string, widgetId: string, userId?: string) {
    const [existing] = await this.dataSource.query(
      `SELECT title, widget_type, data_source FROM "${schemaName}".user_dashboard_widgets WHERE id = $1`,
      [widgetId],
    );
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".user_dashboard_widgets WHERE id = $1`,
      [widgetId],
    );
    if (userId) {
      await this.auditService.log(schemaName, {
        entityType: 'user_dashboard_widget', entityId: widgetId,
        action: 'delete', changes: {},
        newValues: { title: existing?.title, widgetType: existing?.widget_type },
        performedBy: userId,
      });
    }
    return { deleted: true };
  }

  async bulkUpdatePositions(schemaName: string, updates: Array<{ id: string; position: any }>, userId?: string) {
    for (const u of updates) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".user_dashboard_widgets
         SET position = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(u.position), u.id],
      );
    }
    if (userId) {
      await this.auditService.log(schemaName, {
        entityType: 'user_dashboard_widget', entityId: 'bulk',
        action: 'bulk_update', changes: {},
        newValues: { widgetCount: updates.length },
        performedBy: userId,
      });
    }
    return { updated: updates.length };
  }

  async duplicateWidget(schemaName: string, widgetId: string, dashboardId: string, userId?: string) {
    const [orig] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_dashboard_widgets WHERE id = $1`,
      [widgetId],
    );
    if (!orig) throw new NotFoundException('Widget not found');

    const pos = typeof orig.position === 'string' ? JSON.parse(orig.position) : orig.position;
    return this.createWidget(schemaName, dashboardId, {
      title: orig.title ? `${orig.title} (copy)` : undefined,
      widgetType: orig.widget_type,
      position: { ...pos, y: pos.y + pos.h },
      dataSource: orig.data_source,
      reportType: orig.report_type,
      chartType: orig.chart_type,
      config: typeof orig.config === 'string' ? JSON.parse(orig.config) : orig.config,
      displayConfig: typeof orig.display_config === 'string' ? JSON.parse(orig.display_config) : orig.display_config,
      filterSensitivity: typeof orig.filter_sensitivity === 'string' ? JSON.parse(orig.filter_sensitivity) : orig.filter_sensitivity,
      refreshInterval: orig.refresh_interval,
    }, userId);
  }

  // ── Export / Import ────────────────────────────────────────

  async exportDashboard(schemaName: string, dashboardId: string, userId: string) {
    const [dashboard] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_dashboards WHERE id = $1 AND user_id = $2`,
      [dashboardId, userId],
    );
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    const widgets = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_dashboard_widgets WHERE dashboard_id = $1 ORDER BY created_at ASC`,
      [dashboardId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'user_dashboard', entityId: dashboardId,
      action: 'create', changes: {},
      newValues: { action: 'export', name: dashboard.name, widgetCount: widgets.length },
      performedBy: userId,
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: {
        name: dashboard.name,
        tabFilters: typeof dashboard.tab_filters === 'string' ? JSON.parse(dashboard.tab_filters) : (dashboard.tab_filters || {}),
      },
      widgets: widgets.map((w: any) => ({
        title: w.title,
        widgetType: w.widget_type,
        position: typeof w.position === 'string' ? JSON.parse(w.position) : w.position,
        dataSource: w.data_source,
        reportType: w.report_type,
        chartType: w.chart_type,
        config: typeof w.config === 'string' ? JSON.parse(w.config) : w.config,
        displayConfig: typeof w.display_config === 'string' ? JSON.parse(w.display_config) : w.display_config,
        filterSensitivity: typeof w.filter_sensitivity === 'string' ? JSON.parse(w.filter_sensitivity) : w.filter_sensitivity,
        refreshInterval: w.refresh_interval,
      })),
    };
  }

  async importDashboard(schemaName: string, userId: string, payload: any) {
    if (!payload || payload.version !== 1 || !payload.dashboard || !Array.isArray(payload.widgets)) {
      throw new NotFoundException('Invalid dashboard export format');
    }

    const name = payload.dashboard.name ? `${payload.dashboard.name} (imported)` : 'Imported Dashboard';
    const dashboard = await this.createDashboard(schemaName, userId, name);

    if (payload.dashboard.tabFilters) {
      await this.updateDashboard(schemaName, dashboard.id, userId, { tabFilters: payload.dashboard.tabFilters });
    }

    for (const w of payload.widgets) {
      await this.createWidget(schemaName, dashboard.id, {
        title: w.title,
        widgetType: w.widgetType,
        position: w.position,
        dataSource: w.dataSource,
        reportType: w.reportType,
        chartType: w.chartType,
        config: w.config,
        displayConfig: w.displayConfig,
        filterSensitivity: w.filterSensitivity,
        refreshInterval: w.refreshInterval,
      }, userId);
    }

    await this.auditService.log(schemaName, {
      entityType: 'user_dashboard', entityId: dashboard.id,
      action: 'create', changes: {},
      newValues: { action: 'import', name, widgetCount: payload.widgets.length },
      performedBy: userId,
    });

    const widgets = await this.listWidgets(schemaName, dashboard.id);
    return { dashboard, widgets };
  }

  // ── Share Links ───────────────────────────────────────────

  async createShareLink(schemaName: string, dashboardId: string, userId: string, dto: {
    expiresAt?: string;
    allowedEmails?: string[];
  }) {
    // Verify dashboard belongs to user
    const [dashboard] = await this.dataSource.query(
      `SELECT id, name FROM "${schemaName}".user_dashboards WHERE id = $1 AND user_id = $2`,
      [dashboardId, userId],
    );
    if (!dashboard) throw new NotFoundException('Dashboard not found');

    const shareToken = crypto.randomBytes(32).toString('hex');

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".shared_dashboards
         (dashboard_id, share_token, expires_at, allowed_emails, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        dashboardId,
        shareToken,
        dto.expiresAt || null,
        JSON.stringify(dto.allowedEmails || []),
        userId,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'shared_dashboard', entityId: row.id,
      action: 'create', changes: {},
      newValues: { dashboardId, dashboardName: dashboard.name, expiresAt: dto.expiresAt, allowedEmails: dto.allowedEmails },
      performedBy: userId,
    });

    return this.fmtShareLink(row);
  }

  async listShareLinks(schemaName: string, dashboardId: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT sd.* FROM "${schemaName}".shared_dashboards sd
       JOIN "${schemaName}".user_dashboards d ON d.id = sd.dashboard_id
       WHERE sd.dashboard_id = $1 AND d.user_id = $2
       ORDER BY sd.created_at DESC`,
      [dashboardId, userId],
    );
    return rows.map((r: any) => this.fmtShareLink(r));
  }

  async revokeShareLink(schemaName: string, shareLinkId: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT sd.id, sd.dashboard_id FROM "${schemaName}".shared_dashboards sd
       JOIN "${schemaName}".user_dashboards d ON d.id = sd.dashboard_id
       WHERE sd.id = $1 AND d.user_id = $2`,
      [shareLinkId, userId],
    );
    if (!existing) throw new NotFoundException('Share link not found');

    await this.dataSource.query(
      `UPDATE "${schemaName}".shared_dashboards SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [shareLinkId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'shared_dashboard', entityId: shareLinkId,
      action: 'update', changes: {},
      newValues: { isActive: false, action: 'revoked' },
      performedBy: userId,
    });

    return { revoked: true };
  }

  async getSharedDashboard(schemaName: string, token: string, email?: string) {
    const [share] = await this.dataSource.query(
      `SELECT sd.*, d.name AS dashboard_name, d.tab_filters
       FROM "${schemaName}".shared_dashboards sd
       JOIN "${schemaName}".user_dashboards d ON d.id = sd.dashboard_id
       WHERE sd.share_token = $1 AND sd.is_active = true`,
      [token],
    );
    if (!share) throw new NotFoundException('Shared dashboard not found or link has been revoked');

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new ForbiddenException('This share link has expired');
    }

    // Check email restriction
    const allowedEmails: string[] = typeof share.allowed_emails === 'string'
      ? JSON.parse(share.allowed_emails)
      : (share.allowed_emails || []);

    if (allowedEmails.length > 0) {
      if (!email) throw new ForbiddenException('Email verification required to access this dashboard');
      if (!allowedEmails.map((e: string) => e.toLowerCase()).includes(email.toLowerCase())) {
        throw new ForbiddenException('You do not have access to this shared dashboard');
      }
    }

    const widgetRows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_dashboard_widgets WHERE dashboard_id = $1 ORDER BY created_at ASC`,
      [share.dashboard_id],
    );

    // Execute each widget's report and include data inline
    // Use admin-level user to bypass RBAC — recordAccess returns 'all' for every module
    const allAccess = new Proxy({} as Record<string, string>, { get: () => 'all' });
    const adminUser = {
      sub: share.created_by,
      tenantSchema: schemaName,
      role: 'admin',
      roleLevel: 100,
      permissions: {},
      recordAccess: allAccess,
      fieldPermissions: {},
    } as any;

    const widgets = [];
    for (const r of widgetRows) {
      const w = this.fmtWidget(r);
      let widgetData = null;
      if (w.dataSource) {
        try {
          widgetData = await this.reportsService.executeConfig(schemaName, {
            dataSource: w.dataSource,
            reportType: w.reportType || 'summary',
            config: w.config,
            runtimeFilters: [],
          }, adminUser);
        } catch {
          // Widget data fetch failed — return null, frontend will show error
        }
      }
      widgets.push({ ...w, data: widgetData });
    }

    return {
      dashboard: {
        id: share.dashboard_id,
        name: share.dashboard_name,
        tabFilters: typeof share.tab_filters === 'string' ? JSON.parse(share.tab_filters) : (share.tab_filters || {}),
      },
      widgets,
      expiresAt: share.expires_at,
    };
  }

  // ── Public shared access (tenant slug lookup) ──────────────

  async getSharedDashboardPublic(tenantSlug: string, token: string, email?: string) {
    const [tenant] = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE slug = $1 AND status = 'active'`,
      [tenantSlug],
    );
    if (!tenant) throw new NotFoundException('Organization not found');

    return this.getSharedDashboard(tenant.schema_name, token, email);
  }

  // ── Formatters ─────────────────────────────────────────────

  private fmtDashboard(r: any) {
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      sortOrder: r.sort_order,
      isDefault: r.is_default,
      tabFilters: typeof r.tab_filters === 'string' ? JSON.parse(r.tab_filters) : (r.tab_filters || {}),
      widgetCount: r.widget_count ?? 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private fmtShareLink(r: any) {
    return {
      id: r.id,
      dashboardId: r.dashboard_id,
      shareToken: r.share_token,
      expiresAt: r.expires_at,
      allowedEmails: typeof r.allowed_emails === 'string' ? JSON.parse(r.allowed_emails) : (r.allowed_emails || []),
      isActive: r.is_active,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private fmtWidget(r: any) {
    return {
      id: r.id,
      dashboardId: r.dashboard_id,
      title: r.title,
      widgetType: r.widget_type,
      position: typeof r.position === 'string' ? JSON.parse(r.position) : (r.position || { x: 0, y: 0, w: 6, h: 4 }),
      dataSource: r.data_source,
      reportType: r.report_type,
      chartType: r.chart_type,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {}),
      displayConfig: typeof r.display_config === 'string' ? JSON.parse(r.display_config) : (r.display_config || {}),
      filterSensitivity: typeof r.filter_sensitivity === 'string' ? JSON.parse(r.filter_sensitivity) : (r.filter_sensitivity || {}),
      refreshInterval: r.refresh_interval,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
