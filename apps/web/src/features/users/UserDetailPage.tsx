import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Shield, Building2, Users, Mail,
  Phone, MapPin, Clock, Calendar, Briefcase, ChevronRight,
  UserMinus, UserCheck, Trash2,
} from 'lucide-react';
import type { User } from '../../api/users.api';
import { usersApi } from '../../api/users.api';
import { usePermissions } from '../../hooks/usePermissions';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();

  const [user, setUser] = useState<User | null>(null);
  const [directReports, setDirectReports] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) fetchUser();
  }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getOne(id!);
      setUser(data);
      // Fetch direct reports if any
      if (data.directReportsCount && data.directReportsCount > 0) {
        const reports = await usersApi.getDirectReports(id!);
        setDirectReports(reports);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await usersApi.deactivate(id!);
      setShowDeactivateConfirm(false);
      fetchUser();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await usersApi.delete(id!);
      navigate('/users');
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">User not found</h2>
        <Link to="/users" className="text-blue-600 hover:underline text-sm">Back to Users</Link>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/users')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        {canEdit('users') && (
          <div className="flex gap-2">
            {user.status === 'active' && (
              <button onClick={() => setShowDeactivateConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20">
                <UserMinus className="w-4 h-4" />
                Deactivate
              </button>
            )}
            <Link to={`/users/${user.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25">
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-24" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-900 object-cover shadow-lg" />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl border-4 border-white dark:border-slate-900 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {user.jobTitle && <span className="text-gray-500 dark:text-slate-400">{user.jobTitle}</span>}
                {user.role && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role.name === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    user.role.name === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    <Shield className="w-3 h-3 inline mr-1" />
                    {user.role.name}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  user.status === 'suspended' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Contact & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-white">{user.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Timezone</p>
                  <p className="text-sm text-gray-900 dark:text-white">{user.timezone || 'UTC'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Employee ID</p>
                  <p className="text-sm text-gray-900 dark:text-white">{user.employeeId || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Teams */}
          {user.teams && user.teams.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Teams</h3>
              <div className="space-y-3">
                {user.teams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{team.name}</p>
                        {team.description && <p className="text-xs text-gray-500 dark:text-slate-400">{team.description}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      {team.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Reports */}
          {directReports.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                Direct Reports ({directReports.length})
              </h3>
              <div className="space-y-2">
                {directReports.map((report) => (
                  <Link key={report.id} to={`/users/${report.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="flex items-center gap-3">
                      {report.avatarUrl ? (
                        <img src={report.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {report.firstName?.[0]}{report.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{report.firstName} {report.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{report.jobTitle || report.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Org & Activity */}
        <div className="space-y-6">
          {/* Organization */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Organization</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Department</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">{user.department?.name || 'Not assigned'}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Manager</p>
                {user.manager ? (
                  <Link to={`/users/${user.manager.id}`} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm">
                    <Users className="w-4 h-4" />
                    {user.manager.firstName} {user.manager.lastName}
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-slate-400">None</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Direct Reports</p>
                <span className="text-sm text-gray-900 dark:text-white">{user.directReportsCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 dark:text-slate-500">Last Login</span>
                <span className="text-sm text-gray-900 dark:text-white">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 dark:text-slate-500">Created</span>
                <span className="text-sm text-gray-900 dark:text-white">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 dark:text-slate-500">Updated</span>
                <span className="text-sm text-gray-900 dark:text-white">{formatDate(user.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Territories */}
          {user.territories && user.territories.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Territories</h3>
              <div className="space-y-2">
                {user.territories.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{t.type} {t.code ? `• ${t.code}` : ''}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{t.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {canDelete('users') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 p-6">
              <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3">Danger Zone</h3>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 w-full px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
                Delete User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Deactivate Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Deactivate User?</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              {user.firstName} will no longer be able to log in. You can reactivate later.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeactivateConfirm(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleDeactivate} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete User?</h3>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              This will soft-delete {user.firstName}'s account. The data will be retained but the user will be removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}