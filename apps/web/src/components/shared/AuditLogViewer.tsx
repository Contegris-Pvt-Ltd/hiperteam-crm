import { useState, useEffect, useCallback } from 'react';
import {
  History, ChevronDown, ChevronRight, ChevronLeft,
  User, Shield, Users as UsersIcon, Building2,
  LogIn, Key, UserPlus, UserMinus, Edit, Trash2, Plus,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { getEntityAuditHistory, getAuditLogs } from '../../api/audit.api';
import type { AuditLogEntry, AuditLogQueryParams, AuditLogResponse } from '../../api/audit.api';

// ============================================================
// TYPES
// ============================================================

interface AuditLogViewerProps {
  /** If provided, shows history for a specific entity only */
  entityType?: string;
  /** If provided, shows history for a specific entity only */
  entityId?: string;
  /** Max entries to show (entity mode). Default 50 */
  limit?: number;
  /** Title displayed above the log. Default "Change History" */
  title?: string;
  /** Show filters (global mode). Default false */
  showFilters?: boolean;
  /** Compact mode for sidebars / detail pages */
  compact?: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  create: { label: 'Created', color: 'bg-green-100 text-green-800', icon: Plus },
  update: { label: 'Updated', color: 'bg-blue-100 text-blue-800', icon: Edit },
  delete: { label: 'Deleted', color: 'bg-red-100 text-red-800', icon: Trash2 },
  login: { label: 'Login', color: 'bg-purple-100 text-purple-800', icon: LogIn },
  logout: { label: 'Logout', color: 'bg-gray-100 text-gray-800', icon: LogIn },
  invite: { label: 'Invited', color: 'bg-yellow-100 text-yellow-800', icon: UserPlus },
  password_reset: { label: 'Password Reset', color: 'bg-orange-100 text-orange-800', icon: Key },
  status_change: { label: 'Status Change', color: 'bg-indigo-100 text-indigo-800', icon: Shield },
  member_add: { label: 'Member Added', color: 'bg-teal-100 text-teal-800', icon: UserPlus },
  member_remove: { label: 'Member Removed', color: 'bg-pink-100 text-pink-800', icon: UserMinus },
};

const ENTITY_CONFIG: Record<string, { label: string; icon: typeof User }> = {
  users: { label: 'User', icon: User },
  departments: { label: 'Department', icon: Building2 },
  teams: { label: 'Team', icon: UsersIcon },
  roles: { label: 'Role', icon: Shield },
  contacts: { label: 'Contact', icon: User },
  accounts: { label: 'Account', icon: Building2 },
  auth: { label: 'Auth', icon: LogIn },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { label: action, color: 'bg-gray-100 text-gray-800', icon: Edit };
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace('Id', '')
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================
// CHANGE DETAIL ROW
// ============================================================

function ChangeRow({ field, from, to }: { field: string; from: unknown; to: unknown }) {
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <span className="font-medium text-gray-600 min-w-[120px]">{formatFieldName(field)}:</span>
      <span className="text-red-600 line-through">{formatValue(from)}</span>
      <span className="text-gray-400 mx-1">&rarr;</span>
      <span className="text-green-700">{formatValue(to)}</span>
    </div>
  );
}

// ============================================================
// SINGLE LOG ENTRY
// ============================================================

function AuditLogItem({ entry, compact, showEntityType }: {
  entry: AuditLogEntry;
  compact?: boolean;
  showEntityType?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const actionCfg = getActionConfig(entry.action);
  const ActionIcon = actionCfg.icon;
  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  const performerName = entry.performedBy.firstName
    ? `${entry.performedBy.firstName} ${entry.performedBy.lastName}`
    : entry.performedBy.email || entry.performedBy.id?.slice(0, 8);

  return (
    <div className={`border-l-2 border-gray-200 pl-4 ${compact ? 'py-2' : 'py-3'}`}>
      <div
        className="flex items-start gap-2 cursor-pointer group"
        onClick={() => (hasChanges || hasMetadata) && setExpanded(!expanded)}
      >
        {/* Action icon */}
        <div className={`p-1 rounded ${actionCfg.color} flex-shrink-0 mt-0.5`}>
          <ActionIcon className="w-3 h-3" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${actionCfg.color}`}>
              {actionCfg.label}
            </span>
            {showEntityType && (
              <span className="text-xs text-gray-500">
                {ENTITY_CONFIG[entry.entityType]?.label || entry.entityType}
              </span>
            )}
            <span className="text-xs text-gray-400">by</span>
            <span className="text-xs font-medium text-gray-700">{performerName}</span>
          </div>

          <div className="text-xs text-gray-400 mt-0.5">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            <span className="ml-2 hidden group-hover:inline">
              {format(new Date(entry.createdAt), 'MMM d, yyyy HH:mm:ss')}
            </span>
          </div>
        </div>

        {/* Expand indicator */}
        {(hasChanges || hasMetadata) && (
          <div className="text-gray-400 flex-shrink-0 mt-1">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 ml-7 p-2 bg-gray-50 rounded text-xs space-y-1">
          {hasChanges && Object.entries(entry.changes).map(([field, change]) => (
            <ChangeRow key={field} field={field} from={change.from} to={change.to} />
          ))}
          {hasMetadata && (
            <div className="pt-1 border-t border-gray-200 mt-1">
              {Object.entries(entry.metadata!).map(([key, val]) => (
                <div key={key} className="flex gap-2 py-0.5">
                  <span className="text-gray-500">{formatFieldName(key)}:</span>
                  <span className="text-gray-700">{formatValue(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function AuditLogViewer({
  entityType,
  entityId,
  limit = 50,
  title = 'Change History',
  showFilters = false,
  compact = false,
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global mode state
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [filters, setFilters] = useState<AuditLogQueryParams>({
    page: 1,
    limit: 20,
    sortOrder: 'DESC',
  });

  const isEntityMode = !!entityType && !!entityId;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isEntityMode) {
        const data = await getEntityAuditHistory(entityType!, entityId!, limit);
        setLogs(data);
      } else {
        const response: AuditLogResponse = await getAuditLogs(filters);
        setLogs(response.data);
        setMeta(response.meta);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit history');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, limit, isEntityMode, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <h3 className={`font-semibold text-gray-800 ${compact ? 'text-sm' : 'text-base'}`}>
            {title}
          </h3>
          {!loading && (
            <span className="text-xs text-gray-400">
              ({isEntityMode ? logs.length : meta.total} {isEntityMode ? 'entries' : 'total'})
            </span>
          )}
        </div>
        <button
          onClick={fetchLogs}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters (global mode only) */}
      {showFilters && !isEntityMode && (
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            className="text-xs border border-gray-300 rounded px-2 py-1"
            value={filters.entityType || ''}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value || undefined, page: 1 })}
          >
            <option value="">All Entities</option>
            {Object.entries(ENTITY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>

          <select
            className="text-xs border border-gray-300 rounded px-2 py-1"
            value={filters.action || ''}
            onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined, page: 1 })}
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {loading && logs.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">Loading audit history...</div>
      ) : error ? (
        <div className="py-8 text-center text-red-500 text-sm">{error}</div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          No audit history found
        </div>
      ) : (
        <div className="space-y-0">
          {logs.map((entry) => (
            <AuditLogItem
              key={entry.id}
              entry={entry}
              compact={compact}
              showEntityType={!isEntityMode}
            />
          ))}
        </div>
      )}

      {/* Pagination (global mode) */}
      {!isEntityMode && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <span className="text-xs text-gray-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="p-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}