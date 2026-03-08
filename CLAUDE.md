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