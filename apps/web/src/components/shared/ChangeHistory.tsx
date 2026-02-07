import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, History, User } from 'lucide-react';

interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { from: unknown; to: unknown }>;
  performedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

interface ChangeHistoryProps {
  history: AuditLog[];
  loading?: boolean;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  create: { label: 'Created', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  update: { label: 'Updated', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  delete: { label: 'Deleted', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
};

const fieldLabels: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  mobile: 'Mobile',
  company: 'Company',
  jobTitle: 'Job Title',
  website: 'Website',
  avatarUrl: 'Avatar',
  logoUrl: 'Logo',
  emails: 'Emails',
  phones: 'Phones',
  addresses: 'Addresses',
  socialProfiles: 'Social Profiles',
  tags: 'Tags',
  status: 'Status',
  ownerId: 'Owner',
  accountType: 'Account Type',
  industry: 'Industry',
  description: 'Description',
  doNotContact: 'Do Not Contact',
  doNotEmail: 'Do Not Email',
  doNotCall: 'Do Not Call',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ChangeHistory({ history, loading }: ChangeHistoryProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">No change history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((log) => {
        const isExpanded = expandedItems.has(log.id);
        const changeCount = Object.keys(log.changes).length;
        const actionConfig = actionLabels[log.action] || actionLabels.update;

        return (
          <div
            key={log.id}
            className="bg-gray-50 dark:bg-slate-800/50 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(log.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${actionConfig.color}`}>
                  {actionConfig.label}
                </span>
                <span className="text-sm text-gray-600 dark:text-slate-300">
                  {changeCount} {changeCount === 1 ? 'change' : 'changes'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                {log.performedBy && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.performedBy.firstName} {log.performedBy.lastName}
                  </span>
                )}
                <time>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</time>
              </div>
            </button>

            {isExpanded && log.action === 'update' && (
              <div className="px-4 pb-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Field</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">From</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {Object.entries(log.changes).map(([field, change]) => (
                        <tr key={field}>
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                            {fieldLabels[field] || field}
                          </td>
                          <td className="px-4 py-2 text-red-600 dark:text-red-400">
                            {formatValue(change.from)}
                          </td>
                          <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">
                            {formatValue(change.to)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}