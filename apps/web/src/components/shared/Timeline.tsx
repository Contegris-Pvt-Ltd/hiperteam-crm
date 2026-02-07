import { formatDistanceToNow } from 'date-fns';
import { 
  Plus, Pencil, Trash2, Link, Unlink, 
  FileText, MessageSquare, Mail, Phone, Calendar,
  User, Activity
} from 'lucide-react';

interface TimelineActivity {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  performedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

interface TimelineProps {
  activities: TimelineActivity[];
  loading?: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  created: <Plus className="w-4 h-4" />,
  updated: <Pencil className="w-4 h-4" />,
  deleted: <Trash2 className="w-4 h-4" />,
  contact_linked: <Link className="w-4 h-4" />,
  contact_unlinked: <Unlink className="w-4 h-4" />,
  account_linked: <Link className="w-4 h-4" />,
  account_unlinked: <Unlink className="w-4 h-4" />,
  note_added: <MessageSquare className="w-4 h-4" />,
  document_uploaded: <FileText className="w-4 h-4" />,
  email_sent: <Mail className="w-4 h-4" />,
  call_logged: <Phone className="w-4 h-4" />,
  meeting_scheduled: <Calendar className="w-4 h-4" />,
};

const activityColors: Record<string, string> = {
  created: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  updated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  deleted: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  contact_linked: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  contact_unlinked: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  account_linked: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  account_unlinked: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  default: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
};

export function Timeline({ activities, loading }: TimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, idx) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {idx !== activities.length - 1 && (
                <span
                  className="absolute left-4 top-8 -ml-px h-full w-0.5 bg-gray-200 dark:bg-slate-700"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3">
                <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${activityColors[activity.activityType] || activityColors.default}`}>
                  {activityIcons[activity.activityType] || <Activity className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.title}
                    </p>
                    <time className="text-xs text-gray-500 dark:text-slate-400">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </time>
                  </div>
                  {activity.description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
                      {activity.description}
                    </p>
                  )}
                  {activity.performedBy && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {activity.performedBy.firstName} {activity.performedBy.lastName}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}