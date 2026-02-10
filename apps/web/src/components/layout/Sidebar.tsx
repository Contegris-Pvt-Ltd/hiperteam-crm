import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { useSidebarStore } from '../../stores/sidebar.store';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Target,
  CheckSquare,
  Settings,
  Building2,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Opportunities', href: '/opportunities', icon: TrendingUp },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: Target },
  { name: 'Settings', href: '/admin', icon: Settings },
];

export function Sidebar() {
  const { user, tenant } = useAuthStore();
  const { isCollapsed, isMobileOpen, toggle, setMobileOpen } = useSidebarStore();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`h-16 flex items-center gap-3 px-4 border-b border-slate-700/50 dark:border-slate-700 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-white leading-tight">HiperTeam</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">CRM Platform</p>
          </div>
        )}
      </div>

      {/* Tenant Badge */}
      {!isCollapsed && (
        <div className="px-3 py-3">
          <div className="bg-slate-800/50 dark:bg-slate-800 backdrop-blur rounded-xl px-3 py-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Workspace</p>
            <p className="text-sm font-semibold text-white truncate mt-0.5">{tenant?.name}</p>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {!isCollapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Main Menu
          </p>
        )}
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {!isCollapsed && <span>{item.name}</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          );
        })}

        {isAdmin && (
          <>
            {!isCollapsed && (
              <p className="px-3 mt-6 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Administration
              </p>
            )}
            {isCollapsed && <div className="my-4 border-t border-slate-700/50" />}
            {adminNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  {!isCollapsed && <span>{item.name}</span>}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* Collapse Toggle - Desktop Only */}
      <div className="hidden lg:block p-3 border-t border-slate-700/50">
        <button
          onClick={toggle}
          className={`flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all ${isCollapsed ? 'justify-center' : ''}`}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 dark:bg-slate-950 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 dark:bg-slate-950 transition-all duration-300 ease-in-out sticky top-0 h-screen ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}