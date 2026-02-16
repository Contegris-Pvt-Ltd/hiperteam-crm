// ============================================================
// FILE: apps/web/src/features/opportunities/components/ReopenModal.tsx
// ============================================================
import { useState } from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import { opportunitiesApi } from '../../../api/opportunities.api';
import type { OpportunityStage } from '../../../api/opportunities.api';

interface ReopenModalProps {
  opportunityId: string;
  stages: OpportunityStage[];
  onClose: () => void;
  onReopened: () => void;
}

export function ReopenModal({ opportunityId, stages, onClose, onReopened }: ReopenModalProps) {
  const openStages = stages.filter(s => !s.isWon && !s.isLost && s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const [selectedStageId, setSelectedStageId] = useState(openStages[0]?.id || '');
  const [reason, setReason] = useState('');
  const [probability, setProbability] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!selectedStageId) {
      setError('Please select a stage');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for reopening');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await opportunitiesApi.reopen(opportunityId, {
        stageId: selectedStageId,
        reason: reason.trim(),
        probability: probability ? Number(probability) : undefined,
      });
      onReopened();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reopen opportunity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <RotateCcw size={18} className="text-blue-500" />
            Reopen Opportunity
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Move to Stage <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              {openStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Reason for Reopening <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this opportunity being reopened?"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">New Probability (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              placeholder="Leave empty to use stage default"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedStageId || !reason.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Reopen
          </button>
        </div>
      </div>
    </div>
  );
}