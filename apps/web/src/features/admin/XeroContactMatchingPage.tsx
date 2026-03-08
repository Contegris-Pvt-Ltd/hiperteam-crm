import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle, XCircle, Link2,
  AlertTriangle, RefreshCw, ArrowRight, Building2, User,
  ChevronDown, ChevronRight, Undo2, ArrowLeft,
} from 'lucide-react';
import { api } from '../../api/contacts.api';

// ============================================================
// TYPES
// ============================================================

interface SyncSuggestion {
  crmType: 'account' | 'contact';
  crmId: string;
  crmName: string;
  crmEmail: string | null;
  xeroContactId: string;
  xeroName: string;
  xeroEmail: string | null;
  matchScore: number;
}

interface SyncResult {
  matched: number;
  created: number;
  unmatched: number;
  suggestions: SyncSuggestion[];
}

// ============================================================
// HELPERS
// ============================================================

function scoreBadge(score: number) {
  if (score >= 90)
    return { label: 'Auto', bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (score >= 70)
    return { label: 'Good', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  if (score >= 50)
    return { label: 'Possible', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'Weak', bg: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400' };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function XeroContactMatchingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [showLinked, setShowLinked] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  // ── Load on mount ─────────────────────────────────────────
  useEffect(() => {
    runSync();
  }, []);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/xero/sync-contacts');
      setResult(data);
    } catch {
      setError('Failed to sync with Xero. Check your connection settings.');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  const handleLink = async (suggestion: SyncSuggestion) => {
    setLinking(suggestion.crmId);
    try {
      await api.post('/admin/xero/link-contact', {
        crmType: suggestion.crmType,
        crmId: suggestion.crmId,
        xeroContactId: suggestion.xeroContactId,
      });
      setLinked((prev) => new Set([...prev, suggestion.crmId]));
    } catch {
      // Inline error — ignore for now
    } finally {
      setLinking(null);
    }
  };

  const handleSkip = (crmId: string) => {
    setSkipped((prev) => new Set([...prev, crmId]));
  };

  const handleUndoSkip = (crmId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(crmId);
      return next;
    });
  };

  // ── Derived ──────────────────────────────────────────────
  const pendingSuggestions = result?.suggestions.filter(
    (s) => !linked.has(s.crmId) && !skipped.has(s.crmId),
  ) || [];
  const linkedSuggestions = result?.suggestions.filter((s) => linked.has(s.crmId)) || [];
  const skippedSuggestions = result?.suggestions.filter((s) => skipped.has(s.crmId)) || [];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/integrations')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Integrations
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Xero Contact Matching</h1>
              <p className="text-gray-600 dark:text-slate-400">Match your CRM records to Xero contacts to enable invoice syncing</p>
            </div>
          </div>
          <button
            onClick={runSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-sync
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-gray-500 dark:text-slate-400">Syncing with Xero...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Sync Failed</h3>
          <p className="text-gray-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={runSync}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Matched</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{result.matched}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">auto-linked</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Suggestions</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingSuggestions.length}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">need review</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Unmatched</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{result.unmatched}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">no match</p>
            </div>
          </div>

          {/* Suggestions List */}
          {pendingSuggestions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Review Suggested Matches</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">These records may match Xero contacts. Confirm or skip each one.</p>
              <div className="space-y-3">
                {pendingSuggestions.map((s) => {
                  const badge = scoreBadge(s.matchScore);
                  const isLinking = linking === s.crmId;
                  return (
                    <div
                      key={s.crmId}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4"
                    >
                      <div className="flex items-center gap-4">
                        {/* CRM Side */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {s.crmType === 'account'
                              ? <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              : <User className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                            <span className="font-medium text-gray-900 dark:text-white truncate">{s.crmName}</span>
                          </div>
                          {s.crmEmail && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 ml-6 truncate">{s.crmEmail}</p>
                          )}
                        </div>

                        {/* Score badge + arrow */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg}`}>
                            {s.matchScore}% {badge.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>

                        {/* Xero Side */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{s.xeroName}</p>
                          {s.xeroEmail && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{s.xeroEmail}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleSkip(s.crmId)}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg transition-colors"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => handleLink(s)}
                            disabled={isLinking}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Link
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Section */}
          {linkedSuggestions.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowLinked(!showLinked)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-3"
              >
                {showLinked ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Linked ({linkedSuggestions.length})
              </button>
              {showLinked && (
                <div className="space-y-2">
                  {linkedSuggestions.map((s) => (
                    <div
                      key={s.crmId}
                      className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-900/30"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {s.crmType === 'account'
                          ? <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          : <User className="w-3.5 h-3.5 text-purple-500" />}
                        <span className="text-sm text-gray-900 dark:text-white truncate">{s.crmName}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-slate-400 truncate">{s.xeroName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Skipped Section */}
          {skippedSuggestions.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowSkipped(!showSkipped)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 mb-3"
              >
                {showSkipped ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Skipped ({skippedSuggestions.length})
              </button>
              {showSkipped && (
                <div className="space-y-2">
                  {skippedSuggestions.map((s) => (
                    <div
                      key={s.crmId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {s.crmType === 'account'
                          ? <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          : <User className="w-3.5 h-3.5 text-purple-500" />}
                        <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{s.crmName}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-500 dark:text-slate-400 truncate">{s.xeroName}</span>
                      </div>
                      <button
                        onClick={() => handleUndoSkip(s.crmId)}
                        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex-shrink-0"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unmatched Section */}
          {result.unmatched > 0 && (
            <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Unmatched Records ({result.unmatched})</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                These CRM records have no Xero contact. A new contact will be created in Xero when you push their first invoice.
              </p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={() => navigate('/admin/integrations')}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Integrations
            </button>
            <button
              onClick={() => navigate('/admin/integrations')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors"
            >
              Done — {linked.size} contact{linked.size !== 1 ? 's' : ''} linked
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
