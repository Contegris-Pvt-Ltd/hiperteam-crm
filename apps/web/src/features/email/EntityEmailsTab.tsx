import { useState, useEffect } from 'react';
import {
  Mail,
  MailOpen,
  Send,
  Inbox,
  Eye,
  ChevronDown,
  ChevronRight,
  Loader2,
  Paperclip,
  Plus,
} from 'lucide-react';
import { emailApi } from '../../api/email.api';
import type { Email } from '../../api/email.api';
import DOMPurify from 'dompurify';

interface EntityEmailsTabProps {
  entityType: string;
  entityId: string;
  entityEmail?: string;
}

export function EntityEmailsTab({ entityType, entityId, entityEmail }: EntityEmailsTabProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedBody, setExpandedBody] = useState<Email | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    emailApi
      .getEntityEmails(entityType, entityId)
      .then((data) => {
        if (!cancelled) setEmails(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const handleExpand = async (email: Email) => {
    if (expandedId === email.id) {
      setExpandedId(null);
      setExpandedBody(null);
      return;
    }
    setExpandedId(email.id);
    try {
      const full = await emailApi.getEmailById(email.id);
      setExpandedBody(full);
    } catch {
      setExpandedBody(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No emails linked to this record</p>
        {entityEmail && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Emails to/from {entityEmail} will be auto-linked
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {emails.length} email{emails.length !== 1 ? 's' : ''} linked
        </p>
      </div>

      {emails.map((email) => (
        <div key={email.id} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {/* Row */}
          <button
            onClick={() => handleExpand(email)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left"
          >
            <div className="flex-shrink-0">
              {email.direction === 'inbound' ? (
                <Inbox className="w-4 h-4 text-blue-500" />
              ) : (
                <Send className="w-4 h-4 text-green-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                  {email.subject || '(no subject)'}
                </span>
                {email.hasAttachments && <Paperclip className="w-3 h-3 text-gray-400 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span>
                  {email.direction === 'inbound' ? 'From' : 'To'}:{' '}
                  {email.direction === 'inbound'
                    ? email.fromName || email.fromEmail
                    : email.toEmails?.[0]?.email || ''}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span>{formatDate(email.sentAt || email.receivedAt)}</span>
                {email.opensCount > 0 && (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <Eye className="w-3 h-3" /> {email.opensCount}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {expandedId === email.id ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {/* Expanded body */}
          {expandedId === email.id && (
            <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 bg-gray-50 dark:bg-slate-800/50">
              {!expandedBody ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : expandedBody.bodyHtml ? (
                <div
                  className="prose dark:prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(expandedBody.bodyHtml),
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                  {expandedBody.bodyText || expandedBody.snippet}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
