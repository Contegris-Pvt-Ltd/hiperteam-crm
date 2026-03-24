import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Download, XCircle, CheckCircle2,
  Clock, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  ArrowLeft, RefreshCw,
} from 'lucide-react';
import { leadImportApi } from '../../api/lead-import.api';
import type { ImportJob } from '../../api/lead-import.api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: 'Pending', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800', icon: Clock },
  parsing: { label: 'Parsing', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Loader2 },
  processing: { label: 'Processing', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Loader2 },
  completed: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.floor((e.getTime() - s.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

export function BatchJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    // Refresh every 5 seconds for active jobs
    const interval = setInterval(() => {
      const hasActive = jobs.some(j => ['pending', 'processing', 'parsing'].includes(j.status));
      if (hasActive) fetchJobs(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [meta.page]);

  const fetchJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await leadImportApi.getJobs(meta.page, meta.limit);
      setJobs(result.data);
      setMeta(result.meta);
    } catch {
      // ignore
    }
    if (!silent) setLoading(false);
  };

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await leadImportApi.cancelJob(jobId);
      await fetchJobs(true);
    } catch {
      // ignore
    }
    setCancellingId(null);
  };

  const handleDownloadFailed = async (jobId: string) => {
    try {
      await leadImportApi.downloadFailed(jobId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Batch Jobs</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">View and manage import jobs</p>
          </div>
        </div>
        <button
          onClick={() => fetchJobs()}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No import jobs found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Import leads from the Leads page to see jobs here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedJob === job.id;
            const isActive = ['pending', 'processing', 'parsing'].includes(job.status);

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Main Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg ${statusConfig.bg} flex items-center justify-center flex-shrink-0`}>
                    <StatusIcon size={20} className={`${statusConfig.color} ${isActive ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {job.fileName}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatDate(job.createdAt)}
                      {job.creatorName && ` by ${job.creatorName}`}
                      {job.startedAt && ` · Duration: ${formatDuration(job.startedAt, job.completedAt)}`}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">{job.totalRecords.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600">{job.importedRecords.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Imported</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-red-600">{job.failedRecords.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Failed</p>
                    </div>
                  </div>

                  {/* Progress */}
                  {isActive && (
                    <div className="w-24">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${job.percentComplete}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 text-center mt-1">{job.percentComplete}%</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        disabled={cancellingId === job.id}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        {cancellingId === job.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                    {job.failedRecords > 0 && job.status !== 'processing' && (
                      <button
                        onClick={() => handleDownloadFailed(job.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                      >
                        <Download size={14} />
                        Failed
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Duplicate Strategy</p>
                        <p className="text-gray-900 dark:text-white capitalize">{job.settings?.duplicateStrategy || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Assignment</p>
                        <p className="text-gray-900 dark:text-white capitalize">{job.settings?.assignmentStrategy?.replace('_', ' ') || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Country Code</p>
                        <p className="text-gray-900 dark:text-white">{job.settings?.countryCode || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Duplicates Found</p>
                        <p className="text-gray-900 dark:text-white">{job.duplicateRecords.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Source</p>
                        <p className="text-gray-900 dark:text-white">{job.settings?.source || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Tags</p>
                        <p className="text-gray-900 dark:text-white">
                          {job.settings?.tags?.length > 0 ? job.settings.tags.join(', ') : 'None'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Skipped</p>
                        <p className="text-gray-900 dark:text-white">{job.skippedRecords.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">File Size</p>
                        <p className="text-gray-900 dark:text-white">
                          {job.fileSize ? `${(job.fileSize / 1024).toFixed(1)} KB` : '—'}
                        </p>
                      </div>
                    </div>

                    {job.errorMessage && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-700 dark:text-red-400">{job.errorMessage}</p>
                      </div>
                    )}

                    {/* Column Mapping */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-2">Column Mapping</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(job.columnMapping || {})
                          .filter(([, v]) => v !== '__skip__')
                          .map(([fileCol, leadField]) => (
                            <span key={fileCol} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-800 text-xs rounded text-gray-700 dark:text-gray-300">
                              {fileCol} → {leadField}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.total > meta.limit && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setMeta(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={meta.page <= 1}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">
            Page {meta.page} of {Math.ceil(meta.total / meta.limit)}
          </span>
          <button
            onClick={() => setMeta(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={meta.page >= Math.ceil(meta.total / meta.limit)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
