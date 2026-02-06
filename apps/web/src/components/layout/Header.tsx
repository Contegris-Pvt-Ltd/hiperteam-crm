import { useAuthStore } from '../../stores/auth.store';

export function Header() {
  const { user, tenant, logout } = useAuthStore();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {tenant?.name}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>

          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>

          <button
            onClick={logout}
            className="text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}