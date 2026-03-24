// ============================================================
// FILE: apps/web/src/features/admin/FormFieldOrderPage.tsx
// Form Builder — organize tabs, reorder fields, toggle visibility.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GripVertical, Eye, EyeOff, Save, Loader2, RotateCcw,
  ChevronDown, ChevronRight, Check, Pencil, X, Plus,
  Trash2, ToggleLeft, ToggleRight, Puzzle,
} from 'lucide-react';
import { moduleSettingsApi } from '../../api/module-settings.api';
import type { FormFieldOrderConfig } from '../../api/module-settings.api';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';
import { CustomFieldModal } from '../../components/shared/CustomFieldModal';

// ── Module definitions: which standard fields live in which tab ──

interface FieldDef {
  key: string;
  label: string;
}

interface TabDef {
  id: string;
  label: string;
  fields: FieldDef[];
}

interface ModuleDef {
  label: string;
  tabs: TabDef[];
}

const MODULE_DEFS: Record<string, ModuleDef> = {
  leads: {
    label: 'Leads',
    tabs: [
      {
        id: 'basic', label: 'Basic Info', fields: [
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'company', label: 'Company' },
          { key: 'jobTitle', label: 'Job Title' },
          { key: 'website', label: 'Website' },
          { key: 'accountId', label: 'Account' },
          { key: 'contactId', label: 'Contact' },
          { key: 'mobile', label: 'Mobile' },
        ],
      },
      {
        id: 'lead-details', label: 'Lead Details', fields: [
          { key: 'pipelineId', label: 'Pipeline' },
          { key: 'stageId', label: 'Stage' },
          { key: 'priorityId', label: 'Priority' },
          { key: 'source', label: 'Source' },
          { key: 'industry', label: 'Industry' },
          { key: 'ownerId', label: 'Owner' },
          { key: 'teamId', label: 'Team' },
        ],
      },
      {
        id: 'address', label: 'Address', fields: [
          { key: 'country', label: 'Country' },
          { key: 'addressLine1', label: 'Address Line 1' },
          { key: 'addressLine2', label: 'Address Line 2' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'postalCode', label: 'Postal Code' },
        ],
      },
      {
        id: 'communication', label: 'Communication', fields: [
          { key: 'doNotContact', label: 'Do Not Contact' },
          { key: 'doNotEmail', label: 'Do Not Email' },
          { key: 'doNotCall', label: 'Do Not Call' },
        ],
      },
      {
        id: 'other', label: 'Other', fields: [
          { key: 'tags', label: 'Tags' },
        ],
      },
    ],
  },
  contacts: {
    label: 'Contacts',
    tabs: [
      {
        id: 'basic', label: 'Basic Info', fields: [
          { key: 'firstName', label: 'First Name' },
          { key: 'lastName', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'jobTitle', label: 'Job Title' },
          { key: 'department', label: 'Department' },
          { key: 'accountId', label: 'Account' },
        ],
      },
      {
        id: 'contact', label: 'Contact Details', fields: [
          { key: 'emails', label: 'Additional Emails' },
          { key: 'phones', label: 'Additional Phones' },
          { key: 'fax', label: 'Fax' },
          { key: 'website', label: 'Website' },
        ],
      },
      {
        id: 'address', label: 'Address', fields: [
          { key: 'mailingStreet', label: 'Street' },
          { key: 'mailingCity', label: 'City' },
          { key: 'mailingState', label: 'State' },
          { key: 'mailingPostalCode', label: 'Postal Code' },
          { key: 'mailingCountry', label: 'Country' },
        ],
      },
      {
        id: 'social', label: 'Social Profiles', fields: [
          { key: 'linkedIn', label: 'LinkedIn' },
          { key: 'twitter', label: 'Twitter/X' },
          { key: 'facebook', label: 'Facebook' },
        ],
      },
      {
        id: 'other', label: 'Other', fields: [
          { key: 'source', label: 'Lead Source' },
          { key: 'description', label: 'Description' },
          { key: 'tags', label: 'Tags' },
        ],
      },
    ],
  },
  accounts: {
    label: 'Accounts',
    tabs: [
      {
        id: 'basic', label: 'Basic Info', fields: [
          { key: 'name', label: 'Account Name' },
          { key: 'classification', label: 'Classification (B2B/B2C)' },
          { key: 'industry', label: 'Industry' },
          { key: 'website', label: 'Website' },
          { key: 'accountType', label: 'Account Type' },
          { key: 'companySize', label: 'Company Size' },
          { key: 'annualRevenue', label: 'Annual Revenue' },
          { key: 'firstName', label: 'First Name (B2C)' },
          { key: 'lastName', label: 'Last Name (B2C)' },
          { key: 'dateOfBirth', label: 'Date of Birth (B2C)' },
          { key: 'gender', label: 'Gender (B2C)' },
          { key: 'nationalId', label: 'National ID (B2C)' },
        ],
      },
      {
        id: 'contact', label: 'Contact Details', fields: [
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'fax', label: 'Fax' },
          { key: 'emails', label: 'Additional Emails' },
          { key: 'phones', label: 'Additional Phones' },
        ],
      },
      {
        id: 'address', label: 'Addresses', fields: [
          { key: 'billingCountry', label: 'Billing Country' },
          { key: 'billingStreet', label: 'Billing Street' },
          { key: 'billingCity', label: 'Billing City' },
          { key: 'billingState', label: 'Billing State' },
          { key: 'billingPostalCode', label: 'Billing Postal Code' },
          { key: 'shippingCountry', label: 'Shipping Country' },
          { key: 'shippingStreet', label: 'Shipping Street' },
          { key: 'shippingCity', label: 'Shipping City' },
          { key: 'shippingState', label: 'Shipping State' },
          { key: 'shippingPostalCode', label: 'Shipping Postal Code' },
        ],
      },
      {
        id: 'social', label: 'Social', fields: [
          { key: 'linkedIn', label: 'LinkedIn' },
          { key: 'twitter', label: 'Twitter/X' },
          { key: 'facebook', label: 'Facebook' },
        ],
      },
      {
        id: 'other', label: 'Other', fields: [
          { key: 'description', label: 'Description' },
          { key: 'tags', label: 'Tags' },
        ],
      },
    ],
  },
  opportunities: {
    label: 'Opportunities',
    tabs: [
      {
        id: 'basic', label: 'Basic Info', fields: [
          { key: 'name', label: 'Opportunity Name' },
          { key: 'accountId', label: 'Account' },
          { key: 'primaryContactId', label: 'Primary Contact' },
          { key: 'pipelineId', label: 'Pipeline' },
          { key: 'stageId', label: 'Stage' },
          { key: 'priorityId', label: 'Priority' },
          { key: 'source', label: 'Source' },
          { key: 'type', label: 'Type' },
        ],
      },
      {
        id: 'deal-details', label: 'Deal Details', fields: [
          { key: 'amount', label: 'Amount' },
          { key: 'currency', label: 'Currency' },
          { key: 'probability', label: 'Probability (%)' },
          { key: 'closeDate', label: 'Close Date' },
          { key: 'forecastCategory', label: 'Forecast Category' },
          { key: 'nextStep', label: 'Next Step' },
          { key: 'competitor', label: 'Competitor' },
          { key: 'ownerId', label: 'Owner' },
          { key: 'teamId', label: 'Team' },
        ],
      },
      {
        id: 'other', label: 'Other', fields: [
          { key: 'description', label: 'Description' },
          { key: 'tags', label: 'Tags' },
        ],
      },
    ],
  },
};

