// ============================================================
// FILE: apps/web/src/features/leads/components/StageJourneyBar.tsx
// ============================================================
// When user clicks a stage, this component:
// 1. Fetches required fields for the target stage
// 2. Checks which are missing on the current lead
// 3. If any missing → shows a modal to collect them
// 4. Submits values via onStageChange(stageId, stageFields)
// ============================================================
import { useState } from 'react';
import {
  Check, Circle, Trophy, XCircle, Lock, ChevronRight,
  Loader2, AlertTriangle, X,
} from 'lucide-react';
import type { LeadStage, Lead } from '../../../api/leads.api';
import { leadSettingsApi } from '../../../api/leads.api';

interface StageField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  isRequired: boolean;
  sortOrder: number;
}

interface StageJourneyBarProps {
  lead: Lead;
  stages: LeadStage[];
  stageSettings: Record<string, any>;
  onStageChange: (stageId: string, stageFields?: Record<string, any>, unlockReason?: string) => Promise<void>;
  onConvert: () => void;
  onDisqualify: () => void;
  disabled?: boolean;
}

// Get lead value for a fieldKey (supports nested paths)
function getLeadValue(lead: Lead, fieldKey: string): any {
  if (fieldKey.startsWith('qualification.')) {
    const qKey = fieldKey.replace('qualification.', '');
    return (lead.qualification as Record<string, any>)?.[qKey];
  }
  if (fieldKey.startsWith('custom.')) {
    const cKey = fieldKey.replace('custom.', '');
    return (lead.customFields as Record<string, any>)?.[cKey];
  }
  return (lead as any)[fieldKey];
}

