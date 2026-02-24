import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, X, ExternalLink, Clock,
  CheckSquare, Calendar, UserPlus, AtSign, AlertCircle,
  Loader2, Wifi, WifiOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';
import type { Notification } from '../../api/notifications.api';

// ============================================================
// NOTIFICATION ICON MAP
// ============================================================
const notificationIcons: Record<string, React.ReactNode> = {
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

const notificationColors: Record<string, string> = {
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

// ============================================================
// NOTIFICATION ITEM
// ============================================================
function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onClick,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick: (n: Notification) => void;
}) {
  const iconColor = notificationColors[notification.type] || 'bg-gray-100 dark:bg-gray-800 text-gray-500';
  const icon = notificationIcons[notification.type] || <Bell className="w-4 h-4" />;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0 ${
        notification.isRead
          ? 'bg-white dark:bg-slate-900'
          : 'bg-blue-50/50 dark:bg-blue-950/20'
      } hover:bg-gray-50 dark:hover:bg-slate-800/50`}
      onClick={() => onClick(notification)}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${notification.isRead ? 'text-gray-600 dark:text-slate-400' : 'text-gray-900 dark:text-white font-medium'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {!notification.isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-blue-500 transition-colors"
            title="Mark as read"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-red-500 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Unread dot */}
      {!notification.isRead && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
      )}
    </div>
  );
}

// ============================================================
// NOTIFICATION BELL (MAIN EXPORT)
// ============================================================
export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    unreadCount, notifications, loading, connected,
    markRead, markAllRead, dismiss, refresh, loadMore, hasMore,
  } = useNotifications();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen && !initialLoad) {
      refresh();
      setInitialLoad(true);
    }
  }, [isOpen, initialLoad, refresh]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) markRead(n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Connection status */}
              <span title={connected ? 'Connected (real-time)' : 'Reconnecting...'}>
                {connected
                  ? <Wifi className="w-3.5 h-3.5 text-green-500" />
                  : <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                }
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400">No notifications yet</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  You'll see task reminders, meeting updates, and more here
                </p>
              </div>
            ) : (
              <>
                {notifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={markRead}
                    onDismiss={dismiss}
                    onClick={handleNotificationClick}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-2.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-2.5">
            <button
              onClick={() => { navigate('/notifications'); setIsOpen(false); }}
              className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
            >
              View all notifications
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}