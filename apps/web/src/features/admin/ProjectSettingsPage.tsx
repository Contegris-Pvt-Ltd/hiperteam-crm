import { useEffect, useState } from 'react';
import { Trash2, Plus, GripVertical, CheckCircle2,
         XCircle, Edit2, Check, X } from 'lucide-react';
import { projectsApi } from '../../api/projects.api';

// ── Shared helpers ──────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  '#6366f1','#8b5cf6','#ec4899','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#64748b',
];

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ColorPicker({
  value, onChange,
}: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {COLOR_PRESETS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border-2 transition-transform
            ${value === c
              ? 'border-gray-800 dark:border-white scale-110'
              : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ProjectSettingsPage() {
  type Tab = 'project-statuses' | 'task-statuses' | 'templates';
  const [activeTab, setActiveTab] = useState<Tab>('project-statuses');

  // ── Data state ────────────────────────────────────────────
  const [projectStatuses, setProjectStatuses]   = useState<any[]>([]);
  const [taskStatuses,    setTaskStatuses]       = useState<any[]>([]);
  const [templates,       setTemplates]          = useState<any[]>([]);
  const [loading,         setLoading]            = useState(false);

  // ── Add form state ────────────────────────────────────────
  const [addPS,  setAddPS]  = useState({ name: '', color: '#6366f1', isClosed: false });
  const [addTS,  setAddTS]  = useState({ name: '', color: '#6366f1', isDone: false });
  const [addTpl, setAddTpl] = useState({ name: '', description: '', color: '#6366f1' });
  const [saving, setSaving] = useState(false);

  // ── Inline edit state ─────────────────────────────────────
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // ── Delete confirm state ──────────────────────────────────
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleteCtx, setDeleteCtx] = useState<Tab | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // ── Load data ─────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ps, ts, tpls] = await Promise.all([
        projectsApi.getStatuses(),
        projectsApi.getTaskStatuses(),
        projectsApi.getTemplates(),
      ]);
      setProjectStatuses(ps);
      setTaskStatuses(ts);
      setTemplates(tpls);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // ── Add handlers ──────────────────────────────────────────
  async function handleAddPS() {
    if (!addPS.name.trim()) return;
    setSaving(true);
    try {
      const created = await projectsApi.createProjectStatus(addPS);
      setProjectStatuses(prev => [...prev, created]);
      setAddPS({ name: '', color: '#6366f1', isClosed: false });
    } finally { setSaving(false); }
  }

  async function handleAddTS() {
    if (!addTS.name.trim()) return;
    setSaving(true);
    try {
      const created = await projectsApi.createProjectTaskStatus(addTS);
      setTaskStatuses(prev => [...prev, created]);
      setAddTS({ name: '', color: '#6366f1', isDone: false });
    } finally { setSaving(false); }
  }

  async function handleAddTpl() {
    if (!addTpl.name.trim()) return;
    setSaving(true);
    try {
      const created = await projectsApi.createTemplate(addTpl);
      setTemplates(prev => [...prev, created]);
      setAddTpl({ name: '', description: '', color: '#6366f1' });
    } finally { setSaving(false); }
  }

  // ── Inline name save ──────────────────────────────────────
  async function handleSaveName(tab: Tab, id: string) {
    if (!editingName.trim()) { setEditingId(null); return; }
    try {
      if (tab === 'project-statuses') {
        const u = await projectsApi.updateProjectStatus(id, { name: editingName });
        setProjectStatuses(prev => prev.map(s => s.id === id ? { ...s, ...u } : s));
      } else if (tab === 'task-statuses') {
        const u = await projectsApi.updateProjectTaskStatus(id, { name: editingName });
        setTaskStatuses(prev => prev.map(s => s.id === id ? { ...s, ...u } : s));
      } else {
        const u = await projectsApi.updateTemplate(id, { name: editingName });
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...u } : t));
      }
    } finally { setEditingId(null); }
  }

  // ── Toggle active ─────────────────────────────────────────
  async function handleToggle(tab: Tab, id: string, current: boolean) {
    if (tab === 'project-statuses') {
      const u = await projectsApi.updateProjectStatus(id, { isActive: !current });
      setProjectStatuses(prev => prev.map(s => s.id === id ? { ...s, ...u } : s));
    } else if (tab === 'task-statuses') {
      const u = await projectsApi.updateProjectTaskStatus(id, { isActive: !current });
      setTaskStatuses(prev => prev.map(s => s.id === id ? { ...s, ...u } : s));
    } else {
      const u = await projectsApi.updateTemplate(id, { isActive: !current });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...u } : t));
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteId || !deleteCtx) return;
    setDeleting(true);
    setDeleteErr('');
    try {
      if (deleteCtx === 'project-statuses')
        await projectsApi.deleteProjectStatus(deleteId);
      else if (deleteCtx === 'task-statuses')
        await projectsApi.deleteProjectTaskStatus(deleteId);
      else
        await projectsApi.deleteTemplate(deleteId);

      if (deleteCtx === 'project-statuses')
        setProjectStatuses(prev => prev.filter(s => s.id !== deleteId));
      else if (deleteCtx === 'task-statuses')
        setTaskStatuses(prev => prev.filter(s => s.id !== deleteId));
      else
        setTemplates(prev => prev.filter(t => t.id !== deleteId));

      setDeleteId(null); setDeleteCtx(null);
    } catch (err: any) {
      setDeleteErr(err?.response?.data?.message ?? err?.message ?? 'Cannot delete');
    } finally { setDeleting(false); }
  }

  // ── Tab classes ───────────────────────────────────────────
  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-purple-600 text-purple-600 dark:text-purple-400'
        : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
    }`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-purple-500
                      border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Project Settings
      </h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
        <button className={tabCls('project-statuses')}
          onClick={() => setActiveTab('project-statuses')}>
          Project Statuses
        </button>
        <button className={tabCls('task-statuses')}
          onClick={() => setActiveTab('task-statuses')}>
          Task Statuses
        </button>
        <button className={tabCls('templates')}
          onClick={() => setActiveTab('templates')}>
          Templates
        </button>
      </div>

      {/* ── Project Statuses Tab ──────────────────────────── */}
      {activeTab === 'project-statuses' && (
        <div>
          {/* Add form */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-4
                          border border-gray-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide
                          text-gray-500 dark:text-slate-400 mb-3">
              Add Status
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Status name"
                value={addPS.name}
                onChange={e => setAddPS(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddPS()}
                className="w-full text-sm border border-gray-300 dark:border-slate-600
                           rounded-lg px-3 py-2 bg-white dark:bg-slate-700
                           text-gray-900 dark:text-white focus:outline-none
                           focus:ring-2 focus:ring-purple-500"
              />
              <ColorPicker
                value={addPS.color}
                onChange={c => setAddPS(f => ({ ...f, color: c }))}
              />
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-600
                                   dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={addPS.isClosed}
                    onChange={e =>
                      setAddPS(f => ({ ...f, isClosed: e.target.checked }))
                    }
                  />
                  Closed
                </label>
              </div>
              <button onClick={handleAddPS} disabled={saving || !addPS.name.trim()}
                className="self-start flex items-center gap-1.5 px-3 py-1.5
                           text-sm bg-purple-600 text-white rounded-lg
                           hover:bg-purple-700 disabled:opacity-50">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {projectStatuses.map(s => (
              <div key={s.id}
                   className="flex items-center gap-3 bg-white dark:bg-slate-800
                              border border-gray-200 dark:border-slate-700
                              rounded-xl px-3 py-2.5">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <ColorDot color={s.color} />

                {editingId === s.id ? (
                  <input autoFocus value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName('project-statuses', s.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 text-sm border-b border-purple-500
                               bg-transparent outline-none text-gray-900
                               dark:text-white"
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-800
                                   dark:text-slate-200">
                    {s.name}
                  </span>
                )}

                {s.isClosed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded
                                   bg-gray-100 dark:bg-slate-700
                                   text-gray-500 dark:text-slate-400">
                    Closed
                  </span>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => handleSaveName('project-statuses', s.id)}
                        className="p-1 text-green-600 hover:text-green-700">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => {
                        setEditingId(s.id); setEditingName(s.name);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button onClick={() => handleToggle(
                      'project-statuses', s.id, s.isActive ?? true,
                    )}
                    className="p-1">
                    {(s.isActive ?? true)
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <XCircle     size={16} className="text-gray-300" />}
                  </button>
                  <button onClick={() => {
                      setDeleteId(s.id); setDeleteCtx('project-statuses');
                      setDeleteErr('');
                    }}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Task Statuses Tab ─────────────────────────────── */}
      {activeTab === 'task-statuses' && (
        <div>
          {/* Add form */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-4
                          border border-gray-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide
                          text-gray-500 dark:text-slate-400 mb-3">
              Add Task Status
            </p>
            <div className="flex flex-col gap-3">
              <input type="text" placeholder="Status name"
                value={addTS.name}
                onChange={e => setAddTS(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddTS()}
                className="w-full text-sm border border-gray-300 dark:border-slate-600
                           rounded-lg px-3 py-2 bg-white dark:bg-slate-700
                           text-gray-900 dark:text-white focus:outline-none
                           focus:ring-2 focus:ring-purple-500"
              />
              <ColorPicker
                value={addTS.color}
                onChange={c => setAddTS(f => ({ ...f, color: c }))}
              />
              <label className="flex items-center gap-2 text-xs text-gray-600
                                 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={addTS.isDone}
                  onChange={e =>
                    setAddTS(f => ({ ...f, isDone: e.target.checked }))
                  }
                />
                Marks task as done
              </label>
              <button onClick={handleAddTS} disabled={saving || !addTS.name.trim()}
                className="self-start flex items-center gap-1.5 px-3 py-1.5
                           text-sm bg-purple-600 text-white rounded-lg
                           hover:bg-purple-700 disabled:opacity-50">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {taskStatuses.map(s => (
              <div key={s.id}
                   className="flex items-center gap-3 bg-white dark:bg-slate-800
                              border border-gray-200 dark:border-slate-700
                              rounded-xl px-3 py-2.5">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <ColorDot color={s.color} />

                {editingId === s.id ? (
                  <input autoFocus value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName('task-statuses', s.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 text-sm border-b border-purple-500
                               bg-transparent outline-none text-gray-900
                               dark:text-white"
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-800
                                   dark:text-slate-200">
                    {s.name}
                  </span>
                )}

                {s.isDone && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded
                                   bg-green-100 dark:bg-green-900/30
                                   text-green-700 dark:text-green-400">
                    Done
                  </span>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => handleSaveName('task-statuses', s.id)}
                        className="p-1 text-green-600 hover:text-green-700">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => {
                        setEditingId(s.id); setEditingName(s.name);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button onClick={() => handleToggle(
                      'task-statuses', s.id, s.isActive ?? true,
                    )}
                    className="p-1">
                    {(s.isActive ?? true)
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <XCircle     size={16} className="text-gray-300" />}
                  </button>
                  <button onClick={() => {
                      setDeleteId(s.id); setDeleteCtx('task-statuses');
                      setDeleteErr('');
                    }}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Templates Tab ─────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div>
          {/* Add form */}
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-4
                          border border-gray-200 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide
                          text-gray-500 dark:text-slate-400 mb-3">
              Add Template
            </p>
            <div className="flex flex-col gap-3">
              <input type="text" placeholder="Template name"
                value={addTpl.name}
                onChange={e => setAddTpl(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddTpl()}
                className="w-full text-sm border border-gray-300 dark:border-slate-600
                           rounded-lg px-3 py-2 bg-white dark:bg-slate-700
                           text-gray-900 dark:text-white focus:outline-none
                           focus:ring-2 focus:ring-purple-500"
              />
              <input type="text" placeholder="Description (optional)"
                value={addTpl.description}
                onChange={e => setAddTpl(f => ({ ...f, description: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-slate-600
                           rounded-lg px-3 py-2 bg-white dark:bg-slate-700
                           text-gray-900 dark:text-white focus:outline-none
                           focus:ring-2 focus:ring-purple-500"
              />
              <ColorPicker
                value={addTpl.color}
                onChange={c => setAddTpl(f => ({ ...f, color: c }))}
              />
              <button onClick={handleAddTpl} disabled={saving || !addTpl.name.trim()}
                className="self-start flex items-center gap-1.5 px-3 py-1.5
                           text-sm bg-purple-600 text-white rounded-lg
                           hover:bg-purple-700 disabled:opacity-50">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex flex-col gap-2">
            {templates.map(t => (
              <div key={t.id}
                   className="flex items-center gap-3 bg-white dark:bg-slate-800
                              border border-gray-200 dark:border-slate-700
                              rounded-xl px-3 py-2.5">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <ColorDot color={t.color ?? '#6366f1'} />

                {editingId === t.id ? (
                  <input autoFocus value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveName('templates', t.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 text-sm border-b border-purple-500
                               bg-transparent outline-none text-gray-900
                               dark:text-white"
                  />
                ) : (
                  <span className="flex-1 text-sm text-gray-800
                                   dark:text-slate-200">
                    {t.name}
                  </span>
                )}

                {t.description && (
                  <span className="text-xs text-gray-400 dark:text-slate-500
                                   truncate max-w-[160px]">
                    {t.description}
                  </span>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  {editingId === t.id ? (
                    <>
                      <button onClick={() => handleSaveName('templates', t.id)}
                        className="p-1 text-green-600 hover:text-green-700">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => {
                        setEditingId(t.id); setEditingName(t.name);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      <Edit2 size={14} />
                    </button>
                  )}
                  <button onClick={() => handleToggle(
                      'templates', t.id, t.isActive ?? true,
                    )}
                    className="p-1">
                    {(t.isActive ?? true)
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <XCircle     size={16} className="text-gray-300" />}
                  </button>
                  <button onClick={() => {
                      setDeleteId(t.id); setDeleteCtx('templates');
                      setDeleteErr('');
                    }}
                    className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ──────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl
                          w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900
                           dark:text-white mb-2">
              Delete?
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              This action cannot be undone.
            </p>
            {deleteErr && (
              <p className="text-sm text-red-500 mb-3">{deleteErr}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteId(null); setDeleteCtx(null); }}
                className="px-4 py-2 text-sm rounded-lg border
                           border-gray-300 dark:border-slate-600
                           text-gray-700 dark:text-slate-300
                           hover:bg-gray-50 dark:hover:bg-slate-700">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white
                           hover:bg-red-700 disabled:opacity-50 font-medium">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
