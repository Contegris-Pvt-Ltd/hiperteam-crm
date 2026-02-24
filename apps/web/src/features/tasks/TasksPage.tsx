// ============================================================
// FILE: apps/web/src/features/tasks/TasksPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, X, LayoutList, LayoutGrid,
  CheckSquare, Phone, Mail, Calendar, ArrowRight, Monitor, FileText, Users,
  Clock, AlertCircle, ArrowUp, ArrowDown, Minus,
  Eye, Pencil, Trash2, CheckCircle2, RotateCcw,
  GripVertical,
} from 'lucide-react';
import type {
  Task, TasksQuery, TaskStatus, TaskType, TaskPriority,
  KanbanStatusData, CreateTaskData, UpdateTaskData,
} from '../../api/tasks.api';
import { tasksApi, taskSettingsApi } from '../../api/tasks.api';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';
import { useAuthStore } from '../../stores/auth.store';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskCalendarView } from './components/TaskCalendarView';
import { CalendarSyncButton } from './components/CalendarSyncButton';

// ── Icon maps ──
const TYPE_ICONS: Record<string, any> = {
  'check-square': CheckSquare, phone: Phone, mail: Mail, calendar: Calendar,
  'arrow-right': ArrowRight, monitor: Monitor, 'file-text': FileText, users: Users,
};
const PRIORITY_ICONS: Record<string, any> = {
  'alert-circle': AlertCircle, 'arrow-up': ArrowUp, minus: Minus, 'arrow-down': ArrowDown,
};

