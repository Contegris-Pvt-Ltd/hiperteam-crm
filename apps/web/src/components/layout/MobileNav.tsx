import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';

const navItems = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Leads', href: '/leads', icon: UserPlus },
  { name: 'Deals', href: '/opportunities', icon: TrendingUp },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 px-2 pb-safe lg:hidden z-30">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center gap-1 py-2 px-3 min-w-[64px] ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}