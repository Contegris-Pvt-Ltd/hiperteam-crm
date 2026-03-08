import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../api/contacts.api';

export interface StageAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageName: string;
  defaultOwnerType: 'inherit' | 'user' | 'team_lead' | 'auto_assign';
  defaultUserId?: string | null;
  defaultTeamId?: string | null;
  onConfirm: (assignment: {
    ownerType: 'inherit' | 'user' | 'team_lead' | 'auto_assign';
    userId?: string | null;
    teamId?: string | null;
  }) => void;
}

type OwnerType = 'inherit' | 'user' | 'team_lead' | 'auto_assign';

const OWNER_TYPE_OPTIONS: { value: OwnerType; label: string }[] = [
  { value: 'inherit', label: 'Keep Current' },
  { value: 'user', label: 'Specific User' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'auto_assign', label: 'Auto Assign' },
];

export const StageAssignmentModal: React.FC<StageAssignmentModalProps> = ({
  isOpen,
  onClose,
  stageName,
  defaultOwnerType,
  defaultUserId,
  defaultTeamId,
  onConfirm,
}) => {
  const [selectedOwnerType, setSelectedOwnerType] = useState<OwnerType>(defaultOwnerType);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(defaultUserId || null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(defaultTeamId || null);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Reset to defaults each time modal opens
    setSelectedOwnerType(defaultOwnerType);
    setSelectedUserId(defaultUserId || null);
    setSelectedTeamId(defaultTeamId || null);
    setConfirming(false);
    setLoadError(null);

    const loadData = async () => {
      setLoading(true);
      try {
        const [usersRes, teamsRes] = await Promise.all([
          api.get('/users', { params: { limit: 500 } }),
          api.get('/teams', { params: { limit: 200 } }),
        ]);
        setUsers(
          (usersRes.data.data || usersRes.data || []).map((u: any) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
          })),
        );
        setTeams(
          (teamsRes.data.data || teamsRes.data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch {
        setLoadError('Failed to load users/teams');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, defaultOwnerType, defaultUserId, defaultTeamId]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      onConfirm({
        ownerType: selectedOwnerType,
        userId: selectedOwnerType === 'user' ? selectedUserId : null,
        teamId: selectedOwnerType === 'team_lead' ? selectedTeamId : null,
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Moving to {stageName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Assign to
          </label>

          {/* Owner type pills */}
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-slate-800 p-1">
            {OWNER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedOwnerType(opt.value)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedOwnerType === opt.value
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Conditional content */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              {selectedOwnerType === 'user' && (
                <div>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                  {loadError && (
                    <p className="text-xs text-red-500 mt-1">{loadError}</p>
                  )}
                </div>
              )}

              {selectedOwnerType === 'team_lead' && (
                <div>
                  <select
                    value={selectedTeamId || ''}
                    onChange={(e) => setSelectedTeamId(e.target.value || null)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {loadError && (
                    <p className="text-xs text-red-500 mt-1">{loadError}</p>
                  )}
                </div>
              )}

              {selectedOwnerType === 'inherit' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Lead will keep its current owner.
                </p>
              )}

              {selectedOwnerType === 'auto_assign' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Owner will be assigned by routing rules.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
};
