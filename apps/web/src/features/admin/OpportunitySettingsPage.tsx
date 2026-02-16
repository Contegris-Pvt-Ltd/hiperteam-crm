// ============================================================
// FILE: apps/web/src/features/admin/OpportunitySettingsPage.tsx
//
// Admin settings page for opportunities module.
// 7 tabs: Pipelines | Stages | Priorities | Close Reasons | Types | Sources | Forecast
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, X, Check, Pencil,
  Flame, Thermometer, Sun, Snowflake, Minus,
  Trophy, XCircle, Briefcase, BarChart3, Route, Target, Globe,
} from 'lucide-react';
import { opportunitySettingsApi } from '../../api/opportunities.api';
import type { OpportunityCloseReason, OpportunityStage, Pipeline } from '../../api/opportunities.api';

// ============================================================
// TYPES
// ============================================================
interface Priority {
  id: string; name: string; color: string; icon: string;
  sortOrder: number; isDefault: boolean; isSystem: boolean; isActive: boolean;
}
interface OpportunityType {
  id: string; name: string; slug: string; description?: string;
  color: string; sortOrder: number; isDefault: boolean; isSystem: boolean; isActive: boolean;
}
interface ForecastCategory {
  id: string; name: string; slug: string; description?: string;
  color: string; probabilityMin: number; probabilityMax: number;
  sortOrder: number; isSystem: boolean; isActive: boolean;
}
interface LeadSource {
  id: string; name: string; description?: string;
  isSystem?: boolean; isActive?: boolean; sortOrder?: number;
}

// ============================================================
// TAB DEFINITIONS
// ============================================================
const TABS = [
  { id: 'pipelines', label: 'Pipelines', icon: Route },
  { id: 'stages', label: 'Stages', icon: Target },
  { id: 'priorities', label: 'Priorities', icon: Flame },
  { id: 'close-reasons', label: 'Close Reasons', icon: Trophy },
  { id: 'types', label: 'Types', icon: Briefcase },
  { id: 'sources', label: 'Sources', icon: Globe },
  { id: 'forecast', label: 'Forecast Categories', icon: BarChart3 },
] as const;

type TabId = typeof TABS[number]['id'];

