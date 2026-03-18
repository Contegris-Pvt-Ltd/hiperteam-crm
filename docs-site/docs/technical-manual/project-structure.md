---
sidebar_position: 3
title: "Project Structure"
description: "Complete directory layout, file naming conventions, and module organization patterns"
---

# Project Structure

The Intellicon CRM monorepo contains two applications: a NestJS API backend and a React frontend.

## Root Directory

```
/
├── apps/
│   ├── api/                ← NestJS backend
│   └── web/                ← React frontend
├── CLAUDE.md               ← AI coding context
├── package.json            ← Root workspace configuration
├── tsconfig.json           ← Root TypeScript configuration
└── .env                    ← Environment variables (not committed)
```

## Backend Structure (`apps/api/src/`)

```
apps/api/src/
├── main.ts                                  ← Application bootstrap
├── app.module.ts                            ← Root module — ALL modules registered here
│
├── config/
│   └── configuration.ts                     ← Environment config loader
│
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                ← JWT token validation guard
│   │   └── permissions.guard.ts             ← RBAC permission checking guard
│   ├── decorators/
│   │   ├── require-permission.decorator.ts  ← @RequirePermission()
│   │   └── admin-only.decorator.ts          ← @AdminOnly()
│   ├── services/
│   │   └── record-scope.service.ts          ← Record-level access filtering
│   └── types/
│       └── permissions.types.ts             ← RBAC interfaces + MODULE_DEFINITIONS
│
├── database/
│   ├── entities/
│   │   └── tenant.entity.ts                 ← ONLY global entity (public.tenants)
│   ├── migrations/                          ← Reference SQL files (not used at runtime)
│   ├── tenant-schema.service.ts             ← Schema creation and management
│   └── migration-runner.service.ts          ← Migration execution engine
│
├── scripts/
│   └── run-tenant-migrations.ts             ← THE migration source of truth
│
└── modules/
    ├── shared/                              ← @Global() — auto-available everywhere
    │   ├── shared.module.ts
    │   ├── audit.service.ts                 ← Mutation audit logging
    │   ├── activity.service.ts              ← Activity feed tracking
    │   ├── documents.service.ts             ← Document management
    │   ├── notes.service.ts                 ← Notes CRUD
    │   ├── data-access.service.ts           ← Record-level access WHERE builder
    │   ├── record-team.service.ts           ← Record team membership
    │   ├── field-validation.service.ts      ← Custom field validation
    │   ├── table-columns.service.ts         ← Column definitions per module
    │   ├── table-preferences.service.ts     ← User column preferences
    │   ├── table-preferences.controller.ts  ← Column preferences API
    │   └── module-settings.controller.ts    ← Module settings API
    │
    ├── auth/                ← JWT, login, refresh, registration, invitations
    ├── tenant/              ← Tenant CRUD, schema creation
    ├── users/               ← User management + invitations + org tree
    ├── roles/               ← RBAC role management + MODULE_DEFINITIONS
    ├── departments/         ← Department hierarchy
    ├── teams/               ← Team management
    ├── contacts/            ← Contact CRUD + associations
    ├── accounts/            ← Account CRUD (B2B/B2C)
    ├── leads/               ← Leads + pipeline + settings + scoring + SLA
    │   ├── leads.module.ts
    │   ├── leads.service.ts
    │   ├── leads.controller.ts
    │   ├── lead-settings.service.ts
    │   ├── lead-settings.controller.ts
    │   ├── lead-scoring.service.ts
    │   └── sla.service.ts
    ├── opportunities/       ← Opportunities + pipeline + settings
    │   ├── opportunities.module.ts
    │   ├── opportunities.service.ts
    │   ├── opportunities.controller.ts
    │   ├── opportunity-settings.service.ts
    │   └── opportunity-settings.controller.ts
    ├── tasks/               ← Tasks + subtasks + types/statuses/priorities
    ├── products/            ← Products + price books + bundles
    ├── dashboard/           ← Dashboard widgets + statistics
    ├── reports/             ← Dynamic report builder + engine
    ├── targets/             ← Targets, assignments, gamification, badges
    │   ├── targets.module.ts
    │   ├── targets.service.ts
    │   ├── targets.controller.ts
    │   └── gamification.service.ts
    ├── notifications/       ← In-app + push + email notifications
    ├── calendar-sync/       ← Google Calendar 2-way sync
    ├── lead-import/         ← CSV/XLSX bulk import (Bull queue)
    │   ├── lead-import.module.ts
    │   ├── lead-import.service.ts
    │   ├── lead-import.controller.ts
    │   └── lead-import.processor.ts
    ├── admin/               ← Custom fields, layouts, field groups, tabs
    ├── upload/              ← File upload (avatar + documents)
    └── email/               ← Email sending service (SMTP)
```

## Frontend Structure (`apps/web/src/`)

