---
sidebar_position: 6
title: "Database Migrations"
description: "Migration system architecture, writing idempotent migrations, and managing schema evolution"
---

# Database Migrations

Intellicon CRM uses a custom migration system designed for schema-per-tenant architecture. All migrations are defined in a single file and applied to every tenant schema.

## Migration System Overview

Unlike traditional ORM migrations that generate files per change, Intellicon uses a **single source of truth**: an array of named migrations in one TypeScript file.

```
Source:  apps/api/src/scripts/run-tenant-migrations.ts
Runner:  npx ts-node apps/api/src/scripts/run-tenant-migrations.ts
Tracker: "${schema}".schema_migrations table
```

### How It Works

1. The script loads all tenant schemas from `public.tenants`
2. For each schema, it reads `schema_migrations` to find already-applied migrations
3. It runs only **pending** migrations in order
4. Each successful migration is recorded in `schema_migrations`

```
┌──────────────────────┐
│  run-tenant-migrations│
│  .ts                  │
│                       │
│  migrations = [       │
│    { name, sql },     │
│    { name, sql },     │
│    ...                │
│  ]                    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐    ┌──────────────────┐
│  For each tenant:     │───▶│  tenant_acme      │
│  - Check applied      │    │  .schema_migrations│
│  - Run pending        │    └──────────────────┘
│  - Record success     │    ┌──────────────────┐
│                       │───▶│  tenant_corp      │
└──────────────────────┘    │  .schema_migrations│
                            └──────────────────┘
```

## Migration Naming Convention

Migrations use a sequential numeric prefix followed by a descriptive name:

```
001_initial_schema
002_add_custom_fields
003_add_pipelines
...
025_stage_ownership
026_your_new_migration
```

:::warning
- Always use the next sequential number
- Never reuse a migration number
- Never edit an existing migration — append a new one
:::

## Writing Migrations

### Basic Structure

```typescript
{
  name: '026_add_proposals_table',
  sql: `
    CREATE TABLE IF NOT EXISTS "${schema}".proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      amount DECIMAL(15,2),
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_proposals_status
      ON "${schema}".proposals(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_created_by
      ON "${schema}".proposals(created_by);
  `
}
```

:::danger Critical: Use `${schema}` not `${schemaName}`
The migration script's loop variable is `schema`, not `schemaName`. Using the wrong variable will cause a runtime error.

```typescript
// CORRECT
`CREATE TABLE IF NOT EXISTS "${schema}".my_table ...`

// WRONG — will fail
`CREATE TABLE IF NOT EXISTS "${schemaName}".my_table ...`
```
:::

### Idempotent Migrations

All migrations MUST be idempotent — safe to run multiple times without error.

#### Creating Tables

```sql
CREATE TABLE IF NOT EXISTS "${schema}".my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL
);
```

#### Adding Columns

```sql
ALTER TABLE "${schema}".my_table
  ADD COLUMN IF NOT EXISTS new_column VARCHAR(100) DEFAULT 'value';
```

#### Creating Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_my_table_column
  ON "${schema}".my_table(column_name);
```

#### Adding Constraints

Constraints do not support `IF NOT EXISTS` natively. Use a `DO` block:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_my_table_user'
  ) THEN
    ALTER TABLE "${schema}".my_table
      ADD CONSTRAINT fk_my_table_user
      FOREIGN KEY (user_id) REFERENCES "${schema}".users(id);
  END IF;
END $$;
```

#### Dropping Columns (rare)

```sql
ALTER TABLE "${schema}".my_table
  DROP COLUMN IF EXISTS old_column;
```

## Running Migrations

```bash
cd apps/api
npx ts-node src/scripts/run-tenant-migrations.ts
```

### Expected Output

```
Starting tenant migrations...
Found 15 tenant schemas
Processing tenant_acme... 2 pending migrations
  ✓ 025_stage_ownership
  ✓ 026_add_proposals_table
Processing tenant_corp... 2 pending migrations
  ✓ 025_stage_ownership
  ✓ 026_add_proposals_table
...
All migrations complete.
```

## Migration Tracking

Each tenant schema has a `schema_migrations` table:

```sql
SELECT * FROM "tenant_acme".schema_migrations ORDER BY executed_at;
```

| id | migration_name | executed_at |
|----|---------------|-------------|
| 1 | 001_initial_schema | 2025-01-15 10:00:00 |
| 2 | 002_add_custom_fields | 2025-01-15 10:00:01 |
| ... | ... | ... |

## Existing Migrations Reference

| # | Name | Creates / Modifies |
|---|------|--------------------|
| 001 | `initial_schema` | users, roles, departments, contacts, accounts, leads, opportunities, tasks, activities, audit_logs, notes, documents |
| 002 | `add_custom_fields` | custom_fields, custom_field_groups |
| 003 | `add_pipelines` | pipelines, pipeline_stages, pipeline_stage_fields |
| 004 | `add_products` | products, product_categories, price_books, price_book_entries |
| 005 | `add_notifications` | notifications, notification_preferences |
| 006 | `add_teams` | teams, team_members, record_teams |
| 007 | `add_user_invitations` | user_invitations |
| 008 | `add_dashboard_widgets` | dashboard_widgets, dashboard_layouts |
| 009 | `add_reports` | reports, report_folders, report_schedules |
| 010 | `add_calendar_sync` | calendar_connections, calendar_events |
| 011 | `add_lead_import` | import_jobs, import_job_rows |
| 012 | `add_targets` | targets, target_assignments, badges, user_badges |
| 013 | `add_lead_scoring` | lead_scoring_rules |
| 014 | `add_sla` | sla_policies, lead_sla_tracking |
| 015 | `add_contact_accounts` | contact_accounts (junction table) |
| 016 | `add_lead_products` | lead_products |
| 017 | `add_opportunity_contacts` | opportunity_contact_roles |
| 018 | `add_opportunity_line_items` | opportunity_line_items |
| 019 | `add_opportunity_stage_history` | opportunity_stage_history |
| 020 | `add_custom_tabs` | custom_tabs |
| 021 | `add_module_settings` | module_settings |
| 022 | `add_table_preferences` | table_preferences |
| 023 | `add_page_layouts` | page_layouts |
| 024 | `add_email_signatures` | email_signatures |
| 025 | `stage_ownership` | Adds columns to pipeline_stages + creates record_stage_assignments |

## Best Practices

### Do
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Always index foreign key columns
- Always index commonly filtered columns (status, type, created_by)
- Always provide DEFAULT values for new non-nullable columns
- Always test migrations against an existing tenant schema before merging
- Include both `created_at` and `updated_at` with `TIMESTAMPTZ` type
- Include `deleted_at TIMESTAMPTZ` for soft-deletable tables

### Do Not
- Never edit an already-deployed migration
- Never use `DROP TABLE` without `IF EXISTS`
- Never add `NOT NULL` columns without a `DEFAULT` to tables that have data
- Never use `${schemaName}` — use `${schema}`
- Never create circular foreign key constraints
- Never add expensive operations (full table scans, data backfills) to migrations without testing on production-size data

:::tip Testing Migrations
Before deploying, test your migration against a copy of a production tenant schema:
```sql
-- Create a test copy
CREATE SCHEMA "tenant_test" AS SCHEMA CLONE FROM "tenant_production";
-- Run migrations against it
-- Verify data integrity
```
:::
