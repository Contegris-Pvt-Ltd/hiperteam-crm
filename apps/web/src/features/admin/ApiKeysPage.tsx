import { useState, useEffect, useRef } from 'react';
import {
  Key, Plus, Copy, RefreshCw, Trash2, Check, X, Loader2,
  Shield, Clock, AlertTriangle, ToggleLeft, ToggleRight, Eye, EyeOff,
} from 'lucide-react';
import { apiKeysApi } from '../../api/api-keys.api';
import type { ApiKey, CreateApiKeyData } from '../../api/api-keys.api';
import { rolesApi } from '../../api/roles.api';

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [roles, setRoles] = useState<{ id: string; name: string; level: number }[]>([]);

  // Token display state (show-once after create/regenerate)
  const [tokenDisplay, setTokenDisplay] = useState<{ id: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);

  // Action states
  const [deleting, setDeleting] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadKeys = async () => {
    try {
      const data = await apiKeysApi.getAll();
      setKeys(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadKeys();
    rolesApi.getAll({ limit: 100 }).then(r => setRoles((r.data || []).map(role => ({ id: role.id, name: role.name, level: role.level })))).catch(() => {});
  }, []);

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async (id: string) => {
    setRegenerating(id);
    try {
      const { token } = await apiKeysApi.regenerate(id);
      setTokenDisplay({ id, token });
      setTokenVisible(false);
      setCopied(false);
    } catch { /* ignore */ }
    finally { setRegenerating(null); }
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    setToggling(id);
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await apiKeysApi.updateStatus(id, newStatus);
      await loadKeys();
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiKeysApi.delete(id);
      setKeys(prev => prev.filter(k => k.id !== id));
      if (tokenDisplay?.id === id) setTokenDisplay(null);
    } catch { /* ignore */ }
    finally { setDeleting(null); setConfirmDelete(null); }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            API Keys
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Create and manage API keys for external integrations
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/25"
        >
          <Plus className="w-4 h-4" /> Create API Key
        </button>
      </div>

      {/* Token Display Banner (show-once) */}
      {tokenDisplay && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Copy your API token now — it won't be shown again
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-xs font-mono text-gray-800 dark:text-gray-200 truncate select-all">
                  {tokenVisible ? tokenDisplay.token : '•'.repeat(40)}
                </code>
                <button
                  onClick={() => setTokenVisible(v => !v)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                  title={tokenVisible ? 'Hide token' : 'Show token'}
                >
                  {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleCopy(tokenDisplay.token)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <button
                onClick={() => setTokenDisplay(null)}
                className="mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Dismiss — I've copied the token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <Key className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">No API keys yet</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Create your first API key to get started</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Expires</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Last Used</th>
                <th className="text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        k.status === 'active' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-slate-700'
                      }`}>
                        <Key className={`w-4 h-4 ${
                          k.status === 'active' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-slate-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{k.label}</p>
                        {k.description && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[200px]">{k.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300">
                      <Shield className="w-3 h-3" />
                      {k.roleName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isExpired(k.expiresAt) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Expired
                      </span>
                    ) : k.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {k.expiresAt ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(k.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Toggle active/inactive */}
                      <button
                        onClick={() => handleToggle(k.id, k.status)}
                        disabled={toggling === k.id}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        title={k.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {toggling === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          k.status === 'active' ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      {/* Regenerate */}
                      <button
                        onClick={() => handleRegenerate(k.id)}
                        disabled={regenerating === k.id}
                        className="p-1.5 text-gray-400 hover:text-purple-600 dark:text-slate-500 dark:hover:text-purple-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        title="Regenerate token"
                      >
                        {regenerating === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      {/* Delete */}
                      {confirmDelete === k.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(k.id)}
                            disabled={deleting === k.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Confirm delete"
                          >
                            {deleting === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(k.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateApiKeyModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={(result) => {
            setShowCreate(false);
            setTokenDisplay({ id: result.id, token: result.token });
            setTokenVisible(false);
            setCopied(false);
            loadKeys();
          }}
        />
      )}
    </div>
  );
}

// ── Create API Key Modal ─────────────────────────────────────
function CreateApiKeyModal({
  roles, onClose, onCreated,
}: {
  roles: { id: string; name: string; level: number }[];
  onClose: () => void;
  onCreated: (result: { id: string; token: string }) => void;
}) {
  const [form, setForm] = useState<CreateApiKeyData>({
    label: '',
    description: '',
    roleId: '',
    expiresIn: 'never',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!form.label.trim()) { setError('Label is required'); return; }
    if (!form.roleId) { setError('Role is required'); return; }

    setSaving(true);
    setError('');
    try {
      const result = await apiKeysApi.create(form);
      onCreated(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const expiryOptions = [
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
    { value: 'never', label: 'Never expires' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Create API Key</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Label *</label>
            <input
              ref={inputRef}
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Zapier Integration"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What will this key be used for?"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role *</label>
            <select
              value={form.roleId}
              onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              The API key will have the same permissions as this role
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Expiration</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {expiryOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, expiresIn: opt.value as any }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.expiresIn === opt.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {saving ? 'Creating...' : 'Create API Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
