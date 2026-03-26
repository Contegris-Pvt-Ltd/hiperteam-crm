---
sidebar_position: 8
title: "RBAC Deep Dive"
description: "Three-level permission system: module permissions, record access scoping, and field-level permissions"
---

# RBAC Deep Dive

IntelliSales CRM implements a **3-level Role-Based Access Control** system that controls what users can do (module permissions), which records they can see (record access), and which fields are visible/editable (field permissions).

## Architecture Overview

```
Level 1: Module Permissions
├── Can user VIEW leads?
├── Can user CREATE leads?
├── Can user EDIT leads?
└── Can user DELETE leads?

Level 2: Record Access Scoping
├── Own records only
├── Team records
├── Department records
├── Reporting line records
└── All records

Level 3: Field Permissions
├── Field "revenue" → editable
├── Field "source" → read_only
└── Field "internal_notes" → hidden
```

## Level 1: Module Permissions

Module permissions define which **actions** a user can perform on a **module**.

### Actions (7)

| Action | Description |
|--------|-------------|
| `view` | Can see the module and list records |
| `create` | Can create new records |
| `edit` | Can modify existing records |
| `delete` | Can soft-delete records |
| `export` | Can export records to CSV/XLSX |
| `import` | Can bulk import records |
| `invite` | Can invite users (users module only) |

### Modules (18)

```typescript
const MODULE_DEFINITIONS = [
  'contacts', 'accounts', 'products',
  'leads', 'opportunities', 'deals',
  'tasks', 'reports', 'users',
  'roles', 'settings', 'admin',
  'targets', 'gamification', 'notifications',
  'projects', 'support', 'customer_success'
];
```

### Permission Matrix Structure

```typescript
interface ModulePermissions {
  [module: string]: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    export: boolean;
    import: boolean;
    invite?: boolean;
  };
}

// Example: Sales Manager
{
  "leads": { "view": true, "create": true, "edit": true, "delete": false, "export": true, "import": true },
  "opportunities": { "view": true, "create": true, "edit": true, "delete": false, "export": true, "import": false },
  "contacts": { "view": true, "create": true, "edit": true, "delete": false, "export": true, "import": false },
  "reports": { "view": true, "create": false, "edit": false, "delete": false, "export": true, "import": false },
  "admin": { "view": false, "create": false, "edit": false, "delete": false, "export": false, "import": false }
}
```

## Level 2: Record Access Scoping

Record access determines **which records** a user can see within a module.

### Scoping Levels

| Level | Description | SQL Filter |
|-------|-------------|-----------|
| `own` | Only records created by or assigned to the user | `created_by = $userId OR assigned_to = $userId` |
| `team` | Records owned by any member of the user's teams | `created_by IN (SELECT user_id FROM team_members WHERE team_id = ANY($teamIds))` |
| `department` | Records owned by anyone in the user's department | `created_by IN (SELECT id FROM users WHERE department_id = $deptId)` |
| `reporting_line` | Records owned by the user or their direct/indirect reports | Recursive CTE on `manager_id` |
| `all` | All records (no additional filtering) | No WHERE clause added |

```typescript
interface RecordAccess {
  [module: string]: 'own' | 'team' | 'department' | 'reporting_line' | 'all';
}

// Example
{
  "leads": "team",
  "opportunities": "department",
  "contacts": "all",
  "tasks": "own"
}
```

### DataAccessService.buildWhereClause()

The `DataAccessService` generates the SQL WHERE clause based on the user's record access level:

```typescript
@Injectable()
export class DataAccessService {
  async buildWhereClause(
    schemaName: string,
    user: JwtPayload,
    module: string,
    alias?: string,
  ): Promise<{ clause: string; params: any[] }> {
    const access = user.recordAccess[module] || 'own';
    const prefix = alias ? `${alias}.` : '';

    switch (access) {
      case 'all':
        return { clause: '', params: [] };

      case 'own':
        return {
          clause: `AND (${prefix}created_by = $1 OR ${prefix}assigned_to = $1)`,
          params: [user.sub],
        };

      case 'team':
        return {
          clause: `AND ${prefix}created_by IN (
            SELECT user_id FROM "${schemaName}".team_members
            WHERE team_id = ANY($1)
          )`,
          params: [user.teamIds],
        };

      case 'department':
        return {
          clause: `AND ${prefix}created_by IN (
            SELECT id FROM "${schemaName}".users
            WHERE department_id = $1
          )`,
          params: [user.departmentId],
        };

      case 'reporting_line':
        // Recursive CTE to get all reports
        return {
          clause: `AND ${prefix}created_by IN (
            WITH RECURSIVE reports AS (
              SELECT id FROM "${schemaName}".users WHERE id = $1
              UNION ALL
              SELECT u.id FROM "${schemaName}".users u
              INNER JOIN reports r ON u.manager_id = r.id
            )
            SELECT id FROM reports
          )`,
          params: [user.sub],
        };
    }
  }
}
```

