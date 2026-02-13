// ============================================================
// FILE: apps/web/src/features/admin/StageFieldsModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import {
  X, Save, Loader2, Plus, Trash2,
  Lock, Unlock,
  Type, Hash, Calendar, List, CheckSquare, Mail, Phone, FileText,
} from 'lucide-react';
import { leadSettingsApi } from '../../api/leads.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField } from '../../api/admin.api';

// System lead fields
const SYSTEM_FIELDS = [
  { key: 'firstName', label: 'First Name', type: 'text', section: 'Basic Info' },
  { key: 'lastName', label: 'Last Name', type: 'text', section: 'Basic Info' },
  { key: 'email', label: 'Email', type: 'email', section: 'Basic Info' },
  { key: 'phone', label: 'Phone', type: 'phone', section: 'Basic Info' },
  { key: 'mobile', label: 'Mobile', type: 'phone', section: 'Basic Info' },
  { key: 'company', label: 'Company', type: 'text', section: 'Basic Info' },
  { key: 'jobTitle', label: 'Job Title', type: 'text', section: 'Basic Info' },
  { key: 'website', label: 'Website', type: 'text', section: 'Basic Info' },
  { key: 'source', label: 'Source', type: 'select', section: 'Lead Details' },
  { key: 'priorityId', label: 'Priority', type: 'select', section: 'Lead Details' },
  { key: 'ownerId', label: 'Owner', type: 'select', section: 'Lead Details' },
  { key: 'addressLine1', label: 'Address Line 1', type: 'text', section: 'Address' },
  { key: 'city', label: 'City', type: 'text', section: 'Address' },
  { key: 'state', label: 'State', type: 'text', section: 'Address' },
  { key: 'postalCode', label: 'Postal Code', type: 'text', section: 'Address' },
  { key: 'country', label: 'Country', type: 'text', section: 'Address' },
  { key: 'qualification.budget', label: 'Budget (BANT)', type: 'text', section: 'Qualification' },
  { key: 'qualification.authority', label: 'Authority (BANT)', type: 'text', section: 'Qualification' },
  { key: 'qualification.need', label: 'Need (BANT)', type: 'text', section: 'Qualification' },
  { key: 'qualification.timeline', label: 'Timeline (BANT)', type: 'text', section: 'Qualification' },
];

const FIELD_TYPE_ICONS: Record<string, typeof Type> = {
  text: Type, textarea: FileText, email: Mail, phone: Phone,
  number: Hash, date: Calendar, select: List, multi_select: List,
  checkbox: CheckSquare, url: Type, file: FileText,
};

interface StageField {
  fieldKey: string;
  fieldLabel: string;
  isRequired: boolean;
  displayOrder: number;
}

interface StageFieldsModalProps {
  isOpen: boolean;
  stage: {
    id: string;
    name: string;
    color: string;
    lockPreviousFields?: boolean;
  } | null;
  onClose: () => void;
  onSave: (stageId: string, fields: StageField[], lockPreviousFields: boolean) => Promise<void>;
}

