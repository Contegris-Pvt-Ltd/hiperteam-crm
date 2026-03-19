---
sidebar_position: 21
title: "Best Practices"
description: "Code organization, SQL queries, API design, frontend patterns, security, and performance best practices"
---

# Best Practices

This guide consolidates the coding standards and best practices for HiperTeam CRM development.

## Code Organization

### Backend

- **One module per feature** — each module has its own directory under `modules/`
- **Service holds all business logic** — controllers are thin (extract params, call service, return result)
- **formatRow() in every service** — converts snake_case DB columns to camelCase response fields
- **Named routes before :id routes** — NestJS matches in definition order
- **Register every module** in `app.module.ts`

### Frontend

- **One API file per module** — all exports from a single file
- **Feature pages under features/** — mirrors the backend module structure
- **Shared components under components/shared/** — reusable across features
- **Hooks for reusable logic** — `usePermissions`, `useTableColumns`, etc.
- **Zustand for global state** — keep stores small and focused

## SQL Query Best Practices

### Always Parameterize Values

```typescript
// CORRECT
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".leads WHERE email = $1 AND status = $2`,
  [email, status],
);

// WRONG — SQL injection vulnerability
await this.dataSource.query(
  `SELECT * FROM "${schemaName}".leads WHERE email = '${email}'`,
);
```

:::danger
String concatenation in SQL queries is the single most dangerous security vulnerability. Always use `$1, $2, ...` parameterized placeholders for values.
:::

### Always Filter Soft Deletes

```typescript
// Every SELECT must include this
WHERE deleted_at IS NULL
```

### Always Index

```sql
-- Index foreign keys
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON "${schema}".leads(pipeline_id);

-- Index commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_leads_status ON "${schema}".leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON "${schema}".leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON "${schema}".leads(stage_id);

-- Index columns used in WHERE + ORDER BY
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON "${schema}".leads(created_at DESC);
```

### Use COALESCE for Partial Updates

```typescript
await this.dataSource.query(
  `UPDATE "${schemaName}".leads
   SET first_name = COALESCE($1, first_name),
       last_name = COALESCE($2, last_name),
       email = COALESCE($3, email),
       updated_at = NOW()
   WHERE id = $4 AND deleted_at IS NULL
   RETURNING *`,
  [data.firstName, data.lastName, data.email, id],
);
```

### Use RETURNING for Insert/Update

```typescript
// Get the row back without a separate SELECT
const [row] = await this.dataSource.query(
  `INSERT INTO "${schemaName}".leads (first_name, email, created_by)
   VALUES ($1, $2, $3)
   RETURNING *`,
  [firstName, email, userId],
);
```

## API Design Best Practices

### Consistent Pagination

Every list endpoint should return:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

### Standard Query Parameters

| Param | Purpose |
|-------|---------|
| `page` | Page number (1-based) |
| `limit` | Items per page (max 100) |
| `search` | Free-text search |
| `sortBy` | Sort column name |
| `sortDir` | `asc` or `desc` |

### HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Read (list or detail) |
| `POST` | Create new resource |
| `PUT` | Full update |
| `DELETE` | Soft delete |

### Route Naming

```
GET    /leads              → List
POST   /leads              → Create
GET    /leads/:id          → Detail
PUT    /leads/:id          → Update
DELETE /leads/:id          → Soft delete
POST   /leads/:id/convert  → Custom action
GET    /leads/:id/history  → Sub-resource
```

### Error Responses

Always include `errorCode` for machine-readable error handling:

```json
{
  "statusCode": 400,
  "message": "Human-readable message",
  "errorCode": "ICN-1203",
  "details": ["Specific issue 1", "Specific issue 2"]
}
```

## Frontend Best Practices

### Component Patterns

- Always handle **loading**, **error**, and **empty** states
- Always include `dark:` variants for colors
- Use `Loader2` from lucide-react for loading spinners
- Include retry buttons on error states

```tsx
if (loading) return <LoadingSpinner />;
if (error) return <ErrorState message={error} onRetry={refetch} />;
if (data.length === 0) return <EmptyState message="No leads found" />;
```

### State Management

- Use **Zustand** for global state (auth, sidebar)
- Use **useState** for component-local state
- Use **useEffect** for data fetching (or a library like React Query)
- Avoid prop drilling — use context or Zustand for deeply nested data

### API Calls

- Always import `api` from `contacts.api.ts`
- Always handle errors with try/catch
- Always show loading state during async operations
- Debounce search inputs (300-500ms)

```typescript
// Debounced search
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useMemo(
  () => debounce((term: string) => fetchData({ search: term }), 300),
  [],
);

useEffect(() => {
  debouncedSearch(searchTerm);
}, [searchTerm]);
```

## Security Best Practices

### SQL Injection Prevention

- **Always** use parameterized queries (`$1, $2`)
- **Never** concatenate user input into SQL strings
- Schema names from JWT are trusted (server-generated)

### XSS Prevention

- React auto-escapes JSX output
- Never use `dangerouslySetInnerHTML` without sanitization
- Sanitize any user-generated HTML content (e.g., email signatures)

### CSRF Protection

- JWT in `Authorization` header (not cookies) — inherently CSRF-resistant
- No cookies used for auth — no CSRF risk

### Access Control

- Always apply `JwtAuthGuard` and `PermissionGuard` to controllers
- Always use `DataAccessService.buildWhereClause()` for record scoping
- Validate ownership before allowing updates/deletes
- Check field permissions before returning sensitive fields

### Secrets Management

- Never commit `.env` files
- Never log JWT tokens or passwords
- Never include secrets in frontend code
- Use environment variables for all configuration

## Performance Best Practices

### Database

- **Index all FK columns** and commonly filtered columns
- **Use LIMIT/OFFSET** for pagination — never return unbounded result sets
- **Avoid N+1 queries** — use JOINs or batch queries instead of loops
- **Use COUNT in a separate query** for pagination totals (avoids full row scan)
- **EXPLAIN ANALYZE** slow queries to identify missing indexes

```sql
EXPLAIN ANALYZE SELECT * FROM "${schemaName}".leads
WHERE status = 'open' AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 25;
```

### Backend

- **Connection pooling** — TypeORM handles this; tune `DB_POOL_SIZE` based on load
- **Async/await everywhere** — never block the event loop
- **Bull queues for heavy operations** — imports, exports, email batches
- **Limit pagination** — cap `limit` at 100 to prevent large result sets

### Frontend

- **Lazy load routes** — use `React.lazy()` for route-level code splitting
- **Debounce search** — avoid firing API calls on every keystroke
- **Memoize expensive computations** — use `useMemo` and `useCallback`
- **Virtualize long lists** — use react-window for lists with 100+ items
- **Optimize images** — compress avatars and document thumbnails

## Testing Recommendations

### Backend

- Unit test services with mocked `DataSource`
- Integration test controllers with supertest
- Test migrations against a fresh schema
- Test RBAC by simulating different role levels

### Frontend

- Component tests with React Testing Library
- Test permission-based UI rendering
- Test error states and loading states
- E2E tests with Cypress or Playwright for critical flows

## Code Review Checklist

- [ ] Schema name comes from JWT (`req.user.tenantSchema`)
- [ ] All SQL queries use parameterized values (`$1, $2`)
- [ ] All SELECT queries include `WHERE deleted_at IS NULL`
- [ ] `auditService.log()` called after every mutation
- [ ] Named routes defined before `:id` routes
- [ ] New module registered in `app.module.ts`
- [ ] `formatRow()` converts snake_case to camelCase
- [ ] Pagination follows standard `{ data, meta }` format
- [ ] Frontend handles loading, error, and empty states
- [ ] Dark mode variants included for all color classes
- [ ] No hardcoded schema names or tenant IDs
- [ ] No string concatenation in SQL queries

## Git Workflow

- **Feature branches** from `main`
- **One PR per feature/fix** — keep PRs focused and reviewable
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Never force-push to main**
- **Run type-check before committing**: `npx tsc --noEmit`

:::tip Session Workflow
Follow the layer-by-layer approach:
1. Database migration
2. Backend service
3. Backend controller
4. Frontend API file
5. Frontend UI

Never mix layers in a single session. This keeps changes focused and reviewable.
:::
