import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Plus, Search, Play, Pause, Trash2, Edit2,
  Activity, Clock, CheckCircle, XCircle, ChevronRight,
  UserPlus, Users, Building2, TrendingUp, CheckSquare,
  FolderKanban, MoreVertical,
} from 'lucide-react';
import type { Workflow, TriggerModule } from '../../api/workflows.api';
import { workflowsApi, TRIGGER_MODULES } from '../../api/workflows.api';

// ── Module icon map ──────────────────────────────────────────
const MODULE_ICONS: Record<TriggerModule, React.ElementType> = {
  leads:         UserPlus,
  contacts:      Users,
  accounts:      Building2,
  opportunities: TrendingUp,
  tasks:         CheckSquare,
  projects:      FolderKanban,
};

const MODULE_COLORS: Record<TriggerModule, string> = {
  leads:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  contacts:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  accounts:      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  opportunities: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tasks:         'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  projects:      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

function triggerLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── WorkflowCard ─────────────────────────────────────────────
function WorkflowCard({
  workflow,
  onToggle,
  onDelete,
  onEdit,
  onViewRuns,
}: {
  workflow: Workflow;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onViewRuns: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ModIcon = MODULE_ICONS[workflow.triggerModule] ?? Zap;
  const modColor = MODULE_COLORS[workflow.triggerModule] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 transition-all hover:shadow-md group">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${modColor}`}>
            <ModIcon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {workflow.name}
              </h3>
              {/* Active badge */}
              <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                workflow.isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${workflow.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                {workflow.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {workflow.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 truncate mb-2">
                {workflow.description}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium ${modColor}`}>
                <ModIcon className="w-3.5 h-3.5" />
                {TRIGGER_MODULES.find(m => m.value === workflow.triggerModule)?.label ?? workflow.triggerModule}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                {triggerLabel(workflow.triggerType)}
              </span>
              {workflow.actionCount !== undefined && (
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {workflow.actionCount} action{workflow.actionCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">
                {timeAgo(workflow.updatedAt)}
              </span>
            </div>
          </div>

          {/* Actions menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(workflow.id); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onViewRuns(workflow.id); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Activity className="w-4 h-4" /> Run History
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onToggle(workflow.id, !workflow.isActive); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    {workflow.isActive
                      ? <><Pause className="w-4 h-4" /> Deactivate</>
                      : <><Play className="w-4 h-4" /> Activate</>
                    }
                  </button>
                  <div className="border-t border-gray-100 dark:border-slate-700" />
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(workflow.id); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar — click to edit */}
      <div
        className="px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-b-xl transition-colors"
        onClick={() => onEdit(workflow.id)}
      >
        <span className="text-xs text-gray-400 dark:text-slate-500">
          v{workflow.version}
        </span>
        <span className="text-xs text-violet-600 dark:text-violet-400 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Open Builder <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────
function StatsBar({ workflows }: { workflows: Workflow[] }) {
  const active   = workflows.filter(w => w.isActive).length;
  const inactive = workflows.filter(w => !w.isActive).length;
  const total    = workflows.length;
  const moduleCount = new Set(workflows.map(w => w.triggerModule)).size;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total',    value: total,       icon: Zap,          color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
        { label: 'Active',   value: active,      icon: CheckCircle,  color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20' },
        { label: 'Inactive', value: inactive,    icon: XCircle,      color: 'text-gray-500 dark:text-slate-400',    bg: 'bg-gray-50 dark:bg-slate-800' },
        { label: 'Modules',  value: moduleCount, icon: Clock,        color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20' },
      ].map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
          <Icon className={`w-5 h-5 ${color}`} />
          <div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DELETE CONFIRM MODAL ──────────────────────────────────────
function DeleteModal({
  workflow,
  onConfirm,
  onCancel,
}: {
  workflow: Workflow;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center mb-4">
          <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Workflow</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Are you sure you want to delete <span className="font-medium text-gray-800 dark:text-slate-200">"{workflow.name}"</span>?
          This will also delete all run history. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export function WorkflowListPage() {
  const navigate = useNavigate();

  const [workflows, setWorkflows]       = useState<Workflow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [moduleFilter, setModuleFilter] = useState<TriggerModule | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await workflowsApi.list(moduleFilter || undefined);
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const updated = await workflowsApi.toggle(id, isActive);
      setWorkflows(prev => prev.map(w => w.id === id ? updated : w));
    } catch {
      // silent
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await workflowsApi.delete(deleteTarget.id);
      setWorkflows(prev => prev.filter(w => w.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  // Filter client-side
  const filtered = workflows.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'active'   && !w.isActive) return false;
    if (statusFilter === 'inactive' && w.isActive)  return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            Workflows
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Automate actions based on events in your CRM
          </p>
        </div>
        <button
          onClick={() => navigate('/workflows/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Stats */}
      {!loading && <StatsBar workflows={workflows} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Module filter */}
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value as TriggerModule | '')}
          className="px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All Modules</option>
          {TRIGGER_MODULES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700/50 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-violet-50 dark:bg-violet-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-violet-400" />
          </div>
          {workflows.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No workflows yet</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                Workflows automate repetitive tasks — assign leads, send notifications, create follow-ups, and more.
              </p>
              <button
                onClick={() => navigate('/workflows/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Create your first workflow
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Try adjusting your search or filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(workflow => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onToggle={handleToggle}
              onDelete={wf => setDeleteTarget(workflows.find(w => w.id === wf) ?? null)}
              onEdit={id => navigate(`/workflows/${id}/edit`)}
              onViewRuns={id => navigate(`/workflows/${id}/runs`)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          workflow={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-sm text-gray-600 dark:text-slate-300">Deleting…</div>
        </div>
      )}
    </div>
  );
}
