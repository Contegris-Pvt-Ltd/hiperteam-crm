import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Users, Building2, Target, Briefcase, GripVertical,
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Eye, EyeOff,
  Folder, FolderOpen, LayoutGrid, Undo2, Redo2,
  Type, Hash, Calendar, List, CheckSquare, FileText,
  Link, Mail, Phone, Upload, Loader2, AlertCircle
} from 'lucide-react';
import { adminApi } from '../../api/admin.api';
import type { CustomField, CustomTab, CustomFieldGroup } from '../../api/admin.api';

// ==================== CONSTANTS ====================

const MODULE_OPTIONS = [
  { value: 'contacts', label: 'Contacts', icon: Users },
  { value: 'accounts', label: 'Accounts', icon: Building2 },
  { value: 'leads', label: 'Leads', icon: Target },
  { value: 'opportunities', label: 'Opportunities', icon: Briefcase },
];

const STANDARD_SECTIONS = [
  { value: 'basic', label: 'Basic Info', description: 'Name, company, job title' },
  { value: 'contact', label: 'Contact Details', description: 'Email, phone, mobile' },
  { value: 'address', label: 'Address', description: 'Street, city, country' },
  { value: 'social', label: 'Social Profiles', description: 'LinkedIn, Twitter, etc.' },
  { value: 'other', label: 'Other', description: 'Tags, notes, preferences' },
  { value: 'custom', label: 'Custom Fields', description: 'Additional custom fields' },
];

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  textarea: FileText,
  number: Hash,
  date: Calendar,
  select: List,
  multi_select: List,
  checkbox: CheckSquare,
  url: Link,
  email: Mail,
  phone: Phone,
  file: Upload,
};

const TAB_ICONS = [
  'folder', 'star', 'heart', 'flag', 'bookmark', 'tag',
  'briefcase', 'archive', 'box', 'clipboard', 'file-text', 'layers',
  'grid', 'list', 'database', 'settings', 'tool', 'zap'
];

// ==================== TYPES ====================

interface DragItem {
  type: 'field' | 'group' | 'tab';
  id: string;
  data: CustomField | CustomFieldGroup | CustomTab;
}

interface HistoryEntry {
  fields: CustomField[];
  groups: CustomFieldGroup[];
  tabs: CustomTab[];
}

// ==================== SORTABLE COMPONENTS ====================

