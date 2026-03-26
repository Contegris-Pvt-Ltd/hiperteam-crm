import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SharedDashboardPage } from './features/dashboard/SharedDashboardPage';
import { ContactsPage, ContactDetailPage, ContactEditPage } from './features/contacts';
import { AccountsPage, AccountDetailPage, AccountEditPage } from './features/accounts';
import { AccountImportPage } from './features/accounts/AccountImportPage';
import { ProductsPage, ProductDetailPage, ProductEditPage, PriceBooksPage } from './features/products';
import { AdminLayout } from './features/admin/AdminLayout';
import { ProfileCompletionPage } from './features/admin/ProfileCompletionPage';
import { PageDesignerPage } from './features/admin/PageDesignerPage';
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
import { FormBuilderPage, FormSubmissionsPage, FormPublicPage, LandingPagePublicPage, EngagementHubPage } from './features/forms';
import { PublicBookingPage } from './features/scheduling/PublicBookingPage';
import { BookingCancelPage } from './features/scheduling/BookingCancelPage';
import { InboxPage, EmailSettingsPage, InboxRulesPage } from './features/email';
import { WorkflowListPage } from './features/workflows/WorkflowListPage';
import { WorkflowBuilderPage } from './features/workflows/WorkflowBuilderPage';
import { WorkflowRunsPage } from './features/workflows/WorkflowRunsPage';
import { ApiKeysPage } from './features/admin/ApiKeysPage';
import { FormFieldOrderPage } from './features/admin/FormFieldOrderPage';
import CustomerSuccessSettingsPage from './features/admin/CustomerSuccessSettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function ProfileRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={`/users/${user.id}`} replace />;
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
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#f1f5f9', borderRadius: '12px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#f1f5f9' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
        }}
      />
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
        <Route path="/lp/:tenantSlug/:token" element={<LandingPagePublicPage />} />
        <Route path="/book/:tenantSlug/:token" element={<PublicBookingPage />} />
        <Route path="/book/cancel/:cancelToken" element={<BookingCancelPage />} />
        <Route path="/shared/dashboard/:tenantSlug/:token" element={<SharedDashboardPage />} />

        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          
          {/* Contacts */}
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/new" element={<ContactEditPage />} />
          <Route path="contacts/:id" element={<ContactDetailPage />} />
          <Route path="contacts/:id/edit" element={<ContactEditPage />} />
          
          {/* Accounts */}
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/import" element={<AccountImportPage />} />
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

          {/* Engagement Hub */}
          <Route path="/engagement/forms" element={<EngagementHubPage />} />
          <Route path="/engagement/scheduling" element={<EngagementHubPage />} />
          <Route path="/forms" element={<Navigate to="/engagement/forms" replace />} />
          <Route path="/forms/:id/builder" element={<FormBuilderPage />} />
          <Route path="/forms/:id/submissions" element={<FormSubmissionsPage />} />

          {/* Workflows */}
          <Route path="/workflows" element={<WorkflowListPage />} />
          <Route path="/workflows/new" element={<WorkflowBuilderPage />} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilderPage />} />
          <Route path="/workflows/:id/runs" element={<WorkflowRunsPage />} />

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
          <Route path="profile" element={<ProfileRedirect />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="approvals" element={<ApprovalsQueuePage />} />
        </Route>

        {/* Admin Routes - Outside main layout */}
        <Route path="/admin" element={<PrivateRoute><AdminLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/admin/general-settings" replace />} />
          <Route path="custom-fields" element={<Navigate to="/admin/form-builder" replace />} />
          <Route path="profile-completion" element={<ProfileCompletionPage />} />
          <Route path="layout-designer" element={<PageDesignerPage />} />
          <Route path="page-designer" element={<Navigate to="/admin/layout-designer" replace />} />
          <Route path="module-layout-settings" element={<Navigate to="/admin/layout-designer" replace />} />
          <Route path="layout-builder" element={<Navigate to="/admin/form-builder" replace />} />
          <Route path="form-designer" element={<Navigate to="/admin/form-builder" replace />} />
          <Route path="form-field-order" element={<Navigate to="/admin/form-builder" replace />} />
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
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="form-builder" element={<FormFieldOrderPage />} />
          <Route path="xero-matching" element={<XeroContactMatchingPage />} />
          <Route path="xero/callback" element={<XeroCallbackPage />} />
          <Route path="cs-settings" element={<CustomerSuccessSettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;