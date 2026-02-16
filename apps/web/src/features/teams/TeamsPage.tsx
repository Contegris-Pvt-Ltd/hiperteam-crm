import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, Pencil, Trash2, Eye, X, UserPlus, UserMinus,
  Building2, Crown,
} from 'lucide-react';
import type { Team, TeamsQuery } from '../../api/teams.api';
import { teamsApi } from '../../api/teams.api';
import type { DepartmentLookupItem } from '../../api/departments.api';
import { departmentsApi } from '../../api/departments.api';
import { usersApi } from '../../api/users.api';
import { TeamFormModal } from './TeamFormModal';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function TeamsPage() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('teams');
  const tablePrefs = useTablePreferences('teams', allColumns, defaultVisibleKeys);

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [query, setQuery] = useState<TeamsQuery>({ page: 1, limit: 50 });
  const [searchInput, setSearchInput] = useState('');

  // Filters
  const [departments, setDepartments] = useState<DepartmentLookupItem[]>([]);
  const [filterDept, setFilterDept] = useState('');

  // Detail
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'member' | 'lead'>('member');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Guards to prevent multiple fetches on mount
  const prefsApplied = useRef(false);
  const searchMounted = useRef(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teamsApi.getAll(query);
      setTeams(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // ── Sync table preferences into query once loaded (runs first) ──
  useEffect(() => {
    if (!tablePrefs.loading && !prefsApplied.current) {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
      prefsApplied.current = true;
    }
  }, [tablePrefs.loading]);

  // ── Fetch data (waits for prefs to be applied) ──
  useEffect(() => {
    if (!prefsApplied.current) return;
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    departmentsApi.getLookup().then(setDepartments).catch(console.error);
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const team = await teamsApi.getOne(id);
      setSelectedTeam(team);
    } catch (err) {
      console.error('Failed to load team detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadUserOptions = async () => {
    try {
      const res = await usersApi.getAll({ limit: 200, status: 'active' });
      setUserOptions(
        res.data.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        })),
      );
    } catch (err) {
      console.error('Failed to load users:', err);
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

  const handleDeptFilter = (deptId: string) => {
    setFilterDept(deptId);
    setQuery((prev) => ({ ...prev, departmentId: deptId || undefined, page: 1 }));
  };

  const handleCreate = () => {
    setEditingTeam(null);
    setShowFormModal(true);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setShowFormModal(true);
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingTeam(null);
    fetchTeams();
    if (selectedTeam) loadDetail(selectedTeam.id);
  };

  const handleDelete = async (id: string) => {
    setDeleteError('');
    try {
      await teamsApi.delete(id);
      setShowDeleteConfirm(null);
      if (selectedTeam?.id === id) setSelectedTeam(null);
      fetchTeams();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to delete team';
      setDeleteError(msg);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberUserId || !selectedTeam) return;
    setAddMemberLoading(true);
    try {
      await teamsApi.addMember(selectedTeam.id, { userId: addMemberUserId, role: addMemberRole });
      await loadDetail(selectedTeam.id);
      fetchTeams();
      setAddMemberUserId('');
      setAddMemberRole('member');
      setShowAddMember(false);
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;
    try {
      await teamsApi.removeMember(selectedTeam.id, userId);
      await loadDetail(selectedTeam.id);
      fetchTeams();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
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

  const getRoleBadge = (role: string) => (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
      role === 'lead'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
    }`}>
      {role === 'lead' ? 'Lead' : 'Member'}
    </span>
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{meta.total} teams</p>
        </div>
        {canCreate('users') && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => handleDeptFilter(e.target.value)}
          className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Left: DataTable */}
        <div className={`${selectedTeam ? 'w-1/2 xl:w-3/5' : 'w-full'} transition-all`}>
          <DataTable<Team>
            module="teams"
            allColumns={allColumns}
            defaultVisibleKeys={defaultVisibleKeys}
            data={teams}
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
            emptyMessage="No teams found. Create your first team to get started."
            renderCell={(col, _value, row) => {
              const team = row;

              // Name column — icon + name + description
              if (col.key === 'name') {
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-gray-900 dark:text-white truncate block">{team.name}</span>
                      {team.description && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{team.description}</p>
                      )}
                    </div>
                  </div>
                );
              }

              // Department column — building icon
              if (col.key === 'departmentName') {
                if (!team.departmentName) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                return (
                  <span className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {team.departmentName}
                  </span>
                );
              }

              // Team lead column — avatar + name
              if (col.key === 'teamLeadName') {
                if (!team.teamLead) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                return (
                  <div className="flex items-center gap-2">
                    {team.teamLead.avatarUrl ? (
                      <img src={team.teamLead.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300">
                        {team.teamLead.firstName?.[0]}{team.teamLead.lastName?.[0]}
                      </div>
                    )}
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {team.teamLead.firstName} {team.teamLead.lastName}
                    </span>
                  </div>
                );
              }

              // Member count
              if (col.key === 'memberCount') {
                return (
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{team.memberCount ?? 0}</span>
                );
              }

              // Active status
              if (col.key === 'isActive') {
                return getStatusBadge(team.isActive);
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
        </div>

        {/* Right: detail panel */}
        {selectedTeam && (
          <div className="w-1/2 xl:w-2/5">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 sticky top-6 overflow-hidden">
              {/* Detail header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedTeam.name}</h2>
                    {selectedTeam.departmentName && (
                      <span className="text-indigo-200 text-xs flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {selectedTeam.departmentName}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : (
                <div className="p-5 space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Info */}
                  {selectedTeam.description && (
                    <p className="text-sm text-gray-600 dark:text-slate-400">{selectedTeam.description}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTeam.isActive)}
                  </div>

                  {/* Team Lead */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Team Lead</h3>
                    {selectedTeam.teamLead ? (
                      <div
                        className="flex items-center gap-3 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20"
                        onClick={() => navigate(`/users/${selectedTeam.teamLead!.id}`)}
                      >
                        {selectedTeam.teamLead.avatarUrl ? (
                          <img src={selectedTeam.teamLead.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-xs font-semibold text-amber-700 dark:text-amber-300">
                            {selectedTeam.teamLead.firstName?.[0]}{selectedTeam.teamLead.lastName?.[0]}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedTeam.teamLead.firstName} {selectedTeam.teamLead.lastName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{selectedTeam.teamLead.email}</p>
                        </div>
                        <Crown className="w-4 h-4 text-amber-500" />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-slate-500 italic">No lead assigned</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{selectedTeam.members?.length || 0}</p>
                      <p className="text-xs text-indigo-600/70 dark:text-indigo-400/60">Members</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
                        {selectedTeam.members?.filter((m) => m.teamRole === 'lead').length || 0}
                      </p>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/60">Leads</p>
                    </div>
                  </div>

                  {/* Members list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Members ({selectedTeam.members?.length || 0})
                      </h3>
                      {canEdit('users') && (
                        <button
                          onClick={() => {
                            setShowAddMember(true);
                            if (userOptions.length === 0) loadUserOptions();
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                    </div>

                    {/* Add member inline form */}
                    {showAddMember && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl mb-3 space-y-2">
                        <select
                          value={addMemberUserId}
                          onChange={(e) => setAddMemberUserId(e.target.value)}
                          className="w-full px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                        >
                          <option value="">Select user...</option>
                          {userOptions
                            .filter((u) => !selectedTeam.members?.some((m) => m.id === u.id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.firstName} {u.lastName} ({u.email})
                              </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <select
                            value={addMemberRole}
                            onChange={(e) => setAddMemberRole(e.target.value as 'member' | 'lead')}
                            className="flex-1 px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                          >
                            <option value="member">Member</option>
                            <option value="lead">Lead</option>
                          </select>
                          <button
                            onClick={handleAddMember}
                            disabled={!addMemberUserId || addMemberLoading}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setShowAddMember(false)}
                            className="px-3 py-2 border border-gray-200 dark:border-slate-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedTeam.members && selectedTeam.members.length > 0 ? (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {selectedTeam.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 group"
                          >
                            <div
                              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              onClick={() => navigate(`/users/${m.id}`)}
                            >
                              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300 flex-shrink-0">
                                {m.firstName?.[0]}{m.lastName?.[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{m.firstName} {m.lastName}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{m.jobTitle || m.email}</p>
                              </div>
                            </div>
                            {getRoleBadge(m.teamRole)}
                            {canEdit('users') && (
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="p-1 text-gray-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove member"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-slate-500 italic py-2">No members yet</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    {canEdit('users') && (
                      <button
                        onClick={() => handleEdit(selectedTeam)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {canDelete('users') && (
                      <button
                        onClick={() => { setDeleteError(''); setShowDeleteConfirm(selectedTeam.id); }}
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
        <TeamFormModal
          team={editingTeam}
          onClose={() => { setShowFormModal(false); setEditingTeam(null); }}
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
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white">Delete Team</h3>
            <p className="text-sm text-center text-gray-500 dark:text-slate-400 mt-2">
              This will permanently delete the team and remove all member associations. This action cannot be undone.
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