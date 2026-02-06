import { useAuthStore } from '../../stores/auth.store';

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600">Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Contacts</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-sm text-green-600 mt-1">+0% from last month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Open Leads</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-sm text-green-600 mt-1">+0% from last month</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Opportunities</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-sm text-gray-600 mt-1">$0 pipeline value</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Tasks Due Today</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          <p className="text-sm text-gray-600 mt-1">0 overdue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <p className="text-gray-500 text-sm">No recent activity.</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Upcoming Tasks</h2>
          <p className="text-gray-500 text-sm">No upcoming tasks.</p>
        </div>
      </div>
    </div>
  );
}