// ============================================================
// FILE: apps/web/src/features/opportunities/components/CloseWonModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { X, Trophy, Loader2 } from 'lucide-react';
import { opportunitiesApi, opportunitySettingsApi } from '../../../api/opportunities.api';
import type { OpportunityCloseReason } from '../../../api/opportunities.api';

interface CloseWonModalProps {
  opportunityId: string;
  currentAmount: number | null;
  onClose: () => void;
  onClosed: () => void;
}

export function CloseWonModal({ opportunityId, currentAmount, onClose, onClosed }: CloseWonModalProps) {
  const [reasons, setReasons] = useState<OpportunityCloseReason[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [finalAmount, setFinalAmount] = useState<string>(currentAmount?.toString() || '');
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeNotes, setCloseNotes] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('Onboarding kickoff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    opportunitySettingsApi.getWonReasons()
      .then((data) => {
        setReasons(data);
        if (data.length > 0) setSelectedReasonId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!selectedReasonId) {
      setError('Please select a win reason');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await opportunitiesApi.closeWon(opportunityId, {
        closeDate,
        finalAmount: finalAmount ? Number(finalAmount) : undefined,
        closeReasonId: selectedReasonId,
        closeNotes: closeNotes || undefined,
        competitor: competitor || undefined,
        createFollowUpTask: createFollowUp,
        followUpTaskTitle: createFollowUp ? followUpTitle : undefined,
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
            <Trophy size={18} className="text-emerald-500" />
            Close Won
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
              Win Reason <span className="text-red-500">*</span>
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Final Amount</label>
            <input
              type="number"
              value={finalAmount}
              onChange={(e) => setFinalAmount(e.target.value)}
              placeholder="Final deal value"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Competitor</label>
            <input
              type="text"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="Who did we beat?"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              rows={2}
              placeholder="Win notes..."
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
            <input
              type="text"
              value={followUpTitle}
              onChange={(e) => setFollowUpTitle(e.target.value)}
              placeholder="Task title"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedReasonId}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Mark as Won
          </button>
        </div>
      </div>
    </div>
  );
}