// ============================================================
// FILE: apps/web/src/features/opportunities/OpportunitiesPage.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, LayoutList, LayoutGrid,
  Flame, Thermometer, Snowflake, Sun, Minus,
  Filter, X, DollarSign, TrendingUp,
  Loader2, AlertTriangle,
} from 'lucide-react';
import type {
  Opportunity, OpportunitiesQuery, OpportunityStage, OpportunityPriority,
  KanbanStageData, Pipeline,
} from '../../api/opportunities.api';
import { opportunitiesApi, opportunitySettingsApi } from '../../api/opportunities.api';
import { OpportunityKanbanBoard } from './components/OpportunityKanbanBoard';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

// Priority icon map
const PRIORITY_ICONS: Record<string, any> = {
  flame: Flame,
  thermometer: Thermometer,
  snowflake: Snowflake,
  sun: Sun,
  minus: Minus,
};

export function OpportunitiesPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('opportunities');
  const tablePrefs = useTablePreferences('opportunities', allColumns, defaultVisibleKeys);

  // Data
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });

  // Kanban
  const [kanbanData, setKanbanData] = useState<KanbanStageData[]>([]);

  // Lookups
  const [stages, setStages] = useState<OpportunityStage[]>([]);
  const [priorities, setPriorities] = useState<OpportunityPriority[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Query state
  const [query, setQuery] = useState<OpportunitiesQuery>({ page: 1, limit: 20, view: 'list' });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Sync table preferences into query
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
    oppId: string;
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
      opportunitySettingsApi.getPipelines(),
      opportunitySettingsApi.getStages(),
      opportunitySettingsApi.getPriorities(),
      opportunitySettingsApi.getSources(),
    ]).then(([pipelinesData, stagesData, prioritiesData, sourcesData]) => {
      setPipelines(pipelinesData);
      setStages(stagesData);
      setPriorities(prioritiesData);
      setSources(sourcesData);
      const defaultPl = pipelinesData.find((p: Pipeline) => p.isDefault);
      if (defaultPl) setSelectedPipelineId(defaultPl.id);
    }).catch(console.error);
  }, []);

  // ── Reload stages when pipeline changes ──
  useEffect(() => {
    if (selectedPipelineId) {
      opportunitySettingsApi.getStages(selectedPipelineId).then(setStages).catch(console.error);
    }
  }, [selectedPipelineId]);

  // ── Fetch opportunities when query changes ──
  useEffect(() => {
    if (tablePrefs.loading) return;
    fetchOpportunities();
  }, [query, tablePrefs.loading]);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const queryWithPipeline = { ...query, view: viewMode, pipelineId: selectedPipelineId || undefined };
      const response = await opportunitiesApi.getAll(queryWithPipeline);
      if (viewMode === 'kanban') {
        setKanbanData(response.stages || []);
      } else {
        setOpportunities(response.data || []);
        setMeta(response.meta || { total: 0, page: 1, limit: 20, totalPages: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
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
      await opportunitiesApi.delete(id);
      setShowDeleteConfirm(null);
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to delete opportunity:', error);
    }
  };

  const handleKanbanStageDrop = async (oppId: string, newStageId: string) => {
    try {
      const stageFields = await opportunitySettingsApi.getStageFields(newStageId);
      const requiredFields = (Array.isArray(stageFields) ? stageFields : []).filter((f: any) => f.isRequired);

      if (requiredFields.length === 0) {
        await opportunitiesApi.changeStage(oppId, newStageId);
        fetchOpportunities();
        return;
      }

      const fullOpp = await opportunitiesApi.getOne(oppId);
      const missing = requiredFields.filter((f: any) => {
        let val: any;
        if (f.fieldKey.startsWith('custom.')) {
          val = (fullOpp.customFields as Record<string, any>)?.[f.fieldKey.replace('custom.', '')];
        } else {
          val = (fullOpp as any)[f.fieldKey];
        }
        return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
      });

      if (missing.length === 0) {
        await opportunitiesApi.changeStage(oppId, newStageId);
        fetchOpportunities();
        return;
      }

      const targetStage = stages.find(s => s.id === newStageId);
      setKanbanFieldsModal({
        open: true,
        oppId,
        stageId: newStageId,
        stageName: targetStage?.name || 'Stage',
        missingFields: missing,
      });
      setKanbanFieldValues({});
      setKanbanFieldErrors({});
    } catch (error) {
      console.error('Failed to change stage:', error);
    }
  };

  const handleKanbanFieldSubmit = async () => {
    if (!kanbanFieldsModal) return;
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
      await opportunitiesApi.changeStage(kanbanFieldsModal.oppId, kanbanFieldsModal.stageId, kanbanFieldValues);
      setKanbanFieldsModal(null);
      fetchOpportunities();
    } catch (error) {
      console.error('Failed to change stage:', error);
    } finally {
      setKanbanSubmitting(false);
    }
  };

  const getPriorityIcon = (priority: OpportunityPriority | null) => {
    if (!priority) return null;
    const IconComponent = PRIORITY_ICONS[priority.icon] || Minus;
    return <IconComponent size={14} style={{ color: priority.color }} />;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  };

  // Active filter count
  const activeFilterCount = [query.stageId, query.priorityId, query.source, query.type, query.status, query.forecastCategory].filter(Boolean).length;
  const clearFilters = () => {
    setQuery({ ...query, stageId: undefined, priorityId: undefined, source: undefined, type: undefined, status: undefined, forecastCategory: undefined, page: 1 });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Opportunities</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {meta.total} total{viewMode === 'kanban' ? '' : ` · Page ${meta.page} of ${meta.totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pipeline selector */}
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId}
              onChange={(e) => {
                setSelectedPipelineId(e.target.value);
                setQuery(prev => ({ ...prev, pipelineId: e.target.value, page: 1 }));
              }}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              {pipelines.filter(p => p.isActive).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>
          )}
          {canCreate('deals') && (
            <button
              onClick={() => navigate('/opportunities/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Opportunity
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
              placeholder="Search opportunities by name, account, contact..."
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
              value={query.status || ''}
              onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as any, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>

            {/* Forecast Category filter */}
            <select
              value={query.forecastCategory || ''}
              onChange={(e) => setQuery({ ...query, forecastCategory: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Forecast Categories</option>
              <option value="Pipeline">Pipeline</option>
              <option value="Best Case">Best Case</option>
              <option value="Commit">Commit</option>
              <option value="Closed">Closed</option>
              <option value="Omitted">Omitted</option>
            </select>

            {/* Type filter */}
            <select
              value={query.type || ''}
              onChange={(e) => setQuery({ ...query, type: e.target.value || undefined, page: 1 })}
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Types</option>
              <option value="New Business">New Business</option>
              <option value="Existing Business">Existing Business</option>
              <option value="Renewal">Renewal</option>
              <option value="Upsell">Upsell</option>
            </select>
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'kanban' ? (
        <OpportunityKanbanBoard
          stages={kanbanData}
          loading={loading}
          onStageDrop={handleKanbanStageDrop}
          onOppClick={(id) => navigate(`/opportunities/${id}`)}
          getPriorityIcon={getPriorityIcon}
          formatCurrency={formatCurrency}
        />
      ) : (
        <>
          {/* ── LIST VIEW (DataTable) ── */}
          <DataTable
            module="opportunities"
            allColumns={allColumns}
            defaultVisibleKeys={defaultVisibleKeys}
            data={opportunities}
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
            onRowClick={(row) => navigate(`/opportunities/${row.id}`)}
            emptyMessage="No opportunities found. Try adjusting your search or filters."
            renderCell={(col, value, row) => {
              const opp = row as unknown as Opportunity;

              // Name column
              if (col.key === 'name') {
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-medium text-emerald-600">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[220px]">
                        {opp.name}
                      </p>
                      {opp.account && <p className="text-xs text-gray-500">{opp.account.name}</p>}
                    </div>
                  </div>
                );
              }

              // Stage
              if (col.key === 'stageName' && opp.stage) {
                return (
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${opp.stage.color}18`, color: opp.stage.color }}
                  >
                    {opp.stage.name}
                  </span>
                );
              }

              // Amount
              if (col.key === 'amount') {
                return (
                  <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(opp.amount)}
                  </span>
                );
              }

              // Weighted amount
              if (col.key === 'weightedAmount') {
                return (
                  <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                    {formatCurrency(opp.weightedAmount)}
                  </span>
                );
              }

              // Probability
              if (col.key === 'probability') {
                return opp.probability !== null ? (
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opp.probability}%</span>
                ) : <span className="text-gray-300">—</span>;
              }

              // Close Date
              if (col.key === 'closeDate' && opp.closeDate) {
                const date = new Date(opp.closeDate);
                const isOverdue = !opp.wonAt && !opp.lostAt && date < new Date();
                return (
                  <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && ' ⚠'}
                  </span>
                );
              }

              // Priority
              if (col.key === 'priorityName' && opp.priority) {
                return (
                  <div className="flex items-center gap-1.5">
                    {getPriorityIcon(opp.priority)}
                    <span className="text-xs font-medium" style={{ color: opp.priority.color }}>
                      {opp.priority.name}
                    </span>
                  </div>
                );
              }

              // Forecast category
              if (col.key === 'forecastCategory' && opp.forecastCategory) {
                const categoryColors: Record<string, string> = {
                  'Pipeline': 'blue', 'Best Case': 'purple', 'Commit': 'green', 'Closed': 'emerald', 'Omitted': 'gray',
                };
                const color = categoryColors[opp.forecastCategory] || 'gray';
                return (
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-${color}-100 text-${color}-700 dark:bg-${color}-900/20 dark:text-${color}-400`}>
                    {opp.forecastCategory}
                  </span>
                );
              }

              // Owner
              if (col.key === 'ownerName' && opp.owner) {
                return (
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {opp.owner.firstName} {opp.owner.lastName}
                  </span>
                );
              }

              // Account
              if (col.key === 'accountName' && opp.account) {
                return <span className="text-sm text-gray-700 dark:text-gray-300">{opp.account.name}</span>;
              }

              return undefined;
            }}
            renderActions={canEdit('deals') || canDelete('deals') ? (row) => {
              const opp = row as unknown as Opportunity;
              return (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="View"
                  >
                    <TrendingUp size={14} />
                  </button>
                  {canDelete('deals') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(opp.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            } : undefined}
          />
        </>
      )}

      {/* ── Kanban Required Fields Modal ── */}
      {kanbanFieldsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setKanbanFieldsModal(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(520px, 80vh)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Required for "{kanbanFieldsModal.stageName}"
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Fill in the required fields to move to this stage
                </p>
              </div>
              <button onClick={() => setKanbanFieldsModal(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {kanbanFieldsModal.missingFields.length} required field{kanbanFieldsModal.missingFields.length !== 1 ? 's' : ''} missing
                </p>
              </div>
              {kanbanFieldsModal.missingFields.sort((a, b) => a.sortOrder - b.sortOrder).map(f => (
                <div key={f.fieldKey}>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    {f.fieldLabel} <span className="text-red-500">*</span>
                  </label>
                  {f.fieldType === 'date' ? (
                    <input
                      type="date"
                      value={kanbanFieldValues[f.fieldKey] || ''}
                      onChange={(e) => setKanbanFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    />
                  ) : f.fieldType === 'number' ? (
                    <input
                      type="number"
                      value={kanbanFieldValues[f.fieldKey] || ''}
                      onChange={(e) => setKanbanFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    />
                  ) : (
                    <input
                      type="text"
                      value={kanbanFieldValues[f.fieldKey] || ''}
                      onChange={(e) => setKanbanFieldValues(prev => ({ ...prev, [f.fieldKey]: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                    />
                  )}
                  {kanbanFieldErrors[f.fieldKey] && (
                    <p className="text-xs text-red-500 mt-1">{kanbanFieldErrors[f.fieldKey]}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
              <button onClick={() => setKanbanFieldsModal(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleKanbanFieldSubmit}
                disabled={kanbanSubmitting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {kanbanSubmitting && <Loader2 size={14} className="animate-spin" />}
                Move to Stage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-sm shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Opportunity?</h3>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}