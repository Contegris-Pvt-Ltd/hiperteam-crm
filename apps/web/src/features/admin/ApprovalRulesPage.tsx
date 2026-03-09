import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, Save, Pencil, X,
  ShieldCheck, ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import { approvalsApi } from '../../api/approvals.api';
import type { ApprovalRule, EntityType, TriggerEvent } from '../../api/approvals.api';
import { usersApi } from '../../api/users.api';
import { rolesApi } from '../../api/roles.api';

// ============================================================
// LABELS
// ============================================================

const ENTITY_LABELS: Record<string, string> = {
  proposals: 'Proposals',
  opportunities: 'Opportunities',
  deals: 'Deals',
  leads: 'Leads',
  custom: 'Custom',
};

const TRIGGER_LABELS: Record<string, string> = {
  publish: 'On Publish',
  close_won: 'On Close Won',
  discount_threshold: 'Discount Threshold',
  manual: 'Manual Request',
};

const TRIGGER_OPTIONS: Record<string, TriggerEvent[]> = {
  proposals: ['publish', 'manual'],
  opportunities: ['close_won', 'discount_threshold', 'manual'],
  deals: ['close_won', 'discount_threshold', 'manual'],
  leads: ['manual'],
  custom: ['manual'],
};

const ENTITY_TYPES: EntityType[] = ['proposals', 'opportunities', 'deals', 'leads', 'custom'];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'proposals', label: 'Proposals' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'deals', label: 'Deals' },
  { value: 'leads', label: 'Leads' },
  { value: 'custom', label: 'Custom' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function ApprovalRulesPage() {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, usersData, rolesData] = await Promise.all([
        approvalsApi.getRules(),
        usersApi.getAll({ limit: 500 }),
        rolesApi.getAll(),
      ]);
      setRules(rulesData);
      setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
      setRoles(Array.isArray(rolesData) ? rolesData : rolesData.data || []);
    } catch (err) {
      console.error('Failed to load approval rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = filterEntity === 'all'
    ? rules
    : rules.filter((r) => r.entityType === filterEntity);

  const openCreate = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const openEdit = async (rule: ApprovalRule) => {
    try {
      const full = await approvalsApi.getRule(rule.id);
      setEditingRule(full);
      setShowForm(true);
    } catch (err) {
      console.error('Failed to load rule:', err);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this rule? Active requests will not be affected.')) return;
    setDeleting(ruleId);
    try {
      await approvalsApi.deleteRule(ruleId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (rule: ApprovalRule) => {
    try {
      await approvalsApi.updateRule(rule.id, { isActive: !rule.isActive });
      await loadData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleFormSave = async () => {
    setShowForm(false);
    setEditingRule(null);
    await loadData();
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Approval Rules</h1>
              <p className="text-gray-600 dark:text-slate-400">Configure multi-step approval workflows</p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          users={users}
          roles={roles}
          onSave={handleFormSave}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* Filter */}
      {!showForm && (
        <>
          <div className="flex gap-2 mb-6">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterEntity(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterEntity === opt.value
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Rules List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-16">
              <ShieldCheck className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No approval rules</h3>
              <p className="text-gray-500 dark:text-slate-400 mb-4">
                {filterEntity === 'all'
                  ? 'Create your first approval rule to get started.'
                  : `No rules found for ${ENTITY_LABELS[filterEntity] || filterEntity}.`}
              </p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {rule.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        rule.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded text-xs">
                        {ENTITY_LABELS[rule.entityType] || rule.entityType}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 rounded text-xs">
                        {TRIGGER_LABELS[rule.triggerEvent] || rule.triggerEvent}
                      </span>
                      <span>{rule.stepCount ?? rule.steps?.length ?? 0} step{(rule.stepCount ?? rule.steps?.length ?? 0) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                      title={rule.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {rule.isActive
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleting === rule.id}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === rule.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// RULE FORM (CREATE / EDIT)
// ============================================================

function RuleForm({
  rule,
  users,
  roles,
  onSave,
  onCancel,
}: {
  rule: ApprovalRule | null;
  users: any[];
  roles: any[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(rule?.name || '');
  const [entityType, setEntityType] = useState<EntityType>(rule?.entityType || 'proposals');
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>(rule?.triggerEvent || 'publish');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [steps, setSteps] = useState<Array<{
    stepOrder: number;
    approverType: 'user' | 'role';
    approverUserId?: string;
    approverRoleId?: string;
  }>>(
    rule?.steps?.length
      ? rule.steps.map((s) => ({
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          approverUserId: s.approverUserId || undefined,
          approverRoleId: s.approverRoleId || undefined,
        }))
      : [{ stepOrder: 1, approverType: 'user' }],
  );

  // Reset trigger when entity type changes
  useEffect(() => {
    const triggers = TRIGGER_OPTIONS[entityType] || ['manual'];
    if (!triggers.includes(triggerEvent)) {
      setTriggerEvent(triggers[0]);
    }
  }, [entityType]);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { stepOrder: prev.length + 1, approverType: 'user' },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 })),
    );
  };

  const updateStep = (index: number, field: string, value: any) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        // Clear the other approver field when switching type
        if (field === 'approverType') {
          if (value === 'user') {
            updated.approverRoleId = undefined;
          } else {
            updated.approverUserId = undefined;
          }
        }
        return updated;
      }),
    );
  };

  const handleSave = async () => {
    setError(null);

    // Validate
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }
    if (steps.length === 0) {
      setError('At least one approval step is required');
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.approverType === 'user' && !step.approverUserId) {
        setError(`Step ${i + 1}: Please select an approver user`);
        return;
      }
      if (step.approverType === 'role' && !step.approverRoleId) {
        setError(`Step ${i + 1}: Please select an approver role`);
        return;
      }
    }

    setSaving(true);
    try {
      const dto = {
        name: name.trim(),
        entityType,
        triggerEvent,
        isActive,
        steps: steps.map((s) => ({
          stepOrder: s.stepOrder,
          approverType: s.approverType,
          approverUserId: s.approverType === 'user' ? s.approverUserId : undefined,
          approverRoleId: s.approverType === 'role' ? s.approverRoleId : undefined,
        })),
      };

      if (rule) {
        await approvalsApi.updateRule(rule.id, dto);
      } else {
        await approvalsApi.createRule(dto);
      }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const availableTriggers = TRIGGER_OPTIONS[entityType] || ['manual'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {rule ? 'Edit Rule' : 'New Approval Rule'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Rule Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Rule Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Proposal Publish Approval"
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Entity Type + Trigger */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Entity Type
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {ENTITY_TYPES.map((et) => (
              <option key={et} value={et}>{ENTITY_LABELS[et]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Trigger Event
          </label>
          <select
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value as TriggerEvent)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {availableTriggers.map((t) => (
              <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setIsActive(!isActive)}
          className="flex items-center gap-2 text-sm"
        >
          {isActive
            ? <ToggleRight className="w-6 h-6 text-green-500" />
            : <ToggleLeft className="w-6 h-6 text-gray-400" />}
          <span className={isActive ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </button>
      </div>

      {/* Steps Builder */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Approval Steps
          </label>
          <button
            onClick={addStep}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium flex-shrink-0">
                {idx + 1}
              </div>

              {/* Approver Type */}
              <select
                value={step.approverType}
                onChange={(e) => updateStep(idx, 'approverType', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="user">User</option>
                <option value="role">Role</option>
              </select>

              {/* Approver Selector */}
              {step.approverType === 'user' ? (
                <select
                  value={step.approverUserId || ''}
                  onChange={(e) => updateStep(idx, 'approverUserId', e.target.value || undefined)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select user...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={step.approverRoleId || ''}
                  onChange={(e) => updateStep(idx, 'approverRoleId', e.target.value || undefined)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select role...</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}

              {/* Remove Step */}
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {rule ? 'Update Rule' : 'Create Rule'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
