// ============================================================
// FILE: apps/web/src/features/leads/components/ConvertLeadModal.tsx
//
// REPLACES the entire existing file.
//
// NEW FEATURES:
//   - Auto-checks for duplicate contacts & accounts on open
//   - Shows duplicate warning banner with match details
//   - Shows relationship status (linked / unrelated)
//   - User picks existing or creates new
//   - Auto-links new contact+account on backend (already handled)
// ============================================================
import { useState, useEffect } from 'react';
import {
  X, Search, UserPlus, Building2, Briefcase, ChevronRight,
  Check, Loader2, AlertTriangle, Link2, Unlink, Mail, Phone,
  Globe, User,
} from 'lucide-react';
import { leadsApi } from '../../../api/leads.api';
import { contactsApi } from '../../../api/contacts.api';
import { accountsApi } from '../../../api/accounts.api';
import type { Lead, ConvertLeadData } from '../../../api/leads.api';

interface ConvertLeadModalProps {
  lead: Lead;
  onClose: () => void;
  onConverted: () => void;
}

interface MatchingContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  company: string;
  jobTitle: string;
  avatarUrl: string;
  matchType: string; // 'email', 'phone', 'email,phone', etc.
}

interface MatchingAccount {
  id: string;
  name: string;
  website: string;
  industry: string;
  logoUrl: string;
  accountType: string;
  matchType: string; // 'name', 'website', 'domain', 'linked'
}

interface DuplicateCheckResult {
  lead: { firstName: string; lastName: string; email: string; phone: string; mobile: string; company: string; website: string };
  matchingContacts: MatchingContact[];
  matchingAccounts: MatchingAccount[];
  relationships: Record<string, string[]>; // contactId -> accountId[]
  hasMatches: boolean;
}

