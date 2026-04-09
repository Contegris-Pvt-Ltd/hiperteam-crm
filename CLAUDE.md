# Intellicon CRM — Claude Code Context

> Place this file at the **root** of the monorepo. Claude Code reads it automatically every session.

---

## 1. Project Overview

**Intellicon CRM** is a multi-tenant SaaS CRM platform — a full Business & People Operating System
covering the complete lifecycle: Lead → Opportunity → Deal → Project → Support → Customer Success.

**Stack:**
- Backend: NestJS + TypeORM + PostgreSQL (schema-per-tenant)
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Queue: Bull + Redis
- Monorepo: `apps/api` (backend) + `apps/web` (frontend)

---

## 2. Exact Monorepo Structure

```
/
├── apps/
│   ├── api/src/
│   │   ├── app.module.ts                    ← register ALL new modules here
│   │   ├── config/configuration.ts
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── permissions.guard.ts     ← @RequirePermission, @AdminOnly
│   │   │   ├── services/
│   │   │   │   └── record-scope.service.ts
│   │   │   └── types/
│   │   │       └── permissions.types.ts     ← RBAC types + MODULE_DEFINITIONS
│   │   ├── database/
│   │   │   ├── entities/tenant.entity.ts    ← only global (non-tenant) entity
│   │   │   ├── migrations/                  ← reference SQL files only
│   │   │   ├── tenant-schema.service.ts
│   │   │   └── migration-runner.service.ts
│   │   ├── scripts/
│   │   │   └── run-tenant-migrations.ts     ← THE migration source of truth
│   │   └── modules/
│   │       ├── shared/                      ← @Global() — auto-available everywhere
│   │       │   ├── audit.service.ts
│   │       │   ├── activity.service.ts
│   │       │   ├── documents.service.ts
│   │       │   ├── notes.service.ts
│   │       │   ├── data-access.service.ts
│   │       │   ├── record-team.service.ts
│   │       │   ├── field-validation.service.ts
│   │       │   ├── table-columns.service.ts
│   │       │   ├── table-preferences.service.ts
│   │       │   ├── table-preferences.controller.ts
│   │       │   └── module-settings.controller.ts
│   │       ├── auth/                        ← JWT, login, refresh, strategies
│   │       ├── tenant/                      ← tenant CRUD, schema creation
│   │       ├── email/                       ← email sending service
│   │       ├── upload/                      ← file upload (avatar + documents)
│   │       ├── users/                       ← user management + invitations
│   │       ├── roles/                       ← RBAC role management + MODULE_DEFINITIONS
│   │       ├── departments/                 ← department management
│   │       ├── teams/                       ← team management
│   │       ├── contacts/                    ← contacts module
│   │       ├── accounts/                    ← accounts module (B2B/B2C)
│   │       ├── products/                    ← products + price books
│   │       ├── admin/                       ← custom fields, page layouts, field validation,
│   │       │                                   custom tabs, custom groups, page designer
│   │       ├── leads/                       ← leads + pipeline + settings + scoring + SLA
│   │       │   ├── leads.service.ts
│   │       │   ├── leads.controller.ts
│   │       │   ├── lead-settings.service.ts
│   │       │   ├── lead-settings.controller.ts
│   │       │   ├── lead-scoring.service.ts
│   │       │   └── sla.service.ts
│   │       ├── opportunities/               ← opportunities + pipeline + settings
│   │       │   ├── opportunities.service.ts
│   │       │   ├── opportunities.controller.ts
│   │       │   ├── opportunity-settings.service.ts
│   │       │   └── opportunity-settings.controller.ts
│   │       ├── tasks/                       ← tasks + subtasks + types/statuses/priorities
│   │       ├── notifications/               ← in-app notifications + WebSocket
│   │       ├── calendar-sync/               ← Google Calendar 2-way sync + cron
│   │       ├── dashboard/                   ← dashboard widgets + stats
│   │       ├── targets/                     ← targets, assignments, gamification, badges
│   │       │   ├── targets.service.ts
│   │       │   ├── targets.controller.ts
│   │       │   └── gamification.service.ts
│   │       ├── reports/                     ← dynamic report builder + engine
│   │       └── lead-import/                 ← CSV/XLSX bulk import (Bull queue)
│   │           ├── lead-import.service.ts
│   │           ├── lead-import.controller.ts
│   │           └── lead-import.processor.ts ← Bull queue worker
│   │
│   └── web/src/
│       ├── App.tsx                          ← ALL routes defined here
│       ├── lib/api.ts                       ← axios instance (duplicate — use contacts.api.ts)
│       ├── stores/
│       │   ├── auth.store.ts
│       │   └── sidebar.store.ts
│       ├── hooks/
│       │   ├── usePermissions.ts
│       │   └── useModuleLayout.ts
│       ├── utils/
│       │   └── field-validation.ts
│       ├── config/
│       │   └── field-registry.ts
│       ├── components/
│       │   ├── layout/Sidebar.tsx
│       │   └── shared/
│       │       ├── DocumentsPanel.tsx
│       │       ├── AvatarUpload.tsx
│       │       ├── CustomFieldRenderer.tsx
│       │       ├── SearchableSelect.tsx
│       │       ├── data-table/              ← DataTable, useTableColumns, useTablePreferences
│       │       └── ...
│       ├── api/                             ← one file per module
│       │   ├── contacts.api.ts              ← also exports shared `api` axios instance
│       │   ├── accounts.api.ts
│       │   ├── users.api.ts
│       │   ├── roles.api.ts
│       │   ├── products.api.ts
│       │   ├── leads.api.ts                 ← exports leadsApi + leadSettingsApi
│       │   ├── opportunities.api.ts         ← exports opportunitiesApi + opportunitySettingsApi
│       │   ├── tasks.api.ts
│       │   ├── targets.api.ts               ← exports targetsApi + gamificationApi
│       │   ├── reports.api.ts
│       │   ├── admin.api.ts
│       │   ├── module-settings.api.ts       ← field validation config per module
│       │   ├── page-layout.api.ts           ← page designer layouts
│       │   ├── tablePreferences.api.ts      ← table column visibility + widths
│       │   ├── calendar-sync.api.ts
│       │   ├── lead-import.api.ts           ← CSV/XLSX import + job tracking
│       │   ├── upload.api.ts                ← avatar + document upload
│       │   ├── teams.api.ts
│       │   ├── departments.api.ts
│       │   └── notifications.api.ts
│       └── features/
│           ├── admin/                       ← all /admin/* settings pages
│           │   ├── AdminLayout.tsx          ← admin nav sidebar
│           │   ├── CustomFieldsPage.tsx
│           │   ├── FieldValidationPage.tsx
│           │   ├── LeadSettingsPage.tsx
│           │   ├── OpportunitySettingsPage.tsx
│           │   ├── TaskSettingsPage.tsx
│           │   ├── NotificationPreferencesPage.tsx
│           │   ├── TargetsSettingsPage.tsx
│           │   ├── BatchJobsPage.tsx
│           │   ├── PageDesignerPage.tsx
│           │   └── AuditLogViewer.tsx
│           ├── contacts/
│           ├── accounts/
│           ├── leads/
│           ├── opportunities/
│           ├── tasks/
│           ├── products/
│           ├── dashboard/
│           ├── reports/
│           ├── users/
│           ├── teams/
│           ├── departments/
│           ├── roles/
│           └── notifications/
```

