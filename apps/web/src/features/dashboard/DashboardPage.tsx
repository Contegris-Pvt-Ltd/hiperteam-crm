import { useAuthStore } from '../../stores/auth.store';
import { Users, UserPlus, TrendingUp, CheckSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const stats = [
  {
    name: 'Total Contacts',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: Users,
    color: 'blue',
  },
  {
    name: 'Open Leads',
    value: '0',
    change: '+0%',
    trend: 'up',
    icon: UserPlus,
    color: 'emerald',
  },
  {
    name: 'Active Opportunities',
    value: '0',
    change: '$0',
    trend: 'neutral',
    icon: TrendingUp,
    color: 'violet',
  },
  {
    name: 'Tasks Due Today',
    value: '0',
    change: '0 overdue',
    trend: 'neutral',
    icon: CheckSquare,
    color: 'amber',
  },
];

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
};

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here's what's happening with your CRM today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.trend === 'up' && (
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  {stat.change}
                </span>
              )}
              {stat.trend === 'down' && (
                <span className="flex items-center text-xs font-medium text-red-600">
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  {stat.change}
                </span>
              )}
              {stat.trend === 'neutral' && (
                <span className="text-xs font-medium text-gray-500">
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-500 mt-1">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No recent activity</p>
              <p className="text-gray-400 text-xs mt-1">
                Activity will appear here once you start using the CRM
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <CheckSquare className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No upcoming tasks</p>
              <p className="text-gray-400 text-xs mt-1">
                Tasks will appear here once created
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
              <UserPlus className="w-5 h-5 text-blue-600 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Add Contact</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
              <UserPlus className="w-5 h-5 text-emerald-600 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Add Lead</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-violet-500 hover:bg-violet-50 transition-all group">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-500 transition-colors">
              <TrendingUp className="w-5 h-5 text-violet-600 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">New Deal</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-all group">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-500 transition-colors">
              <CheckSquare className="w-5 h-5 text-amber-600 group-hover:text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">Add Task</span>
          </button>
        </div>
      </div>
    </div>
  );
}