```
apps/web/src/
├── App.tsx                           ← ALL route definitions
├── main.tsx                          ← React entry point
├── index.css                         ← Tailwind base styles
│
├── api/                              ← One file per module
│   ├── contacts.api.ts               ← Canonical axios instance + contacts API
│   ├── accounts.api.ts
│   ├── leads.api.ts                  ← leadsApi + leadSettingsApi
│   ├── opportunities.api.ts          ← opportunitiesApi + opportunitySettingsApi
│   ├── tasks.api.ts
│   ├── products.api.ts
│   ├── users.api.ts
│   ├── roles.api.ts
│   ├── teams.api.ts
│   ├── departments.api.ts
│   ├── targets.api.ts                ← targetsApi + gamificationApi
│   ├── reports.api.ts
│   ├── admin.api.ts
│   ├── upload.api.ts
│   ├── notifications.api.ts
│   ├── calendar-sync.api.ts
│   ├── lead-import.api.ts
│   ├── page-layout.api.ts
│   ├── tablePreferences.api.ts
│   └── module-settings.api.ts
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx               ← Main navigation sidebar
│   │   ├── MainLayout.tsx            ← Authenticated layout wrapper
│   │   └── Header.tsx                ← Top header bar
│   └── shared/
│       ├── DataTable/                ← Configurable data table
│       │   ├── DataTable.tsx
│       │   ├── useTableColumns.ts
│       │   └── useTablePreferences.ts
│       ├── CustomFieldRenderer.tsx   ← Dynamic field rendering
│       ├── SearchableSelect.tsx      ← Multi/single select with search
│       ├── DocumentsPanel.tsx        ← Entity document management
│       ├── NotesPanel.tsx            ← Entity notes management
│       ├── AvatarUpload.tsx          ← Profile image upload
│       ├── Timeline.tsx              ← Activity timeline
│       └── ChangeHistory.tsx         ← Audit log display
│
├── features/
│   ├── admin/                        ← All /admin/* settings pages
│   │   ├── AdminLayout.tsx           ← Admin navigation sidebar
│   │   ├── CustomFieldsPage.tsx
│   │   ├── FieldValidationPage.tsx
│   │   ├── LeadSettingsPage.tsx
│   │   ├── OpportunitySettingsPage.tsx
│   │   ├── TaskSettingsPage.tsx
│   │   ├── NotificationPreferencesPage.tsx
│   │   ├── TargetsSettingsPage.tsx
│   │   ├── BatchJobsPage.tsx
│   │   ├── PageDesignerPage.tsx
│   │   └── AuditLogViewer.tsx
│   ├── contacts/
│   │   ├── ContactsPage.tsx          ← List view
│   │   └── ContactDetailPage.tsx     ← Detail view
│   ├── accounts/
│   ├── leads/
│   ├── opportunities/
│   ├── tasks/
│   ├── products/
│   ├── dashboard/
│   ├── reports/
│   ├── users/
│   ├── teams/
│   ├── departments/
│   ├── roles/
│   └── notifications/
│
├── hooks/
│   ├── usePermissions.ts             ← Permission checking hook
│   ├── useTableColumns.ts            ← Column config hook
│   ├── useTablePreferences.ts        ← Column preferences hook
│   └── useModuleLayout.ts            ← Page layout hook
│
├── stores/
│   ├── auth.store.ts                 ← User, tenant, tokens, permissions
│   └── sidebar.store.ts              ← Sidebar collapsed/expanded state
│
├── config/
│   └── field-registry.ts             ← Field type definitions and config
│
└── utils/
    └── field-validation.ts           ← Client-side field validation
```

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Module** | `kebab-case.module.ts` | `lead-import.module.ts` |
| **Service** | `kebab-case.service.ts` | `lead-settings.service.ts` |
| **Controller** | `kebab-case.controller.ts` | `lead-settings.controller.ts` |
| **Entity** | `kebab-case.entity.ts` | `tenant.entity.ts` |
| **React Page** | `PascalCase.tsx` | `LeadSettingsPage.tsx` |
| **React Component** | `PascalCase.tsx` | `SearchableSelect.tsx` |
| **API File** | `kebab-case.api.ts` | `calendar-sync.api.ts` |
| **Hook** | `camelCase.ts` | `usePermissions.ts` |
| **Store** | `kebab-case.store.ts` | `auth.store.ts` |
| **Util** | `kebab-case.ts` | `field-validation.ts` |

## Module Organization Pattern

Each backend module follows a consistent structure:

```
modules/my-module/
├── my-module.module.ts        ← NestJS module definition
├── my-module.service.ts       ← Business logic + raw SQL
├── my-module.controller.ts    ← REST endpoints + guards
└── (optional) related files   ← e.g., my-module-settings.service.ts
```

:::tip Module Registration
Every new module must be added to the `imports` array in `apps/api/src/app.module.ts`. Without this, the module's controllers and services will not be available.
:::

Each frontend feature module mirrors the backend:

```
features/my-module/
├── MyModulePage.tsx            ← List page (table view)
├── MyModuleDetailPage.tsx     ← Detail/edit page
└── (optional) components/     ← Module-specific components
```

:::note Correspondence
Backend `modules/leads/` corresponds to frontend `features/leads/` and `api/leads.api.ts`. This 1:1 mapping makes it easy to trace functionality across the stack.
:::
