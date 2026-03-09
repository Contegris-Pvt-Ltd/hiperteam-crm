import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  GripVertical,
  Type,
  Mail,
  Phone,
  Hash,
  AlignLeft,
  List,
  CircleDot,
  CheckSquare,
  Calendar,
  Upload,
  Heading,
  FileText,
  Minus,
  Eye,
  Wand2,
  Copy,
} from 'lucide-react';
import { formsApi } from '../../api/forms.api';
import type { FormRecord, FormField, FormSubmitAction, FormSettings, FormBranding } from '../../api/forms.api';

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'textarea', label: 'Text Area', icon: AlignLeft },
  { type: 'select', label: 'Dropdown', icon: List },
  { type: 'radio', label: 'Radio', icon: CircleDot },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'file', label: 'File Upload', icon: Upload },
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'paragraph', label: 'Paragraph', icon: FileText },
  { type: 'divider', label: 'Divider', icon: Minus },
] as const;

const CRM_FIELD_OPTIONS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'name', label: 'Name (Account)' },
  { value: 'website', label: 'Website' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'notes', label: 'Notes' },
];

type Tab = 'fields' | 'actions' | 'settings' | 'branding';

export function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFieldIdx, setSelectedFieldIdx] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<Tab>('fields');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    formsApi.getById(id).then((f) => {
      setForm(f);
      setLoading(false);
    }).catch(() => {
      navigate('/forms');
    });
  }, [id]);

  const updateForm = useCallback((patch: Partial<FormRecord>) => {
    setForm((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!form || !id) return;
    setSaving(true);
    try {
      const updated = await formsApi.update(id, {
        name: form.name,
        description: form.description,
        slug: form.slug,
        status: form.status,
        fields: form.fields,
        settings: form.settings,
        submitActions: form.submitActions,
        branding: form.branding,
      });
      // Preserve tenantSlug/token in case update response omits them
      setForm({ ...updated, tenantSlug: updated.tenantSlug || form.tenantSlug, token: updated.token || form.token });
      setDirty(false);
    } catch (err) {
      console.error('Failed to save', err);
    } finally {
      setSaving(false);
    }
  };

  const addField = (type: string) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: type as FormField['type'],
      label: FIELD_TYPES.find((f) => f.type === type)?.label || type,
      name: `field_${Date.now()}`,
      placeholder: '',
      required: false,
      width: 'full',
      options: ['select', 'radio', 'checkbox'].includes(type) ? [{ label: 'Option 1', value: 'option_1' }] : undefined,
    };
    const fields = [...(form?.fields || []), newField];
    updateForm({ fields });
    setSelectedFieldIdx(fields.length - 1);
    setRightTab('fields');
  };

  const removeField = (idx: number) => {
    const fields = (form?.fields || []).filter((_, i) => i !== idx);
    updateForm({ fields });
    setSelectedFieldIdx(null);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    const fields = (form?.fields || []).map((f, i) => (i === idx ? { ...f, ...patch } : f));
    updateForm({ fields });
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= (form?.fields?.length || 0)) return;
    const fields = [...(form?.fields || [])];
    const [item] = fields.splice(from, 1);
    fields.splice(to, 0, item);
    updateForm({ fields });
    setSelectedFieldIdx(to);
  };

  const addAction = () => {
    const actions = [...(form?.submitActions || []), { type: 'create_lead' as const, enabled: true, fieldMapping: {} }];
    updateForm({ submitActions: actions });
  };

  const removeAction = (idx: number) => {
    const actions = (form?.submitActions || []).filter((_, i) => i !== idx);
    updateForm({ submitActions: actions });
  };

  const updateAction = (idx: number, patch: Partial<FormSubmitAction>) => {
    const actions = (form?.submitActions || []).map((a, i) => (i === idx ? { ...a, ...patch } : a));
    updateForm({ submitActions: actions });
  };

  const getPublicUrl = () => {
    if (!form) return '';
    return `${window.location.origin}/f/${form.tenantSlug}/${form.token}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!form) return null;

  const selectedField = selectedFieldIdx !== null ? (form.fields || [])[selectedFieldIdx] ?? null : null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/forms')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <input
            value={form.name || ''}
            onChange={(e) => updateForm({ name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white w-60"
          />
          <select
            value={form.status}
            onChange={(e) => updateForm({ status: e.target.value as FormRecord['status'] })}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {form.status === 'active' && (
            <>
              <button
                onClick={() => window.open(getPublicUrl(), '_blank')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Eye className="w-4 h-4" /> Preview
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(getPublicUrl()); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <Copy className="w-4 h-4" /> Copy Link
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Field Palette */}
        <div className="w-56 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Add Fields</p>
          <div className="space-y-1">
            {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => addField(type)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-slate-950 p-6">
          <div className="max-w-2xl mx-auto">
            {/* Form Header */}
            <div className="bg-white dark:bg-slate-800 rounded-t-xl border border-gray-200 dark:border-slate-700 p-6">
              <input
                value={form.name || ''}
                onChange={(e) => updateForm({ name: e.target.value })}
                className="text-xl font-bold bg-transparent border-none outline-none w-full text-gray-900 dark:text-white"
                placeholder="Form Title"
              />
              <input
                value={form.description || ''}
                onChange={(e) => updateForm({ description: e.target.value })}
                className="mt-2 text-sm bg-transparent border-none outline-none w-full text-gray-500 dark:text-gray-400"
                placeholder="Add a description..."
              />
            </div>

            {/* Fields */}
            <div className="bg-white dark:bg-slate-800 border-x border-gray-200 dark:border-slate-700">
              {(form.fields || []).length === 0 ? (
                <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                  <Wand2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Click a field type on the left to add it</p>
                </div>
              ) : (
                (form.fields || []).map((field, idx) => (
                  <div
                    key={field.id}
                    onClick={() => { setSelectedFieldIdx(idx); setRightTab('fields'); }}
                    className={`flex items-start gap-2 px-6 py-4 border-b border-gray-100 dark:border-slate-700 cursor-pointer transition-colors ${
                      selectedFieldIdx === idx
                        ? 'bg-purple-50 dark:bg-purple-900/10 ring-2 ring-purple-400 ring-inset'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex flex-col gap-1 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); moveField(idx, idx - 1); }} className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded">
                        <GripVertical className="w-4 h-4 text-gray-300" />
                      </button>
                    </div>
                    <div className="flex-1">
                      {field.type === 'heading' ? (
                        <h3 className="font-semibold text-gray-900 dark:text-white">{field.label}</h3>
                      ) : field.type === 'paragraph' ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{field.label}</p>
                      ) : field.type === 'divider' ? (
                        <hr className="border-gray-200 dark:border-slate-600 my-2" />
                      ) : (
                        <>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <div className="w-full h-16 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900" />
                          ) : field.type === 'select' ? (
                            <select disabled className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-sm text-gray-400">
                              <option>{field.placeholder || 'Select...'}</option>
                            </select>
                          ) : field.type === 'radio' || field.type === 'checkbox' ? (
                            <div className="space-y-1">
                              {(field.options || []).map((opt, i) => (
                                <label key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <input type={field.type} disabled className="text-purple-600" />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              disabled
                              placeholder={field.placeholder || ''}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 text-sm text-gray-400"
                            />
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeField(idx); }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Submit Button Preview */}
            <div className="bg-white dark:bg-slate-800 rounded-b-xl border border-t-0 border-gray-200 dark:border-slate-700 p-6">
              <button disabled className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium opacity-80">
                {form.settings?.successMessage ? 'Submit' : 'Submit'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Settings Panel */}
        <div className="w-80 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 overflow-y-auto">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-700">
            {(['fields', 'actions', 'settings', 'branding'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 px-2 py-3 text-xs font-medium capitalize transition-colors ${
                  rightTab === tab
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Field Settings Tab */}
            {rightTab === 'fields' && (
              selectedField ? (
                <FieldSettingsPanel
                  field={selectedField}
                  onChange={(patch) => updateField(selectedFieldIdx!, patch)}
                />
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                  Select a field to edit its settings
                </p>
              )
            )}

            {/* Actions Tab */}
            {rightTab === 'actions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Submit Actions</p>
                  <button onClick={addAction} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                    + Add Action
                  </button>
                </div>
                {(form.submitActions || []).map((action, idx) => (
                  <ActionEditor
                    key={idx}
                    action={action}
                    formFields={form.fields}
                    onChange={(patch) => updateAction(idx, patch)}
                    onRemove={() => removeAction(idx)}
                  />
                ))}
                {(form.submitActions || []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No actions configured. Submissions will only be stored.
                  </p>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {rightTab === 'settings' && (
              <SettingsPanel
                settings={form.settings || {}}
                onChange={(s) => updateForm({ settings: s })}
              />
            )}

            {/* Branding Tab */}
            {rightTab === 'branding' && (
              <BrandingPanel
                branding={form.branding || {}}
                onChange={(b) => updateForm({ branding: b })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field Settings Sub-Panel ────────────────────────────────
function FieldSettingsPanel({ field, onChange }: { field: FormField; onChange: (p: Partial<FormField>) => void }) {
  const isLayout = ['heading', 'paragraph', 'divider'].includes(field.type);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
      {!isLayout && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Field Name</label>
            <input
              value={field.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm font-mono dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Placeholder</label>
            <input
              value={field.placeholder || ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded text-purple-600"
              />
              Required
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Width</label>
            <select
              value={field.width || 'full'}
              onChange={(e) => onChange({ width: e.target.value as 'full' | 'half' })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
            >
              <option value="full">Full Width</option>
              <option value="half">Half Width</option>
            </select>
          </div>
        </>
      )}
      {/* Options editor for select/radio/checkbox */}
      {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Options</label>
          {(field.options || []).map((opt, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <input
                value={opt.label}
                onChange={(e) => {
                  const opts = [...(field.options || [])];
                  opts[i] = { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                  onChange({ options: opts });
                }}
                className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 dark:text-white"
              />
              <button
                onClick={() => {
                  const opts = (field.options || []).filter((_, j) => j !== i);
                  onChange({ options: opts });
                }}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const opts = [...(field.options || []), { label: `Option ${(field.options?.length || 0) + 1}`, value: `option_${(field.options?.length || 0) + 1}` }];
              onChange({ options: opts });
            }}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-1"
          >
            + Add Option
          </button>
        </div>
      )}
    </div>
  );
}

// ── Action Editor Sub-Panel ─────────────────────────────────
function ActionEditor({
  action,
  formFields,
  onChange,
  onRemove,
}: {
  action: FormSubmitAction;
  formFields: FormField[];
  onChange: (p: Partial<FormSubmitAction>) => void;
  onRemove: () => void;
}) {
  const inputFields = formFields.filter((f) => !['heading', 'paragraph', 'divider'].includes(f.type));

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <select
          value={action.type}
          onChange={(e) => onChange({ type: e.target.value as FormSubmitAction['type'] })}
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 dark:text-white"
        >
          <option value="create_lead">Create Lead</option>
          <option value="create_contact">Create Contact</option>
          <option value="create_account">Create Account</option>
          <option value="webhook">Webhook</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={action.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="rounded text-purple-600"
            />
            Active
          </label>
          <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {action.type === 'webhook' ? (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Webhook URL</label>
          <input
            value={action.webhookUrl || ''}
            onChange={(e) => onChange({ webhookUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Field Mapping</label>
          <div className="space-y-1.5">
            {CRM_FIELD_OPTIONS.map((crm) => (
              <div key={crm.value} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-24 truncate">{crm.label}</span>
                <span className="text-xs text-gray-400">←</span>
                <select
                  value={action.fieldMapping?.[crm.value] || ''}
                  onChange={(e) => {
                    const mapping = { ...(action.fieldMapping || {}) };
                    if (e.target.value) {
                      mapping[crm.value] = e.target.value;
                    } else {
                      delete mapping[crm.value];
                    }
                    onChange({ fieldMapping: mapping });
                  }}
                  className="flex-1 text-xs border border-gray-200 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-900 dark:text-white"
                >
                  <option value="">-- skip --</option>
                  {inputFields.map((f) => (
                    <option key={f.id} value={f.name}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Panel ──────────────────────────────────────────
function SettingsPanel({ settings, onChange }: { settings: FormSettings; onChange: (s: FormSettings) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Success Message</label>
        <textarea
          value={settings.successMessage || ''}
          onChange={(e) => onChange({ ...settings, successMessage: e.target.value })}
          rows={3}
          placeholder="Thank you for your submission!"
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Redirect URL (optional)</label>
        <input
          value={settings.redirectUrl || ''}
          onChange={(e) => onChange({ ...settings, redirectUrl: e.target.value })}
          placeholder="https://example.com/thank-you"
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={settings.allowMultiple ?? true}
          onChange={(e) => onChange({ ...settings, allowMultiple: e.target.checked })}
          className="rounded text-purple-600"
        />
        Allow multiple submissions
      </label>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notification Emails</label>
        <input
          value={(settings.notifyEmails || []).join(', ')}
          onChange={(e) => onChange({ ...settings, notifyEmails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          placeholder="admin@company.com, sales@company.com"
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
        <p className="text-xs text-gray-400 mt-1">Comma-separated email addresses</p>
      </div>
    </div>
  );
}

// ── Branding Panel ──────────────────────────────────────────
function BrandingPanel({ branding, onChange }: { branding: FormBranding; onChange: (b: FormBranding) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Logo URL</label>
        <input
          value={branding.logoUrl || ''}
          onChange={(e) => onChange({ ...branding, logoUrl: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Primary Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={branding.primaryColor || '#7c3aed'}
            onChange={(e) => onChange({ ...branding, primaryColor: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <input
            value={branding.primaryColor || '#7c3aed'}
            onChange={(e) => onChange({ ...branding, primaryColor: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm font-mono dark:text-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Background Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={branding.backgroundColor || '#f3f4f6'}
            onChange={(e) => onChange({ ...branding, backgroundColor: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <input
            value={branding.backgroundColor || '#f3f4f6'}
            onChange={(e) => onChange({ ...branding, backgroundColor: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm font-mono dark:text-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Header Text</label>
        <input
          value={branding.headerText || ''}
          onChange={(e) => onChange({ ...branding, headerText: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Footer Text</label>
        <input
          value={branding.footerText || ''}
          onChange={(e) => onChange({ ...branding, footerText: e.target.value })}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
        />
      </div>
    </div>
  );
}
