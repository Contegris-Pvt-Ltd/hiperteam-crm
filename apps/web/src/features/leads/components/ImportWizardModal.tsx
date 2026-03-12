import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Upload, Columns3, Settings, Eye, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { leadImportApi } from '../../../api/lead-import.api';
import type { UploadResult, LeadFieldOption, MappingTemplate } from '../../../api/lead-import.api';
import StepUpload from './import/StepUpload';
import StepMapping from './import/StepMapping';
import StepSettings from './import/StepSettings';
import StepPreview from './import/StepPreview';
import StepProgress from './import/StepProgress';

interface ImportWizardModalProps {
  onClose: () => void;
}

const STEPS = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'mapping', label: 'Map Columns', icon: Columns3 },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'progress', label: 'Import', icon: Loader2 },
];

export default function ImportWizardModal({ onClose }: ImportWizardModalProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [starting, setStarting] = useState(false);

  // Step 1 state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Step 2 state
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [leadFieldOptions, setLeadFieldOptions] = useState<LeadFieldOption[]>([]);
  const [matchingTemplates, setMatchingTemplates] = useState<MappingTemplate[]>([]);

  // Step 3 state
  const [importSettings, setImportSettings] = useState({
    duplicateStrategy: 'skip' as 'skip' | 'update' | 'import',
    assignmentStrategy: 'specific_user' as 'specific_user' | 'unassigned',
    ownerId: '',
    countryCode: 'PK',
    pipelineId: '',
    stageId: '',
    source: '',
    priorityId: '',
    teamId: '',
    tags: [] as string[],
  });

  // Step 5 state
  const [jobId, setJobId] = useState<string | null>(null);

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    setMapping(result.suggestedMapping);
    setLeadFieldOptions(result.leadFieldOptions);
    setMatchingTemplates(result.matchingTemplates);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0: return !!uploadResult;
      case 1: {
        const mappedValues = Object.values(mapping).filter(v => v && v !== '__skip__');
        const hasRequired = mappedValues.includes('lastName') || mappedValues.includes('email') || mappedValues.includes('phone');
        // Allow up to 3 columns per field (multi-column fallback), block if >3
        const counts: Record<string, number> = {};
        mappedValues.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        const hasOverLimit = Object.values(counts).some(c => c > 3);
        return hasRequired && !hasOverLimit;
      }
      case 2: {
        if (importSettings.assignmentStrategy === 'specific_user' && !importSettings.ownerId) return false;
        return true;
      }
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 3) {
      // Start import
      setStarting(true);
      try {
        const payload: Record<string, any> = {
          fileId: uploadResult!.fileId,
          columnMapping: mapping,
          ...importSettings,
        };
        // Strip empty strings from optional UUID fields
        ['ownerId', 'pipelineId', 'stageId', 'priorityId', 'teamId'].forEach(k => {
          if (!payload[k]) delete payload[k];
        });
        const job = await leadImportApi.startImport(payload as any);
        setJobId(job.id);
        setCurrentStep(4);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to start import');
      }
      setStarting(false);
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < 4) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Leads</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <Icon size={16} />
                      )}
                    </div>
                    <span className={`text-xs font-medium hidden sm:inline ${
                      isActive ? 'text-emerald-600' : isCompleted ? 'text-emerald-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      idx < currentStep ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 0 && (
            <StepUpload onUploadComplete={handleUploadComplete} />
          )}
          {currentStep === 1 && uploadResult && (
            <StepMapping
              headers={uploadResult.headers}
              mapping={mapping}
              leadFieldOptions={leadFieldOptions}
              matchingTemplates={matchingTemplates}
              onMappingChange={setMapping}
            />
          )}
          {currentStep === 2 && (
            <StepSettings
              settings={importSettings}
              onSettingsChange={setImportSettings}
            />
          )}
          {currentStep === 3 && uploadResult && (
            <StepPreview
              headers={uploadResult.headers}
              previewRows={uploadResult.previewRows}
              mapping={mapping}
              leadFieldOptions={leadFieldOptions}
              totalRows={uploadResult.totalRows}
            />
          )}
          {currentStep === 4 && jobId && (
            <StepProgress
              jobId={jobId}
              onClose={onClose}
              onViewLeads={() => { onClose(); navigate('/leads'); }}
            />
          )}
        </div>

        {/* Footer */}
        {currentStep < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed() || starting}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Starting...
                  </>
                ) : currentStep === 3 ? (
                  <>
                    Start Import
                    <ChevronRight size={16} />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
