import { useState, useEffect } from 'react';
import { 
  Save, Loader2, AlertCircle, Users, Building2, Target, Briefcase,
  ToggleLeft, ToggleRight, Info, ListPlus
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import type { ProfileCompletionConfig, CustomField } from '../../api/admin.api';

const MODULE_OPTIONS = [
  { value: 'contacts', label: 'Contacts', icon: Users },
  { value: 'accounts', label: 'Accounts', icon: Building2 },
  { value: 'leads', label: 'Leads', icon: Target },
  { value: 'opportunities', label: 'Opportunities', icon: Briefcase },
];

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic Information',
  contact: 'Contact Details',
  location: 'Location',
  social: 'Social Profiles',
  other: 'Other',
  custom: 'Custom Fields',
};

export function ProfileCompletionPage() {
  const [selectedModule, setSelectedModule] = useState('contacts');
  const [config, setConfig] = useState<ProfileCompletionConfig | null>(null);
  const [_standardFields, setStandardFields] = useState<Record<string, { weight: number; label: string; category?: string }>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadConfig();
  }, [selectedModule]);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const [configData, fieldsData] = await Promise.all([
        adminApi.getProfileCompletionConfig(selectedModule),
        adminApi.getCustomFields(selectedModule),
      ]);
      setConfig(configData.config);
      setStandardFields(configData.standardFields);
      setCustomFields(fieldsData.filter(f => f.isActive));
    } catch (err) {
      setError('Failed to load profile completion config');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = () => {
    if (config) {
      setConfig({ ...config, isEnabled: !config.isEnabled });
    }
  };

  const handleWeightChange = (fieldKey: string, weight: number) => {
    if (config) {
      setConfig({
        ...config,
        fieldWeights: {
          ...config.fieldWeights,
          [fieldKey]: {
            ...config.fieldWeights[fieldKey],
            weight: Math.max(0, Math.min(100, weight)),
          },
        },
      });
    }
  };

  const handleCustomFieldWeightChange = async (field: CustomField, weight: number) => {
    try {
      await adminApi.updateCustomField(field.id, {
        completionWeight: Math.max(0, Math.min(100, weight)),
      });
      setCustomFields(prev => prev.map(f => 
        f.id === field.id ? { ...f, completionWeight: weight } : f
      ));
    } catch (err) {
      setError('Failed to update custom field weight');
    }
  };

  const handleCustomFieldToggleCompletion = async (field: CustomField) => {
    try {
      await adminApi.updateCustomField(field.id, {
        includeInCompletion: !field.includeInCompletion,
      });
      setCustomFields(prev => prev.map(f => 
        f.id === field.id ? { ...f, includeInCompletion: !f.includeInCompletion } : f
      ));
    } catch (err) {
      setError('Failed to update custom field');
    }
  };

  const handleMinPercentageChange = (value: number) => {
    if (config) {
      setConfig({
        ...config,
        minPercentage: Math.max(0, Math.min(100, value)),
      });
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateProfileCompletionConfig(selectedModule, {
        fieldWeights: config.fieldWeights,
        isEnabled: config.isEnabled,
        minPercentage: config.minPercentage,
      });
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getTotalWeight = () => {
    if (!config) return 0;
    const standardWeight = Object.values(config.fieldWeights).reduce((sum, f) => sum + f.weight, 0);
    const customWeight = customFields
      .filter(f => f.includeInCompletion)
      .reduce((sum, f) => sum + f.completionWeight, 0);
    return standardWeight + customWeight;
  };

  // Group fields by category
  const fieldsByCategory = () => {
    if (!config) return {};
    
    const grouped: Record<string, { key: string; label: string; weight: number }[]> = {};
    
    for (const [key, field] of Object.entries(config.fieldWeights)) {
      const category = (field as { category?: string }).category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({ key, label: field.label, weight: field.weight });
    }
    
    return grouped;
  };

  const ModuleIcon = MODULE_OPTIONS.find(m => m.value === selectedModule)?.icon || Users;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Completion</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Configure which fields count towards profile completion and their weights
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
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

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : config ? (
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ModuleIcon className="w-6 h-6 text-gray-400" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Enable Profile Completion for {MODULE_OPTIONS.find(m => m.value === selectedModule)?.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Show completion percentage on detail pages
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleEnabled}
                className={`p-1 rounded-lg transition-colors ${
                  config.isEnabled
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {config.isEnabled ? (
                  <ToggleRight className="w-10 h-10" />
                ) : (
                  <ToggleLeft className="w-10 h-10" />
                )}
              </button>
            </div>
          </div>

          {config.isEnabled && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Total Weight</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{getTotalWeight()}</div>
                  <div className="text-xs text-gray-400 mt-1">points across all fields</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Custom Fields</div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {customFields.filter(f => f.includeInCompletion).length}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">included in completion</div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">Minimum Required</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.minPercentage}
                      onChange={(e) => handleMinPercentageChange(parseInt(e.target.value) || 0)}
                      className="w-20 text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-200 dark:border-slate-700 focus:border-purple-500 focus:outline-none"
                    />
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">%</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">How weights work</p>
                  <p className="text-blue-600 dark:text-blue-400">
                    Each field has a weight that determines its importance. The completion percentage is calculated as:
                    (sum of filled field weights / total weight) × 100. Set a field's weight to 0 to exclude it from the calculation.
                  </p>
                </div>
              </div>

              {/* Standard Field Weights by Category */}
              {Object.entries(fieldsByCategory()).map(([category, fields]) => (
                <div key={category} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {CATEGORY_LABELS[category] || category}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {fields.map((field) => (
                      <div key={field.key} className="px-6 py-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{field.label}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">{field.key}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={field.weight}
                            onChange={(e) => handleWeightChange(field.key, parseInt(e.target.value))}
                            className="w-32 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={field.weight}
                            onChange={(e) => handleWeightChange(field.key, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <span className="text-sm text-gray-400 w-8">pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Custom Fields Section */}
              {customFields.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center gap-2">
                    <ListPlus className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Custom Fields
                    </h3>
                    <span className="ml-auto text-sm text-gray-500 dark:text-slate-400">
                      {customFields.filter(f => f.includeInCompletion).length} of {customFields.length} included
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {customFields.map((field) => (
                      <div key={field.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCustomFieldToggleCompletion(field)}
                            className={`p-1 rounded-lg transition-colors ${
                              field.includeInCompletion
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {field.includeInCompletion ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6" />
                            )}
                          </button>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{field.fieldLabel}</div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              {field.fieldKey} • {field.fieldType}
                            </div>
                          </div>
                        </div>
                        {field.includeInCompletion && (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={field.completionWeight}
                              onChange={(e) => handleCustomFieldWeightChange(field, parseInt(e.target.value))}
                              className="w-32 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={field.completionWeight}
                              onChange={(e) => handleCustomFieldWeightChange(field, parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <span className="text-sm text-gray-400 w-8">pts</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customFields.length === 0 && (
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 p-8 text-center">
                  <ListPlus className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400 mb-2">No custom fields yet</p>
                  <p className="text-sm text-gray-500 dark:text-slate-500">
                    Custom fields you create will appear here for weight configuration
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}