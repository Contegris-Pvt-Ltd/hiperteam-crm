// ============================================================
// FILE: apps/web/src/features/reports/ReportBuilderPage.tsx
//
// Step-by-step visual report builder:
//   Step 1: Pick data source
//   Step 2: Select measures & dimensions
//   Step 3: Add filters
//   Step 4: Choose chart type
//   Step 5: Preview & Save
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Play, Save, BarChart3, PieChart,
  TrendingUp, Table2, X, Plus, Trash2, Eye,
  Database, Columns3, Filter, Palette, ChevronDown,
} from 'lucide-react';
import { reportsApi } from '../../api/reports.api';
import type {
  ReportConfig, ReportMeasure, ReportDimension,
  ReportFilter, DataSourceDef, ReportResult,
} from '../../api/reports.api';
import { ReportChart, ReportDataTable } from './ReportCharts';

// ── Step definitions ──
const STEPS = [
  { key: 'source', label: 'Data Source', icon: Database },
  { key: 'fields', label: 'Measures & Dimensions', icon: Columns3 },
  { key: 'filters', label: 'Filters', icon: Filter },
  { key: 'chart', label: 'Visualization', icon: Palette },
  { key: 'preview', label: 'Preview & Save', icon: Eye },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3, desc: 'Compare values across categories' },
  { value: 'stacked_bar', label: 'Stacked Bar', icon: BarChart3, desc: 'Show composition of categories' },
  { value: 'line', label: 'Line Chart', icon: TrendingUp, desc: 'Show trends over time' },
  { value: 'pie', label: 'Pie Chart', icon: PieChart, desc: 'Show proportions of a whole' },
  { value: 'funnel', label: 'Funnel', icon: TrendingUp, desc: 'Show conversion through stages' },
  { value: 'table', label: 'Table Only', icon: Table2, desc: 'Tabular data without chart' },
];

const AGGREGATE_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count (Distinct)' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const DATE_GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const FILTER_OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'is_null', label: 'Is Empty' },
  { value: 'is_not_null', label: 'Is Not Empty' },
  { value: 'relative_date', label: 'Date Range' },
];

const RELATIVE_DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
];

const CATEGORY_OPTIONS = [
  { value: 'pipeline', label: 'Pipeline & Deals' },
  { value: 'leads', label: 'Leads' },
  { value: 'activity', label: 'Activities' },
  { value: 'contacts', label: 'Contacts & Accounts' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'targets', label: 'Targets' },
  { value: 'custom', label: 'Custom' },
];

