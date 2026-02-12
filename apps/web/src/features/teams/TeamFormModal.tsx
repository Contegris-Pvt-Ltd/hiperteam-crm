import { useState, useEffect } from 'react';
import { X, Users, Pencil, Loader2 } from 'lucide-react';
import type { Team, CreateTeamData, UpdateTeamData } from '../../api/teams.api';
import { teamsApi } from '../../api/teams.api';
import type { DepartmentLookupItem } from '../../api/departments.api';
import { departmentsApi } from '../../api/departments.api';
import { usersApi } from '../../api/users.api';

interface Props {
  team: Team | null; // null = create mode
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function TeamFormModal({ team, onClose, onSuccess }: Props) {
  const isEdit = !!team;

  // Form state
  const [name, setName] = useState(team?.name || '');
  const [description, setDescription] = useState(team?.description || '');
  const [departmentId, setDepartmentId] = useState(team?.departmentId || '');
  const [teamLeadId, setTeamLeadId] = useState(team?.teamLeadId || '');
  const [isActive, setIsActive] = useState(team?.isActive !== false);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  // Lookups
  const [deptOptions, setDeptOptions] = useState<DepartmentLookupItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(true);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ============================================================
  // LOAD LOOKUPS
  // ============================================================
  useEffect(() => {
    const load = async () => {
      setLookupLoading(true);
      try {
        const [depts, usersRes] = await Promise.all([
          departmentsApi.getLookup(),
          usersApi.getAll({ limit: 200, status: 'active' }),
        ]);
        setDeptOptions(depts.filter((d) => d.isActive));
        const users = usersRes.data.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        }));
        setUserOptions(users);

        // Pre-fill members for edit mode
        if (team?.members) {
          setMemberIds(team.members.map((m) => m.id));
        }
      } catch (err) {
        console.error('Failed to load lookups:', err);
      } finally {
        setLookupLoading(false);
      }
    };
    load();
  }, [team]);

  // ============================================================
  // VALIDATION
  // ============================================================
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================
  // SUBMIT
  // ============================================================
  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        const updateData: UpdateTeamData = {
          name: name.trim(),
          description: description.trim() || undefined,
          departmentId: departmentId || null,
          teamLeadId: teamLeadId || null,
          isActive,
        };
        await teamsApi.update(team!.id, updateData);
      } else {
        const createData: CreateTeamData = {
          name: name.trim(),
          description: description.trim() || undefined,
          departmentId: departmentId || undefined,
          teamLeadId: teamLeadId || undefined,
          isActive,
          memberIds: memberIds.length > 0 ? memberIds : undefined,
        };
        await teamsApi.create(createData);
      }
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to ${isEdit ? 'update' : 'create'} team`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // MEMBER SELECTION (create mode only)
  // ============================================================
  const toggleMember = (userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const getUserDisplay = (u: UserOption) =>
    `${u.firstName} ${u.lastName}`.trim() || u.email;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between ${
          isEdit
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-white" /> : <Users className="w-5 h-5 text-white" />}
            </div>
            <h2 className="text-lg font-bold text-white">
              {isEdit ? 'Edit Team' : 'Create Team'}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
              placeholder="e.g. Backend Team"
              className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white ${
                fieldErrors.name
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this team..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white resize-none"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={lookupLoading}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white disabled:opacity-50"
            >
              <option value="">No department</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Team Lead */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Team Lead
            </label>
            <select
              value={teamLeadId}
              onChange={(e) => setTeamLeadId(e.target.value)}
              disabled={lookupLoading}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white disabled:opacity-50"
            >
              <option value="">No lead assigned</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {getUserDisplay(u)} ({u.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              The team lead is automatically added as a member.
            </p>
          </div>

          {/* Initial Members (create mode only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                Initial Members
                {memberIds.length > 0 && (
                  <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-normal">
                    {memberIds.length} selected
                  </span>
                )}
              </label>
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto">
                {lookupLoading ? (
                  <div className="p-4 text-center text-sm text-gray-400">Loading users...</div>
                ) : userOptions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No users available</div>
                ) : (
                  userOptions.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer border-b border-gray-50 dark:border-slate-800/50 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={memberIds.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {getUserDisplay(u)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                      </div>
                      {u.id === teamLeadId && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Lead</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                You can also add members later from the team detail panel.
              </p>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Inactive teams are hidden from dropdowns.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || lookupLoading}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg disabled:opacity-50 flex items-center gap-2 ${
              isEdit
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
}