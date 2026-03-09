import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Inbox,
  Star,
  Send,
  Search,
  Settings2,
  Loader2,
  Mail,
  MailOpen,
  Reply,
  Forward,
  Link2,
  X,
  Eye,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  Maximize2,
  Minimize2,
  Minus,
  Filter,
  Download,
  ChevronRight,
  MessageSquare,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { emailApi } from '../../api/email.api';
import { usersApi } from '../../api/users.api';
import type { Email, EmailAccount } from '../../api/email.api';
import DOMPurify from 'dompurify';

type FilterTab = 'all' | 'unread' | 'starred' | 'sent';

export function InboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [expandedThreadMessages, setExpandedThreadMessages] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [forwardEmail, setForwardEmail] = useState<Email | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkActing(true);
    try {
      await emailApi.bulkDelete(Array.from(selectedIds));
      setEmails((prev) => prev.filter((e) => !selectedIds.has(e.id)));
      if (selectedEmail && selectedIds.has(selectedEmail.id)) {
        setSelectedEmail(null);
        setThreadEmails([]);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk delete failed', err);
    } finally {
      setBulkActing(false);
    }
  };

  const handleBulkMarkRead = async (isRead: boolean) => {
    if (!selectedIds.size) return;
    setBulkActing(true);
    try {
      await emailApi.bulkMarkRead(Array.from(selectedIds), isRead);
      setEmails((prev) => prev.map((e) => selectedIds.has(e.id) ? { ...e, isRead } : e));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk mark read failed', err);
    } finally {
      setBulkActing(false);
    }
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      await emailApi.deleteEmail(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
        setThreadEmails([]);
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  // Load accounts
  useEffect(() => {
    emailApi.getAccounts().then(setAccounts).catch(console.error);
  }, []);

  // Load emails
  const loadEmails = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params: any = { page, limit: 50 };
      if (accountFilter) params.accountId = accountFilter;
      if (search) params.search = search;
      if (filter === 'unread') params.isRead = false;
      if (filter === 'starred') params.isStarred = true;
      if (filter === 'sent') params.direction = 'outbound';

      const res = await emailApi.getEmails(params);
      setEmails(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to load emails', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter, accountFilter, search]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Sync all accounts from provider then reload
  const syncAndReload = async () => {
    setSyncing(true);
    try {
      await Promise.all(accounts.map((a) => emailApi.syncAccount(a.id).catch(() => {})));
      await loadEmails();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  // Show success toast from OAuth callback
  useEffect(() => {
    if (searchParams.get('connected')) {
      emailApi.getAccounts().then(setAccounts).catch(console.error);
    }
  }, [searchParams]);

  const handleSelectEmail = async (email: Email) => {
    setLoadingDetail(true);
    try {
      // If this is a thread with multiple messages, load the whole thread
      if (email.threadId && (email.threadCount || 1) > 1) {
        const thread = await emailApi.getThreadEmails(email.threadId);
        setThreadEmails(thread);
        setSelectedEmail(thread[thread.length - 1]); // latest message
        // Expand only the last message by default
        setExpandedThreadMessages(new Set([thread[thread.length - 1].id]));
      } else {
        const full = await emailApi.getEmailById(email.id);
        setSelectedEmail(full);
        setThreadEmails([full]);
        setExpandedThreadMessages(new Set([full.id]));
      }
      if (!email.isRead) {
        await emailApi.markRead(email.id, true);
        setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggleStar = async (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    await emailApi.toggleStar(emailId);
    setEmails((prev) =>
      prev.map((em) => (em.id === emailId ? { ...em, isStarred: !em.isStarred } : em)),
    );
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filterTabs: { key: FilterTab; label: string; icon: any }[] = [
    { key: 'all', label: 'All', icon: Inbox },
    { key: 'unread', label: 'Unread', icon: Mail },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'sent', label: 'Sent', icon: Send },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Inbox</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Compose
          </button>
          <button
            onClick={syncAndReload}
            disabled={syncing}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            title="Sync & Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/inbox/rules')}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            title="Inbox Rules"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/settings/email')}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            title="Email Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {accounts.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Mail className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No email accounts connected</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Connect your email to start sending and receiving</p>
            <button
              onClick={() => navigate('/settings/email')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Connect Email Account
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left column: email list */}
          <div className="w-[380px] flex-shrink-0 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800">
            {/* Filters */}
            <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 space-y-2">
              <div className="flex gap-1">
                {filterTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => { setFilter(tab.key); setPage(1); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filter === tab.key
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 dark:text-gray-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded"
                  title={selectedIds.size === emails.length && emails.length > 0 ? 'Deselect all' : 'Select all'}
                >
                  {selectedIds.size > 0 && selectedIds.size === emails.length
                    ? <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    : selectedIds.size > 0
                      ? <MinusSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      : <Square className="w-4 h-4" />}
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search emails..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:text-white"
                  />
                </div>
                {accounts.length > 1 && (
                  <select
                    value={accountFilter}
                    onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }}
                    className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 bg-gray-50 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.email}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                  title={selectedIds.size === emails.length ? 'Deselect all' : 'Select all'}
                >
                  {selectedIds.size === emails.length
                    ? <CheckSquare className="w-4 h-4" />
                    : <MinusSquare className="w-4 h-4" />}
                </button>
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleBulkMarkRead(true)}
                    disabled={bulkActing}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                    title="Mark as read"
                  >
                    <MailOpen className="w-3.5 h-3.5" /> Read
                  </button>
                  <button
                    onClick={() => handleBulkMarkRead(false)}
                    disabled={bulkActing}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                    title="Mark as unread"
                  >
                    <Mail className="w-3.5 h-3.5" /> Unread
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkActing}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete selected"
                  >
                    {bulkActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                  </button>
                </div>
              </div>
            )}

            {/* Email list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No emails found</div>
              ) : (
                emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 cursor-pointer transition-colors ${
                      selectedIds.has(email.id)
                        ? 'bg-purple-50/70 dark:bg-purple-900/15'
                        : selectedEmail?.id === email.id || (selectedEmail?.threadId && selectedEmail.threadId === email.threadId)
                          ? 'bg-purple-50 dark:bg-purple-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    } ${!email.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={(e) => toggleSelect(email.id, e)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {selectedIds.has(email.id)
                          ? <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          : <Square className="w-4 h-4 text-gray-300 dark:text-gray-600 hover:text-purple-400" />}
                      </button>
                      <button
                        onClick={(e) => handleToggleStar(e, email.id)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            email.isStarred
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                          }`}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {email.direction === 'outbound'
                              ? `To: ${email.toEmails?.[0]?.email || ''}`
                              : email.fromName || email.fromEmail}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatTime(email.sentAt || email.receivedAt)}
                          </span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${!email.isRead ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                          {email.subject || '(no subject)'}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                          {email.snippet}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {(email.threadCount || 0) > 1 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                              <MessageSquare className="w-3 h-3" /> {email.threadCount}
                            </span>
                          )}
                          {(email.hasAttachments || email.threadHasAttachments) && <Paperclip className="w-3 h-3 text-gray-400" />}
                          {email.opensCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                              <Eye className="w-3 h-3" /> {email.opensCount}
                            </span>
                          )}
                          {(email.threadUnreadCount || 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                              {email.threadUnreadCount} new
                            </span>
                          )}
                          {!email.isRead && !(email.threadCount && email.threadCount > 1) && (
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs text-gray-500">
                <span>Page {meta.page} of {meta.totalPages}</span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-slate-600 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-slate-600 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column: email detail */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 overflow-hidden">
            {!selectedEmail ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <MailOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select an email to read</p>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : (
              <>
                {/* Thread subject header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedEmail.subject || '(no subject)'}
                      </h2>
                      {threadEmails.length > 1 && (
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {threadEmails.length} messages
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setReplyTo(threadEmails[threadEmails.length - 1]); setShowCompose(true); }}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Reply to latest"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setForwardEmail(threadEmails[threadEmails.length - 1]); setShowCompose(true); }}
                        className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Forward latest"
                      >
                        <Forward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmail(selectedEmail.id)}
                        className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thread messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {threadEmails.map((msg, idx) => {
                    const isExpanded = expandedThreadMessages.has(msg.id);
                    const isLast = idx === threadEmails.length - 1;
                    return (
                      <div key={msg.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                        {/* Message header — always visible, clickable to toggle */}
                        <div
                          className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-t-xl transition-colors"
                          onClick={() => {
                            setExpandedThreadMessages((prev) => {
                              const next = new Set(prev);
                              if (next.has(msg.id)) {
                                if (!isLast) next.delete(msg.id);
                              } else {
                                next.add(msg.id);
                              }
                              return next;
                            });
                          }}
                        >
                          {/* Avatar circle */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            msg.direction === 'outbound'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {(msg.fromName || msg.fromEmail || '?')[0].toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm truncate ${!msg.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                {msg.direction === 'outbound' ? 'Me' : (msg.fromName || msg.fromEmail)}
                              </span>
                              {msg.direction === 'outbound' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded font-medium">Sent</span>
                              )}
                              {!msg.isRead && (
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                            </div>
                            {!isExpanded && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                {msg.snippet}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {msg.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}
                            <span className="text-[10px] text-gray-400">
                              {formatTime(msg.sentAt || msg.receivedAt)}
                            </span>
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded message body */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-slate-700">
                            {/* To/CC details */}
                            <div className="px-5 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-slate-800/50">
                              <span>To: {msg.toEmails?.map((e) => e.name || e.email).join(', ')}</span>
                              {msg.ccEmails?.length > 0 && (
                                <span className="ml-3">CC: {msg.ccEmails.map((e) => e.name || e.email).join(', ')}</span>
                              )}
                              <span className="ml-3 text-gray-400">
                                {msg.sentAt
                                  ? new Date(msg.sentAt).toLocaleString()
                                  : msg.receivedAt
                                    ? new Date(msg.receivedAt).toLocaleString()
                                    : ''}
                              </span>
                            </div>

                            {/* Body */}
                            <div className="px-5 py-4">
                              {msg.bodyHtml ? (
                                <div
                                  className="prose dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_img]:max-w-full [&_img]:h-auto"
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(msg.bodyHtml, {
                                      ADD_TAGS: ['img'],
                                      ADD_ATTR: ['src', 'alt', 'width', 'height', 'style'],
                                      ALLOW_DATA_ATTR: true,
                                      ADD_URI_SAFE_ATTR: ['src'],
                                    }),
                                  }}
                                />
                              ) : (
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                                  {msg.bodyText || msg.snippet}
                                </pre>
                              )}
                            </div>

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="px-5 pb-4">
                                <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    Attachments ({msg.attachments.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {msg.attachments.map((att) => (
                                      <a
                                        key={att.id}
                                        href={att.storageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={att.filename}
                                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors cursor-pointer border border-gray-200 dark:border-slate-600"
                                      >
                                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-gray-700 dark:text-gray-300">{att.filename}</span>
                                        <span className="text-gray-400">({Math.round((att.sizeBytes || 0) / 1024)}KB)</span>
                                        <Download className="w-3.5 h-3.5 text-purple-500" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Per-message actions */}
                            <div className="px-5 pb-3 flex items-center gap-1">
                              <button
                                onClick={() => { setReplyTo(msg); setShowCompose(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              >
                                <Reply className="w-3.5 h-3.5" /> Reply
                              </button>
                              <button
                                onClick={() => { setForwardEmail(msg); setShowCompose(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              >
                                <Forward className="w-3.5 h-3.5" /> Forward
                              </button>
                              <button
                                onClick={(e) => handleToggleStar(e, msg.id)}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                              >
                                <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          accounts={accounts}
          replyTo={replyTo}
          forwardOf={forwardEmail}
          onClose={() => { setShowCompose(false); setReplyTo(null); setForwardEmail(null); }}
          onSent={() => { setShowCompose(false); setReplyTo(null); setForwardEmail(null); loadEmails(); }}
        />
      )}
    </div>
  );
}

// ── Compose Modal (centered with minimize/maximize) ───────────
function ComposeModal({
  accounts,
  replyTo,
  forwardOf,
  onClose,
  onSent,
}: {
  accounts: EmailAccount[];
  replyTo: Email | null;
  forwardOf: Email | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [to, setTo] = useState(replyTo ? replyTo.fromEmail : '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(
    replyTo
      ? `Re: ${replyTo.subject || ''}`
      : forwardOf
        ? `Fwd: ${forwardOf.subject || ''}`
        : '',
  );
  const initialBody = forwardOf?.bodyHtml
    ? `<br/><br/><blockquote style="border-left:2px solid #ccc;padding-left:12px;margin:0;color:#666">${forwardOf.bodyHtml}</blockquote>`
    : replyTo?.bodyHtml
      ? `<br/><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin:0;color:#666"><p>On ${replyTo.sentAt ? new Date(replyTo.sentAt).toLocaleString() : ''}, ${replyTo.fromName || replyTo.fromEmail} wrote:</p>${replyTo.bodyHtml}</div>`
      : '';
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyInitialized = useRef(false);

  // Set initial body content once on mount (not via dangerouslySetInnerHTML which resets on re-render)
  useEffect(() => {
    if (bodyInitialized.current || !bodyRef.current) return;
    bodyInitialized.current = true;
    bodyRef.current.innerHTML = initialBody;

    // Load and append email signature
    usersApi.getEmailSignature().then((res) => {
      if (res.signature && bodyRef.current) {
        const sigBlock = `<br/><div class="email-signature" style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px">${res.signature}</div>`;
        bodyRef.current.innerHTML = bodyRef.current.innerHTML + sigBlock;
      }
    }).catch(() => {});
  }, []);

  // Process contentEditable HTML into proper email HTML with inline styles
  const processComposeHtml = (rawHtml: string): { bodyHtml: string; bodyText: string } => {
    const tmp = document.createElement('div');
    tmp.innerHTML = rawHtml;

    // Convert bare <div> wrappers to <p> (Chrome contentEditable uses divs for line breaks)
    tmp.querySelectorAll(':scope > div').forEach((div) => {
      // Skip semantic wrappers (signature, blockquotes, containers with nested blocks)
      if (
        div.className ||
        div.getAttribute('style')?.includes('border-left') ||
        div.querySelector('div, ul, ol, blockquote, table')
      ) return;
      const p = document.createElement('p');
      p.innerHTML = div.innerHTML;
      for (const attr of Array.from(div.attributes)) {
        p.setAttribute(attr.name, attr.value);
      }
      p.style.margin = '0';
      p.style.padding = '0';
      div.replaceWith(p);
    });

    // Add inline styles to lists so they render in email clients and our viewer
    tmp.querySelectorAll('ul').forEach((ul) => {
      ul.style.listStyleType = 'disc';
      ul.style.paddingLeft = '24px';
      ul.style.margin = '8px 0';
    });
    tmp.querySelectorAll('ol').forEach((ol) => {
      ol.style.listStyleType = 'decimal';
      ol.style.paddingLeft = '24px';
      ol.style.margin = '8px 0';
    });
    tmp.querySelectorAll('li').forEach((li) => {
      li.style.margin = '4px 0';
    });

    const bodyText = tmp.innerText || tmp.textContent || '';
    return { bodyHtml: tmp.innerHTML, bodyText };
  };

  const handleSend = async () => {
    if (!to.trim() || !accountId) return;
    setSending(true);
    try {
      const { bodyHtml: htmlBody, bodyText } = processComposeHtml(bodyRef.current?.innerHTML || '');
      const toList = to.split(',').map((e) => e.trim()).filter(Boolean);
      const ccList = cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined;
      const bccList = bcc ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : undefined;

      if (replyTo) {
        await emailApi.replyToEmail(replyTo.id, {
          accountId,
          to: toList,
          cc: ccList,
          bodyHtml: htmlBody,
        });
      } else if (forwardOf) {
        await emailApi.forwardEmail(forwardOf.id, {
          accountId,
          to: toList,
          bodyHtml: htmlBody,
        });
      } else {
        await emailApi.sendEmail(
          { accountId, to: toList, cc: ccList, bcc: bccList, subject, bodyHtml: htmlBody, bodyText },
          attachments.length > 0 ? attachments : undefined,
        );
      }
      onSent();
    } catch (err) {
      console.error('Send failed', err);
    } finally {
      setSending(false);
    }
  };

  const execCommand = (cmd: string, value?: string) => {
    // Focus the editor first if not already focused
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  // Prevent toolbar buttons from stealing focus/selection from contentEditable
  const toolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const title = replyTo ? 'Reply' : forwardOf ? 'Forward' : 'New Message';

  // Minimized: collapsed bar at bottom-right
  if (minimized) {
    return (
      <div className="fixed z-50 bottom-0 right-20 w-[320px] bg-gray-800 dark:bg-slate-700 rounded-t-lg shadow-2xl cursor-pointer select-none"
        onClick={() => setMinimized(false)}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium text-white truncate">{title}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
              className="p-1 hover:bg-gray-700 dark:hover:bg-slate-600 rounded text-gray-300 hover:text-white"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 hover:bg-gray-700 dark:hover:bg-slate-600 rounded text-gray-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col transition-all ${
          maximized ? 'w-[calc(100%-2rem)] h-[calc(100%-2rem)]' : 'w-[720px] max-h-[85vh]'
        }`}
        style={maximized ? undefined : { height: '600px' }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 dark:bg-slate-700 rounded-t-xl">
          <span className="text-sm font-semibold text-white">{title}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 hover:bg-gray-700 dark:hover:bg-slate-600 rounded text-gray-300 hover:text-white"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMaximized(!maximized)}
              className="p-1.5 hover:bg-gray-700 dark:hover:bg-slate-600 rounded text-gray-300 hover:text-white"
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-700 dark:hover:bg-slate-600 rounded text-gray-300 hover:text-white"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">
          {/* From */}
          <div className="flex items-center px-4 py-2">
            <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-sm">From</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 focus:ring-0 p-0"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.displayName || a.email}</option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex items-center px-4 py-2">
            <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-sm">To</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 focus:ring-0 p-0 placeholder-gray-300 dark:placeholder-gray-600"
              placeholder="Recipients (comma separated)"
            />
            {!showCcBcc && (
              <button
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2 flex-shrink-0 font-medium"
              >
                Cc / Bcc
              </button>
            )}
          </div>

          {/* CC */}
          {showCcBcc && (
            <div className="flex items-center px-4 py-2">
              <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-sm">Cc</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 focus:ring-0 p-0 placeholder-gray-300 dark:placeholder-gray-600"
                placeholder="Cc recipients"
              />
            </div>
          )}

          {/* BCC */}
          {showCcBcc && (
            <div className="flex items-center px-4 py-2">
              <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-sm">Bcc</span>
              <input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 focus:ring-0 p-0 placeholder-gray-300 dark:placeholder-gray-600"
                placeholder="Bcc recipients"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center px-4 py-2">
            <span className="text-gray-400 dark:text-gray-500 w-14 flex-shrink-0 text-sm">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-gray-800 dark:text-gray-200 focus:ring-0 p-0 placeholder-gray-300 dark:placeholder-gray-600"
              placeholder="Email subject"
            />
          </div>
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          contentEditable
          className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none border-t border-gray-100 dark:border-slate-700 [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:my-1 [&_img]:max-w-full [&_img]:h-auto"
          suppressContentEditableWarning
        />

        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/30">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs">
                <Paperclip className="w-3 h-3 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{file.name}</span>
                <span className="text-gray-400">({Math.round(file.size / 1024)}KB)</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-gray-400 hover:text-red-500 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar + Send */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl">
          <button
            onClick={handleSend}
            disabled={sending || !to.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 ml-3 border-l border-gray-300 dark:border-slate-600 pl-3">
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Bold">
              <span className="text-xs font-bold">B</span>
            </button>
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Italic">
              <span className="text-xs italic">I</span>
            </button>
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('underline')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Underline">
              <span className="text-xs underline">U</span>
            </button>
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Bullet list">
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <circle cx="2" cy="4" r="1.5" /><rect x="5" y="3" width="10" height="2" rx="0.5" />
                <circle cx="2" cy="8" r="1.5" /><rect x="5" y="7" width="10" height="2" rx="0.5" />
                <circle cx="2" cy="12" r="1.5" /><rect x="5" y="11" width="10" height="2" rx="0.5" />
              </svg>
            </button>
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('insertOrderedList')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Numbered list">
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                <text x="0" y="5" fontSize="5" fontWeight="bold">1</text><rect x="5" y="3" width="10" height="2" rx="0.5" />
                <text x="0" y="9" fontSize="5" fontWeight="bold">2</text><rect x="5" y="7" width="10" height="2" rx="0.5" />
                <text x="0" y="13" fontSize="5" fontWeight="bold">3</text><rect x="5" y="11" width="10" height="2" rx="0.5" />
              </svg>
            </button>
            <button
              onMouseDown={toolbarMouseDown}
              onClick={() => { const url = prompt('Enter link URL:'); if (url) execCommand('createLink', url); }}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Insert link"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button onMouseDown={toolbarMouseDown} onClick={() => execCommand('removeFormat')} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400" title="Remove formatting">
              <svg viewBox="0 0 16 16" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" fill="none">
                <line x1="2" y1="2" x2="14" y2="14" /><path d="M6 2h6l-3 12H3" />
              </svg>
            </button>
            {/* Attachments */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
                }
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-gray-400"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>

          {/* Discard */}
          <div className="ml-auto">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-400 hover:text-red-500 transition-colors"
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
