import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Activity, CheckCircle, XCircle, Clock, Loader2,
  ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import type { Workflow, WorkflowRun, WorkflowRunStep } from '../../api/workflows.api';
import { workflowsApi } from '../../api/workflows.api';

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
    completed: { icon: CheckCircle, cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20', label: 'Completed' },
    failed:    { icon: XCircle,    cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',       label: 'Failed' },
    running:   { icon: Loader2,    cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 animate-pulse', label: 'Running' },
    skipped:   { icon: Clock,      cls: 'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800',    label: 'Skipped' },
    pending:   { icon: Clock,      cls: 'text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800',    label: 'Pending' },
  };
  const { icon: Icon, cls, label } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'running…';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString();
}

// ── Run row ───────────────────────────────────────────────────
function RunRow({ run }: { run: WorkflowRun }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<WorkflowRun | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDetail = useCallback(async () => {
    if (detail) return;
    setLoadingDetail(true);
    try {
      const d = await workflowsApi.getRunDetail(run.id);
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  }, [run.id, detail]);

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) loadDetail();
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
        onClick={handleExpand}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={run.status} />
            <span className="text-sm text-gray-700 dark:text-slate-300 font-mono truncate">
              {run.triggerEntityId}
            </span>
            <span className="text-xs text-gray-400">
              {run.triggerType.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
            <span>{formatDate(run.startedAt)}</span>
            <span>Duration: {formatDuration(run.startedAt, run.finishedAt)}</span>
          </div>
        </div>

        {run.error && (
          <span className="text-xs text-red-500 dark:text-red-400 max-w-xs truncate">{run.error}</span>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-4">
          {loadingDetail ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading steps…
            </div>
          ) : detail?.steps?.length ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Action Steps
              </div>
              {detail.steps.map((step: WorkflowRunStep) => (
                <div key={step.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <StatusBadge status={step.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      {step.actionType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    {step.result && Object.keys(step.result).length > 0 && (
                      <pre className="text-xs text-gray-500 dark:text-slate-400 mt-1 overflow-auto max-h-20 bg-white dark:bg-slate-800 rounded p-2 border border-gray-100 dark:border-slate-700">
                        {JSON.stringify(step.result, null, 2)}
                      </pre>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-500 mt-1">{step.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDuration(step.startedAt, step.finishedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No step details available.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export function WorkflowRunsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [workflow, setWorkflow]   = useState<Workflow | null>(null);
  const [runs, setRuns]           = useState<WorkflowRun[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const LIMIT = 25;

  useEffect(() => {
    if (!id) return;
    workflowsApi.getOne(id).then(setWorkflow).catch(() => {});
  }, [id]);

  const loadRuns = useCallback(async (p = 1, isRefresh = false) => {
    if (!id) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await workflowsApi.getRuns(id, p, LIMIT);
      setRuns(res.data);
      setTotal(res.total);
      setPage(p);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadRuns(1); }, [loadRuns]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const completed = runs.filter(r => r.status === 'completed').length;
  const failed    = runs.filter(r => r.status === 'failed').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(id ? `/workflows/${id}/edit` : '/workflows')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-500" />
            Run History
          </h1>
          {workflow && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{workflow.name}</p>
          )}
        </div>
        <button
          onClick={() => loadRuns(page, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && runs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Runs',  value: total,     cls: 'text-violet-600 dark:text-violet-400' },
            { label: 'Completed',   value: completed, cls: 'text-green-600 dark:text-green-400' },
            { label: 'Failed',      value: failed,    cls: 'text-red-500 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-center">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-1">No runs yet</h3>
          <p className="text-sm text-gray-400 dark:text-slate-500">
            This workflow hasn't been triggered yet. Runs will appear here once the trigger fires.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {runs.map(run => <RunRow key={run.id} run={run} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-gray-500 dark:text-slate-400">
                Page {page} of {totalPages} · {total} runs
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => loadRuns(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadRuns(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
