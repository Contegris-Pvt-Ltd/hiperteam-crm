import { useState, useEffect } from 'react';
import { 
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Folder, LayoutGrid, Eye, EyeOff
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import type { CustomTab, CustomFieldGroup, CustomField } from '../../api/admin.api';

const MODULES = ['contacts', 'accounts', 'leads', 'opportunities'];

const STANDARD_SECTIONS = [
  { value: 'basic', label: 'Basic Info' },
  { value: 'contact', label: 'Contact Details' },
  { value: 'address', label: 'Address' },
  { value: 'social', label: 'Social Profiles' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom Fields Tab' },
];

const ICONS = [
  'folder', 'user', 'building', 'briefcase', 'file-text', 'settings',
  'star', 'heart', 'flag', 'tag', 'bookmark', 'archive',
  'clipboard', 'database', 'layers', 'grid', 'list', 'box'
];

export function FormLayoutPage() {
  const [activeModule, setActiveModule] = useState('contacts');
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showTabModal, setShowTabModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingTab, setEditingTab] = useState<CustomTab | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomFieldGroup | null>(null);

  // Form states
  const [tabForm, setTabForm] = useState({ name: '', icon: 'folder', description: '' });
  const [groupForm, setGroupForm] = useState({
    name: '',
    tabId: '',
    section: '',
    icon: '',
    description: '',
    collapsedByDefault: false,
    columns: 2,
  });

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'contact', 'custom']));

  useEffect(() => {
    fetchData();
  }, [activeModule]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tabsData, groupsData, fieldsData] = await Promise.all([
        adminApi.getTabs(activeModule),
        adminApi.getGroups({ module: activeModule }),
        adminApi.getCustomFields(activeModule),
      ]);
      setTabs(tabsData);
      setGroups(groupsData);
      setFields(fieldsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tab handlers
  const openTabModal = (tab?: CustomTab) => {
    if (tab) {
      setEditingTab(tab);
      setTabForm({ name: tab.name, icon: tab.icon, description: tab.description || '' });
    } else {
      setEditingTab(null);
      setTabForm({ name: '', icon: 'folder', description: '' });
    }
    setShowTabModal(true);
  };

  const saveTab = async () => {
    try {
      if (editingTab) {
        await adminApi.updateTab(editingTab.id, tabForm);
      } else {
        await adminApi.createTab({ ...tabForm, module: activeModule });
      }
      await fetchData();
      setShowTabModal(false);
    } catch (error) {
      console.error('Failed to save tab:', error);
    }
  };

  const deleteTab = async (id: string) => {
    if (!confirm('Delete this tab? Fields in this tab will be moved to "Custom Fields" section.')) return;
    try {
      await adminApi.deleteTab(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete tab:', error);
    }
  };

  const toggleTabActive = async (tab: CustomTab) => {
    try {
      await adminApi.updateTab(tab.id, { isActive: !tab.isActive });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle tab:', error);
    }
  };

  // Group handlers
  const openGroupModal = (group?: CustomFieldGroup, defaultSection?: string, defaultTabId?: string) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        tabId: group.tabId || '',
        section: group.section || '',
        icon: group.icon || '',
        description: group.description || '',
        collapsedByDefault: group.collapsedByDefault,
        columns: group.columns,
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        name: '',
        tabId: defaultTabId || '',
        section: defaultSection || '',
        icon: '',
        description: '',
        collapsedByDefault: false,
        columns: 2,
      });
    }
    setShowGroupModal(true);
  };

  const saveGroup = async () => {
    try {
      const data = {
        ...groupForm,
        tabId: groupForm.tabId || undefined,
        section: groupForm.section || undefined,
      };
      if (editingGroup) {
        await adminApi.updateGroup(editingGroup.id, data);
      } else {
        await adminApi.createGroup({ ...data, module: activeModule });
      }
      await fetchData();
      setShowGroupModal(false);
    } catch (error) {
      console.error('Failed to save group:', error);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Fields in this group will become ungrouped.')) return;
    try {
      await adminApi.deleteGroup(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get fields for a section/group
  const getFieldsForSection = (section: string) => {
    return fields.filter(f => f.section === section && !f.groupId && !f.tabId);
  };

  const getFieldsForGroup = (groupId: string) => {
    return fields.filter(f => f.groupId === groupId);
  };

  const getFieldsForTab = (tabId: string) => {
    return fields.filter(f => f.tabId === tabId && !f.groupId);
  };

  const getGroupsForSection = (section: string) => {
    return groups.filter(g => g.section === section && !g.tabId);
  };

  const getGroupsForTab = (tabId: string) => {
    return groups.filter(g => g.tabId === tabId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Form Layout</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Organize custom fields into tabs and groups
          </p>
        </div>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        {MODULES.map(module => (
          <button
            key={module}
            onClick={() => setActiveModule(module)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              activeModule === module
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            {module}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Standard Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Standard Sections</h2>
          </div>

          {STANDARD_SECTIONS.map(section => {
            const sectionGroups = getGroupsForSection(section.value);
            const sectionFields = getFieldsForSection(section.value);
            const isExpanded = expandedSections.has(section.value);
            const totalFields = sectionFields.length + sectionGroups.reduce((acc, g) => acc + getFieldsForGroup(g.id).length, 0);

            return (
              <div 
                key={section.value}
                className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden"
              >
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <button
                    onClick={() => toggleSection(section.value)}
                    className="flex items-center gap-3 flex-1"
                    >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium text-gray-900 dark:text-white">{section.label}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {totalFields} fields
                    </span>
                    </button>
                    <button
                    onClick={() => openGroupModal(undefined, section.value)}
                    className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                    title="Add group"
                    >
                    <Plus className="w-4 h-4" />
                    </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-800 p-4 space-y-3">
                    {/* Groups in this section */}
                    {sectionGroups.map(group => (
                      <div 
                        key={group.id}
                        className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-purple-500" />
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{group.name}</span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              ({getFieldsForGroup(group.id).length} fields)
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openGroupModal(group)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteGroup(group.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {getFieldsForGroup(group.id).length > 0 && (
                          <div className="ml-6 space-y-1">
                            {getFieldsForGroup(group.id).map(field => (
                              <div key={field.id} className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-400 rounded-full" />
                                {field.fieldLabel}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Ungrouped fields in this section */}
                    {sectionFields.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Ungrouped fields:</p>
                        {sectionFields.map(field => (
                          <div key={field.id} className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 ml-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full" />
                            {field.fieldLabel}
                          </div>
                        ))}
                      </div>
                    )}

                    {sectionGroups.length === 0 && sectionFields.length === 0 && (
                      <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">
                        No custom fields in this section
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column - Custom Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Tabs</h2>
            <button
              onClick={() => openTabModal()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" /> Add Tab
            </button>
          </div>

          {tabs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center">
              <LayoutGrid className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400">No custom tabs yet</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                Create tabs to organize fields into separate sections
              </p>
            </div>
          ) : (
            tabs.map(tab => {
              const tabGroups = getGroupsForTab(tab.id);
              const tabFields = getFieldsForTab(tab.id);
              const isExpanded = expandedSections.has(`tab-${tab.id}`);
              const totalFields = tabFields.length + tabGroups.reduce((acc, g) => acc + getFieldsForGroup(g.id).length, 0);

              return (
                <div 
                  key={tab.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl border overflow-hidden ${
                    tab.isActive 
                      ? 'border-purple-200 dark:border-purple-800' 
                      : 'border-gray-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <button
                      onClick={() => toggleSection(`tab-${tab.id}`)}
                      className="flex items-center gap-3 flex-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-medium text-gray-900 dark:text-white">{tab.name}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {totalFields} fields
                      </span>
                      {!tab.isActive && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          Hidden
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleTabActive(tab)}
                        className={`p-1.5 rounded-lg ${tab.isActive ? 'text-gray-400 hover:text-gray-600' : 'text-amber-500 hover:text-amber-600'}`}
                        title={tab.isActive ? 'Hide tab' : 'Show tab'}
                      >
                        {tab.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openGroupModal(undefined, undefined, tab.id)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                        title="Add group"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openTabModal(tab)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTab(tab.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-800 p-4 space-y-3">
                      {/* Groups in this tab */}
                      {tabGroups.map(group => (
                        <div 
                          key={group.id}
                          className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Folder className="w-4 h-4 text-purple-500" />
                              <span className="font-medium text-gray-900 dark:text-white text-sm">{group.name}</span>
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                ({group.columns} col, {getFieldsForGroup(group.id).length} fields)
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openGroupModal(group)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteGroup(group.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {getFieldsForGroup(group.id).length > 0 && (
                            <div className="ml-6 space-y-1">
                              {getFieldsForGroup(group.id).map(field => (
                                <div key={field.id} className="text-xs text-gray-600 dark:text-slate-400 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-400 rounded-full" />
                                  {field.fieldLabel}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Ungrouped fields in this tab */}
                      {tabFields.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Ungrouped fields:</p>
                          {tabFields.map(field => (
                            <div key={field.id} className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 ml-2">
                              <span className="w-2 h-2 bg-gray-400 rounded-full" />
                              {field.fieldLabel}
                            </div>
                          ))}
                        </div>
                      )}

                      {tabGroups.length === 0 && tabFields.length === 0 && (
                        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">
                          No fields in this tab yet
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tab Modal */}
      {showTabModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTabModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingTab ? 'Edit Tab' : 'Create Tab'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Tab Name *
                  </label>
                  <input
                    type="text"
                    value={tabForm.name}
                    onChange={(e) => setTabForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="e.g., HR Information"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setTabForm(prev => ({ ...prev, icon }))}
                        className={`p-2 rounded-lg border text-center text-xs ${
                          tabForm.icon === icon
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={tabForm.description}
                    onChange={(e) => setTabForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowTabModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTab}
                  disabled={!tabForm.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingTab ? 'Save Changes' : 'Create Tab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowGroupModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingGroup ? 'Edit Group' : 'Create Group'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    placeholder="e.g., Employment Details"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <select
                        value={groupForm.section}
                        onChange={(e) => setGroupForm(prev => ({ ...prev, section: e.target.value, tabId: '' }))}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Standard Section</option>
                        {STANDARD_SECTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <select
                        value={groupForm.tabId}
                        onChange={(e) => setGroupForm(prev => ({ ...prev, tabId: e.target.value, section: '' }))}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="">Or Custom Tab</option>
                        {tabs.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Choose a standard section or a custom tab
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Columns
                    </label>
                    <select
                      value={groupForm.columns}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, columns: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value={1}>1 Column</option>
                      <option value={2}>2 Columns</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupForm.collapsedByDefault}
                        onChange={(e) => setGroupForm(prev => ({ ...prev, collapsedByDefault: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">Collapsed by default</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={groupForm.description}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={saveGroup}
                  disabled={!groupForm.name.trim() || (!groupForm.section && !groupForm.tabId)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}