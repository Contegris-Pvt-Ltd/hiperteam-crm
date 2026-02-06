import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Contacts', href: '/contacts', icon: '👥' },
  { name: 'Leads', href: '/leads', icon: '🎯' },
  { name: 'Opportunities', href: '/opportunities', icon: '💼' },
  { name: 'Tasks', href: '/tasks', icon: '✅' },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: '👤' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export function Sidebar() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">HiperTeam CRM</h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 mt-4 border-t border-gray-700">
              <p className="px-3 text-xs text-gray-500 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        v0.1.0
      </div>
    </aside>
  );
}