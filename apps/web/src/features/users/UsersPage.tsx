import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, Filter, Mail,
  Eye, Pencil, Trash2,
  Users, Send, XCircle, RefreshCw,
} from 'lucide-react';
import type { User, UsersQuery, RoleLookup, DepartmentLookup, PendingInvitation } from '../../api/users.api';
import { usersApi } from '../../api/users.api';
import { InviteUserModal } from './InviteUserModal';
import { CreateUserModal } from './CreateUserModal';
import { usePermissions } from '../../hooks/usePermissions';
import { DataTable, useTableColumns, useTablePreferences } from '../../components/shared/data-table';

type Tab = 'users' | 'invitations';

export function UsersPage() {
  //const navigate = useNavigate();
  const { canCreate, canEdit, canDelete, canInvite } = usePermissions();

  // ── DataTable: dynamic columns + user preferences ──
  const { allColumns, defaultVisibleKeys, loading: columnsLoading } = useTableColumns('users');
  const tablePrefs = useTablePreferences('users', allColumns, defaultVisibleKeys);

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [query, setQuery] = useState<UsersQuery>({ page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');

  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Lookups
  const [roles, setRoles] = useState<RoleLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchInvitations();
  }, [query, activeTab]);

  // ── Sync table preferences into query once loaded ──
  useEffect(() => {
    if (!tablePrefs.loading && activeTab === 'users') {
      setQuery(prev => ({
        ...prev,
        limit: tablePrefs.pageSize,
        sortBy: tablePrefs.sortColumn,
        sortOrder: tablePrefs.sortOrder,
      }));
    }
  }, [tablePrefs.loading]);

  const fetchLookups = async () => {
    try {
      const [r, d] = await Promise.all([usersApi.getRoles(), usersApi.getDepartments()]);
      setRoles(r);
      setDepartments(d);
    } catch (err) {
      console.error('Failed to fetch lookups:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersApi.getAll(query);
      setUsers(response.data);
      setMeta(response.meta);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    setInvitationsLoading(true);
    try {
      const data = await usersApi.getPendingInvitations();
      setInvitations(data);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery({ ...query, search: searchInput, page: 1 });
  };

  const handleApplyFilters = () => {
    setQuery({
      ...query,
      roleId: filterRole || undefined,
      departmentId: filterDept || undefined,
      status: filterStatus || undefined,
      page: 1,
    });
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilterRole('');
    setFilterDept('');
    setFilterStatus('');
    setQuery({ page: 1, limit: 20 });
    setSearchInput('');
    setShowFilters(false);
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await usersApi.delete(id);
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const handleCancelInvitation = async (id: string) => {
    try {
      await usersApi.cancelInvitation(id);
      fetchInvitations();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      await usersApi.resendInvitation(id);
      fetchInvitations();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      inactive: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
      suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getRoleBadge = (role: { name: string; level: number } | null) => {
    if (!role) return null;
    const styles: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      user: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[role.name] || styles.user}`}>
        {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{meta.total} users total</p>
        </div>
        <div className="flex gap-2">
          {canInvite('users') && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
            >
              <Mail className="w-4 h-4" />
              Invite User
            </button>
          )}
          {canCreate('users') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              Create User
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'invitations'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          Pending Invitations
          {invitations.length > 0 && (
            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
              {invitations.length}
            </span>
          )}
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700">
                  <Search className="w-4 h-4" />
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm ${
                    showFilters || filterRole || filterDept || filterStatus
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>
            </form>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Role</label>
                  <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white">
                    <option value="">All Roles</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Department</label>
                  <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-white">
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="sm:col-span-3 flex gap-2 justify-end">
                  <button onClick={handleClearFilters} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200">Clear</button>
                  <button onClick={handleApplyFilters} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Apply</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Users DataTable ── */}
          <DataTable<User>
            module="users"
            allColumns={allColumns}
            defaultVisibleKeys={defaultVisibleKeys}
            data={users}
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
            emptyMessage="No users found. Try adjusting your search or filters."
            renderCell={(col, value, row) => {
              const user = row;

              // Name column — avatar + name + email + job title
              if (col.key === 'name') {
                return (
                  <Link to={`/users/${user.id}`} className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                      {user.jobTitle && <p className="text-xs text-gray-400 dark:text-slate-500">{user.jobTitle}</p>}
                    </div>
                  </Link>
                );
              }

              // Role column — colored badge
              if (col.key === 'roleName') {
                return getRoleBadge(user.role);
              }

              // Department column
              if (col.key === 'departmentName') {
                if (!user.department) return <span className="text-sm text-gray-400 dark:text-slate-500">—</span>;
                return <span className="text-sm text-gray-700 dark:text-slate-300">{user.department.name}</span>;
              }

              // Status column — colored badge
              if (col.key === 'status') {
                return getStatusBadge(user.status);
              }

              // Last login column
              if (col.key === 'lastLoginAt') {
                return (
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </span>
                );
              }

              return undefined; // default renderer
            }}
            renderActions={(row) => (
              <div className="flex items-center justify-end gap-1">
                <Link to={`/users/${row.id}`}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                  <Eye className="w-4 h-4" />
                </Link>
                {canEdit('users') && (
                  <Link to={`/users/${row.id}/edit`}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </Link>
                )}
                {canDelete('users') && (
                  <button onClick={() => setShowDeleteConfirm(row.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          />
        </>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          {invitationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No pending invitations</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm">All invitations have been accepted or expired.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invited By</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">{inv.email}</p>
                        {(inv.first_name || inv.last_name) && (
                          <p className="text-sm text-gray-500 dark:text-slate-400">{inv.first_name} {inv.last_name}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 dark:text-slate-300">{inv.role_name || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500 dark:text-slate-400">
                          {inv.inviter_first_name} {inv.inviter_last_name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${
                          new Date(inv.expires_at) < new Date()
                            ? 'text-red-500'
                            : 'text-gray-500 dark:text-slate-400'
                        }`}>
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleResendInvitation(inv.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                            title="Resend">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleCancelInvitation(inv.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            title="Cancel">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete User?</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">This will deactivate the user and soft-delete their account. This action can be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
              <button onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); setActiveTab('invitations'); fetchInvitations(); }}
          roles={roles}
          departments={departments}
        />
      )}
      {showCreateModal && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchUsers(); }}
          roles={roles}
          departments={departments}
        />
      )}
    </div>
  );
}