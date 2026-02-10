import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Users, Building2, Target, Briefcase, GripVertical,
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, EyeOff,
  Type, Hash, Calendar, List, CheckSquare, FileText,
  Link, Mail, Phone, Upload, Loader2, AlertCircle, X,
  Smartphone, Monitor, Tablet, Square, RectangleHorizontal,
  PanelLeftClose, PanelRightClose, Palette, Layers, MousePointer,
  FolderPlus, ArrowLeft,
  FolderOpen, Eye
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

const FIELD_TYPES = [
  { value: 'text', label: 'Text Field', icon: Type, description: 'Single line text' },
  { value: 'textarea', label: 'Text Area', icon: FileText, description: 'Multi-line text' },
  { value: 'number', label: 'Number', icon: Hash, description: 'Numeric input' },
  { value: 'date', label: 'Date', icon: Calendar, description: 'Date picker' },
  { value: 'select', label: 'Dropdown', icon: List, description: 'Single select' },
  { value: 'multi_select', label: 'Multi Select', icon: CheckSquare, description: 'Multiple select' },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, description: 'Yes/No toggle' },
  { value: 'url', label: 'URL', icon: Link, description: 'Web link' },
  { value: 'email', label: 'Email', icon: Mail, description: 'Email address' },
  { value: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { value: 'file', label: 'File', icon: Upload, description: 'File upload' },
];

const STANDARD_SECTIONS = [
  { id: 'basic', label: 'Basic Info', locked: false },
  { id: 'contact', label: 'Contact Details', locked: true },
  { id: 'address', label: 'Address', locked: true },
  { id: 'social', label: 'Social Profiles', locked: false },
  { id: 'other', label: 'Other', locked: false },
  { id: 'custom', label: 'Custom Fields', locked: false },
];

type ViewMode = 'desktop' | 'tablet' | 'mobile';

// ==================== DRAGGABLE FIELD TYPE ====================