const PRIORITY_ICONS: Record<string, typeof Flame> = {
  flame: Flame, thermometer: Thermometer, sun: Sun, snowflake: Snowflake, minus: Minus,
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export function OpportunitySettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pipelines');
  const [loading, setLoading] = useState(true);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [closeReasons, setCloseReasons] = useState<OpportunityCloseReason[]>([]);
  const [types, setTypes] = useState<OpportunityType[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [forecastCategories, setForecastCategories] = useState<ForecastCategory[]>([]);

  useEffect(() => { loadTabData(activeTab); }, [activeTab]);

  const loadTabData = async (tab: TabId) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'pipelines':
          setPipelines(await opportunitySettingsApi.getPipelines());
          break;
        case 'stages': {
          const pls = await opportunitySettingsApi.getPipelines();
          setPipelines(pls);
          const pipeId = selectedPipelineId || pls.find(p => p.isDefault)?.id || pls[0]?.id || '';
          setSelectedPipelineId(pipeId);
          if (pipeId) setStages(await opportunitySettingsApi.getStages(pipeId));
          break;
        }
        case 'priorities':
          setPriorities(await opportunitySettingsApi.getPriorities());
          break;
        case 'close-reasons':
          setCloseReasons(await opportunitySettingsApi.getCloseReasons());
          break;
        case 'types':
          setTypes(await opportunitySettingsApi.getAllTypes());
          break;
        case 'sources':
          setSources(await opportunitySettingsApi.getSources());
          break;
        case 'forecast':
          setForecastCategories(await opportunitySettingsApi.getAllForecastCategories());
          break;
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Opportunity Settings</h1>
            <p className="text-gray-600 dark:text-slate-400">Configure pipelines, stages, priorities, close reasons, and more</p>
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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div>
          {activeTab === 'pipelines' && <PipelinesTab pipelines={pipelines} onReload={() => loadTabData('pipelines')} />}
          {activeTab === 'stages' && (
            <StagesTab
              stages={stages}
              pipelines={pipelines}
              selectedPipelineId={selectedPipelineId}
              onPipelineChange={(id) => {
                setSelectedPipelineId(id);
                opportunitySettingsApi.getStages(id).then(setStages);
              }}
              onReload={() => loadTabData('stages')}
            />
          )}
          {activeTab === 'priorities' && <PrioritiesTab priorities={priorities} onReload={() => loadTabData('priorities')} />}
          {activeTab === 'close-reasons' && <CloseReasonsTab reasons={closeReasons} onReload={() => loadTabData('close-reasons')} />}
          {activeTab === 'types' && <TypesTab types={types} onReload={() => loadTabData('types')} />}
          {activeTab === 'sources' && <SourcesTab sources={sources} onReload={() => loadTabData('sources')} />}
          {activeTab === 'forecast' && <ForecastTab categories={forecastCategories} onReload={() => loadTabData('forecast')} />}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: PIPELINES
// ============================================================
function PipelinesTab({ pipelines, onReload }: { pipelines: Pipeline[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createPipeline({ name: formData.name, description: formData.description || undefined });
      setCreating(false);
      setFormData({ name: '', description: '' });
      onReload();
    } catch (err: any) {
      console.error('Failed to create pipeline:', err);
      alert(err.response?.data?.message || 'Failed to create pipeline');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline? All stages within it will be removed.')) return;
    try {
      await opportunitySettingsApi.deletePipeline(id);
      onReload();
    } catch (err: any) {
      console.error('Failed to delete pipeline:', err);
      alert(err.response?.data?.message || 'Cannot delete this pipeline');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await opportunitySettingsApi.setDefaultPipeline(id);
      onReload();
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipelines</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Shared with leads module — changes affect both
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Pipeline
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pipeline Name *</label>
              <input
                type="text"
                placeholder="e.g. Enterprise Sales, Inbound Leads"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setFormData({ name: '', description: '' }); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pipelines list — individual cards like leads */}
      <div className="space-y-2">
        {pipelines.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <p>No pipelines configured. Create your first pipeline to get started.</p>
          </div>
        ) : (
          pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    {editing === pipeline.id ? (
                      <input
                        type="text"
                        defaultValue={pipeline.name}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }}
                        className="px-2 py-1 border border-blue-300 rounded text-sm bg-white dark:bg-slate-800 font-medium"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {pipeline.name}
                        {pipeline.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                            DEFAULT
                          </span>
                        )}
                      </h3>
                    )}
                    {pipeline.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pipeline.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Stage counts */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {pipeline.oppStageCount !== undefined && (
                      <span title="Opportunity stages">
                        <Target className="w-3.5 h-3.5 inline mr-1" />
                        {pipeline.oppStageCount} opp stages
                      </span>
                    )}
                    {pipeline.leadStageCount !== undefined && (
                      <span title="Lead stages">
                        {pipeline.leadStageCount} lead stages
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {!pipeline.isDefault && (
                      <button
                        onClick={() => handleSetDefault(pipeline.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                        title="Set as default"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(pipeline.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {!pipeline.isDefault && (
                      <button
                        onClick={() => handleDelete(pipeline.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: STAGES (for opportunities module)
// ============================================================
function StagesTab({
  stages, pipelines, selectedPipelineId, onPipelineChange, onReload,
}: {
  stages: OpportunityStage[];
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onPipelineChange: (id: string) => void;
  onReload: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: '#3B82F6' });

  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const openStages = sorted.filter(s => !s.isWon && !s.isLost);
  const terminalStages = sorted.filter(s => s.isWon || s.isLost);

  const handleCreate = async () => {
    if (!formData.name.trim() || !selectedPipelineId) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createStage({
        pipelineId: selectedPipelineId,
        name: formData.name,
        color: formData.color,
        module: 'opportunities',
      });
      setCreating(false);
      setFormData({ name: '', color: '#3B82F6' });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this stage? Opportunities in this stage will lose their stage assignment.')) return;
    try {
      await opportunitySettingsApi.deleteStage(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  /*const handleToggle = async (stage: OpportunityStage) => {
    try {
      await opportunitySettingsApi.updateStage(stage.id, { isActive: !(stage as any).isActive });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    }
  };*/

  return (
    <div>
      {/* Pipeline Selector */}
      {pipelines.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Pipeline:</label>
          <select
            value={selectedPipelineId}
            onChange={(e) => onPipelineChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-slate-800"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isDefault ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Opportunity Stages</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Define the pipeline stages opportunities move through</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Stage
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Stage name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-slate-600"
            />
            <button
              onClick={handleCreate}
              disabled={!formData.name.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setCreating(false)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Open stages */}
      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Open Stages</h3>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden mb-6">
        {openStages.map((stage, idx) => (
          <div key={stage.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{stage.name}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">{stage.probability}%</span>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">#{stage.sortOrder}</span>
            {!stage.isWon && !stage.isLost && (
              <button onClick={() => handleDelete(stage.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {openStages.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No open stages configured</div>
        )}
      </div>

      {/* Terminal stages */}
      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Terminal Stages</h3>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {terminalStages.map((stage, idx) => (
          <div key={stage.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{stage.name}</span>
            {stage.isWon && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">Won</span>
            )}
            {stage.isLost && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Lost</span>
            )}
            <span className="text-xs text-gray-400 dark:text-slate-500">{stage.probability}%</span>
          </div>
        ))}
        {terminalStages.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No terminal stages configured</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: PRIORITIES (table layout like leads)
// ============================================================
function PrioritiesTab({ priorities, onReload }: { priorities: Priority[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#3B82F6', icon: 'minus' });

  const sorted = [...priorities].sort((a, b) => a.sortOrder - b.sortOrder);
  const iconOptions = ['flame', 'thermometer', 'sun', 'snowflake', 'minus'];

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createPriority(form);
      setCreating(false);
      setForm({ name: '', color: '#3B82F6', icon: 'minus' });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this priority?')) return;
    try {
      await opportunitySettingsApi.deletePriority(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleToggle = async (p: Priority) => {
    try {
      await opportunitySettingsApi.updatePriority(p.id, { isActive: !p.isActive });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  const handleSetDefault = async (p: Priority) => {
    try {
      await opportunitySettingsApi.updatePriority(p.id, { isDefault: true });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Opportunity Priorities</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Define priority levels for opportunities</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Priority
        </button>
      </div>

      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Name</label>
              <input
                type="text"
                placeholder="e.g. Critical"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Icon</label>
              <select
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              >
                {iconOptions.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div className="col-span-2" />
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setCreating(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Icon</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Default</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {sorted.map((p) => {
              const Icon = PRIORITY_ICONS[p.icon] || Minus;
              return (
                <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 ${!p.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                      {p.isSystem && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">System</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Icon className="w-4 h-4" style={{ color: p.color }} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isDefault ? (
                      <span className="text-green-600 text-xs font-medium">✓ Default</span>
                    ) : p.isActive ? (
                      <button onClick={() => handleSetDefault(p)} className="text-xs text-gray-400 hover:text-blue-600">
                        Set default
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(p)}
                      className={`text-xs px-2 py-1 rounded ${
                        p.isActive
                          ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                          : 'text-gray-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-500'
                      }`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!p.isSystem && (
                      <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
            No priorities configured. Add your first priority to get started.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: CLOSE REASONS
// ============================================================
function CloseReasonsTab({ reasons, onReload }: { reasons: OpportunityCloseReason[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'won' as 'won' | 'lost', description: '' });

  const wonReasons = reasons.filter(r => r.type === 'won').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const lostReasons = reasons.filter(r => r.type === 'lost').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createCloseReason({ name: form.name, type: form.type, description: form.description || undefined });
      setCreating(false);
      setForm({ name: '', type: 'won', description: '' });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this close reason?')) return;
    try {
      await opportunitySettingsApi.deleteCloseReason(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const renderReasonList = (title: string, list: OpportunityCloseReason[], IconComp: any, colorClass: string) => (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        <IconComp className={`w-4 h-4 ${colorClass}`} /> {title} ({list.length})
      </h3>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {list.map((r, idx) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{r.name}</span>
            {r.description && <span className="text-xs text-gray-400 dark:text-slate-500 max-w-48 truncate">{r.description}</span>}
            <button onClick={() => handleDelete(r.id)} className="p-1 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No {title.toLowerCase()} configured</div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Close Reasons</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Reasons for winning or losing opportunities</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Reason
        </button>
      </div>

      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Reason Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Better pricing, Feature gap"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'won' | 'lost' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setForm({ name: '', type: 'won', description: '' }); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderReasonList('Won Reasons', wonReasons, Trophy, 'text-green-600')}
        {renderReasonList('Lost Reasons', lostReasons, XCircle, 'text-red-500')}
      </div>
    </div>
  );
}

// ============================================================
// TAB: TYPES
// ============================================================
function TypesTab({ types, onReload }: { types: OpportunityType[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#6B7280', description: '' });

  const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createType({ name: form.name, color: form.color, description: form.description || undefined });
      setCreating(false);
      setForm({ name: '', color: '#6B7280', description: '' });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this type?')) return;
    try {
      await opportunitySettingsApi.deleteType(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleToggle = async (t: OpportunityType) => {
    try {
      await opportunitySettingsApi.updateType(t.id, { isActive: !t.isActive });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Opportunity Types</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Categorize opportunities (New Business, Renewal, Upsell, etc.)</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Type
        </button>
      </div>

      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Type Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. New Business"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Color</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-slate-600" />
              </div>
              <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setCreating(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {sorted.map((t, idx) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''} ${!t.isActive ? 'opacity-50' : ''}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</span>
              {t.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t.description}</p>}
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">{t.slug}</span>
            {t.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">DEFAULT</span>
            )}
            {t.isSystem && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">System</span>
            )}
            <button
              onClick={() => handleToggle(t)}
              className={`text-xs px-2 py-1 rounded ${
                t.isActive
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                  : 'text-gray-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {t.isActive ? 'Active' : 'Inactive'}
            </button>
            {!t.isSystem && (
              <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No types configured. Add your first type to get started.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: SOURCES (shared with leads)
// ============================================================
function SourcesTab({ sources, onReload }: { sources: LeadSource[]; onReload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceName, setSourceName] = useState('');

  const handleCreate = async () => {
    if (!sourceName.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createSource({ name: sourceName });
      setAdding(false);
      setSourceName('');
      onReload();
    } catch (err) {
      console.error('Failed to create source:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this source?')) return;
    try {
      await opportunitySettingsApi.deleteSource(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Sources</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Shared with leads module — changes affect both</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="Source name"
              autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!sourceName.trim() || saving}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => { setAdding(false); setSourceName(''); }} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {sources.map((s, idx) => (
          <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{s.name}</span>
            {s.isSystem && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">System</span>
            )}
            {!s.isSystem && (
              <button onClick={() => handleDelete(s.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {sources.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No sources configured. Add your first source to get started.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: FORECAST CATEGORIES
// ============================================================
function ForecastTab({ categories, onReload }: { categories: ForecastCategory[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: '#6B7280', probabilityMin: 0, probabilityMax: 100 });

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await opportunitySettingsApi.createForecastCategory(form);
      setCreating(false);
      setForm({ name: '', color: '#6B7280', probabilityMin: 0, probabilityMax: 100 });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this forecast category?')) return;
    try {
      await opportunitySettingsApi.deleteForecastCategory(id);
      onReload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleToggle = async (fc: ForecastCategory) => {
    try {
      await opportunitySettingsApi.updateForecastCategory(fc.id, { isActive: !fc.isActive });
      onReload();
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Forecast Categories</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Revenue forecasting buckets with probability ranges for auto-assignment</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Category Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pipeline, Best Case"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Min %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilityMin}
                onChange={(e) => setForm({ ...form, probabilityMin: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Max %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilityMax}
                onChange={(e) => setForm({ ...form, probabilityMax: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
              <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setCreating(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {sorted.map((fc, idx) => (
          <div key={fc.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''} ${!fc.isActive ? 'opacity-50' : ''}`}>
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: fc.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{fc.name}</span>
              {fc.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{fc.description}</p>}
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {fc.probabilityMin}% – {fc.probabilityMax}%
            </span>
            {fc.isSystem && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">System</span>
            )}
            <button
              onClick={() => handleToggle(fc)}
              className={`text-xs px-2 py-1 rounded ${
                fc.isActive
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                  : 'text-gray-400 bg-gray-50 dark:bg-slate-800 dark:text-slate-500'
              }`}
            >
              {fc.isActive ? 'Active' : 'Inactive'}
            </button>
            {!fc.isSystem && (
              <button onClick={() => handleDelete(fc.id)} className="p-1 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
            No forecast categories configured. Add your first category to get started.
          </div>
        )}
      </div>
    </div>
  );
}