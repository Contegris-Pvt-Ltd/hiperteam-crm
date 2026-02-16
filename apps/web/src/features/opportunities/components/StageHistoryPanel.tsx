// ============================================================
// FILE: apps/web/src/features/opportunities/components/StageHistoryPanel.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { opportunitiesApi } from '../../../api/opportunities.api';
import type { StageHistoryEntry } from '../../../api/opportunities.api';

interface StageHistoryPanelProps {
  opportunityId: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function StageHistoryPanel({ opportunityId }: StageHistoryPanelProps) {
  const [history, setHistory] = useState<StageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    opportunitiesApi.getStageHistory(opportunityId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [opportunityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (history.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No stage changes recorded yet</p>;
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div
              className="w-3 h-3 rounded-full border-2 flex-shrink-0"
              style={{
                borderColor: entry.toStageColor || '#9CA3AF',
                backgroundColor: idx === 0 ? (entry.toStageColor || '#9CA3AF') : 'transparent',
              }}
            />
            {idx < history.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 min-h-[32px]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {entry.fromStageName ? (
                <>
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${entry.fromStageColor || '#9CA3AF'}18`, color: entry.fromStageColor || '#9CA3AF' }}
                  >
                    {entry.fromStageName}
                  </span>
                  <ArrowRight size={12} className="text-gray-400" />
                </>
              ) : null}
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                style={{ backgroundColor: `${entry.toStageColor || '#9CA3AF'}18`, color: entry.toStageColor || '#9CA3AF' }}
              >
                {entry.toStageName}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>
                {new Date(entry.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span>by {entry.changedByFirstName} {entry.changedByLastName}</span>
              {entry.timeInStage !== null && entry.timeInStage > 0 && (
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock size={10} /> {formatDuration(entry.timeInStage)}
                </span>
              )}
            </div>

            {entry.reason && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{entry.reason}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}