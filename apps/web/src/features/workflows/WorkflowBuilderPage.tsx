import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, Save, Zap, Plus, GripVertical, Trash2, ChevronDown,
  ChevronRight, Settings2, UserPlus, Users, Building2, TrendingUp,
  CheckSquare, FolderKanban, GitBranch, Bell, Mail, Webhook, Clock,
  Tag, PenLine, User, Loader2, Check, X, ToggleLeft, ToggleRight,
  Activity, MessageSquare, Smartphone, ZoomIn, ZoomOut, Maximize,
  CheckCircle, XCircle, Paperclip, ListPlus, ListMinus,
} from 'lucide-react';
import type {
  WorkflowAction, ActionType, TriggerModule,
  TriggerType, ConditionGroup, Condition, CreateWorkflowData,
} from '../../api/workflows.api';
import {
  workflowsApi, TRIGGER_MODULES, TRIGGER_TYPES_BY_MODULE,
  ACTION_TYPES, CONDITION_OPERATORS,
} from '../../api/workflows.api';
import { SYSTEM_FIELDS_BY_MODULE } from '../../config/field-registry';
import { api } from '../../lib/api';
import { emailMarketingApi } from '../../api/email-marketing.api';

// ── Types ────────────────────────────────────────────────────
interface DraftAction extends Omit<WorkflowAction, 'id' | 'workflowId'> {
  tempId: string;
}

// ── Helpers ──────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function actionColor(type: ActionType): string {
  const colors: Record<ActionType, string> = {
    assign_owner:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    create_task:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    update_field:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    add_tag:           'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    send_notification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    send_email:        'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800',
    webhook:           'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
    wait:              'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    branch:            'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    create_opportunity:'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    create_project:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    send_whatsapp:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    send_sms:          'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  add_to_email_list:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  remove_from_email_list:'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  };
  return colors[type] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  assign_owner:       User,
  create_task:        CheckSquare,
  update_field:       PenLine,
  add_tag:            Tag,
  send_notification:  Bell,
  send_email:         Mail,
  webhook:            Webhook,
  wait:               Clock,
  branch:             GitBranch,
  create_opportunity: TrendingUp,
  create_project:     FolderKanban,
  send_whatsapp:      MessageSquare,
  send_sms:           Smartphone,
  add_to_email_list:      ListPlus,
  remove_from_email_list: ListMinus,
};

const MODULE_ICONS: Record<TriggerModule, React.ElementType> = {
  leads:         UserPlus,
  contacts:      Users,
  accounts:      Building2,
  opportunities: TrendingUp,
  tasks:         CheckSquare,
  projects:      FolderKanban,
};

// ── Canvas zoom/pan hook ──────────────────────────────────────
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

function useCanvas() {
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach non-passive wheel listener for Ctrl+scroll zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or space+click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const zoomIn = useCallback(() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);
  const resetView = useCallback(() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }, []);

  return {
    zoom, pan, containerRef,
    handlers: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp },
    zoomIn, zoomOut, resetView,
    zoomPercent: Math.round(zoom * 100),
  };
}