function DraggableFieldType({ fieldType }: { fieldType: typeof FIELD_TYPES[0] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${fieldType.value}`,
    data: { type: 'new-field', fieldType: fieldType.value },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const Icon = fieldType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fieldType.label}</p>
      </div>
    </div>
  );
}

// ==================== SORTABLE FIELD ====================

function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
  onResize,
}: {
  field: CustomField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onResize: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `field-${field.id}`,
    data: { type: 'field', field },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const FieldIcon = FIELD_TYPES.find(t => t.value === field.fieldType)?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`relative group ${field.columnSpan === 2 ? 'col-span-2' : ''} ${isDragging ? 'z-50 opacity-50' : ''}`}
    >
      <div
        className={`p-2.5 bg-white dark:bg-slate-800 border-2 rounded-lg transition-all ${
          isSelected 
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' 
            : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'
        }`}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>

        <div className="pl-4">
          <div className="flex items-center gap-1.5 mb-1">
            <FieldIcon className="w-3 h-3 text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">
              {field.fieldLabel}
            </span>
            {field.isRequired && <span className="text-red-500 text-xs">*</span>}
          </div>
          
          <div className="h-7 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded flex items-center px-2">
            <span className="text-xs text-gray-400 truncate">{field.placeholder || 'Enter value...'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="absolute -right-1 -top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onResize(); }}
            className="p-1 bg-purple-500 text-white rounded-full shadow hover:bg-purple-600"
            title={field.columnSpan === 1 ? 'Full width' : 'Half width'}
          >
            {field.columnSpan === 1 ? <RectangleHorizontal className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 bg-red-500 text-white rounded-full shadow hover:bg-red-600"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SORTABLE GROUP ====================

function SortableGroup({
  group,
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onResizeField,
  onEditGroup,
  onDeleteGroup,
}: {
  group: CustomFieldGroup;
  fields: CustomField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
  onResizeField: (id: string) => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(!group.collapsedByDefault);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `group-${group.id}`,
    data: { type: 'group', group },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-group-${group.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-purple-50/50 dark:bg-purple-900/10 ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between p-2 bg-purple-100/50 dark:bg-purple-900/20">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="p-0.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1.5">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-sm font-medium text-purple-900 dark:text-purple-300">{group.name}</span>
            <span className="text-xs text-purple-600/70">({fields.length})</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEditGroup} className="p-1 text-purple-600 hover:bg-purple-200 dark:hover:bg-purple-800 rounded">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={onDeleteGroup} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          ref={setDropRef}
          className={`p-2 min-h-[50px] ${isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          {fields.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-400 border border-dashed border-gray-300 dark:border-slate-600 rounded">
              Drop fields here
            </div>
          ) : (
            <div className={`grid gap-2 ${group.columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <SortableContext items={fields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
                {fields.map(field => (
                  <SortableField
                    key={field.id}
                    field={field}
                    isSelected={selectedFieldId === `field-${field.id}`}
                    onSelect={() => onSelectField(`field-${field.id}`)}
                    onDelete={() => onDeleteField(field.id)}
                    onResize={() => onResizeField(field.id)}
                  />
                ))}
              </SortableContext>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== SORTABLE TAB ====================

function SortableTab({
  tab,
  isActive,
  onClick,
  onEdit,
  onDelete,
  onToggle,
}: {
  tab: CustomTab;
  isActive: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `tab-${tab.id}`,
    data: { type: 'tab', tab },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive 
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
          : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-400'
      } ${isDragging ? 'opacity-50 shadow-lg' : ''} ${!tab.isActive ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <span className="text-sm font-medium flex-1 truncate">{tab.name}</span>
      <div className="hidden group-hover:flex items-center gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
        >
          {tab.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ==================== SECTION COMPONENT ====================

function SectionComponent({
  sectionId,
  label,
  isLocked,
  fields,
  groups,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onResizeField,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  sectionId: string;
  label: string;
  isLocked: boolean;
  fields: CustomField[];
  groups: CustomFieldGroup[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
  onResizeField: (id: string) => void;
  onAddGroup: () => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const sectionGroups = groups.filter(g => g.section === sectionId && !g.tabId);
  const ungroupedFields = fields.filter(f => f.section === sectionId && !f.tabId && !f.groupId);
  const totalFields = fields.filter(f => f.section === sectionId && !f.tabId).length;

  const { isOver, setNodeRef } = useDroppable({
    id: `drop-section-${sectionId}`,
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50">
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 flex-1">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold text-gray-900 dark:text-white">{label}</span>
          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 text-xs rounded-full">{totalFields}</span>
          {isLocked && (
            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-xs rounded-full">System</span>
          )}
        </button>
        <button
          onClick={onAddGroup}
          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
          title="Add group"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div
          ref={setNodeRef}
          className={`p-3 space-y-3 min-h-[60px] ${isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
        >
          {/* Groups */}
          <SortableContext items={sectionGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
            {sectionGroups.map(group => {
              const groupFields = fields.filter(f => f.groupId === group.id);
              return (
                <SortableGroup
                  key={group.id}
                  group={group}
                  fields={groupFields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={onSelectField}
                  onDeleteField={onDeleteField}
                  onResizeField={onResizeField}
                  onEditGroup={() => onEditGroup(group.id)}
                  onDeleteGroup={() => onDeleteGroup(group.id)}
                />
              );
            })}
          </SortableContext>

          {/* Ungrouped Fields */}
          {ungroupedFields.length > 0 && (
            <div className={sectionGroups.length > 0 ? 'pt-2 border-t border-gray-200 dark:border-slate-700' : ''}>
              <div className="grid grid-cols-2 gap-2">
                <SortableContext items={ungroupedFields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
                  {ungroupedFields.map(field => (
                    <SortableField
                      key={field.id}
                      field={field}
                      isSelected={selectedFieldId === `field-${field.id}`}
                      onSelect={() => onSelectField(`field-${field.id}`)}
                      onDelete={() => onDeleteField(field.id)}
                      onResize={() => onResizeField(field.id)}
                    />
                  ))}
                </SortableContext>
              </div>
            </div>
          )}

          {totalFields === 0 && sectionGroups.length === 0 && (
            <div className="py-6 text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
              <Layers className="w-6 h-6 text-gray-300 mx-auto mb-1" />
              <p className="text-sm text-gray-400">Drop fields here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== TAB CONTENT ====================

function TabContent({
  tab,
  fields,
  groups,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onResizeField,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  tab: CustomTab;
  fields: CustomField[];
  groups: CustomFieldGroup[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
  onResizeField: (id: string) => void;
  onAddGroup: () => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}) {
  const tabGroups = groups.filter(g => g.tabId === tab.id);
  const ungroupedFields = fields.filter(f => f.tabId === tab.id && !f.groupId);
  const totalFields = fields.filter(f => f.tabId === tab.id).length;

  const { isOver, setNodeRef } = useDroppable({
    id: `drop-tab-${tab.id}`,
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-purple-900 dark:text-purple-300">{tab.name}</span>
          <span className="px-1.5 py-0.5 bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded-full">
            {totalFields} fields
          </span>
        </div>
        <button
          onClick={onAddGroup}
          className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-800 rounded"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={`p-3 space-y-3 min-h-[100px] ${isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      >
        {/* Groups */}
        <SortableContext items={tabGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
          {tabGroups.map(group => {
            const groupFields = fields.filter(f => f.groupId === group.id);
            return (
              <SortableGroup
                key={group.id}
                group={group}
                fields={groupFields}
                selectedFieldId={selectedFieldId}
                onSelectField={onSelectField}
                onDeleteField={onDeleteField}
                onResizeField={onResizeField}
                onEditGroup={() => onEditGroup(group.id)}
                onDeleteGroup={() => onDeleteGroup(group.id)}
              />
            );
          })}
        </SortableContext>

        {/* Ungrouped Fields */}
        {ungroupedFields.length > 0 && (
          <div className={tabGroups.length > 0 ? 'pt-2 border-t border-purple-200 dark:border-purple-700' : ''}>
            <div className="grid grid-cols-2 gap-2">
              <SortableContext items={ungroupedFields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
                {ungroupedFields.map(field => (
                  <SortableField
                    key={field.id}
                    field={field}
                    isSelected={selectedFieldId === `field-${field.id}`}
                    onSelect={() => onSelectField(`field-${field.id}`)}
                    onDelete={() => onDeleteField(field.id)}
                    onResize={() => onResizeField(field.id)}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        )}

        {totalFields === 0 && tabGroups.length === 0 && (
          <div className="py-8 text-center border-2 border-dashed border-purple-200 dark:border-purple-700 rounded-lg">
            <Layers className="w-8 h-8 text-purple-300 mx-auto mb-2" />
            <p className="text-sm text-purple-400">Drop fields here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TAB MODAL ====================

function TabModal({
  isOpen,
  onClose,
  onSave,
  tab,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => Promise<void>;
  tab: CustomTab | null;
  module: string;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (tab) {
      setName(tab.name);
      setDescription(tab.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [tab, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err) {
      console.error('Failed to save tab:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {tab ? 'Edit Tab' : 'Create Tab'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Tab Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="e.g., Additional Details"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : tab ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== GROUP MODAL ====================

function GroupModal({
  isOpen,
  onClose,
  onSave,
  group,
  targetSection,
  targetTabId,
  module,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CustomFieldGroup>) => Promise<void>;
  group: CustomFieldGroup | null;
  targetSection?: string;
  targetTabId?: string;
  module: string;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    columns: 2,
    collapsedByDefault: false,
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        columns: group.columns,
        collapsedByDefault: group.collapsedByDefault,
      });
    } else {
      setFormData({ name: '', description: '', columns: 2, collapsedByDefault: false });
    }
  }, [group, isOpen]);

  const handleSave = async () => {
    if (!formData.name) return;
    setSaving(true);
    try {
      await onSave({
        ...formData,
        module,
        section: targetTabId ? undefined : targetSection,
        tabId: targetTabId,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save group:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {group ? 'Edit Group' : 'Create Group'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Columns</label>
                <div className="flex gap-3">
                  {[1, 2].map(n => (
                    <label key={n} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={formData.columns === n}
                        onChange={() => setFormData(prev => ({ ...prev, columns: n }))}
                      />
                      <span className="text-sm">{n} Column{n > 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.collapsedByDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, collapsedByDefault: e.target.checked }))}
                />
                <span className="text-sm">Collapsed by default</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!formData.name || saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : group ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== FIELD MODAL ====================

function FieldModal({
  isOpen,
  onClose,
  onSave,
  fieldType,
  targetSection,
  targetTabId,
  targetGroupId,
  module,
  existingFields,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: Partial<CustomField>) => Promise<void>;
  fieldType: string;
  targetSection: string;
  targetTabId?: string;
  targetGroupId?: string;
  module: string;
  existingFields: CustomField[];
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fieldLabel: '',
    fieldKey: '',
    placeholder: '',
    helpText: '',
    isRequired: false,
    columnSpan: 1,
    fieldOptions: [] as { label: string; value: string }[],
  });
  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        fieldLabel: '',
        fieldKey: '',
        placeholder: '',
        helpText: '',
        isRequired: false,
        columnSpan: 1,
        fieldOptions: [],
      });
    }
  }, [isOpen]);

  const fieldTypeInfo = FIELD_TYPES.find(t => t.value === fieldType);
  const Icon = fieldTypeInfo?.icon || Type;
  const needsOptions = fieldType === 'select' || fieldType === 'multi_select';

  const handleLabelChange = (label: string) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    setFormData(prev => ({ ...prev, fieldLabel: label, fieldKey: key }));
  };

  const isDuplicateKey = existingFields.some(f => f.fieldKey === formData.fieldKey);

  const addOption = () => {
    if (optionInput.trim()) {
      setFormData(prev => ({
        ...prev,
        fieldOptions: [...prev.fieldOptions, { label: optionInput.trim(), value: optionInput.trim() }],
      }));
      setOptionInput('');
    }
  };

  const handleSave = async () => {
    if (!formData.fieldLabel || !formData.fieldKey || isDuplicateKey) return;
    if (needsOptions && formData.fieldOptions.length === 0) return;

    setSaving(true);
    try {
      await onSave({
        module,
        fieldLabel: formData.fieldLabel,
        fieldKey: formData.fieldKey,
        fieldType: fieldType as CustomField['fieldType'],
        placeholder: formData.placeholder || undefined,
        helpText: formData.helpText || undefined,
        isRequired: formData.isRequired,
        columnSpan: formData.columnSpan,
        fieldOptions: formData.fieldOptions,
        section: targetTabId ? 'custom' : targetSection,
        tabId: targetTabId || null,
        groupId: targetGroupId || null,
      });
      onClose();
    } catch (err) {
      console.error('Failed to create field:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg">
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">New {fieldTypeInfo?.label}</h3>
              <p className="text-xs text-gray-500">{fieldTypeInfo?.description}</p>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Label *</label>
                <input
                  type="text"
                  value={formData.fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Key *</label>
                <input
                  type="text"
                  value={formData.fieldKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, fieldKey: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${isDuplicateKey ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Placeholder</label>
              <input
                type="text"
                value={formData.placeholder}
                onChange={(e) => setFormData(prev => ({ ...prev, placeholder: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
              />
            </div>

            {needsOptions && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Options ({formData.fieldOptions.length}) *
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-gray-200 dark:border-slate-700 rounded-lg p-2 mb-2">
                  {formData.fieldOptions.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">No options</p>
                  ) : (
                    formData.fieldOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-slate-800 rounded text-sm">
                        <span>{opt.label}</span>
                        <button onClick={() => setFormData(prev => ({ ...prev, fieldOptions: prev.fieldOptions.filter((_, i) => i !== idx) }))} className="text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
                    placeholder="Add option..."
                  />
                  <button onClick={addOption} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add</button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isRequired}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRequired: e.target.checked }))}
                />
                <span className="text-sm">Required</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Width:</span>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, columnSpan: 1 }))}
                  className={`px-2 py-1 text-xs rounded ${formData.columnSpan === 1 ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
                >Half</button>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, columnSpan: 2 }))}
                  className={`px-2 py-1 text-xs rounded ${formData.columnSpan === 2 ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}
                >Full</button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!formData.fieldLabel || !formData.fieldKey || isDuplicateKey || saving || (needsOptions && formData.fieldOptions.length === 0)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== PROPERTIES PANEL ====================

function PropertiesPanel({
  field,
  onUpdate,
  onClose,
}: {
  field: CustomField | null;
  onUpdate: (fieldId: string, updates: Partial<CustomField>) => void;
  onClose: () => void;
}) {
  const [localField, setLocalField] = useState<CustomField | null>(field);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalField(field);
    setHasChanges(false);
  }, [field]);

  if (!localField) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <MousePointer className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Select a field to edit</p>
      </div>
    );
  }

  const handleChange = (key: keyof CustomField, value: unknown) => {
    setLocalField(prev => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (localField && hasChanges) {
      onUpdate(localField.id, localField);
      setHasChanges(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Properties</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Label</label>
          <input
            type="text"
            value={localField.fieldLabel}
            onChange={(e) => handleChange('fieldLabel', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Placeholder</label>
          <input
            type="text"
            value={localField.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Help Text</label>
          <input
            type="text"
            value={localField.helpText || ''}
            onChange={(e) => handleChange('helpText', e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">Required</span>
          <button
            onClick={() => handleChange('isRequired', !localField.isRequired)}
            className={`w-9 h-5 rounded-full ${localField.isRequired ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`block w-4 h-4 bg-white rounded-full shadow transform transition ${localField.isRequired ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Width</label>
          <div className="flex gap-2">
            {[1, 2].map(n => (
              <button
                key={n}
                onClick={() => handleChange('columnSpan', n)}
                className={`flex-1 py-1.5 text-xs rounded-lg border ${localField.columnSpan === n ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300'}`}
              >
                {n === 1 ? 'Half' : 'Full'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`w-full py-2 rounded-lg text-sm ${hasChanges ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
        >
          {hasChanges ? 'Save Changes' : 'No Changes'}
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function FormDesignerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || 'contacts');

  // Data
  const [fields, setFields] = useState<CustomField[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Modals
  const [tabModal, setTabModal] = useState<{ open: boolean; tab: CustomTab | null }>({ open: false, tab: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: CustomFieldGroup | null; section?: string; tabId?: string }>({ open: false, group: null });
  const [fieldModal, setFieldModal] = useState<{ open: boolean; fieldType: string; section: string; tabId?: string; groupId?: string }>({ open: false, fieldType: '', section: '' });

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<{ type: string; fieldType?: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load data
  useEffect(() => {
    loadData();
  }, [selectedModule]);

  useEffect(() => {
    setSearchParams({ module: selectedModule });
  }, [selectedModule]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fieldsData, tabsData, groupsData] = await Promise.all([
        adminApi.getCustomFields(selectedModule),
        adminApi.getTabs(selectedModule),
        adminApi.getGroups({ module: selectedModule }),
      ]);
      setFields(fieldsData);
      setTabs(tabsData);
      setGroups(groupsData);
      setActiveTab(null);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Tab operations
  const createTab = async (data: { name: string; description?: string }) => {
    const created = await adminApi.createTab({ ...data, module: selectedModule });
    setTabs(prev => [...prev, created]);
  };

  const updateTab = async (data: { name: string; description?: string }) => {
    if (!tabModal.tab) return;
    const updated = await adminApi.updateTab(tabModal.tab.id, data);
    setTabs(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const deleteTab = async (tabId: string) => {
    if (!confirm('Delete this tab? Fields will be moved to Custom Fields section.')) return;
    await adminApi.deleteTab(tabId);
    setTabs(prev => prev.filter(t => t.id !== tabId));
    setFields(prev => prev.map(f => f.tabId === tabId ? { ...f, tabId: null, section: 'custom' } : f));
    if (activeTab === tabId) setActiveTab(null);
  };

  const toggleTab = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const updated = await adminApi.updateTab(tabId, { isActive: !tab.isActive });
    setTabs(prev => prev.map(t => t.id === tabId ? updated : t));
  };

  // Group operations
  const saveGroup = async (data: Partial<CustomFieldGroup>) => {
    if (groupModal.group) {
      const updated = await adminApi.updateGroup(groupModal.group.id, data);
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    } else {
      const created = await adminApi.createGroup(data as Parameters<typeof adminApi.createGroup>[0]);
      setGroups(prev => [...prev, created]);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? Fields will become ungrouped.')) return;
    await adminApi.deleteGroup(groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setFields(prev => prev.map(f => f.groupId === groupId ? { ...f, groupId: null } : f));
  };

  // Field operations
  const createField = async (data: Partial<CustomField>) => {
    const created = await adminApi.createCustomField(data);
    setFields(prev => [...prev, created]);
  };

  const updateField = async (fieldId: string, updates: Partial<CustomField>) => {
    await adminApi.updateCustomField(fieldId, updates);
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const deleteField = async (fieldId: string) => {
    await adminApi.updateCustomField(fieldId, { section: 'custom', tabId: null, groupId: null });
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, section: 'custom', tabId: null, groupId: null } : f));
  };

  const resizeField = async (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const newSpan = field.columnSpan === 2 ? 1 : 2;
    await adminApi.updateCustomField(fieldId, { columnSpan: newSpan });
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, columnSpan: newSpan } : f));
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(String(active.id));
    const data = active.data.current as { type?: string; fieldType?: string } | undefined;
    if (data?.type) {
      setActiveData({ type: data.type, fieldType: data.fieldType });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // New field from palette
    if (activeIdStr.startsWith('new-')) {
      const fieldType = activeIdStr.replace('new-', '');
      let section = 'custom';
      let tabId: string | undefined;
      let groupId: string | undefined;

      if (overIdStr.startsWith('drop-section-')) {
        section = overIdStr.replace('drop-section-', '');
      } else if (overIdStr.startsWith('drop-tab-')) {
        tabId = overIdStr.replace('drop-tab-', '');
      } else if (overIdStr.startsWith('drop-group-')) {
        const gId = overIdStr.replace('drop-group-', '');
        const group = groups.find(g => g.id === gId);
        if (group) {
          groupId = gId;
          tabId = group.tabId || undefined;
          section = group.section || 'custom';
        }
      }

      setFieldModal({ open: true, fieldType, section, tabId, groupId });
      return;
    }

    // Reorder tabs
    if (activeIdStr.startsWith('tab-') && overIdStr.startsWith('tab-')) {
      const activeTabId = activeIdStr.replace('tab-', '');
      const overTabId = overIdStr.replace('tab-', '');
      const oldIndex = tabs.findIndex(t => t.id === activeTabId);
      const newIndex = tabs.findIndex(t => t.id === overTabId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(tabs, oldIndex, newIndex);
        setTabs(reordered);
        await adminApi.reorderTabs(selectedModule, reordered.map(t => t.id));
      }
      return;
    }

    // Reorder groups
    if (activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const activeGroupId = activeIdStr.replace('group-', '');
      const overGroupId = overIdStr.replace('group-', '');
      const activeGroup = groups.find(g => g.id === activeGroupId);
      const overGroup = groups.find(g => g.id === overGroupId);
      
      if (activeGroup && overGroup && activeGroup.section === overGroup.section && activeGroup.tabId === overGroup.tabId) {
        const sameContainerGroups = groups.filter(g => g.section === activeGroup.section && g.tabId === activeGroup.tabId);
        const oldIndex = sameContainerGroups.findIndex(g => g.id === activeGroupId);
        const newIndex = sameContainerGroups.findIndex(g => g.id === overGroupId);
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(sameContainerGroups, oldIndex, newIndex);
          const newGroups = groups.map(g => {
            const idx = reordered.findIndex(r => r.id === g.id);
            return idx !== -1 ? reordered[idx] : g;
          });
          setGroups(newGroups);
          await adminApi.reorderGroups(selectedModule, reordered.map(g => g.id));
        }
      }
      return;
    }

    // Move field to different container
    if (activeIdStr.startsWith('field-')) {
      const fieldId = activeIdStr.replace('field-', '');
      
      if (overIdStr.startsWith('drop-section-')) {
        const section = overIdStr.replace('drop-section-', '');
        await updateField(fieldId, { section, tabId: null, groupId: null });
      } else if (overIdStr.startsWith('drop-tab-')) {
        const tabId = overIdStr.replace('drop-tab-', '');
        await updateField(fieldId, { section: 'custom', tabId, groupId: null });
      } else if (overIdStr.startsWith('drop-group-')) {
        const groupId = overIdStr.replace('drop-group-', '');
        const group = groups.find(g => g.id === groupId);
        if (group) {
          await updateField(fieldId, { section: group.section || 'custom', tabId: group.tabId, groupId });
        }
      } else if (overIdStr.startsWith('field-')) {
        // Reorder fields
        const overFieldId = overIdStr.replace('field-', '');
        const activeField = fields.find(f => f.id === fieldId);
        const overField = fields.find(f => f.id === overFieldId);
        
        if (activeField && overField) {
          if (activeField.section === overField.section && activeField.tabId === overField.tabId && activeField.groupId === overField.groupId) {
            const sameContainerFields = fields.filter(f => 
              f.section === activeField.section && f.tabId === activeField.tabId && f.groupId === activeField.groupId
            ).sort((a, b) => a.displayOrder - b.displayOrder);
            
            const oldIndex = sameContainerFields.findIndex(f => f.id === fieldId);
            const newIndex = sameContainerFields.findIndex(f => f.id === overFieldId);
            
            if (oldIndex !== -1 && newIndex !== -1) {
              const reordered = arrayMove(sameContainerFields, oldIndex, newIndex);
              await adminApi.reorderCustomFields(selectedModule, reordered.map(f => f.id));
              loadData();
            }
          } else {
            // Move to different container
            await updateField(fieldId, { section: overField.section, tabId: overField.tabId, groupId: overField.groupId });
          }
        }
      }
    }
  };

  const selectedField = selectedFieldId ? fields.find(f => `field-${f.id}` === selectedFieldId) : null;
  const canvasWidth = viewMode === 'desktop' ? '' : viewMode === 'tablet' ? 'max-w-2xl mx-auto' : 'max-w-sm mx-auto';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-[calc(100vh-140px)] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Form Designer</h2>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
            >
              {MODULE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
              {(['desktop', 'tablet', 'mobile'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded ${viewMode === mode ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-500'}`}
                >
                  {mode === 'desktop' ? <Monitor className="w-4 h-4" /> : mode === 'tablet' ? <Tablet className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={`p-2 rounded-lg ${showLeftPanel ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}>
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button onClick={() => setShowRightPanel(!showRightPanel)} className={`p-2 rounded-lg ${showRightPanel ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}>
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          {showLeftPanel && (
            <div className="w-56 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-600" />
                  Fields
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {FIELD_TYPES.map(ft => <DraggableFieldType key={ft.value} fieldType={ft} />)}
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-950">
            <div className={`p-4 ${canvasWidth}`}>
              {/* Tabs Navigation */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Tabs</h3>
                  <button
                    onClick={() => setTabModal({ open: true, tab: null })}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                  >
                    <Plus className="w-3 h-3" /> Add Tab
                  </button>
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveTab(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === null ? 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50'
                    }`}
                  >
                    Standard Sections
                  </button>
                  <SortableContext items={tabs.map(t => `tab-${t.id}`)} strategy={verticalListSortingStrategy}>
                    {tabs.map(tab => (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        onEdit={() => setTabModal({ open: true, tab })}
                        onDelete={() => deleteTab(tab.id)}
                        onToggle={() => toggleTab(tab.id)}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>

              {/* Content */}
              {activeTab === null ? (
                <div className="space-y-3">
                  {STANDARD_SECTIONS.map(section => (
                    <SectionComponent
                      key={section.id}
                      sectionId={section.id}
                      label={section.label}
                      isLocked={section.locked}
                      fields={fields}
                      groups={groups}
                      selectedFieldId={selectedFieldId}
                      onSelectField={setSelectedFieldId}
                      onDeleteField={deleteField}
                      onResizeField={resizeField}
                      onAddGroup={() => setGroupModal({ open: true, group: null, section: section.id })}
                      onEditGroup={(id) => setGroupModal({ open: true, group: groups.find(g => g.id === id) || null })}
                      onDeleteGroup={deleteGroup}
                    />
                  ))}
                </div>
              ) : (
                <div>
                  {tabs.filter(t => t.id === activeTab).map(tab => (
                    <TabContent
                      key={tab.id}
                      tab={tab}
                      fields={fields}
                      groups={groups}
                      selectedFieldId={selectedFieldId}
                      onSelectField={setSelectedFieldId}
                      onDeleteField={deleteField}
                      onResizeField={resizeField}
                      onAddGroup={() => setGroupModal({ open: true, group: null, tabId: tab.id })}
                      onEditGroup={(id) => setGroupModal({ open: true, group: groups.find(g => g.id === id) || null })}
                      onDeleteGroup={deleteGroup}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          {showRightPanel && (
            <div className="w-64 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <PropertiesPanel
                field={selectedField || null}
                onUpdate={updateField}
                onClose={() => setSelectedFieldId(null)}
              />
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && activeData?.type === 'new-field' && (
            <div className="flex items-center gap-2 p-2.5 bg-white border-2 border-blue-500 rounded-lg shadow-xl opacity-90">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white">
                {(() => {
                  const Icon = FIELD_TYPES.find(t => t.value === activeData.fieldType)?.icon || Type;
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
              </div>
              <span className="text-sm font-medium">{FIELD_TYPES.find(t => t.value === activeData.fieldType)?.label}</span>
            </div>
          )}
        </DragOverlay>
      </div>

      {/* Modals */}
      <TabModal
        isOpen={tabModal.open}
        onClose={() => setTabModal({ open: false, tab: null })}
        onSave={tabModal.tab ? updateTab : createTab}
        tab={tabModal.tab}
        module={selectedModule}
      />

      <GroupModal
        isOpen={groupModal.open}
        onClose={() => setGroupModal({ open: false, group: null })}
        onSave={saveGroup}
        group={groupModal.group}
        targetSection={groupModal.section}
        targetTabId={groupModal.tabId}
        module={selectedModule}
      />

      <FieldModal
        isOpen={fieldModal.open}
        onClose={() => setFieldModal({ open: false, fieldType: '', section: '' })}
        onSave={createField}
        fieldType={fieldModal.fieldType}
        targetSection={fieldModal.section}
        targetTabId={fieldModal.tabId}
        targetGroupId={fieldModal.groupId}
        module={selectedModule}
        existingFields={fields}
      />

      {error && (
        <div className="fixed bottom-4 right-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}
    </DndContext>
  );
}