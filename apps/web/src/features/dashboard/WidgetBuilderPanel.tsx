// ============================================================
// FILE: apps/web/src/features/dashboard/WidgetBuilderPanel.tsx
// Inline widget builder — appears as a right-side panel
// when user clicks "Add Widget" or "Edit Widget" in edit mode.
// Reuses the report builder data-source/measure/dimension
// infrastructure but renders inline, not as a wizard.
// ============================================================
import { useState, useEffect } from 'react';
import {
  X, ChevronDown, ChevronUp, Plus, Trash2,
} from 'lucide-react';
import { Check } from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import type { DataSourceDef, ReportMeasure, ReportDimension, ReportFilter } from '../../api/reports.api';
import type { DashboardWidget } from '../../api/dashboard-layout.api';
import { CHART_REGISTRY, CHART_REGISTRY_MAP } from './chartRegistry';

interface WidgetBuilderPanelProps {
  widget?: DashboardWidget | null;  // null = new widget
  onSave: (widget: Partial<DashboardWidget>) => void;
  onCancel: () => void;
}

const AGGREGATE_OPTIONS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'];
const DATE_GRANULARITY_OPTIONS = ['day', 'week', 'month', 'quarter', 'year'];

const WIDGET_TYPES = [
  { value: 'chart', label: 'Chart', desc: 'Bar, line, area, pie, funnel, etc.' },
  { value: 'scorecard', label: 'Scorecard', desc: 'KPI number with trend & target' },
  { value: 'leaderboard', label: 'Leaderboard', desc: 'Ranked table with progress bars' },
  { value: 'table', label: 'Table', desc: 'Scrollable data table' },
  { value: 'projection', label: 'Projection', desc: 'Growth simulator with slider' },
] as const;

const CHART_CATEGORIES = [
  { key: 'basic', label: 'Basic' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'special', label: 'Special' },
] as const;

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';
const sectionCls = 'border-t border-gray-100 dark:border-slate-700 pt-4 mt-4';

