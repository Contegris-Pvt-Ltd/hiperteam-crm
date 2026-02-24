// ============================================================
// FILE: apps/web/src/features/tasks/components/TaskFormModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Repeat, Link } from 'lucide-react';
import type {
  Task, TaskType, TaskStatus, TaskPriority,
  CreateTaskData, UpdateTaskData, RecurrenceRule,
} from '../../../api/tasks.api';

interface TaskFormModalProps {
  task?: Task;
  defaultDueDate?: string;
  types: TaskType[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  // Pre-fill for entity linking from detail pages
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityName?: string;
  onSave: (data: CreateTaskData | UpdateTaskData, id?: string) => Promise<void>;
  onClose: () => void;
}

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'At due time' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

export function TaskFormModal({
  task, types, statuses, priorities,
  defaultDueDate,
  relatedEntityType, relatedEntityId, relatedEntityName,
  onSave, onClose,
}: TaskFormModalProps) {
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    taskTypeId: task?.taskTypeId || '',
    statusId: task?.statusId || '',
    priorityId: task?.priorityId || '',
    dueDate: task?.dueDate ? task.dueDate.slice(0, 16) : (defaultDueDate ? defaultDueDate.slice(0, 16) : ''),
    startDate: task?.startDate ? task.startDate.slice(0, 16) : '',
    assignedTo: task?.assignedTo || '',
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : '',
    reminderMinutes: '',
    tags: (task?.tags || []).join(', '),
    result: task?.result || '',
    relatedEntityType: task?.relatedEntityType || relatedEntityType || '',
    relatedEntityId: task?.relatedEntityId || relatedEntityId || '',
  });

  const [showRecurring, setShowRecurring] = useState(task?.isRecurring || false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(
    task?.recurrenceRule || { frequency: 'weekly', interval: 1, endType: 'never' },
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Users for assignment dropdown — load from shared endpoint
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  useEffect(() => {
    import('../../../api/contacts.api').then(({ api }) => {
      api.get('/users?status=active&limit=100')
        .then(res => setUsers(res.data?.data || res.data || []))
        .catch(() => {});
    });
  }, []);

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data: CreateTaskData | UpdateTaskData = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        taskTypeId: form.taskTypeId || undefined,
        statusId: form.statusId || undefined,
        priorityId: form.priorityId || undefined,
        dueDate: form.dueDate || undefined,
        startDate: form.startDate || undefined,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
        assignedTo: form.assignedTo || undefined,
        relatedEntityType: form.relatedEntityType || undefined,
        relatedEntityId: form.relatedEntityId || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        isRecurring: showRecurring,
        recurrenceRule: showRecurring ? recurrence : undefined,
      };

      // Compute reminderAt from dueDate and reminderMinutes
      if (form.dueDate && form.reminderMinutes) {
        const dueMs = new Date(form.dueDate).getTime();
        const reminderMs = dueMs - parseInt(form.reminderMinutes) * 60 * 1000;
        (data as any).reminderAt = new Date(reminderMs).toISOString();
      }

      if (isEdit) {
        (data as UpdateTaskData).result = form.result || undefined;
      }

      await onSave(data, task?.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: 'min(680px, 90vh)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={(e) => handleChange('title', e.target.value)}
              placeholder="What needs to be done?" className={inputClass} autoFocus />
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type</label>
              <select value={form.taskTypeId} onChange={(e) => handleChange('taskTypeId', e.target.value)} className={inputClass}>
                <option value="">Select type</option>
                {types.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select value={form.priorityId} onChange={(e) => handleChange('priorityId', e.target.value)} className={inputClass}>
                <option value="">Select priority</option>
                {priorities.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + Assignee row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.statusId} onChange={(e) => handleChange('statusId', e.target.value)} className={inputClass}>
                <option value="">Default</option>
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Assigned To</label>
              <select value={form.assignedTo} onChange={(e) => handleChange('assignedTo', e.target.value)} className={inputClass}>
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date + Start Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="datetime-local" value={form.dueDate} onChange={(e) => handleChange('dueDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="datetime-local" value={form.startDate} onChange={(e) => handleChange('startDate', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)}
              rows={3} placeholder="Additional details..." className={inputClass} />
          </div>

          {/* Entity link indicator */}
          {(form.relatedEntityType && relatedEntityName) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Link size={14} className="text-blue-500" />
              <span className="text-xs text-blue-700 dark:text-blue-400">
                Linked to {form.relatedEntityType.replace(/s$/, '')}: <strong>{relatedEntityName}</strong>
              </span>
            </div>
          )}

          {/* Toggle buttons for advanced sections */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRecurring(!showRecurring)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                showRecurring
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <Repeat size={12} /> Recurring
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                showAdvanced
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <Plus size={12} /> Advanced
            </button>
          </div>

          {/* Recurring Section */}
          {showRecurring && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Recurrence</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Frequency</label>
                  <select
                    value={recurrence.frequency}
                    onChange={(e) => setRecurrence({ ...recurrence, frequency: e.target.value as any })}
                    className={inputClass}
                  >
                    {FREQUENCIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Every N</label>
                  <input type="number" min="1" max="30"
                    value={recurrence.interval || 1}
                    onChange={(e) => setRecurrence({ ...recurrence, interval: parseInt(e.target.value) || 1 })}
                    className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Ends</label>
                  <select
                    value={recurrence.endType}
                    onChange={(e) => setRecurrence({ ...recurrence, endType: e.target.value as any })}
                    className={inputClass}
                  >
                    <option value="never">Never</option>
                    <option value="after">After N occurrences</option>
                    <option value="on">On date</option>
                  </select>
                </div>
                {recurrence.endType === 'after' && (
                  <div>
                    <label className={labelClass}>Occurrences</label>
                    <input type="number" min="1" max="365"
                      value={recurrence.endAfterCount || 10}
                      onChange={(e) => setRecurrence({ ...recurrence, endAfterCount: parseInt(e.target.value) || 10 })}
                      className={inputClass} />
                  </div>
                )}
                {recurrence.endType === 'on' && (
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input type="date"
                      value={recurrence.endDate || ''}
                      onChange={(e) => setRecurrence({ ...recurrence, endDate: e.target.value })}
                      className={inputClass} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Advanced Section */}
          {showAdvanced && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Advanced</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Est. Minutes</label>
                  <input type="number" min="0" value={form.estimatedMinutes}
                    onChange={(e) => handleChange('estimatedMinutes', e.target.value)}
                    placeholder="e.g. 30" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Reminder</label>
                  <select value={form.reminderMinutes} onChange={(e) => handleChange('reminderMinutes', e.target.value)} className={inputClass}>
                    <option value="">No reminder</option>
                    {REMINDER_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Tags</label>
                <input type="text" value={form.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  placeholder="Comma-separated tags" className={inputClass} />
              </div>
              {isEdit && (
                <div>
                  <label className={labelClass}>Result / Outcome</label>
                  <textarea value={form.result} onChange={(e) => handleChange('result', e.target.value)}
                    rows={2} placeholder="Task outcome or notes..." className={inputClass} />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Task')}
          </button>
        </div>
      </div>
    </div>
  );
}