function SortableField({ field, onEdit, onDelete }: { 
  field: CustomField; 
  onEdit: (field: CustomField) => void;
  onDelete: (field: CustomField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `field-${field.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const FieldIcon = FIELD_TYPE_ICONS[field.fieldType] || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg group hover:border-blue-300 dark:hover:border-blue-700 ${
        isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
        <FieldIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {field.fieldLabel}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {field.fieldType} {field.isRequired && '• Required'}
        </p>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(field)}
          className="p-1 text-gray-400 hover:text-blue-600 rounded"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(field)}
          className="p-1 text-gray-400 hover:text-red-600 rounded"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {field.columnSpan === 2 && (
        <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded">
          Full
        </span>
      )}
    </div>
  );
}

function SortableGroup({ 
  group, 
  fields, 
  isExpanded, 
  onToggle,
  onEdit,
  onDelete,
  onEditField,
  onDeleteField,
}: { 
  group: CustomFieldGroup;
  fields: CustomField[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (group: CustomFieldGroup) => void;
  onDelete: (group: CustomFieldGroup) => void;
  onEditField: (field: CustomField) => void;
  onDeleteField: (field: CustomField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden ${
        isDragging ? 'shadow-lg ring-2 ring-purple-500' : ''
      }`}
    >
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/50">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        
        <button onClick={onToggle} className="p-1">
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-purple-600" />
          ) : (
            <Folder className="w-4 h-4 text-purple-600" />
          )}
        </button>
        
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="font-medium text-gray-900 dark:text-white">{group.name}</span>
          <span className="ml-2 text-xs text-gray-500 dark:text-slate-400">
            {fields.length} fields • {group.columns} col
          </span>
        </button>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(group)}
            className="p-1 text-gray-400 hover:text-blue-600 rounded"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(group)}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={onToggle} className="p-1 text-gray-400">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-3 space-y-2 bg-white dark:bg-slate-900">
          <SortableContext items={fields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
            {fields.length > 0 ? (
              fields.map(field => (
                <SortableField
                  key={field.id}
                  field={field}
                  onEdit={onEditField}
                  onDelete={onDeleteField}
                />
              ))
            ) : (
              <div className="py-4 text-center text-sm text-gray-400 dark:text-slate-500 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                Drag fields here
              </div>
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function SortableTab({
  tab,
  groups,
  ungroupedFields,
  allFields,
  expandedGroups,
  onToggleGroup,
  onEditTab,
  onDeleteTab,
  onToggleTab,
  onEditGroup,
  onDeleteGroup,
  onAddGroup,
  onEditField,
  onDeleteField,
}: {
  tab: CustomTab;
  groups: CustomFieldGroup[];
  ungroupedFields: CustomField[];
  allFields: CustomField[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onEditTab: (tab: CustomTab) => void;
  onDeleteTab: (tab: CustomTab) => void;
  onToggleTab: (tab: CustomTab) => void;
  onEditGroup: (group: CustomFieldGroup) => void;
  onDeleteGroup: (group: CustomFieldGroup) => void;
  onAddGroup: (tabId: string) => void;
  onEditField: (field: CustomField) => void;
  onDeleteField: (field: CustomField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `tab-${tab.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isExpanded, setIsExpanded] = useState(true);
  const totalFields = allFields.filter(f => f.tabId === tab.id).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden ${
        isDragging ? 'shadow-lg ring-2 ring-purple-500' : ''
      }`}
    >
      <div className="flex items-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-purple-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-purple-600" />
          )}
          <span className="font-semibold text-purple-900 dark:text-purple-300">{tab.name}</span>
          <span className="px-2 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded-full">
            {totalFields} fields
          </span>
        </button>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleTab(tab)}
            className={`p-1.5 rounded ${tab.isActive ? 'text-emerald-600' : 'text-gray-400'}`}
            title={tab.isActive ? 'Active' : 'Hidden'}
          >
            {tab.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEditTab(tab)}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteTab(tab)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
          {/* Groups in this tab */}
          <SortableContext items={groups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
            {groups.map(group => {
              const groupFields = allFields.filter(f => f.groupId === group.id);
              return (
                <SortableGroup
                  key={group.id}
                  group={group}
                  fields={groupFields}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => onToggleGroup(group.id)}
                  onEdit={onEditGroup}
                  onDelete={onDeleteGroup}
                  onEditField={onEditField}
                  onDeleteField={onDeleteField}
                />
              );
            })}
          </SortableContext>
          
          {/* Ungrouped fields in this tab */}
          {ungroupedFields.length > 0 && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-3">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-2">
                Ungrouped Fields
              </p>
              <SortableContext items={ungroupedFields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {ungroupedFields.map(field => (
                    <SortableField
                      key={field.id}
                      field={field}
                      onEdit={onEditField}
                      onDelete={onDeleteField}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          )}
          
          <button
            onClick={() => onAddGroup(tab.id)}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add Group
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function LayoutBuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || 'contacts');
  
  // Data state
  const [fields, setFields] = useState<CustomField[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(STANDARD_SECTIONS.map(s => s.value)));
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Modals
  const [tabModal, setTabModal] = useState<{ open: boolean; tab: CustomTab | null }>({ open: false, tab: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: CustomFieldGroup | null; tabId?: string; section?: string }>({ open: false, group: null });
  
  // Form state for modals
  const [tabForm, setTabForm] = useState({ name: '', icon: 'folder', description: '' });
  const [groupForm, setGroupForm] = useState({ name: '', icon: '', description: '', columns: 2, collapsedByDefault: false });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load data
  useEffect(() => {
    loadData();
  }, [selectedModule]);

  useEffect(() => {
    setSearchParams({ module: selectedModule });
  }, [selectedModule, setSearchParams]);

  const loadData = async () => {
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
      
      // Initialize history
      setHistory([{ fields: fieldsData, groups: groupsData, tabs: tabsData }]);
      setHistoryIndex(0);
      
      // Expand all groups by default
      setExpandedGroups(new Set(groupsData.map(g => g.id)));
    } catch (err) {
      setError('Failed to load layout data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save to history
  const saveToHistory = useCallback((newFields: CustomField[], newGroups: CustomFieldGroup[], newTabs: CustomTab[]) => {
    const newEntry = { fields: newFields, groups: newGroups, tabs: newTabs };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newEntry);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevEntry = history[historyIndex - 1];
      setFields(prevEntry.fields);
      setGroups(prevEntry.groups);
      setTabs(prevEntry.tabs);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextEntry = history[historyIndex + 1];
      setFields(nextEntry.fields);
      setGroups(nextEntry.groups);
      setTabs(nextEntry.tabs);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Get fields for a section
  const getFieldsForSection = (section: string) => {
    return fields.filter(f => f.section === section && !f.tabId && !f.groupId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  // Get groups for a section
  const getGroupsForSection = (section: string) => {
    return groups.filter(g => g.section === section && !g.tabId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  // Get fields for a group
  const getFieldsForGroup = (groupId: string) => {
    return fields.filter(f => f.groupId === groupId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  // Get groups for a tab
  const getGroupsForTab = (tabId: string) => {
    return groups.filter(g => g.tabId === tabId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  // Get ungrouped fields for a tab
  const getUngroupedFieldsForTab = (tabId: string) => {
    return fields.filter(f => f.tabId === tabId && !f.groupId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  };

  // Drag handlers
  const handleDragStart = (event: { active: { id: string | number } }) => {
    const { active } = event;
    const id = String(active.id);
    
    if (id.startsWith('field-')) {
      const fieldId = id.replace('field-', '');
      const field = fields.find(f => f.id === fieldId);
      if (field) setActiveItem({ type: 'field', id: fieldId, data: field });
    } else if (id.startsWith('group-')) {
      const groupId = id.replace('group-', '');
      const group = groups.find(g => g.id === groupId);
      if (group) setActiveItem({ type: 'group', id: groupId, data: group });
    } else if (id.startsWith('tab-')) {
      const tabId = id.replace('tab-', '');
      const tab = tabs.find(t => t.id === tabId);
      if (tab) setActiveItem({ type: 'tab', id: tabId, data: tab });
    }
  };

  const handleDragEnd = async (event: { active: { id: string | number }; over: { id: string | number } | null }) => {

    const { active, over } = event;
    setActiveItem(null);
    
    if (!over || active.id === over.id) return;
    
    const activeId = String(active.id);
    const overId = String(over.id);
    
    // Handle field reordering
    if (activeId.startsWith('field-') && overId.startsWith('field-')) {
      const activeFieldId = activeId.replace('field-', '');
      const overFieldId = overId.replace('field-', '');
      
      const activeField = fields.find(f => f.id === activeFieldId);
      const overField = fields.find(f => f.id === overFieldId);
      
      if (activeField && overField) {
        // If moving to a different group
        if (activeField.groupId !== overField.groupId) {
          const updatedFields = fields.map(f => {
            if (f.id === activeFieldId) {
              return { ...f, groupId: overField.groupId, tabId: overField.tabId, section: overField.section };
            }
            return f;
          });
          setFields(updatedFields);
          saveToHistory(updatedFields, groups, tabs);
          
          // Save to backend
          await adminApi.updateCustomField(activeFieldId, {
            groupId: overField.groupId || null,
            tabId: overField.tabId || null,
            section: overField.section,
          });
        } else {
          // Reorder within same group
          const sameGroupFields = fields.filter(f => 
            f.groupId === activeField.groupId && 
            f.tabId === activeField.tabId && 
            f.section === activeField.section
          );
          const oldIndex = sameGroupFields.findIndex(f => f.id === activeFieldId);
          const newIndex = sameGroupFields.findIndex(f => f.id === overFieldId);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedFields = arrayMove(sameGroupFields, oldIndex, newIndex);
            const fieldIds = reorderedFields.map(f => f.id);
            
            // Update display orders
            const updatedFields = fields.map(f => {
              const newOrder = fieldIds.indexOf(f.id);
              if (newOrder !== -1) {
                return { ...f, displayOrder: newOrder };
              }
              return f;
            });
            setFields(updatedFields);
            saveToHistory(updatedFields, groups, tabs);
            
            // Save to backend
            await adminApi.reorderCustomFields(selectedModule, fieldIds);
          }
        }
      }
    }
    
    // Handle group reordering
    if (activeId.startsWith('group-') && overId.startsWith('group-')) {
      const activeGroupId = activeId.replace('group-', '');
      const overGroupId = overId.replace('group-', '');
      
      const oldIndex = groups.findIndex(g => g.id === activeGroupId);
      const newIndex = groups.findIndex(g => g.id === overGroupId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedGroups = arrayMove(groups, oldIndex, newIndex);
        setGroups(reorderedGroups);
        saveToHistory(fields, reorderedGroups, tabs);
        
        // Save to backend
        await adminApi.reorderGroups(selectedModule, reorderedGroups.map(g => g.id));
      }
    }
    
    // Handle tab reordering
    if (activeId.startsWith('tab-') && overId.startsWith('tab-')) {
      const activeTabId = activeId.replace('tab-', '');
      const overTabId = overId.replace('tab-', '');
      
      const oldIndex = tabs.findIndex(t => t.id === activeTabId);
      const newIndex = tabs.findIndex(t => t.id === overTabId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedTabs = arrayMove(tabs, oldIndex, newIndex);
        setTabs(reorderedTabs);
        saveToHistory(fields, groups, reorderedTabs);
        
        // Save to backend
        await adminApi.reorderTabs(selectedModule, reorderedTabs.map(t => t.id));
      }
    }
  };

  // Tab CRUD
  const openTabModal = (tab?: CustomTab) => {
    if (tab) {
      setTabForm({ name: tab.name, icon: tab.icon, description: tab.description || '' });
      setTabModal({ open: true, tab });
    } else {
      setTabForm({ name: '', icon: 'folder', description: '' });
      setTabModal({ open: true, tab: null });
    }
  };

  const saveTab = async () => {
    setSaving(true);
    try {
      if (tabModal.tab) {
        const updated = await adminApi.updateTab(tabModal.tab.id, tabForm);
        setTabs(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await adminApi.createTab({ ...tabForm, module: selectedModule });
        setTabs(prev => [...prev, created]);
      }
      setTabModal({ open: false, tab: null });
      saveToHistory(fields, groups, tabs);
    } catch (err) {
      setError('Failed to save tab');
    } finally {
      setSaving(false);
    }
  };

  const deleteTab = async (tab: CustomTab) => {
    if (!confirm(`Delete tab "${tab.name}"? Fields will be moved to Custom Fields section.`)) return;
    try {
      await adminApi.deleteTab(tab.id);
      setTabs(prev => prev.filter(t => t.id !== tab.id));
      // Move fields to custom section
      setFields(prev => prev.map(f => f.tabId === tab.id ? { ...f, tabId: null, section: 'custom' } : f));
      setGroups(prev => prev.filter(g => g.tabId !== tab.id));
      saveToHistory(fields, groups, tabs.filter(t => t.id !== tab.id));
    } catch (err) {
      setError('Failed to delete tab');
    }
  };

  const toggleTabActive = async (tab: CustomTab) => {
    try {
      const updated = await adminApi.updateTab(tab.id, { isActive: !tab.isActive });
      setTabs(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      setError('Failed to toggle tab');
    }
  };

  // Group CRUD
  const openGroupModal = (group?: CustomFieldGroup, tabId?: string, section?: string) => {
    if (group) {
      setGroupForm({
        name: group.name,
        icon: group.icon || '',
        description: group.description || '',
        columns: group.columns,
        collapsedByDefault: group.collapsedByDefault,
      });
      setGroupModal({ open: true, group, tabId: group.tabId || undefined, section: group.section || undefined });
    } else {
      setGroupForm({ name: '', icon: '', description: '', columns: 2, collapsedByDefault: false });
      setGroupModal({ open: true, group: null, tabId, section });
    }
  };

  const saveGroup = async () => {
    setSaving(true);
    try {
      if (groupModal.group) {
        const updated = await adminApi.updateGroup(groupModal.group.id, groupForm);
        setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
      } else {
        const created = await adminApi.createGroup({
          ...groupForm,
          module: selectedModule,
          tabId: groupModal.tabId,
          section: groupModal.section,
        });
        setGroups(prev => [...prev, created]);
      }
      setGroupModal({ open: false, group: null });
      saveToHistory(fields, groups, tabs);
    } catch (err) {
      setError('Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (group: CustomFieldGroup) => {
    if (!confirm(`Delete group "${group.name}"? Fields will become ungrouped.`)) return;
    try {
      await adminApi.deleteGroup(group.id);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      setFields(prev => prev.map(f => f.groupId === group.id ? { ...f, groupId: null } : f));
      saveToHistory(fields, groups.filter(g => g.id !== group.id), tabs);
    } catch (err) {
      setError('Failed to delete group');
    }
  };

  // Field handlers
  const editField = (field: CustomField) => {
    // Navigate to custom fields page with field selected
    window.location.href = `/admin/custom-fields?module=${selectedModule}&edit=${field.id}`;
  };

  const deleteField = async (field: CustomField) => {
    if (!confirm(`Delete field "${field.fieldLabel}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteCustomField(field.id);
      setFields(prev => prev.filter(f => f.id !== field.id));
      saveToHistory(fields.filter(f => f.id !== field.id), groups, tabs);
    } catch (err) {
      setError('Failed to delete field');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Layout Builder</h2>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Drag and drop to organize your form layout
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 disabled:opacity-50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 disabled:opacity-50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => openTabModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Tab
          </button>
        </div>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2">
        {MODULE_OPTIONS.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.value}
              onClick={() => setSelectedModule(module.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                selectedModule === module.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {module.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Main Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Standard Sections */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
              Standard Sections
            </h3>
            
            {STANDARD_SECTIONS.map(section => {
              const isExpanded = expandedSections.has(section.value);
              const sectionGroups = getGroupsForSection(section.value);
              const ungroupedFields = getFieldsForSection(section.value);
              const totalFields = fields.filter(f => f.section === section.value && !f.tabId).length;
              
              return (
                <div
                  key={section.value}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50">
                    <button
                      onClick={() => toggleSection(section.value)}
                      className="flex items-center gap-3 flex-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <div className="text-left">
                        <span className="font-medium text-gray-900 dark:text-white">{section.label}</span>
                        <span className="ml-2 px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 text-xs rounded-full">
                          {totalFields}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => openGroupModal(undefined, undefined, section.value)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      title="Add group"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {/* Groups */}
                      <SortableContext items={sectionGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
                        {sectionGroups.map(group => (
                          <SortableGroup
                            key={group.id}
                            group={group}
                            fields={getFieldsForGroup(group.id)}
                            isExpanded={expandedGroups.has(group.id)}
                            onToggle={() => toggleGroup(group.id)}
                            onEdit={openGroupModal}
                            onDelete={deleteGroup}
                            onEditField={editField}
                            onDeleteField={deleteField}
                          />
                        ))}
                      </SortableContext>
                      
                      {/* Ungrouped fields */}
                      {ungroupedFields.length > 0 && (
                        <div className={sectionGroups.length > 0 ? 'border-t border-gray-200 dark:border-slate-700 pt-3' : ''}>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase mb-2">
                            Ungrouped
                          </p>
                          <SortableContext items={ungroupedFields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {ungroupedFields.map(field => (
                                <SortableField
                                  key={field.id}
                                  field={field}
                                  onEdit={editField}
                                  onDelete={deleteField}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </div>
                      )}
                      
                      {sectionGroups.length === 0 && ungroupedFields.length === 0 && (
                        <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                          No fields assigned to this section
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Custom Tabs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Folder className="w-5 h-5 text-purple-600" />
              Custom Tabs
            </h3>
            
            <SortableContext items={tabs.map(t => `tab-${t.id}`)} strategy={verticalListSortingStrategy}>
              {tabs.map(tab => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  groups={getGroupsForTab(tab.id)}
                  ungroupedFields={getUngroupedFieldsForTab(tab.id)}
                  allFields={fields}
                  expandedGroups={expandedGroups}
                  onToggleGroup={toggleGroup}
                  onEditTab={openTabModal}
                  onDeleteTab={deleteTab}
                  onToggleTab={toggleTabActive}
                  onEditGroup={openGroupModal}
                  onDeleteGroup={deleteGroup}
                  onAddGroup={(tabId) => openGroupModal(undefined, tabId)}
                  onEditField={editField}
                  onDeleteField={deleteField}
                />
              ))}
            </SortableContext>
            
            {tabs.length === 0 && (
              <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 text-center">
                <Folder className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-slate-400 mb-2">No custom tabs yet</p>
                <button
                  onClick={() => openTabModal()}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create your first tab
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem?.type === 'field' && (
            <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg shadow-lg">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {(activeItem.data as CustomField).fieldLabel}
              </span>
            </div>
          )}
          {activeItem?.type === 'group' && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-purple-500 rounded-xl shadow-lg">
              <span className="font-medium text-gray-900 dark:text-white">
                {(activeItem.data as CustomFieldGroup).name}
              </span>
            </div>
          )}
          {activeItem?.type === 'tab' && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-500 rounded-xl shadow-lg">
              <span className="font-semibold text-purple-900 dark:text-purple-300">
                {(activeItem.data as CustomTab).name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Tab Modal */}
      {tabModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setTabModal({ open: false, tab: null })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {tabModal.tab ? 'Edit Tab' : 'Create Tab'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Tab Name *
                    </label>
                    <input
                      type="text"
                      value={tabForm.name}
                      onChange={(e) => setTabForm({ ...tabForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="e.g., Marketing Info"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Icon
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TAB_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setTabForm({ ...tabForm, icon })}
                          className={`p-2 rounded-lg border ${
                            tabForm.icon === icon
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Folder className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={tabForm.description}
                      onChange={(e) => setTabForm({ ...tabForm, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setTabModal({ open: false, tab: null })}
                    className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTab}
                    disabled={!tabForm.name || saving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : tabModal.tab ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {groupModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setGroupModal({ open: false, group: null })} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {groupModal.group ? 'Edit Group' : 'Create Group'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="e.g., Personal Details"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Columns
                    </label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={groupForm.columns === 1}
                          onChange={() => setGroupForm({ ...groupForm, columns: 1 })}
                          className="text-purple-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">1 Column</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={groupForm.columns === 2}
                          onChange={() => setGroupForm({ ...groupForm, columns: 2 })}
                          className="text-purple-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">2 Columns</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="collapsedByDefault"
                      checked={groupForm.collapsedByDefault}
                      onChange={(e) => setGroupForm({ ...groupForm, collapsedByDefault: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="collapsedByDefault" className="text-sm text-gray-700 dark:text-slate-300">
                      Collapsed by default
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setGroupModal({ open: false, group: null })}
                    className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveGroup}
                    disabled={!groupForm.name || saving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : groupModal.group ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}