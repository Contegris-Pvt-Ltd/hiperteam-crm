// ============================================================
// FILE: apps/web/src/features/admin/TargetsSettingsPage.tsx
//
// Dedicated admin page for Targets & Gamification.
// Tabs: Targets | Badges | Settings
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronRight,
  Zap, Users, Building, Globe, User, RefreshCw, Copy,
  Award, Settings, ArrowLeft, Filter,
} from 'lucide-react';
import { targetsApi, gamificationApi } from '../../api/targets.api';
import type {
  Target as TargetType, TargetAssignment, MetricDefinition, Badge,
} from '../../api/targets.api';
import { leadSettingsApi } from '../../api/leads.api';
import { opportunitySettingsApi } from '../../api/opportunities.api';

// ── Constants ─────────────────────────────────────────────────

const SCOPE_ICONS: Record<string, any> = {
  company: Globe, department: Building, team: Users, individual: User,
};

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const MODULE_LABELS: Record<string, string> = {
  leads: 'Leads', opportunities: 'Opportunities', activities: 'Activities', tasks: 'Tasks',
};

const MODULE_COLORS: Record<string, string> = {
  leads: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  opportunities: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  activities: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  tasks: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const TIER_STYLES: Record<string, { ring: string; bg: string }> = {
  bronze:   { ring: 'ring-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  silver:   { ring: 'ring-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50' },
  gold:     { ring: 'ring-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  platinum: { ring: 'ring-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  diamond:  { ring: 'ring-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
};

// ── Main Page ─────────────────────────────────────────────────

export function TargetsSettingsPage() {
  const [activeTab, setActiveTab] = useState<'targets' | 'badges' | 'settings'>('targets');

  const tabs = [
    { id: 'targets' as const, label: 'Targets & Assignments', icon: Target },
    { id: 'badges' as const, label: 'Badges', icon: Award },
    { id: 'settings' as const, label: 'Gamification Settings', icon: Settings },
  ];

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Targets & Gamification</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Configure performance targets, badges, and gamification across all modules
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-slate-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'targets' && <TargetsTab />}
      {activeTab === 'badges' && <BadgesTab />}
      {activeTab === 'settings' && <GamificationSettingsTab />}
    </div>
  );
}

// ============================================================
// TAB 1: TARGETS & ASSIGNMENTS
// ============================================================

function TargetsTab() {
  const [targets, setTargets] = useState<TargetType[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, TargetAssignment[]>>({});

  // Create/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', module: '', metricKey: '',
    metricType: 'count', metricUnit: '', period: 'monthly',
    cascadeEnabled: false, cascadeMethod: 'equal',
    badgeOnAchieve: true, streakTracking: true, milestoneNotifications: true,
    customQuery: '', filterCriteria: {} as Record<string, any>,
  });

  // Pipeline stages for parameterized metrics (stage picker)
  const [pipelineStages, setPipelineStages] = useState<{ id: string; name: string; module: string; color: string; sortOrder: number }[]>([]);

  // Assignment form
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({
    scopeType: 'company', userId: '', teamId: '', department: '',
    targetValue: '', periodCount: '3',
  });

  const loadTargets = useCallback(async () => {
    try {
      const [tgts, mtrs] = await Promise.all([
        targetsApi.getAll(moduleFilter || undefined),
        targetsApi.getMetrics(),
      ]);
      setTargets(tgts);
      setMetrics(mtrs);

      // Load pipeline stages for stage picker (parameterized metrics)
      try {
        const leadStages = (await leadSettingsApi.getStages()).map((s: any) => ({ ...s, module: 'leads' }));
        let oppStages: any[] = [];
        try {
          oppStages = (await opportunitySettingsApi.getStages()).map((s: any) => ({ ...s, module: 'opportunities' }));
        } catch { /* opp stages may not exist yet */ }
        setPipelineStages([...leadStages, ...oppStages]);
      } catch { /* stages optional */ }
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  }, [moduleFilter]);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  const loadAssignments = async (targetId: string) => {
    try {
      const data = await targetsApi.getAssignments(targetId);
      setAssignments(prev => ({ ...prev, [targetId]: data }));
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }
  };

  // ── Target CRUD ───────────────────────────────────────────
  const resetForm = () => {
    setForm({
      name: '', description: '', module: '', metricKey: '',
      metricType: 'count', metricUnit: '', period: 'monthly',
      cascadeEnabled: false, cascadeMethod: 'equal',
      badgeOnAchieve: true, streakTracking: true, milestoneNotifications: true,
      customQuery: '', filterCriteria: {},
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (target: TargetType) => {
    setForm({
      name: target.name, description: target.description || '',
      module: target.module, metricKey: target.metricKey,
      metricType: target.metricType, metricUnit: target.metricUnit,
      period: target.period,
      cascadeEnabled: target.cascadeEnabled, cascadeMethod: target.cascadeMethod,
      badgeOnAchieve: target.badgeOnAchieve, streakTracking: target.streakTracking,
      milestoneNotifications: target.milestoneNotifications,
      customQuery: target.customQuery || '',
      filterCriteria: target.filterCriteria || {},
    });
    setEditingId(target.id);
    setShowForm(true);
  };

  const handleMetricChange = (key: string) => {
    const metric = metrics.find(m => m.key === key);
    setForm(prev => ({
      ...prev,
      metricKey: key,
      module: metric?.module || prev.module,
      name: prev.name || (metric ? `${PERIOD_LABELS[prev.period]} ${metric.label} Target` : ''),
      metricUnit: metric?.unit || prev.metricUnit,
      metricType: metric?.metricType || prev.metricType,
    }));
  };

  const handleSave = async () => {
    try {
      const selectedMetric = metrics.find(m => m.key === form.metricKey);
      const payload = {
        ...form,
        module: form.module || selectedMetric?.module || 'leads',
        metricType: form.metricKey === '_custom' ? form.metricType : (selectedMetric?.metricType || 'count'),
        metricUnit: form.metricUnit || selectedMetric?.unit || '',
        filterCriteria: form.filterCriteria,
      };

      if (editingId) {
        await targetsApi.update(editingId, payload);
      } else {
        await targetsApi.create(payload as any);
      }
      resetForm();
      loadTargets();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this target and all its assignments?')) return;
    try {
      await targetsApi.delete(id);
      loadTargets();
    } catch (err) { console.error('Delete failed:', err); }
  };

  const handleToggleActive = async (target: TargetType) => {
    try {
      await targetsApi.update(target.id, { isActive: !target.isActive } as any);
      loadTargets();
    } catch (err) { console.error('Toggle failed:', err); }
  };

  const handleCreateAssignment = async (targetId: string) => {
    if (!assignForm.targetValue) return;
    try {
      await targetsApi.generatePeriods(targetId, {
        count: parseInt(assignForm.periodCount) || 3,
        scopeType: assignForm.scopeType,
        userId: assignForm.userId || undefined,
        teamId: assignForm.teamId || undefined,
        department: assignForm.department || undefined,
        targetValue: parseFloat(assignForm.targetValue),
      });
      setShowAssignForm(null);
      loadAssignments(targetId);
    } catch (err) { console.error('Assignment creation failed:', err); }
  };

  const handleCascade = async (targetId: string, parentAssignmentId: string, toScope: string) => {
    try {
      await targetsApi.cascade(targetId, parentAssignmentId, toScope);
      loadAssignments(targetId);
    } catch (err) { console.error('Cascade failed:', err); }
  };

  const handleDeleteAssignment = async (targetId: string, assignmentId: string) => {
    try {
      await targetsApi.deleteAssignment(assignmentId);
      loadAssignments(targetId);
    } catch (err) { console.error('Delete assignment failed:', err); }
  };

  const toggleExpand = (targetId: string) => {
    if (expandedTarget === targetId) {
      setExpandedTarget(null);
    } else {
      setExpandedTarget(targetId);
      if (!assignments[targetId]) loadAssignments(targetId);
    }
  };

  // Group metrics by module for the dropdown
  const metricsByModule = metrics.reduce((acc, m) => {
    if (!acc[m.module]) acc[m.module] = [];
    acc[m.module].push(m);
    return acc;
  }, {} as Record<string, MetricDefinition[]>);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300"
          >
            <option value="">All Modules</option>
            {Object.entries(MODULE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{targets.length} target{targets.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Target
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-blue-50 dark:bg-slate-800/50 border border-blue-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {editingId ? 'Edit Target' : 'New Target'}
          </h4>

          {/* Row 1: Metric (grouped by module) + Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Metric</label>
              <select
                value={form.metricKey}
                onChange={e => handleMetricChange(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                disabled={!!editingId}
              >
                <option value="">Select a metric...</option>
                {Object.entries(metricsByModule).map(([mod, mets]) => (
                  <optgroup key={mod} label={`━━ ${MODULE_LABELS[mod] || mod} ━━`}>
                    {mets.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label} ({m.unit || m.metricType})
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="━━ Custom ━━">
                  <option value="_custom">✏️ Custom SQL Query</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Period</label>
              <select
                value={form.period}
                onChange={e => setForm(prev => ({ ...prev, period: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stage Picker — shown when metric requires config (e.g. leads_reached_stage) */}
          {(() => {
            const selectedMetric = metrics.find(m => m.key === form.metricKey);
            if (!selectedMetric?.configFields?.length) return null;
            return (
              <div className="bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wider mb-2">
                  Metric Configuration
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {selectedMetric.configFields.map(field => {
                    if (field.type === 'stage_picker') {
                      const stagesForModule = pipelineStages.filter(s => s.module === (field.module || form.module));
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <select
                            value={form.filterCriteria[field.key] || ''}
                            onChange={e => setForm(prev => ({
                              ...prev,
                              filterCriteria: { ...prev.filterCriteria, [field.key]: e.target.value },
                            }))}
                            className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          >
                            <option value="">Select a stage...</option>
                            {stagesForModule
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                          {stagesForModule.length === 0 && (
                            <p className="text-[10px] text-amber-500 mt-1">
                              No stages loaded. Check that pipeline stages exist for this module.
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })()}

          {/* Row 2: Name + Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Target Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Monthly Revenue Target"
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Custom query */}
          {form.metricKey === '_custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                Custom SQL Query
                <span className="text-gray-400 font-normal ml-1">
                  (Use $SCHEMA, $FROM, $TO, $OWNER_ID. Must return a single "value" column.)
                </span>
              </label>
              <textarea
                value={form.customQuery}
                onChange={e => setForm(prev => ({ ...prev, customQuery: e.target.value }))}
                rows={3}
                placeholder='SELECT COUNT(*) as value FROM "$SCHEMA".my_table WHERE created_at >= $FROM AND created_at <= $TO'
                className="w-full text-xs font-mono border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Module</label>
                  <select
                    value={form.module}
                    onChange={e => setForm(prev => ({ ...prev, module: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                  >
                    {Object.entries(MODULE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Type</label>
                  <select
                    value={form.metricType}
                    onChange={e => setForm(prev => ({ ...prev, metricType: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                  >
                    <option value="count">Count</option>
                    <option value="sum">Sum / Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Unit</label>
                  <input
                    type="text" value={form.metricUnit}
                    onChange={e => setForm(prev => ({ ...prev, metricUnit: e.target.value }))}
                    placeholder="$, %, leads..."
                    className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Cascade */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox" checked={form.cascadeEnabled}
                  onChange={e => setForm(prev => ({ ...prev, cascadeEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </div>
              <span className="text-sm text-gray-700 dark:text-slate-300">Auto-cascade down</span>
            </label>
            {form.cascadeEnabled && (
              <select
                value={form.cascadeMethod}
                onChange={e => setForm(prev => ({ ...prev, cascadeMethod: e.target.value }))}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900"
              >
                <option value="equal">Equal distribution</option>
                <option value="weighted">Weighted</option>
                <option value="manual">Manual</option>
              </select>
            )}
          </div>

          {/* Row 4: Gamification toggles */}
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'badgeOnAchieve', label: 'Award badges' },
              { key: 'streakTracking', label: 'Track streaks' },
              { key: 'milestoneNotifications', label: 'Milestone notifications' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={(form as any)[key]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.name || !form.metricKey || (() => {
                const m = metrics.find(x => x.key === form.metricKey);
                return m?.configFields?.some(f => f.required && !form.filterCriteria[f.key]) || false;
              })()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> {editingId ? 'Update' : 'Create'} Target
            </button>
            <button onClick={resetForm}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Targets List */}
      {targets.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/30 rounded-xl">
          <Target className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-slate-400">No targets configured yet.</p>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-3 text-sm text-blue-500 hover:text-blue-600">
            + Create your first target
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map(target => {
            const isExpanded = expandedTarget === target.id;
            const targetAssignments = assignments[target.id] || [];
            const metric = metrics.find(m => m.key === target.metricKey);

            return (
              <div key={target.id}
                className={`border rounded-xl transition-colors ${
                  target.isActive
                    ? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 opacity-60'
                }`}
              >
                {/* Target header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors"
                  onClick={() => toggleExpand(target.id)}>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{target.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${MODULE_COLORS[target.module] || ''}`}>
                        {MODULE_LABELS[target.module] || target.module}
                      </span>
                      {target.cascadeEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">
                          Cascade: {target.cascadeMethod}
                        </span>
                      )}
                      {!target.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {metric?.label || target.metricKey}
                      {target.filterCriteria?.stageId && (() => {
                        const stage = pipelineStages.find(s => s.id === target.filterCriteria?.stageId);
                        return stage ? ` → ${stage.name}` : '';
                      })()}
                      {' · '}{PERIOD_LABELS[target.period]} · {target.metricUnit || target.metricType}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggleActive(target)}
                      className={`p-1.5 rounded-lg text-xs ${target.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {target.isActive ? '●' : '○'}
                    </button>
                    <button onClick={() => handleEdit(target)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(target.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded: Assignments */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Assignments</h5>
                      <button onClick={() => setShowAssignForm(showAssignForm === target.id ? null : target.id)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600">
                        <Plus className="w-3 h-3" /> Add Assignment
                      </button>
                    </div>

                    {showAssignForm === target.id && (
                      <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3 mb-3 space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Scope</label>
                            <select value={assignForm.scopeType}
                              onChange={e => setAssignForm(prev => ({ ...prev, scopeType: e.target.value }))}
                              className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900">
                              <option value="company">Company</option>
                              <option value="department">Department</option>
                              <option value="team">Team</option>
                              <option value="individual">Individual</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Value</label>
                            <input type="number" value={assignForm.targetValue}
                              onChange={e => setAssignForm(prev => ({ ...prev, targetValue: e.target.value }))}
                              placeholder="e.g. 50000"
                              className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Periods</label>
                            <input type="number" value={assignForm.periodCount}
                              onChange={e => setAssignForm(prev => ({ ...prev, periodCount: e.target.value }))}
                              min="1" max="12"
                              className="w-full text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900" />
                          </div>
                          <div className="flex items-end">
                            <button onClick={() => handleCreateAssignment(target.id)} disabled={!assignForm.targetValue}
                              className="w-full text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                              Create
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {targetAssignments.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">
                        No assignments yet. Add a company-level target, then cascade down.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {targetAssignments.map(a => {
                          const ScopeIcon = SCOPE_ICONS[a.scopeType] || Globe;
                          const paceColor = a.progress?.pace === 'ahead' || a.progress?.pace === 'achieved'
                            ? 'text-emerald-500' : a.progress?.pace === 'at_risk'
                            ? 'text-amber-500' : a.progress?.pace === 'behind'
                            ? 'text-red-500' : 'text-blue-500';

                          return (
                            <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/30 group">
                              <ScopeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-700 dark:text-slate-300">
                                  {a.scopeType === 'company' ? 'Company-wide' :
                                   a.scopeType === 'individual' ? (a.user?.name || 'User') :
                                   a.scopeType === 'team' ? (a.teamName || 'Team') :
                                   a.department || 'Department'}
                                </span>
                                {a.isCascaded && <span className="text-[10px] text-gray-400 ml-1">(auto)</span>}
                                {a.isOverridden && <span title="Manually overridden"><Zap className="w-3 h-3 text-amber-500 inline ml-1" /></span>}
                              </div>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {target.metricUnit === '$' ? `$${Number(a.targetValue).toLocaleString()}` : Number(a.targetValue).toLocaleString()}
                              </span>
                              {a.progress && (
                                <span className={`text-[10px] font-medium ${paceColor}`}>{a.progress.percentage.toFixed(0)}%</span>
                              )}
                              {target.cascadeEnabled && ['company', 'department', 'team'].includes(a.scopeType) && (
                                <button onClick={() => handleCascade(target.id, a.id, a.scopeType === 'company' ? 'team' : 'individual')}
                                  className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                                  <Copy className="w-3 h-3" /> Cascade
                                </button>
                              )}
                              <button onClick={() => handleDeleteAssignment(target.id, a.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 2: BADGES
// ============================================================

function BadgesTab() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', icon: '🏆', color: '#F59E0B',
    triggerType: 'target_achieved', triggerConfig: {} as Record<string, any>,
    tier: 'bronze', points: 10,
  });

  const loadBadges = async () => {
    try {
      const data = await gamificationApi.getBadges();
      setBadges(data);
    } catch (err) { console.error('Failed to load badges:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadBadges(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', icon: '🏆', color: '#F59E0B', triggerType: 'target_achieved', triggerConfig: {}, tier: 'bronze', points: 10 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (badge: Badge) => {
    setForm({
      name: badge.name, description: badge.description || '', icon: badge.icon,
      color: badge.color, triggerType: badge.triggerType,
      triggerConfig: badge.triggerConfig || {},
      tier: badge.tier, points: badge.points,
    });
    setEditingId(badge.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await gamificationApi.updateBadge(editingId, form);
      } else {
        await gamificationApi.createBadge(form);
      }
      resetForm();
      loadBadges();
    } catch (err) { console.error('Save failed:', err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this badge?')) return;
    try {
      await gamificationApi.deleteBadge(id);
      loadBadges();
    } catch (err) { console.error('Delete failed:', err); }
  };

  const TRIGGER_LABELS: Record<string, string> = {
    target_achieved: 'Target Achieved', streak: 'Streak', milestone: 'Lifetime Milestone', custom: 'Custom Rule',
  };

  const TIER_OPTIONS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

  const COMMON_ICONS = ['🏆', '🎯', '🚀', '⭐', '🔥', '⚡', '👑', '💪', '🥇', '📞', '📧', '🏗️', '🐦', '💎', '🎉'];

  if (loading) {
    return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {badges.filter(b => b.isSystem).length} system badges · {badges.filter(b => !b.isSystem).length} custom
        </p>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Custom Badge
        </button>
      </div>

      {/* Badge creation form */}
      {showForm && (
        <div className="bg-yellow-50 dark:bg-slate-800/50 border border-yellow-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit Badge' : 'New Custom Badge'}</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Trigger</label>
              <select value={form.triggerType} onChange={e => setForm(prev => ({ ...prev, triggerType: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900">
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Tier</label>
                <select value={form.tier} onChange={e => setForm(prev => ({ ...prev, tier: e.target.value }))}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900">
                  {TIER_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Points</label>
                <input type="number" value={form.points} onChange={e => setForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                  className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full text-sm border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Icon</label>
              <div className="flex gap-1 flex-wrap">
                {COMMON_ICONS.map(icon => (
                  <button key={icon} onClick={() => setForm(prev => ({ ...prev, icon }))}
                    className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center ${form.icon === icon ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={handleSave} disabled={!form.name}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={resetForm}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Badge grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {badges.map(badge => {
          const tier = TIER_STYLES[badge.tier] || TIER_STYLES.bronze;
          return (
            <div key={badge.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ${tier.ring} ring-opacity-30 ${tier.bg} ${!badge.isActive ? 'opacity-50' : ''}`}>
              <span className="text-3xl">{badge.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{badge.name}</span>
                  {badge.isSystem && <span className="text-[9px] px-1 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">System</span>}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{badge.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{TRIGGER_LABELS[badge.triggerType] || badge.triggerType}</span>
                  <span className="text-[10px] text-yellow-600">{badge.points} pts</span>
                  <span className="text-[10px] text-gray-400 capitalize">{badge.tier}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(badge)} className="p-1 text-gray-400 hover:text-blue-500 rounded">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(badge.id)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: GAMIFICATION SETTINGS
// ============================================================

function GamificationSettingsTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Global Gamification Settings</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          These settings apply across all targets. Individual targets can override badge and streak settings.
        </p>

        <div className="space-y-4">
          {[
            { label: 'Enable Badges', desc: 'Award badges when users hit targets and milestones', defaultOn: true },
            { label: 'Enable Streaks', desc: 'Track consecutive periods of target achievement', defaultOn: true },
            { label: 'Milestone Notifications', desc: 'Notify users at 50%, 75%, 100%, and 150%', defaultOn: true },
            { label: 'Points Leaderboard', desc: 'Show gamification points leaderboard on dashboard', defaultOn: true },
            { label: 'Achievement Feed', desc: 'Show team achievement feed on dashboard', defaultOn: true },
            { label: 'Pace Alerts', desc: 'Notify users when they drop to "at risk" or "behind" pace', defaultOn: true },
          ].map(setting => (
            <label key={setting.label} className="flex items-center justify-between py-2 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{setting.label}</span>
                <p className="text-xs text-gray-400 dark:text-slate-500">{setting.desc}</p>
              </div>
              <div className="relative inline-flex items-center">
                <input type="checkbox" defaultChecked={setting.defaultOn} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Progress Refresh</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Target progress is automatically recomputed every 15 minutes. Use this to force an immediate refresh.
        </p>
        <RefreshButton />
      </div>
    </div>
  );
}

function RefreshButton() {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ computed: number; total: number } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setResult(null);
    try {
      const res = await targetsApi.refreshProgress();
      setResult(res);
    } catch (err) { console.error('Refresh failed:', err); }
    finally { setRefreshing(false); }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleRefresh} disabled={refreshing}
        className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50">
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        {refreshing ? 'Refreshing...' : 'Refresh All Progress'}
      </button>
      {result && (
        <span className="text-xs text-emerald-600">
          ✓ Computed {result.computed} of {result.total} assignments
        </span>
      )}
    </div>
  );
}

export default TargetsSettingsPage;