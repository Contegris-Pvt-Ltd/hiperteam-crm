import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContactsPage, ContactDetailPage, ContactEditPage } from './features/contacts';
import { AccountsPage, AccountDetailPage, AccountEditPage } from './features/accounts';
import { ProductsPage, ProductDetailPage, ProductEditPage, PriceBooksPage } from './features/products';
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
import { LeadsPage, LeadDetailPage, LeadEditPage } from './features/leads';
import { LeadSettingsPage } from './features/admin/LeadSettingsPage';
import { OpportunitiesPage } from './features/opportunities/OpportunitiesPage';
import { OpportunityDetailPage } from './features/opportunities/OpportunityDetailPage';
import { OpportunityEditPage } from './features/opportunities/OpportunityEditPage';
import { OpportunitySettingsPage } from './features/admin/OpportunitySettingsPage';
import { FieldValidationPage } from './features/admin/FieldValidationPage';
import { TasksPage } from './features/tasks/TasksPage';
import { TaskDetailPage } from './features/tasks/TaskDetailPage';
import { TaskSettingsPage } from './features/admin/TaskSettingsPage';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { NotificationPreferencesPage } from './features/settings/NotificationPreferencesPage';
import { TargetsSettingsPage } from './features/admin/TargetsSettingsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ReportViewerPage } from './features/reports/ReportViewerPage';
import { ReportBuilderPage } from './features/reports/ReportBuilderPage';
import { AccountForecastPage } from './features/reports/AccountForecastPage';
import { BatchJobsPage } from './features/batch-jobs/BatchJobsPage';
import { ApprovalRulesPage } from './features/admin/ApprovalRulesPage';
import { GeneralSettingsPage } from './features/admin/GeneralSettingsPage';
import { IntegrationsPage } from './features/admin/IntegrationsPage';
import { XeroContactMatchingPage } from './features/admin/XeroContactMatchingPage';
import { ApprovalsQueuePage } from './features/approvals/ApprovalsQueuePage';
import { ProposalPublicPage } from './features/proposals/ProposalPublicPage';
import { ContractSignPage } from './features/contracts/ContractSignPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { XeroCallbackPage } from './features/admin/XeroCallbackPage';
import ProjectSettingsPage from './features/admin/ProjectSettingsPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage';
import { ClientPortalPage } from './features/projects/ClientPortalPage';
import { FormsPage, FormBuilderPage, FormSubmissionsPage, FormPublicPage } from './features/forms';
import { InboxPage, EmailSettingsPage, InboxRulesPage } from './features/email';

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
        <Route path="/proposals/public/:tenantId/:token" element={<ProposalPublicPage />} />
        <Route path="/contracts/sign/:token" element={<ContractSignPage />} />
        <Route path="/portal/:tenantSlug/:token" element={<ClientPortalPage />} />
        <Route path="/f/:tenantSlug/:token" element={<FormPublicPage />} />

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
          
          {/* Leads */}
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/new" element={<LeadEditPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/leads/:id/edit" element={<LeadEditPage />} />

          {/* Opportunities */}
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/opportunities/new" element={<OpportunityEditPage />} />
          <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
          <Route path="/opportunities/:id/edit" element={<OpportunityEditPage />} />

          {/* Products */}
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductEditPage />} />
          <Route path="products/price-books" element={<PriceBooksPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="products/:id/edit" element={<ProductEditPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />

          {/* Forms */}
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/forms/:id/builder" element={<FormBuilderPage />} />
          <Route path="/forms/:id/submissions" element={<FormSubmissionsPage />} />

          {/* Email Inbox */}
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/rules" element={<InboxRulesPage />} />
          <Route path="/settings/email" element={<EmailSettingsPage />} />

          {/* Reports */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/new" element={<ReportBuilderPage />} />
          <Route path="reports/:id" element={<ReportViewerPage />} />
          <Route path="reports/:id/edit" element={<ReportBuilderPage />} />
          <Route path="reports/account-forecast" element={<AccountForecastPage />} />

          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="users/:id/edit" element={<UserEditPage />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="approvals" element={<ApprovalsQueuePage />} />
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
          <Route path="lead-settings" element={<LeadSettingsPage />} />
          <Route path="opportunity-settings" element={<OpportunitySettingsPage />} />
          <Route path="field-validation" element={<FieldValidationPage />} />
          <Route path="task-settings" element={<TaskSettingsPage />} />
          <Route path="project-settings" element={<ProjectSettingsPage />} />
          <Route path="notification-settings" element={<NotificationPreferencesPage />} />
          <Route path="targets" element={<TargetsSettingsPage />} />
          <Route path="batch-jobs" element={<BatchJobsPage />} />
          <Route path="approval-rules" element={<ApprovalRulesPage />} />
          <Route path="general-settings" element={<GeneralSettingsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="xero-matching" element={<XeroContactMatchingPage />} />
          <Route path="xero/callback" element={<XeroCallbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;