import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Settings, BarChart3, Users, Building2, Shield, ShieldCheck,
  Target, Briefcase, ArrowLeft, LayoutTemplate, ClipboardList,
  CheckSquare, Bell, Award, FileSpreadsheet, Plug, FolderKanban, Key, ArrowUpDown,
  Heart, Menu, X,
} from 'lucide-react';

const adminNavItems = [
  {
    label: 'General Settings',
    path: '/admin/general-settings',
    icon: Building2,
    description: 'Company profile, industries & picklists',
  },
  {
    label: 'Profile Completion',
    path: '/admin/profile-completion',
    icon: BarChart3,
    description: 'Configure profile completion weights'
  },
  {
    label: 'Form Builder',
    path: '/admin/form-builder',
    icon: ArrowUpDown,
    description: 'Organize fields, ordering & custom fields',
  },
  {
    label: 'Layout Designer',
    path: '/admin/layout-designer',
    icon: LayoutTemplate,
    description: 'Design custom page layouts',
  },
  {
    label: 'Org Chart',
    path: '/org-chart',
    icon: Building2,
    description: ''
  },
  {
    label: 'Audit Logs',
    path: '/admin/audit-logs',
    icon: ClipboardList,
    description: 'View system audit trail'
  },
  {
     label: 'Field Validation',
     path: '/admin/field-validation',
     icon: Shield,
     description: 'Required fields for each module'
   },
  {
    label: 'Lead Settings',
    path: '/admin/lead-settings',
    icon: Target,
    description: 'Stages, scoring, routing & more'
  },
  {
    path: '/admin/opportunity-settings',
    label: 'Opportunity Settings',
    icon: Briefcase,
    description: 'Stages, scoring, routing & more'
  },
  {
    label: 'Targets & Goals',
    path: '/admin/targets',
    icon: Award,
    description: 'Targets, badges & gamification'
  },
  {
    path: '/admin/task-settings',
    label: 'Task Settings',
    icon: CheckSquare,
    description: 'Types, statuses & priorities'
  },
  {
    path: '/admin/project-settings',
    label: 'Project Settings',
    icon: FolderKanban,
    description: 'Statuses, task statuses & templates'
  },
  {
    path: '/admin/notification-settings',
    label: 'Notification Settings',
    icon: Bell,
    description: 'Channels, templates & preferences'
  },
  {
    path: '/admin/batch-jobs',
    label: 'Batch Jobs',
    icon: FileSpreadsheet,
    description: 'View import & export job history'
  },
  {
    path: '/admin/approval-rules',
    label: 'Approval Rules',
    icon: ShieldCheck,
    description: 'Multi-step approval workflows'
  },
  {
    path: '/admin/integrations',
    label: 'Integrations',
    icon: Plug,
    description: 'Connect third-party services'
  },
  {
    path: '/admin/api-keys',
    label: 'API Keys',
    icon: Key,
    description: 'Manage API keys for integrations'
  },
  {
    path: '/admin/cs-settings',
    label: 'Customer Success',
    icon: Heart,
    description: 'Health scores, recommendations & renewals'
  },
];

const moduleIcons: Record<string, typeof Users> = {
  contacts: Users,
  accounts: Building2,
  leads: Target,
  opportunities: Briefcase,
};

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentItem = adminNavItems.find(item => location.pathname.startsWith(item.path));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16 gap-3 sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center w-9 h-9 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>

            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                  {currentItem ? currentItem.label : 'Admin Settings'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 hidden sm:block">Configure your CRM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 shadow-xl overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    {item.description && (
                      <div className="text-xs opacity-70 truncate">{item.description}</div>
                    )}
                  </div>
                </NavLink>
              ))}
            </nav>
            <div className="px-3 pb-4">
              <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Modules
              </h3>
              <div className="space-y-1">
                {Object.entries(moduleIcons).map(([module, Icon]) => (
                  <NavLink
                    key={module}
                    to={`/admin/form-builder?module=${module}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{module}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Navigation */}
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <nav className="space-y-1">
                {adminNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  </NavLink>
                ))}
              </nav>

              {/* Module Quick Links */}
              <div className="mt-8">
                <h3 className="px-4 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Modules
                </h3>
                <div className="space-y-1">
                  {Object.entries(moduleIcons).map(([module, Icon]) => (
                    <NavLink
                      key={module}
                      to={`/admin/form-builder?module=${module}`}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="capitalize">{module}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export { moduleIcons };