// ── Canvas Controls (overlay) ─────────────────────────────────
function CanvasControls({ zoomPercent, onZoomIn, onZoomOut, onReset }: {
  zoomPercent: number; onZoomIn: () => void; onZoomOut: () => void; onReset: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg px-2 py-1.5 z-20">
      <button onClick={onZoomOut} className="p-1.5 text-gray-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Zoom Out">
        <ZoomOut className="w-4 h-4" />
      </button>
      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 w-10 text-center select-none">{zoomPercent}%</span>
      <button onClick={onZoomIn} className="p-1.5 text-gray-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Zoom In">
        <ZoomIn className="w-4 h-4" />
      </button>
      <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />
      <button onClick={onReset} className="p-1.5 text-gray-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Reset View">
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Custom fields cache (module → fields) ────────────────────
const customFieldsCache: Record<string, { key: string; label: string; type: string; options?: { label: string; value: string }[] }[]> = {};
const customFieldsLoading: Record<string, boolean> = {};

function useCustomFields(module: TriggerModule | '') {
  const [fields, setFields] = useState<{ key: string; label: string; type: string; options?: { label: string; value: string }[] }[]>([]);

  useEffect(() => {
    if (!module) return;
    if (customFieldsCache[module]) {
      setFields(customFieldsCache[module]);
      return;
    }
    if (customFieldsLoading[module]) return;
    customFieldsLoading[module] = true;
    api.get(`/admin/custom-fields?module=${module}`)
      .then(res => {
        const mapped = (res.data ?? [])
          .filter((f: any) => f.isActive !== false)
          .map((f: any) => ({
            key: f.fieldKey,
            label: f.fieldLabel,
            type: f.fieldType,
            options: f.fieldOptions,
          }));
        customFieldsCache[module] = mapped;
        setFields(mapped);
      })
      .catch(() => {})
      .finally(() => { customFieldsLoading[module] = false; });
  }, [module]);

  return fields;
}

// ── Condition Builder ────────────────────────────────────────
function ConditionRow({
  condition, module, onChange, onRemove,
}: {
  condition: Condition;
  module: TriggerModule;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const systemFields = SYSTEM_FIELDS_BY_MODULE[module] ?? [];
  const customFields = useCustomFields(module);

  // Find the field definition from either system or custom
  const isCustom = condition.fieldType === 'custom';
  const customDef = customFields.find(f => f.key === condition.field);
  const systemDef: any = systemFields.find((f: any) => f.fieldKey === condition.field);
  const fieldType: string = isCustom ? (customDef?.type ?? 'text') : (systemDef?.fieldType ?? 'text');

  // Get select options if applicable
  const selectOptions: { label: string; value: string }[] =
    (isCustom ? customDef?.options : systemDef?.options) ?? [];

  const relevantOps = CONDITION_OPERATORS.filter(op =>
    op.types.includes(
      fieldType === 'number' ? 'number' :
      fieldType === 'select' || fieldType === 'multi_select' ? 'select' :
      fieldType === 'checkbox' ? 'boolean' : 'text'
    )
  );

  const noValueOps = ['is_empty', 'is_not_empty', 'any_change'];

  const handleFieldChange = (value: string) => {
    // Determine if it's a custom field
    const cf = customFields.find(f => f.key === value);
    onChange({
      ...condition,
      field: value,
      fieldType: cf ? 'custom' : 'system',
      operator: 'equals',
      value: '',
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field */}
      <select
        value={condition.field}
        onChange={e => handleFieldChange(e.target.value)}
        className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="">Select field…</option>
        <optgroup label="System Fields">
          {systemFields.filter((f: any) => f.isEditable).map((f: any) => (
            <option key={`sys_${f.fieldKey}`} value={f.fieldKey}>{f.fieldLabel}</option>
          ))}
        </optgroup>
        {customFields.length > 0 && (
          <optgroup label="Custom Fields">
            {customFields.map(f => (
              <option key={`cf_${f.key}`} value={f.key}>{f.label}</option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={e => onChange({ ...condition, operator: e.target.value })}
        className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="">Operator…</option>
        {relevantOps.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value */}
      {!noValueOps.includes(condition.operator) && (
        (fieldType === 'select' || fieldType === 'multi_select') && selectOptions.length > 0 ? (
          <select
            value={condition.value ?? ''}
            onChange={e => onChange({ ...condition, value: e.target.value })}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-32"
          >
            <option value="">Select…</option>
            {selectOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : fieldType === 'checkbox' ? (
          <select
            value={condition.value ?? ''}
            onChange={e => onChange({ ...condition, value: e.target.value })}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-32"
          >
            <option value="">Select…</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ) : (
          <input
            type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
            value={condition.value ?? ''}
            onChange={e => onChange({ ...condition, value: e.target.value })}
            placeholder="Value…"
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-32"
          />
        )
      )}

      <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ConditionGroupBuilder({
  group, module, onChange, depth = 0,
}: {
  group: ConditionGroup;
  module: TriggerModule;
  onChange: (g: ConditionGroup) => void;
  depth?: number;
}) {
  const addCondition = () => {
    const newCond: Condition = { id: uid(), type: 'condition', field: '', fieldType: 'system', operator: 'equals', value: '' };
    onChange({ ...group, items: [...group.items, newCond] });
  };

  const updateItem = (index: number, updated: Condition | ConditionGroup) => {
    const items = [...group.items];
    items[index] = updated;
    onChange({ ...group, items });
  };

  const removeItem = (index: number) => {
    onChange({ ...group, items: group.items.filter((_, i) => i !== index) });
  };

  return (
    <div className={`${depth > 0 ? 'pl-4 border-l-2 border-violet-200 dark:border-violet-800 ml-2' : ''} space-y-2`}>
      {/* Match toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">Match</span>
        <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
          {(['all', 'any'] as const).map(m => (
            <button
              key={m}
              onClick={() => onChange({ ...group, match: m })}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                group.match === m
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {m === 'all' ? 'ALL conditions' : 'ANY condition'}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {group.items.map((item, idx) => (
        <div key={'id' in item ? item.id : idx}>
          {'match' in item ? (
            <ConditionGroupBuilder group={item as ConditionGroup} module={module} onChange={g => updateItem(idx, g)} depth={depth + 1} />
          ) : (
            <ConditionRow
              condition={item as Condition}
              module={module}
              onChange={c => updateItem(idx, c)}
              onRemove={() => removeItem(idx)}
            />
          )}
        </div>
      ))}

      {group.items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-slate-500 italic">No conditions — workflow runs for all events of this type.</p>
      )}

      <button
        onClick={addCondition}
        className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium"
      >
        <Plus className="w-3 h-3" /> Add condition
      </button>
    </div>
  );
}

// ── Trigger Block ────────────────────────────────────────────
function TriggerBlock({
  module, triggerType, filters, selected,
  onSelectModule, onSelectTrigger, onFiltersChange, onClick,
}: {
  module: TriggerModule | '';
  triggerType: TriggerType | '';
  filters: ConditionGroup;
  selected: boolean;
  onSelectModule: (m: TriggerModule) => void;
  onSelectTrigger: (t: TriggerType) => void;
  onFiltersChange: (g: ConditionGroup) => void;
  onClick: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const ModIcon = module ? (MODULE_ICONS[module] ?? Zap) : Zap;
  const triggerTypes = module ? TRIGGER_TYPES_BY_MODULE[module] : [];
  const hasFilters = filters.items.length > 0;

  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-slate-800 rounded-xl border-2 transition-all cursor-pointer ${
        selected
          ? 'border-violet-500 shadow-lg shadow-violet-500/10'
          : 'border-gray-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">Trigger</div>
          {module && triggerType ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-white">
                <ModIcon className="w-3.5 h-3.5" />
                {TRIGGER_MODULES.find(m => m.value === module)?.label}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-slate-300">
                {TRIGGER_TYPES_BY_MODULE[module]?.find(t => t.value === triggerType)?.label}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">Choose when this workflow runs…</span>
          )}
        </div>
        {hasFilters && (
          <span className="flex-shrink-0 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
            {filters.items.length} filter{filters.items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Inline selectors (show when selected) */}
      {selected && (
        <div className="px-4 pb-4 space-y-3" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Module</label>
              <select
                value={module}
                onChange={e => onSelectModule(e.target.value as TriggerModule)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select module…</option>
                {TRIGGER_MODULES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Event</label>
              <select
                value={triggerType}
                onChange={e => onSelectTrigger(e.target.value as TriggerType)}
                disabled={!module}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                <option value="">Select event…</option>
                {triggerTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filters */}
          {module && (
            <div>
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                {filtersOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Trigger Filters (optional)
                {hasFilters && <span className="text-violet-600 dark:text-violet-400">• {filters.items.length}</span>}
              </button>
              {filtersOpen && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <ConditionGroupBuilder group={filters} module={module as TriggerModule} onChange={onFiltersChange} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action Block (sortable) ───────────────────────────────────
function SortableActionBlock({
  action, selected, onClick, onRemove,
}: {
  action: DraftAction;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.tempId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const meta = ACTION_TYPES.find(a => a.value === action.actionType);
  const AIcon = ACTION_ICONS[action.actionType] ?? Settings2;
  const colorClass = actionColor(action.actionType);

  const summary = getActionSummary(action);

  return (
    <div ref={setNodeRef} style={style} className={`relative bg-white dark:bg-slate-800 rounded-xl border-2 transition-all ${
      selected
        ? 'border-violet-500 shadow-lg shadow-violet-500/10'
        : 'border-gray-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'
    }`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onClick}>
        {/* Drag handle */}
        <button
          {...attributes} {...listeners}
          className="p-1 text-gray-300 dark:text-slate-600 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${colorClass}`}>
          <AIcon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 dark:text-white">{meta?.label ?? action.actionType}</div>
          {summary && <div className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{summary}</div>}
        </div>

        {/* Remove */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function getActionSummary(action: DraftAction): string {
  const c = action.config ?? {};
  switch (action.actionType) {
    case 'assign_owner':       return c.algorithm ? `${c.algorithm.replace(/_/g, ' ')} — ${(c.pool ?? []).length} user(s)` : '';
    case 'create_task':        return c.title ? `"${c.title}"` : '';
    case 'update_field':       return c.fieldKey ? `${c.fieldKey} → ${c.value}` : '';
    case 'add_tag':            return c.tag ? `#${c.tag}` : '';
    case 'send_notification':  return c.message ? c.message.slice(0, 40) : '';
    case 'webhook':            return c.url ? `${c.method ?? 'POST'} ${c.url}`.slice(0, 50) : '';
    case 'wait':               return c.hours || c.minutes ? `${c.hours ?? 0}h ${c.minutes ?? 0}m` : '';
    case 'branch':             return 'If/Else condition split';
    case 'create_opportunity': return c.name ? `"${c.name}"` : '';
    case 'create_project':     return c.name ? `"${c.name}"` : c.templateId ? 'From template' : '';
    case 'send_email':         return c.subject ? `"${c.subject}"`.slice(0, 50) : '';
    case 'send_whatsapp':      return c.message ? c.message.slice(0, 40) : '';
    case 'send_sms':           return c.message ? c.message.slice(0, 40) : '';
    default:                   return '';
  }
}

// ── Add Action Menu ───────────────────────────────────────────
function AddActionMenu({ onAdd }: { onAdd: (type: ActionType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-xl text-sm font-medium transition-colors w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add Action
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">Choose action</div>
            {ACTION_TYPES.map(at => {
              const Icon = ACTION_ICONS[at.value] ?? Settings2;
              const col = actionColor(at.value);
              return (
                <button
                  key={at.value}
                  onClick={() => { onAdd(at.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs ${col}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-white">{at.label}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500">{at.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Config Panels ─────────────────────────────────────────────
function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PanelInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
    />
  );
}

function PanelSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// User picker (fetches users from API)
function UserPoolPicker({ pool, onChange }: { pool: string[]; onChange: (ids: string[]) => void }) {
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/users?limit=200').then(r => {
      if (!cancelled) setUsers(r.data?.data ?? r.data ?? []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => {
    onChange(pool.includes(id) ? pool.filter(p => p !== id) : [...pool, id]);
  };

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading users…</div>;

  return (
    <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg divide-y divide-gray-100 dark:divide-slate-700">
      {users.map(u => (
        <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
          <input type="checkbox" checked={pool.includes(u.id)} onChange={() => toggle(u.id)}
            className="rounded text-violet-600 focus:ring-violet-500" />
          <span className="text-sm text-gray-700 dark:text-slate-300">{u.firstName} {u.lastName}</span>
          <span className="text-xs text-gray-400 truncate">{u.email}</span>
        </label>
      ))}
      {users.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No users found</div>}
    </div>
  );
}

function AssignOwnerPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const algorithms = [
    { value: 'round_robin',  label: 'Round Robin' },
    { value: 'weighted',     label: 'Weighted' },
    { value: 'load_based',   label: 'Load Based (fewest records)' },
    { value: 'territory',    label: 'Territory Match' },
    { value: 'skill_match',  label: 'Skill Match' },
    { value: 'sticky',       label: 'Sticky (same as account/contact)' },
  ];
  return (
    <div className="space-y-4">
      <PanelField label="Algorithm">
        <PanelSelect value={config.algorithm ?? 'round_robin'} onChange={v => onChange({ ...config, algorithm: v })} options={algorithms} />
      </PanelField>
      <PanelField label="User Pool (who can be assigned)">
        <UserPoolPicker pool={config.pool ?? []} onChange={ids => onChange({ ...config, pool: ids })} />
      </PanelField>
      {config.pool?.length > 0 && (
        <p className="text-xs text-gray-400">{config.pool.length} user{config.pool.length !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}

function CreateTaskPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [taskTypes, setTaskTypes] = useState<{ id: string; name: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string }[]>([]);
  const [priorities, setPriorities] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/tasks/types').then(r => r.data),
      api.get('/tasks/statuses').then(r => r.data),
      api.get('/tasks/priorities').then(r => r.data),
      api.get('/users?limit=200').then(r => r.data?.data ?? r.data ?? []),
    ]).then(([types, stats, prios, usrs]) => {
      if (cancelled) return;
      setTaskTypes(types.filter((t: any) => t.isActive));
      setStatuses(stats.filter((s: any) => s.isActive));
      setPriorities(prios.filter((p: any) => p.isActive));
      setUsers(usrs);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="text-xs text-gray-400 py-2">Loading task options…</div>;

  return (
    <div className="space-y-4">
      <PanelField label="Task Title">
        <PanelInput value={config.title ?? ''} onChange={v => onChange({ ...config, title: v })}
          placeholder='e.g. Follow up with {{trigger.firstName}}' />
        <p className="text-xs text-gray-400 mt-1">Use {'{{trigger.fieldName}}'} to insert values</p>
      </PanelField>
      <PanelField label="Description">
        <textarea
          value={config.description ?? ''} onChange={e => onChange({ ...config, description: e.target.value })}
          placeholder="Optional task description…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </PanelField>
      <PanelField label="Task Type">
        <PanelSelect value={config.taskTypeId ?? ''} onChange={v => onChange({ ...config, taskTypeId: v })}
          options={[{ value: '', label: 'Default' }, ...taskTypes.map(t => ({ value: t.id, label: t.name }))]} />
      </PanelField>
      <PanelField label="Status">
        <PanelSelect value={config.statusId ?? ''} onChange={v => onChange({ ...config, statusId: v })}
          options={[{ value: '', label: 'Default (Open)' }, ...statuses.map(s => ({ value: s.id, label: s.name }))]} />
      </PanelField>
      <PanelField label="Priority">
        <PanelSelect value={config.priorityId ?? ''} onChange={v => onChange({ ...config, priorityId: v })}
          options={[{ value: '', label: 'Default' }, ...priorities.map(p => ({ value: p.id, label: p.name }))]} />
      </PanelField>
      <div className="grid grid-cols-2 gap-3">
        <PanelField label="Due (days from now)">
          <PanelInput type="number" value={config.dueOffsetDays ?? ''} onChange={v => onChange({ ...config, dueOffsetDays: parseInt(v) || 0 })} placeholder="e.g. 3" />
        </PanelField>
        <PanelField label="Start (days from now)">
          <PanelInput type="number" value={config.startOffsetDays ?? ''} onChange={v => onChange({ ...config, startOffsetDays: parseInt(v) || 0 })} placeholder="e.g. 0" />
        </PanelField>
      </div>
      <PanelField label="Estimated Minutes">
        <PanelInput type="number" value={config.estimatedMinutes ?? ''} onChange={v => onChange({ ...config, estimatedMinutes: parseInt(v) || 0 })} placeholder="e.g. 30" />
      </PanelField>
      <PanelField label="Assign To">
        <PanelSelect value={config.assignedTo ?? 'owner'} onChange={v => onChange({ ...config, assignedTo: v })}
          options={[
            { value: 'owner', label: 'Record Owner' },
            { value: 'trigger_user', label: 'User who triggered' },
            { value: 'specific', label: 'Specific User' },
          ]} />
      </PanelField>
      {config.assignedTo === 'specific' && (
        <PanelField label="Select User">
          <PanelSelect value={config.specificUserId ?? ''} onChange={v => onChange({ ...config, specificUserId: v })}
            options={[{ value: '', label: 'Select user…' }, ...users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))]} />
        </PanelField>
      )}
      <PanelField label="Tags">
        <PanelInput value={config.tags ?? ''} onChange={v => onChange({ ...config, tags: v })}
          placeholder="Comma-separated, e.g. follow-up, workflow" />
        <p className="text-xs text-gray-400 mt-1">Separate multiple tags with commas</p>
      </PanelField>
    </div>
  );
}

function UpdateFieldPanel({ config, onChange, module }: { config: any; onChange: (c: any) => void; module: TriggerModule }) {
  const systemFields = (SYSTEM_FIELDS_BY_MODULE[module] ?? []).filter((f: any) => f.isEditable);
  return (
    <div className="space-y-4">
      <PanelField label="Field to Update">
        <PanelSelect value={config.fieldKey ?? ''} onChange={v => onChange({ ...config, fieldKey: v })}
          options={[{ value: '', label: 'Select field…' }, ...systemFields.map((f: any) => ({ value: f.fieldKey, label: f.fieldLabel }))]} />
      </PanelField>
      <PanelField label="New Value">
        <PanelInput value={config.value ?? ''} onChange={v => onChange({ ...config, value: v })} placeholder="Enter value…" />
        <p className="text-xs text-gray-400 mt-1">Use {'{{trigger.fieldName}}'} for dynamic values</p>
      </PanelField>
    </div>
  );
}

function AddTagPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-4">
      <PanelField label="Tag to Add">
        <PanelInput value={config.tag ?? ''} onChange={v => onChange({ ...config, tag: v })} placeholder="e.g. hot-lead" />
      </PanelField>
    </div>
  );
}

function SendNotificationPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-4">
      <PanelField label="Title">
        <PanelInput value={config.title ?? ''} onChange={v => onChange({ ...config, title: v })} placeholder="Notification title" />
      </PanelField>
      <PanelField label="Message">
        <textarea
          value={config.message ?? ''} onChange={e => onChange({ ...config, message: e.target.value })}
          placeholder='e.g. New lead assigned: {{trigger.firstName}} {{trigger.lastName}}'
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Use {'{{trigger.fieldName}}'} for dynamic values</p>
      </PanelField>
      <PanelField label="Send To">
        <PanelSelect value={config.to ?? 'owner'} onChange={v => onChange({ ...config, to: v })}
          options={[{ value: 'owner', label: 'Record Owner' }, { value: 'specific', label: 'Specific User' }]} />
      </PanelField>
    </div>
  );
}

// ── Key-Value row helper for Webhook ─────────────────────────
function KVRow({ item, onChange, onRemove }: {
  item: { key: string; value: string; enabled?: boolean };
  onChange: (item: { key: string; value: string; enabled?: boolean }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="checkbox" checked={item.enabled !== false}
        onChange={e => onChange({ ...item, enabled: e.target.checked })}
        className="accent-violet-600 w-3.5 h-3.5 flex-shrink-0" />
      <input value={item.key} onChange={e => onChange({ ...item, key: e.target.value })}
        placeholder="Key" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
      <input value={item.value} onChange={e => onChange({ ...item, value: e.target.value })}
        placeholder="Value" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500" />
      <button onClick={onRemove} className="text-gray-400 hover:text-red-500 p-0.5 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function KVList({ items, onChange, addLabel }: {
  items: { key: string; value: string; enabled?: boolean }[];
  onChange: (items: { key: string; value: string; enabled?: boolean }[]) => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <KVRow key={i} item={item}
          onChange={updated => { const next = [...items]; next[i] = updated; onChange(next); }}
          onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
      <button onClick={() => onChange([...items, { key: '', value: '', enabled: true }])}
        className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 mt-1">
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  );
}

function WebhookPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('headers');
  const tabs = [
    { key: 'params' as const, label: 'Params' },
    { key: 'headers' as const, label: 'Headers' },
    { key: 'body' as const, label: 'Body' },
  ];

  const params: { key: string; value: string; enabled?: boolean }[] = config.params ?? [];
  const headers: { key: string; value: string; enabled?: boolean }[] = config.headers ?? [{ key: 'Content-Type', value: 'application/json', enabled: true }];
  const bodyType: 'json' | 'form-data' | 'raw' | 'none' = config.bodyType ?? 'json';
  const formData: { key: string; value: string; enabled?: boolean }[] = config.formData ?? [];

  return (
    <div className="space-y-4">
      {/* URL + Method row */}
      <div className="flex gap-2">
        <div className="w-24">
          <PanelSelect value={config.method ?? 'POST'} onChange={v => onChange({ ...config, method: v })}
            options={['GET','POST','PUT','PATCH','DELETE'].map(m => ({ value: m, label: m }))} />
        </div>
        <div className="flex-1">
          <PanelInput value={config.url ?? ''} onChange={v => onChange({ ...config, url: v })} placeholder="https://api.example.com/webhook" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
            }`}>
            {t.label}
            {t.key === 'params' && params.length > 0 && <span className="ml-1 text-[10px] bg-gray-200 dark:bg-slate-600 rounded-full px-1.5">{params.length}</span>}
            {t.key === 'headers' && headers.length > 0 && <span className="ml-1 text-[10px] bg-gray-200 dark:bg-slate-600 rounded-full px-1.5">{headers.length}</span>}
          </button>
        ))}
      </div>

      {/* Params tab */}
      {activeTab === 'params' && (
        <div>
          <p className="text-[10px] text-gray-400 mb-2">Query parameters appended to the URL.</p>
          <KVList items={params} onChange={p => onChange({ ...config, params: p })} addLabel="Add Parameter" />
        </div>
      )}

      {/* Headers tab */}
      {activeTab === 'headers' && (
        <div>
          <KVList items={headers} onChange={h => onChange({ ...config, headers: h })} addLabel="Add Header" />
        </div>
      )}

      {/* Body tab */}
      {activeTab === 'body' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {(['none', 'json', 'form-data', 'raw'] as const).map(bt => (
              <label key={bt} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 cursor-pointer">
                <input type="radio" name="bodyType" value={bt} checked={bodyType === bt}
                  onChange={() => onChange({ ...config, bodyType: bt })}
                  className="accent-violet-600 w-3 h-3" />
                {bt === 'form-data' ? 'form-data' : bt === 'json' ? 'JSON' : bt === 'raw' ? 'Raw' : 'None'}
              </label>
            ))}
          </div>
          {bodyType === 'json' && (
            <textarea value={config.bodyJson ?? '{\n  \n}'} onChange={e => onChange({ ...config, bodyJson: e.target.value })}
              placeholder='{"key": "value"}' rows={6}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          )}
          {bodyType === 'form-data' && (
            <KVList items={formData} onChange={fd => onChange({ ...config, formData: fd })} addLabel="Add Field" />
          )}
          {bodyType === 'raw' && (
            <textarea value={config.bodyRaw ?? ''} onChange={e => onChange({ ...config, bodyRaw: e.target.value })}
              placeholder="Raw body content" rows={6}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          )}
        </div>
      )}

      {/* SSL Verification */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
        <span className="text-xs text-gray-600 dark:text-slate-400">SSL Certificate Verification</span>
        <button onClick={() => onChange({ ...config, verifySsl: !(config.verifySsl !== false) })}
          className="flex items-center gap-1.5 text-xs">
          {config.verifySsl !== false
            ? <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600 dark:text-green-400 font-medium">Enabled</span></>
            : <><ToggleLeft className="w-5 h-5 text-gray-400" /><span className="text-gray-400 font-medium">Disabled</span></>
          }
        </button>
      </div>

      {/* Timeout */}
      <PanelField label="Timeout (seconds)">
        <PanelInput type="number" value={config.timeoutSeconds ?? 30} onChange={v => onChange({ ...config, timeoutSeconds: parseInt(v) || 30 })} />
      </PanelField>
    </div>
  );
}

function WaitPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 dark:text-slate-500">Wait before executing the next action.</p>
      <div className="grid grid-cols-2 gap-3">
        <PanelField label="Hours">
          <PanelInput type="number" value={config.hours ?? 0} onChange={v => onChange({ ...config, hours: parseInt(v) || 0 })} />
        </PanelField>
        <PanelField label="Minutes">
          <PanelInput type="number" value={config.minutes ?? 0} onChange={v => onChange({ ...config, minutes: parseInt(v) || 0 })} />
        </PanelField>
      </div>
    </div>
  );
}

function BranchPanel({ config, onChange, module }: { config: any; onChange: (c: any) => void; module: TriggerModule }) {
  const group: ConditionGroup = config.condition ?? { id: uid(), match: 'all', items: [] };
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-slate-400">
        If conditions match → run <span className="font-medium text-green-600">YES</span> branch.
        Otherwise → run <span className="font-medium text-red-500">NO</span> branch.
      </p>
      <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <ConditionGroupBuilder group={group} module={module} onChange={g => onChange({ ...config, condition: g })} />
      </div>
    </div>
  );
}

function CreateOpportunityPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-4">
      <PanelField label="Opportunity Name">
        <PanelInput value={config.name ?? ''} onChange={v => onChange({ ...config, name: v })} placeholder="Auto-generated if empty" />
      </PanelField>
    </div>
  );
}

function CreateProjectPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string | null; estimatedDays: number | null }[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    setLoadingTemplates(true);
    api.get('/projects/templates')
      .then(res => setTemplates((res.data ?? []).map((t: any) => ({
        id: t.id, name: t.name, description: t.description, estimatedDays: t.estimated_days ?? t.estimatedDays,
      }))))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  return (
    <div className="space-y-4">
      <PanelField label="Project Template">
        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Loading templates…</div>
        ) : (
          <PanelSelect
            value={config.templateId ?? ''}
            onChange={v => onChange({ ...config, templateId: v || null })}
            options={[
              { value: '', label: 'No template (blank project)' },
              ...templates.map(t => ({ value: t.id, label: `${t.name}${t.estimatedDays ? ` (${t.estimatedDays}d)` : ''}` })),
            ]}
          />
        )}
        {config.templateId && templates.find(t => t.id === config.templateId)?.description && (
          <p className="text-[10px] text-gray-400 mt-1">{templates.find(t => t.id === config.templateId)!.description}</p>
        )}
      </PanelField>
      <PanelField label="Project Name">
        <PanelInput value={config.name ?? ''} onChange={v => onChange({ ...config, name: v })} placeholder="Auto-generated if empty — supports {{trigger.name}}" />
      </PanelField>
      <PanelField label="Description">
        <textarea
          value={config.description ?? ''} onChange={e => onChange({ ...config, description: e.target.value })}
          placeholder="Optional project description — supports {{trigger.fieldName}}"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </PanelField>
    </div>
  );
}

function SendEmailPanel({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const [showCcBcc, setShowCcBcc] = useState(!!(config.cc || config.bcc));

  return (
    <div className="space-y-4">
      <PanelField label="Send To">
        <PanelSelect value={config.to ?? 'record_email'} onChange={v => onChange({ ...config, to: v })}
          options={[
            { value: 'record_email', label: 'Record Email' },
            { value: 'owner_email', label: 'Record Owner Email' },
            { value: 'specific', label: 'Specific Email Address' },
          ]} />
      </PanelField>
      {config.to === 'specific' && (
        <PanelField label="Email Address">
          <PanelInput value={config.toEmail ?? ''} onChange={v => onChange({ ...config, toEmail: v })} placeholder="user@example.com" />
        </PanelField>
      )}

      {/* CC / BCC toggle */}
      {!showCcBcc && (
        <button
          type="button"
          onClick={() => setShowCcBcc(true)}
          className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          + Add CC / BCC
        </button>
      )}
      {showCcBcc && (
        <>
          <PanelField label="CC">
            <PanelInput value={config.cc ?? ''} onChange={v => onChange({ ...config, cc: v })} placeholder="Comma-separated emails" />
          </PanelField>
          <PanelField label="BCC">
            <PanelInput value={config.bcc ?? ''} onChange={v => onChange({ ...config, bcc: v })} placeholder="Comma-separated emails" />
          </PanelField>
        </>
      )}

      <PanelField label="Subject">
        <PanelInput value={config.subject ?? ''} onChange={v => onChange({ ...config, subject: v })} placeholder="e.g. New lead: {{trigger.firstName}}" />
      </PanelField>

      <PanelField label="Body (HTML)">
        <textarea
          value={config.body ?? ''} onChange={e => onChange({ ...config, body: e.target.value })}
          placeholder="Email body — supports {{trigger.fieldName}} placeholders"
          rows={6}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </PanelField>

      <div className="text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
        <div className="font-medium text-gray-500 dark:text-slate-400 mb-1">Available placeholders:</div>
        <code className="text-[11px]">{'{{trigger.firstName}}'}, {'{{trigger.email}}'}, {'{{trigger.company}}'}, {'{{trigger.phone}}'}, {'{{trigger.status}}'}</code>
      </div>

      {/* Attachments toggle */}
      <PanelField label="Include Attachments">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ ...config, includeAttachments: !config.includeAttachments })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              config.includeAttachments ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              config.includeAttachments ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Attach record documents</span>
          </div>
        </div>
      </PanelField>
    </div>
  );
}

function SendMessagePanel({ config, onChange, label }: { config: any; onChange: (c: any) => void; label: string }) {
  return (
    <div className="space-y-4">
      <PanelField label="Send To">
        <PanelSelect value={config.to ?? 'record_phone'} onChange={v => onChange({ ...config, to: v })}
          options={[
            { value: 'record_phone', label: 'Record Phone/Mobile' },
            { value: 'owner_phone', label: 'Owner Phone' },
            { value: 'specific', label: 'Specific Number' },
          ]} />
      </PanelField>
      {config.to === 'specific' && (
        <PanelField label="Phone Number">
          <PanelInput value={config.toPhone ?? ''} onChange={v => onChange({ ...config, toPhone: v })} placeholder="+1234567890" />
        </PanelField>
      )}
      <PanelField label={label}>
        <textarea
          value={config.message ?? ''} onChange={e => onChange({ ...config, message: e.target.value })}
          placeholder={'Message body — supports {{trigger.fieldName}} placeholders'}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </PanelField>
    </div>
  );
}

// ── Email List cache ──────────────────────────────────────────
const emailListsCache: { lists: { id: string; name: string }[]; loaded: boolean } = { lists: [], loaded: false };

function useEmailLists() {
  const [lists, setLists] = useState<{ id: string; name: string }[]>(emailListsCache.lists);
  const [loading, setLoading] = useState(!emailListsCache.loaded);

  useEffect(() => {
    if (emailListsCache.loaded) {
      setLists(emailListsCache.lists);
      setLoading(false);
      return;
    }
    emailMarketingApi.getLists()
      .then((data) => {
        emailListsCache.lists = data;
        emailListsCache.loaded = true;
        setLists(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { lists, loading };
}

function EmailListPanel({ config, onChange, module }: { config: any; onChange: (c: any) => void; module: TriggerModule }) {
  const { lists, loading } = useEmailLists();
  const isAccountTrigger = module === 'accounts';

  return (
    <div className="space-y-4">
      <PanelField label="Select List">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading lists...
          </div>
        ) : lists.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-slate-400">No lists found. Configure MailerLite or Mailchimp in Integrations first.</p>
        ) : (
          <PanelSelect
            value={config.listId ?? ''}
            onChange={v => {
              const list = lists.find(l => l.id === v);
              onChange({ ...config, listId: v, listName: list?.name ?? '' });
            }}
            options={[{ value: '', label: 'Select a list...' }, ...lists.map(l => ({ value: l.id, label: l.name }))]}
          />
        )}
      </PanelField>
      {isAccountTrigger && (
        <PanelField label="Contact Selection">
          <PanelSelect
            value={config.contactScope ?? 'all'}
            onChange={v => onChange({ ...config, contactScope: v })}
            options={[
              { value: 'all', label: 'All contacts' },
              { value: 'primary', label: 'Primary contact only' },
              { value: 'role', label: 'Contacts with role...' },
            ]}
          />
        </PanelField>
      )}
      {isAccountTrigger && config.contactScope === 'role' && (
        <PanelField label="Contact Role">
          <PanelInput value={config.contactRole ?? ''} onChange={v => onChange({ ...config, contactRole: v })} placeholder="e.g. Decision Maker" />
        </PanelField>
      )}
      <PanelField label="Tags (optional)">
        <PanelInput value={config.tags ?? ''} onChange={v => onChange({ ...config, tags: v })} placeholder="tag1, tag2, tag3" />
      </PanelField>
    </div>
  );
}

function EmailListRemovePanel({ config, onChange, module }: { config: any; onChange: (c: any) => void; module: TriggerModule }) {
  const { lists, loading } = useEmailLists();
  const isAccountTrigger = module === 'accounts';

  return (
    <div className="space-y-4">
      <PanelField label="Select List">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading lists...
          </div>
        ) : lists.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-slate-400">No lists found. Configure MailerLite or Mailchimp in Integrations first.</p>
        ) : (
          <PanelSelect
            value={config.listId ?? ''}
            onChange={v => {
              const list = lists.find(l => l.id === v);
              onChange({ ...config, listId: v, listName: list?.name ?? '' });
            }}
            options={[{ value: '', label: 'Select a list...' }, ...lists.map(l => ({ value: l.id, label: l.name }))]}
          />
        )}
      </PanelField>
      {isAccountTrigger && (
        <PanelField label="Contact Selection">
          <PanelSelect
            value={config.contactScope ?? 'all'}
            onChange={v => onChange({ ...config, contactScope: v })}
            options={[
              { value: 'all', label: 'All contacts' },
              { value: 'primary', label: 'Primary contact only' },
              { value: 'role', label: 'Contacts with role...' },
            ]}
          />
        </PanelField>
      )}
      {isAccountTrigger && config.contactScope === 'role' && (
        <PanelField label="Contact Role">
          <PanelInput value={config.contactRole ?? ''} onChange={v => onChange({ ...config, contactRole: v })} placeholder="e.g. Decision Maker" />
        </PanelField>
      )}
    </div>
  );
}

function ActionConfigPanel({
  action, module, onUpdate,
}: {
  action: DraftAction;
  module: TriggerModule;
  onUpdate: (config: any) => void;
}) {
  const meta = ACTION_TYPES.find(a => a.value === action.actionType);
  const AIcon = ACTION_ICONS[action.actionType] ?? Settings2;
  const col = actionColor(action.actionType);
  const c = action.config ?? {};
  const update = (config: any) => onUpdate(config);

  return (
    <div>
      <div className={`flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-700 rounded-t-xl border ${col} mb-4`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${col}`}>
          <AIcon className="w-4 h-4" />
        </div>
        <div>
          <div className="font-semibold text-gray-800 dark:text-white text-sm">{meta?.label}</div>
          <div className="text-xs text-gray-400">{meta?.description}</div>
        </div>
      </div>

      <div className="space-y-4">
        {action.actionType === 'assign_owner'       && <AssignOwnerPanel config={c} onChange={update} />}
        {action.actionType === 'create_task'        && <CreateTaskPanel config={c} onChange={update} />}
        {action.actionType === 'update_field'       && <UpdateFieldPanel config={c} onChange={update} module={module} />}
        {action.actionType === 'add_tag'            && <AddTagPanel config={c} onChange={update} />}
        {action.actionType === 'send_notification'  && <SendNotificationPanel config={c} onChange={update} />}
        {action.actionType === 'webhook'            && <WebhookPanel config={c} onChange={update} />}
        {action.actionType === 'wait'               && <WaitPanel config={c} onChange={update} />}
        {action.actionType === 'branch'             && <BranchPanel config={c} onChange={update} module={module} />}
        {action.actionType === 'create_opportunity' && <CreateOpportunityPanel config={c} onChange={update} />}
        {action.actionType === 'create_project'     && <CreateProjectPanel config={c} onChange={update} />}
        {action.actionType === 'send_email'         && <SendEmailPanel config={c} onChange={update} />}
        {action.actionType === 'send_whatsapp'      && <SendMessagePanel config={c} onChange={update} label="WhatsApp Message" />}
        {action.actionType === 'send_sms'            && <SendMessagePanel config={c} onChange={update} label="SMS Message" />}
        {action.actionType === 'add_to_email_list'      && <EmailListPanel config={c} onChange={update} module={module} />}
        {action.actionType === 'remove_from_email_list' && <EmailListRemovePanel config={c} onChange={update} module={module} />}
      </div>
    </div>
  );
}

// ── TRIGGER PANEL (right side when trigger selected) ──────────
function TriggerConfigPanel({
  module, triggerType, filters, onModuleChange, onTriggerChange, onFiltersChange,
}: {
  module: TriggerModule | '';
  triggerType: TriggerType | '';
  filters: ConditionGroup;
  onModuleChange: (m: TriggerModule) => void;
  onTriggerChange: (t: TriggerType) => void;
  onFiltersChange: (g: ConditionGroup) => void;
}) {
  const triggerTypes = module ? TRIGGER_TYPES_BY_MODULE[module as TriggerModule] : [];
  return (
    <div>
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-700 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100 dark:bg-violet-900/30">
          <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <div className="font-semibold text-gray-800 dark:text-white text-sm">Trigger Settings</div>
          <div className="text-xs text-gray-400">When should this workflow run?</div>
        </div>
      </div>
      <div className="space-y-4">
        <PanelField label="Module">
          <PanelSelect value={module} onChange={v => onModuleChange(v as TriggerModule)}
            options={[{ value: '', label: 'Select module…' }, ...TRIGGER_MODULES.map(m => ({ value: m.value, label: m.label }))]} />
        </PanelField>
        <PanelField label="Event">
          <PanelSelect value={triggerType} onChange={v => onTriggerChange(v as TriggerType)}
            options={[{ value: '', label: 'Select event…' }, ...triggerTypes.map(t => ({ value: t.value, label: t.label }))]} />
        </PanelField>
        {module && (
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Trigger Filters (optional)</div>
            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <ConditionGroupBuilder group={filters} module={module as TriggerModule} onChange={onFiltersChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [name, setName]                 = useState('Untitled Workflow');
  const [description, setDescription]  = useState('');
  const [isActive, setIsActive]         = useState(true);
  const [triggerModule, setTriggerModule] = useState<TriggerModule | ''>('');
  const [triggerType, setTriggerType]   = useState<TriggerType | ''>('');
  const [triggerFilters, setTriggerFilters] = useState<ConditionGroup>({ id: uid(), match: 'all', items: [] });
  const [actions, setActions]           = useState<DraftAction[]>([]);
  const [selectedId, setSelectedId]     = useState<string | null>('__trigger__');
  const [loading, setLoading]           = useState(!isNew);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');
  const [saved, setSaved]               = useState(false);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load existing workflow
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    workflowsApi.getOne(id!).then(wf => {
      if (cancelled) return;
      setName(wf.name);
      setDescription(wf.description ?? '');
      setIsActive(wf.isActive);
      setTriggerModule(wf.triggerModule);
      setTriggerType(wf.triggerType);
      setTriggerFilters(wf.triggerFilters ?? { id: uid(), match: 'all', items: [] });
      // Build a map from real IDs to tempIds for linking parent-child
      const allActions = wf.actions ?? [];
      const idMap: Record<string, string> = {};
      const drafts: DraftAction[] = allActions.map(a => {
        const tempId = a.id;
        idMap[a.id] = tempId;
        return {
          tempId,
          actionType: a.actionType,
          config: a.config,
          sortOrder: a.sortOrder,
          parentActionId: a.parentActionId ?? null,
          branch: a.branch ?? null,
        };
      });
      // Re-map parentActionId to use tempIds
      drafts.forEach(d => {
        if (d.parentActionId && idMap[d.parentActionId]) {
          d.parentActionId = idMap[d.parentActionId];
        }
      });
      setActions(drafts);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isNew]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setActions(prev => {
      const topLevel = prev.filter(a => !a.parentActionId);
      const children = prev.filter(a => a.parentActionId);
      const oldIdx = topLevel.findIndex(a => a.tempId === active.id);
      const newIdx = topLevel.findIndex(a => a.tempId === over.id);
      const reordered = arrayMove(topLevel, oldIdx, newIdx).map((a, i) => ({ ...a, sortOrder: i }));
      return [...reordered, ...children];
    });
  };

  const addAction = (type: ActionType) => {
    const newAction: DraftAction = {
      tempId: uid(),
      actionType: type,
      config: {},
      sortOrder: actions.length,
      parentActionId: null,
      branch: null,
    };
    setActions(prev => [...prev, newAction]);
    setSelectedId(newAction.tempId);
  };

  const removeAction = (tempId: string) => {
    setActions(prev => prev.filter(a => a.tempId !== tempId && a.parentActionId !== tempId));
    if (selectedId === tempId) setSelectedId('__trigger__');
  };

  const addBranchAction = (parentTempId: string, branch: 'yes' | 'no', type: ActionType) => {
    const siblings = actions.filter(a => a.parentActionId === parentTempId && a.branch === branch);
    const newAction: DraftAction = {
      tempId: uid(),
      actionType: type,
      config: {},
      sortOrder: siblings.length,
      parentActionId: parentTempId,
      branch,
    };
    setActions(prev => [...prev, newAction]);
    setSelectedId(newAction.tempId);
  };

  const updateActionConfig = (tempId: string, config: any) => {
    setActions(prev => prev.map(a => a.tempId === tempId ? { ...a, config } : a));
  };

  const handleModuleChange = (m: TriggerModule) => {
    setTriggerModule(m);
    setTriggerType(''); // reset when module changes
    setTriggerFilters({ id: uid(), match: 'all', items: [] });
  };

  const handleSave = async () => {
    if (!name.trim() || !triggerModule || !triggerType) {
      setSaveError('Workflow name, module and event are required.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      const payload: CreateWorkflowData = {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerModule: triggerModule as TriggerModule,
        triggerType: triggerType as TriggerType,
        triggerFilters,
        isActive,
        actions: actions.map(a => ({
          actionType: a.actionType,
          config: a.config,
          sortOrder: a.sortOrder,
          parentActionId: a.parentActionId ?? null,
          branch: a.branch ?? null,
          tempId: a.tempId,
        })),
      };

      if (isNew) {
        const created = await workflowsApi.create(payload);
        setSaved(true);
        setTimeout(() => navigate(`/workflows/${created.id}/edit`), 800);
      } else {
        await workflowsApi.update(id!, payload);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canvas = useCanvas();

  const topLevelActions = actions.filter(a => !a.parentActionId);
  const selectedAction = actions.find(a => a.tempId === selectedId);
  const showTriggerPanel = selectedId === '__trigger__';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-slate-950 -m-4 lg:-m-6 -mb-20 lg:-mb-6" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
        <button
          onClick={() => navigate('/workflows')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 w-full truncate"
            placeholder="Workflow name…"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-xs text-gray-400 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            placeholder="Optional description…"
          />
        </div>

        {/* Active toggle */}
        <button
          onClick={() => setIsActive(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
            isActive
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'border-gray-200 bg-white text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {isActive
            ? <><ToggleRight className="w-4 h-4" /> Active</>
            : <><ToggleLeft className="w-4 h-4" /> Inactive</>
          }
        </button>

        {/* Run history (edit mode only) */}
        {!isNew && (
          <button
            onClick={() => navigate(`/workflows/${id}/runs`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Activity className="w-4 h-4" /> History
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
          } disabled:opacity-60`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {saveError && (
        <div className="px-6 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 flex-shrink-0">
          {saveError}
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Canvas */}
        <div
          ref={canvas.containerRef}
          className="flex-1 relative overflow-hidden cursor-default"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.08) 1px, transparent 1px)',
            backgroundSize: `${24 * canvas.zoom}px ${24 * canvas.zoom}px`,
            backgroundPosition: `${canvas.pan.x % (24 * canvas.zoom)}px ${canvas.pan.y % (24 * canvas.zoom)}px`,
          }}
          {...canvas.handlers}
        >
          {/* Zoomable + pannable content */}
          <div
            className="absolute inset-0 flex justify-center"
            style={{
              transform: `translate(${canvas.pan.x}px, ${canvas.pan.y}px) scale(${canvas.zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <div className="pt-10 pb-40 w-[480px]">
              <div className="space-y-3">
                {/* Trigger block */}
                <TriggerBlock
                  module={triggerModule}
                  triggerType={triggerType}
                  filters={triggerFilters}
                  selected={selectedId === '__trigger__'}
                  onSelectModule={handleModuleChange}
                  onSelectTrigger={t => setTriggerType(t)}
                  onFiltersChange={setTriggerFilters}
                  onClick={() => setSelectedId('__trigger__')}
                />

                {/* Connector */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-6 bg-gray-300 dark:bg-slate-600" />
                </div>

                {/* Actions */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={topLevelActions.map(a => a.tempId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {topLevelActions.map((action, idx) => (
                        <div key={action.tempId}>
                          <SortableActionBlock
                            action={action}
                            selected={selectedId === action.tempId}
                            onClick={() => setSelectedId(action.tempId)}
                            onRemove={() => removeAction(action.tempId)}
                          />
                          {/* Branch YES/NO lanes */}
                          {action.actionType === 'branch' && (
                            <div className="flex gap-3 mt-2 ml-6">
                              {/* YES branch */}
                              <div className="flex-1 border-2 border-green-200 dark:border-green-800 rounded-xl p-3 bg-green-50/50 dark:bg-green-900/10">
                                <div className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Yes
                                </div>
                                <div className="space-y-2">
                                  {actions
                                    .filter(a => a.parentActionId === action.tempId && a.branch === 'yes')
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map(child => {
                                      const childMeta = ACTION_TYPES.find(at => at.value === child.actionType);
                                      const ChildIcon = ACTION_ICONS[child.actionType] ?? Settings2;
                                      const childColor = actionColor(child.actionType);
                                      return (
                                        <div
                                          key={child.tempId}
                                          onClick={() => setSelectedId(child.tempId)}
                                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                            selectedId === child.tempId
                                              ? 'border-violet-500 bg-white dark:bg-slate-800 shadow'
                                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300'
                                          }`}
                                        >
                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs ${childColor}`}>
                                            <ChildIcon className="w-3 h-3" />
                                          </div>
                                          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 flex-1 truncate">
                                            {childMeta?.label ?? child.actionType}
                                          </span>
                                          <button
                                            onClick={e => { e.stopPropagation(); removeAction(child.tempId); }}
                                            className="p-0.5 text-gray-300 hover:text-red-500"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  <AddActionMenu onAdd={(type) => addBranchAction(action.tempId, 'yes', type)} />
                                </div>
                              </div>
                              {/* NO branch */}
                              <div className="flex-1 border-2 border-red-200 dark:border-red-800 rounded-xl p-3 bg-red-50/50 dark:bg-red-900/10">
                                <div className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> No
                                </div>
                                <div className="space-y-2">
                                  {actions
                                    .filter(a => a.parentActionId === action.tempId && a.branch === 'no')
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map(child => {
                                      const childMeta = ACTION_TYPES.find(at => at.value === child.actionType);
                                      const ChildIcon = ACTION_ICONS[child.actionType] ?? Settings2;
                                      const childColor = actionColor(child.actionType);
                                      return (
                                        <div
                                          key={child.tempId}
                                          onClick={() => setSelectedId(child.tempId)}
                                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                            selectedId === child.tempId
                                              ? 'border-violet-500 bg-white dark:bg-slate-800 shadow'
                                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300'
                                          }`}
                                        >
                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs ${childColor}`}>
                                            <ChildIcon className="w-3 h-3" />
                                          </div>
                                          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 flex-1 truncate">
                                            {childMeta?.label ?? child.actionType}
                                          </span>
                                          <button
                                            onClick={e => { e.stopPropagation(); removeAction(child.tempId); }}
                                            className="p-0.5 text-gray-300 hover:text-red-500"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  <AddActionMenu onAdd={(type) => addBranchAction(action.tempId, 'no', type)} />
                                </div>
                              </div>
                            </div>
                          )}
                          {idx < topLevelActions.length - 1 && (
                            <div className="flex justify-center my-1">
                              <div className="w-0.5 h-4 bg-gray-300 dark:bg-slate-600" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add action */}
                <div className="flex justify-center">
                  <div className="w-0.5 h-4 bg-gray-300 dark:bg-slate-600" />
                </div>
                <AddActionMenu onAdd={addAction} />

                {actions.length === 0 && (
                  <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-2">
                    Add actions that run when the trigger fires
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Canvas controls overlay */}
          <CanvasControls
            zoomPercent={canvas.zoomPercent}
            onZoomIn={canvas.zoomIn}
            onZoomOut={canvas.zoomOut}
            onReset={canvas.resetView}
          />

          {/* Pan hint */}
          <div className="absolute top-3 left-3 text-[10px] text-gray-400 dark:text-slate-600 select-none pointer-events-none">
            Scroll to pan · Ctrl+scroll to zoom
          </div>
        </div>

        {/* RIGHT: Config panel */}
        {(showTriggerPanel || selectedAction) && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <div className="p-5">
              {showTriggerPanel && (
                <TriggerConfigPanel
                  module={triggerModule}
                  triggerType={triggerType}
                  filters={triggerFilters}
                  onModuleChange={handleModuleChange}
                  onTriggerChange={t => setTriggerType(t)}
                  onFiltersChange={setTriggerFilters}
                />
              )}
              {selectedAction && (
                <ActionConfigPanel
                  action={selectedAction}
                  module={(triggerModule as TriggerModule) || 'leads'}
                  onUpdate={config => updateActionConfig(selectedAction.tempId, config)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
