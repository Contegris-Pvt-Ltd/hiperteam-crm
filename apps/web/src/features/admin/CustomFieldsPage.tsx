import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, Pencil, Trash2, GripVertical, ToggleLeft, ToggleRight, 
  Users, Building2, Target, Briefcase, AlertCircle, Loader2,
  Type, Hash, Calendar, List, CheckSquare, FileText, Link, Mail, Phone, Upload, Link2,
  LayoutGrid, Folder, Columns
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';  // Add CustomTab, CustomFieldGroup
import { OptionsUploader } from '../../components/shared/OptionsUploader';

const SECTION_OPTIONS = [
  { value: 'basic', label: 'Basic Info' },
  { value: 'contact', label: 'Contact Details' },
  { value: 'address', label: 'Address' },
  { value: 'social', label: 'Social Profiles' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom Fields Tab' },
];

const MODULE_OPTIONS = [
  { value: 'contacts', label: 'Contacts', icon: Users },
  { value: 'accounts', label: 'Accounts', icon: Building2 },
  { value: 'leads', label: 'Leads', icon: Target },
  { value: 'opportunities', label: 'Opportunities', icon: Briefcase },
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

const getFieldTypeIcon = (type: string) => {
  const fieldType = FIELD_TYPES.find(f => f.value === type);
  return fieldType?.icon || Type;
};

export function CustomFieldsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || 'contacts');
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [saving, setSaving] = useState(false);
  const [showOptionsUploader, setShowOptionsUploader] = useState(false);
  const [uploaderMode, setUploaderMode] = useState<'simple' | 'conditional' | 'singleParent'>('simple');
  const [uploaderParentValue, setUploaderParentValue] = useState<string>('');
  const [uploaderParentLabel, setUploaderParentLabel] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    fieldKey: '',
    fieldLabel: '',
    fieldType: 'text' as CustomField['fieldType'],
    fieldOptions: [] as { label: string; value: string }[],
    isRequired: false,
    defaultValue: '',
    placeholder: '',
    helpText: '',
    section: 'custom',
    includeInCompletion: true,
    completionWeight: 1,
    // New fields for dependencies
    dependsOnFieldId: '' as string,
    conditionalOptions: {} as Record<string, { label: string; value: string }[]>,
    tabId: '' as string,
    groupId: '' as string,
    columnSpan: 1 as number,
  });

  useEffect(() => {
    loadFields();
  }, [selectedModule]);

  useEffect(() => {
    setSearchParams({ module: selectedModule });
  }, [selectedModule, setSearchParams]);

  const loadFields = async () => {
    setLoading(true);
    setError('');
    try {
      const [fieldsData, tabsData, groupsData] = await Promise.all([
        adminApi.getCustomFields(selectedModule),
        adminApi.getTabs(selectedModule),
        adminApi.getGroups({ module: selectedModule }),
      ]);
      setFields(fieldsData);
      setTabs(tabsData);
      setGroups(groupsData);
    } catch (err) {
      setError('Failed to load custom fields');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingField(null);
    setFormData({
      fieldKey: '',
      fieldLabel: '',
      fieldType: 'text',
      fieldOptions: [],
      isRequired: false,
      defaultValue: '',
      placeholder: '',
      helpText: '',
      section: 'custom',
      includeInCompletion: true,
      completionWeight: 1,
      dependsOnFieldId: '',
      conditionalOptions: {},
      tabId: '',
      groupId: '',
      columnSpan: 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldOptions: field.fieldOptions || [],
      isRequired: field.isRequired,
      defaultValue: field.defaultValue || '',
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      section: field.section || 'custom',
      includeInCompletion: field.includeInCompletion,
      completionWeight: field.completionWeight,
      dependsOnFieldId: field.dependsOnFieldId || '',
      conditionalOptions: field.conditionalOptions || {},
      tabId: field.tabId || '',
      groupId: field.groupId || '',
      columnSpan: field.columnSpan || 1,
    });
    setIsModalOpen(true);
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
        // New layout fields - use null instead of undefined to explicitly clear values
        tabId: formData.tabId || null,
        groupId: formData.groupId || null,
        section: formData.tabId ? 'custom' : formData.section,
        columnSpan: formData.columnSpan,
      };

      if (editingField) {
        await adminApi.updateCustomField(editingField.id, dataToSave);
      } else {
        await adminApi.createCustomField({
          ...dataToSave,
          module: selectedModule,
        });
      }
      setIsModalOpen(false);
      loadFields();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save custom field');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (field: CustomField) => {
    try {
      await adminApi.toggleCustomField(field.id);
      setFields(prev => prev.map(f => 
        f.id === field.id ? { ...f, isActive: !f.isActive } : f
      ));
    } catch (err) {
      setError('Failed to toggle field');
    }
  };

  const handleDelete = async (field: CustomField) => {
    if (!confirm(`Are you sure you want to delete "${field.fieldLabel}"? This cannot be undone.`)) {
      return;
    }

    try {
      await adminApi.deleteCustomField(field.id);
      setFields(prev => prev.filter(f => f.id !== field.id));
    } catch (err) {
      setError('Failed to delete field');
    }
  };

  // Open bulk upload for regular options
  const openSimpleUploader = () => {
    setUploaderMode('simple');
    setShowOptionsUploader(true);
  };

  // Open bulk upload for conditional options
  const openConditionalUploader = () => {
    setUploaderMode('conditional');
    setShowOptionsUploader(true);
  };

  // Open bulk upload for a specific parent value
  const openSingleParentUploader = (parentValue: string, parentLabel: string) => {
    setUploaderMode('singleParent');
    setUploaderParentValue(parentValue);
    setUploaderParentLabel(parentLabel);
    setShowOptionsUploader(true);
  };

  // Handle uploaded options
  const handleOptionsUploaded = (options: { label: string; value: string }[] | Record<string, { label: string; value: string }[]>) => {
    if (uploaderMode === 'simple') {
        // Merge with existing options
        const newOptions = options as { label: string; value: string }[];
        setFormData(prev => ({
        ...prev,
        fieldOptions: [...prev.fieldOptions, ...newOptions],
        }));
    } else {
        // Merge with existing conditional options (works for both 'conditional' and 'singleParent')
        const newConditional = options as Record<string, { label: string; value: string }[]>;
        setFormData(prev => {
        const merged = { ...prev.conditionalOptions };
        Object.entries(newConditional).forEach(([parentValue, opts]) => {
            if (!merged[parentValue]) {
            merged[parentValue] = [];
            }
            merged[parentValue] = [...merged[parentValue], ...opts];
        });
        return {
            ...prev,
            conditionalOptions: merged,
        };
        });
    }
    setShowOptionsUploader(false);
    setUploaderParentValue('');
    setUploaderParentLabel('');
  };

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  };

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

  // Get fields that can be parent (select/multi_select fields, excluding current field and its children)
  const getAvailableParentFields = () => {
    return fields.filter(f => 
        (f.fieldType === 'select' || f.fieldType === 'multi_select') && 
        f.id !== editingField?.id &&
        f.dependsOnFieldId !== editingField?.id // Prevent circular
    );
  };

  // Get parent field options (handles both regular and dependent fields)
  const getParentFieldOptions = (): { label: string; value: string }[] => {
    const parentField = fields.find(f => f.id === formData.dependsOnFieldId);
    if (!parentField) return [];

    // If parent has regular options, use those
    if (parentField.fieldOptions && parentField.fieldOptions.length > 0) {
        return parentField.fieldOptions;
    }

    // If parent is itself a dependent field, gather all options from conditionalOptions
    if (parentField.conditionalOptions) {
        const allOptions: { label: string; value: string }[] = [];
        const seenValues = new Set<string>();

        Object.values(parentField.conditionalOptions).forEach(options => {
        options.forEach(opt => {
            if (!seenValues.has(opt.value)) {
            seenValues.add(opt.value);
            allOptions.push(opt);
            }
        });
        });

        return allOptions;
    }

    return [];
  };

  // Add conditional option for a parent value
  const addConditionalOption = (parentValue: string) => {
    setFormData(prev => ({
        ...prev,
        conditionalOptions: {
        ...prev.conditionalOptions,
        [parentValue]: [...(prev.conditionalOptions[parentValue] || []), { label: '', value: '' }],
        },
    }));
  };

  // Update conditional option
  const updateConditionalOption = (
    parentValue: string, 
    index: number, 
    key: 'label' | 'value', 
    value: string
    ) => {
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

  // Remove conditional option
  const removeConditionalOption = (parentValue: string, index: number) => {
    setFormData(prev => ({
        ...prev,
        conditionalOptions: {
        ...prev.conditionalOptions,
        [parentValue]: prev.conditionalOptions[parentValue].filter((_, i) => i !== index),
        },
    }));
  };

  // Clear dependency
  const clearDependency = () => {
    setFormData(prev => ({
        ...prev,
        dependsOnFieldId: '',
        conditionalOptions: {},
        fieldOptions: [], // Clear regular options when switching to dependent
    }));
  };

  const ModuleIcon = MODULE_OPTIONS.find(m => m.value === selectedModule)?.icon || Users;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Custom Fields</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Add custom fields to capture additional data for each module
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Field
        </button>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2 mb-6">
        {MODULE_OPTIONS.map((module) => (
          <button
            key={module.value}
            onClick={() => setSelectedModule(module.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              selectedModule === module.value
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <module.icon className="w-4 h-4" />
            {module.label}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Fields List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : fields.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-12 text-center">
          <ModuleIcon className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No custom fields yet
          </h3>
          <p className="text-gray-500 dark:text-slate-400 mb-4">
            Add custom fields to capture additional data for {selectedModule}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add First Field
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Field
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Placement
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Depends On
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Key
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Required
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Weight
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    Active
                    </th>
                    <th className="w-24 px-4 py-3"></th>
                </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const FieldTypeIcon = getFieldTypeIcon(field.fieldType);
                return (
                  <tr 
                    key={field.id}
                    className="border-b border-gray-100 dark:border-slate-800 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {field.fieldLabel}
                      </div>
                      {field.helpText && (
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {field.helpText}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                        <FieldTypeIcon className="w-4 h-4" />
                        {FIELD_TYPES.find(t => t.value === field.fieldType)?.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {field.tab?.name || SECTION_OPTIONS.find(s => s.value === field.section)?.label || field.section}
                    {field.group && <span className="text-xs ml-1">({field.group.name})</span>}
                    </td>
                    <td className="px-4 py-3">
                        {field.dependsOnField ? (
                            <div className="flex items-center gap-1.5 text-sm">
                            <Link2 className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-purple-600 dark:text-purple-400">
                                {field.dependsOnField.fieldLabel}
                            </span>
                            </div>
                        ) : (
                            <span className="text-gray-400 dark:text-slate-600">—</span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {field.fieldKey}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {field.isRequired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          Required
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {field.includeInCompletion && (
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {field.completionWeight}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(field)}
                        className={`p-1 rounded-lg transition-colors ${
                          field.isActive
                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {field.isActive ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(field)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(field)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                {/* Field Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Field Label *
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Field Key *
                  </label>
                  <input
                    type="text"
                    value={formData.fieldKey}
                    onChange={(e) => setFormData({ ...formData, fieldKey: e.target.value })}
                    placeholder="e.g., department"
                    disabled={!!editingField}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Unique identifier (auto-generated from label)
                  </p>
                </div>

                {/* Field Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Field Type
                  </label>
                  <select
                    value={formData.fieldType}
                    onChange={(e) => setFormData({ ...formData, fieldType: e.target.value as CustomField['fieldType'] })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field Placement Section */}
                <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <LayoutGrid className="w-4 h-4 text-purple-600" />
                    <h4 className="font-medium text-gray-900 dark:text-white">Field Placement</h4>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
                    Choose where this field appears in the form
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Section or Tab */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Display In
                      </label>
                      <select
                        value={formData.tabId ? `tab:${formData.tabId}` : formData.section}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.startsWith('tab:')) {
                            setFormData(prev => ({
                              ...prev,
                              tabId: value.replace('tab:', ''),
                              section: 'custom',
                              groupId: '', // Clear group when changing tab
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              section: value,
                              tabId: '',
                              groupId: '', // Clear group when changing section
                            }));
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

                    {/* Group */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Group (Optional)
                      </label>
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
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Groups organize fields visually
                      </p>
                    </div>
                  </div>

                  {/* Column Span */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Field Width
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="columnSpan"
                          value={1}
                          checked={formData.columnSpan === 1}
                          onChange={() => setFormData(prev => ({ ...prev, columnSpan: 1 }))}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <Columns className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-slate-300">Half Width</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="columnSpan"
                          value={2}
                          checked={formData.columnSpan === 2}
                          onChange={() => setFormData(prev => ({ ...prev, columnSpan: 2 }))}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                        Options
                    </label>
                    <button
                        type="button"
                        onClick={openSimpleUploader}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                    >
                        <Upload className="w-3 h-3" /> Bulk Upload
                    </button>
                    </div>
                    <div className="space-y-2">
                    {formData.fieldOptions.map((option, index) => (
                        <div key={index} className="flex gap-2">
                        <input
                            type="text"
                            value={option.label}
                            onChange={(e) => updateOption(index, 'label', e.target.value)}
                            placeholder="Label"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <input
                            type="text"
                            value={option.value}
                            onChange={(e) => updateOption(index, 'value', e.target.value)}
                            placeholder="Value"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addOption}
                        className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" /> Add option
                    </button>
                    </div>
                    {formData.fieldOptions.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                        {formData.fieldOptions.length} option{formData.fieldOptions.length !== 1 ? 's' : ''} defined
                    </p>
                    )}
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
                    
                    {/* Parent Field Selection */}
                    <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Depends On
                    </label>
                    {getAvailableParentFields().length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-slate-500 italic">
                        No dropdown fields available to link to. Create a dropdown field first.
                        </p>
                    ) : (
                        <div className="flex gap-2">
                        <select
                            value={formData.dependsOnFieldId}
                            onChange={(e) => {
                                const newParentId = e.target.value;
                                if (newParentId) {
                                    // Get parent field and its options
                                    const parentField = fields.find(f => f.id === newParentId);
                                    
                                    // Gather all options - either from fieldOptions or conditionalOptions
                                    let parentOptions: { label: string; value: string }[] = [];
                                    
                                    if (parentField?.fieldOptions && parentField.fieldOptions.length > 0) {
                                    parentOptions = parentField.fieldOptions;
                                    } else if (parentField?.conditionalOptions) {
                                    // Gather unique options from all conditional options
                                    const seenValues = new Set<string>();
                                    Object.values(parentField.conditionalOptions).forEach(options => {
                                        options.forEach(opt => {
                                        if (!seenValues.has(opt.value)) {
                                            seenValues.add(opt.value);
                                            parentOptions.push(opt);
                                        }
                                        });
                                    });
                                    }

                                    // Initialize conditional options for each parent option
                                    const initialConditional: Record<string, { label: string; value: string }[]> = {};
                                    parentOptions.forEach(opt => {
                                    initialConditional[opt.value] = [];
                                    });
                                    
                                    setFormData(prev => ({
                                    ...prev,
                                    dependsOnFieldId: newParentId,
                                    conditionalOptions: initialConditional,
                                    fieldOptions: [], // Clear regular options
                                    }));
                                } else {
                                    clearDependency();
                                }
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="">None (Independent field)</option>
                            {getAvailableParentFields().map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.fieldLabel} ({f.fieldKey})
                            </option>
                            ))}
                        </select>
                        {formData.dependsOnFieldId && (
                            <button
                            type="button"
                            onClick={clearDependency}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                            >
                            Clear
                            </button>
                        )}
                        </div>
                    )}
                    </div>

                    {/* Conditional Options Configuration */}
                    {formData.dependsOnFieldId && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                            Configure options for each parent value:
                        </p>
                        <button
                            type="button"
                            onClick={openConditionalUploader}
                            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                        >
                            <Upload className="w-3 h-3" /> Bulk Upload All
                        </button>
                        </div>
                        {getParentFieldOptions().map((parentOption) => (
                        <div 
                            key={parentOption.value} 
                            className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                When "{parentOption.label}" is selected:
                            </span>
                            <button
                                type="button"
                                onClick={() => openSingleParentUploader(parentOption.value, parentOption.label)}
                                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                            >
                                <Upload className="w-3 h-3" /> Bulk upload
                            </button>
                            </div>
                            <div className="space-y-2 ml-4">
                            {(formData.conditionalOptions[parentOption.value] || []).map((opt, index) => (
                                <div key={index} className="flex gap-2">
                                <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => updateConditionalOption(parentOption.value, index, 'label', e.target.value)}
                                    placeholder="Label"
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                                <input
                                    type="text"
                                    value={opt.value}
                                    onChange={(e) => updateConditionalOption(parentOption.value, index, 'value', e.target.value)}
                                    placeholder="Value"
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeConditionalOption(parentOption.value, index)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addConditionalOption(parentOption.value)}
                                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" /> Add option
                            </button>
                            </div>
                            {(formData.conditionalOptions[parentOption.value] || []).length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 ml-4">
                                {formData.conditionalOptions[parentOption.value].length} option{formData.conditionalOptions[parentOption.value].length !== 1 ? 's' : ''}
                            </p>
                            )}
                        </div>
                        ))}
                    </div>
                    )}
                </div>
                )}

                {/* Placeholder */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                    placeholder="e.g., Enter department name"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Help Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Help Text
                  </label>
                  <input
                    type="text"
                    value={formData.helpText}
                    onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                    placeholder="Additional instructions for this field"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                {/* Default Value */}
                <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Default Value
                </label>
                {formData.fieldType === 'checkbox' ? (
                    <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="defaultValueCheckbox"
                        checked={formData.defaultValue === 'true'}
                        onChange={(e) => setFormData({ ...formData, defaultValue: e.target.checked ? 'true' : 'false' })}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="defaultValueCheckbox" className="text-sm text-gray-700 dark:text-slate-300">
                        Checked by default
                    </label>
                    </div>
                ) : formData.fieldType === 'select' || formData.fieldType === 'multi_select' ? (
                    <select
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                    <option value="">No default</option>
                    {formData.fieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                        {opt.label}
                        </option>
                    ))}
                    </select>
                ) : formData.fieldType === 'date' ? (
                    <input
                    type="date"
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                ) : formData.fieldType === 'number' ? (
                    <input
                    type="number"
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder="Enter default number"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                ) : formData.fieldType === 'textarea' ? (
                    <textarea
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder="Enter default text"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                ) : formData.fieldType === 'file' ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 italic">
                    File fields cannot have a default value
                    </p>
                ) : (
                    <input
                    type={formData.fieldType === 'email' ? 'email' : formData.fieldType === 'url' ? 'url' : 'text'}
                    value={formData.defaultValue}
                    onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                    placeholder={`Enter default ${formData.fieldType}`}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                )}
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Value to pre-fill when creating new records
                </p>
                </div>

                {/* Required checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={formData.isRequired}
                    onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="isRequired" className="text-sm text-gray-700 dark:text-slate-300">
                    This field is required
                  </label>
                </div>

                {/* Include in completion */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeInCompletion"
                    checked={formData.includeInCompletion}
                    onChange={(e) => setFormData({ ...formData, includeInCompletion: e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="includeInCompletion" className="text-sm text-gray-700 dark:text-slate-300">
                    Include in profile completion
                  </label>
                </div>

                {/* Completion Weight */}
                {formData.includeInCompletion && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Completion Weight
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.completionWeight}
                      onChange={(e) => setFormData({ ...formData, completionWeight: parseInt(e.target.value) || 1 })}
                      className="w-24 px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Higher weight = more important for profile completion
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingField ? 'Save Changes' : 'Create Field'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Options Uploader Modal */}
      {showOptionsUploader && (
        <OptionsUploader
            mode={uploaderMode}
            parentOptions={uploaderMode === 'conditional' ? getParentFieldOptions() : undefined}
            selectedParentValue={uploaderMode === 'singleParent' ? uploaderParentValue : undefined}
            selectedParentLabel={uploaderMode === 'singleParent' ? uploaderParentLabel : undefined}
            onOptionsLoaded={handleOptionsUploaded}
            onClose={() => {
            setShowOptionsUploader(false);
            setUploaderParentValue('');
            setUploaderParentLabel('');
            }}
        />
      )}
    </div>
  );
}