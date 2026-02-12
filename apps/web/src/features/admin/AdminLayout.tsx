import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Settings, ListPlus, BarChart3, Users, Building2, 
  Target, Briefcase, LayoutGrid, ArrowLeft, LayoutTemplate, ClipboardList
} from 'lucide-react';

const adminNavItems = [
  { 
    label: 'Custom Fields', 
    path: '/admin/custom-fields',
    icon: ListPlus,
    description: 'Manage custom fields for all modules'
  },
  { 
    label: 'Profile Completion', 
    path: '/admin/profile-completion',
    icon: BarChart3,
    description: 'Configure profile completion weights'
  },
  /*{ 
    label: 'Form Layout', 
    path: '/admin/form-layout',
    icon: LayoutGrid,
    description: 'Organize fields into tabs and groups'
  },*/
  { 
    label: 'Layout Builder', 
    path: '/admin/layout-builder', 
    icon: LayoutGrid,
    description: 'Organize fields into tabs and groups'
  },
  { 
    label: 'Form Designer', 
    path: '/admin/form-designer', 
    icon: LayoutGrid, 
    description: "Design and organize your own custom fields into tabs and groups" 
  },
  { 
    label: 'Page Designer', 
    path: '/admin/page-designer', 
    icon: LayoutTemplate,
    description: 'Design custom page layouts'
  },
  { 
    label: 'Module Layouts', 
    path: '/admin/module-layout-settings', 
    icon: LayoutTemplate,
    description: 'Choose your Layouts'
  },
  {
    label: 'Org Chart',
    path: '/org-chart',
    icon: Building2,        // or use GitBranch / Network from lucide-react
    description: ''
  },
  {
    label: 'Audit Logs',
    path: '/admin/audit-logs',
    icon: ClipboardList,
    description: 'View system audit trail'
  }
];

const moduleIcons: Record<string, typeof Users> = {
  contacts: Users,
  accounts: Building2,
  leads: Target,
  opportunities: Briefcase,
};

export function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>

            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">Configure your CRM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
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
                    to={`/admin/custom-fields?module=${module}`}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{module}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Full Width */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export { moduleIcons };