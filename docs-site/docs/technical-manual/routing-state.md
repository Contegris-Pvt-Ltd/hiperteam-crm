---
sidebar_position: 15
title: "Routing & State Management"
description: "React Router route structure, Zustand stores, permission hooks, and navigation patterns"
---

# Routing & State Management

## Route Structure

All routes are defined in `apps/web/src/App.tsx`. The application uses React Router with three route groups: public, authenticated (MainLayout), and admin.

### Public Routes (Unauthenticated)

```tsx
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
<Route path="/invite" element={<InviteAcceptPage />} />
```

### Authenticated Routes (MainLayout)

```tsx
<Route element={<MainLayout />}>
  {/* Dashboard */}
  <Route path="/" element={<DashboardPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />

  {/* CRM Modules */}
  <Route path="/contacts" element={<ContactsPage />} />
  <Route path="/contacts/:id" element={<ContactDetailPage />} />
  <Route path="/accounts" element={<AccountsPage />} />
  <Route path="/accounts/:id" element={<AccountDetailPage />} />
  <Route path="/leads" element={<LeadsPage />} />
  <Route path="/leads/:id" element={<LeadDetailPage />} />
  <Route path="/opportunities" element={<OpportunitiesPage />} />
  <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
  <Route path="/tasks" element={<TasksPage />} />
  <Route path="/tasks/:id" element={<TaskDetailPage />} />
  <Route path="/products" element={<ProductsPage />} />
  <Route path="/products/:id" element={<ProductDetailPage />} />

  {/* Analytics */}
  <Route path="/reports" element={<ReportsPage />} />
  <Route path="/reports/:id" element={<ReportDetailPage />} />
  <Route path="/targets" element={<TargetsPage />} />

  {/* Organization */}
  <Route path="/users" element={<UsersPage />} />
  <Route path="/users/:id" element={<UserDetailPage />} />
  <Route path="/teams" element={<TeamsPage />} />
  <Route path="/departments" element={<DepartmentsPage />} />
  <Route path="/roles" element={<RolesPage />} />
  <Route path="/notifications" element={<NotificationsPage />} />

  {/* Admin Settings */}
  <Route path="/admin" element={<AdminLayout />}>
    <Route path="custom-fields" element={<CustomFieldsPage />} />
    <Route path="field-validation" element={<FieldValidationPage />} />
    <Route path="lead-settings" element={<LeadSettingsPage />} />
    <Route path="opportunity-settings" element={<OpportunitySettingsPage />} />
    <Route path="task-settings" element={<TaskSettingsPage />} />
    <Route path="page-designer" element={<PageDesignerPage />} />
    <Route path="notification-settings" element={<NotificationPreferencesPage />} />
    <Route path="targets" element={<TargetsSettingsPage />} />
    <Route path="batch-jobs" element={<BatchJobsPage />} />
    <Route path="audit-log" element={<AuditLogViewer />} />
  </Route>
</Route>
```

## Zustand Stores

### auth.store.ts

The primary store holding authentication state, user info, and permissions.

```typescript
interface AuthState {
  // User data
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    roleLevel: number;
    avatar?: string;
  } | null;

  // Tenant data
  tenant: {
    id: string;
    slug: string;
    companyName: string;
  } | null;

  // Tokens
  accessToken: string | null;
  refreshToken: string | null;

  // Permissions (from JWT)
  permissions: ModulePermissions | null;
  recordAccess: RecordAccess | null;
  fieldPermissions: FieldPermissions | null;

  // Actions
  setAuth: (data: LoginResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
}
```

### sidebar.store.ts

Controls sidebar visibility state.

```typescript
interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  setMobileOpen: (open: boolean) => void;
}
```

## Hooks

### usePermissions

The primary hook for checking module permissions in components.

```typescript
function usePermissions(module?: string) {
  const permissions = useAuthStore((s) => s.permissions);
  const fieldPerms = useAuthStore((s) => s.fieldPermissions);
  const roleLevel = useAuthStore((s) => s.user?.roleLevel);

  const isAdmin = (roleLevel || 0) >= 100;

  if (!module) {
    return { isAdmin, permissions, fieldPermissions: fieldPerms };
  }

  const modulePerms = permissions?.[module];

  return {
    isAdmin,
    canView: isAdmin || modulePerms?.view || false,
    canCreate: isAdmin || modulePerms?.create || false,
    canEdit: isAdmin || modulePerms?.edit || false,
    canDelete: isAdmin || modulePerms?.delete || false,
    canExport: isAdmin || modulePerms?.export || false,
    canImport: isAdmin || modulePerms?.import || false,
    fieldPermissions: fieldPerms?.[module] || {},
  };
}
```

