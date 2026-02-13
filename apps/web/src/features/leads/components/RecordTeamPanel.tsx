// ============================================================
// FILE: apps/web/src/features/leads/components/RecordTeamPanel.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { UserPlus, X, Search, Users } from 'lucide-react';
import { leadsApi, leadSettingsApi } from '../../../api/leads.api';
import type { TeamMember } from '../../../api/leads.api';

interface RecordTeamPanelProps {
  leadId: string;
  teamMembers: TeamMember[];
  onRefresh: () => void;
  canEdit: boolean;
}

export function RecordTeamPanel({ leadId, teamMembers, onRefresh, canEdit }: RecordTeamPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [teamRoles, setTeamRoles] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<'read' | 'write'>('read');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (showAddModal && teamRoles.length === 0) {
      leadSettingsApi.getTeamRoles().then(setTeamRoles).catch(console.error);
    }
  }, [showAddModal]);

  // Simple user search (debounced)
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) { setUserResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // Reuse existing users API
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users?search=${encodeURIComponent(userSearch)}&limit=5`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
          },
        );
        const data = await response.json();
        // Exclude users already in team
        const existingIds = new Set(teamMembers.map(m => m.userId));
        setUserResults((data.data || []).filter((u: any) => !existingIds.has(u.id)));
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, teamMembers]);

  const handleAddMember = async (userId: string, _userName: string) => {
    const roleName = teamRoles.find(r => r.id === selectedRoleId)?.name || '';
    try {
      await leadsApi.addTeamMember(leadId, userId, selectedRoleId || undefined, roleName, selectedAccess);
      setShowAddModal(false);
      setUserSearch('');
      setUserResults([]);
      onRefresh();
    } catch (error) {
      console.error('Failed to add team member:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemoving(userId);
    try {
      await leadsApi.removeTeamMember(leadId, userId);
      onRefresh();
    } catch (error) {
      console.error('Failed to remove team member:', error);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Users size={12} />
          Record Team
        </h4>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="Add team member"
          >
            <UserPlus size={14} />
          </button>
        )}
      </div>

      {teamMembers.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No team members</p>
      ) : (
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500 flex-shrink-0">
                  {member.firstName?.[0]}{member.lastName?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {member.roleName || 'Member'} · {member.accessLevel === 'write' ? 'Read/Write' : 'Read-only'}
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  disabled={removing === member.userId}
                  className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  {removing === member.userId ? (
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <X size={12} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Team Member</h3>
              <button onClick={() => { setShowAddModal(false); setUserSearch(''); setUserResults([]); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                  autoFocus
                />
              </div>

              {/* Role selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Role</label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                  >
                    <option value="">Select role...</option>
                    {teamRoles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Access</label>
                  <select
                    value={selectedAccess}
                    onChange={(e) => setSelectedAccess(e.target.value as 'read' | 'write')}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                  >
                    <option value="read">Read-only</option>
                    <option value="write">Read/Write</option>
                  </select>
                </div>
              </div>

              {/* Results */}
              {searchLoading && (
                <div className="text-center py-3">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              )}
              {userResults.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
                  {userResults.map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMember(user.id, `${user.firstName} ${user.lastName}`)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-medium text-blue-600 flex-shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {userSearch.length >= 2 && !searchLoading && userResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
