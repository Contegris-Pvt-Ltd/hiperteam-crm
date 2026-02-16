import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, Users, Layers, ChevronRight, ChevronDown,
  Pencil, Trash2, Eye, GitBranch,
  FolderTree, List, X,
} from 'lucide-react';
import type {
  Department, DepartmentsQuery, DepartmentHierarchyNode,
} from '../../api/departments.api';
import { departmentsApi } from '../../api/departments.api';
import { DepartmentFormModal } from './DepartmentFormModal';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

type ViewMode = 'list' | 'hierarchy';

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('departments');
  const tablePrefs = useTablePreferences('departments', allColumns, defaultVisibleKeys);

  // State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hierarchy, setHierarchy] = useState<DepartmentHierarchyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [query, setQuery] = useState<DepartmentsQuery>({ page: 1, limit: 50 });
  const [searchInput, setSearchInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Detail
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Expanded nodes for hierarchy view
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Guards to prevent multiple fetches on mount
  const prefsApplied = useRef(false);
  const searchMounted = useRef(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================
  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentsApi.getAll(query);
      setDepartments(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const fetchHierarchy = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await departmentsApi.getHierarchy();
      setHierarchy(tree);
      // Expand all root nodes by default
      setExpandedNodes(new Set(tree.map((n) => n.id)));
    } catch (err) {
      console.error('Failed to fetch hierarchy:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sync table preferences into query once loaded (runs first) ──
  useEffect(() => {
    if (!tablePrefs.loading && viewMode === 'list' && !prefsApplied.current) {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
      prefsApplied.current = true;
    }
  }, [tablePrefs.loading, viewMode]);

  // ── Fetch data (waits for prefs to be applied) ──
  useEffect(() => {
    if (viewMode === 'list') {
      if (!prefsApplied.current) return;
      fetchDepartments();
    } else {
      fetchHierarchy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, query]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const dept = await departmentsApi.getOne(id);
      setSelectedDept(dept);
    } catch (err) {
      console.error('Failed to load department detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================
  useEffect(() => {
    // Skip the initial mount — only fire on actual user input
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCreate = () => {
    setEditingDept(null);
    setShowFormModal(true);
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingDept(null);
    if (viewMode === 'list') fetchDepartments();
    else fetchHierarchy();
    if (selectedDept) loadDetail(selectedDept.id);
  };

  const handleDelete = async (id: string) => {
    setDeleteError('');
    try {
      await departmentsApi.delete(id);
      setShowDeleteConfirm(null);
      if (selectedDept?.id === id) setSelectedDept(null);
      if (viewMode === 'list') fetchDepartments();
      else fetchHierarchy();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to delete department';
      setDeleteError(msg);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============================================================
  // BADGES
  // ============================================================
  const getStatusBadge = (isActive: boolean) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );

  // ============================================================
  // HIERARCHY TREE NODE
  // ============================================================
  const renderTreeNode = (node: DepartmentHierarchyNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedDept?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          onClick={() => loadDetail(node.id)}
        >
          {/* Expand/collapse */}
          <button
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id); }}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
              hasChildren ? 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200' : 'invisible'
            }`}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            node.isActive
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500'
          }`}>
            <Building2 className="w-4 h-4" />
          </div>

          {/* Name + code */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{node.name}</span>
              {node.code && (
                <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">{node.code}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              {node.headName && <span>{node.headName}</span>}
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{node.memberCount}</span>
              <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{node.teamCount} teams</span>
            </div>
          </div>

          {/* Status */}
          {getStatusBadge(node.isActive)}

          {/* Actions */}
          {canEdit('users') && (
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(node as unknown as Department); }}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Departments</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {viewMode === 'list' ? `${meta.total} departments` : `${hierarchy.length} root departments`}
          </p>
        </div>
        <div className="flex gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                viewMode === 'hierarchy'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              Tree
            </button>
          </div>

          {canCreate('users') && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              Add Department
            </button>
          )}
        </div>
      </div>

      {/* Search (list view only) */}
      {viewMode === 'list' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
          />
        </div>
      )}

      {/* Main content area: list/tree + detail panel */}
      <div className="flex gap-6">
        {/* Left: list or tree */}
        <div className={`${selectedDept ? 'w-1/2 xl:w-3/5' : 'w-full'} transition-all`}>
          {viewMode === 'list' ? (
            /* ============ LIST VIEW (DataTable) ============ */
            <DataTable<Department>
              module="departments"
              allColumns={allColumns}
              defaultVisibleKeys={defaultVisibleKeys}
              data={departments}
              loading={loading || columnsLoading}
              meta={meta}
              visibleColumns={tablePrefs.visibleColumns}
              sortColumn={query.sortBy || 'name'}
              sortOrder={query.sortOrder || 'ASC'}
              pageSize={query.limit || 50}
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
              onRowClick={(row) => loadDetail(row.id)}
              emptyMessage="No departments found. Create your first department to organize your team."
              renderCell={(col, _value, row) => {
                const dept = row;

                // Name column — icon + name + code + parent
                if (col.key === 'name') {
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{dept.name}</span>
                          {dept.code && (
                            <span className="text-xs font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {dept.code}
                            </span>
                          )}
                        </div>
                        {dept.parentDepartmentName && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                            <GitBranch className="w-3 h-3" />
                            {dept.parentDepartmentName}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Head column — avatar + name
                if (col.key === 'headName') {
                  if (!dept.head) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                  return (
                    <div className="flex items-center gap-2">
                      {dept.head.avatarUrl ? (
                        <img src={dept.head.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300">
                          {dept.head.firstName?.[0]}{dept.head.lastName?.[0]}
                        </div>
                      )}
                      <span className="text-sm text-gray-700 dark:text-slate-300">
                        {dept.head.firstName} {dept.head.lastName}
                      </span>
                    </div>
                  );
                }

                // Member count
                if (col.key === 'memberCount') {
                  return (
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{dept.memberCount ?? 0}</span>
                  );
                }

                // Team count
                if (col.key === 'teamCount') {
                  return (
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{dept.teamCount ?? 0}</span>
                  );
                }

                // Active status
                if (col.key === 'isActive') {
                  return getStatusBadge(dept.isActive);
                }

                return undefined; // default renderer
              }}
              renderActions={(row) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => loadDetail(row.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit('users') && (
                    <button
                      onClick={() => handleEdit(row)}
                      className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete('users') && (
                    <button
                      onClick={() => { setDeleteError(''); setShowDeleteConfirm(row.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            />
          ) : (
            /* ============ HIERARCHY VIEW ============ */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-3">
              {loading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="text-gray-500 dark:text-slate-400 mt-3 text-sm">Loading departments...</p>
                </div>
              ) : hierarchy.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-slate-400">
                  <FolderTree className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                  <p className="font-medium">No departments yet</p>
                  <p className="text-sm mt-1">Create your first department to build your org structure.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {hierarchy.map((node) => renderTreeNode(node, 0))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedDept && (
          <div className="w-1/2 xl:w-2/5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 sticky top-6 overflow-hidden">
              {/* Detail header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedDept.name}</h2>
                    {selectedDept.code && (
                      <span className="text-blue-200 text-xs font-mono">{selectedDept.code}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDept(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : (
                <div className="p-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Info */}
                  <div className="space-y-3">
                    {selectedDept.description && (
                      <p className="text-sm text-gray-600 dark:text-slate-400">{selectedDept.description}</p>
                    )}

                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedDept.isActive)}
                      {selectedDept.parentDepartmentName && (
                        <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          Parent: {selectedDept.parentDepartmentName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Head */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Department Head</h3>
                    {selectedDept.head ? (
                      <div
                        className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                        onClick={() => navigate(`/users/${selectedDept.head!.id}`)}
                      >
                        {selectedDept.head.avatarUrl ? (
                          <img src={selectedDept.head.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {selectedDept.head.firstName?.[0]}{selectedDept.head.lastName?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedDept.head.firstName} {selectedDept.head.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{selectedDept.head.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-slate-500 italic">No head assigned</p>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{selectedDept.members?.length || 0}</p>
                      <p className="text-xs text-blue-600/70 dark:text-blue-400/60">Members</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{selectedDept.teams?.length || 0}</p>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/60">Teams</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{selectedDept.children?.length || 0}</p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/60">Sub-depts</p>
                    </div>
                  </div>

                  {/* Members list */}
                  {selectedDept.members && selectedDept.members.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Members ({selectedDept.members.length})
                      </h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {selectedDept.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                            onClick={() => navigate(`/users/${m.id}`)}
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300">
                              {m.firstName?.[0]}{m.lastName?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 dark:text-white truncate">{m.firstName} {m.lastName}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{m.jobTitle || m.email}</p>
                            </div>
                            {m.roleName && (
                              <span className="text-xs text-gray-400 dark:text-slate-500">{m.roleName}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Teams list */}
                  {selectedDept.teams && selectedDept.teams.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Teams ({selectedDept.teams.length})
                      </h3>
                      <div className="space-y-1.5">
                        {selectedDept.teams.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-2 px-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{t.name}</p>
                              {t.leadName && <p className="text-xs text-gray-400 dark:text-slate-500">Lead: {t.leadName}</p>}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-slate-400">{t.memberCount} members</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-departments */}
                  {selectedDept.children && selectedDept.children.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Sub-departments ({selectedDept.children.length})
                      </h3>
                      <div className="space-y-1.5">
                        {selectedDept.children.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between py-2 px-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                            onClick={() => loadDetail(c.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                              {c.code && <span className="text-xs text-gray-400 font-mono">{c.code}</span>}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-slate-400">{c.memberCount} members</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    {canEdit('users') && (
                      <button
                        onClick={() => handleEdit(selectedDept)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {canDelete('users') && (
                      <button
                        onClick={() => { setDeleteError(''); setShowDeleteConfirm(selectedDept.id); }}
                        className="flex items-center justify-center gap-2 px-3 py-2 border border-red-200 dark:border-red-800 text-sm font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showFormModal && (
        <DepartmentFormModal
          department={editingDept}
          onClose={() => { setShowFormModal(false); setEditingDept(null); }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white">Delete Department</h3>
            <p className="text-sm text-center text-gray-500 dark:text-slate-400 mt-2">
              This action cannot be undone. The department must have no members, teams, or sub-departments.
            </p>
            {deleteError && (
              <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}