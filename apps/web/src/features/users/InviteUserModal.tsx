import { useState } from 'react';
import { X, Mail, Send } from 'lucide-react';
import { usersApi, type RoleLookup, type DepartmentLookup } from '../../api/users.api';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvited: () => void;
  roles: RoleLookup[];
  departments: DepartmentLookup[];
}

export function InviteUserModal({ isOpen, onClose, onInvited, roles, departments }: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    email: '', firstName: '', lastName: '',
    roleId: '', departmentId: '', jobTitle: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email) {
      setError('Email is required');
      return;
    }

    setSaving(true);
    try {
      await usersApi.invite({
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        roleId: formData.roleId || undefined,
        departmentId: formData.departmentId || undefined,
        jobTitle: formData.jobTitle || undefined,
      });
      setSuccess(`Invitation sent to ${formData.email}`);
      setTimeout(() => onInvited(), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invite User</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Send an email invitation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">{success}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@company.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name</label>
              <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name</label>
              <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role</label>
              <select value={formData.roleId} onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name} {r.is_system ? '(system)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Department</label>
              <select value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Job Title</label>
            <input type="text" value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Sales Manager" />
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 shadow-lg shadow-blue-500/25">
              <Send className="w-4 h-4" />
              {saving ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}