---

## 3. Multi-Tenant Architecture — CRITICAL

Every tenant has its own PostgreSQL schema (e.g. `tenant_acme`, `tenant_corp`).

**Rules:**
- ALL queries use `"${schemaName}".table_name` — never `public.`
- `schemaName` always comes from `req.user.tenantSchema` (JWT payload)
- NEVER hardcode a schema name
- NEVER use TypeORM entities for tenant data — use raw SQL via `this.dataSource.query()`

```typescript
// Controller:
async doSomething(@Request() req: { user: JwtPayload }) {
  return this.myService.findAll(req.user.tenantSchema, req.user.sub);
}

// Service:
async findAll(schemaName: string, userId: string) {
  return this.dataSource.query(
    `SELECT * FROM "${schemaName}".my_table WHERE deleted_at IS NULL`,
  );
}
```

---

## 4. Database Migrations — THE ONLY WAY

**Single source of truth:** `apps/api/src/scripts/run-tenant-migrations.ts`

All tenant schema changes go here as named migrations in the `migrations` array.
Append to the **END** of the array. Never edit existing migrations.

```typescript
{
  name: '025_your_migration_name',   // unique, sequential
  sql: `
    ALTER TABLE "${schema}".pipeline_stages
      ADD COLUMN IF NOT EXISTS my_column VARCHAR(20) DEFAULT 'value';

    CREATE TABLE IF NOT EXISTS "${schema}".my_new_table (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_my_table_name ON "${schema}".my_new_table(name);
  `
}
```

**Rules:**
- Variable is `${schema}` (not `${schemaName}`) — matches the script's loop variable
- Always `IF NOT EXISTS` / `IF EXISTS` — migrations must be idempotent
- Always index FK columns and commonly filtered columns
- For `ADD CONSTRAINT`, use `DO $$ BEGIN IF NOT EXISTS ... END $$` block
- Run: `npx ts-node apps/api/src/scripts/run-tenant-migrations.ts`

---

## 5. Backend Module Pattern

```
modules/my-module/
├── my-module.module.ts
├── my-module.service.ts
└── my-module.controller.ts
```

### Module:
```typescript
import { Module } from '@nestjs/common';

@Module({
  controllers: [MyModuleController],
  providers: [MyModuleService],
  exports: [MyModuleService],
})
export class MyModule {}
```

Then add to `app.module.ts` imports array.

### Controller:
```typescript
@ApiTags('My Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('my-module')
export class MyModuleController {
  @Get()
  @RequirePermission('my_module', 'view')
  async findAll(@Request() req: { user: JwtPayload }) {
    return this.myService.findAll(req.user.tenantSchema, req.user.sub);
  }

  @Post()
  @RequirePermission('my_module', 'create')
  async create(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.myService.create(req.user.tenantSchema, req.user.sub, body);
  }

  @Put('settings')   // IMPORTANT: named routes BEFORE :id routes
  @AdminOnly()
  async updateSettings(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.myService.updateSettings(req.user.tenantSchema, body);
  }
}
```

### Service:
```typescript
@Injectable()
export class MyModuleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async create(schemaName: string, userId: string, data: any) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".my_table (name, created_by)
       VALUES ($1, $2) RETURNING *`,
      [data.name, userId],
    );
    await this.auditService.log(schemaName, {
      entityType: 'my_table', entityId: row.id,
      action: 'create', changes: {}, newValues: row, performedBy: userId,
    });
    return this.formatRow(row);
  }

  private formatRow(r: any) {
    return { id: r.id, name: r.name, createdAt: r.created_at };
  }
}
```

---

## 6. RBAC

```typescript
interface JwtPayload {
  sub: string;           // user ID
  tenantSchema: string;
  role: string;          // 'admin' | 'manager' | 'user' | custom
  roleLevel: number;     // 100 = admin
  permissions: ModulePermissions;
  recordAccess: RecordAccess;
  fieldPermissions: FieldPermissions;
  departmentId?: string;
  teamIds?: string[];
  managerId?: string;
}
```

**Guards:**
```typescript
@RequirePermission('leads', 'view')   // view | create | edit | delete | export | import
@AdminOnly()                          // roleLevel >= 100
```

**Existing RBAC module names** (from `roles.service.ts` MODULE_DEFINITIONS):
`contacts`, `accounts`, `products`, `leads`, `opportunities`, `deals`, `tasks`,
`reports`, `users`, `roles`, `settings`, `admin`, `targets`, `gamification`, `notifications`

---

## 7. Shared Services (Global — Auto-injected)

| Service | Key Method |
|---|---|
| `AuditService` | `log(schema, { entityType, entityId, action, changes, newValues, performedBy })` |
| `ActivityService` | `create(schema, { entityType, entityId, activityType, title, performedBy })` |
| `NotesService` | `create(schema, entityType, entityId, content, userId)` |
| `DocumentsService` | `findByEntity(schema, entityType, entityId)` |
| `DataAccessService` | `buildWhereClause(schema, user, module, alias)` |
| `RecordTeamService` | `getTeamMembers(schema, entityType, entityId)` |

---

## 8. Pipeline & Stage System (Shared)

Pipelines shared between modules via `module` column.

**Tables:** `pipelines`, `pipeline_stages`, `pipeline_stage_fields`

**Module values:** `'leads'` · `'opportunities'` · `'deals'` (Sprint 5) · `'projects'` (Sprint 8)

**Existing endpoints — reuse, never duplicate:**
- `GET  /lead-settings/pipelines`
- `GET  /lead-settings/stages?module=opportunities&pipelineId=xxx`
- `GET  /lead-settings/stages/:stageId/fields`
- `PUT  /lead-settings/stages/:id`
- `POST /lead-settings/stages`

**Frontend:** `opportunitySettingsApi.getStages()` calls `/lead-settings/stages?module=opportunities`

---

## 9. Frontend Patterns

### Always import axios from `contacts.api.ts`:
```typescript
import { api } from '../api/contacts.api';   // canonical shared instance
```

### API file pattern:
```typescript
import { api } from './contacts.api';

