// ============================================================
// FILE: apps/web/src/features/reports/ReportsPage.tsx
//
// Main reports listing page. Shows:
//   - My Reports (user-created)
//   - Report Library (pre-built system reports)
//   - Folders navigation
//   - Search + category filter
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, BarChart3, PieChart, TrendingUp, Table2,
  Folder, FolderOpen, Copy, Trash2, Pencil, Play,
  BookOpen, Grid, List,
} from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import type { Report, ReportFolder, ReportsQuery } from '../../api/reports.api';
import { usePermissions } from '../../hooks/usePermissions';

type ViewMode = 'my_reports' | 'library';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'pipeline', label: 'Pipeline & Deals' },
  { value: 'leads', label: 'Leads' },
  { value: 'activity', label: 'Activities' },
  { value: 'contacts', label: 'Contacts & Accounts' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'targets', label: 'Targets' },
  { value: 'custom', label: 'Custom' },
];

const CHART_ICONS: Record<string, any> = {
  bar: BarChart3,
  stacked_bar: BarChart3,
  line: TrendingUp,
  pie: PieChart,
  table: Table2,
  funnel: TrendingUp,
  scatter: BarChart3,
  gauge: BarChart3,
};

export function ReportsPage() {
  const navigate = useNavigate();
  const { canCreate, canDelete, canEdit } = usePermissions();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('my_reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [library, setLibrary] = useState<Record<string, Report[]>>({});
  const [folders, setFolders] = useState<ReportFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Query
  const [query, setQuery] = useState<ReportsQuery>({ page: 1, limit: 50, sortBy: 'name', sortOrder: 'ASC' });

  // ── Fetch ──

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...query, search: searchInput || undefined, category: category || undefined, folderId: activeFolderId };
      const res = await reportsApi.getAll(params);
      setReports(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [query, searchInput, category, activeFolderId]);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportsApi.getLibrary();
      setLibrary(data);
    } catch (err) {
      console.error('Failed to fetch library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const data = await reportsApi.getFolders();
      setFolders(data);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (viewMode === 'my_reports') {
      fetchReports();
    } else {
      fetchLibrary();
    }
  }, [viewMode, fetchReports, fetchLibrary]);

  // ── Handlers ──

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(prev => ({ ...prev, page: 1 }));
  };

  const handleClone = async (id: string) => {
    try {
      const cloned = await reportsApi.clone(id);
      navigate(`/reports/${cloned.id}`);
    } catch (err) {
      console.error('Clone failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await reportsApi.delete(id);
      setShowDeleteConfirm(null);
      fetchReports();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // ── Render Helpers ──

  const renderReportCard = (report: Report) => {
    const ChartIcon = CHART_ICONS[report.chartType] || BarChart3;
    const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === report.category)?.label || report.category;

    return (
      <div
        key={report.id}
        className={`group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer ${
          layoutMode === 'list' ? 'flex items-center p-4 gap-4' : 'p-5'
        }`}
        onClick={() => navigate(`/reports/${report.id}`)}
      >
        {/* Icon */}
        <div className={`${layoutMode === 'list' ? '' : 'mb-3'} flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <ChartIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          {layoutMode === 'list' && (
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">{report.name}</h3>
              <p className="text-xs text-gray-500 truncate">{report.description || categoryLabel}</p>
            </div>
          )}
        </div>

        {layoutMode === 'grid' && (
          <>
            <h3 className="font-medium text-gray-900 dark:text-white truncate">{report.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {report.description || `${categoryLabel} report`}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {categoryLabel}
              </span>
              {report.isSystem && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  System
                </span>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className={`${layoutMode === 'list' ? '' : 'mt-3 pt-3 border-t border-gray-100 dark:border-gray-700'} flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/reports/${report.id}`)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
            title="Run Report"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleClone(report.id)}
            className="p-1.5 text-gray-400 hover:text-green-600 rounded"
            title="Clone"
          >
            <Copy className="w-4 h-4" />
          </button>
          {!report.isSystem && canEdit('reports') && (
            <button
              onClick={() => navigate(`/reports/${report.id}/edit`)}
              className="p-1.5 text-gray-400 hover:text-yellow-600 rounded"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {!report.isSystem && canDelete('reports') && (
            <button
              onClick={() => setShowDeleteConfirm(report.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Analyze your CRM data with pre-built and custom reports</p>
        </div>
        {canCreate('reports') && (
          <button
            onClick={() => navigate('/reports/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setViewMode('my_reports')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'my_reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            All Reports
          </div>
        </button>
        <button
          onClick={() => setViewMode('library')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            viewMode === 'library'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Report Library
          </div>
        </button>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex items-center gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search reports..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </form>

        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setQuery(prev => ({ ...prev, page: 1 })); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setLayoutMode('grid')}
            className={`p-2 ${layoutMode === 'grid' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('list')}
            className={`p-2 ${layoutMode === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : viewMode === 'my_reports' ? (
        <>
          {/* Folder pills */}
          {folders.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setActiveFolderId(undefined)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  !activeFolderId ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFolderId(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors ${
                    activeFolderId === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {activeFolderId === f.id ? <FolderOpen className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Reports grid/list */}
          {reports.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-500 mb-1">No reports found</h3>
              <p className="text-sm text-gray-400 mb-4">
                {searchInput || category ? 'Try adjusting your filters' : 'Start by creating a custom report or cloning one from the library'}
              </p>
              {canCreate('reports') && (
                <button
                  onClick={() => navigate('/reports/new')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Create Report
                </button>
              )}
            </div>
          ) : (
            <div className={layoutMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-2'
            }>
              {reports.map(renderReportCard)}
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-gray-500">
                {meta.total} report{meta.total !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuery(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  disabled={meta.page <= 1}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => setQuery(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  disabled={meta.page >= meta.totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Library View ── */
        <div className="space-y-8">
          {Object.entries(library).map(([folderName, folderReports]) => (
            <div key={folderName}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <Folder className="w-5 h-5 text-blue-500" />
                {folderName}
                <span className="text-sm font-normal text-gray-400">({folderReports.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {folderReports.map(renderReportCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Report</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}