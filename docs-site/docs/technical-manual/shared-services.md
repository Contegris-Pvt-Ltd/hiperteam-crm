---
sidebar_position: 11
title: "Shared Services"
description: "Global shared services available to all modules: audit, activity, notes, documents, data access, and more"
---

# Shared Services

The `SharedModule` is decorated with `@Global()`, making all its exported services available to every module without explicit imports. These services handle cross-cutting concerns like audit logging, activity feeds, document management, and record-level access control.

## Overview

| Service | Purpose |
|---------|---------|
| `AuditService` | Immutable audit trail for all mutations |
| `ActivityService` | Activity feed entries (calls, emails, meetings, etc.) |
| `NotesService` | User notes attached to any entity |
| `DocumentsService` | Document/file management per entity |
| `DataAccessService` | Generates record-level access SQL WHERE clauses |
| `RecordTeamService` | Manages team members assigned to individual records |
| `FieldValidationService` | Validates field values against configured rules |
| `TableColumnsService` | Column definitions available per module |
| `TablePreferencesService` | User-specific column visibility, widths, and sort |
| `ModuleSettingsService` | Key-value JSONB settings per module |

## Using Shared Services

Because `SharedModule` is `@Global()`, simply inject services via constructor — no need to add `SharedModule` to your module's imports:

```typescript
@Injectable()
export class ProposalsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,        // Auto-available
    private readonly activityService: ActivityService,  // Auto-available
    private readonly dataAccessService: DataAccessService, // Auto-available
  ) {}
}
```

## AuditService

Creates immutable audit log entries in `"${schema}".audit_logs`. Called after every create, update, and delete operation.

### Method Signature

```typescript
async log(schemaName: string, entry: {
  entityType: string;    // Table/entity name: 'leads', 'contacts', etc.
  entityId: string;      // Record UUID
  action: string;        // 'create' | 'update' | 'delete'
  changes: object;       // { before: {...}, after: {...} } for updates
  newValues: object;     // Current state of the record
  performedBy: string;   // User ID who performed the action
}): Promise<void>
```

### Usage

```typescript
// After creating a record
await this.auditService.log(schemaName, {
  entityType: 'leads',
  entityId: newLead.id,
  action: 'create',
  changes: {},
  newValues: newLead,
  performedBy: userId,
});

// After updating a record
await this.auditService.log(schemaName, {
  entityType: 'leads',
  entityId: id,
  action: 'update',
  changes: { before: oldValues, after: newValues },
  newValues: updatedRow,
  performedBy: userId,
});

// After soft-deleting a record
await this.auditService.log(schemaName, {
  entityType: 'leads',
  entityId: id,
  action: 'delete',
  changes: {},
  newValues: {},
  performedBy: userId,
});
```

:::warning
Audit logging is **mandatory** for all create, update, and delete operations. Skipping it breaks compliance and traceability requirements.
:::

## ActivityService

Creates activity feed entries tied to any entity. Activities represent business events (phone calls, emails sent, meetings, stage changes).

### Method Signature

```typescript
async create(schemaName: string, activity: {
  entityType: string;      // 'leads', 'contacts', 'opportunities'
  entityId: string;        // Record UUID
  activityType: string;    // 'call', 'email', 'meeting', 'note', 'stage_change', etc.
  title: string;           // Human-readable description
  description?: string;    // Optional detailed description
  performedBy: string;     // User ID
}): Promise<any>
```

### Usage

```typescript
await this.activityService.create(schemaName, {
  entityType: 'leads',
  entityId: leadId,
  activityType: 'stage_change',
  title: `Stage changed from "${oldStage}" to "${newStage}"`,
  performedBy: userId,
});

await this.activityService.create(schemaName, {
  entityType: 'contacts',
  entityId: contactId,
  activityType: 'email',
  title: 'Follow-up email sent',
  description: 'Sent proposal follow-up email',
  performedBy: userId,
});
```

## NotesService

CRUD operations for user notes attached to any entity type.

### Methods

```typescript
// Create a note
async create(
  schemaName: string,
  entityType: string,
  entityId: string,
  content: string,
  userId: string,
): Promise<any>

// Find notes for an entity
async findByEntity(
  schemaName: string,
  entityType: string,
  entityId: string,
): Promise<any[]>
```

