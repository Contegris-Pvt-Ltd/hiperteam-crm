// ============================================================
// FILE: apps/web/src/features/admin/LeadSettingsPage.tsx
// ============================================================
// Single page with 7 tabs for all lead configuration settings.
// Tabs: Stages | Priorities | Scoring | Routing | Qualification |
//       Sources & Reasons | General
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, GripVertical, Save,
  Pencil, X, Check, AlertTriangle,
  Zap, Target, Route, Award, Ban, Globe, Settings,
  RefreshCw, ToggleLeft, ToggleRight, Flame, Thermometer,
  Sun, Snowflake, Minus 
} from 'lucide-react';
import { leadSettingsApi } from '../../api/leads.api';
import type { LeadStage, LeadPriority, Pipeline } from '../../api/leads.api';
import { StageFieldsModal } from './StageFieldsModal';

// ============================================================
// TYPES
// ============================================================

interface ScoringTemplate {
  id: string;
  name: string;
  maxScore: number;
  isActive: boolean;
  isDefault: boolean;
  rules: ScoringRule[];
}

interface ScoringRule {
  id: string;
  templateId: string;
  name: string;
  category: string;
  type: string;
  fieldKey: string;
  operator: string;
  value: any;
  scoreDelta: number;
  isActive: boolean;
  sortOrder: number;
}

interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: any[];
  assignmentType: string;
  assignedTo: any[];
  roundRobinIndex: number;
  isActive: boolean;
}

interface QualificationFramework {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  fields: QualificationField[];
}

interface QualificationField {
  id: string;
  frameworkId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions: any[];
  description?: string;
  scoreWeight: number;
  sortOrder: number;
  isRequired: boolean;
}

