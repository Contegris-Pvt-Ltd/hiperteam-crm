---
sidebar_position: 7
title: "Authentication & JWT"
description: "JWT authentication flow, token management, registration, invitation, and password reset flows"
---

# Authentication & JWT

Intellicon CRM uses stateless JWT authentication. The JWT token embeds the complete RBAC payload, eliminating per-request permission lookups.

## Authentication Flow Overview

```
┌──────────┐    POST /auth/login     ┌──────────┐    Validate    ┌──────────┐
│  Client   │──────────────────────▶│  AuthCtrl  │──────────────▶│  AuthSvc  │
│  (React)  │                        │            │               │           │
│           │◀──────────────────────│            │◀──────────────│           │
│           │  { accessToken,        │            │  Generate JWT  │           │
│           │    refreshToken,       └──────────┘  with full RBAC └──────────┘
│           │    user }
│           │
│           │    GET /leads (Bearer token)
│           │──────────────────────▶ JwtAuthGuard → PermissionGuard → Controller
└──────────┘
```

## Token Structure

### JwtPayload

Every JWT access token contains:

```typescript
interface JwtPayload {
  sub: string;              // User ID (UUID)
  tenantSchema: string;     // "tenant_acme"
  tenantSlug: string;       // "acme"
  role: string;             // "admin" | "manager" | "user" | custom
  roleLevel: number;        // 100 = admin, 50 = manager, 10 = user
  permissions: ModulePermissions;    // Module-level permissions
  recordAccess: RecordAccess;        // Record-level scoping
  fieldPermissions: FieldPermissions; // Field-level visibility
  departmentId?: string;    // User's department
  teamIds?: string[];       // User's team memberships
  managerId?: string;       // User's direct manager
  iat: number;              // Issued at (Unix timestamp)
  exp: number;              // Expiration (Unix timestamp)
}
```

### Token Lifetimes

| Token | Default Duration | Purpose |
|-------|-----------------|---------|
| **Access Token** | 1 hour | API authentication, carries full RBAC payload |
| **Refresh Token** | 7 days | Used to obtain new access tokens without re-login |

:::note Why embed RBAC in JWT?
Embedding permissions in the JWT eliminates database lookups on every request. The trade-off is larger token size, but this is acceptable for the O(1) authorization performance gain.
:::

## Login Flow

```
POST /auth/login
Body: { tenantSlug, email, password }
```

1. Look up tenant by slug in `public.tenants`
2. Find user by email in `"tenant_{slug}".users`
3. Verify password hash (bcrypt)
4. Load user's role and permissions from `"tenant_{slug}".roles`
5. Generate access token (1h) and refresh token (7d)
6. Return tokens + user info

```typescript
// Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "roleLevel": 100,
    "avatar": "/uploads/avatars/uuid.jpg"
  }
}
```

## Token Refresh Flow

```
POST /auth/refresh
Body: { refreshToken }
```

1. Validate refresh token signature and expiry
2. Extract user ID and tenant from token
3. Load current user data and permissions (picks up any role changes)
4. Generate new access token and refresh token
5. Return new token pair

:::tip Token Rotation
Each refresh generates a new refresh token (token rotation). The old refresh token is invalidated, limiting the window of exploitation if a token is compromised.
:::

## Registration Flow

```
POST /auth/register
Body: { email, password, companyName, firstName, lastName }
```

1. Validate input (email uniqueness, password strength)
2. Generate tenant slug from company name
3. Create tenant record in `public.tenants`
4. Call `TenantSchemaService.createSchema(slug)`:
   - `CREATE SCHEMA "tenant_{slug}"`
   - Run all migrations
   - Seed default roles (Admin, Manager, User)
   - Seed default pipeline and stages
5. Create admin user in the new tenant schema
6. Generate tokens and return

## Invitation Flow

```
POST /users/invite → email sent → GET /auth/invite/validate → POST /auth/invite/accept
```

### Step 1: Admin Invites User

```typescript
POST /users/invite
Body: { email, roleId, teamIds?: string[] }
// Generates invite token, stores in user_invitations table
// Sends email with link: {FRONTEND_URL}/invite?token={token}
```

### Step 2: User Clicks Email Link

```typescript
GET /auth/invite/validate?token={token}
// Validates token is not expired or used
// Returns: { email, tenantName, invitedBy }
```

### Step 3: User Accepts Invitation

```typescript
POST /auth/invite/accept
Body: { token, password, firstName, lastName }
// Creates user account in tenant schema
// Assigns role from invitation
// Adds to specified teams
// Returns tokens + user info
```

## Password Reset Flow

```
POST /auth/forgot-password → email sent → validate token → POST /auth/reset-password
```

### Step 1: Request Reset

```typescript
POST /auth/forgot-password
Body: { email, tenantSlug }
// Generates reset token (expires in 1 hour)
// Sends email with link: {FRONTEND_URL}/reset-password?token={token}
```

### Step 2: Validate Token

```typescript
GET /auth/reset-password/validate?token={token}
// Checks token validity and expiry
// Returns: { valid: true, email }
```

### Step 3: Reset Password

```typescript
POST /auth/reset-password
Body: { token, newPassword }
// Validates token, hashes new password, updates user record
// Invalidates all existing refresh tokens for security
```

## Change Password (Authenticated)

```typescript
POST /auth/change-password
Headers: Authorization: Bearer {accessToken}
Body: { currentPassword, newPassword }
// Validates current password, updates to new password
```

## Auth Strategies

### JWT Strategy (`jwt.strategy.ts`)

Extracts and validates the JWT from the `Authorization: Bearer` header. Populates `req.user` with the decoded `JwtPayload`.

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return payload; // Populates req.user
  }
}
```

### Local Strategy (`local.strategy.ts`)

Used for the login endpoint. Validates email/password credentials.

## Securing Endpoints

Apply `JwtAuthGuard` to require authentication:

```typescript
@UseGuards(JwtAuthGuard)
@Controller('my-module')
export class MyController {
  @Get()
  findAll(@Request() req: { user: JwtPayload }) {
    // req.user is guaranteed to be populated
    return this.service.findAll(req.user.tenantSchema);
  }
}
```

Combine with `PermissionGuard` for RBAC:

```typescript
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('my-module')
export class MyController {
  @Get()
  @RequirePermission('my_module', 'view')
  findAll(@Request() req: { user: JwtPayload }) {
    // Only users with 'view' permission on 'my_module' can access
  }
}
```

:::warning Guard Order
Always apply `JwtAuthGuard` before `PermissionGuard`. The permission guard depends on `req.user` being populated by the JWT guard.
:::

## Frontend Token Management

The frontend stores tokens in the Zustand auth store and attaches them via an axios interceptor:

```typescript
// api/contacts.api.ts — axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      // If refresh fails, redirect to login
    }
    return Promise.reject(error);
  }
);
```
