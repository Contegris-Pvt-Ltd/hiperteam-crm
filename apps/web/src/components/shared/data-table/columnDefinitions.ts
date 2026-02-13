// ============================================================
// FILE: apps/web/src/components/shared/data-table/columnDefinitions.ts
// ============================================================
//
// Re-exports types from the API module.
// All actual column definitions come from the backend via:
//   GET /table-columns/:module
//
// This file exists for backward-compatible imports and any
// frontend-only utility helpers.
// ============================================================

// Re-export types from API
export type { TableColumn, ColumnType, TablePreferences } from '../../../api/tablePreferences.api';