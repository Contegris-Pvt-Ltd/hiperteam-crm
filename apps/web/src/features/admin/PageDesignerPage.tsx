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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Users, Building2, Target, Briefcase, GripVertical,
  ChevronRight, Trash2,
  LayoutList, FolderOpen, Layers, PieChart, Link2, Clock,
  Paperclip, StickyNote, CheckSquare, Code, Maximize2, Minus,
  Loader2, Save, RotateCcw, Settings,
  Monitor, Tablet, Smartphone, PanelLeftClose, PanelRightClose,
  ArrowLeft, LayoutTemplate, Columns, Sidebar, Square,
} from 'lucide-react';
import { pageLayoutApi } from '../../api/page-layout.api';
import type {
  PageLayout,
  PageLayoutConfig,
  WidgetConfig,
  RegionConfig,
  WidgetMetadata,
  TemplateMetadata,
  LayoutTemplateType,
  WidgetType,
} from '../../api/page-layout.api';
import { adminApi } from '../../api/admin.api';
import type { CustomTab, CustomFieldGroup } from '../../api/admin.api';

// ==================== CONSTANTS ====================

const MODULE_OPTIONS = [
  { value: 'contacts', label: 'Contacts', icon: Users },
  { value: 'accounts', label: 'Accounts', icon: Building2 },
  { value: 'leads', label: 'Leads', icon: Target },
  { value: 'opportunities', label: 'Opportunities', icon: Briefcase },
];

const LAYOUT_TYPE_OPTIONS = [
  { value: 'detail', label: 'Detail View' },
  { value: 'edit', label: 'Edit View' },
  { value: 'create', label: 'Create View' },
];

const STANDARD_SECTIONS = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'contact', label: 'Contact Details' },
  { id: 'address', label: 'Address' },
  { id: 'social', label: 'Social Profiles' },
  { id: 'other', label: 'Other Information' },
  { id: 'custom', label: 'Custom Fields' },
];

const WIDGET_ICONS: Record<string, typeof LayoutList> = {
  'fields-section': LayoutList,
  'custom-tab': FolderOpen,
  'field-group': Layers,
  'profile-completion': PieChart,
  'related-records': Link2,
  'activity-timeline': Clock,
  'files-attachments': Paperclip,
  'notes': StickyNote,
  'tasks': CheckSquare,
  'custom-html': Code,
  'spacer': Maximize2,
  'divider': Minus,
};

const WIDGET_CATEGORIES = [
  { id: 'fields', label: 'Fields' },
  { id: 'relations', label: 'Relations' },
  { id: 'activity', label: 'Activity' },
  { id: 'content', label: 'Content' },
  { id: 'insights', label: 'Insights' },
  { id: 'layout', label: 'Layout' },
  { id: 'advanced', label: 'Advanced' },
];

const TEMPLATE_ICONS: Record<string, typeof Square> = {
  'single-column': Square,
  'two-column-equal': Columns,
  'two-column-wide-left': Columns,
  'two-column-wide-right': Columns,
  'three-column': Columns,
  'sidebar-left': Sidebar,
  'sidebar-right': Sidebar,
};

