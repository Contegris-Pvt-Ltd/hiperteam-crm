// ============================================================
// FILE: apps/web/src/features/tasks/TaskDetailPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, CheckCircle2, RotateCcw,
  Clock, Calendar, User, Repeat, Link as LinkIcon,
  Plus, Loader2, MessageSquare, Activity,
  AlertCircle, ArrowUp, ArrowDown, Minus,
  CheckSquare, Phone, Mail, Monitor, FileText, Users,
} from 'lucide-react';
import type { Task, TaskType, TaskStatus, TaskPriority, CreateTaskData, UpdateTaskData } from '../../api/tasks.api';
import { tasksApi, taskSettingsApi } from '../../api/tasks.api';
import { usePermissions } from '../../hooks/usePermissions';
import { TaskFormModal } from './components/TaskFormModal';

const TYPE_ICONS: Record<string, any> = {
  'check-square': CheckSquare, phone: Phone, mail: Mail, calendar: Calendar,
  'arrow-right': ArrowUp, monitor: Monitor, 'file-text': FileText, users: Users,
};
const PRIORITY_ICONS: Record<string, any> = {
  'alert-circle': AlertCircle, 'arrow-up': ArrowUp, minus: Minus, 'arrow-down': ArrowDown,
};
const ENTITY_ROUTES: Record<string, string> = {
  leads: '/leads', contacts: '/contacts', accounts: '/accounts', opportunities: '/opportunities',
};

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'subtasks' | 'notes' | 'activity'>('subtasks');
  const [notes, setNotes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Subtask creation
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskCreating, setSubtaskCreating] = useState(false);

  // Modal
  const [editModal, setEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Load lookups ──
  useEffect(() => {
    Promise.all([
      taskSettingsApi.getTypes(),
      taskSettingsApi.getStatuses(),
      taskSettingsApi.getPriorities(),
    ]).then(([t, s, p]) => { setTypes(t); setStatuses(s); setPriorities(p); });
  }, []);

  // ── Load task ──
  const loadTask = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await tasksApi.get(id);
      setTask(data);
    } catch (err) {
      console.error(err);
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTask(); }, [loadTask]);

  // ── Load tab data ──
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'notes') {
      tasksApi.getNotes(id).then(setNotes).catch(() => {});
    } else if (activeTab === 'activity') {
      tasksApi.getActivities(id).then((res: any) => setActivities(res.data || res)).catch(() => {});
    }
  }, [id, activeTab]);

  const handleComplete = async () => {
    if (!id) return;
    await tasksApi.complete(id);
    loadTask();
  };

  const handleReopen = async () => {
    if (!id) return;
    await tasksApi.reopen(id);
    loadTask();
  };

  const handleDelete = async () => {
    if (!id) return;
    await tasksApi.delete(id);
    navigate('/tasks');
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    setNoteSubmitting(true);
    try {
      await tasksApi.addNote(id, newNote.trim());
      setNewNote('');
      const updatedNotes = await tasksApi.getNotes(id);
      setNotes(updatedNotes);
    } catch (err) { console.error(err); }
    finally { setNoteSubmitting(false); }
  };

  const handleCreateSubtask = async () => {
    if (!id || !newSubtaskTitle.trim()) return;
    setSubtaskCreating(true);
    try {
      await tasksApi.createSubtask(id, { title: newSubtaskTitle.trim() });
      setNewSubtaskTitle('');
      loadTask();
    } catch (err) { console.error(err); }
    finally { setSubtaskCreating(false); }
  };

  const handleCompleteSubtask = async (subtaskId: string) => {
    await tasksApi.complete(subtaskId);
    loadTask();
  };

  const handleReopenSubtask = async (subtaskId: string) => {
    await tasksApi.reopen(subtaskId);
    loadTask();
  };

  const handleFormSave = async (data: CreateTaskData | UpdateTaskData, taskId?: string) => {
    if (taskId) await tasksApi.update(taskId, data as UpdateTaskData);
    setEditModal(false);
    loadTask();
  };

  if (loading || !task) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isOverdue = task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date();
  const TypeIcon = task.taskType ? (TYPE_ICONS[task.taskType.icon] || CheckSquare) : CheckSquare;

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/tasks')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft size={16} /> Back to Tasks
      </button>

      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Complete toggle */}
            <button
              onClick={task.completedAt ? handleReopen : handleComplete}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                task.completedAt
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {task.completedAt && <CheckCircle2 size={16} />}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {task.taskType && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${task.taskType.color}18`, color: task.taskType.color }}>
                    <TypeIcon size={12} />
                    {task.taskType.name}
                  </span>
                )}
                {task.isRecurring && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                    <Repeat size={10} /> Recurring
                  </span>
                )}
              </div>
              <h1 className={`text-xl font-bold ${task.completedAt ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                {task.title}
              </h1>
              {task.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{task.description}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {canEdit('tasks') && (
              <>
                {task.completedAt ? (
                  <button onClick={handleReopen} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-amber-600">
                    <RotateCcw size={14} /> Reopen
                  </button>
                ) : (
                  <button onClick={handleComplete} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <CheckCircle2 size={14} /> Complete
                  </button>
                )}
                <button onClick={() => setEditModal(true)} className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Pencil size={16} />
                </button>
              </>
            )}
            {canDelete('tasks') && (
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100 dark:border-slate-800">
          {/* Status */}
          {task.status && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                style={{ backgroundColor: `${task.status.color}18`, color: task.status.color }}>
                {task.status.name}
              </span>
            </div>
          )}

          {/* Priority */}
          {task.priority && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Priority</p>
              <div className="flex items-center gap-1.5">
                {(() => { const I = PRIORITY_ICONS[task.priority!.icon || 'minus'] || Minus; return <I size={14} style={{ color: task.priority!.color }} />; })()}
                <span className="text-sm font-medium" style={{ color: task.priority.color }}>{task.priority.name}</span>
              </div>
            </div>
          )}

          {/* Due Date */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Due Date</p>
            {task.dueDate ? (
              <div className="flex items-center gap-1.5">
                <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
                <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assigned To</p>
            {task.assignee ? (
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{task.assignee.firstName} {task.assignee.lastName}</span>
              </div>
            ) : <span className="text-sm text-gray-400">Unassigned</span>}
          </div>

          {/* Owner */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Owner</p>
            {task.owner ? (
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{task.owner.firstName} {task.owner.lastName}</span>
              </div>
            ) : <span className="text-sm text-gray-400">—</span>}
          </div>

          {/* Entity link */}
          {task.relatedEntityType && task.relatedEntityId && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Linked To</p>
              <Link to={`${ENTITY_ROUTES[task.relatedEntityType] || ''}/${task.relatedEntityId}`}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
                <LinkIcon size={14} />
                {task.relatedEntityType.replace(/s$/, '')} → {task.relatedEntityName || task.relatedEntityId}
              </Link>
            </div>
          )}

          {/* Completed at */}
          {task.completedAt && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Completed</p>
              <span className="text-sm text-green-600">
                {new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {task.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Result</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{task.result}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl">
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {[
            { key: 'subtasks' as const, label: 'Subtasks', icon: CheckSquare, count: task.subtaskCount },
            { key: 'notes' as const, label: 'Notes', icon: MessageSquare },
            { key: 'activity' as const, label: 'Activity', icon: Activity },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Subtasks Tab */}
          {activeTab === 'subtasks' && (
            <div>
              {/* Quick-add subtask */}
              {canEdit('tasks') && (
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtask()}
                    placeholder="Add a subtask..."
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                  <button onClick={handleCreateSubtask} disabled={subtaskCreating || !newSubtaskTitle.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {subtaskCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              )}

              {/* Subtask progress */}
              {task.subtaskCount > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(task.completedSubtaskCount / task.subtaskCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {task.completedSubtaskCount}/{task.subtaskCount} done
                  </span>
                </div>
              )}

              {/* Subtask list */}
              {(!task.subtasks || task.subtasks.length === 0) ? (
                <p className="text-sm text-gray-400 text-center py-6">No subtasks yet</p>
              ) : (
                <div className="space-y-2">
                  {task.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                      <button
                        onClick={() => sub.completedAt ? handleReopenSubtask(sub.id) : handleCompleteSubtask(sub.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          sub.completedAt ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {sub.completedAt && <CheckCircle2 size={10} />}
                      </button>
                      <span className={`text-sm flex-1 ${sub.completedAt ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                        {sub.title}
                      </span>
                      {sub.assignee && (
                        <span className="text-xs text-gray-400">{sub.assignee.firstName}</span>
                      )}
                      {sub.dueDate && (
                        <span className={`text-xs ${sub.dueDate && !sub.completedAt && new Date(sub.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                          {new Date(sub.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
              {canEdit('tasks') && (
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                  />
                  <button onClick={handleAddNote} disabled={noteSubmitting || !newNote.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {noteSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                  </button>
                </div>
              )}
              {notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No notes yet</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((n: any) => (
                    <div key={n.id} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{n.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {n.createdByName || 'System'} · {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
              ) : (
                activities.map((a: any, idx: number) => (
                  <div key={a.id || idx} className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg mb-2">
                    <Activity size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{a.title || a.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(a.createdAt || a.performedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Task</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">This will also delete all subtasks.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <TaskFormModal
          task={task}
          types={types}
          statuses={statuses}
          priorities={priorities}
          onSave={handleFormSave}
          onClose={() => setEditModal(false)}
        />
      )}
    </div>
  );
}