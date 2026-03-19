---
sidebar_position: 1
title: "Architecture Overview"
description: "High-level system architecture, technology stack, and design principles of HiperTeam CRM"
---

# Architecture Overview

HiperTeam CRM is a multi-tenant SaaS CRM platform built as a full Business & People Operating System. It covers the complete customer lifecycle: **Lead → Opportunity → Deal → Project → Support → Customer Success**.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  React + TypeScript + Vite + Tailwind CSS (SPA on :5173)    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────────┐
│                        API Layer                            │
│  NestJS + TypeORM (DataSource only) + JWT Auth (on :3000)   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Guards   │  │  Controllers │  │  Services (raw SQL) │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
└───────┬──────────────────────────────────┬──────────────────┘
        │                                  │
┌───────▼──────────┐              ┌────────▼─────────┐
│   PostgreSQL      │              │   Redis           │
│   (schema/tenant) │              │   (Bull queues,   │
│   ┌────────────┐  │              │    sessions)      │
│   │tenant_acme │  │              └──────────────────┘
│   │tenant_corp │  │
│   │tenant_xxx  │  │
│   └────────────┘  │
└───────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI components and SPA |
| **Bundler** | Vite | Fast dev server and production builds |
| **Styling** | Tailwind CSS | Utility-first CSS with dark mode |
| **State** | Zustand | Lightweight global state (auth, sidebar) |
| **HTTP Client** | Axios | API communication with interceptors |
| **Backend** | NestJS | Enterprise Node.js framework |
| **ORM** | TypeORM (DataSource only) | Connection management, NOT entity mapping |
| **Database** | PostgreSQL | Schema-per-tenant multi-tenancy |
| **Queue** | Bull + Redis | Background job processing (imports, emails) |
| **Auth** | JWT (jsonwebtoken) | Stateless authentication |
| **Docs** | Swagger (OpenAPI) | Auto-generated API documentation |

## Monorepo Structure

The project is a monorepo with two applications:

```
/
├── apps/
│   ├── api/          ← NestJS backend (port 3000)
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── common/       ← Guards, decorators, types
│   │   │   ├── config/       ← Configuration loader
│   │   │   ├── database/     ← Tenant schema service, migrations
│   │   │   ├── modules/      ← Feature modules (31+)
│   │   │   └── scripts/      ← Migration runner, seeds
│   │   └── package.json
│   │
│   └── web/          ← React frontend (port 5173)
│       ├── src/
│       │   ├── App.tsx        ← Route definitions
│       │   ├── api/           ← One API file per module
│       │   ├── components/    ← Shared + layout components
│       │   ├── config/        ← Field registry, constants
│       │   ├── features/      ← Feature pages (mirrors modules/)
│       │   ├── hooks/         ← Custom React hooks
│       │   ├── stores/        ← Zustand state stores
│       │   └── utils/         ← Utility functions
│       └── package.json
│
├── CLAUDE.md          ← AI coding context
└── package.json       ← Root workspace config
```

## Communication Flow

### Typical Request Lifecycle

1. **Client** sends HTTP request with JWT in `Authorization: Bearer <token>` header
2. **JwtAuthGuard** validates the token and populates `req.user` with `JwtPayload`
3. **PermissionGuard** checks `@RequirePermission` metadata against `req.user.permissions`
4. **Controller** extracts `tenantSchema` and `userId` from `req.user`
5. **Service** executes parameterized raw SQL against `"${schemaName}".table_name`
6. **Service** calls `AuditService.log()` for mutations
7. **Service** runs `formatRow()` to convert snake_case DB columns to camelCase
8. **Controller** returns formatted response to client

```typescript
// Controller → Service → Database flow
@Get()
@RequirePermission('leads', 'view')
async findAll(@Request() req: { user: JwtPayload }) {
  // req.user.tenantSchema = "tenant_acme"
  // req.user.sub = "user-uuid-123"
  return this.leadsService.findAll(req.user.tenantSchema, req.user);
}
```

## Key Architectural Decisions

### 1. Schema-Per-Tenant Isolation

Each tenant gets a dedicated PostgreSQL schema. This provides strong data isolation without the operational overhead of separate databases.

:::info Why schema-per-tenant?
- **Data isolation**: No risk of cross-tenant data leaks
- **Customizability**: Each tenant can have custom fields and configurations
- **Performance**: Queries only scan tenant data, not a shared table
- **Compliance**: Easier to handle data residency requirements
- **Migration**: Independent schema evolution per tenant if needed
:::

### 2. Raw SQL Over TypeORM Entities

Tenant-scoped queries use `this.dataSource.query()` with raw SQL instead of TypeORM entities. This is because TypeORM entities bind to a fixed schema, but our schema is dynamic (determined at runtime from JWT).

### 3. JWT-Embedded RBAC

The entire permission model is serialized into the JWT token. This eliminates per-request permission lookups from the database, making authorization checks O(1).

### 4. Soft Deletes Everywhere

All tenant data uses soft deletes (`deleted_at IS NULL`). This enables audit trails, data recovery, and compliance requirements.

### 5. Shared Pipeline System

Pipelines, stages, and stage fields are shared across modules (leads, opportunities, deals, projects) via a `module` column discriminator rather than duplicated per module.

## Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Multi-tenancy** | Schema-per-tenant with runtime schema resolution |
| **RBAC** | 3-level permissions: module → record → field |
| **Audit Trail** | Every mutation logged via `AuditService` |
| **Soft Deletes** | `deleted_at IS NULL` on all queries |
| **Idempotent Migrations** | `IF NOT EXISTS` / `IF EXISTS` in all DDL |
| **Parameterized Queries** | `$1, $2` placeholders — never string concatenation |
| **camelCase/snake_case** | TypeScript uses camelCase, PostgreSQL uses snake_case |
| **Global Services** | Shared module auto-injected everywhere |

:::warning Critical Rules
- **NEVER** hardcode a tenant schema name
- **NEVER** use `public.` schema prefix for tenant data
- **NEVER** use TypeORM entities for tenant-scoped queries
- **ALWAYS** use parameterized queries (`$1, $2`) — never string concatenation
- **ALWAYS** include `deleted_at IS NULL` on SELECT queries for soft-deletable tables
- **ALWAYS** call `auditService.log()` after every create/update/delete
:::
