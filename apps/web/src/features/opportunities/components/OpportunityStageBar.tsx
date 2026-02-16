// ============================================================
// FILE: apps/web/src/features/opportunities/components/OpportunityStageBar.tsx
// ============================================================
import { useState } from 'react';
import {
  Check, Circle, Trophy, XCircle, RotateCcw,
} from 'lucide-react';
import type { OpportunityStage } from '../../../api/opportunities.api';

interface OpportunityStageBarProps {
  stages: OpportunityStage[];
  currentStageId: string | null;
  isWon: boolean;
  isLost: boolean;
  disabled?: boolean;
  onStageChange: (stageId: string) => Promise<void>;
  onCloseWon: () => void;
  onCloseLost: () => void;
  onReopen?: () => void;
}

export function OpportunityStageBar({
  stages, currentStageId, isWon, isLost,
  disabled, onStageChange, onCloseWon, onCloseLost, onReopen,
}: OpportunityStageBarProps) {
  const [changingStage, setChangingStage] = useState(false);

  // Separate open stages from terminal stages
  const openStages = stages
    .filter(s => !s.isWon && !s.isLost)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const currentIdx = openStages.findIndex(s => s.id === currentStageId);
  const isClosed = isWon || isLost;

  const handleStageClick = async (stageId: string) => {
    if (disabled || changingStage || isClosed) return;
    if (stageId === currentStageId) return;

    setChangingStage(true);
    try {
      await onStageChange(stageId);
    } catch (err) {
      console.error('Stage change failed:', err);
    } finally {
      setChangingStage(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-3">
      <div className="flex items-center gap-1 overflow-x-auto px-1 py-1 -mx-0">
        {/* Open Stage Steps */}
        {openStages.map((stage, idx) => {
          let state: 'completed' | 'current' | 'upcoming' | 'locked' = 'upcoming';
          if (isClosed) {
            // If closed, show all stages as completed up to the last open stage
            state = 'completed';
          } else if (idx < currentIdx) {
            state = 'completed';
          } else if (idx === currentIdx) {
            state = 'current';
          }

          return (
            <div key={stage.id} className="flex items-center">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`h-0.5 w-4 sm:w-6 flex-shrink-0 transition-colors ${
                    state === 'completed' || state === 'current'
                      ? 'bg-blue-400'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}

              {/* Stage button */}
              <button
                onClick={() => handleStageClick(stage.id)}
                disabled={disabled || changingStage || isClosed}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  state === 'current'
                    ? 'text-white'
                    : state === 'completed'
                      ? 'text-white hover:opacity-80'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                } ${disabled || isClosed ? 'cursor-default' : 'cursor-pointer'}`}
                style={{
                  backgroundColor: state === 'current' || state === 'completed' ? stage.color : 'transparent',
                  color: state === 'current' ? '#fff' : state === 'completed' ? stage.color : '#6b7280',
                  outline: state === 'current' ? `2px solid ${stage.color}` : 'none',
                  outlineOffset: '2px',
                }}
                title={stage.name}
              >
                {state === 'completed' ? (
                  <Check size={12} />
                ) : state === 'current' ? (
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ) : (
                  <Circle size={10} />
                )}
                {stage.name}
              </button>
            </div>
          );
        })}

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2 flex-shrink-0" />

        {/* Terminal Stage Buttons */}
        {!isClosed && (
          <>
            <button
              onClick={onCloseWon}
              disabled={disabled || changingStage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors whitespace-nowrap"
            >
              <Trophy size={12} />
              Close Won
            </button>
            <button
              onClick={onCloseLost}
              disabled={disabled || changingStage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors whitespace-nowrap"
            >
              <XCircle size={12} />
              Close Lost
            </button>
          </>
        )}

        {/* Terminal status badges */}
        {isWon && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-600 text-white">
            <Trophy size={12} />
            Won
          </div>
        )}
        {isLost && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white">
            <XCircle size={12} />
            Lost
          </div>
        )}

        {/* Reopen button (only for closed deals) */}
        {isClosed && onReopen && (
          <button
            onClick={onReopen}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap ml-1"
          >
            <RotateCcw size={12} />
            Reopen
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {changingStage && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Changing stage...
        </div>
      )}
    </div>
  );
}