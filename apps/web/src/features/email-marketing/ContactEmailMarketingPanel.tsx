import { useState, useEffect } from 'react';
import {
  Loader2, Send, Plus, X, Mail, MousePointerClick,
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { emailMarketingApi } from '../../api/email-marketing.api';

interface ContactStats {
  provider: string | null;
  status: string | null;
  lists: { id: string; name: string }[];
  lastOpened: string | null;
  lastClicked: string | null;
  tags: string[];
}

interface EmailList {
  id: string;
  name: string;
}

export function ContactEmailMarketingPanel({ contactId }: { contactId: string }) {
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add to list modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableLists, setAvailableLists] = useState<EmailList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [tags, setTags] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [contactId]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailMarketingApi.getContactStats(contactId);
      setStats(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load email marketing data');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = async () => {
    setShowAddModal(true);
    setSelectedListId('');
    setTags('');
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

  const handleSubscribe = async () => {
    if (!selectedListId) return;
    const list = availableLists.find((l) => l.id === selectedListId);
    if (!list) return;
    setSubscribing(true);
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await emailMarketingApi.subscribeContact(contactId, {
        listId: list.id,
        listName: list.name,
        tags: tagArray.length > 0 ? tagArray : undefined,
      });
      setShowAddModal(false);
      await fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to subscribe contact');
    } finally {
      setSubscribing(false);
    }
  };

  const handleRemove = async (listId: string) => {
    setRemoving(listId);
    try {
      await emailMarketingApi.unsubscribeContact(contactId, listId);
      await fetchStats();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to unsubscribe contact');
    } finally {
      setRemoving(null);
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

  if (error && !stats) {
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

  if (!stats || !stats.provider) {
    return (
      <div className="text-center py-12">
        <Send className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400">Email marketing not connected</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
          Configure MailerLite or Mailchimp in Admin &gt; Integrations
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

      {/* Provider & Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          {stats.provider === 'mailerlite' ? 'MailerLite' : stats.provider === 'mailchimp' ? 'Mailchimp' : stats.provider}
        </span>
        {stats.status && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${statusStyles[stats.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
            {stats.status}
          </span>
        )}
      </div>

      {/* Engagement stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
            <Mail className="w-3.5 h-3.5" />
            Last Opened
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.lastOpened
              ? formatDistanceToNow(new Date(stats.lastOpened), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mb-1">
            <MousePointerClick className="w-3.5 h-3.5" />
            Last Clicked
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.lastClicked
              ? formatDistanceToNow(new Date(stats.lastClicked), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Subscribed lists */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Subscribed Lists</h4>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to List
          </button>
        </div>
        {stats.lists.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Not subscribed to any lists</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.lists.map((list) => (
              <span
                key={list.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium"
              >
                {list.name}
                <button
                  onClick={() => handleRemove(list.id)}
                  disabled={removing === list.id}
                  className="text-blue-400 hover:text-red-500 dark:text-blue-500 dark:hover:text-red-400 transition-colors"
                  title="Remove from list"
                >
                  {removing === list.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {stats.tags && stats.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {stats.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add to List Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add to Email List</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {listsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              ) : (
                <>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Tags (optional)
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Comma-separated list of tags
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubscribe}
                disabled={!selectedListId || subscribing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {subscribing && <Loader2 className="w-4 h-4 animate-spin" />}
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
