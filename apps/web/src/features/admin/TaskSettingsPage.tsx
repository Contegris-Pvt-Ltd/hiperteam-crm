// ============================================================
// FILE: apps/web/src/features/admin/TaskSettingsPage.tsx
// ============================================================
// Admin settings page for Tasks module.
// 3 tabs: Types | Statuses | Priorities
// Pattern matches LeadSettingsPage / OpportunitySettingsPage
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, X, Check, Pencil,
  CheckSquare, Layers, AlertCircle,
  ToggleLeft, ToggleRight, GripVertical,
  Phone, Mail, Calendar, ArrowRight, Monitor, FileText, Users,
  ArrowUp, ArrowDown, Minus, Flame,
} from 'lucide-react';
import type { TaskType, TaskStatus, TaskPriority } from '../../api/tasks.api';
import { taskSettingsApi } from '../../api/tasks.api';

// ============================================================
// TABS
// ============================================================

const TABS = [
  { id: 'types', label: 'Task Types', icon: Layers },
  { id: 'statuses', label: 'Statuses', icon: CheckSquare },
  { id: 'priorities', label: 'Priorities', icon: AlertCircle },
] as const;

type TabId = typeof TABS[number]['id'];

// ============================================================
// ICON OPTIONS
// ============================================================
const TYPE_ICON_OPTIONS = [
  { value: 'check-square', label: 'To-Do', Icon: CheckSquare },
  { value: 'phone', label: 'Phone', Icon: Phone },
  { value: 'mail', label: 'Mail', Icon: Mail },
  { value: 'calendar', label: 'Calendar', Icon: Calendar },
  { value: 'arrow-right', label: 'Arrow', Icon: ArrowRight },
  { value: 'monitor', label: 'Monitor', Icon: Monitor },
  { value: 'file-text', label: 'File', Icon: FileText },
  { value: 'users', label: 'Users', Icon: Users },
];

const PRIORITY_ICON_OPTIONS = [
  { value: 'alert-circle', label: 'Alert', Icon: AlertCircle },
  { value: 'arrow-up', label: 'Arrow Up', Icon: ArrowUp },
  { value: 'minus', label: 'Minus', Icon: Minus },
  { value: 'arrow-down', label: 'Arrow Down', Icon: ArrowDown },
  { value: 'flame', label: 'Flame', Icon: Flame },
];

