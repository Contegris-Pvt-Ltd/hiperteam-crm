// ============================================================
// FILE: apps/web/src/features/leads/components/KanbanBoard.tsx
// ============================================================
import { useState, useRef } from 'react';
import { Building2, GripVertical } from 'lucide-react';
import type { KanbanStageData, Lead } from '../../../api/leads.api';

interface KanbanBoardProps {
  stages: KanbanStageData[];
  loading: boolean;
  onStageDrop: (leadId: string, newStageId: string) => void;
  onLeadClick: (id: string) => void;
  getPriorityIcon: (priority: Lead['priority']) => React.ReactNode;
  getScoreColor: (score: number) => string;
}

export function KanbanBoard({
  stages, loading, onStageDrop, onLeadClick, getPriorityIcon, getScoreColor,
}: KanbanBoardProps) {
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>No stages configured. Go to Settings → Leads → Stages to set up your pipeline.</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggingLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) {
      onStageDrop(leadId, stageId);
    }
    setDraggingLeadId(null);
    setDragOverStageId(null);
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDragOverStageId(null);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]"
      style={{ scrollBehavior: 'smooth' }}
    >
      {stages.map((stage) => (
        <div
          key={stage.id}
          onDragOver={(e) => handleDragOver(e, stage.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.id)}
          className={`flex-shrink-0 w-72 flex flex-col bg-gray-50 dark:bg-slate-900 border rounded-lg transition-all ${
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
          </div>

          {/* Lead Cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
            {stage.leads.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {dragOverStageId === stage.id ? 'Drop here' : 'No leads'}
              </div>
            ) : (
              stage.leads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onLeadClick(lead.id)}
                  className={`bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all group ${
                    draggingLeadId === lead.id ? 'opacity-50 scale-95' : ''
                  }`}
                >
                  {/* Drag handle + Name */}
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className="text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
                      </p>
                      {lead.company && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Building2 size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 truncate">{lead.company}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: priority + score + owner */}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2">
                      {/* Priority */}
                      {lead.priority && (
                        <div className="flex items-center gap-0.5">
                          {getPriorityIcon(lead.priority)}
                        </div>
                      )}
                      {/* Score */}
                      <div className="flex items-center gap-1">
                        <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getScoreColor(lead.score)}`}
                            style={{ width: `${Math.min(100, lead.score)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-gray-500">{lead.score}</span>
                      </div>
                    </div>

                    {/* Owner avatar */}
                    {lead.owner && (
                      <div
                        className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-500"
                        title={`${lead.owner.firstName} ${lead.owner.lastName}`}
                      >
                        {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
