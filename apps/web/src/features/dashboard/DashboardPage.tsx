import { useAuthStore } from '../../stores/auth.store';
import { Users, UserPlus, TrendingUp, CheckSquare, ArrowUpRight } from 'lucide-react';

const stats = [
  { name: 'Total Contacts', value: '0', change: '+0%', trend: 'up', icon: Users, color: 'blue' },
  { name: 'Open Leads', value: '0', change: '+0%', trend: 'up', icon: UserPlus, color: 'emerald' },
  { name: 'Active Opportunities', value: '0', change: '$0', trend: 'neutral', icon: TrendingUp, color: 'violet' },
  { name: 'Tasks Due Today', value: '0', change: '0 overdue', trend: 'neutral', icon: CheckSquare, color: 'amber' },
];

const colorClasses = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
};

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.firstName}! 👋
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">
          Here's what's happening with your CRM today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 lg:p-6 hover:shadow-md dark:hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 lg:p-2.5 rounded-xl ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                <stat.icon className="w-4 h-4 lg:w-5 lg:h-5" />
              </div>
              {stat.trend === 'up' && (
                <span className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  {stat.change}
                </span>
              )}
              {stat.trend === 'neutral' && (
                <span className="text-xs font-medium text-gray-500 dark:text-slate-500">
                  {stat.change}
                </span>
              )}
            </div>
            <div className="mt-3 lg:mt-4">
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
              <p className="text-xs lg:text-sm text-gray-500 dark:text-slate-400 mt-1">{stat.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="px-4 lg:px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="p-4 lg:p-6">
            <div className="flex flex-col items-center justify-center py-8 lg:py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 text-sm">No recent activity</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
                Activity will appear here once you start using the CRM
              </p>
            </div>
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
          <div className="px-4 lg:px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Tasks</h2>
          </div>
          <div className="p-4 lg:p-6">
            <div className="flex flex-col items-center justify-center py-8 lg:py-12 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <CheckSquare className="w-6 h-6 text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-gray-500 dark:text-slate-400 text-sm">No upcoming tasks</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
                Tasks will appear here once created
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 lg:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[
            { name: 'Add Contact', color: 'blue', icon: UserPlus },
            { name: 'Add Lead', color: 'emerald', icon: UserPlus },
            { name: 'New Deal', color: 'violet', icon: TrendingUp },
            { name: 'Add Task', color: 'amber', icon: CheckSquare },
          ].map((action) => (
            <button
              key={action.name}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                colorClasses[action.color as keyof typeof colorClasses]
              }`}>
                <action.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{action.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}