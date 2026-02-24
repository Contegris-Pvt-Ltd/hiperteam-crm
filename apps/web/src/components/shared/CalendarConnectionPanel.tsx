// ============================================================
// FILE: apps/web/src/features/settings/components/CalendarConnectionPanel.tsx
// ============================================================
// Embeddable panel for the user profile/settings page.
// Shows Google Calendar connection status, connect/disconnect,
// manual sync trigger, and last sync info.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar, Unlink, RefreshCw, CheckCircle2,
  AlertCircle, Loader2, Clock,
} from 'lucide-react';
import { calendarSyncApi } from '../../api/calendar-sync.api';
import type { CalendarConnection } from '../../api/calendar-sync.api';

// Google logo SVG inline (small, no external dependency)
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function CalendarConnectionPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number } | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ── Check URL params for OAuth callback result ──
  useEffect(() => {
    const calendarParam = searchParams.get('calendar');
    if (calendarParam === 'connected') {
      setSuccessMessage('Google Calendar connected successfully!');
      // Clean up URL params
      searchParams.delete('calendar');
      setSearchParams(searchParams, { replace: true });
    } else if (calendarParam === 'error') {
      const reason = searchParams.get('reason') || 'Unknown error';
      setError(`Failed to connect Google Calendar: ${reason}`);
      searchParams.delete('calendar');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // ── Fetch connection status ──
  const fetchConnection = useCallback(async () => {
    setLoading(true);
    try {
      const result = await calendarSyncApi.getConnection();
      setConnection(result.connection);
    } catch {
      // Not connected or endpoint missing — that's fine
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  // ── Connect handler ──
  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const { url } = await calendarSyncApi.getGoogleAuthUrl();
      // Redirect browser to Google OAuth consent page
      window.location.href = url;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start Google Calendar connection');
      setConnecting(false);
    }
  };

  // ── Disconnect handler ──
  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Synced events will be removed.')) return;
    setDisconnecting(true);
    setError('');
    try {
      await calendarSyncApi.disconnect();
      setConnection(null);
      setSuccessMessage('Google Calendar disconnected');
      setSyncResult(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Manual sync handler ──
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const result = await calendarSyncApi.syncNow();
      setSyncResult(result);
      setSuccessMessage(`Sync complete: ${result.pushed} pushed, ${result.pulled} pulled`);
      fetchConnection(); // Refresh last_synced_at
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Auto-clear messages ──
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ── Format date ──
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
          <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Google Calendar</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Two-way sync between CRM tasks and your Google Calendar
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 size={16} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-400">Checking connection...</span>
          </div>
        ) : connection ? (
          /* Connected state */
          <div className="space-y-4">
            {/* Connection info */}
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
              <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Connected</p>
                <p className="text-xs text-green-600 dark:text-green-400 truncate flex items-center gap-1">
                  <GoogleLogo size={12} />
                  {connection.email}
                </p>
              </div>
              {!connection.isActive && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  Needs reconnect
                </span>
              )}
            </div>

            {/* Sync info */}
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock size={12} /> Last synced: {formatDate(connection.lastSyncedAt)}
              </span>
              <span className="flex items-center gap-1">
                Direction: {connection.syncDirection === 'two_way' ? '↔ Two-way' : '→ One-way'}
              </span>
            </div>

            {/* Sync result toast */}
            {syncResult && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 rounded-lg">
                Synced: {syncResult.pushed} tasks → Google, {syncResult.pulled} events → CRM
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <Unlink size={13} />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          /* Not connected state */
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                <GoogleLogo size={24} />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                Connect your Google account to sync tasks with Google Calendar
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Tasks with due dates will appear in your calendar, and Google events will show in CRM
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <GoogleLogo size={16} />
                )}
                {connecting ? 'Redirecting...' : 'Connect Google Calendar'}
              </button>
            </div>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-300">{successMessage}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}