interface DisqualificationReason {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface LeadSource {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface LeadSettings {
  [key: string]: any;
}

// ============================================================
// TAB DEFINITIONS
// ============================================================

const TABS = [
  { id: 'pipelines', label: 'Pipelines', icon: Route },
  { id: 'stages', label: 'Stages', icon: Target },
  { id: 'priorities', label: 'Priorities', icon: Flame },
  { id: 'scoring', label: 'Scoring', icon: Zap },
  { id: 'routing', label: 'Routing', icon: Route },
  { id: 'qualification', label: 'Qualification', icon: Award },
  { id: 'sources', label: 'Sources & Reasons', icon: Globe },
  { id: 'general', label: 'General', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

// ============================================================
// PRIORITY ICON MAP
// ============================================================
const PRIORITY_ICONS: Record<string, typeof Flame> = {
  flame: Flame,
  thermometer: Thermometer,
  sun: Sun,
  snowflake: Snowflake,
  minus: Minus,
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function LeadSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pipelines');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [priorities, setPriorities] = useState<LeadPriority[]>([]);
  const [scoringTemplates, setScoringTemplates] = useState<ScoringTemplate[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [qualificationFrameworks, setQualificationFrameworks] = useState<QualificationFramework[]>([]);
  const [disqualificationReasons, setDisqualificationReasons] = useState<DisqualificationReason[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [settings, setSettings] = useState<LeadSettings>({});

  // Load initial data for active tab
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const loadTabData = async (tab: TabId) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'pipelines': {
          const pipelinesData = await leadSettingsApi.getPipelines();
          setPipelines(pipelinesData);
          // Auto-select default pipeline
          const defaultPl = pipelinesData.find(p => p.isDefault);
          if (defaultPl && !selectedPipelineId) setSelectedPipelineId(defaultPl.id);
          break;
        }
        case 'stages': {
          // Load pipelines for the selector if not already loaded
          if (pipelines.length === 0) {
            const pipelinesData = await leadSettingsApi.getPipelines();
            setPipelines(pipelinesData);
            const defaultPl = pipelinesData.find(p => p.isDefault);
            if (defaultPl && !selectedPipelineId) setSelectedPipelineId(defaultPl.id);
          }
          setStages(await leadSettingsApi.getStages(selectedPipelineId || undefined, 'leads'));
          break;
        }
        case 'priorities':
          setPriorities(await leadSettingsApi.getPriorities());
          break;
        case 'scoring':
          setScoringTemplates(await leadSettingsApi.getScoringTemplates());
          break;
        case 'routing':
          setRoutingRules(await leadSettingsApi.getRoutingRules());
          break;
        case 'qualification':
          setQualificationFrameworks(await leadSettingsApi.getQualificationFrameworks());
          break;
        case 'sources': {
          const [r, s] = await Promise.all([
            leadSettingsApi.getDisqualificationReasons(),
            leadSettingsApi.getSources(),
          ]);
          setDisqualificationReasons(r);
          setSources(s);
          break;
        }
        case 'general':
          setSettings(await leadSettingsApi.getSettings());
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
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lead Settings</h1>
            <p className="text-gray-600 dark:text-slate-400">Configure stages, scoring, routing, and more</p>
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
          {activeTab === 'pipelines' && (
            <PipelinesTab pipelines={pipelines} onReload={() => loadTabData('pipelines')} />
          )}
          {activeTab === 'stages' && (
            <StagesTab
              stages={stages}
              pipelines={pipelines}
              selectedPipelineId={selectedPipelineId}
              onPipelineChange={(id) => {
                setSelectedPipelineId(id);
                // Reload stages for the new pipeline
                leadSettingsApi.getStages(id, 'leads').then(setStages);
              }}
              onReload={() => loadTabData('stages')}
            />
          )}
          {activeTab === 'priorities' && (
            <PrioritiesTab priorities={priorities} onReload={() => loadTabData('priorities')} />
          )}
          {activeTab === 'scoring' && (
            <ScoringTab templates={scoringTemplates} onReload={() => loadTabData('scoring')} />
          )}
          {activeTab === 'routing' && (
            <RoutingTab rules={routingRules} onReload={() => loadTabData('routing')} />
          )}
          {activeTab === 'qualification' && (
            <QualificationTab frameworks={qualificationFrameworks} onReload={() => loadTabData('qualification')} />
          )}
          {activeTab === 'sources' && (
            <SourcesAndReasonsTab
              sources={sources}
              reasons={disqualificationReasons}
              onReload={() => loadTabData('sources')}
            />
          )}
          {activeTab === 'general' && (
            <GeneralTab settings={settings} onReload={() => loadTabData('general')} />
          )}
        </div>
      )}
    </div>
  );
}

function PipelinesTab({ pipelines, onReload }: { pipelines: Pipeline[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      await leadSettingsApi.createPipeline({
        name: formData.name,
        description: formData.description || undefined,
        isDefault: pipelines.length === 0, // First pipeline is auto-default
      });
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

  const handleUpdate = async (id: string, updates: any) => {
    setSaving(true);
    try {
      await leadSettingsApi.updatePipeline(id, updates);
      setEditing(null);
      onReload();
    } catch (err: any) {
      console.error('Failed to update pipeline:', err);
      alert(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pipeline? All stages in this pipeline will also be deleted.')) return;
    try {
      await leadSettingsApi.deletePipeline(id);
      onReload();
    } catch (err: any) {
      console.error('Failed to delete pipeline:', err);
      alert(err.response?.data?.message || 'Cannot delete this pipeline');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await leadSettingsApi.setDefaultPipeline(id);
      onReload();
    } catch (err: any) {
      console.error('Failed to set default:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pipelines</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Pipelines define the different sales processes for your leads and opportunities
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

      {/* Pipelines list */}
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
                        onBlur={(e) => handleUpdate(pipeline.id, { name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdate(pipeline.id, { name: (e.target as HTMLInputElement).value });
                          if (e.key === 'Escape') setEditing(null);
                        }}
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
                    <span title="Lead stages">
                      <Target className="w-3.5 h-3.5 inline mr-1" />
                      {pipeline.leadStageCount} lead stages
                    </span>
                    <span title="Opportunity stages">
                      <Zap className="w-3.5 h-3.5 inline mr-1" />
                      {pipeline.oppStageCount} opp stages
                    </span>
                    <span title="Leads using this pipeline" className="font-medium">
                      {pipeline.leadCount} leads
                    </span>
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
// TAB 1: STAGES
// ============================================================

function StagesTab({
  stages, pipelines, selectedPipelineId, onPipelineChange, onReload,
}: {
  stages: LeadStage[];
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onPipelineChange: (id: string) => void;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', slug: '', color: '#3B82F6' });

  // Stage Fields Modal
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [selectedStage, setSelectedStage] = useState<LeadStage | null>(null);

  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await leadSettingsApi.createStage({
        name: formData.name,
        slug: formData.name.toLowerCase().replace(/\s+/g, '_'),
        color: formData.color,
      });
      setCreating(false);
      setFormData({ name: '', slug: '', color: '#3B82F6' });
      onReload();
    } catch (err) {
      console.error('Failed to create stage:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    setSaving(true);
    try {
      await leadSettingsApi.updateStage(id, updates);
      setEditing(null);
      onReload();
    } catch (err) {
      console.error('Failed to update stage:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this stage? Leads in this stage will lose their stage assignment.')) return;
    try {
      await leadSettingsApi.deleteStage(id);
      onReload();
    } catch (err) {
      console.error('Failed to delete stage:', err);
    }
  };

  const handleReorder = async (dragIdx: number, dropIdx: number) => {
    if (dragIdx === dropIdx) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    const orderedIds = reordered.map(s => s.id);
    try {
      await leadSettingsApi.reorderStages(orderedIds);
      onReload();
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  const openFieldsModal = (stage: LeadStage) => {
    setSelectedStage(stage);
    setShowFieldsModal(true);
  };

  const handleSaveStageFields = async (stageId: string, fields: any[], lockPreviousFields: boolean) => {
    await leadSettingsApi.upsertStageFields(stageId, fields);
    await leadSettingsApi.updateStage(stageId, { lockPreviousFields });
    onReload();
  };

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Stages</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Define the pipeline stages leads move through</p>
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

      {/* Stages list */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {sorted.map((stage, idx) => (
          <div key={stage.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
            {/* Drag handle */}
            <button
              className="cursor-grab text-gray-400 hover:text-gray-600"
              title="Drag to reorder"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                handleReorder(fromIdx, idx);
              }}
            >
              <GripVertical className="w-4 h-4" />
            </button>

            {/* Color dot */}
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />

            {/* Name + badges */}
            {editing === stage.id ? (
              <EditStageInline
                stage={stage}
                onSave={(updates) => handleUpdate(stage.id, updates)}
                onCancel={() => setEditing(null)}
                saving={saving}
              />
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{stage.name}</span>
                {stage.isSystem && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">System</span>
                )}
                {stage.isWon && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">Won</span>
                )}
                {stage.isLost && (
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Lost</span>
                )}
                {stage.leadCount !== undefined && (
                  <span className="text-xs text-gray-400 dark:text-slate-500">{stage.leadCount} leads</span>
                )}

                {/* Configure Fields button — replaces old expand chevron */}
                <button
                  onClick={() => openFieldsModal(stage)}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                  title="Configure required fields for this stage"
                >
                  Fields
                </button>

                <button onClick={() => setEditing(stage.id)} className="p-1 text-gray-400 hover:text-blue-600">
                  <Pencil className="w-4 h-4" />
                </button>
                {!stage.isSystem && (
                  <button onClick={() => handleDelete(stage.id)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
            No stages configured. Add your first stage to get started.
          </div>
        )}
      </div>

      {/* Stage Fields Modal */}
      <StageFieldsModal
        isOpen={showFieldsModal}
        stage={selectedStage}
        onClose={() => { setShowFieldsModal(false); setSelectedStage(null); }}
        onSave={handleSaveStageFields}
      />
    </div>
  );
}

function EditStageInline({
  stage, onSave, onCancel, saving,
}: { stage: LeadStage; onSave: (u: any) => void; onCancel: () => void; saving: boolean }) {
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);

  return (
    <>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
        autoFocus
      />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
      <button onClick={() => onSave({ name, color })} disabled={saving} className="p-1 text-green-600 hover:text-green-700">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </>
  );
}

// ============================================================
// TAB 2: PRIORITIES
// ============================================================

function PrioritiesTab({ priorities, onReload }: { priorities: LeadPriority[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', color: '#3B82F6', icon: 'minus', scoreMin: '', scoreMax: '',
  });

  const sorted = [...priorities].sort((a, b) => a.sortOrder - b.sortOrder);
  const iconOptions = ['flame', 'thermometer', 'sun', 'snowflake', 'minus'];

  const handleCreate = async () => {
    setSaving(true);
    try {
      await leadSettingsApi.createPriority({
        name: form.name,
        color: form.color,
        icon: form.icon,
        scoreMin: form.scoreMin ? parseInt(form.scoreMin) : null,
        scoreMax: form.scoreMax ? parseInt(form.scoreMax) : null,
      });
      setCreating(false);
      setForm({ name: '', color: '#3B82F6', icon: 'minus', scoreMin: '', scoreMax: '' });
      onReload();
    } catch (err) {
      console.error('Failed to create priority:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this priority?')) return;
    try {
      await leadSettingsApi.deletePriority(id);
      onReload();
    } catch (err) {
      console.error('Failed to delete priority:', err);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await leadSettingsApi.updatePriority(id, { isDefault: true });
      onReload();
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Priorities</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Define priority levels and auto-assign from lead score ranges</p>
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
                placeholder="e.g. Hot"
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
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Score Min</label>
              <input
                type="number"
                placeholder="0"
                value={form.scoreMin}
                onChange={(e) => setForm({ ...form, scoreMin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Score Max</label>
              <input
                type="number"
                placeholder="100"
                value={form.scoreMax}
                onChange={(e) => setForm({ ...form, scoreMax: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Score Range</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Default</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {sorted.map((p) => {
              const Icon = PRIORITY_ICONS[p.icon] || Minus;
              return (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Icon className="w-4 h-4" style={{ color: p.color }} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">
                    {p.scoreMin !== null && p.scoreMax !== null
                      ? `${p.scoreMin} – ${p.scoreMax}`
                      : p.scoreMin !== null
                        ? `≥ ${p.scoreMin}`
                        : p.scoreMax !== null
                          ? `≤ ${p.scoreMax}`
                          : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isDefault ? (
                      <span className="text-green-600 text-xs font-medium">✓ Default</span>
                    ) : (
                      <button onClick={() => handleSetDefault(p.id)} className="text-xs text-gray-400 hover:text-blue-600">
                        Set default
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: SCORING
// ============================================================

function ScoringTab({ templates, onReload }: { templates: ScoringTemplate[]; onReload: () => void }) {
  const [addingRule, setAddingRule] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: '', category: 'demographic', fieldKey: '', operator: 'equals', value: '', scoreDelta: 10,
  });

  const CATEGORIES = ['demographic', 'qualification', 'engagement', 'decay'];
  const OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in', 'is_empty', 'is_not_empty', 'older_than'];
  const FIELDS = [
    'email', 'phone', 'company', 'jobTitle', 'city', 'country', 'source',
    'qualification.budget', 'qualification.authority', 'qualification.need', 'qualification.timeline',
    'lastActivityAt', 'tags',
  ];

  const handleCreateRule = async (templateId: string) => {
    setSaving(true);
    try {
      await leadSettingsApi.createScoringRule(templateId, {
        ...ruleForm,
        value: ruleForm.value,
        scoreDelta: Number(ruleForm.scoreDelta),
      });
      setAddingRule(null);
      setRuleForm({ name: '', category: 'demographic', fieldKey: '', operator: 'equals', value: '', scoreDelta: 10 });
      onReload();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this scoring rule?')) return;
    try {
      await leadSettingsApi.deleteScoringRule(ruleId);
      onReload();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleRescoreAll = async () => {
    if (!confirm('Re-score all active leads? This may take a while.')) return;
    setRescoring(true);
    try {
      await leadSettingsApi.rescoreAll();
      alert('All leads re-scored successfully!');
    } catch (err) {
      console.error('Failed to rescore:', err);
    } finally {
      setRescoring(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Scoring</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Configure scoring rules to automatically rank leads</p>
        </div>
        <button
          onClick={handleRescoreAll}
          disabled={rescoring}
          className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${rescoring ? 'animate-spin' : ''}`} />
          {rescoring ? 'Re-scoring...' : 'Re-score All Leads'}
        </button>
      </div>

      {templates.map((tpl) => (
        <div key={tpl.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tpl.name}</h3>
                <span className="text-xs text-gray-400 dark:text-slate-500">Max score: {tpl.maxScore}</span>
              </div>
            </div>
            <button
              onClick={() => setAddingRule(addingRule === tpl.id ? null : tpl.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
            >
              <Plus className="w-3 h-3" /> Add Rule
            </button>
          </div>

          {/* Add Rule Form */}
          {addingRule === tpl.id && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-6 gap-2 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    placeholder="Has email"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Category</label>
                  <select value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Field</label>
                  <select value={ruleForm.fieldKey} onChange={(e) => setRuleForm({ ...ruleForm, fieldKey: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white">
                    <option value="">Select...</option>
                    {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Operator</label>
                  <select value={ruleForm.operator} onChange={(e) => setRuleForm({ ...ruleForm, operator: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white">
                    {OPERATORS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Value</label>
                  <input type="text" value={ruleForm.value} onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                    placeholder="e.g. CEO"
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Score ±</label>
                    <input type="number" value={ruleForm.scoreDelta} onChange={(e) => setRuleForm({ ...ruleForm, scoreDelta: parseInt(e.target.value) || 0 })}
                      className="w-16 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <button onClick={() => handleCreateRule(tpl.id)} disabled={!ruleForm.name || !ruleForm.fieldKey || saving}
                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 mt-4">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rules list */}
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {(tpl.rules || []).length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">No scoring rules yet. Add one to start scoring leads automatically.</div>
            ) : (
              tpl.rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    rule.category === 'demographic' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    rule.category === 'qualification' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    rule.category === 'engagement' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  }`}>{rule.category}</span>
                  <span className="text-sm text-gray-900 dark:text-white font-medium">{rule.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 flex-1">
                    {rule.fieldKey} {rule.operator.replace(/_/g, ' ')} {JSON.stringify(rule.value)}
                  </span>
                  <span className={`text-sm font-semibold ${rule.scoreDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rule.scoreDelta >= 0 ? '+' : ''}{rule.scoreDelta}
                  </span>
                  <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TAB 4: ROUTING
// ============================================================

function RoutingTab({ rules, onReload }: { rules: RoutingRule[]; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', assignmentType: 'round_robin', assignedTo: '',
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      await leadSettingsApi.createRoutingRule({
        name: form.name,
        description: form.description,
        assignmentType: form.assignmentType,
        conditions: [],
        assignedTo: form.assignedTo ? form.assignedTo.split(',').map(s => s.trim()) : [],
      });
      setCreating(false);
      setForm({ name: '', description: '', assignmentType: 'round_robin', assignedTo: '' });
      onReload();
    } catch (err) {
      console.error('Failed to create routing rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await leadSettingsApi.updateRoutingRule(id, { isActive: !isActive });
      onReload();
    } catch (err) {
      console.error('Failed to toggle routing rule:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routing rule?')) return;
    try {
      await leadSettingsApi.deleteRoutingRule(id);
      onReload();
    } catch (err) {
      console.error('Failed to delete routing rule:', err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Routing</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Auto-assign new leads to the right owner based on rules</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {creating && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Rule Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Enterprise leads → Team A"
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Assignment Type</label>
              <select value={form.assignmentType} onChange={(e) => setForm({ ...form, assignmentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm">
                <option value="round_robin">Round Robin</option>
                <option value="specific_user">Specific User</option>
                <option value="team_lead">Team Lead</option>
                <option value="weighted">Weighted</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Description (optional)</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!form.name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Create
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
            No routing rules configured. New leads will be assigned to the creator.
          </div>
        ) : (
          rules.map((rule, idx) => (
            <div key={rule.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400 dark:text-slate-500 w-6">#{idx + 1}</span>
                <button onClick={() => handleToggle(rule.id, rule.isActive)}>
                  {rule.isActive
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft className="w-6 h-6 text-gray-400" />
                  }
                </button>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</span>
                  {rule.description && <p className="text-xs text-gray-400 dark:text-slate-500">{rule.description}</p>}
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                  {rule.assignmentType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => handleDelete(rule.id)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 5: QUALIFICATION
// ============================================================

function QualificationTab({ frameworks, onReload }: { frameworks: QualificationFramework[]; onReload: () => void }) {
  const [activating, setActivating] = useState(false);

  const handleActivate = async (frameworkId: string) => {
    setActivating(true);
    try {
      await leadSettingsApi.setActiveFramework(frameworkId);
      onReload();
    } catch (err) {
      console.error('Failed to activate framework:', err);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Qualification Frameworks</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">Choose which qualification methodology to use for scoring leads</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {frameworks.map((fw) => (
          <div
            key={fw.id}
            className={`relative bg-white dark:bg-slate-900 border-2 rounded-xl p-5 transition-colors ${
              fw.isActive
                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/30'
                : 'border-gray-200 dark:border-slate-700'
            }`}
          >
            {fw.isActive && (
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                Active
              </div>
            )}

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{fw.name}</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{fw.description}</p>

            {/* Fields */}
            <div className="space-y-2 mb-4">
              {fw.fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{field.fieldLabel}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">({field.fieldType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      Weight: {field.scoreWeight}
                    </span>
                    {field.isRequired && (
                      <span className="text-red-500 text-xs">Required</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!fw.isActive && (
              <button
                onClick={() => handleActivate(fw.id)}
                disabled={activating}
                className="w-full flex items-center justify-center gap-2 py-2 border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium"
              >
                {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Activate {fw.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TAB 6: SOURCES & REASONS
// ============================================================

function SourcesAndReasonsTab({
  sources, reasons, onReload,
}: { sources: LeadSource[]; reasons: DisqualificationReason[]; onReload: () => void }) {
  const [addingSource, setAddingSource] = useState(false);
  const [addingReason, setAddingReason] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [reasonName, setReasonName] = useState('');

  const handleCreateSource = async () => {
    setSaving(true);
    try {
      await leadSettingsApi.createSource({ name: sourceName });
      setAddingSource(false);
      setSourceName('');
      onReload();
    } catch (err) {
      console.error('Failed to create source:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReason = async () => {
    setSaving(true);
    try {
      await leadSettingsApi.createDisqualificationReason({ name: reasonName });
      setAddingReason(false);
      setReasonName('');
      onReload();
    } catch (err) {
      console.error('Failed to create reason:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Sources */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lead Sources</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Where your leads come from</p>
          </div>
          <button onClick={() => setAddingSource(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {addingSource && (
          <div className="flex items-center gap-2 mb-3">
            <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)}
              placeholder="Source name" autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSource()} />
            <button onClick={handleCreateSource} disabled={!sourceName.trim() || saving}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setAddingSource(false)} className="p-2 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {sources.map((s, idx) => (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-sm text-gray-900 dark:text-white">{s.name}</span>
              {s.isSystem && <span className="text-xs text-gray-400 dark:text-slate-500">System</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Disqualification Reasons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Disqualification Reasons</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Why leads leave the pipeline</p>
          </div>
          <button onClick={() => setAddingReason(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {addingReason && (
          <div className="flex items-center gap-2 mb-3">
            <input type="text" value={reasonName} onChange={(e) => setReasonName(e.target.value)}
              placeholder="Reason name" autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateReason()} />
            <button onClick={handleCreateReason} disabled={!reasonName.trim() || saving}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setAddingReason(false)} className="p-2 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {reasons.map((r, idx) => (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${idx > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}`}>
              <Ban className="w-4 h-4 text-red-400" />
              <span className="flex-1 text-sm text-gray-900 dark:text-white">{r.name}</span>
              {r.isSystem && <span className="text-xs text-gray-400 dark:text-slate-500">System</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 7: GENERAL SETTINGS
// ============================================================

function GeneralTab({ settings, onReload }: { settings: LeadSettings; onReload: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  const general = settings.general || {};
  const conversion = settings.conversion || {};
  const stageSettings = settings.stages || {};
  const duplicateDetection = settings.duplicateDetection || {};
  const ownership = settings.ownership || {};

  const updateSetting = async (key: string, value: any) => {
    setSaving(key);
    try {
      await leadSettingsApi.updateSetting(key, value);
      onReload();
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
    } finally {
      setSaving(null);
    }
  };

  const Toggle = ({ checked, onChange, label, description }: {
    checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        {description && <p className="text-xs text-gray-400 dark:text-slate-500">{description}</p>}
      </div>
      <button onClick={() => onChange(!checked)}>
        {checked
          ? <ToggleRight className="w-8 h-8 text-blue-600" />
          : <ToggleLeft className="w-8 h-8 text-gray-400" />
        }
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* General */}
      <SettingsCard title="General" icon={<Settings className="w-5 h-5 text-blue-500" />}
        saving={saving === 'general'}>
        <Toggle
          checked={general.autoScoring ?? true}
          onChange={(v) => updateSetting('general', { ...general, autoScoring: v })}
          label="Auto-score leads"
          description="Automatically calculate lead score when fields change"
        />
        <Toggle
          checked={general.autoPriorityFromScore ?? true}
          onChange={(v) => updateSetting('general', { ...general, autoPriorityFromScore: v })}
          label="Auto-assign priority from score"
          description="Set lead priority based on score ranges defined in Priorities tab"
        />
      </SettingsCard>

      {/* Stage settings */}
      <SettingsCard title="Stage Behavior" icon={<Target className="w-5 h-5 text-purple-500" />}
        saving={saving === 'stages'}>
        <Toggle
          checked={stageSettings.lockPreviousStages ?? false}
          onChange={(v) => updateSetting('stages', { ...stageSettings, lockPreviousStages: v })}
          label="Lock previous stages"
          description="Prevent backward stage movement without unlock reason"
        />
        <Toggle
          checked={stageSettings.showUpcomingStages ?? true}
          onChange={(v) => updateSetting('stages', { ...stageSettings, showUpcomingStages: v })}
          label="Show upcoming stages"
          description="Display future stages in the journey bar"
        />
        <Toggle
          checked={stageSettings.requireUnlockReason ?? false}
          onChange={(v) => updateSetting('stages', { ...stageSettings, requireUnlockReason: v })}
          label="Require unlock reason"
          description="Force a reason when moving leads backward"
        />
      </SettingsCard>

      {/* Conversion */}
      <SettingsCard title="Conversion" icon={<Award className="w-5 h-5 text-green-500" />}
        saving={saving === 'conversion'}>
        <Toggle
          checked={conversion.makeReadOnly ?? true}
          onChange={(v) => updateSetting('conversion', { ...conversion, makeReadOnly: v })}
          label="Make converted leads read-only"
          description="Prevent editing leads after conversion"
        />
        <Toggle
          checked={conversion.copyActivities ?? true}
          onChange={(v) => updateSetting('conversion', { ...conversion, copyActivities: v })}
          label="Copy activities to converted contact"
        />
        <Toggle
          checked={conversion.copyNotes ?? true}
          onChange={(v) => updateSetting('conversion', { ...conversion, copyNotes: v })}
          label="Copy notes to converted contact"
        />
        <Toggle
          checked={conversion.copyDocuments ?? true}
          onChange={(v) => updateSetting('conversion', { ...conversion, copyDocuments: v })}
          label="Copy documents to converted contact"
        />
        <Toggle
          checked={conversion.showConversionLinks ?? true}
          onChange={(v) => updateSetting('conversion', { ...conversion, showConversionLinks: v })}
          label="Show conversion links"
          description="Display links to converted contact/account on the lead"
        />
      </SettingsCard>

      {/* Duplicate Detection */}
      <SettingsCard title="Duplicate Detection" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        saving={saving === 'duplicateDetection'}>
        <Toggle
          checked={duplicateDetection.enabled ?? true}
          onChange={(v) => updateSetting('duplicateDetection', { ...duplicateDetection, enabled: v })}
          label="Enable duplicate detection"
          description="Check for duplicates across leads, contacts, and accounts"
        />
        {duplicateDetection.enabled !== false && (
          <>
            <Toggle
              checked={duplicateDetection.checkLeads ?? true}
              onChange={(v) => updateSetting('duplicateDetection', { ...duplicateDetection, checkLeads: v })}
              label="Check against existing leads"
            />
            <Toggle
              checked={duplicateDetection.checkContacts ?? true}
              onChange={(v) => updateSetting('duplicateDetection', { ...duplicateDetection, checkContacts: v })}
              label="Check against contacts"
            />
            <Toggle
              checked={duplicateDetection.checkAccounts ?? true}
              onChange={(v) => updateSetting('duplicateDetection', { ...duplicateDetection, checkAccounts: v })}
              label="Check against accounts"
            />
            <Toggle
              checked={duplicateDetection.showDuplicatePanel ?? true}
              onChange={(v) => updateSetting('duplicateDetection', { ...duplicateDetection, showDuplicatePanel: v })}
              label="Show duplicate panel on detail page"
            />
            <div className="py-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Match Behavior</p>
              <div className="grid grid-cols-3 gap-3">
                {['exactEmailMatch', 'exactPhoneMatch', 'fuzzyNameMatch'].map((matchKey) => (
                  <div key={matchKey}>
                    <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                      {matchKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </label>
                    <select
                      value={duplicateDetection[matchKey] || 'warn'}
                      onChange={(e) => updateSetting('duplicateDetection', { ...duplicateDetection, [matchKey]: e.target.value })}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="block">Block</option>
                      <option value="warn">Warn</option>
                      <option value="silent">Silent</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SettingsCard>

      {/* Ownership */}
      <SettingsCard title="Ownership & Record Team" icon={<Route className="w-5 h-5 text-indigo-500" />}
        saving={saving === 'ownership'}>
        <Toggle
          checked={ownership.addPreviousOwnerToTeam ?? true}
          onChange={(v) => updateSetting('ownership', { ...ownership, addPreviousOwnerToTeam: v })}
          label="Add previous owner to record team"
          description="When ownership changes, keep the previous owner as a team member"
        />
        <Toggle
          checked={ownership.notifyNewOwner ?? true}
          onChange={(v) => updateSetting('ownership', { ...ownership, notifyNewOwner: v })}
          label="Notify new owner"
        />
        <Toggle
          checked={ownership.notifyPreviousOwner ?? false}
          onChange={(v) => updateSetting('ownership', { ...ownership, notifyPreviousOwner: v })}
          label="Notify previous owner"
        />
        <div className="grid grid-cols-2 gap-3 py-3">
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Previous owner role</label>
            <input type="text" value={ownership.previousOwnerRole || 'Lead Generator'}
              onChange={(e) => updateSetting('ownership', { ...ownership, previousOwnerRole: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Previous owner access</label>
            <select value={ownership.previousOwnerAccess || 'read'}
              onChange={(e) => updateSetting('ownership', { ...ownership, previousOwnerAccess: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white">
              <option value="read">Read only</option>
              <option value="write">Read + Write</option>
            </select>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ============================================================
// SHARED: SETTINGS CARD
// ============================================================

function SettingsCard({ title, icon, saving, children }: {
  title: string; icon: React.ReactNode; saving: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-slate-800">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{title}</h3>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
      <div className="px-5 divide-y divide-gray-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}