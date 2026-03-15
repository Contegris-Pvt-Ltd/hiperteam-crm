// ============================================================
// FILE: apps/web/src/features/projects/ProjectDetailPage.tsx
//
// Shell + Kanban view + TaskDetailPanel + TimeReportView
// ============================================================
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, List, GanttChartSquare, CalendarDays, Clock, Activity,
  Paperclip, ChevronLeft, ChevronDown, ChevronRight, X, Loader2, Plus, Users, MessageSquare,
  Timer, CheckCircle2, Building2, Calendar, User, Settings2, CheckSquare, AlertTriangle,
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, useDroppable,
  useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { projectsApi } from '../../api/projects.api';
import { approvalsApi } from '../../api/approvals.api';
import { usePermissions } from '../../hooks/usePermissions';
import { DocumentsPanel } from '../../components/shared/DocumentsPanel';
import { api } from '../../api/contacts.api';
import { teamsApi } from '../../api/teams.api';
import type { TeamLookupItem } from '../../api/teams.api';
import type {
  Project, ProjectTask, ProjectTaskStatus,
  ProjectTaskComment, KanbanColumn, TimeReport,
  ProjectMember, ProjectTimeEntry, ProjectActivity,
  TaskDependency,
} from '../../api/projects.api';

// ============================================================
// CONSTANTS & HELPERS
// ============================================================

