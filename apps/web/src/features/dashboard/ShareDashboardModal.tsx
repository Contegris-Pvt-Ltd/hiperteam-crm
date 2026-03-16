// ============================================================
// FILE: apps/web/src/features/dashboard/ShareDashboardModal.tsx
// Modal for managing shared links for a dashboard
// ============================================================
import { useState, useEffect } from 'react';
import {
  X, Link2, Copy, Check, Trash2, Plus, Loader2,
  Clock, Mail, Shield, ExternalLink,
} from 'lucide-react';
import { dashboardLayoutApi } from '../../api/dashboard-layout.api';
import type { ShareLink } from '../../api/dashboard-layout.api';

interface ShareDashboardModalProps {
  open: boolean;
  dashboardId: string;
  dashboardName: string;
  onClose: () => void;
}

export function ShareDashboardModal({
  open,
  dashboardId,
  dashboardName,
  onClose,
}: ShareDashboardModalProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New link form
  const [showForm, setShowForm] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number>(7);
  const [emailInput, setEmailInput] = useState('');
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);

  useEffect(() => {
    if (open && dashboardId) {
      setLoading(true);
      dashboardLayoutApi.listShareLinks(dashboardId)
        .then(setLinks)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, dashboardId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86400000).toISOString()
        : undefined;

      const link = await dashboardLayoutApi.createShareLink(dashboardId, {
        expiresAt,
        allowedEmails: allowedEmails.length > 0 ? allowedEmails : undefined,
      });
      setLinks(prev => [link, ...prev]);
      setShowForm(false);
      setAllowedEmails([]);
      setEmailInput('');
      setExpiryDays(7);
    } catch (err) {
      console.error('Failed to create share link', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await dashboardLayoutApi.revokeShareLink(linkId);
      setLinks(prev => prev.map(l => l.id === linkId ? { ...l, isActive: false } : l));
    } catch (err) {
      console.error('Failed to revoke share link', err);
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/shared/dashboard/${token}`;
  };

  const handleCopy = (link: ShareLink) => {
    navigator.clipboard.writeText(getShareUrl(link.shareToken));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !allowedEmails.includes(email)) {
      setAllowedEmails(prev => [...prev, email]);
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setAllowedEmails(prev => prev.filter(e => e !== email));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Share "{dashboardName}"
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Create new link form */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create New Share Link
            </button>
          ) : (
            <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                New Share Link
              </h4>

              {/* Expiry */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Clock className="w-3 h-3" /> Expires in
                </label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never (no expiry)</option>
                </select>
              </div>

              {/* Email restrictions */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  <Mail className="w-3 h-3" /> Restrict to emails (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                    placeholder="user@example.com"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={addEmail}
                    disabled={!emailInput.trim().includes('@')}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 disabled:opacity-40 text-gray-700 dark:text-gray-300"
                  >
                    Add
                  </button>
                </div>
                {allowedEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allowedEmails.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full"
                      >
                        {email}
                        <button onClick={() => removeEmail(email)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {allowedEmails.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Leave empty to allow anyone with the link to view.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowForm(false); setAllowedEmails([]); setEmailInput(''); }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 px-3 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Link
                </button>
              </div>
            </div>
          )}

          {/* Existing links */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-6">
              No share links yet. Create one above.
            </p>
          ) : (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Active Links
              </h4>
              {links.map(link => (
                <div
                  key={link.id}
                  className={`border rounded-xl p-3 space-y-2 ${
                    link.isActive
                      ? 'border-gray-200 dark:border-slate-700'
                      : 'border-gray-100 dark:border-slate-800 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className={`w-3.5 h-3.5 flex-shrink-0 ${link.isActive ? 'text-green-500' : 'text-gray-300 dark:text-slate-600'}`} />
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                        {link.shareToken.substring(0, 16)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {link.isActive && (
                        <>
                          <button
                            onClick={() => window.open(getShareUrl(link.shareToken), '_blank')}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                            title="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopy(link)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                            title="Copy link"
                          >
                            {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleRevoke(link.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Revoke link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {!link.isActive && (
                        <span className="text-xs text-red-400 font-medium">Revoked</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-400 dark:text-slate-500">
                    {link.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    {!link.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> No expiry
                      </span>
                    )}
                    {link.allowedEmails.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {link.allowedEmails.length} email{link.allowedEmails.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
