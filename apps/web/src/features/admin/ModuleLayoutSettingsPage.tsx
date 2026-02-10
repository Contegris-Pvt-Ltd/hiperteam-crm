/**
 * MODULE LAYOUT SETTINGS PAGE
 * 
 * Admin page to enable/disable custom layouts for each module and view.
 * Located at: /admin/module-layouts
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Users, Building2, Target, Briefcase, 
  Eye, Pencil, Plus, LayoutTemplate,
  Loader2, ExternalLink
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import type { ModuleLayoutSetting } from '../../api/admin.api';
import { pageLayoutApi } from '../../api/page-layout.api';
import type { PageLayout } from '../../api/page-layout.api';

const MODULES = [
  { id: 'contacts', name: 'Contacts', icon: Users },
  { id: 'accounts', name: 'Accounts', icon: Building2 },
  { id: 'leads', name: 'Leads', icon: Target },
  { id: 'opportunities', name: 'Opportunities', icon: Briefcase },
] as const;

type LayoutTypeId = 'detail' | 'edit' | 'create';

const LAYOUT_TYPES: { id: LayoutTypeId; name: string; icon: typeof Eye }[] = [
  { id: 'detail', name: 'Detail View', icon: Eye },
  { id: 'edit', name: 'Edit Form', icon: Pencil },
  { id: 'create', name: 'Create Form', icon: Plus },
];

export function ModuleLayoutSettingsPage() {
  const [settings, setSettings] = useState<ModuleLayoutSetting[]>([]);
  const [availableLayouts, setAvailableLayouts] = useState<Record<string, PageLayout[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all settings
      const settingsData = await adminApi.getModuleLayoutSettings();
      setSettings(settingsData);

      // Load available layouts for each module/type
      const layoutsMap: Record<string, PageLayout[]> = {};
      for (const mod of MODULES) {
        for (const type of LAYOUT_TYPES) {
          const key = `${mod.id}-${type.id}`;
          const layouts = await pageLayoutApi.getLayouts(mod.id, type.id);
          layoutsMap[key] = layouts;
        }
      }
      setAvailableLayouts(layoutsMap);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSetting = (module: string, layoutType: string): ModuleLayoutSetting | undefined => {
    return settings.find(s => s.module === module && s.layoutType === layoutType);
  };

  const getLayouts = (module: string, layoutType: string): PageLayout[] => {
    return availableLayouts[`${module}-${layoutType}`] || [];
  };

  const handleToggle = async (module: string, layoutType: string, enabled: boolean) => {
    const key = `${module}-${layoutType}`;
    setSaving(key);
    try {
      const layouts = getLayouts(module, layoutType);
      const layoutId = enabled && layouts.length > 0 ? layouts[0].id : undefined;
      
      const updated = await adminApi.updateModuleLayoutSetting(module, layoutType, enabled, layoutId);
      
      setSettings(prev => {
        const filtered = prev.filter(s => !(s.module === module && s.layoutType === layoutType));
        return [...filtered, updated];
      });
    } catch (err) {
      console.error('Failed to update setting:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleLayoutChange = async (module: string, layoutType: string, layoutId: string) => {
    const key = `${module}-${layoutType}`;
    setSaving(key);
    try {
      const updated = await adminApi.updateModuleLayoutSetting(module, layoutType, true, layoutId);
      
      setSettings(prev => {
        const filtered = prev.filter(s => !(s.module === module && s.layoutType === layoutType));
        return [...filtered, updated];
      });
    } catch (err) {
      console.error('Failed to update layout:', err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

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
          <LayoutTemplate className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Module Layout Settings
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
              Enable custom layouts for each module and view
            </p>
          </div>
        </div>
      </div>

      {/* Settings Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Module
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                View
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                Use Custom Layout
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Selected Layout
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {MODULES.map(mod => (
              LAYOUT_TYPES.map((type, typeIdx) => {
                const setting = getSetting(mod.id, type.id);
                const layouts = getLayouts(mod.id, type.id);
                const isEnabled = setting?.useCustomLayout || false;
                const selectedLayoutId = setting?.layoutId;
                const key = `${mod.id}-${type.id}`;
                const isSaving = saving === key;
                const ModIcon = mod.icon;
                const TypeIcon = type.icon;

                return (
                  <tr key={key} className={typeIdx === 0 ? 'border-t-2 border-gray-300 dark:border-slate-600' : ''}>
                    {/* Module */}
                    <td className="px-4 py-3">
                      {typeIdx === 0 && (
                        <div className="flex items-center gap-2">
                          <ModIcon className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {mod.name}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* View Type */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700 dark:text-slate-300">
                          {type.name}
                        </span>
                      </div>
                    </td>

                    {/* Toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(mod.id, type.id, !isEnabled)}
                        disabled={isSaving || layouts.length === 0}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isEnabled 
                            ? 'bg-indigo-600' 
                            : 'bg-gray-300 dark:bg-slate-600'
                        } ${layouts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      {layouts.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No layouts created</p>
                      )}
                    </td>

                    {/* Layout Selection */}
                    <td className="px-4 py-3">
                      {isEnabled && layouts.length > 0 ? (
                        <select
                          value={selectedLayoutId || ''}
                          onChange={(e) => handleLayoutChange(mod.id, type.id, e.target.value)}
                          disabled={isSaving}
                          className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                        >
                          {layouts.map(layout => (
                            <option key={layout.id} value={layout.id}>
                              {layout.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-500 dark:text-slate-400 text-sm">
                          {isEnabled ? 'No layouts available' : 'Using default view'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isSaving && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        <Link
                          to={`/admin/page-designer?module=${mod.id}&layoutType=${type.id}`}
                          className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Design
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How it works
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <li>• <strong>Default View</strong>: Uses the standard hardcoded layout</li>
          <li>• <strong>Custom Layout</strong>: Uses the layout you designed in Page Designer</li>
          <li>• Click "Design" to create or edit layouts in Page Designer</li>
          <li>• Changes apply to all users immediately</li>
        </ul>
      </div>
    </div>
  );
}