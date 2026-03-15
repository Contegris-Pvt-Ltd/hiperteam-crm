import { useEffect, useState } from 'react';
import { Trash2, Plus, GripVertical, CheckCircle2,
         XCircle, Edit2, Check, X, ChevronDown, ChevronRight, Loader2, Eye } from 'lucide-react';
import { projectsApi } from '../../api/projects.api';
import { approvalsApi } from '../../api/approvals.api';

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

// ── Template Builder Helpers ────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

function emptyPhase(sortOrder: number = 1) {
  return { id: uid(), name: '', color: '#3B82F6', estimatedDays: null, sortOrder, tasks: [] };
}

function emptyTask(sortOrder: number = 1) {
  return {
    id: uid(),
    title: '',
    description: null,
    priority: 'medium',
    assigneeRole: null,
    dueDaysFromStart: null,
    estimatedHours: null,
    sortOrder,
    subtasks: [],
  };
}

function emptySubtask(sortOrder: number = 1) {
  return {
    id: uid(),
    title: '',
    description: null,
    priority: 'medium',
    assigneeRole: null,
    dueDaysFromStart: null,
    estimatedHours: null,
    sortOrder,
  };
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

  // ── Template Editor State ─────────────────────────────────
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [tplHeader, setTplHeader] = useState<{ name: string; description: string; color: string; estimatedDays: number | null }>({ name: '', description: '', color: '#3B82F6', estimatedDays: null });
  const [tplPhases, setTplPhases] = useState<any[]>([]);
  const [tplApproval, setTplApproval] = useState<{ requireApproval: boolean; triggerEvent: string; approvalRuleId: string | null }>({ requireApproval: false, triggerEvent: 'project_created', approvalRuleId: null });
  const [approvalRules, setApprovalRules] = useState<any[]>([]);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplError, setTplError] = useState('');
  const [expandedPhases, setExpandedPhases] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [ps, ts, tpls] = await Promise.all([
        projectsApi.getStatuses(),
        projectsApi.getTaskStatuses(),
        projectsApi.getTemplates(true),
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
      await openTemplateEditor(created.id);
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

  // ── Template Editor: Open ─────────────────────────────────
  async function openTemplateEditor(templateId: string) {
    try {
      setTplSaving(true);
      const [fullTemplate, rules] = await Promise.all([
        projectsApi.getTemplateById(templateId),
        approvalsApi.getRules(),
      ]);

      setEditingTemplate(templateId);
      setTplHeader({
        name: fullTemplate.name,
        description: fullTemplate.description || '',
        color: fullTemplate.color,
        estimatedDays: fullTemplate.estimatedDays,
      });
      setTplPhases(fullTemplate.phases || []);
      setTplApproval({
        requireApproval: fullTemplate.approvalConfig?.requireApproval || false,
        triggerEvent: fullTemplate.approvalConfig?.triggerEvent || 'project_created',
        approvalRuleId: fullTemplate.approvalConfig?.approvalRuleId || null,
      });
      setApprovalRules(rules.filter(r => r.entityType === 'projects'));
      setExpandedPhases([(fullTemplate.phases?.[0]?.id)].filter((x): x is string => !!x));
    } catch (err) {
      setTplError('Failed to load template');
    } finally {
      setTplSaving(false);
    }
  }

  // ── Template Editor: Save ─────────────────────────────────
  async function handleSaveTemplate() {
    if (!editingTemplate || !tplHeader.name.trim()) {
      setTplError('Template name is required');
      return;
    }

    setTplSaving(true);
    setTplError('');
    try {
      await projectsApi.saveTemplateStructure(editingTemplate, {
        name: tplHeader.name,
        description: tplHeader.description,
        color: tplHeader.color,
        estimatedDays: tplHeader.estimatedDays ?? undefined,
        approvalConfig: tplApproval.requireApproval ? {
          requireApproval: true,
          triggerEvent: tplApproval.triggerEvent,
          approvalRuleId: tplApproval.approvalRuleId,
        } : null,
        phases: tplPhases,
      });
      setEditingTemplate(null);
      await loadAll();
    } catch (err: any) {
      setTplError(err?.response?.data?.message || 'Failed to save template');
    } finally {
      setTplSaving(false);
    }
  }

  // ── Template Editor: Phase handlers ───────────────────────
  function addPhase() {
    const newPhase = emptyPhase((tplPhases.length || 0) + 1);
    setTplPhases([...tplPhases, newPhase]);
  }

  function removePhase(phaseId: string) {
    setTplPhases(tplPhases.filter(p => p.id !== phaseId));
  }

  function updatePhase(phaseId: string, field: string, value: any) {
    setTplPhases(tplPhases.map(p => p.id === phaseId ? { ...p, [field]: value } : p));
  }

  // ── Template Editor: Task handlers ───────────────────────
  function addTask(phaseId: string) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        tasks: [...(p.tasks || []), emptyTask((p.tasks?.length || 0) + 1)],
      };
    }));
  }

  function removeTask(phaseId: string, taskId: string) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return { ...p, tasks: (p.tasks || []).filter((t: any) => t.id !== taskId) };
    }));
  }

  function updateTask(phaseId: string, taskId: string, field: string, value: any) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        tasks: (p.tasks || []).map((t: any) => t.id === taskId ? { ...t, [field]: value } : t),
      };
    }));
  }

  // ── Template Editor: Subtask handlers ─────────────────────
  function addSubtask(phaseId: string, taskId: string) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        tasks: (p.tasks || []).map((t: any) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: [...(t.subtasks || []), emptySubtask((t.subtasks?.length || 0) + 1)],
          };
        }),
      };
    }));
  }

  function removeSubtask(phaseId: string, taskId: string, subtaskId: string) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        tasks: (p.tasks || []).map((t: any) => {
          if (t.id !== taskId) return t;
          return { ...t, subtasks: (t.subtasks || []).filter((s: any) => s.id !== subtaskId) };
        }),
      };
    }));
  }

  function updateSubtask(phaseId: string, taskId: string, subtaskId: string, field: string, value: any) {
    setTplPhases(tplPhases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        tasks: (p.tasks || []).map((t: any) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subtasks: (t.subtasks || []).map((s: any) => s.id === subtaskId ? { ...s, [field]: value } : s),
          };
        }),
      };
    }));
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
    <div className="p-6 max-w-4xl mx-auto">
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

      {/* ── Templates Tab (Template Builder) ─────────────── */}
      {activeTab === 'templates' && (
        <div>
          {!editingTemplate ? (
            <>
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

                    {t.phase_count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded
                                       bg-purple-100 dark:bg-purple-900/30
                                       text-purple-700 dark:text-purple-300">
                        {t.phase_count} phase{t.phase_count !== 1 ? 's' : ''}
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
                        <>
                          <button onClick={() => openTemplateEditor(t.id)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                            <Edit2 size={14} />
                          </button>
                          <button
                            title="Create a draft preview project from this template"
                            disabled={previewing === t.id}
                            onClick={async () => {
                              setPreviewing(t.id);
                              try {
                                const { projectId } = await projectsApi.createPreviewProject(t.id);
                                window.open(`/projects/${projectId}`, '_blank');
                              } catch (e: any) {
                                alert(e?.response?.data?.message || 'Failed to create preview project');
                              } finally {
                                setPreviewing(null);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
                          >
                            {previewing === t.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Eye size={14} />}
                          </button>
                        </>
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
            </>
          ) : (
            // Template Editor
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Template
                </h2>
                <button onClick={() => setEditingTemplate(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {tplError && (
                <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {tplError}
                </div>
              )}

              {/* Template Header */}
              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Template Name
                  </label>
                  <input type="text" value={tplHeader.name}
                    onChange={e => setTplHeader(h => ({ ...h, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea value={tplHeader.description || ''}
                    onChange={e => setTplHeader(h => ({ ...h, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Color
                    </label>
                    <ColorPicker
                      value={tplHeader.color}
                      onChange={c => setTplHeader(h => ({ ...h, color: c }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Estimated Days
                    </label>
                    <input type="number" value={tplHeader.estimatedDays || ''}
                      onChange={e => setTplHeader(h => ({ ...h, estimatedDays: e.target.value ? parseInt(e.target.value) : null }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Approval Config */}
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200 dark:border-slate-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Approval Configuration
                </label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={tplApproval.requireApproval}
                    onChange={e => setTplApproval(a => ({ ...a, requireApproval: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    Require approval for this template
                  </span>
                </div>
                {tplApproval.requireApproval && (
                  <div className="grid grid-cols-2 gap-3">
                    <select value={tplApproval.triggerEvent}
                      onChange={e => setTplApproval(a => ({ ...a, triggerEvent: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                      <option value="project_created">On Project Creation</option>
                      <option value="project_completed">On Project Completion</option>
                      <option value="budget_exceeded">On Budget Exceeded</option>
                      <option value="manual">Manual Request</option>
                    </select>
                    <select value={tplApproval.approvalRuleId || ''}
                      onChange={e => setTplApproval(a => ({ ...a, approvalRuleId: e.target.value || null }))}
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm">
                      <option value="">Select approval rule...</option>
                      {approvalRules.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Phases */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Phases & Tasks
                  </label>
                  <button onClick={addPhase}
                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400">
                    <Plus size={14} /> Add Phase
                  </button>
                </div>

                <div className="space-y-3">
                  {tplPhases.map((phase: any) => (
                    <div key={phase.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600 p-4">
                      {/* Phase Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <button onClick={() => setExpandedPhases(exp => exp.includes(phase.id) ? exp.filter(p => p !== phase.id) : [...exp, phase.id])}
                          className="p-1 text-gray-400 hover:text-gray-600">
                          {expandedPhases.includes(phase.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <input type="text" placeholder="Phase name" value={phase.name}
                          onChange={e => updatePhase(phase.id, 'name', e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                        <button onClick={() => removePhase(phase.id)}
                          className="p-1 text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Phase Details when Expanded */}
                      {expandedPhases.includes(phase.id) && (
                        <div className="ml-6 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Color
                              </label>
                              <div className="flex gap-1">
                                {COLOR_PRESETS.map(c => (
                                  <button key={c} onClick={() => updatePhase(phase.id, 'color', c)}
                                    className={`w-4 h-4 rounded-full border ${phase.color === c ? 'border-gray-800 dark:border-white' : 'border-gray-300'}`}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                Est. Days
                              </label>
                              <input type="number" value={phase.estimatedDays || ''}
                                onChange={e => updatePhase(phase.id, 'estimatedDays', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Tasks */}
                          <div className="bg-white dark:bg-slate-800 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                                Tasks
                              </span>
                              <button onClick={() => addTask(phase.id)}
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700">
                                <Plus size={12} /> Add
                              </button>
                            </div>

                            <div className="space-y-2">
                              {(phase.tasks || []).map((task: any) => (
                                <div key={task.id} className="border border-gray-200 dark:border-slate-600 rounded p-2">
                                  {/* Task Header */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <button onClick={() => setExpandedTasks(exp => exp.includes(task.id) ? exp.filter(t => t !== task.id) : [...exp, task.id])}
                                      className="p-0.5 text-gray-400 hover:text-gray-600">
                                      {expandedTasks.includes(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    <input type="text" placeholder="Task title" value={task.title}
                                      onChange={e => updateTask(phase.id, task.id, 'title', e.target.value)}
                                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    />
                                    <button onClick={() => removeTask(phase.id, task.id)}
                                      className="p-0.5 text-red-500 hover:text-red-700">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>

                                  {/* Task Details when Expanded */}
                                  {expandedTasks.includes(task.id) && (
                                    <div className="ml-5 space-y-2 mb-2">
                                      <input type="text" placeholder="Description" value={task.description || ''}
                                        onChange={e => updateTask(phase.id, task.id, 'description', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                      />
                                      <div className="grid grid-cols-4 gap-1">
                                        <select value={task.priority || 'medium'}
                                          onChange={e => updateTask(phase.id, task.id, 'priority', e.target.value)}
                                          className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white">
                                          <option value="low">Low</option>
                                          <option value="medium">Medium</option>
                                          <option value="high">High</option>
                                          <option value="urgent">Urgent</option>
                                        </select>
                                        <input type="number" placeholder="Due days" value={task.dueDaysFromStart || ''}
                                          onChange={e => updateTask(phase.id, task.id, 'dueDaysFromStart', e.target.value ? parseInt(e.target.value) : null)}
                                          className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                        />
                                        <input type="number" placeholder="Est. hours" value={task.estimatedHours || ''}
                                          onChange={e => updateTask(phase.id, task.id, 'estimatedHours', e.target.value ? parseFloat(e.target.value) : null)}
                                          className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                        />
                                        <input type="text" placeholder="Role" value={task.assigneeRole || ''}
                                          onChange={e => updateTask(phase.id, task.id, 'assigneeRole', e.target.value)}
                                          className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                        />
                                      </div>

                                      {/* Subtasks */}
                                      <div className="bg-gray-50 dark:bg-slate-600/30 rounded p-2 mt-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[10px] font-medium text-gray-600 dark:text-slate-400">
                                            Subtasks
                                          </span>
                                          <button onClick={() => addSubtask(phase.id, task.id)}
                                            className="flex items-center gap-0.5 text-[10px] text-purple-600 hover:text-purple-700">
                                            <Plus size={10} /> Add
                                          </button>
                                        </div>
                                        <div className="space-y-1">
                                          {(task.subtasks || []).map((subtask: any) => (
                                            <div key={subtask.id} className="flex items-center gap-1 p-1 bg-white dark:bg-slate-700 rounded text-[10px]">
                                              <input type="text" placeholder="Subtask" value={subtask.title}
                                                onChange={e => updateSubtask(phase.id, task.id, subtask.id, 'title', e.target.value)}
                                                className="flex-1 px-1.5 py-0.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                              />
                                              <input type="number" placeholder="Days" value={subtask.dueDaysFromStart || ''}
                                                onChange={e => updateSubtask(phase.id, task.id, subtask.id, 'dueDaysFromStart', e.target.value ? parseInt(e.target.value) : null)}
                                                className="w-10 px-1 py-0.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                              />
                                              <button onClick={() => removeSubtask(phase.id, task.id, subtask.id)}
                                                className="p-0.5 text-red-500 hover:text-red-700">
                                                <X size={10} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button onClick={handleSaveTemplate} disabled={tplSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50">
                  {tplSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Template
                </button>
                <button onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200">
                  Cancel
                </button>
              </div>
            </div>
          )}
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