function isEmpty(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

export function StageJourneyBar({
  lead, stages, stageSettings, onStageChange, onConvert, onDisqualify, disabled,
}: StageJourneyBarProps) {
  const [changingStage, setChangingStage] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  // Required fields modal state
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [pendingStageName, setPendingStageName] = useState('');
  const [missingFields, setMissingFields] = useState<StageField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingFields, setLoadingFields] = useState(false);

  // Separate pipeline stages from terminal stages
  const pipelineStages = stages.filter(s => !s.isWon && !s.isLost).sort((a, b) => a.sortOrder - b.sortOrder);
  const convertedStage = stages.find(s => s.isWon);
  const disqualifiedStage = stages.find(s => s.isLost);

  const currentStageIndex = pipelineStages.findIndex(s => s.id === lead.stageId);
  const isConverted = !!lead.convertedAt;
  const isDisqualified = !!lead.disqualifiedAt;
  const isTerminal = isConverted || isDisqualified;

  // ── Main stage click handler ──
  const handleStageClick = async (stage: LeadStage, index: number) => {
    if (disabled || changingStage || loadingFields || isTerminal) return;
    if (stage.id === lead.stageId) return;

    // Check backward movement lock
    if (index < currentStageIndex && stageSettings?.lockPreviousStages) {
      if (stageSettings?.requireUnlockReason) {
        setShowUnlockModal(stage.id);
        return;
      }
    }

    // ── Fetch required fields for the TARGET stage ──
    setLoadingFields(true);
    try {
      const stageFields: StageField[] = await leadSettingsApi.getStageFields(stage.id);
      const requiredFields = (Array.isArray(stageFields) ? stageFields : []).filter(f => f.isRequired);

      if (requiredFields.length === 0) {
        // No required fields → move directly
        await proceedStageChange(stage.id);
        return;
      }

      // Check which required fields are missing on the current lead
      const missing = requiredFields.filter(f => isEmpty(getLeadValue(lead, f.fieldKey)));

      if (missing.length === 0) {
        // All filled → move directly
        await proceedStageChange(stage.id);
        return;
      }

      // Show modal to collect missing fields
      setPendingStageId(stage.id);
      setPendingStageName(stage.name);
      setMissingFields(missing);
      setFieldValues({});
      setFieldErrors({});
      setShowFieldsModal(true);
    } catch (err) {
      console.error('Failed to fetch stage fields:', err);
      // Graceful degradation — allow move if fetch fails
      await proceedStageChange(stage.id);
    } finally {
      setLoadingFields(false);
    }
  };

  // Direct stage change (no modal needed)
  const proceedStageChange = async (stageId: string, stageFields?: Record<string, any>) => {
    setChangingStage(true);
    try {
      await onStageChange(stageId, stageFields);
    } catch (error) {
      // handled by parent
    } finally {
      setChangingStage(false);
    }
  };

  // Submit collected field values from modal
  const handleFieldsSubmit = async () => {
    if (!pendingStageId) return;

    const errors: Record<string, string> = {};
    missingFields.forEach(f => {
      if (isEmpty(fieldValues[f.fieldKey])) {
        errors[f.fieldKey] = `${f.fieldLabel} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setChangingStage(true);
    try {
      await onStageChange(pendingStageId, fieldValues);
      closeFieldsModal();
    } catch (error) {
      // handled by parent
    } finally {
      setChangingStage(false);
    }
  };

  const closeFieldsModal = () => {
    setShowFieldsModal(false);
    setPendingStageId(null);
    setMissingFields([]);
    setFieldValues({});
    setFieldErrors({});
  };

  const handleUnlockSubmit = async () => {
    if (!showUnlockModal || !unlockReason.trim()) return;
    setChangingStage(true);
    try {
      await onStageChange(showUnlockModal, undefined, unlockReason);
      setShowUnlockModal(null);
      setUnlockReason('');
    } catch (error) {
      // handled by parent
    } finally {
      setChangingStage(false);
    }
  };

  const getStageState = (_stage: LeadStage, index: number): 'completed' | 'current' | 'upcoming' | 'terminal' => {
    if (isConverted && convertedStage?.id === lead.stageId) return 'terminal';
    if (isDisqualified && disqualifiedStage?.id === lead.stageId) return 'terminal';
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) return 'current';
    return 'upcoming';
  };

  const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <>
      <div className="bg-gray-100/80 dark:bg-slate-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {/* Pipeline Stages */}
          {pipelineStages.map((stage, index) => {
            const state = getStageState(stage, index);
            const isClickable = !isTerminal && !disabled && !changingStage && !loadingFields && stage.id !== lead.stageId;
            const isBackward = index < currentStageIndex;
            const isLocked = isBackward && stageSettings?.lockPreviousStages;

            return (
              <div key={stage.id} className="flex items-center flex-shrink-0">
                {index > 0 && (
                  <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 mx-0.5 flex-shrink-0" />
                )}
                <button
                  onClick={() => handleStageClick(stage, index)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                    state === 'current'
                      ? 'border-transparent'
                      : state === 'completed'
                      ? 'border-transparent opacity-90'
                      : 'border-gray-300 dark:border-gray-600 opacity-70'
                  } ${isClickable ? 'cursor-pointer hover:opacity-100 hover:shadow-sm' : 'cursor-default'}`}
                  style={{
                    backgroundColor: state === 'current' ? stage.color : state === 'completed' ? `${stage.color}30` : '#e5e7eb',
                    color: state === 'current' ? '#fff' : state === 'completed' ? stage.color : '#6b7280',
                    boxShadow: state === 'current' ? `0 0 0 2px white, 0 0 0 4px ${stage.color}` : 'none',
                  }}
                  title={isLocked ? 'Stage locked — click to unlock' : stage.name}
                >
                  {state === 'completed' ? (
                    <Check size={12} />
                  ) : state === 'current' ? (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ) : isLocked ? (
                    <Lock size={10} />
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
          {!isConverted && !isDisqualified && (
            <>
              <button
                onClick={onConvert}
                disabled={disabled || changingStage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-700 hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors whitespace-nowrap"
              >
                <Trophy size={12} />
                Convert
              </button>
              <button
                onClick={onDisqualify}
                disabled={disabled || changingStage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors whitespace-nowrap"
              >
                <XCircle size={12} />
                Disqualify
              </button>
            </>
          )}

          {/* Terminal status badges */}
          {isConverted && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-600 text-white">
              <Trophy size={12} />
              Converted
            </div>
          )}
          {isDisqualified && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white">
              <XCircle size={12} />
              Disqualified
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {(changingStage || loadingFields) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            {loadingFields ? 'Checking requirements...' : 'Updating stage...'}
          </div>
        )}
      </div>

      {/* ── REQUIRED FIELDS MODAL ── */}
      {showFieldsModal && pendingStageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeFieldsModal} />

          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: 'min(520px, 80vh)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Required for "{pendingStageName}"
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Fill in missing fields to move this lead
                </p>
              </div>
              <button onClick={closeFieldsModal} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {missingFields.length} required field{missingFields.length !== 1 ? 's' : ''} must be filled
                </p>
              </div>

              {missingFields
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <div key={field.fieldKey}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {field.fieldLabel} <span className="text-red-500">*</span>
                    </label>
                    {field.fieldType === 'textarea' ? (
                      <textarea
                        value={fieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        rows={2}
                        className={`${inputClass} ${fieldErrors[field.fieldKey] ? 'border-red-500 focus:ring-red-500' : ''}`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    ) : field.fieldType === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldValues[field.fieldKey] || false}
                          onChange={(e) => {
                            setFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.checked }));
                            setFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-slate-300">{field.fieldLabel}</span>
                      </label>
                    ) : (
                      <input
                        type={
                          field.fieldType === 'email' ? 'email' :
                          field.fieldType === 'number' ? 'number' :
                          field.fieldType === 'date' ? 'date' :
                          field.fieldType === 'phone' ? 'tel' :
                          field.fieldType === 'url' ? 'url' : 'text'
                        }
                        value={fieldValues[field.fieldKey] || ''}
                        onChange={(e) => {
                          setFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
                          setFieldErrors(prev => { const n = { ...prev }; delete n[field.fieldKey]; return n; });
                        }}
                        className={`${inputClass} ${fieldErrors[field.fieldKey] ? 'border-red-500 focus:ring-red-500' : ''}`}
                        placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                      />
                    )}
                    {fieldErrors[field.fieldKey] && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors[field.fieldKey]}</p>
                    )}
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 rounded-b-2xl flex-shrink-0">
              <button onClick={closeFieldsModal} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleFieldsSubmit}
                disabled={changingStage}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {changingStage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {changingStage ? 'Moving...' : `Move to ${pendingStageName}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNLOCK REASON MODAL (existing) ── */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Unlock Previous Stage
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Moving back to a previous stage requires a reason for audit tracking.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Reason for moving back (required)"
              rows={3}
              className={inputClass}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowUnlockModal(null); setUnlockReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlockSubmit}
                disabled={!unlockReason.trim() || changingStage}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {changingStage ? 'Updating...' : 'Unlock & Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}