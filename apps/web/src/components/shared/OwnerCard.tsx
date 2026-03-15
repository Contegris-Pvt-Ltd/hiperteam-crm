import { useState, useEffect } from 'react';
import { Pencil, X, Loader2, UserX } from 'lucide-react';
import { api } from '../../api/contacts.api';

interface Owner {
  id: string;
  firstName?: string;
  lastName?: string;
}

interface OwnerCardProps {
  owner?: Owner | null;
  onUpdate: (ownerId: string | null) => Promise<void>;
}

export function OwnerCard({ owner, onUpdate }: OwnerCardProps) {
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api.get('/users?status=active&limit=100')
      .then(res => setUsers(res.data?.data || res.data || []))
      .catch(() => {});
  }, [editing]);

  const handleChange = async (ownerId: string | null) => {
    setSaving(true);
    try {
      await onUpdate(ownerId);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Owner</h3>
          <button onClick={() => setEditing(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin text-purple-600 mx-auto" />
        ) : (
          <div className="space-y-1.5">
            <select
              value={owner?.id || ''}
              onChange={(e) => handleChange(e.target.value || null)}
              className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
            {owner && (
              <button
                onClick={() => handleChange(null)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 py-1"
              >
                <UserX className="w-3.5 h-3.5" />
                Remove Owner
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Owner</h3>
        <button
          onClick={() => setEditing(true)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
          title="Change owner"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      {owner ? (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
            {owner.firstName?.[0]}{owner.lastName?.[0]}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {owner.firstName} {owner.lastName}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No owner assigned</p>
      )}
    </div>
  );
}
