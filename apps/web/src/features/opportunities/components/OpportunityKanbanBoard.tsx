// ============================================================
// FILE: apps/web/src/features/opportunities/components/OpportunityKanbanBoard.tsx
// ============================================================
import { useState, type DragEvent, type ReactNode } from 'react';
import { DollarSign, Calendar, Building2, Loader2 } from 'lucide-react';
import type { KanbanStageData, OpportunityPriority } from '../../../api/opportunities.api';

interface OpportunityKanbanBoardProps {
  stages: KanbanStageData[];
  loading: boolean;
  onStageDrop: (oppId: string, newStageId: string) => Promise<void>;
  onOppClick: (id: string) => void;
  getPriorityIcon: (priority: OpportunityPriority | null) => ReactNode;
  formatCurrency: (amount: number | null) => string;
}

export function OpportunityKanbanBoard({
  stages, loading, onStageDrop, onOppClick, getPriorityIcon, formatCurrency,
}: OpportunityKanbanBoardProps) {
  const [draggingOppId, setDraggingOppId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const handleDragStart = (e: DragEvent, oppId: string) => {
    e.dataTransfer.setData('text/plain', oppId);
    setDraggingOppId(oppId);
  };

  const handleDragEnd = () => {
    setDraggingOppId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: DragEvent, stageId: string) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('text/plain');
    setDragOverStageId(null);
    setDraggingOppId(null);
    if (oppId) {
      await onStageDrop(oppId, stageId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {sorted.map((stage) => (
        <div
          key={stage.id}
          onDragOver={(e) => handleDragOver(e, stage.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.id)}
          className={`flex flex-col w-72 min-w-[288px] bg-gray-50 dark:bg-slate-900 border rounded-lg transition-all ${
            dragOverStageId === stage.id
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10 ring-2 ring-blue-400/30'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          {/* Column Header */}
          <div
            className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 rounded-t-lg"
            style={{ borderTopColor: stage.color, borderTopWidth: '3px' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {stage.name}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full">
                {stage.count}
              </span>
            </div>
            {/* Stage totals */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {formatCurrency(stage.totalAmount)}
              </span>
              {stage.weightedAmount !== stage.totalAmount && (
                <span className="text-xs text-gray-400">
                  (Wtd: {formatCurrency(stage.weightedAmount)})
                </span>
              )}
            </div>
          </div>

          {/* Opportunity Cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
            {stage.opportunities.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {dragOverStageId === stage.id ? 'Drop here' : 'No opportunities'}
              </div>
            ) : (
              stage.opportunities.map((opp) => {
                const isOverdue = opp.closeDate && !opp.wonAt && !opp.lostAt && new Date(opp.closeDate) < new Date();

                return (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, opp.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onOppClick(opp.id)}
                    className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all group ${
                      draggingOppId === opp.id ? 'opacity-50 scale-95' : ''
                    } ${isOverdue ? 'border-l-2 border-l-red-400' : ''}`}
                  >
                    {/* Name + Priority */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">
                        {opp.name}
                      </p>
                      {opp.priority && (
                        <div className="flex-shrink-0 mt-0.5">
                          {getPriorityIcon(opp.priority)}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    {opp.amount !== null && (
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                        <DollarSign size={13} />
                        {formatCurrency(opp.amount)}
                        {opp.probability !== null && (
                          <span className="text-xs text-gray-400 font-normal ml-1">
                            ({opp.probability}%)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Account */}
                    {opp.account && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <Building2 size={12} />
                        <span className="truncate">{opp.account.name}</span>
                      </div>
                    )}

                    {/* Close Date */}
                    {opp.closeDate && (
                      <div className={`flex items-center gap-1.5 text-xs ${
                        isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'
                      }`}>
                        <Calendar size={12} />
                        {new Date(opp.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {isOverdue && ' (overdue)'}
                      </div>
                    )}

                    {/* Owner */}
                    {opp.owner && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">
                          {(opp.owner.firstName?.[0] || '?').toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-400 truncate">
                          {opp.owner.firstName} {opp.owner.lastName?.[0]}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}