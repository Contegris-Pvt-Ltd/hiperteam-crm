---
sidebar_position: 2
title: "Multi-Tenant Architecture"
description: "Schema-per-tenant isolation model, query patterns, and tenant lifecycle management"
---

# Multi-Tenant Architecture

HiperTeam CRM uses a **schema-per-tenant** isolation model. Every tenant gets a dedicated PostgreSQL schema containing all their tables, data, and configurations.

## Schema-Per-Tenant Model

```
PostgreSQL Database: intellicon_crm
├── public              ← Global tables (tenants, etc.)
├── tenant_acme         ← Tenant "Acme Corp" data
│   ├── users
│   ├── contacts
│   ├── leads
│   ├── opportunities
│   └── ... (30+ tables)
├── tenant_globex       ← Tenant "Globex Inc" data
│   ├── users
│   ├── contacts
│   └── ...
└── tenant_initech      ← Tenant "Initech" data
    └── ...
```

:::info Why Schema-Per-Tenant?
Compared to shared-table multi-tenancy (row-level `tenant_id`), schema-per-tenant provides:
- **Complete data isolation** — no accidental cross-tenant queries
- **Independent indexing** — each schema has its own indexes optimized for its data volume
- **Simpler queries** — no need to add `WHERE tenant_id = ?` to every query
- **Easier data export/deletion** — drop the schema to fully remove a tenant
- **Custom fields** — each tenant can have its own custom field definitions
:::

## Tenant Creation Flow

When a new tenant registers, the following sequence occurs:

```
1. POST /auth/register
   └─→ Create row in public.tenants (id, slug, company_name)
       └─→ TenantSchemaService.createSchema(slug)
           ├─→ CREATE SCHEMA "tenant_{slug}"
           ├─→ Run ALL migrations against new schema
           ├─→ Seed default roles (Admin, Manager, User)
           ├─→ Seed default pipeline + stages
           └─→ Create admin user in tenant schema
               └─→ Return { accessToken, refreshToken, user }
```

### Schema Naming Convention

Tenant schemas follow the pattern: `tenant_{slug}`

```
Company Name: "Acme Corporation"
Slug:         "acme-corporation"
Schema:       "tenant_acme-corporation"
```

The slug is derived from the company name during registration and stored in `public.tenants`.

## Query Patterns

### The Fundamental Rule

:::danger Critical
Every tenant-scoped query MUST prefix table names with the schema name from the JWT token. Never use `public.` and never hardcode a schema name.
:::

```typescript
// CORRECT — schema from JWT
async findAll(schemaName: string) {
  return this.dataSource.query(
    `SELECT * FROM "${schemaName}".leads WHERE deleted_at IS NULL`
  );
}

// WRONG — hardcoded schema
async findAll() {
  return this.dataSource.query(
    `SELECT * FROM "tenant_acme".leads WHERE deleted_at IS NULL`  // ❌ NEVER
  );
}

// WRONG — no schema prefix
async findAll() {
  return this.dataSource.query(
    `SELECT * FROM leads WHERE deleted_at IS NULL`  // ❌ Hits public schema
  );
}
```

### How schemaName Flows Through the System

```typescript
// 1. JWT token contains tenantSchema
interface JwtPayload {
  sub: string;            // user ID
  tenantSchema: string;   // "tenant_acme"
  // ... other fields
}

// 2. Controller extracts it from req.user
@Get()
async findAll(@Request() req: { user: JwtPayload }) {
  return this.service.findAll(req.user.tenantSchema, req.user.sub);
}

// 3. Service uses it in every query
async findAll(schemaName: string, userId: string) {
  return this.dataSource.query(
    `SELECT id, first_name, last_name, email, created_at
     FROM "${schemaName}".contacts
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`,
  );
}
```

### Parameterized Queries

Always use `$1, $2, ...` placeholders for values. Schema names cannot be parameterized (they are identifiers, not values), so they use string interpolation with the trusted JWT value.

