// ============================================================
// FILE: apps/web/src/features/opportunities/components/ContactRolesPanel.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { UserPlus, X, Search, Users, Star, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { opportunitiesApi } from '../../../api/opportunities.api';
import type { OpportunityContact } from '../../../api/opportunities.api';

const CONTACT_ROLES = [
  'Decision Maker',
  'Influencer',
  'Champion',
  'Economic Buyer',
  'Technical Evaluator',
  'End User',
  'Executive Sponsor',
  'Gatekeeper',
  'Other',
];

interface ContactRolesPanelProps {
  opportunityId: string;
  contacts: OpportunityContact[];
  onRefresh: () => void;
  canEdit: boolean;
}

export function ContactRolesPanel({ opportunityId, contacts, onRefresh, canEdit }: ContactRolesPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Decision Maker');
  const [isPrimary, setIsPrimary] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Search contacts
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/contacts?search=${encodeURIComponent(searchQuery)}&limit=5`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } },
        );
        const data = await response.json();
        const existingIds = new Set(contacts.map(c => c.contactId));
        setSearchResults((data.data || []).filter((c: any) => !existingIds.has(c.id)));
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, contacts]);

  const handleAdd = async (contactId: string) => {
    try {
      await opportunitiesApi.addContactRole(opportunityId, contactId, selectedRole, isPrimary);
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
      setIsPrimary(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to add contact role:', err);
    }
  };

  const handleRemove = async (contactRoleId: string) => {
    setRemoving(contactRoleId);
    try {
      await opportunitiesApi.removeContactRole(opportunityId, contactRoleId);
      onRefresh();
    } catch (err) {
      console.error('Failed to remove contact role:', err);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Users size={16} />
          Contact Roles ({contacts.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <UserPlus size={14} /> Add
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No contacts linked yet</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const ct = (c as any).contact || c;
            const firstName = ct.firstName || c.firstName || '';
            const lastName = ct.lastName || c.lastName || '';
            const email = ct.email || c.email || '';
            const phone = ct.phone || c.phone || '';
            const jobTitle = ct.jobTitle || c.jobTitle || '';
            const avatarUrl = ct.avatarUrl || null;
            return (
            <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-600">
                    {(firstName[0] || '?').toUpperCase()}{(lastName[0] || '').toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link to={`/contacts/${c.contactId}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600">
                      {firstName} {lastName}
                    </Link>
                    {c.isPrimary && (
                      <Star size={12} className="text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.role}{jobTitle ? ` · ${jobTitle}` : ''}
                    {email ? ` · ${email}` : ''}
                  </p>
                  {phone && <p className="text-xs text-gray-400">{phone}</p>}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemove(c.id)}
                  disabled={removing === c.id}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  {removing === c.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add Contact Role</h3>
              <button onClick={() => { setShowAddModal(false); setSearchQuery(''); setSearchResults([]); }} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="text-blue-600 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Set as primary contact</span>
              </label>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Search Contacts</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => handleAdd(c.id)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium">
                        {(c.firstName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-gray-500">{c.email || c.company || ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}