export function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('tasks');
  const tablePrefs = useTablePreferences('tasks', allColumns, defaultVisibleKeys);

  // Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kanbanData, setKanbanData] = useState<KanbanStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // Lookups
  const [types, setTypes] = useState<TaskType[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [query, setQuery] = useState<TasksQuery>({ page: 1, limit: 20, view: 'list', isCompleted: 'false' });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal
  const [formModal, setFormModal] = useState<{ open: boolean; task?: Task }>({ open: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [calendarCreateDate, setCalendarCreateDate] = useState<string | null>(null);

  // ── Sync table prefs ──
  useEffect(() => {
    if (!tablePrefs.loading && viewMode === 'list') {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
    }
  }, [tablePrefs.loading]);

  // ── Load lookups ──
  useEffect(() => {
    Promise.all([
      taskSettingsApi.getTypes(),
      taskSettingsApi.getStatuses(),
      taskSettingsApi.getPriorities(),
    ]).then(([t, s, p]) => {
      setTypes(t);
      setStatuses(s);
      setPriorities(p);
    });
  }, []);

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    if (viewMode === 'calendar') return; // calendar manages its own data
    setLoading(true);
    try {
      const result = await tasksApi.list({ ...query, view: viewMode as 'list' | 'kanban' });
      if (viewMode === 'kanban') {
        setKanbanData(result as KanbanStatusData[]);
      } else {
        const listResult = result as { data: Task[]; meta: any };
        setTasks(listResult.data);
        setMeta(listResult.meta);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [query, viewMode]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Handlers ──
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(prev => ({ ...prev, search: searchInput || undefined, page: 1 }));
  };

  const handleViewChange = (mode: 'list' | 'kanban' | 'calendar') => {
    setViewMode(mode);
    if (mode !== 'calendar') {
      setQuery(prev => ({ ...prev, view: mode, page: 1 }));
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await tasksApi.complete(id);
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleReopen = async (id: string) => {
    try {
      await tasksApi.reopen(id);
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.delete(id);
      setShowDeleteConfirm(null);
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleKanbanDrop = async (taskId: string, newStatusId: string) => {
    try {
      await tasksApi.update(taskId, { statusId: newStatusId });
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleFormSave = async (data: CreateTaskData | UpdateTaskData, id?: string) => {
    if (id) {
      await tasksApi.update(id, data as UpdateTaskData);
    } else {
      await tasksApi.create(data as CreateTaskData);
    }
    setFormModal({ open: false });
    fetchTasks();
  };

  const handleCalendarQuickCreate = (dateStr: string) => {
    setCalendarCreateDate(dateStr);
    setFormModal({ open: true });
  };

  const handleCalendarTaskUpdate = async (id: string, dto: UpdateTaskData) => {
    await tasksApi.update(id, dto);
  };

  // ── Active filter count ──
  const activeFilterCount = [
    query.statusId, query.taskTypeId, query.priorityId,
    query.assignedTo, query.isOverdue,
    query.isCompleted !== 'false' ? query.isCompleted : undefined,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setQuery({ page: 1, limit: query.limit, view: viewMode === 'calendar' ? 'list' : viewMode, isCompleted: 'false' });
    setSearchInput('');
  };

  // ── Helpers ──
  const getTypeIcon = (type: TaskType | null) => {
    if (!type) return <CheckSquare size={14} className="text-gray-400" />;
    const Icon = TYPE_ICONS[type.icon] || CheckSquare;
    return <Icon size={14} style={{ color: type.color }} />;
  };

  const getPriorityIcon = (priority: TaskPriority | null) => {
    if (!priority) return null;
    const Icon = PRIORITY_ICONS[priority.icon || 'minus'] || Minus;
    return <Icon size={14} style={{ color: priority.color }} />;
  };

  const isOverdue = (task: Task): boolean => {
    return !!task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date();
  };

  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: `${Math.abs(days)}d overdue`, className: 'text-red-600 dark:text-red-400' };
    if (days === 0) return { text: 'Today', className: 'text-amber-600 dark:text-amber-400' };
    if (days === 1) return { text: 'Tomorrow', className: 'text-blue-600 dark:text-blue-400' };
    if (days <= 7) return { text: `${days}d`, className: 'text-gray-600 dark:text-gray-400' };
    return {
      text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      className: 'text-gray-500 dark:text-gray-400',
    };
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {viewMode === 'kanban'
              ? `${kanbanData.reduce((s, st) => s + st.count, 0)} total tasks`
              : viewMode === 'calendar'
                ? 'Calendar view'
                : `${meta.total} total tasks`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <CalendarSyncButton />
          {canCreate('tasks') && (
            <button
              onClick={() => setFormModal({ open: true })}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Task
            </button>
          )}
        </div>
      </div>
      
      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700">
            Search
          </button>
        </form>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => handleViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutList size={16} /> List
          </button>
          <button
            onClick={() => handleViewChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${viewMode === 'kanban' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutGrid size={16} /> Kanban
          </button>
          <button
            onClick={() => handleViewChange('calendar')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${viewMode === 'calendar' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <Calendar size={16} /> Calendar
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm ${
            activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          <Filter size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Status */}
            <select
              value={query.statusId || ''}
              onChange={(e) => setQuery({ ...query, statusId: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Statuses</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Type */}
            <select
              value={query.taskTypeId || ''}
              onChange={(e) => setQuery({ ...query, taskTypeId: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Types</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Priority */}
            <select
              value={query.priorityId || ''}
              onChange={(e) => setQuery({ ...query, priorityId: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Priorities</option>
              {priorities.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Completion */}
            <select
              value={query.isCompleted || ''}
              onChange={(e) => setQuery({ ...query, isCompleted: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Tasks</option>
              <option value="false">Open Tasks</option>
              <option value="true">Completed</option>
            </select>

            {/* Assigned to me */}
            <select
              value={query.assignedTo || ''}
              onChange={(e) => setQuery({ ...query, assignedTo: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Assignees</option>
              <option value={user?.id || ''}>Assigned to me</option>
            </select>
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'calendar' ? (
        <TaskCalendarView
          types={types}
          statuses={statuses}
          priorities={priorities}
          onTaskClick={(id) => navigate(`/tasks/${id}`)}
          onQuickCreate={handleCalendarQuickCreate}
          onTaskUpdate={handleCalendarTaskUpdate}
          colorBy="priority"
        />
      ) : viewMode === 'kanban' ? (
        <TaskKanbanBoard
          statuses={kanbanData}
          loading={loading}
          onStatusDrop={handleKanbanDrop}
          onTaskClick={(id) => navigate(`/tasks/${id}`)}
          onComplete={handleComplete}
          getTypeIcon={getTypeIcon}
          getPriorityIcon={getPriorityIcon}
          formatDueDate={formatDueDate}
          isOverdue={isOverdue}
        />
      ) : (
        /* ── LIST VIEW ── */
        <DataTable
          module="tasks"
          allColumns={allColumns}
          defaultVisibleKeys={defaultVisibleKeys}
          data={tasks}
          loading={loading || columnsLoading}
          meta={meta}
          visibleColumns={tablePrefs.visibleColumns}
          sortColumn={query.sortBy || 'due_date'}
          sortOrder={query.sortOrder || 'ASC'}
          pageSize={query.limit || 20}
          columnWidths={tablePrefs.columnWidths}
          onSort={(col, order) => {
            setQuery(prev => ({ ...prev, sortBy: col, sortOrder: order, page: 1 }));
            tablePrefs.setSortColumn(col);
            tablePrefs.setSortOrder(order);
          }}
          onPageChange={(page) => setQuery(prev => ({ ...prev, page }))}
          onPageSizeChange={(size) => {
            setQuery(prev => ({ ...prev, limit: size, page: 1 }));
            tablePrefs.setPageSize(size);
          }}
          onColumnsChange={tablePrefs.setVisibleColumns}
          onColumnWidthsChange={tablePrefs.setColumnWidths}
          onRowClick={(row) => navigate(`/tasks/${row.id}`)}
          emptyMessage="No tasks found. Try adjusting your filters."
          renderCell={(col, value, row) => {
            const task = row as unknown as Task;

            // Title column — checkbox + type icon + title + subtask count
            if (col.key === 'title') {
              return (
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); task.completedAt ? handleReopen(task.id) : handleComplete(task.id); }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      task.completedAt
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {task.completedAt && <CheckCircle2 size={12} />}
                  </button>
                  {getTypeIcon(task.taskType)}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${task.completedAt ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                      {task.title}
                    </p>
                    {task.subtaskCount > 0 && (
                      <p className="text-xs text-gray-400">
                        {task.completedSubtaskCount}/{task.subtaskCount} subtasks
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Status
            if (col.key === 'statusName' && task.status) {
              return (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{ backgroundColor: `${task.status.color}18`, color: task.status.color }}>
                  {task.status.name}
                </span>
              );
            }

            // Priority
            if (col.key === 'priorityName' && task.priority) {
              return (
                <div className="flex items-center gap-1.5">
                  {getPriorityIcon(task.priority)}
                  <span className="text-xs font-medium" style={{ color: task.priority.color }}>
                    {task.priority.name}
                  </span>
                </div>
              );
            }

            // Due Date
            if (col.key === 'dueDate') {
              const fmt = formatDueDate(task.dueDate);
              if (!fmt) return <span className="text-xs text-gray-400">—</span>;
              return (
                <div className="flex items-center gap-1">
                  <Clock size={12} className={isOverdue(task) ? 'text-red-500' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${fmt.className}`}>{fmt.text}</span>
                </div>
              );
            }

            // Type
            if (col.key === 'typeName' && task.taskType) {
              return (
                <div className="flex items-center gap-1.5">
                  {getTypeIcon(task.taskType)}
                  <span className="text-xs text-gray-600 dark:text-gray-400">{task.taskType.name}</span>
                </div>
              );
            }

            // Assignee
            if (col.key === 'assigneeName' && task.assignee) {
              return (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {task.assignee.firstName} {task.assignee.lastName}
                </span>
              );
            }

            return undefined;
          }}
          renderActions={(row) => {
            const task = row as unknown as Task;
            return (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Quick complete/reopen */}
                {canEdit('tasks') && (
                  task.completedAt ? (
                    <button onClick={() => handleReopen(task.id)} className="p-1.5 text-gray-400 hover:text-amber-600 rounded" title="Reopen">
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button onClick={() => handleComplete(task.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Complete">
                      <CheckCircle2 size={16} />
                    </button>
                  )
                )}
                <button onClick={() => navigate(`/tasks/${task.id}`)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="View">
                  <Eye size={16} />
                </button>
                {canEdit('tasks') && (
                  <button onClick={() => setFormModal({ open: true, task })} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Edit">
                    <Pencil size={16} />
                  </button>
                )}
                {canDelete('tasks') && (
                  <button onClick={() => setShowDeleteConfirm(task.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Task</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure? This will also delete any subtasks.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {formModal.open && (
        <TaskFormModal
          task={formModal.task}
          types={types}
          statuses={statuses}
          priorities={priorities}
          defaultDueDate={calendarCreateDate || undefined}
          onSave={(data, id) => {
            setCalendarCreateDate(null);
            return handleFormSave(data, id);
          }}
          onClose={() => { setFormModal({ open: false }); setCalendarCreateDate(null); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TASK KANBAN BOARD (inline component)
// ════════════════════════════════════════════════════════════

interface TaskKanbanBoardProps {
  statuses: KanbanStatusData[];
  loading: boolean;
  onStatusDrop: (taskId: string, newStatusId: string) => void;
  onTaskClick: (id: string) => void;
  onComplete: (id: string) => void;
  getTypeIcon: (type: TaskType | null) => React.ReactNode;
  getPriorityIcon: (priority: TaskPriority | null) => React.ReactNode;
  formatDueDate: (date: string | null) => { text: string; className: string } | null;
  isOverdue: (task: Task) => boolean;
}

function TaskKanbanBoard({
  statuses, loading, onStatusDrop, onTaskClick, onComplete,
  getTypeIcon, getPriorityIcon, formatDueDate, isOverdue,
}: TaskKanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]" style={{ scrollBehavior: 'smooth' }}>
      {statuses.map((status) => (
        <div
          key={status.id}
          onDragOver={(e) => { e.preventDefault(); setDragOverStatusId(status.id); }}
          onDragLeave={() => setDragOverStatusId(null)}
          onDrop={(e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) onStatusDrop(taskId, status.id);
            setDraggingId(null);
            setDragOverStatusId(null);
          }}
          className={`flex-shrink-0 w-72 flex flex-col bg-gray-50 dark:bg-slate-900 border rounded-lg transition-all ${
            dragOverStatusId === status.id
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10 ring-2 ring-blue-400/30'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          {/* Column Header */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 rounded-t-lg"
            style={{ borderTopColor: status.color, borderTopWidth: '3px' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{status.name}</span>
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full">
                {status.count}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
            {status.tasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {dragOverStatusId === status.id ? 'Drop here' : 'No tasks'}
              </div>
            ) : (
              status.tasks.map((task) => {
                const dueFmt = formatDueDate(task.dueDate);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => { setDraggingId(task.id); e.dataTransfer.setData('text/plain', task.id); }}
                    onDragEnd={() => { setDraggingId(null); setDragOverStatusId(null); }}
                    onClick={() => onTaskClick(task.id)}
                    className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all group ${
                      draggingId === task.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                      <button
                        onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                          task.completedAt ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.completedAt ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {task.title}
                        </p>
                      </div>
                    </div>

                    {/* Bottom row: type + priority + due + assignee */}
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(task.taskType)}
                        {getPriorityIcon(task.priority)}
                        {dueFmt && (
                          <span className={`text-[10px] font-medium ${dueFmt.className}`}>
                            {dueFmt.text}
                          </span>
                        )}
                        {task.subtaskCount > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {task.completedSubtaskCount}/{task.subtaskCount}
                          </span>
                        )}
                      </div>
                      {task.assignee && (
                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500"
                          title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
                          {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}