```typescript
async findById(schemaName: string, id: string) {
  const [row] = await this.dataSource.query(
    `SELECT * FROM "${schemaName}".contacts WHERE id = $1 AND deleted_at IS NULL`,
    [id],  // $1 = id (parameterized — safe)
  );
  return row ? this.formatRow(row) : null;
}

async create(schemaName: string, userId: string, data: CreateContactDto) {
  const [row] = await this.dataSource.query(
    `INSERT INTO "${schemaName}".contacts (first_name, last_name, email, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.firstName, data.lastName, data.email, userId],
  );
  return this.formatRow(row);
}
```

## Why Raw SQL Instead of TypeORM Entities

TypeORM entities are bound to a fixed schema at compile time:

```typescript
// TypeORM entity — schema is static
@Entity({ schema: 'public' })  // Can't change at runtime!
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
```

Since each tenant has a different schema, we cannot use TypeORM entities for tenant data. Instead, we use `DataSource.query()` for raw SQL:

```typescript
@Injectable()
export class ContactsService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(schemaName: string) {
    // Schema is dynamic — determined at runtime from JWT
    return this.dataSource.query(
      `SELECT * FROM "${schemaName}".contacts WHERE deleted_at IS NULL`
    );
  }
}
```

:::note When TypeORM Entities ARE Used
TypeORM entities are used only for **global** (non-tenant) tables in the `public` schema:
- `public.tenants` — the tenant registry
- That is the only entity using TypeORM's repository pattern.
:::

## TenantSchemaService Responsibilities

Located at `apps/api/src/database/tenant-schema.service.ts`:

| Method | Purpose |
|--------|---------|
| `createSchema(slug)` | Creates new PostgreSQL schema for a tenant |
| `runMigrations(schema)` | Runs all migrations against a specific schema |
| `schemaExists(slug)` | Checks if a schema already exists |
| `dropSchema(slug)` | Removes a tenant schema (admin operation) |

```typescript
async createSchema(slug: string): Promise<void> {
  const schemaName = `tenant_${slug}`;

  // Create the schema
  await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Run all migrations
  await this.runMigrations(schemaName);

  // Seed default data (roles, pipeline, etc.)
  await this.seedDefaults(schemaName);
}
```

## Schema Isolation Guarantees

1. **No cross-schema joins** — queries never reference another tenant's schema
2. **JWT-bound schema** — the schema name comes exclusively from the authenticated JWT
3. **No dynamic schema discovery** — services never list or iterate schemas
4. **Audit trail per schema** — each tenant's audit logs are in their own schema

## Performance Considerations

### Advantages
- **Smaller table scans** — each tenant's tables only contain their data
- **Independent vacuum/analyze** — PostgreSQL can optimize per-schema
- **Parallel migrations** — schemas can be migrated independently
- **Connection pooling** — shared connection pool, schema set per query

### Considerations
- **Schema count** — PostgreSQL handles hundreds of schemas efficiently; thousands may need connection pool tuning
- **Migration time** — new migrations must run against ALL tenant schemas
- **Memory** — each schema's indexes consume memory; monitor `shared_buffers`

:::tip Optimization
For very large deployments (1000+ tenants), consider:
- Running migrations in batches with concurrency limits
- Monitoring `pg_stat_user_tables` per schema for bloat
- Using `pg_partman` for time-series tables within schemas
:::

## Common Pitfalls

### 1. Forgetting the Schema Prefix
```typescript
// ❌ BAD — queries public schema
await this.dataSource.query(`SELECT * FROM contacts`);

// ✅ GOOD — queries tenant schema
await this.dataSource.query(`SELECT * FROM "${schemaName}".contacts`);
```

### 2. String Concatenation in Values
```typescript
// ❌ BAD — SQL injection risk
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".contacts WHERE email = '${email}'`
);

// ✅ GOOD — parameterized
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".contacts WHERE email = $1`,
  [email]
);
```

### 3. Missing deleted_at Filter
```typescript
// ❌ BAD — returns soft-deleted records
await this.dataSource.query(`SELECT * FROM "${schemaName}".contacts`);

// ✅ GOOD — excludes soft-deleted
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".contacts WHERE deleted_at IS NULL`
);
```

### 4. Using TypeORM Repository for Tenant Data
```typescript
// ❌ BAD — entity bound to public schema
const contacts = await this.contactRepo.find();

// ✅ GOOD — raw SQL with dynamic schema
const contacts = await this.dataSource.query(
  `SELECT * FROM "${schemaName}".contacts WHERE deleted_at IS NULL`
);
```
