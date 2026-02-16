// ============================================================
// NEW FILE: apps/web/src/features/admin/FieldValidationTab.tsx
// ============================================================
// Reusable component used in LeadSettingsPage + FieldValidationPage
// for configuring per-module field validation rules.
// ============================================================
import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, Loader2, AlertTriangle,
  ToggleLeft, ToggleRight, Check, Pencil, GripVertical,
  Shield, Info,
} from 'lucide-react';
import { moduleSettingsApi } from '../../api/module-settings.api';
import type { ValidationRule } from '../../api/module-settings.api';
import { SYSTEM_FIELDS_BY_MODULE } from '../../config/field-registry';

interface FieldValidationTabProps {
  module: string; // 'leads' | 'contacts' | 'accounts' | 'opportunities'
}

// Available fields for the field picker — built from field-registry + extras
function getAvailableFields(module: string): { key: string; label: string }[] {
  const systemFields = SYSTEM_FIELDS_BY_MODULE[module] || [];
  const fields = systemFields
    .filter(f => f.isEditable) // Only editable fields make sense as required
    .map(f => ({ key: f.fieldKey, label: f.fieldLabel }));

  return fields;
}

const RULE_TYPE_OPTIONS = [
  { value: 'required', label: 'Required', description: 'This field must be filled' },
  { value: 'any_one', label: 'At Least One', description: 'At least one of these fields must be filled' },
  { value: 'all', label: 'All Required', description: 'All of these fields must be filled' },
] as const;

