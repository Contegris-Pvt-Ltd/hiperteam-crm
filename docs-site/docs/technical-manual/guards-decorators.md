---
sidebar_position: 9
title: "Guards & Decorators"
description: "JwtAuthGuard, PermissionGuard, custom decorators, and guard execution patterns"
---

# Guards & Decorators

Intellicon CRM uses NestJS guards and custom decorators to enforce authentication and authorization across all API endpoints.

## Guard Overview

| Guard | Purpose | Location |
|-------|---------|----------|
| `JwtAuthGuard` | Validates JWT token, populates `req.user` | `common/guards/jwt-auth.guard.ts` |
| `PermissionGuard` | Checks module permissions from `@RequirePermission` | `common/guards/permissions.guard.ts` |

## JwtAuthGuard

The `JwtAuthGuard` extends Passport's `AuthGuard('jwt')`. It:

1. Extracts the JWT from the `Authorization: Bearer <token>` header
2. Validates the token signature against `JWT_SECRET`
3. Checks token expiration
4. Populates `req.user` with the decoded `JwtPayload`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### Usage

```typescript
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  @Get()
  findAll(@Request() req: { user: JwtPayload }) {
    // req.user is guaranteed to be populated here
    console.log(req.user.tenantSchema); // "tenant_acme"
    console.log(req.user.sub);          // "user-uuid"
  }
}
```

### Error Response (401)

When authentication fails:

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

## PermissionGuard

The `PermissionGuard` reads metadata set by `@RequirePermission` and checks it against `req.user.permissions`.

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<{
      module: string;
      action: string;
    }>('permission', [context.getHandler(), context.getClass()]);

    if (!requiredPermission) return true; // No permission required

    const { user } = context.switchToHttp().getRequest();

    // Admin bypass — roleLevel >= 100 always passes
    if (user.roleLevel >= 100) return true;

    const modulePerms = user.permissions[requiredPermission.module];
    if (!modulePerms) return false;

    return modulePerms[requiredPermission.action] === true;
  }
}
```

### Error Response (403)

When permission check fails:

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

## @RequirePermission Decorator

Sets metadata that the `PermissionGuard` reads to determine required permissions.

```typescript
import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (module: string, action: string) =>
  SetMetadata('permission', { module, action });
```

### Usage

```typescript
@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LeadsController {
  @Get()
  @RequirePermission('leads', 'view')
  findAll() { /* ... */ }

  @Post()
  @RequirePermission('leads', 'create')
  create() { /* ... */ }

  @Put(':id')
  @RequirePermission('leads', 'edit')
  update() { /* ... */ }

  @Delete(':id')
  @RequirePermission('leads', 'delete')
  remove() { /* ... */ }

  @Get('export')
  @RequirePermission('leads', 'export')
  exportCsv() { /* ... */ }

  @Post('import')
  @RequirePermission('leads', 'import')
  importCsv() { /* ... */ }
}
```

### Available Actions

| Action | Typical Use |
|--------|-------------|
| `view` | `GET` endpoints (list and detail) |
| `create` | `POST` endpoints |
| `edit` | `PUT` / `PATCH` endpoints |
| `delete` | `DELETE` endpoints |
| `export` | Export/download endpoints |
| `import` | Bulk import endpoints |
| `invite` | User invitation (users module only) |

## @AdminOnly Decorator

Shortcut decorator that requires `roleLevel >= 100`:

```typescript
export const AdminOnly = () => SetMetadata('adminOnly', true);
```

The `PermissionGuard` checks for this metadata:

```typescript
// Inside PermissionGuard
const isAdminOnly = this.reflector.getAllAndOverride<boolean>('adminOnly', [
  context.getHandler(),
  context.getClass(),
]);

if (isAdminOnly && user.roleLevel < 100) {
  throw new ForbiddenException('Admin access required');
}
```

### Usage

```typescript
@Put('settings')
@AdminOnly()
async updateSettings(@Request() req: { user: JwtPayload }, @Body() body: any) {
  // Only admins (roleLevel >= 100) can access
}

@Delete('all')
@AdminOnly()
async purgeRecords(@Request() req: { user: JwtPayload }) {
  // Dangerous operation — admin only
}
```

## Guard Execution Order

Guards execute in the order they are listed in `@UseGuards()`:

```typescript
@UseGuards(JwtAuthGuard, PermissionGuard)
//          ▲ First           ▲ Second
```

```
Request → JwtAuthGuard → PermissionGuard → Controller Method
              │                 │
              │ 401 Unauthorized│ 403 Forbidden
              ▼                 ▼
          (rejected)        (rejected)
```

:::danger Always List JwtAuthGuard First
`PermissionGuard` depends on `req.user` being populated by `JwtAuthGuard`. If the order is reversed, the permission guard will fail with a null reference.

```typescript
// CORRECT
@UseGuards(JwtAuthGuard, PermissionGuard)

// WRONG — PermissionGuard cannot read req.user
@UseGuards(PermissionGuard, JwtAuthGuard)
```
:::

## Controller-Level vs Method-Level Guards

Guards can be applied at the controller level (all methods) or method level (specific methods):

```typescript
// Controller-level — applies to ALL methods
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('leads')
export class LeadsController {

  // Method-level permission — varies per endpoint
  @Get()
  @RequirePermission('leads', 'view')
  findAll() { /* ... */ }

  @Post()
  @RequirePermission('leads', 'create')
  create() { /* ... */ }

  // Admin-only settings endpoint
  @Put('settings')
  @AdminOnly()
  updateSettings() { /* ... */ }
}
```

## Custom Guard Patterns

### Creating a Module-Specific Guard

```typescript
@Injectable()
export class LeadOwnerGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    const leadId = request.params.id;

    if (user.roleLevel >= 100) return true; // Admin bypass

    const [lead] = await this.dataSource.query(
      `SELECT created_by, assigned_to FROM "${user.tenantSchema}".leads
       WHERE id = $1 AND deleted_at IS NULL`,
      [leadId],
    );

    if (!lead) throw new NotFoundException('Lead not found');

    return lead.created_by === user.sub || lead.assigned_to === user.sub;
  }
}
```

### Combining Multiple Guards

```typescript
@Put(':id')
@UseGuards(JwtAuthGuard, PermissionGuard, LeadOwnerGuard)
@RequirePermission('leads', 'edit')
async update(@Param('id') id: string, @Body() body: any) {
  // Must pass: JWT valid → has edit permission → is lead owner
}
```

## Public Endpoints (No Guards)

Some endpoints are intentionally unguarded:

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')       // No guard — unauthenticated
  login() { /* ... */ }

  @Post('register')    // No guard — creating new tenant
  register() { /* ... */ }

  @Post('refresh')     // No guard — uses refresh token
  refresh() { /* ... */ }

  @Post('forgot-password')  // No guard — unauthenticated
  forgotPassword() { /* ... */ }
}
```

:::tip
Apply guards at the controller level and omit them only on specific public methods, rather than applying per-method on many endpoints. This prevents accidentally exposing an unguarded endpoint.
:::
