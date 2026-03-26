---
sidebar_position: 10
title: "Module Pattern"
description: "Standard NestJS module structure, controller and service patterns, and step-by-step guide to creating new modules"
---

# Module Pattern

Every backend feature in IntelliSales CRM follows a consistent module structure. This guide covers the standard patterns and provides a complete example of creating a new module from scratch.

## Standard Module Structure

```
modules/my-module/
├── my-module.module.ts        ← NestJS module definition
├── my-module.service.ts       ← Business logic + raw SQL queries
└── my-module.controller.ts    ← REST endpoints + guards + decorators
```

Larger modules may include additional files:

```
modules/leads/
├── leads.module.ts
├── leads.service.ts
├── leads.controller.ts
├── lead-settings.service.ts       ← Settings sub-service
├── lead-settings.controller.ts    ← Settings sub-controller
├── lead-scoring.service.ts        ← Domain-specific service
└── sla.service.ts                 ← Domain-specific service
```

## Module Definition

```typescript
// my-module.module.ts
import { Module } from '@nestjs/common';
import { MyModuleController } from './my-module.controller';
import { MyModuleService } from './my-module.service';

@Module({
  controllers: [MyModuleController],
  providers: [MyModuleService],
  exports: [MyModuleService],  // Export if other modules need this service
})
export class MyModule {}
```

### Registration in app.module.ts

Every module MUST be registered in the root `app.module.ts`:

```typescript
// apps/api/src/app.module.ts
import { MyModule } from './modules/my-module/my-module.module';

@Module({
  imports: [
    // ... existing modules
    MyModule,  // ← Add here
  ],
})
export class AppModule {}
```

:::warning
If you forget to add the module to `app.module.ts`, its controllers will not be registered and its endpoints will return 404.
:::

## Controller Pattern

```typescript
// my-module.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { MyModuleService } from './my-module.service';

@ApiTags('My Module')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('my-module')
export class MyModuleController {
  constructor(private readonly myModuleService: MyModuleService) {}

  // ─── NAMED ROUTES FIRST (before :id) ───────────────────

  @Get('stats')
  @RequirePermission('my_module', 'view')
  async getStats(@Request() req: { user: JwtPayload }) {
    return this.myModuleService.getStats(req.user.tenantSchema);
  }

  @Put('settings')
  @AdminOnly()
  async updateSettings(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    return this.myModuleService.updateSettings(
      req.user.tenantSchema, req.user.sub, body,
    );
  }

  // ─── STANDARD CRUD ─────────────────────────────────────

  @Get()
  @RequirePermission('my_module', 'view')
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.myModuleService.findAll(
      req.user.tenantSchema, req.user, { page, limit, search },
    );
  }

  @Post()
  @RequirePermission('my_module', 'create')
  async create(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    return this.myModuleService.create(
      req.user.tenantSchema, req.user.sub, body,
    );
  }

  @Get(':id')
  @RequirePermission('my_module', 'view')
  async findById(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.myModuleService.findById(req.user.tenantSchema, id);
  }

  @Put(':id')
  @RequirePermission('my_module', 'edit')
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.myModuleService.update(
      req.user.tenantSchema, req.user.sub, id, body,
    );
  }

  @Delete(':id')
  @RequirePermission('my_module', 'delete')
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.myModuleService.remove(
      req.user.tenantSchema, req.user.sub, id,
    );
  }
}
```

:::danger Named Routes Before :id
NestJS matches routes in definition order. If `@Get(':id')` is defined before `@Get('stats')`, a request to `/my-module/stats` will match `:id` with `id = "stats"`. Always define named routes first.

```typescript
// CORRECT ORDER
@Get('stats')      // ← Named route first
@Get('export')     // ← Named route
@Get(':id')        // ← Parameterized route last

// WRONG ORDER — 'stats' matches as :id
@Get(':id')        // ← Catches everything!
@Get('stats')      // ← Never reached
```
:::

## Service Pattern

