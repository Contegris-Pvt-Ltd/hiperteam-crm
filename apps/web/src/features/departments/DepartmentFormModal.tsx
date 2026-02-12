import { useState, useEffect } from 'react';
import { X, Building2, Pencil, Loader2 } from 'lucide-react';
import type { Department, DepartmentLookupItem, CreateDepartmentData, UpdateDepartmentData } from '../../api/departments.api';
import { departmentsApi } from '../../api/departments.api';
import { usersApi } from '../../api/users.api';

interface Props {
  department: Department | null; // null = create mode
  onClose: () => void;
  onSuccess: () => void;
}

interface UserLookup {
  id: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

export function DepartmentFormModal({ department, onClose, onSuccess }: Props) {
  const isEdit = !!department;

  // Form state
  const [name, setName] = useState(department?.name || '');
  const [code, setCode] = useState(department?.code || '');
  const [description, setDescription] = useState(department?.description || '');
  const [parentDepartmentId, setParentDepartmentId] = useState(department?.parentDepartmentId || '');
  const [headId, setHeadId] = useState(department?.headId || '');
  const [isActive, setIsActive] = useState(department?.isActive !== false);

  // Lookups
  const [parentOptions, setParentOptions] = useState<DepartmentLookupItem[]>([]);
  const [userOptions, setUserOptions] = useState<UserLookup[]>([]);
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
          departmentsApi.getLookup(department?.id),
          usersApi.getAll({ limit: 200, status: 'active' }),
        ]);
        setParentOptions(depts.filter((d) => d.isActive));
        setUserOptions(
          usersRes.data.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
          })),
        );
      } catch (err) {
        console.error('Failed to load lookups:', err);
      } finally {
        setLookupLoading(false);
      }
    };
    load();
  }, [department?.id]);

  // ============================================================
  // VALIDATION
  // ============================================================
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = 'Name is required';
    else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';

    if (code && !/^[A-Za-z0-9_-]+$/.test(code)) {
      errors.code = 'Code must be alphanumeric (hyphens/underscores allowed)';
    }

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
        const updateData: UpdateDepartmentData = {
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          parentDepartmentId: parentDepartmentId || null,
          headId: headId || null,
          isActive,
        };
        await departmentsApi.update(department!.id, updateData);
      } else {
        const createData: CreateDepartmentData = {
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          parentDepartmentId: parentDepartmentId || undefined,
          headId: headId || undefined,
          isActive,
        };
        await departmentsApi.create(createData);
      }
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to ${isEdit ? 'update' : 'create'} department`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // HELPERS
  // ============================================================
  const getUserDisplayName = (u: UserLookup) => {
    const first = u.firstName || u.first_name || '';
    const last = u.lastName || u.last_name || '';
    return first || last ? `${first} ${last}`.trim() : u.email;
  };

  const buildParentLabel = (dept: DepartmentLookupItem): string => {
    const parts: string[] = [];
    let current: DepartmentLookupItem | undefined = dept;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      parts.unshift(current.name);
      current = current.parentDepartmentId
        ? parentOptions.find((d) => d.id === current!.parentDepartmentId)
        : undefined;
    }

    return parts.join(' › ');
  };

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
            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-white" /> : <Building2 className="w-5 h-5 text-white" />}
            </div>
            <h2 className="text-lg font-bold text-white">
              {isEdit ? 'Edit Department' : 'Create Department'}
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
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
              placeholder="e.g. Engineering"
              className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white ${
                fieldErrors.name
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setFieldErrors((p) => ({ ...p, code: '' })); }}
              placeholder="e.g. ENG"
              maxLength={30}
              className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white font-mono ${
                fieldErrors.code
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-gray-200 dark:border-slate-700'
              }`}
            />
            {fieldErrors.code && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Short unique identifier. Letters, numbers, hyphens, underscores only.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this department..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white resize-none"
            />
          </div>

          {/* Parent Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Parent Department
            </label>
            <select
              value={parentDepartmentId}
              onChange={(e) => setParentDepartmentId(e.target.value)}
              disabled={lookupLoading}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white disabled:opacity-50"
            >
              <option value="">None (top-level)</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {buildParentLabel(d)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Select a parent to nest this department in the hierarchy.
            </p>
          </div>

          {/* Department Head */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Department Head
            </label>
            <select
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              disabled={lookupLoading}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white disabled:opacity-50"
            >
              <option value="">No head assigned</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {getUserDisplayName(u)} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</p>
              <p className="text-xs text-gray-400 dark:text-slate-500">Inactive departments are hidden from dropdowns.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
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
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Department'}
          </button>
        </div>
      </div>
    </div>
  );
}