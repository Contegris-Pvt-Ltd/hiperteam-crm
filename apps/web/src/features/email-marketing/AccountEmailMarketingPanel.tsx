import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Send, Plus, X, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { emailMarketingApi } from '../../api/email-marketing.api';

interface ContactStat {
  contactId: string;
  contactName: string;
  email: string;
  status: string | null;
  lists: { id: string; name: string }[];
  lastOpened: string | null;
  lastClicked: string | null;
}

interface EmailList {
  id: string;
  name: string;
}

export function AccountEmailMarketingPanel({ accountId }: { accountId: string }) {
  const [contacts, setContacts] = useState<ContactStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bulk subscribe
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [availableLists, setAvailableLists] = useState<EmailList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [bulkSubscribing, setBulkSubscribing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [accountId]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailMarketingApi.getAccountContactsStats(accountId);
      setContacts(data.contacts || data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load email marketing data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (contactId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.contactId)));
    }
  };

  const openBulkModal = async () => {
    setShowBulkModal(true);
    setSelectedListId('');
    setListsLoading(true);
    try {
      const data = await emailMarketingApi.getLists();
      setAvailableLists(data);
    } catch {
      setAvailableLists([]);
    } finally {
      setListsLoading(false);
    }
  };

  const handleBulkSubscribe = async () => {
    if (!selectedListId || selectedIds.size === 0) return;
    const list = availableLists.find((l) => l.id === selectedListId);
    if (!list) return;
    setBulkSubscribing(true);
    try {
      const promises = Array.from(selectedIds).map((contactId) =>
        emailMarketingApi.subscribeContact(contactId, {
          listId: list.id,
          listName: list.name,
        })
      );
      await Promise.all(promises);
      setShowBulkModal(false);
      setSelectedIds(new Set());
      await fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to subscribe contacts');
    } finally {
      setBulkSubscribing(false);
    }
  };

  const statusStyles: Record<string, string> = {
    subscribed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    unsubscribed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    bounced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    complained: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cleaned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  // Check if no integration is configured — none of the contacts have marketing data
  const hasAnyMarketingData = contacts.some((c: any) =>
    (c.status && c.status !== 'none') ||
    (c.marketingStatus && c.marketingStatus !== 'none') ||
    (c.provider) ||
    (c.lists && c.lists.length > 0)
  );
  if ((!loading && !hasAnyMarketingData && !error) || (error && (error.toLowerCase().includes('not configured') || error.toLowerCase().includes('no provider') || error.toLowerCase().includes('not connected')))) {
    return (
      <div className="text-center py-12">
        <Send className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">Email marketing not connected</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
          Connect MailerLite or Mailchimp in <Link to="/admin/integrations" className="text-purple-600 dark:text-purple-400 hover:underline">Admin → Integrations</Link>
        </p>
      </div>
    );
  }

  if (error && contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 mb-3">{error}</p>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <Send className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">No contacts with email marketing data</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
          Subscribe contacts to email lists from their contact detail pages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={openBulkModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to List
          </button>
        </div>
      )}

      {/* Contacts table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="py-2 px-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === contacts.length && contacts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                />
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Contact Name
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Email
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Lists
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Last Open
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Last Click
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
            {contacts.map((contact) => (
              <tr
                key={contact.contactId}
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-2.5 px-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.contactId)}
                    onChange={() => toggleSelect(contact.contactId)}
                    className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                </td>
                <td className="py-2.5 px-3">
                  <Link
                    to={`/contacts/${contact.contactId}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    {contact.contactName}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-gray-600 dark:text-slate-400">
                  {contact.email}
                </td>
                <td className="py-2.5 px-3">
                  {contact.status ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusStyles[contact.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {contact.status}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-slate-500">--</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  {contact.lists.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.lists.map((list) => (
                        <span
                          key={list.id}
                          className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs"
                        >
                          {list.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-slate-500">--</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-slate-400">
                  {contact.lastOpened
                    ? formatDistanceToNow(new Date(contact.lastOpened), { addSuffix: true })
                    : '--'}
                </td>
                <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-slate-400">
                  {contact.lastClicked
                    ? formatDistanceToNow(new Date(contact.lastClicked), { addSuffix: true })
                    : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Add to List Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Add {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''} to List
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {listsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Select List
                  </label>
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Choose a list...</option>
                    {availableLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSubscribe}
                disabled={!selectedListId || bulkSubscribing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {bulkSubscribing && <Loader2 className="w-4 h-4 animate-spin" />}
                Subscribe All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