export const myModuleApi = {
  getAll: async (params?: any) => {
    const { data } = await api.get('/my-module', { params });
    return data;
  },
  getById: async (id: string) => {
    const { data } = await api.get(`/my-module/${id}`);
    return data;
  },
  create: async (body: any) => {
    const { data } = await api.post('/my-module', body);
    return data;
  },
  update: async (id: string, body: any) => {
    const { data } = await api.put(`/my-module/${id}`, body);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/my-module/${id}`);
  },
};
```

### Route registration in `App.tsx`:
```typescript
// Inside MainLayout routes:
<Route path="my-module" element={<MyModulePage />} />
<Route path="my-module/:id" element={<MyModuleDetailPage />} />

// Inside /admin Route:
<Route path="my-module-settings" element={<MyModuleSettingsPage />} />
```

### Admin sidebar in `AdminLayout.tsx`:
```typescript
{ label: 'My Module Settings', path: '/admin/my-module-settings', icon: SomeIcon, description: '...' }
```

### Design conventions:
- Tailwind only — no inline styles
- Always `dark:` variants alongside light variants
- Primary: `purple-600` · Success: `green` · Danger: `red` · Warning: `amber`
- Card: `bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700`
- Button: `bg-purple-600 hover:bg-purple-700 text-white rounded-xl`
- Always show loading: `<Loader2 className="animate-spin" />`
- Always show error state with retry option

---

## 10. Key API Exports Reference

| File | Exports |
|---|---|
| `leads.api.ts` | `leadsApi`, `leadSettingsApi` |
| `opportunities.api.ts` | `opportunitiesApi`, `opportunitySettingsApi` |
| `targets.api.ts` | `targetsApi`, `gamificationApi` |
| `admin.api.ts` | `adminApi` |
| `users.api.ts` | `usersApi` |
| `teams.api.ts` | `teamsApi` |
| `departments.api.ts` | `departmentsApi` |
| `roles.api.ts` | `rolesApi` |
| `products.api.ts` | `productsApi` |
| `tasks.api.ts` | `tasksApi` |
| `reports.api.ts` | `reportsApi` |
| `lead-import.api.ts` | `leadImportApi` |
| `calendar-sync.api.ts` | `calendarSyncApi` |
| `upload.api.ts` | `uploadApi` |
| `page-layout.api.ts` | `pageLayoutApi` |
| `tablePreferences.api.ts` | `tableApi` |
| `module-settings.api.ts` | `moduleSettingsApi` |

---

## 11. Existing Admin Settings Pages

| Path | Description |
|---|---|
| `/admin/custom-fields` | Custom fields per module |
| `/admin/field-validation` | Required field rules |
| `/admin/lead-settings` | Stages, pipelines, scoring, SLA, routing |
| `/admin/opportunity-settings` | Stages, priorities, close reasons, types |
| `/admin/task-settings` | Task types, statuses, priorities |
| `/admin/page-designer` | Page & form layout builder |
| `/admin/notification-settings` | Channels, templates, preferences |
| `/admin/targets` | Targets, badges, gamification |
| `/admin/batch-jobs` | Import/export job history |

**New pages — Sprints 1–11:**

| Path | Sprint |
|---|---|
| `/admin/stage-ownership` | 1 |
| `/admin/approval-rules` | 3 |
| `/admin/proposal-settings` | 4 |
| `/admin/deal-settings` | 5 |
| `/admin/invoice-settings` | 6 |
| `/admin/project-settings` | 7 |
| `/admin/support-settings` | 10 |
| `/admin/cs-settings` | 11 |

---

## 12. Error Codes

| Range | Category |
|---|---|
| ICN-1000–1099 | Auth |
| ICN-1100–1199 | Users/Roles |
| ICN-1200–1299 | Leads |
| ICN-1300–1399 | Opportunities |
| ICN-1400–1499 | Deals |
| ICN-1500–1599 | Projects |
| ICN-1600–1699 | Support |
| ICN-9000–9099 | Generic/Validation |

---

## 13. Sprint Plan

| Sprint | Module | Status |
|---|---|---|
| **1** | **Stage Ownership** | **→ IN PROGRESS** |
| 2 | Proposals | Planned |
| 3 | Approval Engine | Planned |
| 4 | Document Templates + PDF | Planned |
| 5 | Deals Module | Planned |
| 6 | Contracts + Invoices + Payments | Planned |
| 7 | Project Templates (Admin) | Planned |
| 8 | Projects + Phases | Planned |
| 9 | Task Dependencies + Gantt + Time Tracking | Planned |
| 10 | Support Tickets | Planned |
| 11 | Customer Success | Planned |
| 12 | Customer 360° View | Planned |

---

## 14. Sprint 1 — Stage Ownership (In Progress)

### Migration `025_stage_ownership` ✅ DONE

Tables modified:
- `pipeline_stages` — new columns: `stage_owner_type`, `stage_owner_user_id`,
  `stage_owner_team_id`, `stage_owner_role_id`, `field_visibility`
- `record_stage_assignments` — new table (indexes: `idx_rsa_entity`, `idx_rsa_stage`)

### Remaining sessions:

**Session 2 — `lead-settings.service.ts`** (add only, do not modify existing):
- `getStageOwnership(schema, stageId)`
- `updateStageOwnership(schema, stageId, userId, dto: UpdateStageOwnershipDto)`
- `getFieldVisibility(schema, stageId)`
- `updateFieldVisibility(schema, stageId, userId, fieldVisibility)`

**Session 3 — `lead-settings.controller.ts`** (add only):
- `GET  /lead-settings/stage-ownership/:stageId`
- `PUT  /lead-settings/stage-ownership/:stageId`
- `GET  /lead-settings/field-visibility/:stageId`
- `PUT  /lead-settings/field-visibility/:stageId`

**Session 4 — `apps/web/src/api/leads.api.ts`** (add to `leadSettingsApi`):
- `getStageOwnership(stageId)`
- `updateStageOwnership(stageId, dto)`
- `getFieldVisibility(stageId)`
- `updateFieldVisibility(stageId, fieldVisibility)`

**Session 5 — Settings UI**:
- Add "Stage Ownership" tab to `LeadSettingsPage.tsx`
- Add "Stage Ownership" tab to `OpportunitySettingsPage.tsx`

**Session 6 — Assignment modal + stage change hook**:
- New: `apps/web/src/components/shared/StageAssignmentModal.tsx`
- Modify: `leads.service.ts` `changeStage()` to insert into `record_stage_assignments`

**Files to read before any session:**
```
@apps/api/src/modules/leads/lead-settings.service.ts
@apps/api/src/modules/leads/lead-settings.controller.ts
@apps/web/src/features/admin/LeadSettingsPage.tsx
@apps/web/src/features/admin/OpportunitySettingsPage.tsx
@apps/web/src/api/leads.api.ts
```

---

## 15. Key Rules — NEVER BREAK

1. **Parameterized queries only** — `$1, $2` — never string-concatenate SQL
2. **`deleted_at IS NULL`** on all SELECTs for soft-deletable tables
3. **`auditService.log()`** after every create/update/delete
4. **Never remove existing methods or endpoints** — only add new ones
5. **Named routes before `:id` routes** in controllers (NestJS matching order)
6. **Pagination:** `{ data: [], meta: { total, page, limit, totalPages } }`
7. **camelCase** in TypeScript · **snake_case** in PostgreSQL
8. **`private formatRow(r)`** in every service — maps DB → camelCase
9. **Soft deletes:** `SET deleted_at = NOW()` — never `DELETE FROM`
10. **Module settings:** JSONB in `module_settings` table with `setting_key`/`setting_value`

---

## 16. Running the Project

```bash
cd apps/api && npm run start:dev                              # port 3000
cd apps/web && npm run dev                                    # port 5173
cd apps/api && npx ts-node src/scripts/run-tenant-migrations.ts
```

---

## 17. Session Workflow

```
/plan     → review what Claude will do before execution
/rewind   → undo last change (or Esc Esc)
```

**One session = one layer. Never mix layers:**
- ❌ Migration + service + frontend all in one session
- ✅ Session 1: DB only · Session 2: service · Session 3: controller · Session 4: API · Session 5: UI

---

## 18. Workflow Engine

### Trigger System
Workflows fire on entity events. The `trigger()` method matches `trigger_module` + `trigger_type` + evaluates `trigger_filters` (condition group).

**Trigger modules:** `leads` · `contacts` · `accounts` · `opportunities` · `tasks` · `projects`

**Payload structure:**
```typescript
{
  triggerModule: string,
  triggerType: string,     // e.g. 'lead_created', 'lead_stage_changed'
  entityId: string,
  entity: Record<string, any>,  // raw DB row (snake_case)
  customFields: Record<string, any>,
  previousValues: Record<string, any>,
  meta: Record<string, any>,
}
```

### Action Types (15)

| Action | Config Keys | Returns |
|--------|------------|---------|
| `assign_owner` | `algorithm`, `pool[]`, `weights[]` | `{ assignedUserId, payloadMerge: { owner_id } }` |
| `create_task` | `title`, `description`, `assignedTo` (owner/trigger_user/specific), `dueOffsetDays`, `startOffsetDays`, `estimatedMinutes`, `tags` | `{ created, title, assignedTo }` |
| `update_field` | `entity`, `fieldKey`, `value` | `{ updated: { field: value } }` |
| `add_tag` | `tag` | `{ tag }` |
| `send_notification` | `to` (owner/specificUserId), `title`, `message` | `{ sentTo }` |
| `send_email` | `to` (record_email/owner_email/custom), `subject`, `body`, `cc`, `bcc` | `{ sent, to }` |
| `send_whatsapp` | `to` (record_phone/owner_phone/custom), `message` | `{ sent, to }` |
| `send_sms` | `to` (record_phone/owner_phone/custom), `message` | `{ sent, to }` |
| `webhook` | `url`, `method`, `bodyType` (json/form-data/raw/none), `headers[]`, `params[]`, `verifySsl`, `timeoutSeconds` | `{ statusCode, ok, responseBody }` |
| `wait` | `hours`, `minutes` (sync ≤5s only) | `{ waited }` |
| `branch` | `condition` (ConditionGroup) | `{ branch: 'yes'\|'no', conditionMet }` |
| `create_opportunity` | `name` | `{ created }` |
| `create_project` | `name`, `description`, `templateId` | `{ created, projectId }` |
| `add_to_email_list` | `listId`, `listName`, `contactSelector` | `{ added, total }` |
| `remove_from_email_list` | `listId`, `contactSelector` | `{ removed, total }` |

### Template Interpolation
`{{trigger.fieldName}}` — replaced from `payload.entity` (auto camelCase → snake_case).

### Payload Merge
Actions return `payloadMerge` to update the in-memory entity for downstream actions. Example: `assign_owner` sets `owner_id`, then `create_task` with `assignedTo: 'owner'` reads it.

### Condition Engine
Nested groups with `match: 'all' | 'any'`:
```
Operators: equals, not_equals, contains, not_contains, starts_with,
           is_empty, is_not_empty, greater_than, less_than,
           greater_or_equal, less_or_equal, in, not_in,
           changed_to, changed_from, any_change
```

### Routing Algorithms (assign_owner)

| Algorithm | Logic | State |
|-----------|-------|-------|
| `round_robin` | Cycles through pool, picks next after last assigned | `workflow_assignment_log` table |
| `weighted` | Random selection weighted by `weights[]` config | Stateless |
| `load_based` | User with fewest open records in module table | Stateless |
| `territory` | Matches entity `country`/`city` to user `territory_tags` | Stateless |
| `skill_match` | Matches entity `industry` to user `skill_tags` | Stateless |
| `sticky` | Same owner as linked account/contact | Stateless |

**Tables:**
- `workflows` — id, name, trigger_module, trigger_type, trigger_filters, is_active, version
- `workflow_actions` — workflow_id, action_type, config (JSONB), sort_order, parent_action_id, branch
- `workflow_runs` — workflow_id, trigger_entity_id, trigger_payload, status, error, started_at, finished_at
- `workflow_run_steps` — run_id, action_id, action_type, status, result (JSONB), error
- `workflow_assignment_log` — action_id, user_id, entity_type, entity_id, assigned_at

**Endpoints:**
- `GET/POST     /workflows` · `GET/PUT/DELETE /workflows/:id`
- `PATCH        /workflows/:id/toggle`
- `GET          /workflows/:id/runs` · `GET /workflows/runs/:runId`

---

## 19. Forms & Engagement

### Form Types
- `standard` — regular web form
- `meeting_booking` — scheduling/booking form
- `landing_page` — with SEO/metadata config

### Submit Actions (chained, context-passing)
Each action passes `context` with created entity IDs to the next:

| Action | Creates | Workflow Trigger |
|--------|---------|-----------------|
| `create_lead` | Lead with full fields + defaults (pipeline, stage, priority, qualification framework) | `lead_created` |
| `create_contact` | Contact, links to `context.accountId` | `contact_created` |
| `create_account` | Account with type `'prospect'` | `account_created` |
| `webhook` | HTTP POST to configured URL | — |
| `send_email` | Email to submitter with `{{fieldName}}` interpolation | — |

### Phone Formatting
`formatPhoneE164(raw, defaultCountry?)` — strips separators, tries: raw parse → country parse → `+` prefix for international. Falls back to tenant `base_country` from `company_settings`.

### Field Mapping
CRM fields mapped via `fieldMapping` config. Custom fields use `cf_` prefix (e.g., `cf_lead_score` → `custom_fields.lead_score`).

### reCAPTCHA
Optional v3 verification with score threshold 0.5. Requires `RECAPTCHA_SECRET_KEY` env var.

**Tables:**
- `forms` — name, type, status, token, fields (JSONB), submit_actions (JSONB), settings, branding, submission_count
- `form_submissions` — form_id, data, metadata, action_results (JSONB), ip_address, user_agent

**Public endpoints (no auth):**
- `GET  /forms/public/:tenantSlug/:token` · `POST /forms/public/:tenantSlug/:token/submit`

---

## 20. Lead Scoring

### Rule-Based Engine
Templates with ordered rules. Each rule contributes `score_delta` if matched.

**Operators:** `equals` · `not_equals` · `contains` · `contains_any` · `in` · `is_empty` · `is_not_empty` · `greater_than` · `less_than` · `older_than` (date decay, N days)

**Field resolution:** `qualification.xxx` (JSONB) · `custom.xxx` (JSONB) · direct lead fields (auto camelToSnake)

**Score:** clamped to `[0, max_score]`, stored with breakdown JSONB for debugging.

**`rescoreAll(schemaName)`** — bulk rescore all active leads when rules change.

**Tables:**
- `lead_scoring_templates` — max_score, is_active, is_default
- `lead_scoring_rules` — template_id, category, field_key, operator, value, score_delta, sort_order

---

## 21. SLA (Service Level Agreements)

### Configuration (`lead_settings` key `'sla'`)
```
enabled, firstContactHours, workingHoursStart/End ("09:00"/"18:00"),
workingDays ([1,2,3,4,5] = Mon-Fri), timezone ("UTC"),
escalationEnabled, escalationHours,
breachNotifyOwner, breachNotifyManager, escalationNotifyAdmin
```

### Working Hours Calculation
`calculateDueDate()` — advances through business hours only, skipping non-working days. Timezone-aware via `Intl.DateTimeFormat`. Safety: max 365*24 iterations.

### SLA Lifecycle
1. **On lead creation:** `setSlaDueDate()` → sets `sla_first_contact_due_at`
2. **On first activity:** `markSlaMet()` → sets `sla_first_contact_met_at`, calculates response minutes
3. **Scheduled check:** `checkBreaches()` → marks breached/escalated leads, returns notification targets

### Status Values
`no_sla` · `on_track` · `at_risk` (≤25% time remaining) · `breached` · `escalated` · `met` · `met_late`

**Lead columns:** `sla_first_contact_due_at`, `sla_first_contact_met_at`, `sla_breached`, `sla_breached_at`, `sla_escalated`, `sla_escalated_at`

---

## 22. Notifications

### WebSocket Gateway
- **Namespace:** `/notifications` · **Transports:** websocket + polling
- **Auth:** JWT from `handshake.auth.token` or `Authorization` header
- **Rooms:** `user:{userId}`

**Server → Client events:**
- `notification` — `{ id, type, title, body, icon, actionUrl, entityType, entityId }`
- `unread_count` — `{ count }`

**Client → Server events:**
- `mark_read` · `mark_all_read` · `dismiss`

### Channels
- `email.channel.ts` — Nodemailer (system_default, custom_smtp, sendgrid, aws_ses)
- `sms-whatsapp.channel.ts` — Twilio (SMS + WhatsApp)
- `browser-push.channel.ts` — Web Push API
- `chat.channel.ts` — Slack / Mattermost webhooks

### Templates & Preferences
- **Templates:** Handlebars-based, per `eventType`, cached in memory
- **Preferences:** Per user × event type, toggles per channel (inApp, email, browserPush, sms, whatsapp)
- **Event types:** `task_assigned`, `task_due_reminder`, `task_overdue`, `task_completed`, `meeting_reminder`, `meeting_booked`, `meeting_cancelled`, `meeting_rescheduled`, `lead_assigned`, `mention`

---

## 23. Projects

### Core Structure
Projects → Phases → Tasks (with subtasks via `parent_task_id`)

**Health:** `on_track` · `at_risk` · `off_track`
**Dependencies:** `finish_to_start` · `start_to_start`

### Templates
Templates define reusable phase/task structures. `saveTemplateStructure()` saves nested hierarchy. `createFromOpportunity()` creates project from won opportunity with template.

### Features
- Task dependencies with type
- Time tracking (`project_time_entries`)
- Task comments with `@mentions`
- Project milestones
- Client portal (public token access)
- Kanban + Gantt views
- Project/task approvals (via shared Approval Engine)

**Key endpoints:**
- `GET/POST /projects` · `GET/PUT/DELETE /projects/:id`
- `GET /projects/:id/kanban` · `GET /projects/:id/gantt`
- `POST /projects/:id/tasks` · `PUT/DELETE /projects/:id/tasks/:taskId`
- `POST /projects/:id/tasks/:taskId/time` · `GET /projects/:id/time-report`
- `POST /projects/:id/portal-token` · `GET /portal/:tenantSlug/:token` (public)
- `POST /projects/from-opportunity`

**Tables:** `projects`, `project_statuses`, `project_phases`, `project_tasks`, `project_task_statuses`, `project_templates`, `project_template_phases`, `project_template_tasks`, `project_task_dependencies`, `project_task_comments`, `project_time_entries`, `project_milestones`, `project_members`, `project_portal_tokens`

---

## 24. Proposals

### Lifecycle
`draft` → `published` → `sent` → `viewed` → `accepted` / `declined` / `expired`

### Features
- Line items with products, quantity, pricing, discounts
- PDF generation
- View tracking (`proposal_views` — IP, user agent, timestamp)
- Public accept/decline by token
- Approval gate: if discount exceeds rule threshold, requires approval before publish

**Endpoints:**
- `GET/POST /opportunities/:oppId/proposals` · `GET/PUT/DELETE .../proposals/:id`
- `POST .../proposals/:id/publish` · `POST .../proposals/:id/send-email`
- `GET /proposals/public/:tenantId/:token` · `POST .../accept` · `POST .../decline` (public)

---

## 25. Contracts

### Lifecycle
`draft` → `sent_for_signing` → `partially_signed` → `fully_signed` → `active` / `terminated` / `expired`

### Signing Workflow
Sequential signing via `contract_signatories` (sign_order). Supports internal signing (token-based) and DocuSign integration.

- `sendForSigning()` — auto-detects DocuSign or internal flow
- `sign(token, signatureData, ipAddress)` — marks signatory, auto-advances to next
- `decline(token, reason)` — terminates entire contract
- Document upload (PDF/DOCX)

**Number format:** `CNT-XXXXXX` (auto-sequence)

**Endpoints:**
- Under `/opportunities/:oppId/contracts/...`
- Public: `GET/POST /contracts/public/:token` (view, sign, decline)
- DocuSign webhook: `POST /contracts/public/docusign/webhook`

---

## 26. Invoices

### Lifecycle
`draft` → `sent` → `partially_paid` / `paid` / `overdue` / `cancelled` / `void`

### Features
- Line items with quantity, unit price, discount (% or fixed), tax
- Payment tracking (`invoice_payments`)
- Recurring invoices (interval: monthly/quarterly/yearly, auto next date)
- PDF generation (pdfkit)
- Email delivery
- Xero accounting integration (`pushToXero()`)
- Auto mark overdue (scheduled job)

**Endpoints:**
- `GET/POST /invoices` · `GET/PUT/DELETE /invoices/:id`
- `POST /invoices/:id/send` · `POST /invoices/:id/cancel`
- `GET /invoices/:id/pdf` · `POST /invoices/:id/send-email`
- `POST /invoices/:id/payments` · `GET /invoices/:id/payments`
- `POST /invoices/:id/push-xero`

---

## 27. Approval Engine (Shared)

Multi-step approval workflow used by proposals, projects, and contracts.

### Rule Structure
`approval_rules` → `approval_rule_steps` (ordered steps with approver type: `user` or `role`)

### Request Flow
1. `createRequest(entityType, entityId, triggerEvent)` — creates request + steps from rule
2. First approver notified
3. `approve(requestId, userId, comment)` — advances to next step or marks fully approved
4. `reject(requestId, userId, comment)` — marks entire request rejected
5. Post-approval action executed on entity

**Trigger events:** `publish` (proposals) · `discount_threshold` (proposals) · `project_completion` (projects)

**Tables:** `approval_rules`, `approval_rule_steps`, `approval_requests`, `approval_request_steps`

---

## 28. Email Inbox

### Account Management
IMAP/SMTP accounts with AES-256-CBC encrypted passwords. Supports shared accounts.

### Features
- Email sync (incremental via sync tokens)
- Conversation threading
- Send with inline image extraction (base64 → S3)
- Open tracking (1x1 tracking pixel, HMAC-signed)
- Draft management

### Rules Engine
Auto-processing rules with priority ordering:
- **Conditions:** field (from/to/subject/body/has_attachments), operator (contains/equals/starts_with/regex)
- **Actions:** mark_read, star, label, link_contact, link_lead, link_opportunity, link_account, forward, auto_reply, delete

---

## 29. Email Marketing

### Provider Integrations
- **MailerLite** — subscriber management via REST API
- **Mailchimp** — member management with datacenter routing

Config stored in `public.tenant_integrations` (provider, api_key, datacenter).

### Features
- `getLists()` — fetch mailing lists (1hr cache)
- `addContactToList()` / `removeContactFromList()`
- `testConnection()` — verify provider connectivity
- Webhook processing: subscribe, unsubscribe, bounce, spam, open, click events
- Contact status tracking: `email_marketing_status`, `email_bounced_at`, `last_email_opened_at`

### Workflow Integration
Actions `add_to_email_list` and `remove_from_email_list` in workflow engine.

---

## 30. Calendar Sync

### Google Calendar (2-way)
- **OAuth2 flow:** consent → callback → token storage + refresh
- **CRM → Google:** pushes tasks with due dates as calendar events
- **Google → CRM:** pulls events with incremental sync (syncToken)
- **Meeting booking:** creates events with Google Meet links

**Sync direction:** bidirectional by default. Avoids duplicates by tracking `source: 'crm' | 'google'`.

**Tables:** `calendar_connections` (tokens, sync state) · `calendar_events` (provider_event_id, task_id mapping)

---

## 31. Scheduling & Booking

Meeting booking system integrated with forms module.

- Form type `meeting_booking` with `meeting_config` JSONB
- `form_booking_availability` — per day-of-week windows (start_time, end_time)
- Available date calculation with `maxDaysAhead` config
- Confirmation flow with calendar integration

---

## 32. Customer 360

### Subscriptions
Full CRUD for account subscriptions with MRR calculation.
- Billing frequency: monthly, quarterly, yearly, one-time
- Auto-renewal with reminder days
- Source tracking: opportunity_id, invoice_id, contract_id
- Workflow trigger: `subscription_created`

### Usage & Health
- `account_usage_sources` — API/webhook/integration usage tracking
- Health scoring service with churn prediction
- Scheduled cron for score updates

---

## 33. Dashboard

### Scope Model
`'own'` (current user) · `'team'` (user's team) · `'all'` (tenant-wide)

`buildOwnerFilter()` constructs WHERE clauses per scope. Analytics computed from leads, opportunities, tasks, activities.

### Layout Customization
`dashboard-layout.service.ts` — user-specific widget layouts with position/size.

---

## 34. General Settings

### Company Settings
`company_settings` table (singleton per tenant): company_name, tagline, email, phone, website, logo_url, address fields, tax_id, registration_no, base_country, base_city, default_currency, timezone.

Auto-creates on first read if missing.

### Currencies
`currencies` table: code, name, symbol, decimal_places, is_active, is_default, sort_order.

---

## 35. API Keys

Service account tokens for programmatic access.

- Generated email: `api-{slug}-{suffix}@service.local`
- Expiry options: 30d, 90d, 1y, never (100yr JWT)
- Full RBAC: inherits role permissions, record access, field permissions
- `api_last_used_at` tracking
- Regenerate token without recreating account

**User columns:** `is_api_user`, `api_key_label`, `api_key_description`, `api_token_expires_at`, `api_last_used_at`

---

## 36. Global Search

Cross-entity search across 6 types with ILIKE matching (min 2 chars).

**Searched entities:** contacts, accounts, leads, opportunities, projects, tasks

Returns: `{ id, type, title, subtitle, url }` — limited to `ceil(limit/6)` per type, default 20 total.