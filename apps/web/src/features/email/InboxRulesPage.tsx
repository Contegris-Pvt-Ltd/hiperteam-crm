import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, Save, Pencil, X,
  Filter, ToggleLeft, ToggleRight, AlertTriangle, GripVertical,
} from 'lucide-react';
import { emailApi } from '../../api/email.api';
import type {
  InboxRule, RuleCondition, RuleAction,
  RuleField, RuleOperator, RuleActionType,
} from '../../api/email.api';

// ============================================================
// LABELS & OPTIONS
// ============================================================

const FIELD_LABELS: Record<RuleField, string> = {
  from: 'From',
  to: 'To',
  subject: 'Subject',
  body: 'Body',
  has_attachments: 'Has Attachments',
  header: 'Header',
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: 'Contains',
  not_contains: 'Does not contain',
  equals: 'Equals',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  regex: 'Matches regex',
};

const ACTION_LABELS: Record<RuleActionType, string> = {
  mark_read: 'Mark as read',
  star: 'Star email',
  label: 'Apply label',
  link_contact: 'Link to contact',
  link_lead: 'Link to lead',
  link_opportunity: 'Link to opportunity',
  link_account: 'Link to account',
  forward: 'Forward to',
  auto_reply: 'Auto-reply',
  delete: 'Move to trash',
};

const ACTIONS_WITH_CONFIG: RuleActionType[] = ['label', 'forward', 'auto_reply'];

const APPLY_TO_OPTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'all', label: 'All' },
];

const FIELD_OPTIONS: RuleField[] = ['from', 'to', 'subject', 'body', 'has_attachments'];
const OPERATOR_OPTIONS: RuleOperator[] = ['contains', 'not_contains', 'equals', 'starts_with', 'ends_with', 'regex'];
const ACTION_OPTIONS: RuleActionType[] = [
  'mark_read', 'star', 'label',
  'link_contact', 'link_lead', 'link_opportunity', 'link_account',
  'forward', 'auto_reply', 'delete',
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export function InboxRulesPage() {
  const [rules, setRules] = useState<InboxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<InboxRule | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await emailApi.getRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const openEdit = (rule: InboxRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return;
    setDeleting(ruleId);
    try {
      await emailApi.deleteRule(ruleId);
      await loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (rule: InboxRule) => {
    try {
      await emailApi.updateRule(rule.id, { isActive: !rule.isActive });
      await loadRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleFormSave = async () => {
    setShowForm(false);
    setEditingRule(null);
    await loadRules();
  };

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/inbox"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbox
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inbox Rules</h1>
              <p className="text-gray-600 dark:text-slate-400">Automate email processing with conditions and actions</p>
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
          onSave={handleFormSave}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {/* Rules List */}
      {!showForm && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-16">
              <Filter className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No inbox rules</h3>
              <p className="text-gray-500 dark:text-slate-400 mb-4">
                Create your first rule to automatically process incoming emails.
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
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <GripVertical className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />
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
                        {rule.stopProcessing && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            Stop
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 rounded text-xs">
                          {APPLY_TO_OPTIONS.find((o) => o.value === rule.applyTo)?.label || rule.applyTo}
                        </span>
                        <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}</span>
                        <span className="text-gray-300 dark:text-slate-600">&middot;</span>
                        <span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
                        {rule.priority > 0 && (
                          <>
                            <span className="text-gray-300 dark:text-slate-600">&middot;</span>
                            <span>Priority: {rule.priority}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title={rule.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4 text-gray-400 hover:text-purple-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={deleting === rule.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete"
                    >
                      {deleting === rule.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                      )}
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
// RULE FORM
// ============================================================

function RuleForm({
  rule,
  onSave,
  onCancel,
}: {
  rule: InboxRule | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [applyTo, setApplyTo] = useState(rule?.applyTo || 'inbound');
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions || [{ field: 'from', operator: 'contains', value: '' }],
  );
  const [actions, setActions] = useState<RuleAction[]>(
    rule?.actions || [{ type: 'mark_read' }],
  );
  const [stopProcessing, setStopProcessing] = useState(rule?.stopProcessing || false);
  const [priority, setPriority] = useState(rule?.priority || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Rule name is required');
      return;
    }
    if (conditions.some((c) => !c.value.trim() && c.field !== 'has_attachments')) {
      setError('All condition values are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dto = { name, applyTo, conditions, actions, stopProcessing, priority };
      if (rule) {
        await emailApi.updateRule(rule.id, dto);
      } else {
        await emailApi.createRule(dto);
      }
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  // Conditions helpers
  const addCondition = () => {
    setConditions([...conditions, { field: 'subject', operator: 'contains', value: '' }]);
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  // Actions helpers
  const addAction = () => {
    setActions([...actions, { type: 'star' }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, patch: Partial<RuleAction>) => {
    setActions(actions.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {rule ? 'Edit Rule' : 'New Rule'}
        </h2>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Name + Apply To */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g. Auto-link support emails"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Apply To</label>
          <select
            value={applyTo}
            onChange={(e) => setApplyTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {APPLY_TO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
            Conditions <span className="text-gray-400 font-normal">(all must match)</span>
          </label>
          <button
            onClick={addCondition}
            className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Condition
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value as RuleField })}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(idx, { operator: e.target.value as RuleOperator })}
                className="w-44 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>
              {cond.field === 'has_attachments' ? (
                <select
                  value={cond.value || 'true'}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  placeholder="Value..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                />
              )}
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(idx)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Actions</label>
          <button
            onClick={addAction}
            className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Action
          </button>
        </div>
        <div className="space-y-2">
          {actions.map((action, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={action.type}
                onChange={(e) => {
                  const type = e.target.value as RuleActionType;
                  updateAction(idx, {
                    type,
                    config: ACTIONS_WITH_CONFIG.includes(type) ? (action.config || {}) : undefined,
                  });
                }}
                className="w-52 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
              {action.type === 'label' && (
                <input
                  type="text"
                  value={action.config?.label || ''}
                  onChange={(e) => updateAction(idx, { config: { ...action.config, label: e.target.value } })}
                  placeholder="Label name..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                />
              )}
              {action.type === 'forward' && (
                <input
                  type="email"
                  value={action.config?.to || ''}
                  onChange={(e) => updateAction(idx, { config: { ...action.config, to: e.target.value } })}
                  placeholder="Forward to email..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                />
              )}
              {action.type === 'auto_reply' && (
                <input
                  type="text"
                  value={action.config?.template || ''}
                  onChange={(e) => updateAction(idx, { config: { ...action.config, template: e.target.value } })}
                  placeholder="Reply template..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
                />
              )}
              {!ACTIONS_WITH_CONFIG.includes(action.type) && (
                <div className="flex-1" />
              )}
              {actions.length > 1 && (
                <button
                  onClick={() => removeAction(idx)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStopProcessing(!stopProcessing)}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
          >
            {stopProcessing ? (
              <ToggleRight className="w-5 h-5 text-purple-500" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
            Stop processing subsequent rules if matched
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Priority</label>
          <input
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm"
          />
          <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">Lower = higher priority</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {rule ? 'Update Rule' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
}
