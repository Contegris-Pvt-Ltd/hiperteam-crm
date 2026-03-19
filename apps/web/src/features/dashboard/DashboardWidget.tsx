// ============================================================
// FILE: apps/web/src/features/dashboard/DashboardWidget.tsx
// Single widget card: fetches data, routes to renderer,
// handles loading/error/refresh/edit actions.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Settings2, Copy, Trash2, GripVertical,
  AlertCircle, MoreVertical,
} from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import type { ReportResult } from '../../api/reports.api';
import type { DashboardWidget as DashboardWidgetType } from '../../api/dashboard-layout.api';
import { ReportChart, ReportDataTable } from '../reports/ReportCharts';
import { ScorecardWidget } from './ScorecardWidget';
import { LeaderboardWidget } from './LeaderboardWidget';
import { ProjectionWidget } from './ProjectionWidget';
import { useWidgetRuntimeFilters, useDashboard } from './DashboardContext';

interface DashboardWidgetProps {
  widget: DashboardWidgetType;
  onEdit?: (widget: DashboardWidgetType) => void;
  onDuplicate?: (widget: DashboardWidgetType) => void;
  onDelete?: (widgetId: string) => void;
  preloadedData?: ReportResult | null;
}

export function DashboardWidgetCard({
  widget,
  onEdit,
  onDuplicate,
  onDelete,
  preloadedData,
}: DashboardWidgetProps) {
  const { isEditMode } = useDashboard();
  const [result, setResult] = useState<ReportResult | null>(preloadedData ?? null);
  const [loading, setLoading] = useState(!preloadedData);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { runtimeFilters } = useWidgetRuntimeFilters(
    widget.filterSensitivity,
    widget.config.filters,
  );

  const fetchData = useCallback(async () => {
    if (preloadedData !== undefined) return; // Skip fetch when data is preloaded
    if (!widget.dataSource) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.executePreview({
        dataSource: widget.dataSource,
        reportType: widget.reportType || 'summary',
        config: {
          ...widget.config,
          filters: runtimeFilters,
        },
        runtimeFilters: [],
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load widget data');
    } finally {
      setLoading(false);
    }
  }, [preloadedData, widget.dataSource, widget.reportType, widget.config, JSON.stringify(runtimeFilters)]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (!widget.refreshInterval || widget.refreshInterval <= 0) return;
    const interval = setInterval(fetchData, widget.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [widget.refreshInterval, fetchData]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Compact header for small widget types (scorecards)
  const isCompactHeader = widget.widgetType === 'scorecard';
  const headerPadding = isCompactHeader ? 'px-2 py-1.5' : 'px-3 py-2.5';
  const headerHeight = isCompactHeader ? 32 : 44;
  const widgetHeight = `calc(100% - ${headerHeight}px)`;

  const renderContent = () => {
    if (error) return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-red-400 dark:text-red-400">
        <AlertCircle className="w-6 h-6" />
        <p className="text-center px-4">{error}</p>
        <button
          onClick={fetchData}
          className="text-xs px-3 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
        >
          Retry
        </button>
      </div>
    );

    switch (widget.widgetType) {
      case 'scorecard':
        return (
          <ScorecardWidget
            data={result}
            displayConfig={widget.displayConfig}
            loading={loading}
          />
        );

      case 'leaderboard':
        return (
          <LeaderboardWidget
            data={result}
            displayConfig={widget.displayConfig}
            loading={loading}
          />
        );

      case 'projection':
        return (
          <ProjectionWidget
            data={result}
            displayConfig={widget.displayConfig}
            loading={loading}
          />
        );

      case 'table':
        if (loading) return <LoadingSpinner />;
        return result ? (
          <div className="overflow-auto h-full">
            <ReportDataTable data={result.data} columns={result.columns} />
          </div>
        ) : null;

      case 'chart':
      default:
        if (loading) return <LoadingSpinner />;
        return result ? (
          <ReportChart
            data={result.data}
            columns={result.columns}
            chartType={widget.chartType}
            height="100%"
            compact
          />
        ) : null;
    }
  };

  return (
    <div
      className={`h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border transition-shadow ${
        isEditMode
          ? 'border-purple-200 dark:border-purple-700 shadow-md ring-1 ring-purple-100 dark:ring-purple-800'
          : 'border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${headerPadding} border-b border-gray-100 dark:border-slate-700 flex-shrink-0 ${
        isEditMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditMode && (
            <GripVertical className={`${isCompactHeader ? 'w-3 h-3' : 'w-4 h-4'} text-gray-300 dark:text-slate-600 flex-shrink-0`} />
          )}
          <h3 className={`font-semibold text-gray-800 dark:text-white truncate ${isCompactHeader ? 'text-xs' : 'text-sm'}`}>
            {widget.title || 'Untitled Widget'}
          </h3>
          {widget.dataSource && !isCompactHeader && (
            <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:inline truncate">
              · {widget.dataSource}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isEditMode && (
            <button
              onClick={fetchData}
              className={`rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300 transition-colors ${isCompactHeader ? 'p-0.5' : 'p-1'}`}
              title="Refresh"
            >
              <RefreshCw className={`${isCompactHeader ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {isEditMode && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className={`rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${isCompactHeader ? 'p-0.5' : 'p-1'}`}
              >
                <MoreVertical className={isCompactHeader ? 'w-3 h-3' : 'w-4 h-4'} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-50 w-40 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit?.(widget); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Edit widget
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDuplicate?.(widget); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <hr className="my-1 border-gray-100 dark:border-slate-700" />
                  <button
                    onClick={() => { setMenuOpen(false); onDelete?.(widget.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 overflow-hidden ${isCompactHeader ? 'p-1' : 'p-2'}`} style={{ height: widgetHeight, minHeight: widget.widgetType === 'scorecard' ? undefined : 200 }}>
        {renderContent()}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <span className="text-xs text-gray-400 dark:text-slate-500">Loading...</span>
      </div>
    </div>
  );
}
