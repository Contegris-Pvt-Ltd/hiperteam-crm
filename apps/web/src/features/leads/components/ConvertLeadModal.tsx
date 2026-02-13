// ============================================================
// FILE: apps/web/src/features/leads/components/ConvertLeadModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Building2, Briefcase, ChevronRight, Check, Loader2 } from 'lucide-react';
import { leadsApi } from '../../../api/leads.api';
import { contactsApi } from '../../../api/contacts.api';
import { accountsApi } from '../../../api/accounts.api';
import type { Lead, ConvertLeadData } from '../../../api/leads.api';

interface ConvertLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onConverted: () => void;
}

export function ConvertLeadModal({ lead, onClose, onConverted }: ConvertLeadModalProps) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [contactAction, setContactAction] = useState<'create_new' | 'merge_existing'>('create_new');
  const [existingContactId, setExistingContactId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const [accountAction, setAccountAction] = useState<'create_new' | 'link_existing' | 'skip'>(
    lead.company ? 'create_new' : 'skip',
  );
  const [existingAccountId, setExistingAccountId] = useState('');
  const [accountName, setAccountName] = useState(lead.company || '');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState<any[]>([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);

  const [createOpportunity, setCreateOpportunity] = useState(false);
  const [opportunityName, setOpportunityName] = useState(
    `${lead.company || lead.lastName} - Opportunity`,
  );
  const [amount, setAmount] = useState<number | undefined>();
  const [closeDate, setCloseDate] = useState('');

  const [notes, setNotes] = useState('');

  // Contact search
  const searchContacts = async (q: string) => {
    if (!q || q.length < 2) { setContactResults([]); return; }
    setSearchingContacts(true);
    try {
      const response = await contactsApi.getAll({ search: q, limit: 5 });
      setContactResults(response.data || []);
    } catch { /* ignore */ }
    finally { setSearchingContacts(false); }
  };

  // Account search
  const searchAccounts = async (q: string) => {
    if (!q || q.length < 2) { setAccountResults([]); return; }
    setSearchingAccounts(true);
    try {
      const response = await accountsApi.getAll({ search: q, limit: 5 });
      setAccountResults(response.data || []);
    } catch { /* ignore */ }
    finally { setSearchingAccounts(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchContacts(contactSearch), 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  useEffect(() => {
    const timer = setTimeout(() => searchAccounts(accountSearch), 300);
    return () => clearTimeout(timer);
  }, [accountSearch]);

  const handleConvert = async () => {
    setConverting(true);
    setError('');
    try {
      const data: ConvertLeadData = {
        contactAction,
        existingContactId: contactAction === 'merge_existing' ? existingContactId : undefined,
        accountAction,
        existingAccountId: accountAction === 'link_existing' ? existingAccountId : undefined,
        accountName: accountAction === 'create_new' ? accountName : undefined,
        createOpportunity,
        opportunityName: createOpportunity ? opportunityName : undefined,
        amount: createOpportunity ? amount : undefined,
        closeDate: createOpportunity ? closeDate : undefined,
        notes: notes || undefined,
      };

      await leadsApi.convert(lead.id, data);
      onConverted();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert lead');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Convert Lead: {lead.firstName} {lead.lastName}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ── CONTACT SECTION ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <UserPlus size={16} /> Contact
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={contactAction === 'create_new'} onChange={() => setContactAction('create_new')}
                  className="text-blue-600" />
                <span className="text-sm">Create new contact (pre-filled from lead)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={contactAction === 'merge_existing'} onChange={() => setContactAction('merge_existing')}
                  className="text-blue-600" />
                <span className="text-sm">Merge with existing contact</span>
              </label>
              {contactAction === 'merge_existing' && (
                <div className="ml-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                  {contactResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {contactResults.map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => { setExistingContactId(c.id); setContactSearch(`${c.firstName} ${c.lastName}`); setContactResults([]); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                            existingContactId === c.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <span>{c.firstName} {c.lastName} {c.email && `(${c.email})`}</span>
                          {existingContactId === c.id && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ACCOUNT SECTION ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <Building2 size={16} /> Account
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={accountAction === 'create_new'} onChange={() => setAccountAction('create_new')}
                  className="text-blue-600" />
                <span className="text-sm">Create new account</span>
              </label>
              {accountAction === 'create_new' && (
                <div className="ml-6">
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Account name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={accountAction === 'link_existing'} onChange={() => setAccountAction('link_existing')}
                  className="text-blue-600" />
                <span className="text-sm">Link to existing account</span>
              </label>
              {accountAction === 'link_existing' && (
                <div className="ml-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      placeholder="Search accounts..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                    />
                  </div>
                  {accountResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {accountResults.map((a: any) => (
                        <button
                          key={a.id}
                          onClick={() => { setExistingAccountId(a.id); setAccountSearch(a.name); setAccountResults([]); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between ${
                            existingAccountId === a.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <span>{a.name}</span>
                          {existingAccountId === a.id && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={accountAction === 'skip'} onChange={() => setAccountAction('skip')}
                  className="text-blue-600" />
                <span className="text-sm">Don't create account</span>
              </label>
            </div>
          </div>

          {/* ── OPPORTUNITY SECTION ── */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              <Briefcase size={16} /> Opportunity (Optional)
            </h3>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={createOpportunity}
                onChange={(e) => setCreateOpportunity(e.target.checked)}
                className="text-blue-600 rounded"
              />
              <span className="text-sm">Create Opportunity</span>
            </label>
            {createOpportunity && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-6">
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Opportunity Name</label>
                  <input
                    type="text"
                    value={opportunityName}
                    onChange={(e) => setOpportunityName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount</label>
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Expected Close Date</label>
                  <input
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── NOTES ── */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Conversion Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes about this conversion..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={converting || (contactAction === 'merge_existing' && !existingContactId)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {converting ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
            {converting ? 'Converting...' : 'Convert Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
