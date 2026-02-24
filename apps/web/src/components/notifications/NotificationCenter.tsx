import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, X, Filter, Loader2, Inbox,
  CheckSquare, Calendar, UserPlus, AtSign, AlertCircle, Clock,
  Settings, ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Notification } from '../../api/notifications.api';
import { notificationsApi, EVENT_TYPE_LABELS } from '../../api/notifications.api';

// ============================================================
// CONSTANTS
// ============================================================
const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  task_assigned: <CheckSquare className="w-4 h-4" />,
  task_due_reminder: <Clock className="w-4 h-4" />,
  task_overdue: <AlertCircle className="w-4 h-4" />,
  task_completed: <Check className="w-4 h-4" />,
  meeting_reminder: <Calendar className="w-4 h-4" />,
  meeting_booked: <Calendar className="w-4 h-4" />,
  meeting_cancelled: <Calendar className="w-4 h-4" />,
  meeting_rescheduled: <Calendar className="w-4 h-4" />,
  lead_assigned: <UserPlus className="w-4 h-4" />,
  mention: <AtSign className="w-4 h-4" />,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  task_assigned: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  task_due_reminder: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  task_overdue: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  task_completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  meeting_reminder: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  meeting_booked: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  meeting_cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  meeting_rescheduled: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  lead_assigned: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  mention: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
};

type FilterType = 'all' | 'unread' | string;

// ============================================================
// MAIN COMPONENT
// ============================================================
export function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadNotifications = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    setLoading(true);
    try {
      const params: any = { page: pageNum, limit: 20 };
      if (filter === 'unread') params.unreadOnly = true;
      else if (filter !== 'all') params.type = filter;

      const result = await notificationsApi.list(params);
      if (append) {
        setNotifications(prev => [...prev, ...result.data]);
      } else {
        setNotifications(result.data);
      }
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadNotifications(1, false);
  }, [loadNotifications]);

  // ============================================================
  // ACTIONS
  // ============================================================
  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    setUnreadCount(0);
  };

  const handleDismiss = async (id: string) => {
    const n = notifications.find(n => n.id === id);
    await notificationsApi.dismiss(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setTotal(prev => prev - 1);
    if (n && !n.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) handleMarkRead(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  const hasMore = notifications.length < total;

  // ============================================================
  // GET UNIQUE EVENT TYPES FOR FILTER
  // ============================================================
  const eventTypes = Object.keys(EVENT_TYPE_LABELS);

  // ============================================================
  // GROUP BY DATE
  // ============================================================
  const groupedNotifications = notifications.reduce<Record<string, Notification[]>>((groups, n) => {
    const date = format(new Date(n.createdAt), 'yyyy-MM-dd');
    const label = isToday(n.createdAt) ? 'Today' : isYesterday(n.createdAt) ? 'Yesterday' : format(new Date(n.createdAt), 'EEEE, MMMM d');
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
    return groups;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => navigate('/admin/notification-settings')}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'unread'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          Unread
        </button>

        {/* Type filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter !== 'all' && filter !== 'unread'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filter !== 'all' && filter !== 'unread'
              ? EVENT_TYPE_LABELS[filter]?.label || filter
              : 'Filter by type'
            }
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-20 py-1 max-h-64 overflow-y-auto">
              {eventTypes.map(type => (
                <button
                  key={type}
                  onClick={() => { setFilter(type); setFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2 ${
                    filter === type ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center ${NOTIFICATION_COLORS[type] || 'bg-gray-100 text-gray-500'}`}>
                    {NOTIFICATION_ICONS[type] || <Bell className="w-3 h-3" />}
                  </span>
                  {EVENT_TYPE_LABELS[type]?.label || type}
                </button>
              ))}
              {filter !== 'all' && filter !== 'unread' && (
                <>
                  <div className="border-t border-gray-100 dark:border-slate-800 my-1" />
                  <button
                    onClick={() => { setFilter('all'); setFilterOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Clear filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-gray-500 dark:text-slate-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              {filter === 'unread'
                ? "You're all caught up!"
                : 'Notifications will appear here when you receive them'
              }
            </p>
          </div>
        ) : (
          <>
            {Object.entries(groupedNotifications).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {dateLabel}
                  </p>
                </div>
                {/* Items */}
                {items.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-gray-50 dark:border-slate-800/50 last:border-0 ${
                      n.isRead
                        ? 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                        : 'bg-blue-50/40 dark:bg-blue-950/10 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                    }`}
                    onClick={() => handleClick(n)}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${NOTIFICATION_COLORS[n.type] || 'bg-gray-100 text-gray-500'}`}>
                      {NOTIFICATION_ICONS[n.type] || <Bell className="w-4 h-4" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${n.isRead ? 'text-gray-600 dark:text-slate-400' : 'text-gray-900 dark:text-white font-medium'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-600 whitespace-nowrap flex-shrink-0">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {n.body && (
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      {n.channels.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {n.channels.map(ch => (
                            <span key={ch} className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 px-1.5 py-0.5 rounded">
                              {ch.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-red-500 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={() => loadNotifications(page + 1, true)}
                  disabled={loading}
                  className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more notifications'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function isYesterday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
}