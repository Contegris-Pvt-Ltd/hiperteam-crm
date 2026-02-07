import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ContactsPage, ContactDetailPage, ContactEditPage } from './features/contacts';
import { AccountsPage, AccountDetailPage, AccountEditPage } from './features/accounts';

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
          <Route path="users" element={<PlaceholderPage title="Users" />} />
          <Route path="settings" element={<PlaceholderPage title="Settings" />} />
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