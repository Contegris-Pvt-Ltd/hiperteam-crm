import { useState, useEffect } from 'react';
import { X, Loader2, Mail, Send, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { formsApi } from '../../api/forms.api';

interface FormEmailModalProps {
  form: { id: string; name: string };
  entityType: string;
  entityId: string;
  entityData: Record<string, any>;
  onClose: () => void;
  onSent: () => void;
}

export function FormEmailModal({
  form,
  entityType,
  entityId,
  entityData,
  onClose,
  onSent,
}: FormEmailModalProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [subject, setSubject] = useState(`Please fill out: ${form.name}`);
  const [body, setBody] = useState(
    `Hello,\n\nPlease fill out the form using the link below:\n\n{form_link}\n\nThis link will expire in 7 days.\n\nBest regards`,
  );
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string; error?: string }[] | null>(null);

  // Auto-populate recipients from entity data
  useEffect(() => {
    const emails: string[] = [];
    if (entityData?.email && typeof entityData.email === 'string') {
      emails.push(entityData.email);
    }
    if (Array.isArray(entityData?.emails)) {
      for (const e of entityData.emails) {
        const addr = typeof e === 'string' ? e : e?.email || e?.address;
        if (addr && !emails.includes(addr)) emails.push(addr);
      }
    }
    if (entityData?.primaryEmail && !emails.includes(entityData.primaryEmail)) {
      emails.push(entityData.primaryEmail);
    }
    setRecipients(emails);
  }, [entityData]);

  const addEmail = () => {
    const trimmed = newEmail.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !recipients.includes(trimmed)) {
      setRecipients((prev) => [...prev, trimmed]);
      setNewEmail('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleSend = async () => {
    if (recipients.length === 0) return;
    setSending(true);
    try {
      const res = await formsApi.sendFormEmail({
        formId: form.id,
        entityType,
        entityId,
        recipients,
        subject,
        body,
      });
      setResults(res);
      onSent();
    } catch (err: any) {
      setResults([{ email: 'all', status: 'failed', error: err?.response?.data?.message || 'Failed to send' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send Form via Email</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">{form.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {results ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Send Results</h3>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    r.status === 'sent'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  }`}
                >
                  {r.status === 'sent' ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{r.email}</span>
                  {r.error && <span className="ml-auto text-xs">{r.error}</span>}
                </div>
              ))}
              <button
                onClick={onClose}
                className="mt-4 w-full px-4 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipients</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full px-2.5 py-0.5 text-xs"
                    >
                      {email}
                      <button
                        onClick={() => removeRecipient(email)}
                        className="hover:text-purple-900 dark:hover:text-purple-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                    placeholder="Add email address"
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
                  />
                  <button
                    onClick={addEmail}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message Body
                  <span className="text-xs text-gray-400 ml-2">Use {'{form_link}'} for the form URL</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm dark:text-white font-mono"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!results && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || recipients.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
