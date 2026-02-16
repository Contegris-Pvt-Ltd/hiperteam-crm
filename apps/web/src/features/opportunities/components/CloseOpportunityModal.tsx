// ============================================================
// FILE: apps/web/src/features/opportunities/components/CloseOpportunityModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { Trophy, XCircle, Loader2 } from 'lucide-react';
import type { OpportunityCloseReason } from '../../../api/opportunities.api';
import { opportunitySettingsApi } from '../../../api/opportunities.api';

interface CloseOpportunityModalProps {
  isOpen: boolean;
  type: 'won' | 'lost';
  currentAmount?: number | null;
  onClose: () => void;
  onSubmit: (data: {
    closeReasonId: string;
    closeNotes?: string;
    finalAmount?: number;
    competitor?: string;
    createFollowUpTask?: boolean;
    followUpMonths?: number;
  }) => Promise<void>;
}

export function CloseOpportunityModal({
  isOpen, type, currentAmount, onClose, onSubmit,
}: CloseOpportunityModalProps) {
  const [reasons, setReasons] = useState<OpportunityCloseReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [closeReasonId, setCloseReasonId] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [finalAmount, setFinalAmount] = useState<string>(currentAmount?.toString() || '');
  const [competitor, setCompetitor] = useState('');
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpMonths, setFollowUpMonths] = useState(3);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    opportunitySettingsApi.getCloseReasons()
      .then((all) => all.filter(r => r.type === type))
      .then(data => {
        setReasons(data.filter(r => r.isActive));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Reset form
    setCloseReasonId('');
    setCloseNotes('');
    setFinalAmount(currentAmount?.toString() || '');
    setCompetitor('');
    setCreateFollowUp(false);
    setFollowUpMonths(3);
    setError('');
  }, [isOpen, type]);

  const handleSubmit = async () => {
    if (!closeReasonId) {
      setError('Please select a reason');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        closeReasonId,
        closeNotes: closeNotes || undefined,
        finalAmount: finalAmount ? parseFloat(finalAmount) : undefined,
        competitor: competitor || undefined,
        createFollowUpTask: createFollowUp || undefined,
        followUpMonths: createFollowUp ? followUpMonths : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to close opportunity');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isWon = type === 'won';
  const inputClass = 'w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isWon ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {isWon
              ? <Trophy className="text-green-600" size={20} />
              : <XCircle className="text-red-600" size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isWon ? 'Close as Won' : 'Close as Lost'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isWon ? 'Congratulations! Record the win details.' : 'Record why this deal was lost.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reason */}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">
                Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={closeReasonId}
                onChange={(e) => setCloseReasonId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a reason...</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Final Amount (Won only) */}
            {isWon && (
              <div>
                <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">
                  Final Amount
                </label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  placeholder="Final deal amount"
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to keep current amount</p>
              </div>
            )}

            {/* Competitor */}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">
                {isWon ? 'Competitor (if any)' : 'Competitor / Alternative Chosen'}
              </label>
              <input
                type="text"
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
                placeholder="Competitor name"
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-gray-600 dark:text-slate-400 mb-1 block">Notes</label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
                placeholder={isWon ? 'What made us win this deal?' : 'Why did we lose? Any lessons learned?'}
                className={inputClass}
              />
            </div>

            {/* Follow-up task */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={createFollowUp}
                onChange={(e) => setCreateFollowUp(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label className="text-sm text-gray-700 dark:text-gray-200">
                  {isWon ? 'Create follow-up task' : 'Create re-engagement task'}
                </label>
                {createFollowUp && !isWon && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Follow up in</span>
                    <select
                      value={followUpMonths}
                      onChange={(e) => setFollowUpMonths(parseInt(e.target.value))}
                      className="px-2 py-1 border border-gray-200 dark:border-slate-700 rounded text-sm bg-white dark:bg-slate-800"
                    >
                      {[1, 2, 3, 6, 9, 12].map(m => (
                        <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className={`px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2 ${
              isWon ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isWon ? 'Mark as Won' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  );
}