### Using in Services

```typescript
async findAll(schemaName: string, user: JwtPayload) {
  const { clause, params } = await this.dataAccessService.buildWhereClause(
    schemaName, user, 'leads', 'l'
  );

  return this.dataSource.query(
    `SELECT l.* FROM "${schemaName}".leads l
     WHERE l.deleted_at IS NULL ${clause}
     ORDER BY l.created_at DESC`,
    params,
  );
}
```

## Level 3: Field Permissions

Field permissions control visibility and editability of individual fields per module per role.

### Permission Levels

| Level | Display | Can Edit |
|-------|---------|----------|
| `editable` | Visible | Yes |
| `read_only` | Visible | No (grayed out) |
| `hidden` | Not shown | No |

```typescript
interface FieldPermissions {
  [module: string]: {
    [fieldName: string]: 'hidden' | 'read_only' | 'editable';
  };
}

// Example: Regular user cannot see revenue or edit source
{
  "leads": {
    "revenue": "hidden",
    "source": "read_only",
    "first_name": "editable",
    "email": "editable"
  }
}
```

### Frontend Usage

```typescript
// In a form component
const { fieldPermissions } = usePermissions();
const leadFields = fieldPermissions?.leads || {};

// Render field based on permission
const renderField = (fieldName: string) => {
  const perm = leadFields[fieldName] || 'editable';

  if (perm === 'hidden') return null;

  return (
    <input
      name={fieldName}
      disabled={perm === 'read_only'}
      className={perm === 'read_only' ? 'bg-gray-100 cursor-not-allowed' : ''}
    />
  );
};
```

## JwtPayload — Complete Structure

The JWT embeds all three permission levels:

```typescript
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "tenantSchema": "tenant_acme",
  "tenantSlug": "acme",
  "role": "manager",
  "roleLevel": 50,
  "permissions": {
    "leads": { "view": true, "create": true, "edit": true, "delete": false, "export": true, "import": false },
    "contacts": { "view": true, "create": true, "edit": true, "delete": false, "export": false, "import": false }
  },
  "recordAccess": {
    "leads": "team",
    "contacts": "department",
    "opportunities": "own"
  },
  "fieldPermissions": {
    "leads": { "revenue": "read_only", "source": "editable" }
  },
  "departmentId": "dept-uuid",
  "teamIds": ["team-uuid-1", "team-uuid-2"],
  "managerId": "manager-uuid"
}
```

## Permission Flow

```
1. Admin configures role in Settings → Roles
2. Role saved to "${schema}".roles (permissions JSONB column)
3. User logs in → AuthService builds JwtPayload with full permissions
4. JWT token issued with embedded permissions
5. Frontend receives token → stores in Zustand
6. API request → JwtAuthGuard decodes token → populates req.user
7. PermissionGuard checks @RequirePermission against req.user.permissions
8. Service uses DataAccessService for record scoping
9. Frontend uses fieldPermissions for field visibility
```

## Guards

### @RequirePermission(module, action)

```typescript
@Get()
@RequirePermission('leads', 'view')
async findAll(@Request() req: { user: JwtPayload }) {
  // Only accessible if req.user.permissions.leads.view === true
}
```

### @AdminOnly()

```typescript
@Put('settings')
@AdminOnly()
async updateSettings(@Request() req: { user: JwtPayload }) {
  // Only accessible if req.user.roleLevel >= 100
}
```

## Adding New Modules to RBAC

1. Add the module name to `MODULE_DEFINITIONS` in `apps/api/src/common/types/permissions.types.ts`
2. Add the module to `apps/api/src/modules/roles/roles.service.ts` default permissions
3. Apply `@RequirePermission('new_module', 'action')` to controller methods
4. Update frontend `usePermissions` hook if needed

:::warning
When adding a new module to `MODULE_DEFINITIONS`, existing roles will not automatically have permissions for it. Either:
- Add a migration to set default permissions for existing roles, or
- Handle missing module permissions gracefully (default to `false`)
:::

## Common RBAC Patterns

### Check Permission in Service (Beyond Guards)

```typescript
async deleteRecord(schemaName: string, user: JwtPayload, id: string) {
  // Guard already checks 'delete' permission, but we may want additional logic
  if (user.roleLevel < 50) {
    // Only managers+ can delete records older than 30 days
    const record = await this.findById(schemaName, id);
    const age = Date.now() - new Date(record.createdAt).getTime();
    if (age > 30 * 24 * 60 * 60 * 1000) {
      throw new ForbiddenException('Only managers can delete records older than 30 days');
    }
  }
}
```

### Conditional UI Elements

```typescript
const { canCreate, canDelete, canExport } = usePermissions('leads');

return (
  <div>
    {canCreate && <button>Create Lead</button>}
    {canDelete && <button>Delete Selected</button>}
    {canExport && <button>Export to CSV</button>}
  </div>
);
```