export function ConvertLeadModal({ lead, onClose, onConverted }: ConvertLeadModalProps) {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  // Duplicate check state
  const [checking, setChecking] = useState(true);
  const [dupResult, setDupResult] = useState<DuplicateCheckResult | null>(null);

  // Form state
  const [contactAction, setContactAction] = useState<'create_new' | 'merge_existing'>('create_new');
  const [existingContactId, setExistingContactId] = useState('');
  const [selectedContactName, setSelectedContactName] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<any[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const [accountAction, setAccountAction] = useState<'create_new' | 'link_existing' | 'skip'>(
    lead.company ? 'create_new' : 'skip',
  );
  const [existingAccountId, setExistingAccountId] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');
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

  // ============================================================
  // DUPLICATE CHECK ON MOUNT
  // ============================================================
  useEffect(() => {
    const checkDuplicates = async () => {
      setChecking(true);
      try {
        const result = await leadsApi.checkConversionDuplicates(lead.id);
        setDupResult(result);

        // Auto-switch to "use existing" if exact matches found
        if (result.matchingContacts.length > 0) {
          setContactAction('merge_existing');
          // Pre-select first match
          const first = result.matchingContacts[0];
          setExistingContactId(first.id);
          setSelectedContactName(`${first.firstName} ${first.lastName}`);
        }
        if (result.matchingAccounts.length > 0) {
          setAccountAction('link_existing');
          // If a contact is selected and has a related account, pre-select that account
          const firstContact = result.matchingContacts[0];
          const relatedAccountIds = firstContact ? (result.relationships[firstContact.id] || []) : [];
          if (relatedAccountIds.length > 0) {
            const relatedAccount = result.matchingAccounts.find((a: MatchingAccount) => relatedAccountIds.includes(a.id));
            if (relatedAccount) {
              setExistingAccountId(relatedAccount.id);
              setSelectedAccountName(relatedAccount.name);
            } else {
              setExistingAccountId(result.matchingAccounts[0].id);
              setSelectedAccountName(result.matchingAccounts[0].name);
            }
          } else {
            setExistingAccountId(result.matchingAccounts[0].id);
            setSelectedAccountName(result.matchingAccounts[0].name);
          }
        }
      } catch (err) {
        console.error('Duplicate check failed:', err);
        // Fail silently — modal still works, just no duplicate detection
      } finally {
        setChecking(false);
      }
    };
    checkDuplicates();
  }, [lead.id]);

  // ============================================================
  // MANUAL SEARCH (for when user wants to search beyond auto-detected)
  // ============================================================
  const searchContacts = async (q: string) => {
    if (!q || q.length < 2) { setContactResults([]); return; }
    setSearchingContacts(true);
    try {
      const response = await contactsApi.getAll({ search: q, limit: 5 });
      setContactResults(response.data || []);
    } catch { /* ignore */ }
    finally { setSearchingContacts(false); }
  };

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

  // ============================================================
  // HELPERS
  // ============================================================
  const isContactLinkedToAccount = (contactId: string, accountId: string): boolean => {
    if (!dupResult) return false;
    const linked = dupResult.relationships[contactId] || [];
    return linked.includes(accountId);
  };

  const getMatchBadges = (matchType: string) => {
    return matchType.split(',').map(m => m.trim());
  };

  const selectContact = (c: MatchingContact) => {
    setExistingContactId(c.id);
    setSelectedContactName(`${c.firstName} ${c.lastName}`);
    setContactAction('merge_existing');
    setContactSearch('');
    setContactResults([]);

    // Auto-select related account if available
    if (dupResult) {
      const relatedAccountIds = dupResult.relationships[c.id] || [];
      if (relatedAccountIds.length > 0) {
        const relatedAccount = dupResult.matchingAccounts.find(a => relatedAccountIds.includes(a.id));
        if (relatedAccount) {
          setExistingAccountId(relatedAccount.id);
          setSelectedAccountName(relatedAccount.name);
          setAccountAction('link_existing');
        }
      }
    }
  };

  const selectAccount = (a: MatchingAccount) => {
    setExistingAccountId(a.id);
    setSelectedAccountName(a.name);
    setAccountAction('link_existing');
    setAccountSearch('');
    setAccountResults([]);
  };

  // ============================================================
  // CONVERT
  // ============================================================
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

  // ============================================================
  // RENDER: Match badge
  // ============================================================
  const MatchBadge = ({ type }: { type: string }) => {
    const config: Record<string, { icon: any; label: string; color: string }> = {
      email: { icon: Mail, label: 'Email', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      phone: { icon: Phone, label: 'Phone', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      mobile: { icon: Phone, label: 'Mobile', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      name: { icon: Building2, label: 'Name', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
      website: { icon: Globe, label: 'Website', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      domain: { icon: Globe, label: 'Domain', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      linked: { icon: Link2, label: 'Linked', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    };
    const c = config[type] || config.linked;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.color}`}>
        <Icon size={10} /> {c.label}
      </span>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
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

        {/* Loading state */}
        {checking ? (
          <div className="p-10 flex flex-col items-center gap-3 text-gray-500">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Checking for existing contacts & accounts…</span>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-6">

              {/* ── DUPLICATE WARNING BANNER ── */}
              {dupResult?.hasMatches && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <span className="font-medium">Potential duplicates found.</span>{' '}
                      We found {dupResult.matchingContacts.length > 0 && (
                        <>{dupResult.matchingContacts.length} matching contact{dupResult.matchingContacts.length > 1 ? 's' : ''}</>
                      )}
                      {dupResult.matchingContacts.length > 0 && dupResult.matchingAccounts.length > 0 && ' and '}
                      {dupResult.matchingAccounts.length > 0 && (
                        <>{dupResult.matchingAccounts.length} matching account{dupResult.matchingAccounts.length > 1 ? 's' : ''}</>
                      )}
                      . Please review and select existing records or create new ones.
                    </div>
                  </div>
                </div>
              )}

              {/* ── CONTACT SECTION ── */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <UserPlus size={16} /> Contact
                </h3>

                {/* Auto-detected matching contacts */}
                {dupResult && dupResult.matchingContacts.length > 0 && (
                  <div className="mb-3 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-700 dark:text-blue-400">
                      Existing contacts matching this lead
                    </div>
                    {dupResult.matchingContacts.map((c) => {
                      const isSelected = existingContactId === c.id && contactAction === 'merge_existing';
                      const linkedAccountIds = dupResult.relationships[c.id] || [];
                      const linkedAccounts = dupResult.matchingAccounts.filter(a => linkedAccountIds.includes(a.id));

                      return (
                        <button
                          key={c.id}
                          onClick={() => selectContact(c)}
                          className={`w-full text-left px-3 py-2.5 border-t border-blue-100 dark:border-blue-900/30 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Avatar */}
                              {c.avatarUrl ? (
                                <img src={c.avatarUrl} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-400 shrink-0">
                                  {(c.firstName?.[0] || '')}{(c.lastName?.[0] || '')}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {c.firstName} {c.lastName}
                                  {c.jobTitle && <span className="ml-1 text-xs text-gray-500">· {c.jobTitle}</span>}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {c.email}{c.phone && ` · ${c.phone}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex gap-1">
                                {getMatchBadges(c.matchType).map((m, i) => (
                                  <MatchBadge key={i} type={m} />
                                ))}
                              </div>
                              {isSelected && <Check size={16} className="text-blue-600" />}
                            </div>
                          </div>

                          {/* Show linked accounts for this contact */}
                          {linkedAccounts.length > 0 && (
                            <div className="mt-1.5 ml-10 flex flex-wrap gap-1">
                              {linkedAccounts.map(la => (
                                <span key={la.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                  <Link2 size={8} /> {la.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={contactAction === 'create_new'}
                      onChange={() => { setContactAction('create_new'); setExistingContactId(''); }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Create new contact (pre-filled from lead)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={contactAction === 'merge_existing'}
                      onChange={() => setContactAction('merge_existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm">
                      Use existing contact
                      {existingContactId && contactAction === 'merge_existing' && (
                        <span className="ml-1 text-blue-600 font-medium">({selectedContactName})</span>
                      )}
                    </span>
                  </label>

                  {/* Manual search — shown when merge_existing and no auto-detected selected */}
                  {contactAction === 'merge_existing' && !existingContactId && (
                    <div className="ml-6">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts by name or email..."
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800"
                        />
                        {searchingContacts && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                      </div>
                      {contactResults.length > 0 && (
                        <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          {contactResults.map((c: any) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setExistingContactId(c.id);
                                setSelectedContactName(`${c.firstName} ${c.lastName}`);
                                setContactSearch('');
                                setContactResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between"
                            >
                              <span>{c.firstName} {c.lastName} {c.email && `(${c.email})`}</span>
                              {existingContactId === c.id && <Check size={14} className="text-blue-600" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show selected contact with clear button */}
                  {contactAction === 'merge_existing' && existingContactId && (
                    <div className="ml-6 flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <User size={14} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400 flex-1">{selectedContactName}</span>
                      <button
                        onClick={() => { setExistingContactId(''); setSelectedContactName(''); }}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded text-blue-500"
                        title="Clear selection"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── ACCOUNT SECTION ── */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <Building2 size={16} /> Account
                </h3>

                {/* Auto-detected matching accounts */}
                {dupResult && dupResult.matchingAccounts.length > 0 && (
                  <div className="mb-3 border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-xs font-medium text-purple-700 dark:text-purple-400">
                      Existing accounts matching this lead
                    </div>
                    {dupResult.matchingAccounts.map((a) => {
                      const isSelected = existingAccountId === a.id && accountAction === 'link_existing';
                      // Check if currently selected contact is linked to this account
                      const isLinkedToSelectedContact = existingContactId
                        ? isContactLinkedToAccount(existingContactId, a.id)
                        : false;

                      return (
                        <button
                          key={a.id}
                          onClick={() => selectAccount(a)}
                          className={`w-full text-left px-3 py-2.5 border-t border-purple-100 dark:border-purple-900/30 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors ${
                            isSelected ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-inset ring-purple-300 dark:ring-purple-700' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {a.logoUrl ? (
                                <img src={a.logoUrl} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-medium text-purple-700 dark:text-purple-400 shrink-0">
                                  {(a.name?.[0] || '').toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {a.name}
                                  {a.industry && <span className="ml-1 text-xs text-gray-500">· {a.industry}</span>}
                                </div>
                                {a.website && (
                                  <div className="text-xs text-gray-500 truncate">{a.website}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Relationship indicator */}
                              {existingContactId && (
                                isLinkedToSelectedContact ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                                    <Link2 size={9} /> Related
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-medium">
                                    <Unlink size={9} /> Unrelated
                                  </span>
                                )
                              )}
                              <div className="flex gap-1">
                                {getMatchBadges(a.matchType).map((m, i) => (
                                  <MatchBadge key={i} type={m} />
                                ))}
                              </div>
                              {isSelected && <Check size={16} className="text-purple-600" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={accountAction === 'create_new'}
                      onChange={() => { setAccountAction('create_new'); setExistingAccountId(''); }}
                      className="text-blue-600"
                    />
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
                      {contactAction === 'create_new' && accountName && (
                        <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                          <Link2 size={10} /> New contact will be automatically linked to this account
                        </p>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={accountAction === 'link_existing'}
                      onChange={() => setAccountAction('link_existing')}
                      className="text-blue-600"
                    />
                    <span className="text-sm">
                      Link to existing account
                      {existingAccountId && accountAction === 'link_existing' && (
                        <span className="ml-1 text-purple-600 font-medium">({selectedAccountName})</span>
                      )}
                    </span>
                  </label>

                  {/* Manual search — shown when link_existing and no auto-detected selected */}
                  {accountAction === 'link_existing' && !existingAccountId && (
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
                        {searchingAccounts && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                      </div>
                      {accountResults.length > 0 && (
                        <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          {accountResults.map((a: any) => (
                            <button
                              key={a.id}
                              onClick={() => {
                                setExistingAccountId(a.id);
                                setSelectedAccountName(a.name);
                                setAccountSearch('');
                                setAccountResults([]);
                              }}
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

                  {/* Show selected account with clear button */}
                  {accountAction === 'link_existing' && existingAccountId && (
                    <div className="ml-6 flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <Building2 size={14} className="text-purple-600" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-400 flex-1">{selectedAccountName}</span>
                      <button
                        onClick={() => { setExistingAccountId(''); setSelectedAccountName(''); }}
                        className="p-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 rounded text-purple-500"
                        title="Clear selection"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={accountAction === 'skip'}
                      onChange={() => { setAccountAction('skip'); setExistingAccountId(''); }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Don't create account</span>
                  </label>
                </div>

                {/* Relationship warning: selected contact + account are unrelated */}
                {contactAction === 'merge_existing' && existingContactId &&
                 accountAction === 'link_existing' && existingAccountId &&
                 !isContactLinkedToAccount(existingContactId, existingAccountId) && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                    <Unlink size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                    <span className="text-xs text-yellow-700 dark:text-yellow-400">
                      The selected contact and account are <strong>not currently related</strong>. 
                      They will be linked automatically during conversion.
                    </span>
                  </div>
                )}
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
          </>
        )}
      </div>
    </div>
  );
}