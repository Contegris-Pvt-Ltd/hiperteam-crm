// ============================================================
// FILE: apps/web/src/features/reports/ReportViewerPage.tsx
//
// View and interact with a saved report. Features:
//   - Auto-execute on load
//   - Runtime filter bar
//   - Chart + data table display
//   - Export to CSV
//   - Clone / Edit buttons
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Play, Download, Copy, Pencil, BarChart3, Table2,
  RefreshCw, Clock,
} from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import type { Report, ReportResult, ReportFilter } from '../../api/reports.api';
import { ReportChart, ReportDataTable } from './ReportCharts';
import { usePermissions } from '../../hooks/usePermissions';

type DisplayMode = 'chart' | 'table' | 'both';

const RELATIVE_DATE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
];

export function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canCreate } = usePermissions();

  // State
  const [report, setReport] = useState<Report | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('both');

  // Runtime filters
  const [dateRange, setDateRange] = useState('');

  // ── Fetch Report Definition ──
  useEffect(() => {
    if (!id) return;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await reportsApi.getOne(id);
        setReport(data);

        // Determine default display mode from chart type
        if (data.chartType === 'table' || data.chartType === 'none') {
          setDisplayMode('table');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  // ── Execute Report ──
  const executeReport = useCallback(async () => {
    if (!id) return;
    setExecuting(true);
    setError('');
    try {
      // Build runtime filters
      const runtimeFilters: ReportFilter[] = [];
      if (dateRange) {
        // Find the first date field in the config
        const dateDim = report?.config.dimensions?.find(d => d.type === 'date');
        const dateField = dateDim?.field || 'created_at';
        runtimeFilters.push({
          field: dateField,
          operator: 'relative_date',
          value: null,
          dateRelative: dateRange,
        });
      }

      const data = await reportsApi.execute(id, runtimeFilters.length > 0 ? runtimeFilters : undefined);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute report');
    } finally {
      setExecuting(false);
    }
  }, [id, dateRange, report]);

  // Auto-execute on load and when filters change
  useEffect(() => {
    if (report) {
      executeReport();
    }
  }, [report, dateRange]);

  // ── Export ──
  const handleExport = async () => {
    if (!id) return;
    try {
      await reportsApi.exportReport(id, 'csv');
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // ── Clone ──
  const handleClone = async () => {
    if (!id) return;
    try {
      const cloned = await reportsApi.clone(id);
      navigate(`/reports/${cloned.id}/edit`);
    } catch (err) {
      console.error('Clone failed:', err);
    }
  };

  // ── Loading / Error States ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="p-3 sm:p-6 max-w-4xl mx-auto">
        <Link to="/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Reports
        </Link>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/reports" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Reports
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{report.name}</h1>
          {report.description && (
            <p className="text-sm text-gray-500 mt-1">{report.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {report.isSystem && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                System Report
              </span>
            )}
            <span className="text-xs text-gray-400">
              {report.dataSource} &middot; {report.reportType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={executeReport}
            disabled={executing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {executing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {executing ? 'Running...' : 'Run'}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {canCreate('reports') && (
            <button
              onClick={handleClone}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Clone & Customize"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {!report.isSystem && canEdit('reports') && (
            <button
              onClick={() => navigate(`/reports/${id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
        <Clock className="w-4 h-4 text-gray-400" />
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800"
        >
          {RELATIVE_DATE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Display mode toggle */}
        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          {report.chartType !== 'table' && report.chartType !== 'none' && (
            <>
              <button
                onClick={() => setDisplayMode('chart')}
                className={`p-1.5 ${displayMode === 'chart' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                title="Chart only"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDisplayMode('both')}
                className={`p-1.5 ${displayMode === 'both' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
                title="Chart + Table"
              >
                <div className="flex gap-0.5">
                  <BarChart3 className="w-3 h-3" />
                  <Table2 className="w-3 h-3" />
                </div>
              </button>
            </>
          )}
          <button
            onClick={() => setDisplayMode('table')}
            className={`p-1.5 ${displayMode === 'table' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}
            title="Table only"
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>

        {result && (
          <span className="text-xs text-gray-400">
            {result.totalRows} row{result.totalRows !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {executing && !result ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Generating report...</p>
          </div>
        </div>
      ) : result ? (
        <div className="space-y-6">
          {/* Chart */}
          {(displayMode === 'chart' || displayMode === 'both') && report.chartType !== 'table' && report.chartType !== 'none' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <ReportChart
                data={result.data}
                columns={result.columns}
                chartType={report.chartType}
                height={400}
              />
            </div>
          )}

          {/* Data Table */}
          {(displayMode === 'table' || displayMode === 'both') && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <ReportDataTable data={result.data} columns={result.columns} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}