import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Shield, Pencil, Trash2, Eye, X, Copy, Users,
  Lock, CheckSquare, Square, MinusSquare, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { Role, RolesQuery, ModuleDefinitionsResponse } from '../../api/roles.api';
import { rolesApi } from '../../api/roles.api';
import { RoleFormModal } from './RoleFormModal';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

export function RolesPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('roles');
  const tablePrefs = useTablePreferences('roles', allColumns, defaultVisibleKeys);

  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [query, setQuery] = useState<RolesQuery>({ page: 1, limit: 50, sortBy: 'level', sortOrder: 'DESC' });
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState('');

  // Module definitions for grid
  const [moduleDefs, setModuleDefs] = useState<ModuleDefinitionsResponse | null>(null);

  // Detail
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Clone
  const [showCloneModal, setShowCloneModal] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // Grid collapse state
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // ============================================================
  // DATA FETCHING
  // ============================================================
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rolesApi.getAll(query);
      setRoles(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  useEffect(() => {
    rolesApi.getModuleDefinitions().then(setModuleDefs).catch(console.error);
  }, []);

  // ── Sync table preferences into query once loaded ──
  useEffect(() => {
    if (!tablePrefs.loading) {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn || prev.sortBy,
        sortOrder: tablePrefs.sortOrder || prev.sortOrder,
      }));
    }
  }, [tablePrefs.loading]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const role = await rolesApi.getOne(id);
      setSelectedRole(role);
      // Expand all modules by default
      if (moduleDefs) {
        const expanded: Record<string, boolean> = {};
        Object.keys(moduleDefs.modules).forEach((m) => { expanded[m] = true; });
        setExpandedModules(expanded);
      }
    } catch (err) {
      console.error('Failed to load role detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ============================================================
  // HANDLERS
  // ============================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleTypeFilter = (type: string) => {
    setFilterType(type);
    setQuery((prev) => ({ ...prev, type: type || undefined, page: 1 }));
  };

  const handleCreate = () => {
    setEditingRole(null);
    setShowFormModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingRole(null);
    fetchRoles();
    if (selectedRole) loadDetail(selectedRole.id);
  };

  const handleDelete = async (id: string) => {
    setDeleteError('');
    try {
      await rolesApi.delete(id);
      setShowDeleteConfirm(null);
      if (selectedRole?.id === id) setSelectedRole(null);
      fetchRoles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to delete role';
      setDeleteError(msg);
    }
  };

  const handleClone = async () => {
    if (!cloneName.trim() || !showCloneModal) return;
    setCloneLoading(true);
    setCloneError('');
    try {
      await rolesApi.clone(showCloneModal, cloneName.trim());
      setShowCloneModal(null);
      setCloneName('');
      fetchRoles();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to clone role';
      setCloneError(msg);
    } finally {
      setCloneLoading(false);
    }
  };

  const toggleModuleExpand = (module: string) => {
    setExpandedModules((prev) => ({ ...prev, [module]: !prev[module] }));
  };

  // ============================================================
  // PERMISSION GRID HELPERS
  // ============================================================
  const getModulePermissionSummary = (permissions: Record<string, Record<string, boolean>>, module: string) => {
    if (!permissions[module]) return 'none';
    const actions = Object.values(permissions[module]);
    if (actions.every((v) => v === true)) return 'full';
    if (actions.some((v) => v === true)) return 'partial';
    return 'none';
  };

  const getPermissionIcon = (summary: string) => {
    switch (summary) {
      case 'full': return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case 'partial': return <MinusSquare className="w-4 h-4 text-amber-500" />;
      default: return <Square className="w-4 h-4 text-gray-300 dark:text-slate-600" />;
    }
  };

  const getRecordAccessLabel = (level: string) => {
    switch (level) {
      case 'all': return { label: 'All Records', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' };
      case 'team': return { label: 'Team Records', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' };
      default: return { label: 'Own Records', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' };
    }
  };

  // ============================================================
  // BADGES
  // ============================================================
  const getRoleBadge = (role: Role) => {
    if (role.isSystem) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          System
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        Custom
      </span>
    );
  };

  const getLevelBadge = (level: number) => {
    let color = 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400';
    if (level >= 80) color = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    else if (level >= 40) color = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    else if (level >= 15) color = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        Lvl {level}
      </span>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{meta.total} roles</p>
        </div>
        {canCreate('roles') && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => handleTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 dark:text-white"
        >
          <option value="">All Roles</option>
          <option value="system">System</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Left: DataTable */}
        <div className={`${selectedRole ? 'w-1/2 xl:w-2/5' : 'w-full'} transition-all`}>
          <DataTable<Role>
            module="roles"
            allColumns={allColumns}
            defaultVisibleKeys={defaultVisibleKeys}
            data={roles}
            loading={loading || columnsLoading}
            meta={meta}
            visibleColumns={tablePrefs.visibleColumns}
            sortColumn={query.sortBy || 'level'}
            sortOrder={query.sortOrder || 'DESC'}
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
            emptyMessage="No roles found."
            renderCell={(col, value, row) => {
              const role = row;

              // Name column — shield icon + name + description
              if (col.key === 'name') {
                return (
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      role.isSystem
                        ? 'bg-purple-100 dark:bg-purple-900/30'
                        : 'bg-indigo-100 dark:bg-indigo-900/30'
                    }`}>
                      <Shield className={`w-4 h-4 ${
                        role.isSystem
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-gray-900 dark:text-white capitalize">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{role.description}</p>
                      )}
                    </div>
                  </div>
                );
              }

              // Type (isSystem / isCustom) — badge
              if (col.key === 'isSystem') {
                return getRoleBadge(role);
              }

              // Level — colored badge
              if (col.key === 'level') {
                return getLevelBadge(role.level);
              }

              // Users count
              if (col.key === 'usersCount') {
                return (
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    {role.userCount}
                  </span>
                );
              }

              return undefined; // default renderer
            }}
            renderActions={(row) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => loadDetail(row.id)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  title="View details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {canCreate('roles') && (
                  <button
                    onClick={() => { setCloneName(`${row.name} (copy)`); setCloneError(''); setShowCloneModal(row.id); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    title="Clone role"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                {canEdit('roles') && (
                  <button
                    onClick={() => handleEdit(row)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    title={row.isSystem ? 'Edit permissions' : 'Edit'}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canDelete('roles') && !row.isSystem && (
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
        </div>

        {/* Right: detail panel with permission grid */}
        {selectedRole && (
          <div className="w-1/2 xl:w-3/5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 sticky top-6 overflow-hidden">
              {/* Detail header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white capitalize">{selectedRole.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-purple-200 text-xs">Level {selectedRole.level}</span>
                      {selectedRole.isSystem && (
                        <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> System
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRole(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : (
                <div className="p-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Description */}
                  {selectedRole.description && (
                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedRole.description}</p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{selectedRole.userCount}</p>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/60">Users</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                        {moduleDefs ? Object.keys(moduleDefs.modules).filter(
                          (m) => getModulePermissionSummary(selectedRole.permissions, m) !== 'none'
                        ).length : 0}
                      </p>
                      <p className="text-xs text-indigo-600/70 dark:text-indigo-400/60">Modules</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{selectedRole.level}</p>
                      <p className="text-xs text-blue-600/70 dark:text-blue-400/60">Level</p>
                    </div>
                  </div>

                  {/* Permission Grid (read-only) */}
                  {moduleDefs && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Permission Matrix
                      </h3>
                      <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        {Object.entries(moduleDefs.modules).map(([moduleKey, moduleDef]) => {
                          const summary = getModulePermissionSummary(selectedRole.permissions, moduleKey);
                          const isExpanded = expandedModules[moduleKey];
                          const modulePerms = selectedRole.permissions[moduleKey] || {};
                          const recordAccess = selectedRole.recordAccess?.[moduleKey];

                          return (
                            <div key={moduleKey} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                              {/* Module row */}
                              <button
                                onClick={() => toggleModuleExpand(moduleKey)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 text-left"
                              >
                                <div className="flex items-center gap-2.5">
                                  {isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                  }
                                  {getPermissionIcon(summary)}
                                  <span className="text-sm font-medium text-gray-800 dark:text-slate-200">
                                    {moduleDef.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {recordAccess && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRecordAccessLabel(recordAccess).color}`}>
                                      {getRecordAccessLabel(recordAccess).label}
                                    </span>
                                  )}
                                  <span className={`text-xs ${
                                    summary === 'full'
                                      ? 'text-emerald-500'
                                      : summary === 'partial'
                                      ? 'text-amber-500'
                                      : 'text-gray-400 dark:text-slate-500'
                                  }`}>
                                    {summary === 'full'
                                      ? 'Full Access'
                                      : summary === 'partial'
                                      ? 'Partial'
                                      : 'No Access'}
                                  </span>
                                </div>
                              </button>

                              {/* Expanded actions */}
                              {isExpanded && (
                                <div className="px-4 pb-3 pt-0">
                                  <div className="flex flex-wrap gap-2 ml-8">
                                    {moduleDef.actions.map((action) => {
                                      const allowed = modulePerms[action] === true;
                                      return (
                                        <span
                                          key={action}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                            allowed
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30'
                                              : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 line-through'
                                          }`}
                                        >
                                          {action}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Record Access Summary */}
                  {selectedRole.recordAccess && Object.keys(selectedRole.recordAccess).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Record Access Scope
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedRole.recordAccess).map(([module, level]) => {
                          const { label, color } = getRecordAccessLabel(level);
                          return (
                            <div key={module} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                              <span className="text-xs font-medium text-gray-600 dark:text-slate-300 capitalize">{module}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Assigned Users */}
                  {selectedRole.users && selectedRole.users.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Assigned Users ({selectedRole.users.length})
                      </h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {selectedRole.users.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                            onClick={() => navigate(`/users/${u.id}`)}
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300 flex-shrink-0">
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900 dark:text-white truncate">{u.firstName} {u.lastName}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              u.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    {canEdit('roles') && (
                      <button
                        onClick={() => handleEdit(selectedRole)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {canCreate('roles') && (
                      <button
                        onClick={() => { setCloneName(`${selectedRole.name} (copy)`); setCloneError(''); setShowCloneModal(selectedRole.id); }}
                        className="flex items-center justify-center gap-2 px-3 py-2 border border-blue-200 dark:border-blue-800 text-sm font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      >
                        <Copy className="w-4 h-4" />
                        Clone
                      </button>
                    )}
                    {canDelete('roles') && !selectedRole.isSystem && (
                      <button
                        onClick={() => { setDeleteError(''); setShowDeleteConfirm(selectedRole.id); }}
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
        <RoleFormModal
          role={editingRole}
          moduleDefs={moduleDefs}
          onClose={() => { setShowFormModal(false); setEditingRole(null); }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Copy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white">Clone Role</h3>
            <p className="text-sm text-center text-gray-500 dark:text-slate-400 mt-2">
              Create a new custom role with the same permissions.
            </p>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="New role name"
              className="w-full mt-4 px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
            {cloneError && (
              <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {cloneError}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowCloneModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!cloneName.trim() || cloneLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {cloneLoading ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white">Delete Role</h3>
            <p className="text-sm text-center text-gray-500 dark:text-slate-400 mt-2">
              This will permanently delete this role. Users assigned to it must be reassigned first.
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