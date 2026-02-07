import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Target,
  CheckSquare,
  Settings,
  Building2,
  TrendingUp,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Opportunities', href: '/opportunities', icon: TrendingUp },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: Target },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { user, tenant, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-700">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-white leading-tight">HiperTeam</h1>
          <p className="text-xs text-slate-400">CRM Platform</p>
        </div>
      </div>

      {/* Tenant Badge */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="bg-slate-800 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-400">Workspace</p>
          <p className="text-sm font-medium text-white truncate">{tenant?.name}</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Main Menu
        </p>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span>{item.name}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 mt-6 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Administration
            </p>
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}