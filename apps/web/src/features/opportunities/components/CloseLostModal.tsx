// ============================================================
// FILE: apps/web/src/features/opportunities/components/CloseLostModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { X, XCircle, Loader2 } from 'lucide-react';
import { opportunitiesApi, opportunitySettingsApi } from '../../../api/opportunities.api';
import type { OpportunityCloseReason } from '../../../api/opportunities.api';

interface CloseLostModalProps {
  opportunityId: string;
  onClose: () => void;
  onClosed: () => void;
}

export function CloseLostModal({ opportunityId, onClose, onClosed }: CloseLostModalProps) {
  const [reasons, setReasons] = useState<OpportunityCloseReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeNotes, setCloseNotes] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpMonths, setFollowUpMonths] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    opportunitySettingsApi.getLostReasons()
      .then((data) => {
        setReasons(data);
        if (data.length > 0) setSelectedReasonId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!selectedReasonId) {
      setError('Please select a loss reason');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await opportunitiesApi.closeLost(opportunityId, {
        closeDate,
        closeReasonId: selectedReasonId,
        closeNotes: closeNotes || undefined,
        competitor: competitor || undefined,
        createFollowUpTask: createFollowUp,
        followUpMonths: createFollowUp ? followUpMonths : undefined,
      });
      onClosed();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to close opportunity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            Close Lost
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Loss Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReasonId}
              onChange={(e) => setSelectedReasonId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">Select reason...</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Close Date</label>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Competitor Who Won</label>
            <input
              type="text"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Who won the deal?"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              rows={2}
              placeholder="Why did we lose?"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createFollowUp}
              onChange={(e) => setCreateFollowUp(e.target.checked)}
              className="text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Create follow-up task</span>
          </label>
          {createFollowUp && (
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Follow up in (months)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={followUpMonths}
                onChange={(e) => setFollowUpMonths(Number(e.target.value))}
                className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedReasonId}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Mark as Lost
          </button>
        </div>
      </div>
    </div>
  );
}