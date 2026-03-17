// ============================================================
// Shared modal for creating/editing custom fields.
// Extracted from CustomFieldsPage for reuse in Form Builder.
// ============================================================
import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Loader2, Link2, Upload,
  Type, Hash, Calendar, List, CheckSquare, FileText, Link, Mail, Phone,
  LayoutGrid, Columns,
} from 'lucide-react';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { adminApi } from '../../api/admin.api';
import { OptionsUploader } from './OptionsUploader';

const SECTION_OPTIONS = [
  { value: 'basic', label: 'Basic Info' },
  { value: 'contact', label: 'Contact Details' },
  { value: 'address', label: 'Address' },
  { value: 'social', label: 'Social Profiles' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom Fields Tab' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'textarea', label: 'Text Area', icon: FileText },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multi_select', label: 'Multi Select', icon: List },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'file', label: 'File Upload', icon: Upload },
];

interface CustomFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingField: CustomField | null;
  module: string;
  allFields: CustomField[];
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
  defaultSection?: string;
}

export function CustomFieldModal({
  isOpen,
  onClose,
  onSaved,
  editingField,
  module,
  allFields,
  tabs,
  groups,
  defaultSection = 'custom',
}: CustomFieldModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showOptionsUploader, setShowOptionsUploader] = useState(false);
  const [uploaderMode, setUploaderMode] = useState<'simple' | 'conditional' | 'singleParent'>('simple');
  const [uploaderParentValue, setUploaderParentValue] = useState('');
  const [uploaderParentLabel, setUploaderParentLabel] = useState('');

  const [formData, setFormData] = useState({
    fieldKey: '',
    fieldLabel: '',
    fieldType: 'text' as CustomField['fieldType'],
    fieldOptions: [] as { label: string; value: string }[],
    isRequired: false,
    defaultValue: '',
    placeholder: '',
    helpText: '',
    section: defaultSection,
    includeInCompletion: true,
    completionWeight: 1,
    dependsOnFieldId: '' as string,
    conditionalOptions: {} as Record<string, { label: string; value: string }[]>,
    tabId: '' as string,
    groupId: '' as string,
    columnSpan: 1 as number,
  });

  useEffect(() => {
    if (isOpen) {
      if (editingField) {
        setFormData({
          fieldKey: editingField.fieldKey,
          fieldLabel: editingField.fieldLabel,
          fieldType: editingField.fieldType,
          fieldOptions: editingField.fieldOptions || [],
          isRequired: editingField.isRequired,
          defaultValue: editingField.defaultValue || '',
          placeholder: editingField.placeholder || '',
          helpText: editingField.helpText || '',
          section: editingField.section || 'custom',
          includeInCompletion: editingField.includeInCompletion,
          completionWeight: editingField.completionWeight,
          dependsOnFieldId: editingField.dependsOnFieldId || '',
          conditionalOptions: editingField.conditionalOptions || {},
          tabId: editingField.tabId || '',
          groupId: editingField.groupId || '',
          columnSpan: editingField.columnSpan || 1,
        });
      } else {
        setFormData({
          fieldKey: '',
          fieldLabel: '',
          fieldType: 'text',
          fieldOptions: [],
          isRequired: false,
          defaultValue: '',
          placeholder: '',
          helpText: '',
          section: defaultSection,
          includeInCompletion: true,
          completionWeight: 1,
          dependsOnFieldId: '',
          conditionalOptions: {},
          tabId: '',
          groupId: '',
          columnSpan: 1,
        });
      }
      setError('');
    }
  }, [isOpen, editingField, defaultSection]);

  const generateFieldKey = (label: string) =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleLabelChange = (label: string) => {
    setFormData(prev => ({
      ...prev,
      fieldLabel: label,
      fieldKey: editingField ? prev.fieldKey : generateFieldKey(label),
    }));
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      fieldOptions: [...prev.fieldOptions, { label: '', value: '' }],
    }));
  };

  const updateOption = (index: number, key: 'label' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      fieldOptions: prev.fieldOptions.map((opt, i) =>
        i === index
          ? { ...opt, [key]: value, ...(key === 'label' && !opt.value ? { value: generateFieldKey(value) } : {}) }
          : opt
      ),
    }));
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fieldOptions: prev.fieldOptions.filter((_, i) => i !== index),
    }));
  };

  const getAvailableParentFields = () =>
    allFields.filter(f =>
      (f.fieldType === 'select' || f.fieldType === 'multi_select') &&
      f.id !== editingField?.id &&
      f.dependsOnFieldId !== editingField?.id
    );

  const getParentFieldOptions = (): { label: string; value: string }[] => {
    const parentField = allFields.find(f => f.id === formData.dependsOnFieldId);
    if (!parentField) return [];
    if (parentField.fieldOptions?.length > 0) return parentField.fieldOptions;
    if (parentField.conditionalOptions) {
      const allOpts: { label: string; value: string }[] = [];
      const seen = new Set<string>();
      Object.values(parentField.conditionalOptions).forEach(options => {
        options.forEach(opt => {
          if (!seen.has(opt.value)) { seen.add(opt.value); allOpts.push(opt); }
        });
      });
      return allOpts;
    }
    return [];
  };

  const addConditionalOption = (parentValue: string) => {
    setFormData(prev => ({
      ...prev,
      conditionalOptions: {
        ...prev.conditionalOptions,
        [parentValue]: [...(prev.conditionalOptions[parentValue] || []), { label: '', value: '' }],
      },
    }));
  };

  const updateConditionalOption = (parentValue: string, index: number, key: 'label' | 'value', value: string) => {
    setFormData(prev => ({
      ...prev,
      conditionalOptions: {
        ...prev.conditionalOptions,
        [parentValue]: prev.conditionalOptions[parentValue].map((opt, i) =>
          i === index
            ? { ...opt, [key]: value, ...(key === 'label' && !opt.value ? { value: generateFieldKey(value) } : {}) }
            : opt
        ),
      },
    }));
  };

  const removeConditionalOption = (parentValue: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      conditionalOptions: {
        ...prev.conditionalOptions,
        [parentValue]: prev.conditionalOptions[parentValue].filter((_, i) => i !== index),
      },
    }));
  };

  const clearDependency = () => {
    setFormData(prev => ({
      ...prev,
      dependsOnFieldId: '',
      conditionalOptions: {},
      fieldOptions: [],
    }));
  };

  const handleOptionsUploaded = (options: { label: string; value: string }[] | Record<string, { label: string; value: string }[]>) => {
    if (uploaderMode === 'simple') {
      const newOptions = options as { label: string; value: string }[];
      setFormData(prev => ({ ...prev, fieldOptions: [...prev.fieldOptions, ...newOptions] }));
    } else {
      const newConditional = options as Record<string, { label: string; value: string }[]>;
      setFormData(prev => {
        const merged = { ...prev.conditionalOptions };
        Object.entries(newConditional).forEach(([pv, opts]) => {
          merged[pv] = [...(merged[pv] || []), ...opts];
        });
        return { ...prev, conditionalOptions: merged };
      });
    }
    setShowOptionsUploader(false);
    setUploaderParentValue('');
    setUploaderParentLabel('');
  };

  const handleSave = async () => {
    if (!formData.fieldKey || !formData.fieldLabel) {
      setError('Field key and label are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const dataToSave: Partial<CustomField> = {
        ...formData,
        dependsOnFieldId: formData.dependsOnFieldId || null,
        conditionalOptions: formData.dependsOnFieldId ? formData.conditionalOptions : {},
        fieldOptions: formData.dependsOnFieldId ? [] : formData.fieldOptions,
        tabId: formData.tabId || null,
        groupId: formData.groupId || null,
        section: formData.tabId ? 'custom' : formData.section,
        columnSpan: formData.columnSpan,
      };
      if (editingField) {
        await adminApi.updateCustomField(editingField.id, dataToSave);
      } else {
        await adminApi.createCustomField({ ...dataToSave, module });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to save custom field');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
              </h3>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Field Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Field Label *</label>
                <input
                  type="text"
                  value={formData.fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g., Department"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Field Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Field Key *</label>
                <input
                  type="text"
                  value={formData.fieldKey}
                  onChange={(e) => setFormData({ ...formData, fieldKey: e.target.value })}
                  placeholder="e.g., department"
                  disabled={!!editingField}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Unique identifier (auto-generated from label)</p>
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Field Type</label>
                <select
                  value={formData.fieldType}
                  onChange={(e) => setFormData({ ...formData, fieldType: e.target.value as CustomField['fieldType'] })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Field Placement */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid className="w-4 h-4 text-purple-600" />
                  <h4 className="font-medium text-gray-900 dark:text-white">Field Placement</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display In</label>
                    <select
                      value={formData.tabId ? `tab:${formData.tabId}` : formData.section}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.startsWith('tab:')) {
                          setFormData(prev => ({ ...prev, tabId: value.replace('tab:', ''), section: 'custom', groupId: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, section: value, tabId: '', groupId: '' }));
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <optgroup label="Standard Sections">
                        {SECTION_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </optgroup>
                      {tabs.length > 0 && (
                        <optgroup label="Custom Tabs">
                          {tabs.filter(t => t.isActive).map(t => (
                            <option key={t.id} value={`tab:${t.id}`}>{t.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Group (Optional)</label>
                    <select
                      value={formData.groupId}
                      onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">No Group</option>
                      {groups
                        .filter(g => g.isActive && (
                          (formData.tabId && g.tabId === formData.tabId) ||
                          (!formData.tabId && g.section === formData.section)
                        ))
                        .map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Field Width</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="columnSpan" checked={formData.columnSpan === 1}
                        onChange={() => setFormData(prev => ({ ...prev, columnSpan: 1 }))}
                        className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500" />
                      <Columns className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Half Width</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="columnSpan" checked={formData.columnSpan === 2}
                        onChange={() => setFormData(prev => ({ ...prev, columnSpan: 2 }))}
                        className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500" />
                      <LayoutGrid className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Full Width</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Options for select/multi_select */}
              {(formData.fieldType === 'select' || formData.fieldType === 'multi_select') && !formData.dependsOnFieldId && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Options</label>
                    <button type="button" onClick={() => { setUploaderMode('simple'); setShowOptionsUploader(true); }}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Bulk Upload
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.fieldOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input type="text" value={option.label} onChange={(e) => updateOption(index, 'label', e.target.value)}
                          placeholder="Label" className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                        <input type="text" value={option.value} onChange={(e) => updateOption(index, 'value', e.target.value)}
                          placeholder="Value" className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                        <button type="button" onClick={() => removeOption(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addOption} className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add option
                    </button>
                  </div>
                </div>
              )}

              {/* Dependent Field Configuration */}
              {(formData.fieldType === 'select' || formData.fieldType === 'multi_select') && (
                <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-purple-600" />
                    <h4 className="font-medium text-gray-900 dark:text-white">Linked Field (Optional)</h4>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                    Make this field dependent on another dropdown. Options will change based on the parent field's value.
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Depends On</label>
                    {getAvailableParentFields().length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-slate-500 italic">No dropdown fields available to link to.</p>
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={formData.dependsOnFieldId}
                          onChange={(e) => {
                            const newParentId = e.target.value;
                            if (newParentId) {
                              const parentField = allFields.find(f => f.id === newParentId);
                              let parentOptions: { label: string; value: string }[] = [];
                              if (parentField?.fieldOptions?.length) { parentOptions = parentField.fieldOptions; }
                              else if (parentField?.conditionalOptions) {
                                const seen = new Set<string>();
                                Object.values(parentField.conditionalOptions).forEach(options => {
                                  options.forEach(opt => { if (!seen.has(opt.value)) { seen.add(opt.value); parentOptions.push(opt); } });
                                });
                              }
                              const initialConditional: Record<string, { label: string; value: string }[]> = {};
                              parentOptions.forEach(opt => { initialConditional[opt.value] = []; });
                              setFormData(prev => ({ ...prev, dependsOnFieldId: newParentId, conditionalOptions: initialConditional, fieldOptions: [] }));
                            } else { clearDependency(); }
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        >
                          <option value="">None (Independent field)</option>
                          {getAvailableParentFields().map((f) => (
                            <option key={f.id} value={f.id}>{f.fieldLabel} ({f.fieldKey})</option>
                          ))}
                        </select>
                        {formData.dependsOnFieldId && (
                          <button type="button" onClick={clearDependency} className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl">Clear</button>
                        )}
                      </div>
                    )}
                  </div>

                  {formData.dependsOnFieldId && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Configure options for each parent value:</p>
                        <button type="button" onClick={() => { setUploaderMode('conditional'); setShowOptionsUploader(true); }}
                          className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <Upload className="w-3 h-3" /> Bulk Upload All
                        </button>
                      </div>
                      {getParentFieldOptions().map((parentOption) => (
                        <div key={parentOption.value} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                              When "{parentOption.label}" is selected:
                            </span>
                            <button type="button" onClick={() => { setUploaderMode('singleParent'); setUploaderParentValue(parentOption.value); setUploaderParentLabel(parentOption.label); setShowOptionsUploader(true); }}
                              className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <Upload className="w-3 h-3" /> Bulk upload
                            </button>
                          </div>
                          <div className="space-y-2 ml-4">
                            {(formData.conditionalOptions[parentOption.value] || []).map((opt, index) => (
                              <div key={index} className="flex gap-2">
                                <input type="text" value={opt.label} onChange={(e) => updateConditionalOption(parentOption.value, index, 'label', e.target.value)}
                                  placeholder="Label" className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                                <input type="text" value={opt.value} onChange={(e) => updateConditionalOption(parentOption.value, index, 'value', e.target.value)}
                                  placeholder="Value" className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm" />
                                <button type="button" onClick={() => removeConditionalOption(parentOption.value, index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addConditionalOption(parentOption.value)}
                              className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <Plus className="w-4 h-4" /> Add option
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Placeholder</label>
                <input type="text" value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="e.g., Enter department name"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>

              {/* Help Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Help Text</label>
                <input type="text" value={formData.helpText}
                  onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                  placeholder="Additional instructions"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>

              {/* Default Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Default Value</label>
                {formData.fieldType === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="cfm-defaultValue" checked={formData.defaultValue === 'true'}
                      onChange={(e) => setFormData({ ...formData, defaultValue: e.target.checked ? 'true' : 'false' })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                    <label htmlFor="cfm-defaultValue" className="text-sm text-gray-700 dark:text-slate-300">Checked by default</label>
                  </div>
                ) : formData.fieldType === 'select' || formData.fieldType === 'multi_select' ? (
                  <select value={formData.defaultValue} onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white">
                    <option value="">No default</option>
                    {formData.fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : formData.fieldType === 'file' ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400 italic">File fields cannot have a default value</p>
                ) : (
                  <input
                    type={formData.fieldType === 'number' ? 'number' : formData.fieldType === 'date' ? 'date' : formData.fieldType === 'email' ? 'email' : formData.fieldType === 'url' ? 'url' : 'text'}
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder={`Enter default ${formData.fieldType}`}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                )}
              </div>

              {/* Required */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cfm-isRequired" checked={formData.isRequired}
                  onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                <label htmlFor="cfm-isRequired" className="text-sm text-gray-700 dark:text-slate-300">This field is required</label>
              </div>

              {/* Profile Completion */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cfm-includeInCompletion" checked={formData.includeInCompletion}
                  onChange={(e) => setFormData({ ...formData, includeInCompletion: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                <label htmlFor="cfm-includeInCompletion" className="text-sm text-gray-700 dark:text-slate-300">Include in profile completion</label>
              </div>

              {formData.includeInCompletion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Completion Weight</label>
                  <input type="number" min="1" max="100" value={formData.completionWeight}
                    onChange={(e) => setFormData({ ...formData, completionWeight: parseInt(e.target.value) || 1 })}
                    className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white" />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingField ? 'Save Changes' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showOptionsUploader && (
        <OptionsUploader
          mode={uploaderMode}
          parentOptions={uploaderMode === 'conditional' ? getParentFieldOptions() : undefined}
          selectedParentValue={uploaderMode === 'singleParent' ? uploaderParentValue : undefined}
          selectedParentLabel={uploaderMode === 'singleParent' ? uploaderParentLabel : undefined}
          onOptionsLoaded={handleOptionsUploaded}
          onClose={() => { setShowOptionsUploader(false); setUploaderParentValue(''); setUploaderParentLabel(''); }}
        />
      )}
    </>
  );
}