function generateId(): string {
  return crypto.randomUUID?.() || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FieldValidationTab({ module }: FieldValidationTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableFields = getAvailableFields(module);

  // ── Load rules ──
  useEffect(() => {
    loadRules();
  }, [module]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const config = await moduleSettingsApi.getFieldValidation(module);
      setRules(config.rules || []);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load field validation rules:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Save all rules ──
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await moduleSettingsApi.updateFieldValidation(module, { rules });
      setHasChanges(false);
      setSuccess('Validation rules saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Add a new rule ──
  const handleAddRule = () => {
    const newRule: ValidationRule = {
      id: generateId(),
      fields: [],
      type: 'required',
      label: '',
      message: '',
      isActive: true,
    };
    setRules(prev => [...prev, newRule]);
    setEditingId(newRule.id);
    setHasChanges(true);
  };

  // ── Remove a rule ──
  const handleRemoveRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
    setHasChanges(true);
  };

  // ── Update a rule ──
  const updateRule = (id: string, updates: Partial<ValidationRule>) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setHasChanges(true);
  };

  // ── Toggle active ──
  const toggleActive = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
    setHasChanges(true);
  };

  // ── Auto-generate label from fields ──
  const autoLabel = (fields: string[]): string => {
    return fields.map(f => {
      const found = availableFields.find(af => af.key === f);
      return found?.label || f;
    }).join(' / ');
  };

  // ── Auto-generate message from type and fields ──
  const autoMessage = (type: string, fields: string[]): string => {
    const label = autoLabel(fields);
    switch (type) {
      case 'required': return `${label} is required`;
      case 'any_one': return `At least one of ${label} is required`;
      case 'all': return `All of ${label} are required`;
      default: return `${label} is required`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield size={18} /> Field Validation Rules
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure which fields are required when creating or editing {module}. Rules are enforced on both the form and the API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} /> Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Rules
          </button>
        </div>
      </div>

      {/* Success/Error banners */}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <Check size={14} /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Info box */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          <strong>Rule Types:</strong>{' '}
          <strong>Required</strong> — a single field must be filled.{' '}
          <strong>At Least One</strong> — any one of the selected fields must be filled (e.g. email OR phone).{' '}
          <strong>All Required</strong> — every selected field must be filled.
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Shield className="mx-auto mb-3 text-gray-300 dark:text-gray-600" size={32} />
          <p className="text-sm text-gray-500">No validation rules configured</p>
          <p className="text-xs text-gray-400 mt-1">All fields are optional. Add rules to enforce required fields.</p>
          <button
            onClick={handleAddRule}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isEditing = editingId === rule.id;

            return (
              <div
                key={rule.id}
                className={`border rounded-lg transition-colors ${
                  isEditing
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10'
                    : rule.isActive
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50 opacity-60'
                }`}
              >
                {/* Rule display row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical size={14} className="text-gray-300 shrink-0" />

                  {/* Active toggle */}
                  <button onClick={() => toggleActive(rule.id)} className="shrink-0" title={rule.isActive ? 'Disable rule' : 'Enable rule'}>
                    {rule.isActive
                      ? <ToggleRight size={20} className="text-green-600" />
                      : <ToggleLeft size={20} className="text-gray-400" />
                    }
                  </button>

                  {/* Rule summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        rule.type === 'required' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : rule.type === 'any_one' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {rule.type === 'required' ? 'Required' : rule.type === 'any_one' ? 'Any One' : 'All'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {rule.label || autoLabel(rule.fields) || '(no fields selected)'}
                      </span>
                    </div>
                    {rule.fields.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rule.fields.map(f => {
                          const fieldDef = availableFields.find(af => af.key === f);
                          return (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {fieldDef?.label || f}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {rule.message && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">Error: {rule.message}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingId(isEditing ? null : rule.id)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-500"
                      title={isEditing ? 'Done editing' : 'Edit rule'}
                    >
                      {isEditing ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button
                      onClick={() => handleRemoveRule(rule.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-gray-400 hover:text-red-600"
                      title="Delete rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded edit form */}
                {isEditing && (
                  <div className="border-t border-blue-200 dark:border-blue-800 px-4 py-4 space-y-4">
                    {/* Rule Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Rule Type</label>
                      <div className="flex gap-2">
                        {RULE_TYPE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              updateRule(rule.id, { type: opt.value as ValidationRule['type'] });
                              // If switching to required and has multiple fields, keep only first
                              if (opt.value === 'required' && rule.fields.length > 1) {
                                updateRule(rule.id, { type: 'required', fields: [rule.fields[0]] });
                              }
                            }}
                            className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                              rule.type === opt.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-[10px] mt-0.5 opacity-70">{opt.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fields selector */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">
                        {rule.type === 'required' ? 'Field' : 'Fields'} 
                        {rule.type !== 'required' && <span className="text-gray-400 font-normal"> (select multiple)</span>}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800">
                        {availableFields.map(f => {
                          const isSelected = rule.fields.includes(f.key);
                          // For 'required' type, only allow single selection
                          const isDisabled = rule.type === 'required' && !isSelected && rule.fields.length >= 1;

                          return (
                            <button
                              key={f.key}
                              onClick={() => {
                                if (rule.type === 'required') {
                                  // Single select — replace
                                  updateRule(rule.id, { fields: isSelected ? [] : [f.key] });
                                } else {
                                  // Multi-select — toggle
                                  const newFields = isSelected
                                    ? rule.fields.filter(x => x !== f.key)
                                    : [...rule.fields, f.key];
                                  updateRule(rule.id, { fields: newFields });
                                }
                              }}
                              disabled={isDisabled}
                              className={`text-left px-2 py-1.5 text-xs rounded transition-colors ${
                                isSelected
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                                  : isDisabled
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                {isSelected && <Check size={10} />}
                                {f.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Label (optional override) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Label <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={rule.label}
                          onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                          placeholder={autoLabel(rule.fields) || 'Auto-generated from fields'}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Error Message <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={rule.message}
                          onChange={(e) => updateRule(rule.id, { message: e.target.value })}
                          placeholder={autoMessage(rule.type, rule.fields) || 'Auto-generated'}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add rule button */}
          <button
            onClick={handleAddRule}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <Plus size={14} /> Add Rule
          </button>
        </div>
      )}
    </div>
  );
}