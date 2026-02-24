// ============================================================
// FILE: apps/web/src/features/tasks/components/CalendarSyncButton.tsx
// ============================================================
// A header button that opens a popover/modal showing:
// - If disconnected: Connect Google / Connect Outlook buttons
// - If connected: Status, sync now, disconnect
// Place alongside the "New Task" button in TasksPage header.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Unlink, Clock, ChevronDown, X, Calendar,
} from 'lucide-react';
import { calendarSyncApi } from '../../../api/calendar-sync.api';
import type { CalendarConnection } from '../../../api/calendar-sync.api';

// ── Google logo inline SVG ──
function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ── Outlook logo placeholder ──
function OutlookLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="22" height="16" rx="2" fill="#0078D4"/>
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="10" fontFamily="Arial" fontWeight="bold">O</text>
    </svg>
  );
}

export function CalendarSyncButton() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number } | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Handle OAuth callback URL params ──
  useEffect(() => {
    const calendarParam = searchParams.get('calendar');
    if (calendarParam === 'connected') {
      setToast('Google Calendar connected successfully!');
      searchParams.delete('calendar');
      setSearchParams(searchParams, { replace: true });
      fetchConnection();
    } else if (calendarParam === 'error') {
      const reason = searchParams.get('reason') || 'Unknown error';
      setError(`Connection failed: ${reason}`);
      searchParams.delete('calendar');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // ── Fetch connection ──
  const fetchConnection = useCallback(async () => {
    setLoading(true);
    try {
      const result = await calendarSyncApi.getConnection();
      setConnection(result.connection);
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  // ── Close on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Auto-clear messages ──
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); }
  }, [toast]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 6000); return () => clearTimeout(t); }
  }, [error]);

  // ── Connect Google ──
  const handleConnectGoogle = async () => {
    setConnecting(true);
    setError('');
    try {
      const { url } = await calendarSyncApi.getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to connect');
      setConnecting(false);
    }
  };

  // ── Disconnect ──
  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Synced events will be removed.')) return;
    setDisconnecting(true);
    try {
      await calendarSyncApi.disconnect();
      setConnection(null);
      setToast('Disconnected');
      setSyncResult(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Sync now ──
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await calendarSyncApi.syncNow();
      setSyncResult(result);
      setToast(`Synced: ${result.pushed} → Google, ${result.pulled} → CRM`);
      fetchConnection();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Format relative time ──
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isConnected = !!connection;

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
          isConnected
            ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
        }`}
      >
        <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
        {isConnected ? 'Synced' : 'Sync'}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Toast messages ── */}
      {toast && (
        <div className="absolute top-full mt-2 right-0 z-50 flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg whitespace-nowrap">
          <CheckCircle2 size={13} className="text-green-600" />
          <span className="text-xs text-green-700 dark:text-green-300">{toast}</span>
        </div>
      )}
      {error && (
        <div className="absolute top-full mt-2 right-0 z-50 flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg max-w-[280px]">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* ── Popover ── */}
      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 w-[300px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Calendar Sync</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : isConnected ? (
            /* ── Connected View ── */
            <div className="p-4 space-y-3">
              {/* Status row */}
              <div className="flex items-center gap-2.5 p-2.5 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg">
                <GoogleLogo size={18} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 truncate">
                    {connection.email}
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-500 flex items-center gap-1">
                    <Clock size={9} /> Last sync: {formatTime(connection.lastSyncedAt)}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              </div>

              {/* Sync result */}
              {syncResult && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-2.5 py-1.5 rounded">
                  {syncResult.pushed} tasks → Google · {syncResult.pulled} events → CRM
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  <Unlink size={12} />
                </button>
              </div>
            </div>
          ) : (
            /* ── Not Connected View ── */
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Connect a calendar to sync your tasks
              </p>

              {/* Google */}
              <button
                onClick={handleConnectGoogle}
                disabled={connecting}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {connecting ? <Loader2 size={18} className="animate-spin" /> : <GoogleLogo size={18} />}
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {connecting ? 'Connecting...' : 'Google Calendar'}
                  </p>
                  <p className="text-[10px] text-gray-400">Two-way sync</p>
                </div>
              </button>

              {/* Outlook — disabled placeholder for now */}
              <button
                disabled
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed"
              >
                <OutlookLogo size={18} />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Microsoft Outlook</p>
                  <p className="text-[10px] text-gray-400">Coming soon</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}