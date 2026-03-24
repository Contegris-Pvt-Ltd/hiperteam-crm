import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Shield, Building2, Users, Mail,
  Phone, Clock, Briefcase, ChevronRight, Calendar,
  UserMinus, UserCheck, Trash2, Loader2,
  TrendingUp, Target, CheckCircle2, BarChart3,
  CalendarClock, Video, Lock, Key, Eye, EyeOff,
  RefreshCw, Save, Link2, Image, AlertTriangle,
} from 'lucide-react';
import type { User } from '../../api/users.api';
import { usersApi } from '../../api/users.api';
import { schedulingApi } from '../../api/scheduling.api';
import type { BookingAvailabilityWindow } from '../../api/scheduling.api';
import { DAY_LABELS_FULL } from '../../api/scheduling.api';
import { emailApi } from '../../api/email.api';
import type { EmailAccount } from '../../api/email.api';
import { calendarSyncApi } from '../../api/calendar-sync.api';
import type { ConnectionStatus } from '../../api/calendar-sync.api';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../stores/auth.store';
import { AvatarUpload } from '../../components/shared/AvatarUpload';
import { uploadApi } from '../../api/upload.api';

type Tab = 'overview' | 'availability' | 'bookings' | 'performance' | 'security' | 'email';

interface ProfileStats {
  leads: { total: number; converted: number; thisMonth: number };
  deals: { open: number; won: number; revenueThisMonth: number };
  tasks: { open: number; completedThisMonth: number };
  activities: { thisMonth: number };
  projects: { active: number };
  bookings: { total: number; thisMonth: number };
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canDelete } = usePermissions();
  const currentUser = useAuthStore((s) => s.user);

  const isOwnProfile = currentUser?.id === id;
  const isAdmin = (currentUser?.roleLevel ?? 0) >= 100;
  const isManager = currentUser?.role === 'manager' || isAdmin;
  const canViewPerformance = isAdmin || isManager;

  const [tab, setTab] = useState<Tab>('overview');
  const [user, setUser] = useState<User | null>(null);
  const [directReports, setDirectReports] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Availability
  const [availability, setAvailability] = useState<BookingAvailabilityWindow[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  // Performance
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (id) fetchUser();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (tab === 'availability') loadAvailability();
    if (tab === 'performance' && canViewPerformance) loadStats();
  }, [tab, id]);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await usersApi.getOne(id!);
      setUser(data);
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

  const loadAvailability = async () => {
    setAvailLoading(true);
    try {
      const data = isOwnProfile
        ? await schedulingApi.getMyAvailability()
        : await schedulingApi.getUserAvailability(id!);
      setAvailability(data);
    } catch {
      setAvailability([]);
    } finally {
      setAvailLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const data = await usersApi.getProfileStats(id!);
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSaveAvailability = async () => {
    setSavingAvail(true);
    try {
      await schedulingApi.saveMyAvailability(availability);
      setAvailSaved(true);
      setTimeout(() => setAvailSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSavingAvail(false); }
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

  const handleActivate = async () => {
    try {
      await usersApi.activate(id!);
      fetchUser();
    } catch (err) {
      console.error('Failed to activate user:', err);
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
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">User not found</h2>
        <Link to="/users" className="text-purple-600 hover:underline text-sm">Back to Users</Link>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'availability', label: 'Availability' },
    { key: 'bookings', label: 'Bookings' },
    ...(canViewPerformance ? [{ key: 'performance' as Tab, label: 'Performance' }] : []),
    ...(isOwnProfile ? [
      { key: 'security' as Tab, label: 'Security' },
      { key: 'email' as Tab, label: 'Email & Calendar' },
    ] : []),
  ];

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
            {user.status !== 'active' && user.status !== 'deleted' && (
              <button onClick={handleActivate}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20">
                <UserCheck className="w-4 h-4" />
                Activate
              </button>
            )}
            <Link to={`/users/${user.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25">
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-24" />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {isOwnProfile || canEdit('users') ? (
              <div className="border-4 border-white dark:border-slate-900 rounded-2xl shadow-lg">
                <AvatarUpload
                  currentUrl={user.avatarUrl}
                  name={`${user.firstName} ${user.lastName}`}
                  type="user"
                  size="md"
                  onUpload={async (file) => {
                    const result = await uploadApi.uploadAvatar('users', user.id, file);
                    await usersApi.update(user.id, { avatarUrl: result.url });
                    setUser(prev => prev ? { ...prev, avatarUrl: result.url } : prev);
                    return result.url;
                  }}
                />
              </div>
            ) : user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-900 object-cover shadow-lg" />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl border-4 border-white dark:border-slate-900 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</h1>
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

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-gray-200 dark:border-slate-700">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                          <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
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

          {/* Right Column */}
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
                    <Link to={`/users/${user.manager.id}`} className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:underline text-sm">
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
      )}

      {/* ── Availability Tab ── */}
      {tab === 'availability' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 max-w-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isOwnProfile ? 'My Availability' : `${user.firstName}'s Availability`}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {isOwnProfile
                  ? 'Set your default weekly availability for meeting bookings'
                  : 'View this user\'s weekly availability windows'}
              </p>
            </div>
            {isOwnProfile && (
              <button
                onClick={handleSaveAvailability}
                disabled={savingAvail}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {savingAvail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : availSaved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved</>
                ) : (
                  <><Calendar className="w-4 h-4" /> Save</>
                )}
              </button>
            )}
          </div>

          {availLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {DAY_LABELS_FULL.map((dayLabel, idx) => {
                const dayOfWeek = idx === 0 ? 0 : idx;
                const window = availability.find((w) => w.dayOfWeek === dayOfWeek) || {
                  dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: false,
                };
                const setWindow = (patch: Partial<BookingAvailabilityWindow>) => {
                  setAvailability((prev) => {
                    const exists = prev.some((w) => w.dayOfWeek === dayOfWeek);
                    const updated = { ...window, ...patch };
                    return exists
                      ? prev.map((w) => w.dayOfWeek === dayOfWeek ? updated : w)
                      : [...prev, updated];
                  });
                };
                return (
                  <div key={dayOfWeek}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      window.isActive
                        ? 'bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30'
                        : 'bg-gray-50 dark:bg-slate-800 border border-transparent'
                    }`}
                  >
                    {isOwnProfile ? (
                      <button
                        onClick={() => setWindow({ isActive: !window.isActive })}
                        className={`w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0 transition-colors ${
                          window.isActive
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {dayLabel.substring(0, 2)}
                      </button>
                    ) : (
                      <div className={`w-10 h-10 rounded-full text-sm font-semibold flex-shrink-0 flex items-center justify-center ${
                        window.isActive
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                      }`}>
                        {dayLabel.substring(0, 2)}
                      </div>
                    )}
                    <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300">{dayLabel}</span>
                    {window.isActive ? (
                      isOwnProfile ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={window.startTime}
                            onChange={(e) => setWindow({ startTime: e.target.value })}
                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white" />
                          <span className="text-gray-400">–</span>
                          <input type="time" value={window.endTime}
                            onChange={(e) => setWindow({ endTime: e.target.value })}
                            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white" />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {window.startTime} – {window.endTime}
                        </span>
                      )
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-slate-500">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bookings Tab ── */}
      {tab === 'bookings' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {isOwnProfile ? 'My Booking Pages' : `${user.firstName}'s Booking Pages`}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            {isOwnProfile
              ? 'Manage your booking pages from the Engagement Hub'
              : 'Booking pages are managed from the Engagement Hub'}
          </p>
          <button
            onClick={() => navigate('/engagement/scheduling')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <CalendarClock className="w-4 h-4" />
            Go to Scheduling
          </button>
        </div>
      )}

      {/* ── Performance Tab ── */}
      {tab === 'performance' && canViewPerformance && (
        statsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Target} label="Leads (Total)" value={stats.leads.total} color="blue" />
              <StatCard icon={TrendingUp} label="Leads (This Month)" value={stats.leads.thisMonth} color="purple" />
              <StatCard icon={CheckCircle2} label="Leads Converted" value={stats.leads.converted} color="green" />
              <StatCard icon={BarChart3} label="Activities (Month)" value={stats.activities.thisMonth} color="amber" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Target} label="Open Deals" value={stats.deals.open} color="blue" />
              <StatCard icon={CheckCircle2} label="Won Deals" value={stats.deals.won} color="green" />
              <StatCard icon={TrendingUp} label="Revenue (Month)" value={`$${(stats.deals.revenueThisMonth || 0).toLocaleString()}`} color="purple" />
              <StatCard icon={Briefcase} label="Active Projects" value={stats.projects.active} color="amber" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={CheckCircle2} label="Open Tasks" value={stats.tasks.open} color="blue" />
              <StatCard icon={CheckCircle2} label="Tasks Done (Month)" value={stats.tasks.completedThisMonth} color="green" />
              <StatCard icon={Video} label="Bookings (Total)" value={stats.bookings.total} color="purple" />
              <StatCard icon={CalendarClock} label="Bookings (Month)" value={stats.bookings.thisMonth} color="amber" />
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Unable to load performance stats</p>
          </div>
        )
      )}

      {/* ── Security Tab ── */}
      {tab === 'security' && isOwnProfile && (
        <PasswordChangeCard />
      )}

      {/* ── Email & Calendar Tab ── */}
      {tab === 'email' && isOwnProfile && (
        <EmailCalendarTab />
      )}

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

// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── Password Change Card ─────────────────────────────────────
function PasswordChangeCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setSaving(true);
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to change password' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm dark:text-white pr-10';

  return (
    <div className="max-w-lg">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputCls}
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className={inputCls}
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm dark:text-white"
            />
          </div>

          {message && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Email & Calendar Tab ─────────────────────────────────────
function EmailCalendarTab() {
  // Email accounts
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Calendar connection
  const [calStatus, setCalStatus] = useState<ConnectionStatus | null>(null);
  const [calLoading, setCalLoading] = useState(true);
  const [calSyncing, setCalSyncing] = useState(false);

  // Signature
  const [signature, setSignature] = useState('');
  const [sigLoading, setSigLoading] = useState(true);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigSaved, setSigSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!sigLoading && editorRef.current && signature) {
      editorRef.current.innerHTML = signature;
    }
  }, [sigLoading]);

  const loadAll = async () => {
    // Load email accounts
    emailApi.getAccounts().then((data) => {
      setAccounts(data);
      setAccountsLoading(false);
    }).catch(() => setAccountsLoading(false));

    // Load calendar connection
    calendarSyncApi.getConnection().then((data) => {
      setCalStatus(data);
      setCalLoading(false);
    }).catch(() => setCalLoading(false));

    // Load signature
    usersApi.getEmailSignature().then((res) => {
      setSignature(res.signature);
      setSigLoading(false);
    }).catch(() => setSigLoading(false));
  };

  const handleSyncEmail = async (id: string) => {
    setSyncing(id);
    try { await emailApi.syncAccount(id); } catch { /* ignore */ }
    finally { setSyncing(null); }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Disconnect this email account?')) return;
    try {
      await emailApi.deleteAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  };

  const handleConnectGmail = async () => {
    try {
      const { url } = await emailApi.getGmailOAuthUrl(false);
      window.location.href = url;
    } catch { /* ignore */ }
  };

  const handleConnectCalendar = async () => {
    try {
      const { url } = await calendarSyncApi.getGoogleAuthUrl();
      window.location.href = url;
    } catch { /* ignore */ }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Disconnect Google Calendar?')) return;
    try {
      await calendarSyncApi.disconnect();
      setCalStatus({ connected: false, connection: null });
    } catch { /* ignore */ }
  };

  const handleSyncCalendar = async () => {
    setCalSyncing(true);
    try { await calendarSyncApi.syncNow(); } catch { /* ignore */ }
    finally { setCalSyncing(false); }
  };

  const handleSaveSignature = async () => {
    setSigSaving(true);
    setSigSaved(false);
    try {
      const html = editorRef.current?.innerHTML || '';
      await usersApi.updateEmailSignature(html);
      setSignature(html);
      setSigSaved(true);
      setTimeout(() => setSigSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSigSaving(false); }
  };

  const execCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const preventFocusLoss = (e: React.MouseEvent) => e.preventDefault();

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.execCommand('insertImage', false, evt.target?.result as string);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Connected Email Accounts */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-600" /> Email Accounts
          </h3>
          <button onClick={handleConnectGmail}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors">
            + Connect Gmail
          </button>
        </div>

        {accountsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            No email accounts connected. Connect Gmail to send and receive emails from the CRM.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{account.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {account.provider === 'gmail' ? 'Gmail' : account.provider === 'microsoft' ? 'Microsoft 365' : 'IMAP'}
                      {account.lastSyncedAt && ` • Last synced ${new Date(account.lastSyncedAt).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSyncEmail(account.id)} disabled={syncing === account.id}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg" title="Sync now">
                    <RefreshCw className={`w-4 h-4 ${syncing === account.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => handleDeleteAccount(account.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Disconnect">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-600" /> Google Calendar
        </h3>

        {calLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          </div>
        ) : calStatus?.connected && calStatus.connection ? (
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Connected</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {calStatus.connection.email}
                  {calStatus.connection.lastSyncedAt && ` • Synced ${new Date(calStatus.connection.lastSyncedAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleSyncCalendar} disabled={calSyncing}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg" title="Sync now">
                <RefreshCw className={`w-4 h-4 ${calSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleDisconnectCalendar}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Disconnect">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Connect Google Calendar for 2-way sync and automatic Meet links on bookings
            </p>
            <button onClick={handleConnectCalendar}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Calendar className="w-4 h-4" /> Connect Google Calendar
            </button>
          </div>
        )}
      </div>

      {/* Email Signature */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Pencil className="w-5 h-5 text-purple-600" /> Email Signature
          </h3>
        </div>

        {sigLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-4 py-2 border-y border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              <button onMouseDown={preventFocusLoss} onClick={() => execCmd('bold')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Bold">
                <span className="text-xs font-bold">B</span>
              </button>
              <button onMouseDown={preventFocusLoss} onClick={() => execCmd('italic')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Italic">
                <span className="text-xs italic">I</span>
              </button>
              <button onMouseDown={preventFocusLoss} onClick={() => execCmd('underline')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Underline">
                <span className="text-xs underline">U</span>
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />
              <button onMouseDown={preventFocusLoss} onClick={() => { const url = prompt('Enter link URL:'); if (url) execCmd('createLink', url); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Insert link">
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <button onMouseDown={preventFocusLoss} onClick={() => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
                input.onchange = () => { const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { editorRef.current?.focus(); document.execCommand('insertImage', false, evt.target?.result as string); }; reader.readAsDataURL(file); };
                input.click();
              }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Insert image">
                <Image className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />
              <select onMouseDown={preventFocusLoss} onChange={(e) => { if (e.target.value) execCmd('fontSize', e.target.value); }}
                className="text-xs bg-transparent border border-gray-200 dark:border-slate-600 rounded px-1 py-1 text-gray-500 dark:text-gray-400" defaultValue="">
                <option value="" disabled>Size</option>
                <option value="1">Small</option>
                <option value="3">Normal</option>
                <option value="5">Large</option>
              </select>
              <input type="color" onMouseDown={preventFocusLoss} onChange={(e) => execCmd('foreColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="Text color" defaultValue="#000000" />
            </div>

            {/* Editor */}
            <div ref={editorRef} contentEditable onPaste={handlePaste}
              className="min-h-[140px] max-h-[260px] overflow-y-auto px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none"
              suppressContentEditableWarning
              data-placeholder="Create your email signature..." />

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Appended to all composed emails
              </p>
              <button onClick={handleSaveSignature} disabled={sigSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {sigSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : sigSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {sigSaved ? 'Saved' : 'Save Signature'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
