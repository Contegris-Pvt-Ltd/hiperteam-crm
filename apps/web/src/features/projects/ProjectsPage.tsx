import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, Search, Plus, Loader2,
  ChevronLeft, ChevronRight, Building2,
  Calendar, Users, RefreshCw, X,
} from 'lucide-react';
import { projectsApi } from '../../api/projects.api';
import { usePermissions } from '../../hooks/usePermissions';
import type {
  Project, ProjectStatus, ProjectTemplate, ListProjectsParams,
} from '../../api/projects.api';
import { api } from '../../api/contacts.api';
import { teamsApi } from '../../api/teams.api';
import type { TeamLookupItem } from '../../api/teams.api';

// ============================================================
// HELPERS
// ============================================================

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const HEALTH_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  on_track:  { label: 'On Track',  dot: 'bg-green-500',  text: 'text-green-700 dark:text-green-400' },
  at_risk:   { label: 'At Risk',   dot: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-400' },
  off_track: { label: 'Off Track', dot: 'bg-red-500',    text: 'text-red-700 dark:text-red-400' },
};

const COLOR_SWATCHES = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6b7280',
];

// ============================================================
// PROJECTS PAGE
// ============================================================

export function ProjectsPage() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);

  const [ownerFilter, setOwnerFilter] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load statuses + users once
  useEffect(() => {
    projectsApi.getStatuses().then(setStatuses).catch(() => {});
    api.get('/users').then(res => {
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setUsers(list);
    }).catch(() => {});
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: ListProjectsParams = { page, limit };
      if (statusFilter !== 'all') params.statusId = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (ownerFilter) params.ownerId = ownerFilter;
      const res = await projectsApi.list(params);
      setProjects(res.data);
      setTotal(res.total);
    } catch {
      console.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, ownerFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { setPage(1); }, [statusFilter, search, ownerFilter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full">
                {total}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">Manage project delivery &amp; tasks</p>
          </div>
        </div>
        {canCreate('projects') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {users.length > 0 && (
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">All Owners</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>
                {(u.firstName || u.first_name || '')} {(u.lastName || u.last_name || '')}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={loadProjects}
          className="p-2 border border-gray-300 dark:border-slate-600 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 dark:border-slate-700 last:border-0 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <FolderKanban className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No projects found</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-4">
            {search || statusFilter !== 'all'
              ? 'Try changing your filters'
              : 'Create your first project to get started'}
          </p>
          {!search && statusFilter === 'all' && canCreate('projects') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Account</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Owner</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Health</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Progress</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Members</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {projects.map(project => {
                  const health = HEALTH_CONFIG[project.healthStatus] || HEALTH_CONFIG.on_track;
                  const taskTotal = project.taskCount || 0;
                  const taskDone = project.completedTaskCount || 0;
                  const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      {/* Name */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color || '#6366f1' }}
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                            {project.name}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3">
                        {project.statusName ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${project.statusColor || '#6b7280'}20`,
                              color: project.statusColor || '#6b7280',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: project.statusColor || '#6b7280' }}
                            />
                            {project.statusName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Account */}
                      <td className="px-6 py-3">
                        {project.accountName ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-slate-300 truncate max-w-[140px]">
                              {project.accountName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-3">
                        <span className="text-sm text-gray-700 dark:text-slate-300 truncate block max-w-[120px]">
                          {project.ownerName || '—'}
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                          <span className={`text-xs font-medium ${health.text}`}>
                            {health.label}
                          </span>
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100
                                  ? 'bg-green-500'
                                  : pct >= 50
                                    ? 'bg-purple-500'
                                    : 'bg-amber-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                            {taskDone}/{taskTotal}
                          </span>
                        </div>
                      </td>

                      {/* Members */}
                      <td className="px-6 py-3 text-center">
                        <div className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-slate-300">
                          <Users className="w-3.5 h-3.5" />
                          {project.memberCount || 0}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className={`${
                            project.endDate && new Date(project.endDate) < new Date() && !project.actualEndDate
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-600 dark:text-slate-300'
                          }`}>
                            {fmtDate(project.endDate)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {projects.map(project => {
              const health = HEALTH_CONFIG[project.healthStatus] || HEALTH_CONFIG.on_track;
              const taskTotal = project.taskCount || 0;
              const taskDone = project.completedTaskCount || 0;
              const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

              return (
                <div
                  key={project.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6366f1' }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{project.name}</span>
                    </div>
                    {project.statusName && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: `${project.statusColor || '#6b7280'}20`,
                          color: project.statusColor || '#6b7280',
                        }}
                      >
                        {project.statusName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                    {project.accountName || '—'}
                  </p>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                      <span className={`text-xs font-medium ${health.text}`}>{health.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                      <Users className="w-3 h-3" /> {project.memberCount || 0}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      Due {fmtDate(project.endDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-purple-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Showing {startIdx}–{endIdx} of {total} projects
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-gray-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(project) => {
            setShowCreateModal(false);
            navigate(`/projects/${project.id}`);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// CREATE PROJECT MODAL
// ============================================================

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Account search
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; name: string } | null>(null);

  // Owner & team
  const [ownerId, setOwnerId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [modalUsers, setModalUsers] = useState<any[]>([]);
  const [modalTeams, setModalTeams] = useState<TeamLookupItem[]>([]);

  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    projectsApi.getTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));

    Promise.all([
      api.get('/users'),
      teamsApi.getLookup(),
    ]).then(([usersRes, teamsData]) => {
      const uList = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.data || [];
      setModalUsers(uList);
      setModalTeams((teamsData as TeamLookupItem[]).filter((t: any) => t.isActive));
    }).catch(() => {});
  }, []);

  // Debounced account search
  useEffect(() => {
    if (!accountSearch.trim()) { setAccountResults([]); return; }
    const timer = setTimeout(async () => {
      setAccountSearchLoading(true);
      try {
        const res = await api.get(`/accounts?search=${encodeURIComponent(accountSearch)}&limit=10`);
        setAccountResults(res.data?.data || res.data || []);
      } catch { /* ignore */ }
      finally { setAccountSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [accountSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        templateId: templateId || undefined,
        color,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        accountId: selectedAccount?.id || undefined,
        ownerId: ownerId || undefined,
        teamId: teamId || undefined,
      } as any);
      onCreated(project);
    } catch {
      console.error('Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Account
            </label>
            {selectedAccount ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-700">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-900 dark:text-white flex-1">{selectedAccount.name}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedAccount(null); setAccountSearch(''); }}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Search accounts..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {accountSearchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
                {accountResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {accountResults.map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setSelectedAccount({ id: a.id, name: a.name || a.accountName || '' });
                          setAccountSearch('');
                          setAccountResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-600 first:rounded-t-xl last:rounded-b-xl"
                      >
                        {a.name || a.accountName || ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Owner
            </label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Unassigned</option>
              {modalUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {(u.firstName || u.first_name || '')} {(u.lastName || u.last_name || '')}
                </option>
              ))}
            </select>
          </div>

          {/* Team */}
          {modalTeams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Team
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No team</option>
                {modalTeams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loadingTemplates}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">No template (blank project)</option>
              {templates.filter(t => t.isActive).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.phaseCount ? ` (${t.phaseCount} phases)` : ''}
                  {t.estimatedDays ? ` · ~${t.estimatedDays}d` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-all ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-slate-800 scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
