// ============================================================
// FILE: apps/web/src/features/dashboard/SharedDashboardPage.tsx
// Public page for viewing shared dashboards via token
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  LayoutDashboard, Loader2, ShieldAlert, Clock,
  Mail, Lock, AlertTriangle,
} from 'lucide-react';
import { dashboardLayoutApi } from '../../api/dashboard-layout.api';
import type { DashboardWidget, DashboardTabFilters } from '../../api/dashboard-layout.api';
import { DashboardProvider } from './DashboardContext';
import { DashboardWidgetCard } from './DashboardWidget';

const GRID_COLS = 12;
const ROW_HEIGHT = 80;
const GRID_MARGIN: [number, number] = [12, 12];

export function SharedDashboardPage() {
  const { tenantSlug, token } = useParams<{ tenantSlug: string; token: string }>();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(searchParams.get('email') || '');

  const [dashboardName, setDashboardName] = useState('');
  const [tabFilters, setTabFilters] = useState<DashboardTabFilters | null>(null);
  const [widgets, setWidgets] = useState<(DashboardWidget & { data?: any })[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const loadDashboard = async (email?: string) => {
    if (!token || !tenantSlug) return;
    setLoading(true);
    setError(null);
    setNeedsEmail(false);
    try {
      const result = await dashboardLayoutApi.getSharedDashboard(tenantSlug, token, email);
      setDashboardName(result.dashboard.name);
      setTabFilters(result.dashboard.tabFilters);
      setWidgets(result.widgets);
      setExpiresAt(result.expiresAt);
    } catch (err: any) {
      const message = err?.response?.data?.message || err.message || 'Failed to load dashboard';
      if (message.includes('Email verification required')) {
        setNeedsEmail(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const emailParam = searchParams.get('email');
    loadDashboard(emailParam || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, token]);

  const handleEmailSubmit = () => {
    if (emailInput.trim().includes('@')) {
      loadDashboard(emailInput.trim());
    }
  };

  const layout: Layout[] = widgets.map(w => ({
    i: w.id,
    x: w.position.x,
    y: w.position.y,
    w: w.position.w,
    h: w.position.h,
    static: true,
  }));

  const gridWidth = containerWidth > 0 ? containerWidth : 1200;

  // Email verification screen
  if (needsEmail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl mb-4">
              <Lock className="w-6 h-6 text-purple-500" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Email Verification Required
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This dashboard is restricted. Enter your email to continue.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEmailSubmit(); }}
              placeholder="your@email.com"
              className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleEmailSubmit}
              disabled={!emailInput.trim().includes('@')}
              className="w-full px-4 py-3 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" /> Verify & View Dashboard
            </button>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading shared dashboard...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Cannot Access Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5 text-purple-500" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {dashboardName}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
            {expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(expiresAt).toLocaleDateString()}
              </span>
            )}
            <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400">
              Shared View
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard grid */}
      <div className="max-w-7xl mx-auto p-4" ref={containerRef}>
        {tabFilters && (
          <DashboardProvider tabFilters={tabFilters}>
            {widgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <LayoutDashboard className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  No widgets
                </h3>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  This dashboard has no widgets to display.
                </p>
              </div>
            ) : (
              <GridLayout
                layout={layout}
                cols={GRID_COLS}
                rowHeight={ROW_HEIGHT}
                width={gridWidth}
                margin={GRID_MARGIN}
                isDraggable={false}
                isResizable={false}
              >
                {widgets.map(widget => (
                  <div key={widget.id}>
                    <DashboardWidgetCard
                      widget={widget}
                      preloadedData={widget.data ?? null}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </DashboardProvider>
        )}
      </div>
    </div>
  );
}
