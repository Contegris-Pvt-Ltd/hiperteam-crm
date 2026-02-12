/**
 * usePermissions Hook — Frontend RBAC enforcement
 * File: apps/web/src/hooks/usePermissions.ts
 *
 * Provides permission-checking utilities for React components.
 * Works with the 3-level RBAC system:
 *   Level 1: Module permissions (can user view/edit/delete contacts?)
 *   Level 2: Record scope (can user see all records or just own?)
 *   Level 3: Field permissions (is this field hidden/read-only/editable?)
 *
 * Usage:
 *   const { canView, canEdit, canDelete, getFieldAccess, isAdmin } = usePermissions();
 *   
 *   if (!canView('contacts')) return <NoAccess />;
 *   if (getFieldAccess('contacts', 'salary') === 'hidden') { ... }
 */

import { useAuthStore } from '../stores/auth.store';

// Types matching backend
export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'invite';
export type RecordScope = 'own' | 'team' | 'department' | 'all';
export type FieldAccess = 'hidden' | 'read_only' | 'editable';

export type ModulePermissions = Record<string, Record<string, boolean>>;
export type RecordAccessMap = Record<string, RecordScope>;
export type FieldPermissionsMap = Record<string, Record<string, FieldAccess>>;

/**
 * CRM Modules
 */
export const CRM_MODULES = [
  'contacts', 'accounts', 'leads', 'deals', 'tasks',
  'reports', 'users', 'roles', 'settings', 'admin',
] as const;

export type CrmModule = typeof CRM_MODULES[number];

export function usePermissions() {
  const user = useAuthStore(state => state.user);

  const permissions: ModulePermissions = user?.permissions || {};
  const recordAccess = (user?.recordAccess || {}) as RecordAccessMap;
  const fieldPermissions = (user?.fieldPermissions || {}) as FieldPermissionsMap;
  const role = user?.role || 'user';
  const roleLevel = user?.roleLevel || 0;

  // ==================== MODULE-LEVEL (Level 1) ====================

  /**
   * Check if user has a specific module permission
   */
  const hasPermission = (module: string, action: ModuleAction): boolean => {
    // Wildcard check
    if (permissions['*']?.['*']) return true;
    return permissions[module]?.[action] === true;
  };

  // Shorthand helpers
  const canView = (module: string) => hasPermission(module, 'view');
  const canCreate = (module: string) => hasPermission(module, 'create');
  const canEdit = (module: string) => hasPermission(module, 'edit');
  const canDelete = (module: string) => hasPermission(module, 'delete');
  const canExport = (module: string) => hasPermission(module, 'export');
  const canImport = (module: string) => hasPermission(module, 'import');
  const canInvite = (module: string) => hasPermission(module, 'invite');

  // ==================== RECORD-LEVEL (Level 2) ====================

  /**
   * Get the record scope for a module
   */
  const getRecordScope = (module: string): RecordScope => {
    return recordAccess[module] || 'own';
  };

  /**
   * Check if user can see all records (no filtering needed)
   */
  const canSeeAllRecords = (module: string): boolean => {
    return getRecordScope(module) === 'all';
  };

  // ==================== FIELD-LEVEL (Level 3) ====================

  /**
   * Get the access level for a specific field
   */
  const getFieldAccess = (module: string, field: string): FieldAccess => {
    return fieldPermissions[module]?.[field] || 'editable';
  };

  /**
   * Check if a field is visible (not hidden)
   */
  const isFieldVisible = (module: string, field: string): boolean => {
    return getFieldAccess(module, field) !== 'hidden';
  };

  /**
   * Check if a field is editable
   */
  const isFieldEditable = (module: string, field: string): boolean => {
    return getFieldAccess(module, field) === 'editable';
  };

  // ==================== ROLE HELPERS ====================

  const isAdmin = role === 'admin' || roleLevel >= 100;
  const isManager = role === 'manager' || roleLevel >= 50;

  /**
   * Check if current user's role level is >= a minimum level
   */
  const hasRoleLevel = (minLevel: number): boolean => roleLevel >= minLevel;

  return {
    // Module-level
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    canInvite,

    // Record-level
    getRecordScope,
    canSeeAllRecords,

    // Field-level
    getFieldAccess,
    isFieldVisible,
    isFieldEditable,

    // Role helpers
    isAdmin,
    isManager,
    hasRoleLevel,
    role,
    roleLevel,

    // Raw data
    permissions,
    recordAccess,
    fieldPermissions,
  };
}