// Generate unique ID
const generateId = () => `w${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

// ==================== DRAGGABLE WIDGET (Palette) ====================

function DraggableWidget({ widget }: { widget: WidgetMetadata }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `new-${widget.type}`,
    data: { type: 'new-widget', widgetType: widget.type, widget },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const Icon = WIDGET_ICONS[widget.type] || Square;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm transition-all ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{widget.label}</p>
        <p className="text-[10px] text-gray-500 truncate">{widget.description}</p>
      </div>
    </div>
  );
}

// ==================== SORTABLE WIDGET (Canvas) ====================

function SortableWidget({
  widget,
  isSelected,
  onSelect,
  onDelete,
  onConfigure,
  tabs,
  groups,
}: {
  widget: WidgetConfig;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onConfigure: () => void;
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    data: { type: 'widget', widget },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = WIDGET_ICONS[widget.type] || Square;

  // Get display title
  const getDisplayTitle = () => {
    if (widget.title) return widget.title;
    if (widget.type === 'fields-section' && widget.section) {
      return STANDARD_SECTIONS.find(s => s.id === widget.section)?.label || widget.section;
    }
    if (widget.type === 'custom-tab' && widget.tabId) {
      return tabs.find(t => t.id === widget.tabId)?.name || 'Custom Tab';
    }
    if (widget.type === 'field-group' && widget.groupId) {
      return groups.find(g => g.id === widget.groupId)?.name || 'Field Group';
    }
    if (widget.type === 'related-records' && widget.relatedModule) {
      return `Related ${widget.relatedModule.charAt(0).toUpperCase() + widget.relatedModule.slice(1)}`;
    }
    return widget.type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative ${isDragging ? 'z-50 opacity-50' : ''}`}
    >
      <div
        className={`p-3 bg-white dark:bg-slate-800 border-2 rounded-xl transition-all ${
          isSelected
            ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900'
            : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {getDisplayTitle()}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {widget.type.split('-').join(' ')}
            </p>
          </div>

          <div className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onConfigure(); }}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {widget.collapsed && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
            <ChevronRight className="w-3 h-3" />
            <span>Collapsed by default</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== DROPPABLE REGION ====================

function DroppableRegion({
  regionId,
  region,
  selectedWidgetId,
  onSelectWidget,
  onDeleteWidget,
  onConfigureWidget,
  tabs,
  groups,
}: {
  regionId: string;
  region: RegionConfig;
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  onDeleteWidget: (id: string) => void;
  onConfigureWidget: (id: string) => void;
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `region-${regionId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[200px] p-3 border-2 border-dashed rounded-xl transition-colors ${
        isOver
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-300 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-800/50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          {regionId}
        </h4>
        <span className="text-xs text-gray-400">{region.widgets.length} widgets</span>
      </div>

      {region.widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Layers className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Drop widgets here</p>
        </div>
      ) : (
        <SortableContext items={region.widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {region.widgets.map(widget => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                isSelected={selectedWidgetId === widget.id}
                onSelect={() => onSelectWidget(widget.id)}
                onDelete={() => onDeleteWidget(widget.id)}
                onConfigure={() => onConfigureWidget(widget.id)}
                tabs={tabs}
                groups={groups}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

// ==================== TEMPLATE SELECTOR ====================

function TemplateSelector({
  templates,
  selectedTemplate,
  onSelect,
}: {
  templates: TemplateMetadata[];
  selectedTemplate: LayoutTemplateType;
  onSelect: (template: LayoutTemplateType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map(template => {
        const Icon = TEMPLATE_ICONS[template.id] || Square;
        const isSelected = selectedTemplate === template.id;

        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.id as LayoutTemplateType)}
            className={`p-3 border-2 rounded-xl text-left transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-700 dark:text-slate-300'}`}>
                {template.name}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">{template.description}</p>
            <div className="mt-2 font-mono text-xs text-gray-400">{template.preview}</div>
          </button>
        );
      })}
    </div>
  );
}

// ==================== WIDGET CONFIG MODAL ====================

function WidgetConfigModal({
  isOpen,
  onClose,
  widget,
  onSave,
  tabs,
  groups,
}: {
  isOpen: boolean;
  onClose: () => void;
  widget: WidgetConfig | null;
  onSave: (config: Partial<WidgetConfig>) => void;
  tabs: CustomTab[];
  groups: CustomFieldGroup[];
}) {
  const [config, setConfig] = useState<Partial<WidgetConfig>>({});

  useEffect(() => {
    if (widget) {
      setConfig({ ...widget });
    }
  }, [widget]);

  if (!isOpen || !widget) return null;

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Widget</h3>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={config.title || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                placeholder="Widget title..."
              />
            </div>

            {/* Collapsed */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.collapsed || false}
                onChange={(e) => setConfig(prev => ({ ...prev, collapsed: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">Collapsed by default</span>
            </label>

            {/* Section selector for fields-section */}
            {widget.type === 'fields-section' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Section
                </label>
                <select
                  value={config.section || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="">Select section...</option>
                  {STANDARD_SECTIONS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tab selector for custom-tab */}
            {widget.type === 'custom-tab' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Custom Tab
                </label>
                <select
                  value={config.tabId || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, tabId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="">Select tab...</option>
                  {tabs.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Group selector for field-group */}
            {widget.type === 'field-group' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Field Group
                </label>
                <select
                  value={config.groupId || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, groupId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="">Select group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Related module for related-records */}
            {widget.type === 'related-records' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Related Module
                </label>
                <select
                  value={config.relatedModule || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, relatedModule: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                >
                  <option value="">Select module...</option>
                  {MODULE_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Max items for lists */}
            {['related-records', 'activity-timeline', 'tasks'].includes(widget.type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Max Items
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.maxItems || 5}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxItems: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                />
              </div>
            )}

            {/* Show add button */}
            {['related-records', 'notes', 'tasks', 'files-attachments'].includes(widget.type) && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showAddButton ?? true}
                  onChange={(e) => setConfig(prev => ({ ...prev, showAddButton: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Show add button</span>
              </label>
            )}

            {/* Height for spacer */}
            {widget.type === 'spacer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Height (px)
                </label>
                <input
                  type="number"
                  min="8"
                  max="200"
                  value={config.height || 24}
                  onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 24 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                />
              </div>
            )}

            {/* Custom HTML */}
            {widget.type === 'custom-html' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  HTML Content
                </label>
                <textarea
                  value={config.customContent || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, customContent: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg font-mono text-sm"
                  placeholder="<div>Custom content...</div>"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SAVE LAYOUT MODAL ====================

function SaveLayoutModal({
  isOpen,
  onClose,
  onSave,
  existingLayout,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, isDefault: boolean) => void;
  existingLayout: PageLayout | null;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (existingLayout) {
      setName(existingLayout.name || '');
      setDescription(existingLayout.description || '');
      setIsDefault(existingLayout.isDefault);
    } else {
      setName('');
      setDescription('');
      setIsDefault(false);
    }
  }, [existingLayout, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {existingLayout ? 'Update Layout' : 'Save Layout'}
            </h3>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                placeholder="e.g., Sales Team Layout"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
                placeholder="Optional description..."
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">Set as default layout</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              onClick={() => onSave(name, description, isDefault)}
              disabled={!name?.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
            >
              {existingLayout ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function PageDesignerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Module & Layout Type
  const [selectedModule, setSelectedModule] = useState(searchParams.get('module') || 'contacts');
  const [selectedLayoutType, setSelectedLayoutType] = useState<'detail' | 'edit' | 'create'>(
    (searchParams.get('layoutType') as 'detail' | 'edit' | 'create') || 'detail'
  );

  // Data
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [availableWidgets, setAvailableWidgets] = useState<WidgetMetadata[]>([]);
  const [savedLayouts, setSavedLayouts] = useState<PageLayout[]>([]);
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Current layout being edited
  const [currentLayout, setCurrentLayout] = useState<PageLayout | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<PageLayoutConfig>({
    template: 'sidebar-right',
    regions: {
      main: { id: 'main', widgets: [] },
      sidebar: { id: 'sidebar', widgets: [] },
    },
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // UI State
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeCategory, setActiveCategory] = useState<string>('fields');

  // Modals
  const [configModal, setConfigModal] = useState<{ open: boolean; widgetId: string | null }>({ open: false, widgetId: null });
  const [saveModal, setSaveModal] = useState(false);

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<{ type: string; widgetType?: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadModuleData();
  }, [selectedModule]);

  useEffect(() => {
    setSearchParams({ module: selectedModule, layoutType: selectedLayoutType });
  }, [selectedModule, selectedLayoutType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, widgetsData] = await Promise.all([
        pageLayoutApi.getAvailableTemplates(),
        pageLayoutApi.getAvailableWidgets(),
      ]);
      setTemplates(templatesData);
      setAvailableWidgets(widgetsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModuleData = async () => {
    try {
      const [layoutsData, tabsData, groupsData] = await Promise.all([
        pageLayoutApi.getLayouts(selectedModule, selectedLayoutType),
        adminApi.getTabs(selectedModule),
        adminApi.getGroups({ module: selectedModule }),
      ]);
      setSavedLayouts(layoutsData);
      setTabs(tabsData);
      setGroups(groupsData);

      // Load default layout or create new
      if (layoutsData.length > 0 && layoutsData[0].isDefault) {
        loadLayout(layoutsData[0]);
      } else {
        resetToDefault();
      }
    } catch (err) {
      console.error('Failed to load module data:', err);
    }
  };

  const loadLayout = (layout: PageLayout) => {
    setCurrentLayout(layout);
    setLayoutConfig(layout.config);
    setHasUnsavedChanges(false);
  };

  const resetToDefault = () => {
    setCurrentLayout(null);
    setLayoutConfig({
      template: 'sidebar-right',
      regions: {
        main: {
          id: 'main',
          widgets: [
            { id: generateId(), type: 'fields-section', section: 'basic', title: 'Basic Information' },
            { id: generateId(), type: 'fields-section', section: 'contact', title: 'Contact Details' },
            { id: generateId(), type: 'fields-section', section: 'address', title: 'Address' },
          ],
        },
        sidebar: {
          id: 'sidebar',
          widgets: [
            { id: generateId(), type: 'profile-completion', title: 'Profile Completion' },
            { id: generateId(), type: 'activity-timeline', title: 'Recent Activity', maxItems: 10 },
          ],
        },
      },
    });
    setHasUnsavedChanges(false);
  };

  // Template change
  const handleTemplateChange = (template: LayoutTemplateType) => {
    const templateMeta = templates.find(t => t.id === template);
    if (!templateMeta) return;

    // Migrate widgets to new regions
    const allWidgets = Object.values(layoutConfig.regions).flatMap(r => r.widgets);
    const newRegions: Record<string, RegionConfig> = {};

    templateMeta.regions.forEach((regionId, index) => {
      newRegions[regionId] = {
        id: regionId,
        widgets: index === 0 ? allWidgets : [], // Put all widgets in first region
      };
    });

    setLayoutConfig(prev => ({
      ...prev,
      template,
      regions: newRegions,
    }));
    setHasUnsavedChanges(true);
  };

  // Widget operations
  const addWidget = (widgetType: WidgetType, regionId: string) => {
    const newWidget: WidgetConfig = {
      id: generateId(),
      type: widgetType,
    };

    setLayoutConfig(prev => ({
      ...prev,
      regions: {
        ...prev.regions,
        [regionId]: {
          ...prev.regions[regionId],
          widgets: [...prev.regions[regionId].widgets, newWidget],
        },
      },
    }));
    setHasUnsavedChanges(true);
    setSelectedWidgetId(newWidget.id);
    setConfigModal({ open: true, widgetId: newWidget.id });
  };

  const deleteWidget = (widgetId: string) => {
    setLayoutConfig(prev => {
      const newRegions = { ...prev.regions };
      for (const regionId of Object.keys(newRegions)) {
        newRegions[regionId] = {
          ...newRegions[regionId],
          widgets: newRegions[regionId].widgets.filter(w => w.id !== widgetId),
        };
      }
      return { ...prev, regions: newRegions };
    });
    setHasUnsavedChanges(true);
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId(null);
    }
  };

  const updateWidgetConfig = (widgetId: string, config: Partial<WidgetConfig>) => {
    setLayoutConfig(prev => {
      const newRegions = { ...prev.regions };
      for (const regionId of Object.keys(newRegions)) {
        newRegions[regionId] = {
          ...newRegions[regionId],
          widgets: newRegions[regionId].widgets.map(w =>
            w.id === widgetId ? { ...w, ...config } : w
          ),
        };
      }
      return { ...prev, regions: newRegions };
    });
    setHasUnsavedChanges(true);
  };

  // Save layout
  const handleSave = async (name: string, description: string, isDefault: boolean) => {
    try {
      if (currentLayout && currentLayout.id) {
        const updated = await pageLayoutApi.updateLayout(currentLayout.id, {
          name,
          description,
          config: layoutConfig,
          isDefault,
        });
        setCurrentLayout(updated);
        setSavedLayouts(prev => prev.map(l => l.id === updated.id ? updated : l));
      } else {
        const created = await pageLayoutApi.createLayout({
          module: selectedModule,
          layoutType: selectedLayoutType,
          name,
          description,
          config: layoutConfig,
          isDefault,
        });
        setCurrentLayout(created);
        setSavedLayouts(prev => [...prev, created]);
      }
      setHasUnsavedChanges(false);
      setSaveModal(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(String(active.id));
    const data = active.data.current as { type?: string; widgetType?: string } | undefined;
    if (data?.type) {
      setActiveData({ type: data.type, widgetType: data.widgetType });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // New widget from palette
    if (activeIdStr.startsWith('new-')) {
      const widgetType = activeIdStr.replace('new-', '') as WidgetType;
      if (overIdStr.startsWith('region-')) {
        const regionId = overIdStr.replace('region-', '');
        addWidget(widgetType, regionId);
      }
      return;
    }

    // Reorder within same region
    const activeData = active.data.current as { type?: string; widget?: WidgetConfig } | undefined;
    if (activeData?.type === 'widget' && activeData.widget) {
      // Find source region
      let sourceRegionId: string | null = null;
      for (const [regionId, region] of Object.entries(layoutConfig.regions)) {
        if (region.widgets.some(w => w.id === activeIdStr)) {
          sourceRegionId = regionId;
          break;
        }
      }

      if (!sourceRegionId) return;

      // Determine target
      let targetRegionId: string | null = null;
      let targetIndex: number | null = null;

      if (overIdStr.startsWith('region-')) {
        targetRegionId = overIdStr.replace('region-', '');
        targetIndex = layoutConfig.regions[targetRegionId].widgets.length;
      } else {
        // Dropped on another widget
        for (const [regionId, region] of Object.entries(layoutConfig.regions)) {
          const idx = region.widgets.findIndex(w => w.id === overIdStr);
          if (idx !== -1) {
            targetRegionId = regionId;
            targetIndex = idx;
            break;
          }
        }
      }

      if (!targetRegionId || targetIndex === null) return;

      setLayoutConfig(prev => {
        const newRegions = { ...prev.regions };
        const widget = newRegions[sourceRegionId!].widgets.find(w => w.id === activeIdStr)!;

        // Remove from source
        newRegions[sourceRegionId!] = {
          ...newRegions[sourceRegionId!],
          widgets: newRegions[sourceRegionId!].widgets.filter(w => w.id !== activeIdStr),
        };

        // Add to target
        const targetWidgets = [...newRegions[targetRegionId!].widgets];
        targetWidgets.splice(targetIndex!, 0, widget);
        newRegions[targetRegionId!] = {
          ...newRegions[targetRegionId!],
          widgets: targetWidgets,
        };

        return { ...prev, regions: newRegions };
      });
      setHasUnsavedChanges(true);
    }
  };

  const canvasWidth = viewMode === 'desktop' ? '' : viewMode === 'tablet' ? 'max-w-3xl mx-auto' : 'max-w-md mx-auto';

  // Template region widths
  const getRegionWidths = () => {
    switch (layoutConfig.template) {
      case 'single-column': return { main: 'w-full' };
      case 'two-column-equal': return { left: 'w-1/2', right: 'w-1/2' };
      case 'two-column-wide-left': return { left: 'w-2/3', right: 'w-1/3' };
      case 'two-column-wide-right': return { left: 'w-1/3', right: 'w-2/3' };
      case 'three-column': return { left: 'w-1/3', center: 'w-1/3', right: 'w-1/3' };
      case 'sidebar-left': return { sidebar: 'w-1/4', main: 'w-3/4' };
      case 'sidebar-right': return { main: 'w-3/4', sidebar: 'w-1/4' };
      default: return { main: 'w-full' };
    }
  };

  const regionWidths = getRegionWidths();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
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
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Page Designer</h2>
            </div>

            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
            >
              {MODULE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>

            <select
              value={selectedLayoutType}
              onChange={(e) => setSelectedLayoutType(e.target.value as 'detail' | 'edit' | 'create')}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg text-sm"
            >
              {LAYOUT_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Unsaved</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
              {(['desktop', 'tablet', 'mobile'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded ${viewMode === mode ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-gray-500'}`}
                >
                  {mode === 'desktop' ? <Monitor className="w-4 h-4" /> : mode === 'tablet' ? <Tablet className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </button>
              ))}
            </div>

            <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={`p-2 rounded-lg ${showLeftPanel ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
              <PanelLeftClose className="w-4 h-4" />
            </button>
            <button onClick={() => setShowRightPanel(!showRightPanel)} className={`p-2 rounded-lg ${showRightPanel ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
              <PanelRightClose className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>

            <button
              onClick={() => setSaveModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Widgets */}
          {showLeftPanel && (
            <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Widgets</h3>
              </div>
              
              {/* Categories */}
              <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-slate-700">
                {WIDGET_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-1 text-xs rounded ${
                      activeCategory === cat.id
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {availableWidgets
                  .filter(w => w.category === activeCategory)
                  .map(widget => (
                    <DraggableWidget key={widget.type} widget={widget} />
                  ))}
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-950 p-6">
            <div className={`${canvasWidth}`}>
              {/* Template Selector */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Layout Template</h3>
                <TemplateSelector
                  templates={templates}
                  selectedTemplate={layoutConfig.template}
                  onSelect={handleTemplateChange}
                />
              </div>

              {/* Regions */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Page Content</h3>
                <div className="flex gap-4">
                  {Object.entries(layoutConfig.regions).map(([regionId, region]) => (
                    <div key={regionId} className={regionWidths[regionId as keyof typeof regionWidths] || 'flex-1'}>
                      <DroppableRegion
                        regionId={regionId}
                        region={region}
                        selectedWidgetId={selectedWidgetId}
                        onSelectWidget={setSelectedWidgetId}
                        onDeleteWidget={deleteWidget}
                        onConfigureWidget={(id) => setConfigModal({ open: true, widgetId: id })}
                        tabs={tabs}
                        groups={groups}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Saved Layouts */}
          {showRightPanel && (
            <div className="w-64 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Layouts</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {savedLayouts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No saved layouts</p>
                ) : (
                  savedLayouts.map(layout => (
                    <button
                      key={layout.id}
                      onClick={() => loadLayout(layout)}
                      className={`w-full p-3 text-left border-2 rounded-xl transition-all ${
                        currentLayout?.id === layout.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{layout.name}</span>
                        {layout.isDefault && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Default</span>
                        )}
                      </div>
                      {layout.description && (
                        <p className="text-xs text-gray-500 truncate">{layout.description}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && activeData?.type === 'new-widget' && (
            <div className="flex items-center gap-2 p-2.5 bg-white border-2 border-indigo-500 rounded-lg shadow-xl opacity-90">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                {(() => {
                  const Icon = WIDGET_ICONS[activeData.widgetType || ''] || Square;
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
              </div>
              <span className="text-sm font-medium">
                {availableWidgets.find(w => w.type === activeData.widgetType)?.label}
              </span>
            </div>
          )}
        </DragOverlay>
      </div>

      {/* Modals */}
      <WidgetConfigModal
        isOpen={configModal.open}
        onClose={() => setConfigModal({ open: false, widgetId: null })}
        widget={configModal.widgetId
          ? Object.values(layoutConfig.regions).flatMap(r => r.widgets).find(w => w.id === configModal.widgetId) || null
          : null
        }
        onSave={(config) => {
          if (configModal.widgetId) {
            updateWidgetConfig(configModal.widgetId, config);
          }
        }}
        tabs={tabs}
        groups={groups}
      />

      <SaveLayoutModal
        isOpen={saveModal}
        onClose={() => setSaveModal(false)}
        onSave={handleSave}
        existingLayout={currentLayout}
      />
    </DndContext>
  );
}