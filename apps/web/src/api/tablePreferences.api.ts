// ============================================================
// FILE: apps/web/src/api/tablePreferences.api.ts
// ============================================================
import { api } from './contacts.api'; // reuse the shared axios instance

// ============================================================
// TYPES — mirrors backend TableColumn
// ============================================================

export type ColumnType =
  | 'text' | 'number' | 'date' | 'datetime' | 'badge' | 'avatar'
  | 'boolean' | 'currency' | 'link' | 'tags' | 'custom';

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
  sortKey?: string;
  sortable: boolean;
  defaultVisible: boolean;
  defaultWidth: number;
  frozen?: boolean;
  align?: 'left' | 'center' | 'right';
  isCustomField: boolean;
  badgeColors?: Record<string, string>;
  source: 'system' | 'computed' | 'custom' | 'utility';
}

export interface TablePreferences {
  id?: string;
  module: string;
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  pageSize: number;
  defaultSortColumn: string;
  defaultSortOrder: 'ASC' | 'DESC';
}

// ============================================================
// API
// ============================================================

export const tableApi = {
  // ── Columns (from backend single source of truth) ──
  getColumns: async (module: string): Promise<TableColumn[]> => {
    const { data } = await api.get(`/table-columns/${module}`);
    return data;
  },

  // ── Preferences ──
  getPreferences: async (module: string): Promise<TablePreferences | null> => {
    const { data } = await api.get(`/table-preferences/${module}`);
    return data;
  },

  savePreferences: async (module: string, prefs: Partial<TablePreferences>): Promise<TablePreferences> => {
    const { data } = await api.put(`/table-preferences/${module}`, prefs);
    return data;
  },

  resetPreferences: async (module: string): Promise<void> => {
    await api.delete(`/table-preferences/${module}`);
  },
};