export function WidgetBuilderPanel({ widget, onSave, onCancel }: WidgetBuilderPanelProps) {
  const isNew = !widget;

  // Data sources
  const [dataSources, setDataSources] = useState<DataSourceDef[]>([]);
  const [loadingDs, setLoadingDs] = useState(true);

  // Form state
  const [title, setTitle] = useState(widget?.title || '');
  const [widgetType, setWidgetType] = useState<string>(widget?.widgetType || 'chart');
  const [dataSource, setDataSource] = useState(widget?.dataSource || '');
  const [chartType, setChartType] = useState(widget?.chartType || 'bar');
  const [reportType] = useState(widget?.reportType || 'summary');
  const [measures, setMeasures] = useState<ReportMeasure[]>(widget?.config?.measures || []);
  const [dimensions, setDimensions] = useState<ReportDimension[]>(widget?.config?.dimensions || []);
  const [filters, setFilters] = useState<ReportFilter[]>(widget?.config?.filters || []);
  const [limit, setLimit] = useState(widget?.config?.limit || 0);

  // Display config
  const [showTrend, setShowTrend] = useState(widget?.displayConfig?.showTrend ?? false);
  const [targetValue, setTargetValue] = useState(widget?.displayConfig?.targetValue?.toString() || '');
  const [targetLabel, setTargetLabel] = useState(widget?.displayConfig?.targetLabel || '');
  const [showLegend, setShowLegend] = useState(widget?.displayConfig?.showLegend ?? true);
  const [showCrown, setShowCrown] = useState(widget?.displayConfig?.showCrown ?? true);
  const [sliderMin, setSliderMin] = useState(widget?.displayConfig?.sliderMin?.toString() || '0');
  const [sliderMax, setSliderMax] = useState(widget?.displayConfig?.sliderMax?.toString() || '100');
  const [sliderDefault, setSliderDefault] = useState(widget?.displayConfig?.sliderDefault?.toString() || '20');
  const [sliderLabel, setSliderLabel] = useState(widget?.displayConfig?.sliderLabel || 'Growth Target');

  // Filter sensitivity
  const [respondsToDashboardDateRange, setRespondsToDashboardDateRange] = useState(
    widget?.filterSensitivity?.respondsToDashboardDateRange ?? true,
  );
  const [respondsToDashboardScope, setRespondsToDashboardScope] = useState(
    widget?.filterSensitivity?.respondsToDashboardScope ?? true,
  );

  // UI
  const [section, setSection] = useState<'type' | 'data' | 'display' | 'filters'>('type');

  useEffect(() => {
    reportsApi.getDataSources()
      .then(setDataSources)
      .catch(console.error)
      .finally(() => setLoadingDs(false));
  }, []);

  const currentDs = dataSources.find(ds => ds.key === dataSource);
  const numericFields = currentDs?.fields.filter(f => ['number', 'currency', 'percent'].includes(f.type)) || [];
  const groupableFields = currentDs?.fields.filter(f => f.groupable) || [];
  const dateFields = currentDs?.fields.filter(f => ['date', 'datetime'].includes(f.type)) || [];
  const filterableFields = currentDs?.fields.filter(f => f.filterable) || [];

  const addMeasure = () => {
    const f = numericFields[0] || currentDs?.fields[0];
    if (!f) return;
    setMeasures(prev => [...prev, { field: f.key, aggregate: 'count', label: `Count of ${f.label}`, format: 'number' as any }]);
  };

  const addDimension = () => {
    const f = groupableFields[0] || dateFields[0] || currentDs?.fields[0];
    if (!f) return;
    const isDate = ['date', 'datetime'].includes(f.type);
    setDimensions(prev => [...prev, {
      field: f.key,
      type: isDate ? 'date' : 'field',
      dateGranularity: isDate ? 'month' : undefined,
      label: f.label,
    }]);
  };

  const addFilter = () => {
    const f = filterableFields[0];
    if (!f) return;
    setFilters(prev => [...prev, { field: f.key, operator: 'eq' as any, value: '' }]);
  };

  const handleSave = () => {
    const config: any = {
      measures,
      dimensions,
      filters,
    };
    if (limit > 0) config.limit = limit;

    const displayConfig: any = {
      showLegend,
      showTrend,
      showCrown,
    };
    if (targetValue) {
      displayConfig.targetValue = parseFloat(targetValue);
      displayConfig.targetLabel = targetLabel;
    }
    if (widgetType === 'projection') {
      displayConfig.sliderMin = parseFloat(sliderMin) || 0;
      displayConfig.sliderMax = parseFloat(sliderMax) || 100;
      displayConfig.sliderDefault = parseFloat(sliderDefault) || 20;
      displayConfig.sliderLabel = sliderLabel;
    }

    onSave({
      title: title || undefined,
      widgetType: widgetType as any,
      dataSource,
      reportType,
      chartType,
      config,
      displayConfig,
      filterSensitivity: {
        respondsToDashboardDateRange,
        respondsToDashboardScope,
      },
    });
  };

  const SectionHeader = ({ id, label }: { id: typeof section; label: string }) => (
    <button
      onClick={() => setSection(s => s === id ? 'type' : id)}
      className="flex items-center justify-between w-full text-left mb-3"
    >
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      {section === id
        ? <ChevronUp className="w-4 h-4 text-gray-400" />
        : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  );

  const chartDef = CHART_REGISTRY_MAP[chartType];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {isNew ? 'Add Widget' : 'Edit Widget'}
        </h2>
        <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Title */}
        <div className="mb-4">
          <label className={labelCls}>Widget Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Revenue This Quarter"
            className={inputCls}
          />
        </div>

        {/* ── SECTION: Widget Type ─────────────────────────── */}
        <div>
          <SectionHeader id="type" label="Widget Type" />
          <div className="space-y-1.5">
            {WIDGET_TYPES.map(wt => (
              <label
                key={wt.value}
                className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer border transition-colors ${
                  widgetType === wt.value
                    ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/10'
                    : 'border-gray-200 dark:border-slate-600 hover:border-purple-300'
                }`}
              >
                <input
                  type="radio"
                  name="widgetType"
                  value={wt.value}
                  checked={widgetType === wt.value}
                  onChange={() => setWidgetType(wt.value)}
                  className="mt-0.5 text-purple-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{wt.label}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{wt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── SECTION: Data ────────────────────────────────── */}
        <div className={sectionCls}>
          <SectionHeader id="data" label="Data Source & Fields" />

          {/* Data source picker */}
          <div className="mb-3">
            <label className={labelCls}>Data Source</label>
            {loadingDs ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : (
              <select
                value={dataSource}
                onChange={e => { setDataSource(e.target.value); setMeasures([]); setDimensions([]); setFilters([]); }}
                className={inputCls}
              >
                <option value="">— Select data source —</option>
                {dataSources.map(ds => (
                  <option key={ds.key} value={ds.key}>{ds.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Chart type — only for chart widget type */}
          {widgetType === 'chart' && (
            <div className="mb-3">
              <label className={labelCls}>Chart Type</label>
              {CHART_CATEGORIES.map(cat => {
                const charts = CHART_REGISTRY.filter(c => c.category === cat.key);
                return (
                  <div key={cat.key} className="mb-2">
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{cat.label}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {charts.map(c => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.type}
                            onClick={() => setChartType(c.type)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs border transition-colors ${
                              chartType === c.type
                                ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                : 'border-gray-200 dark:border-slate-600 hover:border-purple-300 text-gray-600 dark:text-gray-300'
                            }`}
                            title={c.description}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="truncate w-full text-center">{c.label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {chartDef && (
                <p className="text-xs text-gray-400 mt-1 italic">{chartDef.description}</p>
              )}
            </div>
          )}

          {dataSource && (
            <>
              {/* Measures */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>
                    Values (Measures)
                    {chartDef && <span className="text-gray-300 dark:text-slate-600 ml-1">· {chartDef.minMeasures}–{chartDef.maxMeasures}</span>}
                  </label>
                  {chartDef && measures.length < chartDef.maxMeasures && (
                    <button onClick={addMeasure} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                  {!chartDef && (
                    <button onClick={addMeasure} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {measures.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                      <select
                        value={m.aggregate}
                        onChange={e => setMeasures(prev => prev.map((x, j) => j === i ? { ...x, aggregate: e.target.value as any } : x))}
                        className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white flex-shrink-0 w-20"
                      >
                        {AGGREGATE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <select
                        value={m.field}
                        onChange={e => {
                          const fld = currentDs?.fields.find(fld => fld.key === e.target.value);
                          setMeasures(prev => prev.map((x, j) => j === i
                            ? { ...x, field: e.target.value, label: `${x.aggregate} of ${fld?.label || e.target.value}`, format: (fld?.type as any) || 'number' }
                            : x,
                          ));
                        }}
                        className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white flex-1 min-w-0"
                      >
                        {(numericFields.length ? numericFields : currentDs?.fields || []).map(fld => (
                          <option key={fld.key} value={fld.key}>{fld.label}</option>
                        ))}
                      </select>
                      <button onClick={() => setMeasures(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {measures.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No measures — click Add</p>
                  )}
                </div>
              </div>

              {/* Dimensions */}
              {widgetType !== 'scorecard' && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls}>
                      Group By (Dimensions)
                      {chartDef && <span className="text-gray-300 dark:text-slate-600 ml-1">· {chartDef.minDimensions}–{chartDef.maxDimensions}</span>}
                    </label>
                    {(dimensions.length < (chartDef?.maxDimensions ?? 5)) && (
                      <button onClick={addDimension} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {dimensions.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                        <select
                          value={d.field}
                          onChange={e => {
                            const fld = currentDs?.fields.find(fld => fld.key === e.target.value);
                            const isDate = fld ? ['date', 'datetime'].includes(fld.type) : false;
                            setDimensions(prev => prev.map((x, j) => j === i
                              ? { ...x, field: e.target.value, type: isDate ? 'date' : 'field', dateGranularity: isDate ? 'month' : undefined, label: fld?.label || e.target.value }
                              : x,
                            ));
                          }}
                          className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white flex-1 min-w-0"
                        >
                          {[...groupableFields, ...dateFields].map(fld => (
                            <option key={fld.key} value={fld.key}>{fld.label}</option>
                          ))}
                        </select>
                        {d.type === 'date' && (
                          <select
                            value={d.dateGranularity || 'month'}
                            onChange={e => setDimensions(prev => prev.map((x, j) => j === i ? { ...x, dateGranularity: e.target.value as any } : x))}
                            className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white w-20 flex-shrink-0"
                          >
                            {DATE_GRANULARITY_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        )}
                        <button onClick={() => setDimensions(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {dimensions.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No dimensions — click Add</p>
                    )}
                  </div>
                </div>
              )}

              {/* Limit */}
              <div>
                <label className={labelCls}>Row limit (0 = all)</label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={limit}
                  onChange={e => setLimit(parseInt(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>

        {/* ── SECTION: Filters ─────────────────────────────── */}
        {dataSource && (
          <div className={sectionCls}>
            <SectionHeader id="filters" label="Filters" />
            <div className="space-y-2 mb-2">
              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg">
                  <select
                    value={f.field}
                    onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                    className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white flex-1 min-w-0"
                  >
                    {filterableFields.map(fld => (
                      <option key={fld.key} value={fld.key}>{fld.label}</option>
                    ))}
                  </select>
                  <select
                    value={f.operator}
                    onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, operator: e.target.value as any } : x))}
                    className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white w-24 flex-shrink-0"
                  >
                    {['eq','neq','gt','gte','lt','lte','contains','is_null','is_not_null'].map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  {!['is_null', 'is_not_null'].includes(f.operator) && (
                    <input
                      value={String(f.value || '')}
                      onChange={e => setFilters(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      placeholder="value"
                      className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-white w-20 flex-shrink-0"
                    />
                  )}
                  <button onClick={() => setFilters(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addFilter} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add filter
            </button>
          </div>
        )}

        {/* ── SECTION: Display ─────────────────────────────── */}
        <div className={sectionCls}>
          <SectionHeader id="display" label="Display Options" />
          <div className="space-y-3">
            {/* Chart-specific */}
            {widgetType === 'chart' && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} className="rounded text-purple-600" />
                Show legend
              </label>
            )}

            {/* Scorecard-specific */}
            {widgetType === 'scorecard' && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={showTrend} onChange={e => setShowTrend(e.target.checked)} className="rounded text-purple-600" />
                  Show trend vs previous period
                </label>
                <div>
                  <label className={labelCls}>Target value (optional)</label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={e => setTargetValue(e.target.value)}
                    placeholder="e.g. 100000"
                    className={inputCls}
                  />
                </div>
                {targetValue && (
                  <div>
                    <label className={labelCls}>Target label</label>
                    <input
                      value={targetLabel}
                      onChange={e => setTargetLabel(e.target.value)}
                      placeholder="e.g. Q4 Goal"
                      className={inputCls}
                    />
                  </div>
                )}
              </>
            )}

            {/* Leaderboard-specific */}
            {widgetType === 'leaderboard' && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={showCrown} onChange={e => setShowCrown(e.target.checked)} className="rounded text-purple-600" />
                Show crown for rank #1
              </label>
            )}

            {/* Projection-specific */}
            {widgetType === 'projection' && (
              <>
                <div>
                  <label className={labelCls}>Slider label</label>
                  <input value={sliderLabel} onChange={e => setSliderLabel(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={labelCls}>Min %</label>
                    <input type="number" value={sliderMin} onChange={e => setSliderMin(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Max %</label>
                    <input type="number" value={sliderMax} onChange={e => setSliderMax(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Default %</label>
                    <input type="number" value={sliderDefault} onChange={e => setSliderDefault(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </>
            )}

            {/* Filter sensitivity */}
            <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Dashboard filter sensitivity</p>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer mb-1">
                <input type="checkbox" checked={respondsToDashboardDateRange} onChange={e => setRespondsToDashboardDateRange(e.target.checked)} className="rounded text-purple-600" />
                Respond to tab date range filter
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={respondsToDashboardScope} onChange={e => setRespondsToDashboardScope(e.target.checked)} className="rounded text-purple-600" />
                Respond to tab scope filter (own/team/all)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex gap-2 flex-shrink-0">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!dataSource}
          className="flex-1 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-medium flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {isNew ? 'Add Widget' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
