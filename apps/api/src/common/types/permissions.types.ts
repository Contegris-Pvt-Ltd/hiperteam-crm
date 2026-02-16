// ============================================================
// RBAC Permission Types — Enterprise 3-Level Permission Model
// File: apps/api/src/common/types/permissions.types.ts
// ============================================================

/**
 * LEVEL 1: Module-Level Permissions
 * Controls what actions a role can perform on each module.
 * Stored in: roles.permissions JSONB
 *
 * Example:
 * {
 *   "contacts": { "view": true, "create": true, "edit": true, "delete": false },
 *   "accounts": { "view": true, "create": true, "edit": false, "delete": false }
 * }
 */
export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'invite';

export type ModulePermissions = Record<string, Record<ModuleAction, boolean>>;

/**
 * LEVEL 2: Record-Level Access (Data Scope)
 * Controls which records a user can see/interact with.
 * Stored in: roles.record_access JSONB
 *
 * Scopes:
 *   "own"        → Only records where owner_id = current user
 *   "team"       → Records owned by users in the same team(s)
 *   "department" → Records owned by users in the same department
 *   "all"        → All records (no filtering)
 *
 * Example:
 * {
 *   "contacts": "team",
 *   "accounts": "department",
 *   "deals": "own"
 * }
 */
export type RecordScope = 'own' | 'team' | 'department' | 'all';

export type RecordAccess = Record<string, RecordScope>;

/**
 * LEVEL 3: Field-Level Permissions
 * Controls visibility and editability of individual fields.
 * Stored in: roles.field_permissions JSONB
 *
 * Field states:
 *   "hidden"    → Field not visible at all
 *   "read_only" → Field visible but not editable
 *   "editable"  → Field fully accessible (default if not specified)
 *
 * Example:
 * {
 *   "contacts": {
 *     "salary": "hidden",
 *     "ssn": "hidden",
 *     "email": "read_only"
 *   }
 * }
 *
 * NOTE: Fields not listed are "editable" by default.
 */
export type FieldAccess = 'hidden' | 'read_only' | 'editable';

export type FieldPermissions = Record<string, Record<string, FieldAccess>>;

/**
 * Complete Role Permission Set
 * Combines all 3 levels into a single type for role configuration.
 */
export interface RolePermissionSet {
  permissions: ModulePermissions;     // Level 1: Module actions
  recordAccess: RecordAccess;         // Level 2: Data scope
  fieldPermissions: FieldPermissions; // Level 3: Field visibility
}

/**
 * CRM Modules that support permissions
 */
export const CRM_MODULES = [
  'contacts',
  'accounts',
  'leads',
  'opportunities',
  'deals',
  'tasks',
  'reports',
  'users',
  'roles',
  'settings',
  'admin',
] as const;

export type CrmModule = typeof CRM_MODULES[number];

/**
 * Standard actions per module type
 */
export const DATA_MODULE_ACTIONS: ModuleAction[] = ['view', 'create', 'edit', 'delete', 'export', 'import'];
export const USER_MODULE_ACTIONS: ModuleAction[] = ['view', 'create', 'edit', 'delete', 'invite'];
export const ADMIN_MODULE_ACTIONS: ModuleAction[] = ['view', 'edit'];

/**
 * Get available actions for a module
 */
export function getModuleActions(module: CrmModule): ModuleAction[] {
  switch (module) {
    case 'users':
      return USER_MODULE_ACTIONS;
    case 'roles':
    case 'settings':
    case 'admin':
      return ADMIN_MODULE_ACTIONS;
    default:
      return DATA_MODULE_ACTIONS;
  }
}

/**
 * Modules that support record-level access scoping
 * (only data modules — not users/roles/settings/admin)
 */
export const RECORD_SCOPED_MODULES: CrmModule[] = [
  'contacts',
  'accounts',
  'leads',
  'opportunities',
  'deals',
  'tasks',
  'reports',
];

/**
 * Check if a role has a specific module permission
 */
export function hasPermission(
  permissions: ModulePermissions,
  module: string,
  action: ModuleAction,
): boolean {
  // Wildcard: "*" grants everything
  if (permissions['*']?.['*' as ModuleAction]) return true;
  return permissions[module]?.[action] === true;
}

/**
 * Get the record scope for a module
 */
export function getRecordScope(
  recordAccess: RecordAccess,
  module: string,
): RecordScope {
  return recordAccess[module] || 'own'; // default to own if not specified
}

/**
 * Get field access level
 */
export function getFieldAccess(
  fieldPermissions: FieldPermissions,
  module: string,
  field: string,
): FieldAccess {
  return fieldPermissions[module]?.[field] || 'editable'; // default to editable
}

/**
 * User statuses
 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

/**
 * Invitation statuses
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/**
 * Territory types
 */
export type TerritoryType = 'geographic' | 'industry' | 'account_size' | 'product_line' | 'custom';

/**
 * Team/User-Team roles
 */
export type TeamRole = 'member' | 'lead' | 'observer';

/**
 * Territory assignment roles
 */
export type TerritoryRole = 'owner' | 'member';