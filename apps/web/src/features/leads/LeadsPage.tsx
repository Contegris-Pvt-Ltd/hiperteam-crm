// ============================================================
// FILE: apps/web/src/features/leads/LeadsPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search,
  Eye, Pencil, Trash2, LayoutList, LayoutGrid,
  Flame, Thermometer, Snowflake, Sun, Minus,
  Filter, X, Building2, Package,
  Loader2, AlertTriangle,
} from 'lucide-react';
import type { Lead, LeadsQuery, LeadStage, LeadPriority, KanbanStageData, Pipeline } from '../../api/leads.api';
import { leadsApi, leadSettingsApi } from '../../api/leads.api';
import { KanbanBoard } from './components/KanbanBoard';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';
import { api } from '../../api/contacts.api';

// Priority icon map
const PRIORITY_ICONS: Record<string, any> = {
  flame: Flame,
  thermometer: Thermometer,
  snowflake: Snowflake,
  sun: Sun,
  minus: Minus,
};

export function LeadsPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('leads');
  const tablePrefs = useTablePreferences('leads', allColumns, defaultVisibleKeys);

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // Kanban
  const [kanbanData, setKanbanData] = useState<KanbanStageData[]>([]);

  // Lookups
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [priorities, setPriorities] = useState<LeadPriority[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  const [productOptions, setProductOptions] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductFilter, setShowProductFilter] = useState(false);

  // Query state
  const [query, setQuery] = useState<LeadsQuery>({ page: 1, limit: 20, view: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // ── Sync table preferences into query once loaded ──
  useEffect(() => {
    if (!tablePrefs.loading && viewMode === 'list') {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
    }
  }, [tablePrefs.loading]);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Kanban stage fields modal
  const [kanbanFieldsModal, setKanbanFieldsModal] = useState<{
    open: boolean;
    leadId: string;
    stageId: string;
    stageName: string;
    missingFields: { fieldKey: string; fieldLabel: string; fieldType: string; sortOrder: number }[];
  } | null>(null);
  const [kanbanFieldValues, setKanbanFieldValues] = useState<Record<string, any>>({});
  const [kanbanFieldErrors, setKanbanFieldErrors] = useState<Record<string, string>>({});
  const [kanbanSubmitting, setKanbanSubmitting] = useState(false);

  // ── Fetch lookups on mount ──
  useEffect(() => {
    Promise.all([
      leadSettingsApi.getPipelines(),
      leadSettingsApi.getStages(),
      leadSettingsApi.getPriorities(),
      leadSettingsApi.getSources(),
    ]).then(([pipelinesData, stagesData, prioritiesData, sourcesData]) => {
      setPipelines(pipelinesData);
      setStages(stagesData);
      setPriorities(prioritiesData);
      setSources(sourcesData);
      // Auto-select default pipeline
      const defaultPl = pipelinesData.find((p: Pipeline) => p.isDefault);
      if (defaultPl) setSelectedPipelineId(defaultPl.id);
    }).catch(console.error);

    // Load product options for filter
    api.get('/products?limit=100&status=active').then(({ data }) => {
      const products = data.data || data;
      setProductOptions(
        (Array.isArray(products) ? products : []).map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        }))
      );
    }).catch(() => {});
  }, []);

  // ── Fetch leads when query changes ──
  useEffect(() => {
    if (tablePrefs.loading) return;
    fetchLeads();
  }, [query, tablePrefs.loading]);

  // Sync product filter into query
  useEffect(() => {
    setQuery(prev => ({
      ...prev,
      productIds: selectedProductIds.length > 0 ? selectedProductIds.join(',') : undefined,
      page: 1,
    }));
  }, [selectedProductIds]);
  
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const queryWithPipeline = { ...query, view: viewMode, pipelineId: selectedPipelineId || undefined };
      const response = await leadsApi.getAll(queryWithPipeline);
      if (viewMode === 'kanban') {
        setKanbanData(response.stages || []);
      } else {
        setLeads(response.data || []);
        setMeta(response.meta || { total: 0, page: 1, limit: 20, totalPages: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  }, [query, viewMode, selectedPipelineId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery({ ...query, search: searchInput, page: 1 });
  };

  const handleViewChange = (mode: 'list' | 'kanban') => {
    setViewMode(mode);
    setQuery({ ...query, view: mode, page: 1 });
  };

  const handleDelete = async (id: string) => {
    try {
      await leadsApi.delete(id);
      setShowDeleteConfirm(null);
      fetchLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
    }
  };

  const handleKanbanStageDrop = async (leadId: string, newStageId: string) => {
    try {
      // 1. Fetch required fields for the target stage
      const stageFields = await leadSettingsApi.getStageFields(newStageId);
      const requiredFields = (Array.isArray(stageFields) ? stageFields : []).filter((f: any) => f.isRequired);

      if (requiredFields.length === 0) {
        // No required fields — move directly
        await leadsApi.changeStage(leadId, newStageId);
        fetchLeads();
        return;
      }

      // 2. Fetch the full lead to check which fields are already filled
      const fullLead = await leadsApi.getOne(leadId);
      const missing = requiredFields.filter((f: any) => {
        let val: any;
        if (f.fieldKey.startsWith('qualification.')) {
          val = (fullLead.qualification as Record<string, any>)?.[f.fieldKey.replace('qualification.', '')];
        } else if (f.fieldKey.startsWith('custom.')) {
          val = (fullLead.customFields as Record<string, any>)?.[f.fieldKey.replace('custom.', '')];
        } else {
          val = (fullLead as any)[f.fieldKey];
        }
        return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
      });

      if (missing.length === 0) {
        // All filled — move directly
        await leadsApi.changeStage(leadId, newStageId);
        fetchLeads();
        return;
      }

      // 3. Find stage name for the modal title
      const targetStage = stages.find(s => s.id === newStageId);

      // 4. Show modal to collect missing fields
      setKanbanFieldsModal({
        open: true,
        leadId,
        stageId: newStageId,
        stageName: targetStage?.name || 'Next Stage',
        missingFields: missing.map((f: any) => ({
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType || 'text',
          sortOrder: f.sortOrder || 0,
        })),
      });
      setKanbanFieldValues({});
      setKanbanFieldErrors({});
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to change stage';
      alert(msg);
    }
  };

  const handleKanbanFieldsSubmit = async () => {
    if (!kanbanFieldsModal) return;

    // Validate
    const errors: Record<string, string> = {};
    kanbanFieldsModal.missingFields.forEach(f => {
      const val = kanbanFieldValues[f.fieldKey];
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        errors[f.fieldKey] = `${f.fieldLabel} is required`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setKanbanFieldErrors(errors);
      return;
    }

    setKanbanSubmitting(true);
    try {
      await leadsApi.changeStage(kanbanFieldsModal.leadId, kanbanFieldsModal.stageId, kanbanFieldValues);
      setKanbanFieldsModal(null);
      fetchLeads();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to change stage';
      alert(msg);
    } finally {
      setKanbanSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSelectedProductIds([]);
    setQuery({ page: 1, limit: 20, view: viewMode });
  };

  // Pipeline change: reload stages for that pipeline, reset stage filter, refetch
  const handlePipelineChange = async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setQuery(prev => ({ ...prev, stageId: undefined, page: 1 }));
    try {
      const newStages = await leadSettingsApi.getStages(pipelineId || undefined, 'leads');
      setStages(newStages);
    } catch (err) {
      console.error('Failed to load stages for pipeline:', err);
    }
  };

  const activeFilterCount = [
    query.stageId, query.priorityId, query.source, query.ownerId,
    query.tag, query.scoreMin, query.scoreMax, query.convertedStatus,
    selectedProductIds.length > 0 ? true : undefined,
  ].filter(Boolean).length;

  // ── Score bar helper ──
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-400';
  };

  const getPriorityIcon = (priority: Lead['priority']) => {
    if (!priority) return null;
    const IconComp = PRIORITY_ICONS[priority.icon || 'minus'] || Minus;
    return <IconComp size={14} style={{ color: priority.color }} />;
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {meta.total || kanbanData.reduce((s, st) => s + st.count, 0)} total leads
            {selectedPipelineId && pipelines.length > 1 && (
              <span className="ml-1 text-blue-600">
                · {pipelines.find(p => p.id === selectedPipelineId)?.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline selector — only shows when multiple pipelines exist */}
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId}
              onChange={(e) => handlePipelineChange(e.target.value)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Pipelines</option>
              {pipelines.filter(p => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>
          )}
          {canCreate('leads') && (
            <button
              onClick={() => navigate('/leads/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Lead
            </button>
          )}
        </div>
      </div>

      {/* Search & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search leads by name, email, company, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700">
            Search
          </button>
        </form>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => handleViewChange('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutList size={16} />
            List
          </button>
          <button
            onClick={() => handleViewChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${viewMode === 'kanban' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
          >
            <LayoutGrid size={16} />
            Kanban
          </button>
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm ${
            activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
        >
          <Filter size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Stage filter */}
            <select
              value={query.stageId || ''}
              onChange={(e) => setQuery({ ...query, stageId: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Stages</option>
              {stages.filter(s => s.isActive).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              value={query.priorityId || ''}
              onChange={(e) => setQuery({ ...query, priorityId: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Priorities</option>
              {priorities.filter(p => p.isActive !== false).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Source filter */}
            <select
              value={query.source || ''}
              onChange={(e) => setQuery({ ...query, source: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={query.convertedStatus || ''}
              onChange={(e) => setQuery({ ...query, convertedStatus: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="converted">Converted</option>
              <option value="disqualified">Disqualified</option>
            </select>

            {/* Product filter */}
            {productOptions.length > 0 && (
              <div className="relative col-span-2 md:col-span-4">
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Products</label>
                <div
                  onClick={() => setShowProductFilter(!showProductFilter)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer ${
                    selectedProductIds.length > 0
                      ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {selectedProductIds.length > 0
                    ? `${selectedProductIds.length} product${selectedProductIds.length !== 1 ? 's' : ''} selected`
                    : 'All Products'
                  }
                </div>

                {showProductFilter && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProductFilter(false)} />
                    <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-64 flex flex-col">
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Select Products</span>
                        {selectedProductIds.length > 0 && (
                          <button onClick={() => setSelectedProductIds([])} className="text-xs text-blue-600 hover:underline">
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="overflow-y-auto p-2 space-y-0.5">
                        {productOptions.map(product => {
                          const isSelected = selectedProductIds.includes(product.id);
                          return (
                            <button
                              key={product.id}
                              onClick={() => {
                                setSelectedProductIds(prev =>
                                  isSelected ? prev.filter(pid => pid !== product.id) : [...prev, product.id]
                                );
                              }}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-slate-600'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span className="truncate">{product.name}</span>
                              {product.code && <span className="text-xs text-gray-400 font-mono ml-auto">{product.code}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selected product chips */}
          {selectedProductIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {selectedProductIds.map(pid => {
                const product = productOptions.find(p => p.id === pid);
                if (!product) return null;
                return (
                  <span key={pid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium">
                    <Package className="w-3 h-3" />
                    {product.name}
                    <button onClick={() => setSelectedProductIds(prev => prev.filter(id => id !== pid))} className="ml-0.5 hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          stages={kanbanData}
          loading={loading}
          onStageDrop={handleKanbanStageDrop}
          onLeadClick={(id) => navigate(`/leads/${id}`)}
          getPriorityIcon={getPriorityIcon}
          getScoreColor={getScoreColor}
        />
      ) : (
        <>
          {/* ── LIST VIEW (DataTable) ── */}
          <DataTable
            module="leads"
            allColumns={allColumns}
            defaultVisibleKeys={defaultVisibleKeys}
            data={leads}
            loading={loading || columnsLoading}
            meta={meta}
            visibleColumns={tablePrefs.visibleColumns}
            sortColumn={query.sortBy || 'created_at'}
            sortOrder={query.sortOrder || 'DESC'}
            pageSize={query.limit || 20}
            columnWidths={tablePrefs.columnWidths}
            onSort={(col, order) => {
              setQuery(prev => ({ ...prev, sortBy: col, sortOrder: order, page: 1 }));
              tablePrefs.setSortColumn(col);
              tablePrefs.setSortOrder(order);
            }}
            onPageChange={(page) => setQuery(prev => ({ ...prev, page }))}
            onPageSizeChange={(size) => {
              setQuery(prev => ({ ...prev, limit: size, page: 1 }));
              tablePrefs.setPageSize(size);
            }}
            onColumnsChange={tablePrefs.setVisibleColumns}
            onColumnWidthsChange={tablePrefs.setColumnWidths}
            onRowClick={(row) => navigate(`/leads/${row.id}`)}
            emptyMessage="No leads found. Try adjusting your search or filters."
            renderCell={(col, value, row) => {
              const lead = row;

              // Name column — avatar + name + email
              if (col.key === 'name') {
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
                      {(lead.firstName?.[0] || lead.lastName?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
                      </p>
                      {lead.email && <p className="text-xs text-gray-500">{lead.email}</p>}
                    </div>
                  </div>
                );
              }

              // Stage column — colored badge
              if (col.key === 'stageName' && lead.stage) {
                return (
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${lead.stage.color}18`, color: lead.stage.color }}
                  >
                    {lead.stage.name}
                  </span>
                );
              }

              // Pipeline column
              if (col.key === 'pipelineName' && lead.pipeline) {
                return (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {lead.pipeline.name}
                  </span>
                );
              }

              // Priority column — icon + colored name
              if (col.key === 'priorityName' && lead.priority) {
                return (
                  <div className="flex items-center gap-1.5">
                    {getPriorityIcon(lead.priority)}
                    <span className="text-xs font-medium" style={{ color: lead.priority.color }}>
                      {lead.priority.name}
                    </span>
                  </div>
                );
              }

              // Score column — number + progress bar
              if (col.key === 'score') {
                const score = Number(value) || 0;
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-7 text-right">{score}</span>
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getScoreColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
                    </div>
                  </div>
                );
              }

              // Owner column
              if (col.key === 'ownerName' && lead.owner) {
                return (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {lead.owner.firstName} {lead.owner.lastName}
                  </span>
                );
              }

              // Company column — icon
              if (col.key === 'company' && value) {
                return (
                  <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <Building2 size={14} className="text-gray-400" />
                    {String(value)}
                  </div>
                );
              }

              return undefined; // use default renderer
            }}
            renderActions={(row) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => navigate(`/leads/${row.id}`)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="View">
                  <Eye size={16} />
                </button>
                {canEdit('leads') && (
                  <button onClick={() => navigate(`/leads/${row.id}/edit`)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Edit">
                    <Pencil size={16} />
                  </button>
                )}
                {canDelete('leads') && (
                  <button onClick={() => setShowDeleteConfirm(String(row.id))} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Lead</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this lead? This action can be undone by an admin.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Required Fields Modal */}
      {kanbanFieldsModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setKanbanFieldsModal(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(520px, 80vh)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Required for "{kanbanFieldsModal.stageName}"
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Fill in missing fields to move this lead
                </p>
              </div>
              <button onClick={() => setKanbanFieldsModal(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {kanbanFieldsModal.missingFields.length} required field{kanbanFieldsModal.missingFields.length !== 1 ? 's' : ''} must be filled
                </p>
              </div>

              {kanbanFieldsModal.missingFields
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <div key={field.fieldKey}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {field.fieldLabel} <span className="text-red-500">*</span>
                    </label>
                    {field.fieldType === 'textarea' ? (
                      <textarea
                        value={kanbanFieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setKanbanFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setKanbanFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        rows={2}
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          kanbanFieldErrors[field.fieldKey] ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    ) : field.fieldType === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={kanbanFieldValues[field.fieldKey] || false}
                          onChange={(e) => {
                            setKanbanFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.checked }));
                            setKanbanFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{field.fieldLabel}</span>
                      </label>
                    ) : field.fieldType === 'file' ? (
                      <div>
                        <label
                          className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            kanbanFieldErrors[field.fieldKey]
                              ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                              : 'border-gray-300 dark:border-slate-600 hover:border-blue-400 bg-gray-50 dark:bg-slate-800'
                          }`}
                        >
                          {kanbanFieldValues[field.fieldKey] ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              <span className="truncate max-w-[200px]">
                                {typeof kanbanFieldValues[field.fieldKey] === 'string'
                                  ? kanbanFieldValues[field.fieldKey].split('/').pop()
                                  : kanbanFieldValues[field.fieldKey]?.name || 'File selected'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setKanbanFieldValues(prev => ({ ...prev, [field.fieldKey]: '' }));
                                }}
                                className="ml-1 text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                              <span className="text-xs text-gray-500 dark:text-slate-400">Click to upload</span>
                            </div>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const formDataUpload = new FormData();
                                formDataUpload.append('file', file);
                                const { data: uploadResult } = await (await import('../../api/contacts.api')).api.post('/uploads', formDataUpload, {
                                  headers: { 'Content-Type': 'multipart/form-data' },
                                });
                                const fileUrl = uploadResult.url || uploadResult.path || uploadResult.fileUrl;
                                setKanbanFieldValues(prev => ({ ...prev, [field.fieldKey]: fileUrl }));
                                setKanbanFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                              } catch (err) {
                                console.error('File upload failed:', err);
                                setKanbanFieldErrors(prev => ({ ...prev, [field.fieldKey]: 'Upload failed' }));
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <input
                        type={
                          field.fieldType === 'email' ? 'email' :
                          field.fieldType === 'number' ? 'number' :
                          field.fieldType === 'date' ? 'date' :
                          field.fieldType === 'phone' ? 'tel' :
                          field.fieldType === 'url' ? 'url' : 'text'
                        }
                        value={kanbanFieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setKanbanFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setKanbanFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          kanbanFieldErrors[field.fieldKey] ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
                        }`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    )}
                    {kanbanFieldErrors[field.fieldKey] && (
                      <p className="text-xs text-red-500 mt-1">{kanbanFieldErrors[field.fieldKey]}</p>
                    )}
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
              <button onClick={() => setKanbanFieldsModal(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleKanbanFieldsSubmit}
                disabled={kanbanSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {kanbanSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {kanbanSubmitting ? 'Moving...' : `Move to ${kanbanFieldsModal.stageName}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}