export function ReportBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // ── Step ──
  const [currentStep, setCurrentStep] = useState(0);

  // ── Data Sources ──
  const [dataSources, setDataSources] = useState<DataSourceDef[]>([]);
  const [loadingDs, setLoadingDs] = useState(true);

  // ── Report definition ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [dataSource, setDataSource] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [reportType, setReportType] = useState('summary');

  // Config
  const [measures, setMeasures] = useState<ReportMeasure[]>([]);
  const [dimensions, setDimensions] = useState<ReportDimension[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [limit, setLimit] = useState<number>(0);

  // Preview
  const [previewResult, setPreviewResult] = useState<ReportResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Load Data Sources ──
  useEffect(() => {
    const load = async () => {
      try {
        const ds = await reportsApi.getDataSources();
        setDataSources(ds);
      } catch (err) {
        console.error('Failed to load data sources:', err);
      } finally {
        setLoadingDs(false);
      }
    };
    load();
  }, []);

  // ── Load Existing Report (edit mode) ──
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const report = await reportsApi.getOne(id);
        setName(report.name);
        setDescription(report.description || '');
        setCategory(report.category);
        setDataSource(report.dataSource);
        setChartType(report.chartType);
        setReportType(report.reportType);
        setMeasures(report.config.measures || []);
        setDimensions(report.config.dimensions || []);
        setFilters(report.config.filters || []);
        setLimit(report.config.limit || 0);
      } catch (err) {
        console.error('Failed to load report:', err);
      }
    };
    load();
  }, [id]);

  // ── Get current data source fields ──
  const currentDsFields = dataSources.find(ds => ds.key === dataSource)?.fields || [];
  const groupableFields = currentDsFields.filter(f => f.groupable);
  const dateFields = currentDsFields.filter(f => ['date', 'datetime'].includes(f.type));

  // ── Preview ──
  const handlePreview = async () => {
    setPreviewing(true);
    setError('');
    try {
      const config: ReportConfig = { measures, dimensions, filters };
      if (limit > 0) config.limit = limit;

      const result = await reportsApi.executePreview({
        dataSource,
        reportType,
        config,
      });
      setPreviewResult(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  // Auto-preview when entering preview step
  useEffect(() => {
    if (currentStep === 4 && dataSource && (measures.length > 0 || dimensions.length > 0)) {
      handlePreview();
    }
  }, [currentStep]);

  // ── Save ──
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Report name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const config: ReportConfig = { measures, dimensions, filters };
      if (limit > 0) config.limit = limit;

      const payload = {
        name,
        description,
        category,
        dataSource,
        chartType,
        reportType,
        config,
      };

      if (isEditing) {
        await reportsApi.update(id!, payload);
        navigate(`/reports/${id}`);
      } else {
        const created = await reportsApi.create(payload);
        navigate(`/reports/${created.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Step Navigation ──
  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!dataSource;
      case 1: return measures.length > 0 || dimensions.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return !!name.trim();
      default: return true;
    }
  };

  // ── Measure helpers ──
  const addMeasure = () => {
    const firstNumField = currentDsFields.find(f => ['currency', 'number', 'percent'].includes(f.type));
    const field = firstNumField || currentDsFields[0];
    if (!field) return;
    setMeasures([...measures, {
      field: field.key,
      aggregate: 'count',
      label: `Count of ${field.label}`,
    }]);
  };

  const updateMeasure = (index: number, updates: Partial<ReportMeasure>) => {
    setMeasures(measures.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const removeMeasure = (index: number) => {
    setMeasures(measures.filter((_, i) => i !== index));
  };

  // ── Dimension helpers ──
  const addDimension = () => {
    const field = groupableFields[0] || dateFields[0];
    if (!field) return;
    const isDate = ['date', 'datetime'].includes(field.type);
    setDimensions([...dimensions, {
      field: field.key,
      type: isDate ? 'date' : 'field',
      dateGranularity: isDate ? 'month' : undefined,
      label: field.label,
    }]);
  };

  const updateDimension = (index: number, updates: Partial<ReportDimension>) => {
    setDimensions(dimensions.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const removeDimension = (index: number) => {
    setDimensions(dimensions.filter((_, i) => i !== index));
  };

  // ── Filter helpers ──
  const addFilter = () => {
    const field = currentDsFields.find(f => f.filterable) || currentDsFields[0];
    if (!field) return;
    setFilters([...filters, { field: field.key, operator: 'eq', value: '' }]);
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setFilters(filters.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  if (loadingDs) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/reports" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {isEditing ? 'Edit Report' : 'New Report'}
        </h1>
      </div>

      {/* ── Step Indicators ── */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;

          return (
            <button
              key={step.key}
              onClick={() => {
                if (i <= currentStep || canProceed()) setCurrentStep(i);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isCompleted
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
              {step.label}
              {i < STEPS.length - 1 && <ChevronDown className="w-3 h-3 rotate-[-90deg] ml-1 opacity-30" />}
            </button>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 min-h-[400px]">
        {/* STEP 1: DATA SOURCE */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">What do you want to report on?</h2>
            <p className="text-sm text-gray-500 mb-6">Choose the primary data source for your report</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {dataSources.map(ds => (
                <button
                  key={ds.key}
                  onClick={() => {
                    setDataSource(ds.key);
                    // Reset selections when changing data source
                    setMeasures([]);
                    setDimensions([]);
                    setFilters([]);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm ${
                    dataSource === ds.key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Database className={`w-6 h-6 mb-2 ${dataSource === ds.key ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="font-medium text-gray-900 dark:text-white">{ds.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{ds.fields.length} fields</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: MEASURES & DIMENSIONS */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Configure your report</h2>
            <p className="text-sm text-gray-500 mb-6">Add values to aggregate and dimensions to group by</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Measures */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Values (Measures)</h3>
                  <button onClick={addMeasure} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {measures.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg text-sm">
                    Add a measure to aggregate data
                  </div>
                ) : (
                  <div className="space-y-3">
                    {measures.map((m, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <select
                            value={m.aggregate}
                            onChange={e => updateMeasure(i, { aggregate: e.target.value as any })}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                          >
                            {AGGREGATE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <select
                            value={m.field}
                            onChange={e => {
                              const f = currentDsFields.find(f => f.key === e.target.value);
                              updateMeasure(i, { field: e.target.value, label: `${m.aggregate} of ${f?.label || e.target.value}` });
                            }}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                          >
                            {currentDsFields.map(f => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={m.label || ''}
                            onChange={e => updateMeasure(i, { label: e.target.value })}
                            placeholder="Label"
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                          />
                        </div>
                        <button onClick={() => removeMeasure(i)} className="text-gray-400 hover:text-red-500 mt-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Group By (Dimensions)</h3>
                  <button onClick={addDimension} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {dimensions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg text-sm">
                    Add a dimension to group data
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dimensions.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex-1 space-y-2">
                          <select
                            value={d.field}
                            onChange={e => {
                              const f = currentDsFields.find(f => f.key === e.target.value);
                              const isDate = f && ['date', 'datetime'].includes(f.type);
                              updateDimension(i, {
                                field: e.target.value,
                                type: isDate ? 'date' : 'field',
                                dateGranularity: isDate ? 'month' : undefined,
                                label: f?.label,
                              });
                            }}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                          >
                            <optgroup label="Fields">
                              {groupableFields.map(f => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Date Fields">
                              {dateFields.map(f => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                              ))}
                            </optgroup>
                          </select>
                          {d.type === 'date' && (
                            <select
                              value={d.dateGranularity || 'month'}
                              onChange={e => updateDimension(i, { dateGranularity: e.target.value as any })}
                              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                            >
                              {DATE_GRANULARITY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <button onClick={() => removeDimension(i)} className="text-gray-400 hover:text-red-500 mt-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: FILTERS */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Filter your data</h2>
            <p className="text-sm text-gray-500 mb-6">Narrow down which records are included in the report</p>

            <div className="flex justify-end mb-3">
              <button onClick={addFilter} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Filter
              </button>
            </div>

            {filters.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg text-sm">
                No filters — all records will be included
              </div>
            ) : (
              <div className="space-y-3">
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex-wrap">
                    <select
                      value={f.field}
                      onChange={e => updateFilter(i, { field: e.target.value })}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                    >
                      {currentDsFields.filter(fd => fd.filterable).map(fd => (
                        <option key={fd.key} value={fd.key}>{fd.label}</option>
                      ))}
                    </select>

                    <select
                      value={f.operator}
                      onChange={e => updateFilter(i, { operator: e.target.value })}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                    >
                      {FILTER_OPERATORS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {f.operator === 'relative_date' ? (
                      <select
                        value={f.dateRelative || ''}
                        onChange={e => updateFilter(i, { dateRelative: e.target.value })}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                      >
                        {RELATIVE_DATE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : !['is_null', 'is_not_null'].includes(f.operator) ? (
                      <input
                        type="text"
                        value={f.value || ''}
                        onChange={e => updateFilter(i, { value: e.target.value })}
                        placeholder="Value"
                        className="flex-1 min-w-[120px] text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
                      />
                    ) : null}

                    <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Limit */}
            <div className="mt-6 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Row Limit:</label>
              <input
                type="number"
                value={limit || ''}
                onChange={e => setLimit(parseInt(e.target.value) || 0)}
                placeholder="No limit"
                className="w-32 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-800"
              />
            </div>
          </div>
        )}

        {/* STEP 4: CHART TYPE */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-1">Choose visualization</h2>
            <p className="text-sm text-gray-500 mb-6">How should this report be displayed?</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CHART_TYPES.map(ct => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.value}
                    onClick={() => setChartType(ct.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      chartType === ct.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${chartType === ct.value ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="font-medium text-gray-900 dark:text-white">{ct.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{ct.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: PREVIEW & SAVE */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Preview & Save</h2>

            {/* Report Name & Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Monthly Revenue by Rep"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">Preview</h3>
              <button
                onClick={handlePreview}
                disabled={previewing}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> {previewing ? 'Running...' : 'Refresh Preview'}
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {previewing ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : previewResult ? (
              <div className="space-y-4">
                {chartType !== 'table' && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <ReportChart
                      data={previewResult.data}
                      columns={previewResult.columns}
                      chartType={chartType}
                      height={300}
                    />
                  </div>
                )}
                <ReportDataTable data={previewResult.data.slice(0, 10)} columns={previewResult.columns} />
                {previewResult.totalRows > 10 && (
                  <p className="text-xs text-gray-400 text-center">
                    Showing 10 of {previewResult.totalRows} rows in preview
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg text-sm">
                Click "Refresh Preview" to see your report
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation Buttons ── */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3">
          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save className="w-4 h-4" />}
              {isEditing ? 'Save Changes' : 'Create Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}