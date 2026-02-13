// ============================================================
// FILE: apps/web/src/features/leads/components/DisqualifyModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { X, XCircle, Loader2 } from 'lucide-react';
import { leadsApi, leadSettingsApi } from '../../../api/leads.api';

interface DisqualifyModalProps {
  leadId: string;
  onClose: () => void;
  onDisqualified: () => void;
}

export function DisqualifyModal({ leadId, onClose, onDisqualified }: DisqualifyModalProps) {
  const [reasons, setReasons] = useState<{ id: string; name: string }[]>([]);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    leadSettingsApi.getDisqualificationReasons()
      .then((data) => {
        setReasons(data);
        if (data.length > 0) setSelectedReasonId(data[0].id);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!selectedReasonId) return;
    setLoading(true);
    setError('');
    try {
      await leadsApi.disqualify(leadId, selectedReasonId, notes || undefined);
      onDisqualified();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disqualify lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            Disqualify Lead
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReasonId}
              onChange={(e) => setSelectedReasonId(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes about disqualification..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReasonId || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            {loading ? 'Disqualifying...' : 'Disqualify'}
          </button>
        </div>
      </div>
    </div>
  );
}
