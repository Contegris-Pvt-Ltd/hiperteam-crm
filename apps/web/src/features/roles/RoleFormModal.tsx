import { useState, useEffect, useMemo } from 'react';
import { X, Shield, Pencil, Loader2, CheckSquare, Square, Lock } from 'lucide-react';
import type { Role, CreateRoleData, UpdateRoleData, ModuleDefinitionsResponse } from '../../api/roles.api';
import { rolesApi } from '../../api/roles.api';

interface Props {
  role: Role | null; // null = create mode
  moduleDefs: ModuleDefinitionsResponse | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoleFormModal({ role, moduleDefs, onClose, onSuccess }: Props) {
  const isEdit = !!role;

  // Form state
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [level, setLevel] = useState(role?.level || 20);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [recordAccess, setRecordAccess] = useState<Record<string, string>>({});

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // System role restrictions
  const isSystemAdmin = role?.isSystem && role?.name === 'admin';
  const isSystem = role?.isSystem || false;

  // ============================================================
  // INITIALIZE PERMISSIONS
  // ============================================================
  useEffect(() => {
    if (!moduleDefs) return;

    if (role?.permissions) {
      // Edit: clone existing permissions
      const perms: Record<string, Record<string, boolean>> = {};
      for (const [mod, def] of Object.entries(moduleDefs.modules)) {
        perms[mod] = {};
        for (const action of def.actions) {
          perms[mod][action] = role.permissions[mod]?.[action] === true;
        }
      }
      setPermissions(perms);
    } else {
      // Create: all false
      const perms: Record<string, Record<string, boolean>> = {};
      for (const [mod, def] of Object.entries(moduleDefs.modules)) {
        perms[mod] = {};
        for (const action of def.actions) {
          perms[mod][action] = false;
        }
      }
      setPermissions(perms);
    }

    // Record access
    if (role?.recordAccess) {
      setRecordAccess({ ...role.recordAccess });
    } else {
      const access: Record<string, string> = {};
      for (const mod of moduleDefs.recordAccessModules) {
        access[mod] = 'own';
      }
      setRecordAccess(access);
    }
  }, [role, moduleDefs]);

  // ============================================================
  // ALL UNIQUE ACTIONS (for column headers)
  // ============================================================
  const allActions = useMemo(() => {
    if (!moduleDefs) return [];
    const actionSet = new Set<string>();
    for (const def of Object.values(moduleDefs.modules)) {
      for (const action of def.actions) {
        actionSet.add(action);
      }
    }
    return Array.from(actionSet);
  }, [moduleDefs]);

  // ============================================================
  // PERMISSION TOGGLE HELPERS
  // ============================================================
  const togglePermission = (module: string, action: string) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action],
      },
    }));
  };

  const toggleModuleAll = (module: string) => {
    if (!moduleDefs) return;
    const actions = moduleDefs.modules[module].actions;
    const allEnabled = actions.every((a) => permissions[module]?.[a] === true);
    const newVal = !allEnabled;

    setPermissions((prev) => {
      const updated = { ...prev };
      updated[module] = { ...updated[module] };
      for (const action of actions) {
        updated[module][action] = newVal;
      }
      return updated;
    });
  };

  const toggleColumnAll = (action: string) => {
    if (!moduleDefs) return;
    const modulesWithAction = Object.entries(moduleDefs.modules)
      .filter(([, def]) => def.actions.includes(action))
      .map(([mod]) => mod);

    const allEnabled = modulesWithAction.every((mod) => permissions[mod]?.[action] === true);
    const newVal = !allEnabled;

    setPermissions((prev) => {
      const updated = { ...prev };
      for (const mod of modulesWithAction) {
        updated[mod] = { ...updated[mod], [action]: newVal };
      }
      return updated;
    });
  };

  const selectAllPermissions = () => {
    if (!moduleDefs) return;
    const perms: Record<string, Record<string, boolean>> = {};
    for (const [mod, def] of Object.entries(moduleDefs.modules)) {
      perms[mod] = {};
      for (const action of def.actions) {
        perms[mod][action] = true;
      }
    }
    setPermissions(perms);
  };

  const clearAllPermissions = () => {
    if (!moduleDefs) return;
    const perms: Record<string, Record<string, boolean>> = {};
    for (const [mod, def] of Object.entries(moduleDefs.modules)) {
      perms[mod] = {};
      for (const action of def.actions) {
        perms[mod][action] = false;
      }
    }
    setPermissions(perms);
  };

  const isModuleAllChecked = (module: string): boolean | 'partial' => {
    if (!moduleDefs) return false;
    const actions = moduleDefs.modules[module].actions;
    const checked = actions.filter((a) => permissions[module]?.[a] === true).length;
    if (checked === actions.length) return true;
    if (checked > 0) return 'partial';
    return false;
  };

  const isColumnAllChecked = (action: string): boolean | 'partial' => {
    if (!moduleDefs) return false;
    const modulesWithAction = Object.entries(moduleDefs.modules)
      .filter(([, def]) => def.actions.includes(action))
      .map(([mod]) => mod);
    const checked = modulesWithAction.filter((mod) => permissions[mod]?.[action] === true).length;
    if (checked === modulesWithAction.length) return true;
    if (checked > 0) return 'partial';
    return false;
  };

  // ============================================================
  // VALIDATION
  // ============================================================
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required';
    else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (isSystemAdmin && name !== 'admin') errors.name = 'Cannot rename system admin role';
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
        const updateData: UpdateRoleData = {
          permissions,
          recordAccess,
        };
        if (!isSystemAdmin) {
          updateData.name = name.trim();
          updateData.description = description.trim() || undefined;
        }
        if (!isSystem) {
          updateData.level = level;
        }
        await rolesApi.update(role!.id, updateData);
      } else {
        const createData: CreateRoleData = {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions,
          recordAccess,
          level,
        };
        await rolesApi.create(createData);
      }
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        `Failed to ${isEdit ? 'update' : 'create'} role`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (!moduleDefs) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8">
          <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading module definitions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0 ${
          isEdit
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : 'bg-gradient-to-r from-purple-600 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-white" /> : <Shield className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? 'Edit Role' : 'Create Role'}
              </h2>
              {isSystem && (
                <span className="text-white/70 text-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" /> System role — name and level locked
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Name + Description row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: '' })); }}
                placeholder="e.g. Sales Rep"
                disabled={isSystemAdmin}
                className={`w-full px-3 py-2.5 bg-white dark:bg-slate-800 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white disabled:opacity-50 ${
                  fieldErrors.name
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-gray-200 dark:border-slate-700'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                Level ({level})
              </label>
              <input
                type="range"
                min={1}
                max={99}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                disabled={isSystem}
                className="w-full mt-2 accent-purple-600 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
                <span>1 (lowest)</span>
                <span>99 (highest)</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this role..."
              disabled={isSystemAdmin}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white disabled:opacity-50"
            />
          </div>

          {/* Permission Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Permission Matrix</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllPermissions}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  Grant All
                </button>
                <button
                  onClick={clearAllPermissions}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Revoke All
                </button>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-2.5 w-36">
                      Module
                    </th>
                    {allActions.map((action) => {
                      const colState = isColumnAllChecked(action);
                      return (
                        <th key={action} className="text-center px-2 py-2.5 w-16">
                          <button
                            onClick={() => toggleColumnAll(action)}
                            className="flex flex-col items-center gap-1 mx-auto group"
                            title={`Toggle all ${action}`}
                          >
                            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                              {action}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {colState === true
                                ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                                : colState === 'partial'
                                ? <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                                : <Square className="w-3.5 h-3.5 text-gray-300" />
                              }
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th className="text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase px-2 py-2.5 w-12">
                      All
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {Object.entries(moduleDefs.modules).map(([moduleKey, moduleDef]) => {
                    const rowState = isModuleAllChecked(moduleKey);
                    return (
                      <tr key={moduleKey} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                        {/* Module label */}
                        <td className="px-4 py-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                            {moduleDef.label}
                          </span>
                        </td>

                        {/* Action checkboxes */}
                        {allActions.map((action) => {
                          const hasAction = moduleDef.actions.includes(action);
                          if (!hasAction) {
                            return (
                              <td key={action} className="text-center px-2 py-2">
                                <span className="text-gray-200 dark:text-slate-700">—</span>
                              </td>
                            );
                          }
                          const checked = permissions[moduleKey]?.[action] === true;
                          return (
                            <td key={action} className="text-center px-2 py-2">
                              <button
                                onClick={() => togglePermission(moduleKey, action)}
                                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  checked
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                    : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-600'
                                }`}
                              >
                                {checked && (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* Row toggle */}
                        <td className="text-center px-2 py-2">
                          <button
                            onClick={() => toggleModuleAll(moduleKey)}
                            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                            title={`Toggle all for ${moduleDef.label}`}
                          >
                            {rowState === true
                              ? <CheckSquare className="w-5 h-5 text-emerald-500" />
                              : rowState === 'partial'
                              ? <CheckSquare className="w-5 h-5 text-amber-500" />
                              : <Square className="w-5 h-5 text-gray-300 dark:text-slate-600" />
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Record Access */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Record Access Scope</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
              Controls which records the user can see based on organizational hierarchy.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {moduleDefs.recordAccessModules.map((module) => {
                const moduleLabel = moduleDefs.modules[module]?.label || module;
                return (
                  <div key={module} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 dark:text-slate-300">{moduleLabel}</span>
                    <select
                      value={recordAccess[module] || 'own'}
                      onChange={(e) => setRecordAccess((prev) => ({ ...prev, [module]: e.target.value }))}
                      className="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 dark:text-white"
                    >
                      {moduleDefs.recordAccessLevels.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {({
                            own: 'Own',
                            team: 'Team',
                            department: 'Department',
                            reporting_line: 'Reporting Line',
                            all: 'All',
                          } as Record<string, string>)[lvl] || lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg disabled:opacity-50 flex items-center gap-2 ${
              isEdit
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/25'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}