const TABS = [
  { id: 'kanban',   label: 'Kanban',   icon: LayoutGrid },
  { id: 'list',     label: 'List',     icon: List },
  { id: 'gantt',    label: 'Gantt',    icon: GanttChartSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'time',     label: 'Time',     icon: Clock },
  { id: 'files',    label: 'Files',    icon: Paperclip },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const;

type Tab = typeof TABS[number]['id'];

const HEALTH_CONFIG: Record<string, { label: string; color: string; ring: string }> = {
  on_track:  { label: 'On Track',  color: 'text-green-600 dark:text-green-400',  ring: 'border-green-500' },
  at_risk:   { label: 'At Risk',   color: 'text-amber-600 dark:text-amber-400',  ring: 'border-amber-500' },
  off_track: { label: 'Off Track', color: 'text-red-600 dark:text-red-400',      ring: 'border-red-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; badge: string }> = {
  low:    { label: 'Low',    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  medium: { label: 'Medium', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high:   { label: 'High',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  urgent: { label: 'Urgent', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const AVATAR_COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
];

function avatarColor(userId?: string | null) {
  if (!userId) return AVATAR_COLORS[0];
  return AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

function minutesToHours(m: number) {
  return (m / 60).toFixed(1) + 'h';
}

// ============================================================
// ACTIVITY HELPERS
// ============================================================

function activityDotColor(type: string): string {
  switch (type) {
    case 'created':           return 'bg-green-500';
    case 'updated':           return 'bg-blue-500';
    case 'status_changed':    return 'bg-purple-500';
    case 'due_date_changed':  return 'bg-yellow-500';
    case 'assignee_changed':  return 'bg-indigo-500';
    case 'member_added':      return 'bg-teal-500';
    case 'member_removed':    return 'bg-red-400';
    case 'deleted':           return 'bg-red-500';
    default:                  return 'bg-gray-400';
  }
}

function activityIcon(type: string): string {
  switch (type) {
    case 'created':           return '✦';
    case 'updated':           return '✎';
    case 'status_changed':    return '⇄';
    case 'due_date_changed':  return '📅';
    case 'assignee_changed':  return '👤';
    case 'member_added':      return '+';
    case 'member_removed':    return '−';
    case 'deleted':           return '✕';
    default:                  return '·';
  }
}

// ============================================================
// PROJECT DETAIL PAGE
// ============================================================

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canCreate, canEdit } = usePermissions();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('kanban');

  // Kanban
  const [kanbanData, setKanbanData] = useState<KanbanColumn[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);

  // Task detail
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

  // Create task modal
  const [createTaskModal, setCreateTaskModal] = useState<{
    phaseId: string | null;
    statusId: string;
    statusName: string;
  } | null>(null);

  // Task statuses (shared between TaskDetailPanel and CreateTaskModal)
  const [taskStatuses, setTaskStatuses] = useState<ProjectTaskStatus[]>([]);

  // Add member modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Phase filter (Kanban)
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Activity
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState(0);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Documents
  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [projectDocumentsLoading, setProjectDocumentsLoading] = useState(false);

  // Close guard (prevent closing project with open tasks)
  const [closeGuard, setCloseGuard] = useState<{
    pendingStatusId: string;
    openTasks: { id: string; title: string }[];
  } | null>(null);
  const [closeGuardLoading, setCloseGuardLoading] = useState(false);

  // Approval
  const [projectApproval, setProjectApproval] = useState<any>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Sidebar data
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // ── Load project ──────────────────────────────────────────
  const fetchProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await projectsApi.getById(id);
      if (!data) { navigate('/projects'); return; }
      setProject(data);
      // Check if there is an active approval request for this project
      approvalsApi
        .getEntityRequest('projects', id!)
        .then(setProjectApproval)
        .catch(() => {});
    } catch {
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const reloadProject = async () => {
    const p = await projectsApi.getById(id!);
    if (p) setProject(p);
  };

  // ── Load task statuses + sidebar data once ─────────────────
  useEffect(() => {
    projectsApi.getTaskStatuses().then(setTaskStatuses).catch(console.error);
    projectsApi.getStatuses().then(setStatuses).catch(() => {});
    api.get('/users').then(res => {
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setUsers(list);
    }).catch(() => {});
    teamsApi.getLookup().then(data => {
      setTeams((data as TeamLookupItem[]).filter((t: any) => t.isActive));
    }).catch(() => {});
  }, []);

  // Debounced account search for sidebar
  useEffect(() => {
    if (!accountSearch.trim()) {
      setAccountResults([]);
      setShowAccountDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setAccountSearchLoading(true);
      try {
        const res = await api.get(
          `/accounts?search=${encodeURIComponent(accountSearch)}&limit=10`
        );
        setAccountResults(res.data?.data || res.data || []);
        setShowAccountDropdown(true);
      } catch { /* ignore */ }
      finally { setAccountSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [accountSearch]);

  // ── Load kanban after project loads ───────────────────────
  const loadKanban = useCallback(async () => {
    if (!id) return;
    setKanbanLoading(true);
    try {
      const cols = await projectsApi.getKanban(id);
      setKanbanData(cols);
    } catch {
      console.error('Failed to load kanban');
    } finally {
      setKanbanLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (project && activeTab === 'kanban' && kanbanData.length === 0) {
      loadKanban();
    }
  }, [project, activeTab, kanbanData.length, loadKanban]);

  // ── Tab change data loading ───────────────────────────────
  useEffect(() => {
    if (!id || !project) return;
    if (activeTab === 'kanban' && kanbanData.length === 0) {
      loadKanban();
    }
    // time tab loads inside TimeReportView on mount
  }, [activeTab]);

  // ── Load activities when tab is selected ────────────────────
  useEffect(() => {
    if (activeTab !== 'activity') return;
    if (!project?.id) return;
    setActivitiesLoading(true);
    Promise.all([
      projectsApi.getActivities(project.id, activitiesPage, 50),
      projectsApi.getTaskActivities(project.id, 1, 200),
    ])
      .then(([projRes, taskRes]) => {
        const merged = [...projRes.data, ...taskRes.data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setActivities(prev =>
          activitiesPage === 1 ? merged : [...prev, ...merged]
        );
        setActivitiesTotal(projRes.total + taskRes.total);
      })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, [activeTab, project?.id, activitiesPage]);

  // ── Load documents when files tab is selected ─────────────
  useEffect(() => {
    if (activeTab !== 'files') return;
    if (!project?.id) return;
    setProjectDocumentsLoading(true);
    projectsApi
      .getDocuments(project.id)
      .then(docs => setProjectDocuments(Array.isArray(docs) ? docs : []))
      .catch(() => {})
      .finally(() => setProjectDocumentsLoading(false));
  }, [activeTab, project?.id]);

  // ── Task status change ────────────────────────────────────
  const handleTaskStatusChange = async (taskId: string, newStatusId: string) => {
    if (!id) return;
    try {
      await projectsApi.updateTask(id, taskId, { statusId: newStatusId } as any);
      loadKanban();
    } catch {
      console.error('Failed to update task status');
    }
  };

  // ── Project status change (with close guard) ─────────────
  const applyStatusChange = async (statusId: string) => {
    try {
      await projectsApi.update(id!, { statusId });
      reloadProject();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleStatusChange = async (newStatusId: string) => {
    if (!project) return;

    // Check if the new status is a closed status
    const newStatus = statuses.find((s: any) => s.id === newStatusId);
    const isClosed = newStatus?.isClosed || newStatus?.is_closed;

    if (isClosed) {
      setCloseGuardLoading(true);
      try {
        const result = await projectsApi.getOpenTasksCount(project.id);
        if (result.count > 0) {
          setCloseGuard({
            pendingStatusId: newStatusId,
            openTasks: result.tasks,
          });
          return;
        }
      } catch {
        // If check fails, allow the change
      } finally {
        setCloseGuardLoading(false);
      }
    }

    await applyStatusChange(newStatusId);
  };

  // ── Derived values ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-slate-400">Project not found</p>
        <button onClick={() => navigate('/projects')} className="mt-4 text-purple-600 hover:underline">
          Back to Projects
        </button>
      </div>
    );
  }

  const health = HEALTH_CONFIG[project.healthStatus] || HEALTH_CONFIG.on_track;
  const allTasks = [
    ...(project.phases?.flatMap((ph: any) => ph.tasks || []) ?? []),
    ...(project.unassignedTasks ?? []),
  ];
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t: any) => t.isDone).length;
  const progressPct = totalTasks > 0
    ? Math.min(100, Math.round((doneTasks / totalTasks) * 100))
    : 0;
  const members = project.members || [];

  return (
    <div className="animate-fadeIn">
      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Projects
      </button>

      {/* Main layout: content + sidebar */}
      <div className="flex gap-6">
        {/* LEFT — Main content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            {/* Row 1: Name + Status */}
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color || '#6366f1' }}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                {project.name}
              </h1>
              <select
                value={project.statusId || ''}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={closeGuardLoading}
                className={`appearance-none inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full flex-shrink-0 border-0 cursor-pointer focus:ring-2 focus:ring-purple-500${closeGuardLoading ? ' opacity-50' : ''}`}
                style={{
                  backgroundColor: `${project.statusColor || '#6b7280'}20`,
                  color: project.statusColor || '#6b7280',
                }}
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id} style={{ color: '#111' }}>{s.name}</option>
                ))}
              </select>

              {!projectApproval && canEdit('projects') && (
                <button
                  onClick={async () => {
                    setApprovalLoading(true);
                    try {
                      const req = await projectsApi.requestApproval(project.id);
                      setProjectApproval(req);
                    } catch { /* ignore */ }
                    finally { setApprovalLoading(false); }
                  }}
                  disabled={approvalLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {approvalLoading ? '...' : 'Request Approval'}
                </button>
              )}
            </div>

            {/* Row 2: meta info */}
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 ml-6">
              {project.accountName && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {project.accountName}
                </span>
              )}
              {project.ownerName && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {project.ownerName}
                </span>
              )}
              {(project.startDate || project.endDate) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {fmtShortDate(project.startDate)} → {fmtShortDate(project.endDate)}
                </span>
              )}
            </div>
          </div>

          {/* Approval banners */}
          {projectApproval && projectApproval.status === 'pending' && (
            <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 text-sm">&#9203;</span>
                <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Approval pending
                </span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  — awaiting review before work can start
                </span>
              </div>
              <button
                onClick={() => {
                  approvalsApi.cancel(projectApproval.id)
                    .then(() => setProjectApproval(null))
                    .catch(() => {});
                }}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0"
              >
                Cancel request
              </button>
            </div>
          )}

          {projectApproval && projectApproval.status === 'approved' && (
            <div className="mb-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
              <span className="text-green-600 dark:text-green-400 text-sm">&#10003;</span>
              <span className="text-sm text-green-800 dark:text-green-300 font-medium">
                Approved
              </span>
              {projectApproval.completedAt && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  · {new Date(projectApproval.completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {projectApproval && projectApproval.status === 'rejected' && (
            <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-sm">&#10005;</span>
                <span className="text-sm text-red-800 dark:text-red-300 font-medium">
                  Approval rejected
                </span>
                {projectApproval.comment && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    · {projectApproval.comment}
                  </span>
                )}
              </div>
              <button
                onClick={async () => {
                  setApprovalLoading(true);
                  try {
                    const req = await projectsApi.requestApproval(project.id);
                    setProjectApproval(req);
                  } catch { /* ignore */ }
                  finally { setApprovalLoading(false); }
                }}
                disabled={approvalLoading}
                className="text-xs text-red-600 dark:text-red-400 hover:underline flex-shrink-0 disabled:opacity-50"
              >
                Re-request approval
              </button>
            </div>
          )}

          {/* Tab bar */}
          <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.filter(tab => tab.id !== 'settings' || canEdit('projects')).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'kanban' && (
            <>
              {/* Phase filter */}
              {project.phases && project.phases.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Phase:</label>
                  <select
                    value={phaseFilter}
                    onChange={e => setPhaseFilter(e.target.value)}
                    className="text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white px-3 py-1.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">All Phases</option>
                    {project.phases.map((ph: any) => (
                      <option key={ph.id} value={ph.id}>{ph.name}</option>
                    ))}
                    <option value="__none__">Ungrouped Tasks</option>
                  </select>
                </div>
              )}
              <KanbanView
                columns={
                  phaseFilter === 'all'
                    ? kanbanData
                    : kanbanData.map(col => ({
                        ...col,
                        tasks: col.tasks.filter((t: ProjectTask) =>
                          phaseFilter === '__none__'
                            ? !t.phaseId
                            : t.phaseId === phaseFilter
                        ),
                      }))
                }
                loading={kanbanLoading}
                onTaskClick={setSelectedTask}
                onTaskStatusChange={handleTaskStatusChange}
                onAddTask={(phaseId, statusId, statusName) =>
                  setCreateTaskModal({ phaseId, statusId, statusName })
                }
                canCreateTask={canCreate('projects')}
              />
            </>
          )}
          {activeTab === 'list' && (
            <ListView
              projectId={id!}
              project={project}
              onTaskClick={setSelectedTask}
              onAddTask={(phaseId, statusId, statusName) =>
                setCreateTaskModal({ phaseId, statusId, statusName })
              }
              taskStatuses={taskStatuses}
              canCreateTask={canCreate('projects')}
            />
          )}
          {activeTab === 'gantt' && project && (
            <GanttView
              projectId={id!}
              project={project}
              onTaskClick={setSelectedTask}
            />
          )}
          {/* ── CALENDAR VIEW ─────────────────────────────────── */}
          {activeTab === 'calendar' && (() => {
            const year  = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();

            // Build grid: weeks × 7 days
            const firstDay  = new Date(year, month, 1);
            const lastDay   = new Date(year, month + 1, 0);
            const startGrid = new Date(firstDay);
            startGrid.setDate(startGrid.getDate() - firstDay.getDay());
            const endGrid = new Date(lastDay);
            endGrid.setDate(endGrid.getDate() + (6 - lastDay.getDay()));

            const weeks: Date[][] = [];
            const cursor = new Date(startGrid);
            while (cursor <= endGrid) {
              const week: Date[] = [];
              for (let i = 0; i < 7; i++) {
                week.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
              }
              weeks.push(week);
            }

            // Map tasks by due date (YYYY-MM-DD key)
            const tasksByDate: Record<string, ProjectTask[]> = {};
            allTasks.forEach((task: ProjectTask) => {
              if (!task.dueDate) return;
              const key = task.dueDate.slice(0, 10);
              if (!tasksByDate[key]) tasksByDate[key] = [];
              tasksByDate[key].push(task);
            });

            const todayStr = new Date().toISOString().slice(0, 10);

            return (
              <div className="flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden" style={{ minHeight: '500px' }}>
                {/* Month nav */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                    {firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div
                      key={d}
                      className="py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-400"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Weeks grid */}
                <div className="flex-1 overflow-y-auto">
                  {weeks.map((week, wi) => (
                    <div
                      key={wi}
                      className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700 last:border-0"
                      style={{ minHeight: '100px' }}
                    >
                      {week.map((day, di) => {
                        const dayStr  = day.toISOString().slice(0, 10);
                        const isToday = dayStr === todayStr;
                        const isOther = day.getMonth() !== month;
                        const dayTasks = tasksByDate[dayStr] || [];

                        return (
                          <div
                            key={di}
                            className={`p-1.5 border-r border-gray-200 dark:border-slate-700 last:border-0 ${
                              isOther ? 'bg-gray-50 dark:bg-slate-800/50' : ''
                            }`}
                          >
                            {/* Day number */}
                            <div className="flex justify-end mb-1">
                              <span
                                className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                                  isToday
                                    ? 'bg-purple-600 text-white'
                                    : isOther
                                    ? 'text-gray-400 dark:text-slate-600'
                                    : 'text-gray-700 dark:text-slate-300'
                                }`}
                              >
                                {day.getDate()}
                              </span>
                            </div>

                            {/* Tasks */}
                            <div className="flex flex-col gap-0.5">
                              {dayTasks.slice(0, 3).map((task: ProjectTask) => (
                                <button
                                  key={task.id}
                                  onClick={() => setSelectedTask(task)}
                                  className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors"
                                >
                                  {task.title}
                                </button>
                              ))}
                              {dayTasks.length > 3 && (
                                <span className="text-xs text-gray-400 dark:text-slate-500 px-1">
                                  +{dayTasks.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {activeTab === 'activity' && (
            <div className="flex flex-col gap-0 max-w-2xl mx-auto py-4 px-2">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  Activity
                </h3>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {activitiesTotal} event{activitiesTotal !== 1 ? 's' : ''}
                </span>
              </div>

              {activitiesLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                </div>
              )}

              {!activitiesLoading && activities.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                  No activity yet.
                </p>
              )}

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                {activities.length > 0 && (
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />
                )}

                <div className="flex flex-col gap-4">
                  {activities.map((act: ProjectActivity) => (
                    <div key={act.id} className="flex gap-3 relative">
                      {/* Dot */}
                      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold z-10 ${activityDotColor(act.activityType)}`}>
                        {activityIcon(act.activityType)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-gray-800 dark:text-slate-200 font-medium leading-snug">
                          {act.title}
                        </p>
                        {act.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {act.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                          {act.performedBy ? `${act.performedBy.firstName} ${act.performedBy.lastName}` : 'System'} ·{' '}
                          {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Load more */}
              {activities.length < activitiesTotal && (
                <button
                  onClick={() => setActivitiesPage(p => p + 1)}
                  className="mt-4 text-xs text-purple-600 dark:text-purple-400 hover:underline self-center"
                >
                  Load more
                </button>
              )}
            </div>
          )}
          {activeTab === 'time' && <TimeReportView projectId={id!} />}
          {activeTab === 'files' && (
            <div className="p-4 h-full overflow-y-auto">
              <DocumentsPanel
                entityType="projects"
                entityId={project.id}
                documents={projectDocuments}
                loading={projectDocumentsLoading}
                onDocumentUploaded={(doc) =>
                  setProjectDocuments(prev => [doc, ...prev])
                }
                onDocumentDeleted={(docId) =>
                  setProjectDocuments(prev => prev.filter(d => d.id !== docId))
                }
              />
            </div>
          )}
          {activeTab === 'settings' && canEdit('projects') && (
            <ProjectSettingsTab
              project={project}
              projectId={id!}
              statuses={statuses}
              users={users}
              teams={teams}
              accountSearch={accountSearch}
              setAccountSearch={setAccountSearch}
              accountResults={accountResults}
              setAccountResults={setAccountResults}
              accountSearchLoading={accountSearchLoading}
              showAccountDropdown={showAccountDropdown}
              setShowAccountDropdown={setShowAccountDropdown}
              onSaved={reloadProject}
            />
          )}
        </div>

        {/* RIGHT — Sidebar (md+ only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0 space-y-5">
          {/* Health Score */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Health</p>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full border-4 ${health.ring} flex items-center justify-center`}>
                <span className={`text-lg font-bold ${health.color}`}>
                  {project.healthScore}
                </span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${health.color}`}>{health.label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Health Score</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Progress</p>
            <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">{doneTasks}</span> / {totalTasks} tasks complete
            </p>
            <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct === 100
                    ? 'bg-green-500'
                    : progressPct >= 50
                      ? 'bg-purple-500'
                      : 'bg-amber-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 text-right">{progressPct}%</p>
          </div>

          {/* Members */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Members</p>
              <span className="text-xs text-gray-400 dark:text-slate-500">{project.memberCount || members.length}</span>
            </div>
            {members.length > 0 ? (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-full ${avatarColor(m.userId)} flex items-center justify-center text-white text-xs font-medium`}>
                        {(m.firstName || '?').charAt(0)}{(m.lastName || '?').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{m.firstName || ''} {m.lastName || ''}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{m.role}</p>
                      </div>
                    </div>
                    {canEdit('projects') && (
                      <button
                        onClick={async () => {
                          try {
                            await projectsApi.removeMember(project!.id, m.userId);
                            reloadProject();
                          } catch { /* ignore */ }
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove member"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500">No members yet</p>
            )}
            {canEdit('projects') && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className="mt-3 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Member
              </button>
            )}
          </div>

          {/* Portal */}
          {project.clientPortalEnabled && (
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <Users className="w-4 h-4" /> Share Portal
            </button>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        projectId={id!}
        projectTeamId={project?.teamId || null}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => {
          setSelectedTask(null);
          loadKanban();
          reloadProject();
        }}
        onTaskClick={setSelectedTask}
        onProjectReload={reloadProject}
        allUsers={users}
        allTasks={allTasks}
        onRequestTaskApproval={async (taskId: string) => {
          try {
            await projectsApi.requestTaskApproval(project!.id, taskId);
            reloadProject();
          } catch { /* ignore */ }
        }}
      />

      {/* Create Task Modal */}
      {createTaskModal && (
        <CreateTaskModal
          projectId={id!}
          phaseId={createTaskModal.phaseId}
          statusId={createTaskModal.statusId}
          statusName={createTaskModal.statusName}
          taskStatuses={taskStatuses}
          onClose={() => setCreateTaskModal(null)}
          onCreated={() => {
            setCreateTaskModal(null);
            loadKanban();
          }}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && project && (
        <AddMemberModal
          projectId={project.id}
          existingMemberIds={(project.members || []).map(m => m.userId)}
          onClose={() => setShowAddMemberModal(false)}
          onAdded={() => {
            setShowAddMemberModal(false);
            projectsApi.getById(id!).then(setProject).catch(console.error);
          }}
        />
      )}

      {/* ── CLOSE GUARD MODAL ─────────────────────────────── */}
      {closeGuard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Close project with open tasks?
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {closeGuard.openTasks.length} task
              {closeGuard.openTasks.length !== 1 ? 's are' : ' is'} still open:
            </p>

            {/* Open task list */}
            <ul className="mb-5 max-h-48 overflow-y-auto flex flex-col gap-1">
              {closeGuard.openTasks.map(t => (
                <li
                  key={t.id}
                  className="text-sm text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded bg-gray-50 dark:bg-slate-700/50 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  {t.title}
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCloseGuard(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const sid = closeGuard.pendingStatusId;
                  setCloseGuard(null);
                  await applyStatusChange(sid);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium"
              >
                Close anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KANBAN VIEW
// ============================================================

function KanbanView({
  columns,
  loading,
  onTaskClick,
  onTaskStatusChange,
  onAddTask,
  canCreateTask,
}: {
  columns: KanbanColumn[];
  loading: boolean;
  onTaskClick: (task: ProjectTask) => void;
  onTaskStatusChange: (taskId: string, statusId: string) => void;
  onAddTask: (phaseId: string | null, statusId: string, statusName: string) => void;
  canCreateTask: boolean;
}) {
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    for (const col of columns) {
      const found = col.tasks.find(t => t.id === taskId);
      if (found) { setActiveTask(found); break; }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);

    // Find source task
    const sourceTask = columns
      .flatMap(c => c.tasks)
      .find(t => t.id === activeTaskId);
    if (!sourceTask) return;

    // Resolve target status id:
    // Case 1: dropped directly on a column droppable (over.id = statusId)
    let targetStatusId: string | null = null;
    const isColumn = columns.some(c => c.status.id === overId);
    if (isColumn) {
      targetStatusId = overId;
    } else {
      // Case 2: dropped on another task — find that task's column
      const col = columns.find(c =>
        c.tasks.some(t => t.id === overId)
      );
      targetStatusId = col?.status.id || null;
    }

    if (!targetStatusId) return;
    if (sourceTask.statusId === targetStatusId) return;

    onTaskStatusChange(activeTaskId, targetStatusId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <LayoutGrid className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No task statuses configured</h3>
        <p className="text-gray-500 dark:text-slate-400">Configure task statuses in project settings first</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
        {columns.map(col => (
          <div
            key={col.status.id}
            className="flex-shrink-0 w-[280px] bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.status.color || '#6b7280' }}
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {col.status.name}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 rounded-full">
                  {col.tasks.length}
                </span>
              </div>
            </div>

            {/* Cards — droppable zone */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ maxHeight: '600px' }}>
              <DroppableColumn statusId={col.status.id}>
                <SortableContext
                  items={col.tasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {col.tasks.map(task => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </SortableContext>
              </DroppableColumn>
            </div>

            {/* Add task button */}
            {canCreateTask && (
              <div className="px-2 pb-2">
                <button
                  onClick={() => onAddTask(null, col.status.id, col.status.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drag overlay — visual copy while dragging */}
      <DragOverlay>
        {activeTask ? <TaskCardContent task={activeTask} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================================
// GANTT VIEW
// ============================================================

function GanttView({
  projectId,
  project,
  onTaskClick,
}: {
  projectId: string;
  project: any;
  onTaskClick: (task: ProjectTask) => void;
}) {
  const [ganttData, setGanttData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'days' | 'weeks' | 'months'>('weeks');

  useEffect(() => {
    projectsApi.getGantt(projectId)
      .then(setGanttData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const getDateRange = () => {
    const allDates: Date[] = [];
    if (project.startDate) allDates.push(new Date(project.startDate));
    if (project.endDate) allDates.push(new Date(project.endDate));
    ganttData?.tasks?.forEach((t: any) => {
      if (t.startDate) allDates.push(new Date(t.startDate));
      if (t.dueDate) allDates.push(new Date(t.dueDate));
    });
    if (allDates.length === 0) {
      const now = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 2);
      return { start: now, end };
    }
    const start = new Date(Math.min(...allDates.map(d => d.getTime())));
    const end = new Date(Math.max(...allDates.map(d => d.getTime())));
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    return { start, end };
  };

  const getColumns = (start: Date, end: Date) => {
    const cols: { label: string; date: Date }[] = [];
    const cursor = new Date(start);
    if (viewMode === 'days') {
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end || cols.length < 30) {
        cols.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: new Date(cursor),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (viewMode === 'weeks') {
      const day = cursor.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      cursor.setDate(cursor.getDate() + diff);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        cols.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: new Date(cursor),
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        cols.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          date: new Date(cursor),
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    return cols;
  };

  const getBarStyle = (
    taskStart: string | null,
    taskEnd: string | null,
    rangeStart: Date,
    rangeEnd: Date,
  ) => {
    if (!taskStart && !taskEnd) return null;

    if (viewMode === 'days') {
      const start = taskStart ? new Date(taskStart) : new Date(taskEnd!);
      const end = taskEnd ? new Date(taskEnd) : new Date(taskStart!);
      const msPerDay = 1000 * 60 * 60 * 24;
      const colWidthPx = 36;
      const startOffset = Math.floor((start.getTime() - rangeStart.getTime()) / msPerDay);
      const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1);
      return {
        left: `${startOffset * colWidthPx}px`,
        width: `${duration * colWidthPx}px`,
      };
    }

    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    if (totalMs <= 0) return null;
    const start = taskStart ? new Date(taskStart) : new Date(taskEnd!);
    const end = taskEnd ? new Date(taskEnd) : new Date(taskStart!);
    const isSingleDay = start.toDateString() === end.toDateString();
    const leftPct = Math.max(0, (start.getTime() - rangeStart.getTime()) / totalMs * 100);
    const widthPct = Math.max(
      isSingleDay ? 1 : 0.5,
      (end.getTime() - start.getTime()) / totalMs * 100,
    );
    return {
      left: `${leftPct}%`,
      width: `${Math.min(widthPct, 100 - leftPct)}%`,
    };
  };

  const getTodayPosition = (rangeStart: Date, rangeEnd: Date) => {
    if (viewMode === 'days') {
      const msPerDay = 1000 * 60 * 60 * 24;
      const colWidthPx = 36;
      const dayOffset = (Date.now() - rangeStart.getTime()) / msPerDay;
      if (dayOffset < 0) return null;
      return `${dayOffset * colWidthPx}px`;
    }
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    if (totalMs <= 0) return null;
    const pct = (Date.now() - rangeStart.getTime()) / totalMs * 100;
    if (pct < 0 || pct > 100) return null;
    return `${pct}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (!ganttData?.tasks?.length) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <GanttChartSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No tasks with dates set</h3>
        <p className="text-gray-500 dark:text-slate-400">Add start and due dates to tasks to see them on the Gantt chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden" style={{ height: '500px' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">View:</span>
          {(['days', 'weeks', 'months'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded-lg font-medium ${
                viewMode === mode
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {ganttData.tasks.length} task{ganttData.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Chart area */}
      <div className="flex flex-1 overflow-auto">
        {/* Left panel — task names */}
        <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-slate-700">
          <div className="h-10 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800" />
          {ganttData.tasks.map((task: any) => (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="h-10 flex items-center px-3 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              <span className="text-xs text-gray-700 dark:text-slate-300 truncate">
                {task.title}
              </span>
            </div>
          ))}
        </div>

        {/* Right panel — timeline */}
        {(() => {
          const { start: rangeStart, end: rangeEnd } = getDateRange();
          const cols = getColumns(rangeStart, rangeEnd);
          const todayLeft = getTodayPosition(rangeStart, rangeEnd);
          const minWidth = cols.length * (viewMode === 'days' ? 36 : viewMode === 'weeks' ? 80 : 120);
          const ROW_HEIGHT = 40; // h-10 = 40px
          const HEADER_HEIGHT = 40;

          // Build task index map + blocked set
          const taskIndexMap = new Map<string, number>();
          ganttData.tasks.forEach((t: any, i: number) => taskIndexMap.set(t.id, i));

          const blockedTaskIds = new Set<string>();
          (ganttData.dependencies || []).forEach((dep: any) => {
            const src = ganttData.tasks.find((t: any) => t.id === (dep.dependsOnTaskId || dep.depends_on_task_id));
            if (src && !src.isDone) {
              blockedTaskIds.add(dep.taskId || dep.task_id);
            }
          });

          return (
            <div className="flex-1 overflow-x-auto">
              <div style={{ minWidth, position: 'relative' }}>
                {/* Column headers */}
                <div className="h-10 flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                  {cols.map((col, i) => (
                    <div
                      key={i}
                      className="flex-1 flex items-center justify-center text-xs text-gray-500 dark:text-slate-400 font-medium border-r border-gray-200 dark:border-slate-700 whitespace-nowrap px-1"
                    >
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* Task rows with bars */}
                {ganttData.tasks.map((task: any) => {
                  const barStyle = getBarStyle(task.startDate, task.dueDate, rangeStart, rangeEnd);
                  const isBlocked = blockedTaskIds.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className="h-10 relative border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/30"
                    >
                      {/* Column grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {cols.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-gray-100 dark:border-slate-800" />
                        ))}
                      </div>

                      {/* Today line */}
                      {todayLeft && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
                          style={{ left: todayLeft }}
                        />
                      )}

                      {/* Task bar */}
                      {barStyle && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2${
                            isBlocked ? ' ring-2 ring-amber-400 ring-offset-1' : ''
                          }`}
                          style={{
                            ...barStyle,
                            backgroundColor: task.statusColor || '#8B5CF6',
                          }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.title}${isBlocked ? ' (blocked)' : ''}`}
                        >
                          <span className="text-[10px] text-white font-medium truncate">
                            {task.title}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Dependency arrows SVG overlay */}
                {ganttData.dependencies?.length > 0 && (
                  <svg
                    className="absolute top-0 left-0 w-full pointer-events-none"
                    style={{ height: HEADER_HEIGHT + ganttData.tasks.length * ROW_HEIGHT }}
                  >
                    <defs>
                      <marker id="dep-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M0,0 L8,3 L0,6 Z" fill="#F59E0B" />
                      </marker>
                    </defs>
                    {(ganttData.dependencies || []).map((dep: any) => {
                      const fromId = dep.dependsOnTaskId || dep.depends_on_task_id;
                      const toId = dep.taskId || dep.task_id;
                      const fromIdx = taskIndexMap.get(fromId);
                      const toIdx = taskIndexMap.get(toId);
                      if (fromIdx === undefined || toIdx === undefined) return null;

                      const fromTask = ganttData.tasks[fromIdx];
                      const toTask = ganttData.tasks[toIdx];
                      if (!fromTask?.dueDate && !fromTask?.startDate) return null;
                      if (!toTask?.startDate && !toTask?.dueDate) return null;

                      // Calculate x positions using same logic as getBarStyle
                      const totalMs = rangeEnd.getTime() - rangeStart.getTime();
                      if (totalMs <= 0) return null;

                      const fromEnd = fromTask.dueDate ? new Date(fromTask.dueDate) : new Date(fromTask.startDate);
                      const toStart = toTask.startDate ? new Date(toTask.startDate) : new Date(toTask.dueDate);

                      let x1: number, x2: number;
                      if (viewMode === 'days') {
                        const msPerDay = 1000 * 60 * 60 * 24;
                        const colWidthPx = 36;
                        x1 = ((fromEnd.getTime() - rangeStart.getTime()) / msPerDay + 1) * colWidthPx;
                        x2 = ((toStart.getTime() - rangeStart.getTime()) / msPerDay) * colWidthPx;
                      } else {
                        x1 = (fromEnd.getTime() - rangeStart.getTime()) / totalMs * minWidth;
                        x2 = (toStart.getTime() - rangeStart.getTime()) / totalMs * minWidth;
                      }

                      const y1 = HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                      const y2 = HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                      const midX = x1 + (x2 - x1) / 2;

                      const depKey = `${fromId}-${toId}`;
                      return (
                        <path
                          key={depKey}
                          d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="1.5"
                          strokeDasharray="4 2"
                          markerEnd="url(#dep-arrow)"
                          opacity="0.7"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================

const PRIORITY_TEXT: Record<string, { label: string; text: string }> = {
  urgent: { label: 'Urgent', text: 'text-red-600 dark:text-red-400' },
  high:   { label: 'High',   text: 'text-amber-600 dark:text-amber-400' },
  medium: { label: 'Medium', text: 'text-blue-600 dark:text-blue-400' },
  low:    { label: 'Low',    text: 'text-gray-500 dark:text-slate-400' },
};

function ListView({
  projectId: _projectId,
  project,
  onTaskClick,
  onAddTask,
  taskStatuses,
  canCreateTask,
}: {
  projectId: string;
  project: any;
  onTaskClick: (task: ProjectTask) => void;
  onAddTask: (phaseId: string | null, statusId: string, statusName: string) => void;
  taskStatuses: ProjectTaskStatus[];
  canCreateTask: boolean;
}) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(project.phases?.map((p: any) => p.id) ?? [])
  );

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });
  };

  const defaultStatusId = taskStatuses[0]?.id || '';
  const defaultStatusName = taskStatuses[0]?.name || 'To Do';

  const renderTaskRow = (task: ProjectTask) => {
    const priCfg = PRIORITY_TEXT[task.priority];
    return (
      <tr
        key={task.id}
        onClick={() => onTaskClick(task)}
        className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
      >
        <td className="px-4 py-2.5">
          <div className={`w-3.5 h-3.5 rounded-full border-2 ${
            task.isDone
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-slate-500'
          }`} />
        </td>
        <td className="px-4 py-2.5">
          <span className={`font-medium ${
            task.isDone
              ? 'line-through text-gray-400'
              : 'text-gray-900 dark:text-white'
          }`}>
            {task.title}
          </span>
          {task.description && (
            <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
              {task.description}
            </p>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${task.statusColor || '#6b7280'}20`,
              color: task.statusColor || '#6b7280',
            }}
          >
            {task.statusName || '—'}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {priCfg
            ? <span className={`text-xs font-medium ${priCfg.text}`}>{priCfg.label}</span>
            : <span className="text-xs text-gray-400">—</span>
          }
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs text-gray-600 dark:text-slate-400">
            {task.assigneeName || '—'}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`text-xs ${
            isOverdue(task.dueDate) && !task.isDone
              ? 'text-red-500 font-medium'
              : 'text-gray-500 dark:text-slate-400'
          }`}>
            {formatDate(task.dueDate)}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {task.loggedHours > 0
              ? task.loggedHours.toFixed(1) + 'h'
              : task.estimatedHours
                ? '0 / ' + task.estimatedHours + 'h'
                : '—'
            }
          </span>
        </td>
      </tr>
    );
  };

  const phases = project.phases || [];
  const unassigned = project.unassignedTasks || [];

  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            <th className="text-left px-4 py-2 w-8" />
            <th className="text-left px-4 py-2">Task</th>
            <th className="text-left px-4 py-2 w-32">Status</th>
            <th className="text-left px-4 py-2 w-28">Priority</th>
            <th className="text-left px-4 py-2 w-36">Assignee</th>
            <th className="text-left px-4 py-2 w-28">Due Date</th>
            <th className="text-right px-4 py-2 w-20">Hours</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((phase: any) => (
            <Fragment key={phase.id}>
              {/* Phase header */}
              <tr
                onClick={() => togglePhase(phase.id)}
                className="bg-gray-50 dark:bg-slate-800/60 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 border-b border-gray-200 dark:border-slate-700"
              >
                <td className="px-4 py-2">
                  {expandedPhases.has(phase.id)
                    ? <ChevronDown size={14} className="text-gray-400" />
                    : <ChevronRight size={14} className="text-gray-400" />}
                </td>
                <td colSpan={6} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: phase.color || '#6b7280' }}
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      {phase.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({phase.tasks?.length || 0} tasks)
                    </span>
                  </div>
                </td>
              </tr>
              {/* Phase tasks */}
              {expandedPhases.has(phase.id) && (phase.tasks || []).map((task: ProjectTask) =>
                renderTaskRow(task)
              )}
              {/* Add task row */}
              {expandedPhases.has(phase.id) && canCreateTask && (
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <td />
                  <td colSpan={6} className="px-4 py-1.5">
                    <button
                      onClick={() => onAddTask(phase.id, defaultStatusId, defaultStatusName)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      <Plus size={12} /> Add task
                    </button>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}

          {/* Unassigned tasks */}
          {unassigned.length > 0 && (
            <>
              <tr
                onClick={() => togglePhase('__unassigned__')}
                className="bg-gray-50 dark:bg-slate-800/60 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 border-b border-gray-200 dark:border-slate-700"
              >
                <td className="px-4 py-2">
                  {expandedPhases.has('__unassigned__')
                    ? <ChevronDown size={14} className="text-gray-400" />
                    : <ChevronRight size={14} className="text-gray-400" />}
                </td>
                <td colSpan={6} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                      Ungrouped Tasks
                    </span>
                    <span className="text-xs text-gray-400">
                      ({unassigned.length} tasks)
                    </span>
                  </div>
                </td>
              </tr>
              {expandedPhases.has('__unassigned__') && unassigned.map((task: ProjectTask) =>
                renderTaskRow(task)
              )}
              {expandedPhases.has('__unassigned__') && canCreateTask && (
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <td />
                  <td colSpan={6} className="px-4 py-1.5">
                    <button
                      onClick={() => onAddTask(null, defaultStatusId, defaultStatusName)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      <Plus size={12} /> Add task
                    </button>
                  </td>
                </tr>
              )}
            </>
          )}

          {/* Empty state */}
          {phases.length === 0 && unassigned.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500">
                No tasks yet. Add tasks from the Kanban board or click Add Task below.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// DROPPABLE COLUMN (registers column as a drop target)
// ============================================================

function DroppableColumn({
  statusId,
  children,
}: {
  statusId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] transition-colors rounded-lg ${
        isOver ? 'bg-purple-50 dark:bg-purple-900/20' : ''
      }`}
    >
      {children}
    </div>
  );
}

// ============================================================
// SORTABLE TASK CARD (wraps card content with useSortable)
// ============================================================

function SortableTaskCard({ task, onClick }: { task: ProjectTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <TaskCardContent task={task} />
    </div>
  );
}

// ============================================================
// TASK CARD CONTENT (shared between SortableTaskCard + DragOverlay)
// ============================================================

function TaskCardContent({ task, isDragOverlay }: { task: ProjectTask; isDragOverlay?: boolean }) {
  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const overdue = !task.isDone && isOverdue(task.dueDate);
  const subtaskCount = task.subtasks?.length || 0;

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all ${
        isDragOverlay ? 'shadow-xl ring-2 ring-purple-400' : ''
      }`}
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">
        {task.title}
      </p>

      {/* Priority */}
      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${pri.badge} mb-2`}>
        {pri.label}
      </span>

      {/* Meta row */}
      <div className="space-y-1">
        {task.assigneeName && (
          <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <User className="w-3 h-3" /> {task.assigneeName}
          </p>
        )}
        {task.dueDate && (
          <p className={`text-xs flex items-center gap-1 ${
            overdue
              ? 'text-red-600 dark:text-red-400 font-medium'
              : 'text-gray-500 dark:text-slate-400'
          }`}>
            <Calendar className="w-3 h-3" /> {fmtShortDate(task.dueDate)}
          </p>
        )}
        {subtaskCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
          </p>
        )}
        {task.loggedHours > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <Timer className="w-3 h-3" /> {task.loggedHours}h logged
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TASK DETAIL PANEL (slide-over)
// ============================================================

function TaskDetailPanel({
  task,
  projectId,
  projectTeamId,
  onClose,
  onUpdated,
  onTaskClick,
  onProjectReload,
  allUsers,
  allTasks,
  onRequestTaskApproval,
}: {
  task: ProjectTask | null;
  projectId: string;
  projectTeamId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  onTaskClick: (task: ProjectTask) => void;
  onProjectReload: () => void;
  allUsers: { id: string; firstName: string; lastName: string }[];
  allTasks: ProjectTask[];
  onRequestTaskApproval: (taskId: string) => Promise<void>;
}) {
  const [comments, setComments] = useState<ProjectTaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState<ProjectTaskStatus[]>([]);
  const [timeForm, setTimeForm] = useState({ minutes: 60, description: '', isBillable: true });
  const [loggingTime, setLoggingTime] = useState(false);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [currentStatusId, setCurrentStatusId] = useState(task?.statusId || '');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [timeEntries, setTimeEntries] = useState<ProjectTimeEntry[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Dependencies
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [addingDep, setAddingDep] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState<ProjectTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [savingSubtask, setSavingSubtask] = useState(false);

  // Sync currentStatusId when task prop changes
  useEffect(() => {
    setCurrentStatusId(task?.statusId || '');
  }, [task?.statusId]);

  // Load comments, members & task statuses when task changes
  useEffect(() => {
    if (!task) return;
    setCommentsLoading(true);
    projectsApi.getComments(projectId, task.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setCommentsLoading(false));

    projectsApi.getTaskStatuses()
      .then(setTaskStatuses)
      .catch(() => {});

    projectsApi.getMembers(projectId)
      .then(setMembers)
      .catch(console.error);

    // Reset form state
    setNewComment('');
    setShowTimeForm(false);
    setTimeForm({ minutes: 60, description: '', isBillable: true });
    setTimeEntries([]);
    setDependencies(task?.dependencies ?? []);
    setAddingDep(false);
    setSubtasks(task?.subtasks ?? []);
    setAddingSubtask(false);
    setNewSubtaskTitle('');
  }, [task?.id, projectId]);

  // Load team members for the project's associated team
  useEffect(() => {
    if (!projectTeamId) { setTeamMembers([]); return; }
    teamsApi.getOne(projectTeamId).then(team => {
      setTeamMembers((team.members || []).map((m: any) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName })));
    }).catch(() => setTeamMembers([]));
  }, [projectTeamId]);

  if (!task) return null;

  const handleStatusChange = async (newStatusId: string) => {
    setCurrentStatusId(newStatusId);
    try {
      await projectsApi.updateTask(projectId, task.id, { statusId: newStatusId } as any);
      onUpdated();
    } catch {
      setCurrentStatusId(task.statusId || '');
      console.error('Failed to update task status');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSavingComment(true);
    try {
      await projectsApi.addComment(projectId, task.id, { content: newComment.trim() });
      const updated = await projectsApi.getComments(projectId, task.id);
      setComments(updated);
      setNewComment('');
    } catch {
      console.error('Failed to add comment');
    } finally {
      setSavingComment(false);
    }
  };

  const handleLogTime = async () => {
    if (timeForm.minutes <= 0) return;
    setLoggingTime(true);
    try {
      const entry = await projectsApi.logTime(projectId, task.id, {
        minutes: timeForm.minutes,
        description: timeForm.description.trim() || undefined,
        isBillable: timeForm.isBillable,
      });
      setTimeEntries(prev => [...prev, entry]);
      setShowTimeForm(false);
      setTimeForm({ minutes: 60, description: '', isBillable: true });
      onUpdated();
    } catch {
      console.error('Failed to log time');
    } finally {
      setLoggingTime(false);
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim() || !task) return;
    setSavingSubtask(true);
    try {
      const created = await projectsApi.createTask(projectId, {
        title: newSubtaskTitle.trim(),
        parentTaskId: task.id,
        phaseId: task.phaseId ?? null,
      } as any);
      setSubtasks(prev => [...prev, created]);
      setNewSubtaskTitle('');
      setAddingSubtask(false);
      onProjectReload();
    } catch (err) {
      console.error('Failed to create subtask', err);
    } finally {
      setSavingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtask: ProjectTask) => {
    const doneStatus = taskStatuses.find(
      (s: any) => s.isDone || s.slug === 'done' || s.slug === 'completed',
    );
    const openStatus = taskStatuses.find(
      (s: any) => !s.isDone,
    );
    if (!doneStatus || !openStatus) return;

    const isDone = subtask.statusId === doneStatus.id;
    const newStatusId = isDone ? openStatus.id : doneStatus.id;

    // Optimistic update
    setSubtasks(prev =>
      prev.map(s =>
        s.id === subtask.id ? { ...s, statusId: newStatusId } : s,
      ),
    );

    try {
      await projectsApi.updateTask(projectId, subtask.id, {
        statusId: newStatusId,
      } as any);
    } catch {
      // Revert on failure
      setSubtasks(prev =>
        prev.map(s =>
          s.id === subtask.id ? { ...s, statusId: subtask.statusId } : s,
        ),
      );
    }
  };

  const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[520px] max-w-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-slideInRight overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {task.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status select */}
              <select
                value={currentStatusId}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {taskStatuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {/* Priority badge */}
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${pri.badge}`}>
                {pri.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Details grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Assignee</p>
                <select
                  value={task.assigneeId || ''}
                  onChange={async (e) => {
                    try {
                      await projectsApi.updateTask(projectId, task.id, { assigneeId: e.target.value || null } as any);
                      onUpdated();
                    } catch { console.error('Failed to update assignee'); }
                  }}
                  className="w-full px-1.5 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {(() => {
                    if (!members.length) return null;
                    return (
                      <optgroup label="Project Members">
                        {members.map(m => (
                          <option key={m.userId} value={m.userId}>
                            {m.firstName} {m.lastName}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
                  {(() => {
                    const memberIds = new Set(members.map(m => m.userId));
                    const filtered = teamMembers.filter(tm => !memberIds.has(tm.id));
                    if (!filtered.length) return null;
                    return (
                      <optgroup label="Team Members">
                        {filtered.map(tm => (
                          <option key={tm.id} value={tm.id}>
                            {tm.firstName} {tm.lastName}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
                  {(() => {
                    const memberIds = new Set(members.map(m => m.userId));
                    const teamIds = new Set(teamMembers.map(tm => tm.id));
                    const rest = allUsers.filter(u => !memberIds.has(u.id) && !teamIds.has(u.id));
                    if (!rest.length) return null;
                    return (
                      <optgroup label="All Users">
                        {rest.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
                </select>
              </div>
              <div className={`bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5 ${!task.isDone && isOverdue(task.dueDate) ? 'ring-1 ring-red-400' : ''}`}>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Due Date</p>
                <input
                  type="date"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  key={task.dueDate}
                  onBlur={async (e) => {
                    const val = e.target.value || null;
                    if (val === (task.dueDate ? task.dueDate.slice(0, 10) : null)) return;
                    try {
                      await projectsApi.updateTask(projectId, task.id, { dueDate: val } as any);
                      onUpdated();
                    } catch { console.error('Failed to update due date'); }
                  }}
                  className={`w-full text-sm font-medium bg-transparent border-none p-0 focus:ring-0 ${
                    !task.isDone && isOverdue(task.dueDate)
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Estimated Hours</p>
                <input
                  key={task.id}
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={task.estimatedHours ?? ''}
                  onBlur={async (e) => {
                    const raw = e.target.value;
                    const val = raw === '' ? null : parseFloat(raw);
                    if (val === (task.estimatedHours ?? null)) return;
                    try {
                      await projectsApi.updateTask(projectId, task.id, { estimatedHours: val } as any);
                      onUpdated();
                    } catch { console.error('Failed to update estimated hours'); }
                  }}
                  placeholder="0"
                  className="w-full px-1.5 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Logged Hours</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {task.loggedHours > 0 ? `${task.loggedHours.toFixed(1)}h` : '0h'}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</h3>
            <textarea
              key={task.id}
              rows={3}
              defaultValue={task.description ?? ''}
              onBlur={async (e) => {
                const val = e.target.value.trim() || null;
                if (val === (task.description ?? null)) return;
                try {
                  await projectsApi.updateTask(projectId, task.id, { description: val } as any);
                  onUpdated();
                } catch { console.error('Failed to update description'); }
              }}
              placeholder="Add a description…"
              className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* ── DEPENDENCIES ──────────────────────────────────── */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Depends On
                {dependencies.length > 0 && (
                  <span className="ml-1.5 text-gray-400">({dependencies.length})</span>
                )}
              </h4>
              <button
                onClick={() => setAddingDep(true)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
              >
                + Add
              </button>
            </div>

            {/* Dependency list */}
            <div className="flex flex-col gap-1">
              {dependencies.map((dep) => (
                <div key={dep.id} className="flex items-center gap-2 group bg-gray-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1 text-xs text-gray-700 dark:text-slate-300 truncate">
                    {dep.dependsOnTitle}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                    {dep.dependencyType.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        await projectsApi.removeDependency(projectId, task.id, dep.id);
                        setDependencies(prev => prev.filter(d => d.id !== dep.id));
                        onProjectReload();
                      } catch { console.error('Failed to remove dependency'); }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                    title="Remove dependency"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add dependency select */}
            {addingDep && (
              <div className="mt-2 flex gap-2">
                <select
                  autoFocus
                  defaultValue=""
                  onChange={async (e) => {
                    const depTaskId = e.target.value;
                    if (!depTaskId) return;
                    try {
                      const created = await projectsApi.addDependency(projectId, task.id, { dependsOnTaskId: depTaskId });
                      if (created && created.id) {
                        setDependencies(prev => [...prev, created]);
                        onProjectReload();
                      }
                      setAddingDep(false);
                    } catch { console.error('Failed to add dependency'); }
                  }}
                  className="flex-1 text-xs border border-gray-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select a task…</option>
                  {allTasks
                    .filter(t => t.id !== task.id && !dependencies.some(d => d.dependsOnTaskId === t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>
                <button
                  onClick={() => setAddingDep(false)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            )}

            {dependencies.length === 0 && !addingDep && (
              <p className="text-xs text-gray-400 dark:text-slate-500">No dependencies</p>
            )}
          </div>

          {/* ── TASK APPROVAL ─────────────────────────────────── */}
          {task.approvalStatus && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">Approval</h4>
              {task.approvalStatus === 'pending' && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Approval pending</span>
                </div>
              )}
              {task.approvalStatus === 'approved' && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  <CheckSquare className="w-4 h-4" />
                  <span>Approved</span>
                </div>
              )}
              {task.approvalStatus === 'rejected' && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Rejected</span>
                </div>
              )}
            </div>
          )}
          {!task.approvalStatus && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
              <button
                onClick={() => onRequestTaskApproval(task.id)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
              >
                Request Approval
              </button>
            </div>
          )}

          {/* ── SUBTASKS ───────────────────────────────────────── */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1.5 text-gray-400">({subtasks.length})</span>
                )}
              </h4>
              <button
                onClick={() => setAddingSubtask(true)}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
              >
                + Add
              </button>
            </div>

            {/* Subtask list */}
            <div className="flex flex-col gap-1">
              {subtasks.map((sub: ProjectTask) => {
                const doneStatus = taskStatuses.find(
                  (s: any) => s.isDone || s.slug === 'done' || s.slug === 'completed',
                );
                const isDone = doneStatus && sub.statusId === doneStatus.id;
                return (
                  <div key={sub.id} className="flex items-center gap-2 group">
                    {/* Done toggle */}
                    <button
                      onClick={() => handleToggleSubtask(sub)}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isDone
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 dark:border-slate-600 hover:border-purple-400'
                      }`}
                    >
                      {isDone && (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>

                    {/* Title — click navigates into subtask */}
                    <button
                      onClick={() => onTaskClick(sub)}
                      className={`flex-1 text-left text-xs truncate ${
                        isDone
                          ? 'line-through text-gray-400 dark:text-slate-500'
                          : 'text-gray-700 dark:text-slate-300'
                      } hover:text-purple-600 dark:hover:text-purple-400`}
                    >
                      {sub.title}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Inline add form */}
            {addingSubtask && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateSubtask();
                    if (e.key === 'Escape') {
                      setAddingSubtask(false);
                      setNewSubtaskTitle('');
                    }
                  }}
                  placeholder="Subtask title…"
                  className="flex-1 text-xs border border-gray-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleCreateSubtask}
                  disabled={savingSubtask || !newSubtaskTitle.trim()}
                  className="text-xs px-2 py-1 rounded bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700"
                >
                  {savingSubtask ? '…' : 'Add'}
                </button>
                <button
                  onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(''); }}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comments
              {comments.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300 rounded-full">
                  {comments.length}
                </span>
              )}
            </h3>

            {commentsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 mb-3">
                {comments.map(c => {
                  const initials = c.userName
                    ? c.userName.split(' ').map(w => w.charAt(0)).join('').slice(0, 2)
                    : '??';

                  return (
                    <div key={c.id} className="flex gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${avatarColor(c.userId)} flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{c.userName}</span>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">
                            {formatDate(c.createdAt)}
                          </span>
                          {c.isEdited && <span className="text-[10px] text-gray-400">(edited)</span>}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500">No comments yet</p>
                )}
              </div>
            )}

            {/* Add comment */}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleAddComment}
                disabled={savingComment || !newComment.trim()}
                className="self-end px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
              </button>
            </div>
          </div>

          {/* Log Time */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" /> Time Tracking
            </h3>

            {/* Time entries */}
            {timeEntries.length === 0 && task.loggedHours === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">No time logged yet</p>
            ) : timeEntries.length === 0 && task.loggedHours > 0 ? (
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">{task.loggedHours.toFixed(1)}h total logged</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {timeEntries.map((te, idx) => (
                  <div key={te.id || idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-2.5 py-1.5">
                    <Timer className="w-3 h-3 flex-shrink-0" />
                    <span className="font-medium">{te.minutes}min</span>
                    {te.description && <span className="truncate">{te.description}</span>}
                    <span className="ml-auto text-gray-400 dark:text-slate-500">{formatDate(te.loggedAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {!showTimeForm ? (
              <button
                onClick={() => setShowTimeForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 transition-colors"
              >
                <Timer className="w-4 h-4" /> Log Time
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Minutes</label>
                    <input
                      type="number"
                      min={1}
                      value={timeForm.minutes}
                      onChange={(e) => setTimeForm(f => ({ ...f, minutes: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeForm.isBillable}
                        onChange={(e) => setTimeForm(f => ({ ...f, isBillable: e.target.checked }))}
                        className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Billable</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">Description</label>
                  <input
                    type="text"
                    value={timeForm.description}
                    onChange={(e) => setTimeForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What did you work on?"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogTime}
                    disabled={loggingTime || timeForm.minutes <= 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loggingTime ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save Time Entry
                  </button>
                  <button
                    onClick={() => setShowTimeForm(false)}
                    className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TIME REPORT VIEW
// ============================================================

function TimeReportView({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<TimeReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    projectsApi.getTimeReport(projectId)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  if (report.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <Clock className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No time logged</h3>
        <p className="text-gray-500 dark:text-slate-400">Log time on tasks to see reports here</p>
      </div>
    );
  }

  const totalMin = report.reduce((s, r) => s + r.totalMinutes, 0);
  const billableMin = report.reduce((s, r) => s + r.billableMinutes, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-200 dark:border-slate-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Total Hours</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{minutesToHours(totalMin)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Billable Hours</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{minutesToHours(billableMin)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Team Members</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{report.length}</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">User</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Hours</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Billable Hours</th>
            <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Entries</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
          {report.map(r => (
            <tr key={r.userId} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full ${avatarColor(r.userId)} flex items-center justify-center text-white text-[10px] font-medium`}>
                    {(r.userName || '??').split(' ').map(w => w.charAt(0)).join('').slice(0, 2)}
                  </div>
                  <span className="text-sm text-gray-900 dark:text-white">{r.userName || 'Unknown'}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-gray-900 dark:text-white font-medium">
                {minutesToHours(r.totalMinutes)}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-green-600 dark:text-green-400">
                {minutesToHours(r.billableMinutes)}
              </td>
              <td className="px-4 py-2.5 text-right text-sm text-gray-500 dark:text-slate-400">
                {r.entryCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// CREATE TASK MODAL
// ============================================================

function CreateTaskModal({
  projectId,
  phaseId,
  statusId,
  statusName,
  taskStatuses,
  onClose,
  onCreated,
}: {
  projectId: string;
  phaseId: string | null;
  statusId: string;
  statusName: string;
  taskStatuses: ProjectTaskStatus[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigneeId: '',
    dueDate: '',
    estimatedHours: '',
    statusId: statusId,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await projectsApi.createTask(projectId, {
        title: form.title.trim(),
        description: form.description || undefined,
        phaseId: phaseId || undefined,
        priority: form.priority,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate || undefined,
        estimatedHours: form.estimatedHours
          ? parseFloat(form.estimatedHours)
          : undefined,
        statusId: form.statusId || undefined,
      } as any);
      onCreated();
    } catch {
      console.error('Failed to create task');
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Task</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{statusName} column</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What needs to be done?"
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional details..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={form.statusId}
                onChange={(e) => setForm(f => ({ ...f, statusId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {taskStatuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date + Estimated Hours row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                step={0.5}
                min={0}
                value={form.estimatedHours}
                onChange={(e) => setForm(f => ({ ...f, estimatedHours: e.target.value }))}
                placeholder="0"
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
            disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PROJECT SETTINGS TAB
// ============================================================

function ProjectSettingsTab({
  project,
  projectId,
  statuses,
  users,
  teams,
  accountSearch,
  setAccountSearch,
  accountResults,
  setAccountResults,
  accountSearchLoading,
  showAccountDropdown,
  setShowAccountDropdown,
  onSaved,
}: {
  project: Project;
  projectId: string;
  statuses: any[];
  users: any[];
  teams: any[];
  accountSearch: string;
  setAccountSearch: (v: string) => void;
  accountResults: any[];
  setAccountResults: (v: any[]) => void;
  accountSearchLoading: boolean;
  showAccountDropdown: boolean;
  setShowAccountDropdown: (v: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-5">Project Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Status</label>
          <select
            value={project.statusId || ''}
            onChange={async (e) => {
              await projectsApi.update(projectId, { statusId: e.target.value });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {statuses.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Owner */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Owner</label>
          <select
            value={project.ownerId || ''}
            onChange={async (e) => {
              await projectsApi.update(projectId, { ownerId: e.target.value || null });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName || u.first_name} {u.lastName || u.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Team */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Team</label>
          <select
            value={project.teamId || ''}
            onChange={async (e) => {
              await projectsApi.update(projectId, { teamId: e.target.value || undefined });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">No team</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Account */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Account</label>
          {project.accountId && project.accountName ? (
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-700">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                {project.accountName}
              </span>
              <button
                onClick={async () => {
                  await projectsApi.update(projectId, { accountId: null } as any);
                  onSaved();
                }}
                className="text-gray-400 hover:text-red-500 flex-shrink-0"
                title="Remove account"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                onFocus={() => accountSearch && setShowAccountDropdown(true)}
                onBlur={() => setTimeout(() => setShowAccountDropdown(false), 200)}
                placeholder="Search accounts..."
                className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {accountSearchLoading && (
                <Loader2 size={14} className="absolute right-3 top-2.5 animate-spin text-gray-400" />
              )}
              {showAccountDropdown && accountResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {accountResults.map((acc: any) => (
                    <button
                      key={acc.id}
                      onMouseDown={async () => {
                        await projectsApi.update(projectId, { accountId: acc.id } as any);
                        setAccountSearch('');
                        setAccountResults([]);
                        setShowAccountDropdown(false);
                        onSaved();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {acc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            value={project.startDate ? project.startDate.slice(0, 10) : ''}
            onChange={async (e) => {
              await projectsApi.update(projectId, { startDate: e.target.value || undefined });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">End Date</label>
          <input
            type="date"
            value={project.endDate ? project.endDate.slice(0, 10) : ''}
            onChange={async (e) => {
              await projectsApi.update(projectId, { endDate: e.target.value || undefined });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Budget</label>
          <input
            type="number"
            step={0.01}
            min={0}
            defaultValue={project.budget ?? ''}
            onBlur={async (e) => {
              const val = parseFloat(e.target.value);
              await projectsApi.update(projectId, { budget: isNaN(val) ? undefined : val });
              onSaved();
            }}
            placeholder="0.00"
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Currency</label>
          <select
            value={project.currency || 'USD'}
            onChange={async (e) => {
              await projectsApi.update(projectId, { currency: e.target.value });
              onSaved();
            }}
            className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADD MEMBER MODAL
// ============================================================

function AddMemberModal({
  projectId,
  existingMemberIds,
  onClose,
  onAdded,
}: {
  projectId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setUsers(list.filter((u: any) => !existingMemberIds.includes(u.id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [existingMemberIds]);

  const handleSubmit = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await projectsApi.addMember(projectId, { userId: selectedUserId, role });
      onAdded();
    } catch {
      console.error('Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Member</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  User <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a user...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {(u.firstName || u.first_name || '')} {(u.lastName || u.last_name || '')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </>
          )}
        </div>

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
            onClick={handleSubmit}
            disabled={saving || !selectedUserId}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Member
          </button>
        </div>
      </div>
    </div>
  );
}