const MODULES = Object.entries(MODULE_DEFS).map(([key, def]) => ({ key, label: def.label }));

// ── Drag-and-drop helpers (native HTML5 DnD) ──

interface DragItem {
  tabId: string;
  index: number;
}

export function FormFieldOrderPage() {
  const [searchParams] = useSearchParams();
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || 'leads');
  const [moduleOpen, setModuleOpen] = useState(false);
  const [config, setConfig] = useState<FormFieldOrderConfig>({ tabs: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<DragItem | null>(null);

  // Tab management
  const [collapsedTabs, setCollapsedTabs] = useState<Set<string>>(new Set());
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(new Set());
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tabRenames, setTabRenames] = useState<Record<string, string>>({});
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomFieldGroup[]>([]);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [editingCf, setEditingCf] = useState<CustomField | null>(null);
  const [cfDefaultSection, setCfDefaultSection] = useState('custom');

  const moduleDef = MODULE_DEFS[selectedModule];

  // ── Load config + custom fields ──
  const loadCustomFields = useCallback(async (mod: string) => {
    try {
      const [fieldsData, tabsData, groupsData] = await Promise.all([
        adminApi.getCustomFields(mod),
        adminApi.getTabs(mod),
        adminApi.getGroups({ module: mod }),
      ]);
      setCustomFields(fieldsData);
      setCustomTabs(tabsData);
      setCustomGroups(groupsData);
    } catch {
      setCustomFields([]);
      setCustomTabs([]);
      setCustomGroups([]);
    }
  }, []);

  const loadConfig = useCallback(async (mod: string) => {
    setLoading(true);
    try {
      const data = await moduleSettingsApi.getFormFieldOrder(mod);
      setConfig(data);

      // Restore tab state from config
      const savedMeta = (data as unknown as Record<string, unknown>)._tabMeta as { hidden?: string[]; order?: string[]; renames?: Record<string, string> } | undefined;
      if (savedMeta) {
        setHiddenTabs(new Set(savedMeta.hidden || []));
        setTabOrder(savedMeta.order || []);
        setTabRenames(savedMeta.renames || {});
      } else {
        setHiddenTabs(new Set());
        setTabOrder([]);
        setTabRenames({});
      }
    } catch {
      setConfig({ tabs: {} });
      setHiddenTabs(new Set());
      setTabOrder([]);
      setTabRenames({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig(selectedModule);
    loadCustomFields(selectedModule);
    setCollapsedTabs(new Set());
  }, [selectedModule, loadConfig, loadCustomFields]);

  useEffect(() => {
    if (renamingTab && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingTab]);

  // ── Get effective tab order ──
  const getOrderedTabs = (): TabDef[] => {
    const defaultIds = moduleDef.tabs.map(t => t.id);
    const ordered = tabOrder.length > 0
      ? [...tabOrder.filter(id => defaultIds.includes(id)), ...defaultIds.filter(id => !tabOrder.includes(id))]
      : defaultIds;
    return ordered.map(id => moduleDef.tabs.find(t => t.id === id)!).filter(Boolean);
  };

  // ── Get effective tab label ──
  const getTabLabel = (tabDef: TabDef): string => {
    return tabRenames[tabDef.id] || tabDef.label;
  };

  // ── Build effective fields list for a tab (saved order or defaults) ──
  const getTabFields = (tabDef: TabDef): { key: string; label: string; visible: boolean }[] => {
    const savedTab = config.tabs[tabDef.id];
    if (savedTab?.fields?.length) {
      const savedKeys = new Set(savedTab.fields.map(f => f.key));
      const result = savedTab.fields.map(f => {
        const def = tabDef.fields.find(d => d.key === f.key);
        return { key: f.key, label: def?.label || f.key, visible: f.visible };
      });
      for (const def of tabDef.fields) {
        if (!savedKeys.has(def.key)) result.push({ key: def.key, label: def.label, visible: true });
      }
      return result;
    }
    return tabDef.fields.map(f => ({ key: f.key, label: f.label, visible: true }));
  };

  // ── Update a tab's fields in config ──
  const updateTabFields = (tabId: string, tabLabel: string, fields: { key: string; visible: boolean }[]) => {
    setConfig(prev => ({
      ...prev,
      tabs: {
        ...prev.tabs,
        [tabId]: { label: tabLabel, fields },
      },
    }));
    setSaved(false);
  };

  // ── Toggle field visibility ──
  const toggleVisibility = (tabDef: TabDef, fieldKey: string) => {
    const fields = getTabFields(tabDef);
    const updated = fields.map(f =>
      f.key === fieldKey ? { key: f.key, visible: !f.visible } : { key: f.key, visible: f.visible }
    );
    updateTabFields(tabDef.id, getTabLabel(tabDef), updated);
  };

  // ── Toggle tab visibility ──
  const toggleTabVisibility = (tabId: string) => {
    setHiddenTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
    setSaved(false);
  };

  // ── Toggle tab collapse ──
  const toggleCollapse = (tabId: string) => {
    setCollapsedTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  // ── Tab rename ──
  const startRename = (tabId: string) => {
    setRenamingTab(tabId);
    setRenameValue(getTabLabel(moduleDef.tabs.find(t => t.id === tabId)!));
  };

  const commitRename = () => {
    if (renamingTab && renameValue.trim()) {
      const originalTab = moduleDef.tabs.find(t => t.id === renamingTab);
      if (originalTab) {
        if (renameValue.trim() === originalTab.label) {
          // Reset to default — remove rename entry
          setTabRenames(prev => {
            const next = { ...prev };
            delete next[renamingTab!];
            return next;
          });
        } else {
          setTabRenames(prev => ({ ...prev, [renamingTab!]: renameValue.trim() }));
        }
        setSaved(false);
      }
    }
    setRenamingTab(null);
  };

  // ── Tab drag handlers ──
  const handleTabDragStart = (tabId: string) => {
    setDragTabId(tabId);
  };

  const handleTabDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    setDragOverTabId(tabId);
  };

  const handleTabDrop = (dropTabId: string) => {
    if (!dragTabId || dragTabId === dropTabId) { setDragTabId(null); setDragOverTabId(null); return; }
    const currentOrder = getOrderedTabs().map(t => t.id);
    const dragIdx = currentOrder.indexOf(dragTabId);
    const dropIdx = currentOrder.indexOf(dropTabId);
    if (dragIdx < 0 || dropIdx < 0) { setDragTabId(null); setDragOverTabId(null); return; }
    const reordered = [...currentOrder];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setTabOrder(reordered);
    setSaved(false);
    setDragTabId(null);
    setDragOverTabId(null);
  };

  const handleTabDragEnd = () => {
    setDragTabId(null);
    setDragOverTabId(null);
  };

  // ── Field drag handlers ──
  const handleDragStart = (tabId: string, index: number) => {
    setDragItem({ tabId, index });
  };

  const handleDragOver = (e: React.DragEvent, tabId: string, index: number) => {
    e.preventDefault();
    setDragOverItem({ tabId, index });
  };

  const handleDrop = (tabDef: TabDef, dropIndex: number) => {
    if (!dragItem || dragItem.tabId !== tabDef.id) { setDragItem(null); setDragOverItem(null); return; }
    const fields = getTabFields(tabDef);
    const reordered = [...fields];
    const [moved] = reordered.splice(dragItem.index, 1);
    reordered.splice(dropIndex, 0, moved);
    updateTabFields(tabDef.id, getTabLabel(tabDef), reordered.map(f => ({ key: f.key, visible: f.visible })));
    setDragItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverItem(null);
  };

  // ── Custom field helpers ──
  const getCustomFieldsForTab = (tabId: string): CustomField[] => {
    return customFields.filter(f => f.isActive && f.section === tabId);
  };

  const openAddCustomField = (section: string) => {
    setEditingCf(null);
    setCfDefaultSection(section);
    setCfModalOpen(true);
  };

  const openEditCustomField = (field: CustomField) => {
    setEditingCf(field);
    setCfDefaultSection(field.section || 'custom');
    setCfModalOpen(true);
  };

  const handleToggleCustomField = async (field: CustomField) => {
    try {
      await adminApi.toggleCustomField(field.id);
      setCustomFields(prev => prev.map(f =>
        f.id === field.id ? { ...f, isActive: !f.isActive } : f
      ));
    } catch (err) {
      console.error('Failed to toggle field:', err);
    }
  };

  const handleDeleteCustomField = async (field: CustomField) => {
    if (!confirm(`Delete "${field.fieldLabel}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteCustomField(field.id);
      setCustomFields(prev => prev.filter(f => f.id !== field.id));
    } catch (err) {
      console.error('Failed to delete field:', err);
    }
  };

  const handleCfSaved = () => {
    loadCustomFields(selectedModule);
  };

  // ── Save (includes tab meta) ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: FormFieldOrderConfig & { _tabMeta: Record<string, unknown> } = {
        ...config,
        _tabMeta: {
          hidden: Array.from(hiddenTabs),
          order: tabOrder.length > 0 ? tabOrder : undefined,
          renames: Object.keys(tabRenames).length > 0 ? tabRenames : undefined,
        },
      };
      await moduleSettingsApi.updateFormFieldOrder(selectedModule, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to defaults ──
  const handleReset = () => {
    setConfig({ tabs: {} });
    setHiddenTabs(new Set());
    setTabOrder([]);
    setTabRenames({});
    setSaved(false);
  };

  const orderedTabs = getOrderedTabs();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Form Builder</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Organize tabs, reorder fields, and control visibility in add/edit forms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 font-medium"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Module selector */}
      <div className="relative mb-6">
        <button
          onClick={() => setModuleOpen(!moduleOpen)}
          className="flex items-center justify-between w-full max-w-xs px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm"
        >
          <span className="font-medium text-gray-900 dark:text-white">{moduleDef.label}</span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${moduleOpen ? 'rotate-180' : ''}`} />
        </button>
        {moduleOpen && (
          <div className="absolute z-10 mt-1 w-full max-w-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
            {MODULES.map(m => (
              <button
                key={m.key}
                onClick={() => { setSelectedModule(m.key); setModuleOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${
                  selectedModule === m.key ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {orderedTabs.map(tabDef => {
            const fields = getTabFields(tabDef);
            const isHidden = hiddenTabs.has(tabDef.id);
            const isCollapsed = collapsedTabs.has(tabDef.id);
            const isRenaming = renamingTab === tabDef.id;
            const isDragOverTab = dragOverTabId === tabDef.id;
            const isDraggingTab = dragTabId === tabDef.id;
            const label = getTabLabel(tabDef);
            const visibleCount = fields.filter(f => f.visible).length;

            return (
              <div
                key={tabDef.id}
                draggable={!isRenaming}
                onDragStart={() => handleTabDragStart(tabDef.id)}
                onDragOver={(e) => handleTabDragOver(e, tabDef.id)}
                onDrop={() => handleTabDrop(tabDef.id)}
                onDragEnd={handleTabDragEnd}
                className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                  isDragOverTab ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-gray-200 dark:border-slate-700'
                } ${isDraggingTab ? 'opacity-40' : ''} ${isHidden ? 'opacity-60' : ''}`}
              >
                {/* Tab header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700 cursor-grab">
                  <GripVertical size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />

                  <button onClick={() => toggleCollapse(tabDef.id)} className="p-0.5">
                    <ChevronRight size={14} className={`text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                  </button>

                  {isRenaming ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingTab(null); }}
                        onBlur={commitRename}
                        className="px-2 py-0.5 text-sm font-semibold border border-purple-300 dark:border-purple-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                      />
                      <button onClick={commitRename} className="p-0.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setRenamingTab(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{label}</h3>
                      {tabRenames[tabDef.id] && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-600">({tabDef.label})</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); startRename(tabDef.id); }}
                        className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 rounded"
                        title="Rename tab"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}

                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {visibleCount}/{fields.length} fields
                  </span>

                  <button
                    onClick={() => toggleTabVisibility(tabDef.id)}
                    className={`p-1 rounded transition-colors ${
                      isHidden
                        ? 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800'
                        : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                    title={isHidden ? 'Show tab in forms' : 'Hide tab from forms'}
                  >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Fields */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {fields.map((field, index) => {
                      const isDragging = dragItem?.tabId === tabDef.id && dragItem?.index === index;
                      const isDragOver = dragOverItem?.tabId === tabDef.id && dragOverItem?.index === index;
                      return (
                        <div
                          key={field.key}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(tabDef.id, index); }}
                          onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, tabDef.id, index); }}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(tabDef, index); }}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                            isDragging ? 'opacity-40' : ''
                          } ${isDragOver ? 'bg-purple-50 dark:bg-purple-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'} ${
                            !field.visible ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="w-4" /> {/* indent under tab grip */}
                          <GripVertical size={14} className="text-gray-300 dark:text-gray-600 cursor-grab flex-shrink-0" />
                          <span className={`text-sm flex-1 ${field.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                            {field.label}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-600 font-mono mr-2">{field.key}</span>
                          <button
                            onClick={() => toggleVisibility(tabDef, field.key)}
                            className={`p-1 rounded transition-colors ${
                              field.visible
                                ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                                : 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                            title={field.visible ? 'Hide field' : 'Show field'}
                          >
                            {field.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                      );
                    })}
                    {fields.length === 0 && getCustomFieldsForTab(tabDef.id).length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">No fields in this tab</p>
                    )}

                    {/* Custom fields in this tab */}
                    {getCustomFieldsForTab(tabDef.id).length > 0 && (
                      <div className="border-t border-dashed border-gray-200 dark:border-slate-700">
                        <div className="px-4 py-1.5 bg-purple-50/50 dark:bg-purple-900/10">
                          <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Custom Fields</span>
                        </div>
                        {getCustomFieldsForTab(tabDef.id).map(cf => (
                          <div
                            key={cf.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="w-4" />
                            <Puzzle size={14} className="text-purple-400 dark:text-purple-500 flex-shrink-0" />
                            <span className="text-sm flex-1 text-gray-900 dark:text-white">{cf.fieldLabel}</span>
                            <span className="text-xs text-purple-500 dark:text-purple-400 font-mono mr-1">{cf.fieldKey}</span>
                            <button
                              onClick={() => openEditCustomField(cf)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                              title="Edit field"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleToggleCustomField(cf)}
                              className={`p-1 rounded ${cf.isActive ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`}
                              title={cf.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {cf.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteCustomField(cf)}
                              className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Delete field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add custom field button */}
                    <div className="border-t border-gray-100 dark:border-slate-800">
                      <button
                        onClick={() => openAddCustomField(tabDef.id)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                      >
                        <Plus size={12} />
                        Add Custom Field
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-xl">
        <h3 className="font-semibold text-purple-900 dark:text-purple-300 text-sm mb-2">Tips</h3>
        <ul className="text-xs text-purple-800 dark:text-purple-400 space-y-1">
          <li>Drag tab headers to reorder entire sections</li>
          <li>Click the eye icon on a tab to hide it from add/edit forms</li>
          <li>Click the pencil icon to rename a tab</li>
          <li>Drag fields within a tab to reorder them</li>
          <li>Click <strong>+ Add Custom Field</strong> to create new fields in any tab</li>
          <li>Click "Reset" to restore the default layout</li>
        </ul>
      </div>

      {/* Custom field modal */}
      <CustomFieldModal
        isOpen={cfModalOpen}
        onClose={() => setCfModalOpen(false)}
        onSaved={handleCfSaved}
        editingField={editingCf}
        module={selectedModule}
        allFields={customFields}
        tabs={customTabs}
        groups={customGroups}
        defaultSection={cfDefaultSection}
      />
    </div>
  );
}
