// ============================================================
// FILE: apps/web/src/api/reports.api.ts
//
// Frontend API client for the Reporting Engine.
// ============================================================

import { api } from '../lib/api';

// ── Types ──

export interface ReportConfig {
  measures?: ReportMeasure[];
  dimensions?: ReportDimension[];
  fields?: string[];
  filters?: ReportFilter[];
  orderBy?: ReportOrderBy[];
  limit?: number;
  pivotField?: string;
}

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
  operator: string;
  value: any;
  dateRelative?: string;
}

export interface ReportOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface Report {
  id: string;
  name: string;
  description: string | null;
  category: string;
  reportType: string;
  chartType: string;
  dataSource: string;
  config: ReportConfig;
  isSystem: boolean;
  isPublic: boolean;
  createdBy: string | null;
  creatorName: string | null;
  folderId: string | null;
  folderName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportFolder {
  id: string;
  name: string;
  parentId: string | null;
  isSystem: boolean;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  frequency: string;
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  recipients: string[];
  format: string;
  isActive: boolean;
  lastSentAt: string | null;
  nextRunAt: string | null;
}

export interface ReportColumn {
  key: string;
  label: string;
  format?: string;
}

export interface ReportResult {
  data: Record<string, any>[];
  columns: ReportColumn[];
  totalRows: number;
}

export interface DataSourceField {
  key: string;
  label: string;
  type: string;
  groupable: boolean;
  filterable: boolean;
  aggregates: string[];
}

export interface DataSourceDef {
  key: string;
  label: string;
  fields: DataSourceField[];
}

export interface ReportsQuery {
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

// ── API ──

export const reportsApi = {
  // Data Sources (for builder)
  getDataSources: async (): Promise<DataSourceDef[]> => {
    const { data } = await api.get('/reports/data-sources');
    return data;
  },

  // Library (pre-built reports grouped by folder)
  getLibrary: async (): Promise<Record<string, Report[]>> => {
    const { data } = await api.get('/reports/library');
    return data;
  },

  // Folders
  getFolders: async (): Promise<ReportFolder[]> => {
    const { data } = await api.get('/reports/folders');
    return data;
  },

  createFolder: async (name: string, parentId?: string): Promise<ReportFolder> => {
    const { data } = await api.post('/reports/folders', { name, parentId });
    return data;
  },

  deleteFolder: async (id: string) => {
    const { data } = await api.delete(`/reports/folders/${id}`);
    return data;
  },

  // CRUD
  getAll: async (query: ReportsQuery = {}): Promise<{ data: Report[]; meta: any }> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/reports?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Report> => {
    const { data } = await api.get(`/reports/${id}`);
    return data;
  },

  create: async (report: Partial<Report>): Promise<Report> => {
    const { data } = await api.post('/reports', report);
    return data;
  },

  update: async (id: string, updates: Partial<Report>): Promise<Report> => {
    const { data } = await api.put(`/reports/${id}`, updates);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/reports/${id}`);
    return data;
  },

  clone: async (id: string, name?: string): Promise<Report> => {
    const { data } = await api.post(`/reports/${id}/clone`, { name });
    return data;
  },

  // Execute
  execute: async (id: string, filters?: ReportFilter[]): Promise<ReportResult> => {
    const params = filters ? `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
    const { data } = await api.get(`/reports/${id}/execute${params}`);
    return data;
  },

  executePreview: async (config: {
    dataSource: string;
    reportType: string;
    config: ReportConfig;
    runtimeFilters?: ReportFilter[];
  }): Promise<ReportResult> => {
    const { data } = await api.post('/reports/execute', config);
    return data;
  },

  // Export
  exportReport: async (id: string, format: 'csv' | 'xlsx' = 'csv') => {
    const response = await api.post(`/reports/${id}/export`, { format }, {
      responseType: 'blob',
    });
    // Trigger download
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Schedules
  getSchedules: async (reportId: string): Promise<ReportSchedule[]> => {
    const { data } = await api.get(`/reports/${reportId}/schedules`);
    return data;
  },

  upsertSchedule: async (reportId: string, schedule: Partial<ReportSchedule>): Promise<ReportSchedule> => {
    const { data } = await api.post(`/reports/${reportId}/schedule`, schedule);
    return data;
  },

  deleteSchedule: async (reportId: string) => {
    const { data } = await api.delete(`/reports/${reportId}/schedule`);
    return data;
  },
};