const COLOR_PRESETS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
  '#14B8A6', '#6366F1', '#9CA3AF', '#6B7280',
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function TaskSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('types');
  const [loading, setLoading] = useState(true);

  // Data
  const [types, setTypes] = useState<TaskType[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [priorities, setPriorities] = useState<TaskPriority[]>([]);

  // Load tab data
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab: TabId) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'types':
          setTypes(await taskSettingsApi.getTypes());
          break;
        case 'statuses':
          setStatuses(await taskSettingsApi.getStatuses());
          break;
        case 'priorities':
          setPriorities(await taskSettingsApi.getPriorities());
          break;
      }
    } catch (err) {
      console.error(`Failed to load ${tab} data:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Task Settings</h1>
            <p className="text-gray-600 dark:text-slate-400">Configure task types, statuses, and priorities</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'types' && (
            <TypesTab types={types} onReload={() => loadTabData('types')} />
          )}
          {activeTab === 'statuses' && (
            <StatusesTab statuses={statuses} onReload={() => loadTabData('statuses')} />
          )}
          {activeTab === 'priorities' && (
            <PrioritiesTab priorities={priorities} onReload={() => loadTabData('priorities')} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// TAB 1: TYPES
// ============================================================

function TypesTab({ types, onReload }: { types: TaskType[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', icon: 'check-square', color: '#3B82F6', description: '' });
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await taskSettingsApi.createType(form);
      setCreating(false);
      setForm({ name: '', icon: 'check-square', color: '#3B82F6', description: '' });
      onReload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create type');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, updates: any) => {
    setSaving(true);
    try {
      await taskSettingsApi.updateType(id, updates);
      setEditing(null);
      onReload();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task type?')) return;
    try {
      await taskSettingsApi.deleteType(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete type');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await taskSettingsApi.updateType(id, { isActive: !isActive });
    onReload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Types</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Define the types of tasks your team can create</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Type
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Research" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Icon</label>
              <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {TYPE_ICON_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {COLOR_PRESETS.slice(0, 6).map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setCreating(false); setError(''); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
            </button>
          </div>
        </div>
      )}

      {/* Types list */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {types.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No task types configured</div>
          ) : types.map((type) => {
            const IconComp = TYPE_ICON_OPTIONS.find(o => o.value === type.icon)?.Icon || CheckSquare;
            return (
              <div key={type.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 group">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${type.color}18` }}>
                  <IconComp size={16} style={{ color: type.color }} />
                </div>

                {editing === type.id ? (
                  <EditableNameInput
                    defaultValue={type.name}
                    onSave={(name) => handleUpdate(type.id, { name })}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{type.name}</span>
                )}

                <span className="text-xs text-gray-400">{type.slug}</span>

                {type.isSystem && (
                  <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded">System</span>
                )}

                <button onClick={() => handleToggle(type.id, type.isActive)}
                  className={`p-1 rounded ${type.isActive ? 'text-green-600' : 'text-gray-400'}`}
                  title={type.isActive ? 'Active' : 'Inactive'}>
                  {type.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(type.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                    <Pencil size={14} />
                  </button>
                  {!type.isSystem && (
                    <button onClick={() => handleDelete(type.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 2: STATUSES
// ============================================================

function StatusesTab({ statuses, onReload }: { statuses: TaskStatus[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#6B7280', isOpen: true, isCompleted: false });
  const [error, setError] = useState('');

  const sorted = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await taskSettingsApi.createStatus(form);
      setCreating(false);
      setForm({ name: '', color: '#6B7280', isOpen: true, isCompleted: false });
      onReload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create status');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, updates: any) => {
    setSaving(true);
    try {
      await taskSettingsApi.updateStatus(id, updates);
      setEditing(null);
      onReload();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this status?')) return;
    try {
      await taskSettingsApi.deleteStatus(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await taskSettingsApi.updateStatus(id, { isActive: !isActive });
    onReload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Statuses</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Statuses define your task workflow. Mark one as "Completed" to auto-close tasks.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Status
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Blocked" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {COLOR_PRESETS.slice(0, 6).map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={form.isOpen} onChange={(e) => setForm({ ...form, isOpen: e.target.checked, isCompleted: false })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Open (task is still active)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={form.isCompleted} onChange={(e) => setForm({ ...form, isCompleted: e.target.checked, isOpen: false })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Completed (closes the task)
              </label>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setCreating(false); setError(''); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
            </button>
          </div>
        </div>
      )}

      {/* Statuses list */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {sorted.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No statuses configured</div>
          ) : sorted.map((status) => (
            <div key={status.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 group">
              <GripVertical size={14} className="text-gray-300 cursor-grab" />

              {/* Color dot */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />

              {editing === status.id ? (
                <EditableNameInput
                  defaultValue={status.name}
                  onSave={(name) => handleUpdate(status.id, { name })}
                  onCancel={() => setEditing(null)}
                  saving={saving}
                />
              ) : (
                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{status.name}</span>
              )}

              {/* Badges */}
              {status.isOpen && (
                <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Open</span>
              )}
              {status.isCompleted && (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Completed</span>
              )}
              {!status.isOpen && !status.isCompleted && (
                <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-medium">Closed</span>
              )}

              {status.isSystem && (
                <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded">System</span>
              )}

              {'taskCount' in status && typeof (status as any).taskCount === 'number' && (
                <span className="text-xs text-gray-400">{(status as any).taskCount} tasks</span>
              )}

              <button onClick={() => handleToggle(status.id, status.isActive)}
                className={`p-1 rounded ${status.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {status.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditing(status.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                  <Pencil size={14} />
                </button>
                {!status.isSystem && (
                  <button onClick={() => handleDelete(status.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: PRIORITIES
// ============================================================

function PrioritiesTab({ priorities, onReload }: { priorities: TaskPriority[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#6B7280', icon: 'minus', level: 0 });
  const [error, setError] = useState('');

  const sorted = [...priorities].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await taskSettingsApi.createPriority(form);
      setCreating(false);
      setForm({ name: '', color: '#6B7280', icon: 'minus', level: 0 });
      onReload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create priority');
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: string, updates: any) => {
    setSaving(true);
    try {
      await taskSettingsApi.updatePriority(id, updates);
      setEditing(null);
      onReload();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this priority?')) return;
    try {
      await taskSettingsApi.deletePriority(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSetDefault = async (id: string) => {
    await taskSettingsApi.updatePriority(id, { isDefault: true });
    onReload();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await taskSettingsApi.updatePriority(id, { isActive: !isActive });
    onReload();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Priorities</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Priorities help your team focus on what matters most. Higher levels = more urgent.
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Priority
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Critical" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Icon</label>
              <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800">
                {PRIORITY_ICON_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Color</label>
              <div className="flex gap-1 flex-wrap">
                {COLOR_PRESETS.slice(0, 6).map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Level (urgency)</label>
              <input type="number" min="0" max="10" value={form.level} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || 0 })}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => { setCreating(false); setError(''); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
            </button>
          </div>
        </div>
      )}

      {/* Priorities list */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {sorted.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No priorities configured</div>
          ) : sorted.map((priority) => {
            const IconComp = PRIORITY_ICON_OPTIONS.find(o => o.value === priority.icon)?.Icon || Minus;
            return (
              <div key={priority.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 group">
                <GripVertical size={14} className="text-gray-300 cursor-grab" />

                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${priority.color}18` }}>
                  <IconComp size={16} style={{ color: priority.color }} />
                </div>

                {editing === priority.id ? (
                  <EditableNameInput
                    defaultValue={priority.name}
                    onSave={(name) => handleUpdate(priority.id, { name })}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{priority.name}</span>
                )}

                <span className="text-xs text-gray-400">Level {priority.level}</span>

                {priority.isDefault && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Default</span>
                )}

                {priority.isSystem && (
                  <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded">System</span>
                )}

                {!priority.isDefault && (
                  <button onClick={() => handleSetDefault(priority.id)}
                    className="text-[10px] text-gray-400 hover:text-blue-600 px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="Set as default">
                    Set Default
                  </button>
                )}

                <button onClick={() => handleToggle(priority.id, priority.isActive)}
                  className={`p-1 rounded ${priority.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {priority.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(priority.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded">
                    <Pencil size={14} />
                  </button>
                  {!priority.isSystem && (
                    <button onClick={() => handleDelete(priority.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED: Inline Name Editor
// ============================================================

function EditableNameInput({
  defaultValue, onSave, onCancel, saving,
}: {
  defaultValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-2 flex-1">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(value); if (e.key === 'Escape') onCancel(); }}
        className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
        autoFocus />
      <button onClick={() => onSave(value)} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
        <X size={14} />
      </button>
    </div>
  );
}