#### Usage

```tsx
function LeadsPage() {
  const { canCreate, canDelete, canExport } = usePermissions('leads');

  return (
    <div>
      <div className="flex gap-2">
        {canCreate && (
          <button className="bg-purple-600 text-white px-4 py-2 rounded-xl">
            New Lead
          </button>
        )}
        {canExport && (
          <button className="bg-gray-100 dark:bg-slate-700 px-4 py-2 rounded-xl">
            Export
          </button>
        )}
      </div>

      <DataTable
        actions={(row) => (
          <>
            <button>View</button>
            {canDelete && <button className="text-red-600">Delete</button>}
          </>
        )}
      />
    </div>
  );
}
```

### useTableColumns

Returns configured columns for a module's data table.

```typescript
function useTableColumns(module: string) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tableApi.getColumns(module).then(setColumns).finally(() => setLoading(false));
  }, [module]);

  return { columns, loading };
}
```

### useTablePreferences

Manages user-specific column preferences (visibility, widths, sort order).

```typescript
function useTablePreferences(module: string) {
  const [preferences, setPreferences] = useState<TablePreference | null>(null);

  // Load preferences on mount
  // Save preferences on change

  return {
    preferences,
    updateColumnVisibility,
    updateColumnWidth,
    updateSortOrder,
    resetToDefault,
  };
}
```

### useModuleLayout

Loads the page layout configuration for a module (used with the Page Designer).

```typescript
function useModuleLayout(module: string, layoutType: string) {
  const [layout, setLayout] = useState<PageLayout | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetches layout from pageLayoutApi

  return { layout, loading };
}
```

## Route Protection

### Authenticated Route Guard

The `MainLayout` component checks authentication before rendering:

```tsx
function MainLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

### Admin Route Guard

The `AdminLayout` checks for admin role:

```tsx
function AdminLayout() {
  const isAdmin = useAuthStore((s) => (s.user?.roleLevel || 0) >= 100);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have admin access.</p>
      </div>
    );
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
```

### Permission-Based Route Guard

For modules that require specific permissions:

```tsx
function ProtectedRoute({ module, children }: { module: string; children: ReactNode }) {
  const { canView } = usePermissions(module);

  if (!canView) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You do not have permission to view this module.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Usage in App.tsx
<Route path="/leads" element={
  <ProtectedRoute module="leads">
    <LeadsPage />
  </ProtectedRoute>
} />
```

## Navigation Flow

```
Login → Set auth store → Navigate to /dashboard
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   MainLayout            AdminLayout           Logout
   (Sidebar +            (Admin nav +          (Clear store →
    content)              settings)             /login)
```

### Sidebar Navigation

The sidebar (`components/layout/Sidebar.tsx`) renders navigation links based on the user's permissions:

```tsx
const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, module: null },
  { label: 'Contacts', path: '/contacts', icon: Users, module: 'contacts' },
  { label: 'Accounts', path: '/accounts', icon: Building, module: 'accounts' },
  { label: 'Leads', path: '/leads', icon: Target, module: 'leads' },
  { label: 'Opportunities', path: '/opportunities', icon: TrendingUp, module: 'opportunities' },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare, module: 'tasks' },
  { label: 'Products', path: '/products', icon: Package, module: 'products' },
  { label: 'Reports', path: '/reports', icon: BarChart, module: 'reports' },
];

// Filter based on permissions
const visibleItems = navItems.filter(item =>
  !item.module || permissions?.[item.module]?.view || isAdmin
);
```

:::tip Adding New Routes
When adding a new module:
1. Add the route to `App.tsx` inside `MainLayout`
2. Add the navigation item to `Sidebar.tsx`
3. Add admin settings route under the `/admin` group if needed
4. Add to `AdminLayout.tsx` sidebar items
:::
