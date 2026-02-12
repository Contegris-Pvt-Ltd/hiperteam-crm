import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import type { User, RoleLookup, DepartmentLookup, TeamLookup } from '../../api/users.api';
import { usersApi } from '../../api/users.api';

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // Lookups
  const [roles, setRoles] = useState<RoleLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [teams, setTeams] = useState<TeamLookup[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', jobTitle: '',
    roleId: '', departmentId: '', managerId: '',
    timezone: 'UTC', employeeId: '', status: 'active',
    teamIds: [] as string[],
  });

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [userData, rolesData, deptsData, teamsData, usersData] = await Promise.all([
        usersApi.getOne(id!),
        usersApi.getRoles(),
        usersApi.getDepartments(),
        usersApi.getTeams(),
        usersApi.getAll({ limit: 100 }), // for manager dropdown
      ]);

      setUser(userData);
      setRoles(rolesData);
      setDepartments(deptsData);
      setTeams(teamsData);
      setAllUsers(usersData.data.filter(u => u.id !== id)); // exclude self

      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        jobTitle: userData.jobTitle || '',
        roleId: userData.role?.id || '',
        departmentId: userData.departmentId || '',
        managerId: userData.managerId || '',
        timezone: userData.timezone || 'UTC',
        employeeId: userData.employeeId || '',
        status: userData.status || 'active',
        teamIds: userData.teams?.map(t => t.id) || [],
      });
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usersApi.update(id!, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        jobTitle: formData.jobTitle || undefined,
        roleId: formData.roleId || undefined,
        departmentId: formData.departmentId || undefined,
        managerId: formData.managerId || undefined,
        timezone: formData.timezone || undefined,
        employeeId: formData.employeeId || undefined,
        status: formData.status,
        teamIds: formData.teamIds,
      });
      navigate(`/users/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleTeamToggle = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/users/${id}`)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">{user?.firstName} {user?.lastName} • {user?.email}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        {/* Basic Info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name *</label>
              <input type="text" required value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name *</label>
              <input type="text" required value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="text" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Job Title</label>
              <input type="text" value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <select value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className={inputClass}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Dubai">Dubai</option>
                <option value="Asia/Karachi">Pakistan (PKT)</option>
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="Asia/Shanghai">China (CST)</option>
                <option value="Asia/Tokyo">Japan (JST)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Employee ID</label>
              <input type="text" value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className={inputClass} />
            </div>
          </div>
        </div>

        {/* Role & Organization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Role & Organization</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Role</label>
              <select value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className={inputClass}>
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className={inputClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <select value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className={inputClass}>
                <option value="">No department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Manager</label>
              <select value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                className={inputClass}>
                <option value="">No manager</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Teams */}
        {teams.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Teams</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teams.map(team => (
                <label key={team.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    formData.teamIds.includes(team.id)
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}>
                  <input type="checkbox" checked={formData.teamIds.includes(team.id)}
                    onChange={() => handleTeamToggle(team.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{team.name}</p>
                    {team.description && <p className="text-xs text-gray-500 dark:text-slate-400">{team.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(`/users/${id}`)}
            className="px-5 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-blue-500/25">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}