export function StageFieldsModal({ isOpen, stage, onClose, onSave }: StageFieldsModalProps) {
  const [fields, setFields] = useState<StageField[]>([]);
  const [allAvailable, setAllAvailable] = useState<{ key: string; label: string; type: string; section: string }[]>([]);
  const [lockPrevious, setLockPrevious] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  // Load stage fields + custom field definitions
  useEffect(() => {
    if (isOpen && stage) {
      loadData();
      setLockPrevious(stage.lockPreviousFields || false);
      setSearchQuery('');
      setShowPicker(false);
    }
  }, [isOpen, stage?.id]);

  const loadData = async () => {
    if (!stage) return;
    setLoading(true);
    try {
      const [stageFieldsData, customFieldsData] = await Promise.all([
        leadSettingsApi.getStageFields(stage.id),
        adminApi.getCustomFields('leads'),
      ]);

      setFields(Array.isArray(stageFieldsData) ? stageFieldsData : []);

      // Merge system + custom fields into available list
      const customEntries = customFieldsData
        .filter((f: CustomField) => f.isActive)
        .map((f: CustomField) => ({
          key: `custom.${f.fieldKey}`,
          label: f.fieldLabel,
          type: f.fieldType,
          section: 'Custom Fields',
        }));

      setAllAvailable([...SYSTEM_FIELDS, ...customEntries]);
    } catch (err) {
      console.error('Failed to load stage fields:', err);
      setFields([]);
      setAllAvailable(SYSTEM_FIELDS);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (key: string) => {
    const meta = allAvailable.find(f => f.key === key);
    if (!meta || fields.some(f => f.fieldKey === key)) return;
    setFields(prev => [...prev, {
      fieldKey: key,
      fieldLabel: meta.label,
      isRequired: true,
      displayOrder: prev.length + 1,
    }]);
    setShowPicker(false);
    setSearchQuery('');
  };

  const handleRemove = (fieldKey: string) => {
    setFields(prev => prev.filter(f => f.fieldKey !== fieldKey).map((f, i) => ({ ...f, displayOrder: i + 1 })));
  };

  const toggleRequired = (fieldKey: string) => {
    setFields(prev => prev.map(f => f.fieldKey === fieldKey ? { ...f, isRequired: !f.isRequired } : f));
  };

  const handleSave = async () => {
    if (!stage) return;
    setSaving(true);
    try {
      await onSave(stage.id, fields, lockPrevious);
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  // Available to add (not already selected)
  const selectedKeys = new Set(fields.map(f => f.fieldKey));
  const filteredAvailable = allAvailable.filter(f =>
    !selectedKeys.has(f.key) &&
    (searchQuery === '' || f.label.toLowerCase().includes(searchQuery.toLowerCase()) || f.key.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group by section
  const grouped: Record<string, typeof filteredAvailable> = {};
  filteredAvailable.forEach(f => {
    if (!grouped[f.section]) grouped[f.section] = [];
    grouped[f.section].push(f);
  });

  if (!isOpen || !stage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: 'min(600px, 80vh)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || '#6366f1' }} />
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {stage.name} — Fields
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Required fields before entering this stage</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Lock toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2.5">
              {lockPrevious ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-gray-400" />}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Lock previous stage fields</p>
                <p className="text-xs text-gray-400">Fields from earlier stages become read-only</p>
              </div>
            </div>
            <button
              onClick={() => setLockPrevious(!lockPrevious)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lockPrevious ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${lockPrevious ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {/* Selected fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Required Fields
                {fields.length > 0 && <span className="text-gray-400 font-normal ml-1">({fields.length})</span>}
              </h3>
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
            ) : fields.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                <p className="text-sm text-gray-400">No required fields</p>
                <p className="text-xs text-gray-400 mt-0.5">Leads can enter freely</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {fields.sort((a, b) => a.displayOrder - b.displayOrder).map((field) => {
                  const meta = allAvailable.find(f => f.key === field.fieldKey);
                  const Icon = FIELD_TYPE_ICONS[meta?.type || 'text'] || Type;
                  return (
                    <div key={field.fieldKey} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg group hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{field.fieldLabel}</p>
                        <p className="text-[10px] text-gray-400 truncate">{meta?.section}</p>
                      </div>
                      <button
                        onClick={() => toggleRequired(field.fieldKey)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                          field.isRequired
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                        }`}
                      >
                        {field.isRequired ? 'Required' : 'Optional'}
                      </button>
                      <button
                        onClick={() => handleRemove(field.fieldKey)}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Field picker */}
          {showPicker && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1.5">
                {Object.keys(grouped).length === 0 ? (
                  <p className="text-center py-3 text-sm text-gray-400">
                    {searchQuery ? 'No matching fields' : 'All fields added'}
                  </p>
                ) : (
                  Object.entries(grouped).map(([section, sFields]) => (
                    <div key={section} className="mb-1">
                      <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{section}</p>
                      {sFields.map(f => {
                        const Icon = FIELD_TYPE_ICONS[f.type] || Type;
                        return (
                          <button
                            key={f.key}
                            onClick={() => handleAddField(f.key)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Icon className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{f.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
          <span className="text-xs text-gray-400">
            {fields.filter(f => f.isRequired).length} required · {fields.filter(f => !f.isRequired).length} optional
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}