```typescript
// my-module.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { DataAccessService } from '../shared/data-access.service';

@Injectable()
export class MyModuleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly dataAccessService: DataAccessService,
  ) {}

  // ─── FIND ALL (with pagination + record scoping) ──────

  async findAll(schemaName: string, user: JwtPayload, options: any) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 25, 100);
    const offset = (page - 1) * limit;

    const { clause: accessClause, params: accessParams } =
      await this.dataAccessService.buildWhereClause(schemaName, user, 'my_module', 'm');

    let whereClause = `WHERE m.deleted_at IS NULL ${accessClause}`;
    const params = [...accessParams];

    if (options.search) {
      params.push(`%${options.search}%`);
      whereClause += ` AND (m.name ILIKE $${params.length})`;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM "${schemaName}".my_table m
      ${whereClause}
    `;

    const dataQuery = `
      SELECT m.*
      FROM "${schemaName}".my_table m
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countResult] = await this.dataSource.query(countQuery, params);
    const rows = await this.dataSource.query(dataQuery, [...params, limit, offset]);

    const total = parseInt(countResult.total, 10);

    return {
      data: rows.map(this.formatRow),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── FIND BY ID ───────────────────────────────────────

  async findById(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".my_table
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );

    if (!row) throw new NotFoundException('Record not found');

    return this.formatRow(row);
  }

  // ─── CREATE ───────────────────────────────────────────

  async create(schemaName: string, userId: string, data: any) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".my_table (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.description, userId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'my_table',
      entityId: row.id,
      action: 'create',
      changes: {},
      newValues: row,
      performedBy: userId,
    });

    return this.formatRow(row);
  }

  // ─── UPDATE ───────────────────────────────────────────

  async update(schemaName: string, userId: string, id: string, data: any) {
    const existing = await this.findById(schemaName, id);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".my_table
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [data.name, data.description, id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'my_table',
      entityId: id,
      action: 'update',
      changes: { before: existing, after: this.formatRow(row) },
      newValues: row,
      performedBy: userId,
    });

    return this.formatRow(row);
  }

  // ─── SOFT DELETE ──────────────────────────────────────

  async remove(schemaName: string, userId: string, id: string) {
    await this.findById(schemaName, id); // Ensure exists

    await this.dataSource.query(
      `UPDATE "${schemaName}".my_table
       SET deleted_at = NOW()
       WHERE id = $1`,
      [id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'my_table',
      entityId: id,
      action: 'delete',
      changes: {},
      newValues: {},
      performedBy: userId,
    });

    return { success: true };
  }

  // ─── FORMAT ROW (snake_case → camelCase) ──────────────

  private formatRow(r: any) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
```

## Key Service Patterns

### Parameterized Queries Only

```typescript
// CORRECT — parameterized
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".leads WHERE email = $1`,
  [email],
);

// WRONG — SQL injection vulnerability
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".leads WHERE email = '${email}'`,
);
```

### Soft Deletes

```typescript
// DELETE = set deleted_at, never DELETE FROM
await this.dataSource.query(
  `UPDATE "${schemaName}".leads SET deleted_at = NOW() WHERE id = $1`,
  [id],
);

// SELECT = always filter out deleted records
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".leads WHERE deleted_at IS NULL`,
);
```

### Audit Logging on Every Mutation

```typescript
// After every create, update, or delete:
await this.auditService.log(schemaName, {
  entityType: 'leads',
  entityId: row.id,
  action: 'create',  // 'create' | 'update' | 'delete'
  changes: {},
  newValues: row,
  performedBy: userId,
});
```

### Pagination Response Format

```typescript
// Standard pagination response
{
  data: [...],
  meta: {
    total: 150,
    page: 2,
    limit: 25,
    totalPages: 6,
  }
}
```

### formatRow Pattern

Every service includes a `private formatRow()` method to convert PostgreSQL snake_case columns to TypeScript camelCase:

```typescript
private formatRow(r: any) {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
```

## Error Handling

```typescript
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

// Record not found
if (!row) throw new NotFoundException('Lead not found');

// Validation error
if (!data.email) throw new BadRequestException('Email is required');

// Duplicate check
const [existing] = await this.dataSource.query(
  `SELECT id FROM "${schemaName}".contacts WHERE email = $1 AND deleted_at IS NULL`,
  [data.email],
);
if (existing) throw new ConflictException('Contact with this email already exists');
```

## Complete Example: Creating a New Module

### Step 1: Migration (if needed)

Add to `apps/api/src/scripts/run-tenant-migrations.ts`:

```typescript
{
  name: '026_add_proposals',
  sql: `
    CREATE TABLE IF NOT EXISTS "${schema}".proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      amount DECIMAL(15,2),
      lead_id UUID,
      opportunity_id UUID,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON "${schema}".proposals(status);
    CREATE INDEX IF NOT EXISTS idx_proposals_lead ON "${schema}".proposals(lead_id);
  `
}
```

### Step 2: Module, Service, Controller

Create the three files as shown in the patterns above.

### Step 3: Register in app.module.ts

### Step 4: Frontend API file

### Step 5: Frontend pages

:::tip One Layer at a Time
Follow the session workflow: migrations in one session, backend services in the next, controllers next, then frontend API, then UI. Never mix layers in a single session.
:::
