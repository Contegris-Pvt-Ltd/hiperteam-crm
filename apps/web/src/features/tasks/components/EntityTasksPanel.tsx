// ============================================================
// FILE: apps/web/src/features/tasks/components/EntityTasksPanel.tsx
// ============================================================
// Usage on any detail page:
//   <EntityTasksPanel entityType="leads" entityId={leadId} entityName="John Doe" />
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Plus, Loader2,
  AlertCircle, ArrowUp, ArrowDown, Minus,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import type { Task, TaskType, TaskStatus, TaskPriority, CreateTaskData, UpdateTaskData } from '../../../api/tasks.api';
import { tasksApi, taskSettingsApi } from '../../../api/tasks.api';
import { usePermissions } from '../../../hooks/usePermissions';
import { TaskFormModal } from './TaskFormModal';

const PRIORITY_ICONS: Record<string, any> = {
  'alert-circle': AlertCircle, 'arrow-up': ArrowUp, minus: Minus, 'arrow-down': ArrowDown,
};

interface EntityTasksPanelProps {
  entityType: string;   // 'leads' | 'contacts' | 'accounts' | 'opportunities'
  entityId: string;
  entityName?: string;  // For display in the create modal
}

export function EntityTasksPanel({ entityType, entityId, entityName }: EntityTasksPanelProps) {
  const navigate = useNavigate();
  const { canCreate, canEdit } = usePermissions();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [formModal, setFormModal] = useState(false);

  // Load lookups once
  useEffect(() => {
    Promise.all([
      taskSettingsApi.getTypes(),
      taskSettingsApi.getStatuses(),
      taskSettingsApi.getPriorities(),
    ]).then(([t, s, p]) => { setTypes(t); setStatuses(s); setPriorities(p); });
  }, []);

  // Load entity tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.getByEntity(entityType, entityId);
      setTasks(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleComplete = async (id: string) => {
    await tasksApi.complete(id);
    loadTasks();
  };

  const handleReopen = async (id: string) => {
    await tasksApi.reopen(id);
    loadTasks();
  };

  const handleFormSave = async (data: CreateTaskData | UpdateTaskData) => {
    await tasksApi.create(data as CreateTaskData);
    setFormModal(false);
    loadTasks();
  };

  const openTasks = tasks.filter(t => !t.completedAt);
  const completedTasks = tasks.filter(t => !!t.completedAt);

  const isOverdue = (task: Task): boolean => !!task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date();

  const formatDue = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, cls: 'text-red-500' };
    if (days === 0) return { text: 'Today', cls: 'text-amber-500' };
    if (days === 1) return { text: 'Tomorrow', cls: 'text-blue-500' };
    return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-gray-500' };
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Tasks
          {tasks.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-gray-400">
              {openTasks.length} open{completedTasks.length > 0 ? `, ${completedTasks.length} done` : ''}
            </span>
          )}
        </h3>
        {canCreate('tasks') && (
          <button
            onClick={() => setFormModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={12} /> Add Task
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">No tasks linked to this record</p>
          {canCreate('tasks') && (
            <button onClick={() => setFormModal(true)} className="mt-2 text-xs text-blue-600 hover:text-blue-700">
              Create one
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Open tasks */}
          {openTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={() => handleComplete(task.id)}
              onReopen={() => handleReopen(task.id)}
              onClick={() => navigate(`/tasks/${task.id}`)}
              isOverdue={isOverdue(task)}
              formatDue={formatDue}
              canEdit={canEdit('tasks')}
            />
          ))}

          {/* Completed toggle */}
          {completedTasks.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"
              >
                {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
              </button>
              {showCompleted && completedTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => handleComplete(task.id)}
                  onReopen={() => handleReopen(task.id)}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  isOverdue={false}
                  formatDue={formatDue}
                  canEdit={canEdit('tasks')}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Modal */}
      {formModal && (
        <TaskFormModal
          types={types}
          statuses={statuses}
          priorities={priorities}
          relatedEntityType={entityType}
          relatedEntityId={entityId}
          relatedEntityName={entityName}
          onSave={handleFormSave}
          onClose={() => setFormModal(false)}
        />
      )}
    </div>
  );
}

// ── Single Task Row ──
function TaskRow({
  task, onComplete, onReopen, onClick, formatDue, canEdit,
}: {
  task: Task;
  onComplete: () => void;
  onReopen: () => void;
  onClick: () => void;
  isOverdue: boolean;
  formatDue: (d: string | null) => { text: string; cls: string } | null;
  canEdit: boolean;
}) {
  const due = formatDue(task.dueDate);
  const PIcon = task.priority ? (PRIORITY_ICONS[task.priority.icon || 'minus'] || Minus) : null;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors group"
    >
      {/* Check */}
      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); task.completedAt ? onReopen() : onComplete(); }}
          className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            task.completedAt
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
          }`}
        >
          {task.completedAt && <CheckCircle2 size={10} />}
        </button>
      )}

      {/* Title */}
      <span className={`text-sm flex-1 truncate ${task.completedAt ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
        {task.title}
      </span>

      {/* Meta badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.subtaskCount > 0 && (
          <span className="text-[10px] text-gray-400">{task.completedSubtaskCount}/{task.subtaskCount}</span>
        )}
        {PIcon && <PIcon size={12} style={{ color: task.priority?.color }} />}
        {due && (
          <span className={`text-[11px] font-medium ${due.cls}`}>{due.text}</span>
        )}
        {task.assignee && (
          <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500"
            title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
            {task.assignee.firstName?.[0]}{task.assignee.lastName?.[0]}
          </div>
        )}
        <ExternalLink size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}