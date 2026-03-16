// ============================================================
// FILE: apps/web/src/api/dashboard-layout.api.ts
// ============================================================
import { api } from './contacts.api';

export interface DashboardTabFilters {
  dateRange: {
    enabled: boolean;
    default: string;
    options: string[];
  };
  scope: {
    enabled: boolean;
    default: string;
    options: string[];
  };
}

export interface UserDashboard {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  tabFilters: DashboardTabFilters;
  widgetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  title: string | null;
  widgetType: 'chart' | 'scorecard' | 'leaderboard' | 'table' | 'projection';
  position: WidgetPosition;
  dataSource: string | null;
  reportType: string;
  chartType: string;
  config: {
    measures?: any[];
    dimensions?: any[];
    filters?: any[];
    orderBy?: any[];
    limit?: number;
    fields?: string[];
  };
  displayConfig: {
    showLegend?: boolean;
    showTrend?: boolean;
    trendField?: string;
    trendGranularity?: string;
    rankBy?: string;
    showCrown?: boolean;
    targetValue?: number;
    targetLabel?: string;
    colorScheme?: string;
    // projection-specific
    sliderLabel?: string;
    sliderMin?: number;
    sliderMax?: number;
    sliderStep?: number;
    sliderDefault?: number;
    projectionMeasure?: string;
    baseSeriesLabel?: string;
    projectedSeriesLabel?: string;
  };
  filterSensitivity: {
    respondsToDashboardDateRange: boolean;
    respondsToDashboardScope: boolean;
    overrideScope?: string;
  };
  refreshInterval: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  dashboardId: string;
  shareToken: string;
  expiresAt: string | null;
  allowedEmails: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardExport {
  version: number;
  exportedAt: string;
  dashboard: { name: string; tabFilters: DashboardTabFilters };
  widgets: Array<Partial<DashboardWidget>>;
}

export const dashboardLayoutApi = {
  // ── Dashboards ──────────────────────────────────────────────
  listDashboards: async (): Promise<UserDashboard[]> => {
    const { data } = await api.get('/dashboard/layout/dashboards');
    return data;
  },

  createDashboard: async (name: string): Promise<UserDashboard> => {
    const { data } = await api.post('/dashboard/layout/dashboards', { name });
    return data;
  },

  updateDashboard: async (
    id: string,
    dto: { name?: string; sortOrder?: number; isDefault?: boolean; tabFilters?: DashboardTabFilters },
  ): Promise<UserDashboard> => {
    const { data } = await api.patch(`/dashboard/layout/dashboards/${id}`, dto);
    return data;
  },

  deleteDashboard: async (id: string): Promise<void> => {
    await api.delete(`/dashboard/layout/dashboards/${id}`);
  },

  // ── Widgets ─────────────────────────────────────────────────
  listWidgets: async (dashboardId: string): Promise<DashboardWidget[]> => {
    const { data } = await api.get(`/dashboard/layout/dashboards/${dashboardId}/widgets`);
    return data;
  },

  createWidget: async (dashboardId: string, dto: Partial<DashboardWidget>): Promise<DashboardWidget> => {
    const { data } = await api.post(`/dashboard/layout/dashboards/${dashboardId}/widgets`, dto);
    return data;
  },

  updateWidget: async (widgetId: string, dto: Partial<DashboardWidget>): Promise<DashboardWidget> => {
    const { data } = await api.put(`/dashboard/layout/widgets/${widgetId}`, dto);
    return data;
  },

  deleteWidget: async (widgetId: string): Promise<void> => {
    await api.delete(`/dashboard/layout/widgets/${widgetId}`);
  },

  bulkUpdatePositions: async (
    dashboardId: string,
    updates: Array<{ id: string; position: WidgetPosition }>,
  ): Promise<void> => {
    await api.post(`/dashboard/layout/dashboards/${dashboardId}/positions`, { updates });
  },

  duplicateWidget: async (widgetId: string, dashboardId: string): Promise<DashboardWidget> => {
    const { data } = await api.post(`/dashboard/layout/widgets/${widgetId}/duplicate`, { dashboardId });
    return data;
  },

  // ── Export / Import ───────────────────────────────────────
  exportDashboard: async (dashboardId: string): Promise<DashboardExport> => {
    const { data } = await api.get(`/dashboard/layout/dashboards/${dashboardId}/export`);
    return data;
  },

  importDashboard: async (payload: DashboardExport): Promise<{ dashboard: UserDashboard; widgets: DashboardWidget[] }> => {
    const { data } = await api.post('/dashboard/layout/dashboards/import', payload);
    return data;
  },

  // ── Share Links ───────────────────────────────────────────
  createShareLink: async (dashboardId: string, dto: { expiresAt?: string; allowedEmails?: string[] }): Promise<ShareLink> => {
    const { data } = await api.post(`/dashboard/layout/dashboards/${dashboardId}/share`, dto);
    return data;
  },

  listShareLinks: async (dashboardId: string): Promise<ShareLink[]> => {
    const { data } = await api.get(`/dashboard/layout/dashboards/${dashboardId}/shares`);
    return data;
  },

  revokeShareLink: async (shareLinkId: string): Promise<void> => {
    await api.delete(`/dashboard/layout/shares/${shareLinkId}`);
  },

  // ── Public shared dashboard ───────────────────────────────
  getSharedDashboard: async (token: string, email?: string): Promise<{
    dashboard: { id: string; name: string; tabFilters: DashboardTabFilters };
    widgets: DashboardWidget[];
    expiresAt: string | null;
  }> => {
    const params = email ? { email } : {};
    const { data } = await api.get(`/shared/dashboard/${token}`, { params });
    return data;
  },
};

// ── Date range helpers ──────────────────────────────────────

export const DATE_RANGE_OPTIONS: Record<string, { label: string; getRange: () => { from: string; to: string } }> = {
  today: {
    label: 'Today',
    getRange: () => {
      const d = new Date().toISOString().split('T')[0];
      return { from: `${d}T00:00:00Z`, to: `${d}T23:59:59Z` };
    },
  },
  this_week: {
    label: 'This Week',
    getRange: () => {
      const now = new Date();
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setDate(now.getDate() + (6 - day)); end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    },
  },
  this_month: {
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    },
  },
  this_quarter: {
    label: 'This Quarter',
    getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    },
  },
  this_year: {
    label: 'This Year',
    getRange: () => {
      const y = new Date().getFullYear();
      return { from: `${y}-01-01T00:00:00Z`, to: `${y}-12-31T23:59:59Z` };
    },
  },
  last_30_days: {
    label: 'Last 30 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      return { from: start.toISOString(), to: end.toISOString() };
    },
  },
  last_90_days: {
    label: 'Last 90 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 86400000);
      return { from: start.toISOString(), to: end.toISOString() };
    },
  },
};
