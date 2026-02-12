import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContactsPage, ContactDetailPage, ContactEditPage } from './features/contacts';
import { AccountsPage, AccountDetailPage, AccountEditPage } from './features/accounts';
import { AdminLayout } from './features/admin/AdminLayout';
import { CustomFieldsPage } from './features/admin/CustomFieldsPage';
import { ProfileCompletionPage } from './features/admin/ProfileCompletionPage';
import { FormLayoutPage } from './features/admin/FormLayoutPage';
import { LayoutBuilderPage } from './features/admin/LayoutBuilderPage';
import { FormDesignerPage } from './features/admin/FormDesignerPage';
import { PageDesignerPage } from './features/admin/PageDesignerPage';
import { ModuleLayoutSettingsPage } from './features/admin/ModuleLayoutSettingsPage';
import { UsersPage, UserDetailPage, UserEditPage } from './features/users';
import { DepartmentsPage } from './features/departments';
import { TeamsPage } from './features/teams';
import { RolesPage } from './features/roles';
import { InviteAcceptPage } from './features/auth/InviteAcceptPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { AuditLogViewer } from './components/shared/AuditLogViewer';
import { OrgChartPage } from './features/users/OrgChartPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
        <Route path="invite/accept" element={<InviteAcceptPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          
          {/* Contacts */}
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/new" element={<ContactEditPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="contacts/:id/edit" element={<ContactEditPage />} />
          
          {/* Accounts */}
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/new" element={<AccountEditPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="accounts/:id/edit" element={<AccountEditPage />} />
          
          {/* Placeholder routes */}
          <Route path="leads" element={<PlaceholderPage title="Leads" />} />
          <Route path="opportunities" element={<PlaceholderPage title="Opportunities" />} />
          <Route path="tasks" element={<PlaceholderPage title="Tasks" />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="users/:id/edit" element={<UserEditPage />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="roles" element={<RolesPage />} />
        </Route>

        {/* Admin Routes - Outside main layout */}
        <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/admin/custom-fields" replace />} />
          <Route path="custom-fields" element={<CustomFieldsPage />} />
          <Route path="profile-completion" element={<ProfileCompletionPage />} />
          <Route path="form-layout" element={<FormLayoutPage />} />
          <Route path="layout-builder" element={<LayoutBuilderPage />} />
          <Route path="form-designer" element={<FormDesignerPage />} />
          <Route path="page-designer" element={<PageDesignerPage />} />
          <Route path="module-layout-settings" element={<ModuleLayoutSettingsPage />} />
          <Route path="audit-logs" element={<AuditLogViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
        <p className="text-gray-500 dark:text-slate-400">Coming soon...</p>
      </div>
    </div>
  );
}

export default App;