### Usage

```typescript
// Create
const note = await this.notesService.create(
  schemaName, 'leads', leadId, 'Client is interested in premium plan', userId,
);

// List
const notes = await this.notesService.findByEntity(schemaName, 'leads', leadId);
```

## DocumentsService

Manages documents (files) associated with any entity.

### Methods

```typescript
// Find documents for an entity
async findByEntity(
  schemaName: string,
  entityType: string,
  entityId: string,
): Promise<any[]>

// Associate a document with an entity
async linkToEntity(
  schemaName: string,
  documentId: string,
  entityType: string,
  entityId: string,
): Promise<void>
```

## DataAccessService

Generates SQL WHERE clauses based on the user's record access level. This is the core of record-level security.

### Method Signature

```typescript
async buildWhereClause(
  schemaName: string,
  user: JwtPayload,
  module: string,
  alias?: string,
): Promise<{ clause: string; params: any[] }>
```

### Usage

```typescript
async findAll(schemaName: string, user: JwtPayload) {
  const { clause, params } = await this.dataAccessService.buildWhereClause(
    schemaName, user, 'leads', 'l',
  );

  const rows = await this.dataSource.query(
    `SELECT l.* FROM "${schemaName}".leads l
     WHERE l.deleted_at IS NULL ${clause}
     ORDER BY l.created_at DESC`,
    params,
  );

  return rows.map(this.formatRow);
}
```

:::tip
The `alias` parameter should match the table alias in your SQL query. If your query uses `FROM leads l`, pass `'l'` as the alias. If no alias is used, omit the parameter.
:::

## RecordTeamService

Manages which users are assigned as team members on individual records (not to be confused with organizational teams).

### Methods

```typescript
// Add a team member to a record
async addMember(
  schemaName: string,
  entityType: string,
  entityId: string,
  userId: string,
  role?: string,
): Promise<any>

// Remove a team member
async removeMember(
  schemaName: string,
  entityType: string,
  entityId: string,
  userId: string,
): Promise<void>

// Get all team members for a record
async getTeamMembers(
  schemaName: string,
  entityType: string,
  entityId: string,
): Promise<any[]>
```

### Usage

```typescript
// Add a team member to a lead
await this.recordTeamService.addMember(
  schemaName, 'leads', leadId, userId, 'sales_rep',
);

// Get team members
const team = await this.recordTeamService.getTeamMembers(
  schemaName, 'leads', leadId,
);
```

## FieldValidationService

Validates field values against rules configured in the admin panel (required fields, regex patterns, min/max values).

### Method Signature

```typescript
async validate(
  schemaName: string,
  module: string,
  data: Record<string, any>,
): Promise<{ valid: boolean; errors: string[] }>
```

### Usage

```typescript
const { valid, errors } = await this.fieldValidationService.validate(
  schemaName, 'leads', body,
);

if (!valid) {
  throw new BadRequestException({ message: 'Validation failed', errors });
}
```

## TableColumnsService

Returns the available columns for a module (used by the data table component).

```typescript
async getColumns(schemaName: string, module: string): Promise<ColumnDefinition[]>
```

## TablePreferencesService

Manages user-specific table preferences (which columns are visible, column widths, sort order).

```typescript
async getPreferences(schemaName: string, userId: string, module: string): Promise<TablePreference>
async savePreferences(schemaName: string, userId: string, module: string, prefs: any): Promise<void>
```

## ModuleSettingsService

Stores and retrieves key-value settings per module using JSONB in the `module_settings` table.

```typescript
async getSetting(schemaName: string, module: string, key: string): Promise<any>
async setSetting(schemaName: string, module: string, key: string, value: any): Promise<void>
async getAllSettings(schemaName: string, module: string): Promise<Record<string, any>>
```

### Usage

```typescript
// Get a setting
const autoAssign = await this.moduleSettingsService.getSetting(
  schemaName, 'leads', 'auto_assign_enabled',
);

// Set a setting
await this.moduleSettingsService.setSetting(
  schemaName, 'leads', 'auto_assign_enabled', true,
);
```

:::note Storage Format
Settings are stored as JSONB with a `setting_key` and `setting_value` column, allowing any JSON-serializable value to be stored without schema changes.
:::
