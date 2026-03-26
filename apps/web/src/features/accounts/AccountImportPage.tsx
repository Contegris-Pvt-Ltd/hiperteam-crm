import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, AlertTriangle, XCircle, Loader2, Download,
  Building2, Users, CreditCard, X, Info,
  Save, BookmarkPlus, ChevronDown, Trash2,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { accountImportApi } from '../../api/account-import.api';
import { teamsApi } from '../../api/teams.api';
import { api } from '../../api/contacts.api';
import { COUNTRIES } from '../../data/countries';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────

interface SheetInfo {
  sheetName: string;
  name: string;
  headers: string[];
  totalRows: number;
  previewRows: Record<string, any>[];
  suggestedMapping: Record<string, string>;
}

interface UploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  sheetCount: number;
  sheets: SheetInfo[];
  sheetTypes: Record<string, string>;
  accountFieldOptions: FieldOption[];
  contactFieldOptions: FieldOption[];
  subscriptionFieldOptions: FieldOption[];
}

interface FieldOption {
  value: string;
  label: string;
  required?: boolean;
}

interface ImportSettings {
  duplicateStrategy: 'skip' | 'update' | 'import';
  defaultAccountType: 'B2B' | 'B2C';
  ownerId: string;
  teamId: string;
  countryCode: string;
}

interface ImportProgressEvent {
  jobId: string;
  status: string;
  phase: string;
  totalRecords: number;
  processedRecords: number;
  importedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  duplicateRecords: number;
  percentComplete: number;
  errorMessage?: string;
  phaseCounts?: {
    accounts: { total: number; processed: number; imported: number; failed: number };
    contacts: { total: number; processed: number; imported: number; failed: number };
    subscriptions: { total: number; processed: number; imported: number; failed: number };
  };
}

// ────────────────────────────────────────────────────────
// Step definitions
// ────────────────────────────────────────────────────────

const STEPS = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'map-accounts', label: 'Map Accounts', icon: Building2 },
  { key: 'map-contacts', label: 'Map Contacts', icon: Users },
  { key: 'map-subscriptions', label: 'Map Subscriptions', icon: CreditCard },
  { key: 'settings', label: 'Settings & Preview', icon: FileSpreadsheet },
  { key: 'progress', label: 'Import', icon: Loader2 },
];

// ────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────

export function AccountImportPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [starting, setStarting] = useState(false);

  // Step 1 state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Step 2-4 state (field mappings per sheet)
  const [accountMapping, setAccountMapping] = useState<Record<string, string>>({});
  const [contactMapping, setContactMapping] = useState<Record<string, string>>({});
  const [subscriptionMapping, setSubscriptionMapping] = useState<Record<string, string>>({});

  // Step 5 state
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    duplicateStrategy: 'skip',
    defaultAccountType: 'B2B',
    ownerId: '',
    teamId: '',
    countryCode: 'PK',
  });

  // Step 6 state
  const [jobId, setJobId] = useState<string | null>(null);

  // Mapping templates
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    accountImportApi.getTemplates().then(setTemplates).catch(() => {});
  }, []);

  const refreshTemplates = () => {
    accountImportApi.getTemplates().then(setTemplates).catch(() => {});
  };

  const handleLoadTemplate = (template: any) => {
    const cm = template.columnMapping || {};
    if (cm.accounts) setAccountMapping(cm.accounts);
    if (cm.contacts) setContactMapping(cm.contacts);
    if (cm.subscriptions) setSubscriptionMapping(cm.subscriptions);
  };

  const handleSaveTemplate = async (name: string) => {
    await accountImportApi.saveTemplate({
      name,
      columnMapping: {
        accounts: accountMapping,
        contacts: contactMapping,
        subscriptions: subscriptionMapping,
      },
      fileHeaders: [
        ...(accountsSheet?.headers || []),
        ...(contactsSheet?.headers || []),
        ...(subscriptionsSheet?.headers || []),
      ],
    });
    refreshTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    await accountImportApi.deleteTemplate(id);
    refreshTemplates();
  };

  // Helpers
  const getSheetByType = (type: string): SheetInfo | undefined => {
    if (!uploadResult?.sheetTypes) return undefined;
    const sheetName = Object.entries(uploadResult.sheetTypes).find(([, t]) => t === type)?.[0];
    if (!sheetName) return undefined;
    return uploadResult.sheets?.find(s => s.sheetName === sheetName);
  };

  const accountsSheet = getSheetByType('accounts');
  const contactsSheet = getSheetByType('contacts');
  const subscriptionsSheet = getSheetByType('subscriptions');

  const handleUploadComplete = (result: UploadResult) => {
    setUploadResult(result);
    const types = result.sheetTypes || {};
    const findSheet = (type: string) => {
      const sName = Object.entries(types).find(([, t]) => t === type)?.[0];
      return sName ? result.sheets?.find((s: SheetInfo) => s.sheetName === sName) : undefined;
    };
    setAccountMapping(findSheet('accounts')?.suggestedMapping || {});
    setContactMapping(findSheet('contacts')?.suggestedMapping || {});
    setSubscriptionMapping(findSheet('subscriptions')?.suggestedMapping || {});
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!uploadResult;
      case 1: {
        // Must have "Account Name" mapped
        const mapped = Object.values(accountMapping).filter(v => v && v !== '__skip__');
        return mapped.includes('accountName') || mapped.includes('name');
      }
      case 2: {
        // If no contacts sheet, can skip
        if (!contactsSheet) return true;
        const mapped = Object.values(contactMapping).filter(v => v && v !== '__skip__');
        return mapped.includes('accountName');
      }
      case 3: {
        // If no subscriptions sheet, can skip
        if (!subscriptionsSheet) return true;
        const mapped = Object.values(subscriptionMapping).filter(v => v && v !== '__skip__');
        return mapped.includes('accountName') && mapped.includes('productName');
      }
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 4) {
      // Start import
      setStarting(true);
      try {
        const payload: Record<string, any> = {
          fileId: uploadResult!.fileId,
          accountMapping,
          contactMapping: contactsSheet ? contactMapping : undefined,
          subscriptionMapping: subscriptionsSheet ? subscriptionMapping : undefined,
          ...importSettings,
        };
        if (!payload.ownerId) delete payload.ownerId;
        if (!payload.teamId) delete payload.teamId;
        const job = await accountImportApi.startImport(payload);
        setJobId(job.id);
        setCurrentStep(5);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to start import');
      }
      setStarting(false);
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < 5) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-[1100px] mx-auto space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Import Accounts</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            Import accounts, contacts, and subscriptions from an Excel file
          </p>
        </div>
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          <X size={16} />
          Cancel
        </button>
      </div>

      {/* Step Indicator */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <React.Fragment key={step.key}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : isCompleted
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600'
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
                  <span className={`text-xs font-medium hidden md:inline ${
                    isActive ? 'text-purple-600' : isCompleted ? 'text-purple-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    idx < currentStep ? 'bg-purple-300 dark:bg-purple-700' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 min-h-[400px]">
        {currentStep === 0 && (
          <StepUpload onUploadComplete={handleUploadComplete} />
        )}
        {currentStep === 1 && uploadResult && accountsSheet && (
          <StepMapFields
            title="Map Account Fields"
            description="Match your file columns to account fields. Account Name is required."
            sheetName="Accounts"
            headers={accountsSheet.headers}
            mapping={accountMapping}
            fieldOptions={uploadResult.accountFieldOptions}
            requiredFields={['accountName', 'name']}
            requiredLabel="Account Name"
            onMappingChange={setAccountMapping}
            templates={templates}
            onLoadTemplate={handleLoadTemplate}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}
        {currentStep === 2 && uploadResult && (
          contactsSheet ? (
            <StepMapFields
              title="Map Contact Fields"
              description="Match your Contacts sheet columns to contact fields. Account Name is required to link contacts to accounts."
              sheetName="Contacts"
              headers={contactsSheet.headers}
              mapping={contactMapping}
              fieldOptions={uploadResult.contactFieldOptions}
              requiredFields={['accountName']}
              requiredLabel="Account Name"
              note="Account Name must exactly match a name in the Accounts sheet"
              onMappingChange={setContactMapping}
              templates={templates}
              onLoadTemplate={handleLoadTemplate}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Contacts Sheet Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Your Excel file does not contain a "Contacts" sheet. Only accounts will be imported.
                Click Next to continue.
              </p>
            </div>
          )
        )}
        {currentStep === 3 && uploadResult && (
          subscriptionsSheet ? (
            <StepMapFields
              title="Map Subscription Fields"
              description="Match your Subscriptions sheet columns to subscription fields."
              sheetName="Subscriptions"
              headers={subscriptionsSheet.headers}
              mapping={subscriptionMapping}
              fieldOptions={uploadResult.subscriptionFieldOptions}
              requiredFields={['accountName', 'productName']}
              requiredLabel="Account Name and Product Name"
              note="Products not found in the system will be auto-created"
              onMappingChange={setSubscriptionMapping}
              templates={templates}
              onLoadTemplate={handleLoadTemplate}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Subscriptions Sheet Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Your Excel file does not contain a "Subscriptions" sheet. Only accounts
                {contactsSheet ? ' and contacts' : ''} will be imported. Click Next to continue.
              </p>
            </div>
          )
        )}
        {currentStep === 4 && uploadResult && (
          <StepSettingsPreview
            uploadResult={uploadResult}
            accountMapping={accountMapping}
            contactMapping={contactMapping}
            subscriptionMapping={subscriptionMapping}
            settings={importSettings}
            onSettingsChange={setImportSettings}
          />
        )}
        {currentStep === 5 && jobId && (
          <StepProgress
            jobId={jobId}
            onViewAccounts={() => navigate('/accounts')}
            onViewHistory={() => navigate('/admin/batch-jobs')}
          />
        )}
      </div>

      {/* Footer Navigation */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
          </div>
          <button
            onClick={handleNext}
            disabled={!canProceed() || starting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
          >
            {starting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Starting Import...
              </>
            ) : currentStep === 4 ? (
              <>
                Start Import
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                Next
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Step 1: Upload
// ────────────────────────────────────────────────────────

function StepUpload({ onUploadComplete }: { onUploadComplete: (result: UploadResult) => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string; size: number; sheets: SheetInfo[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploadedFile(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') {
      setError('Only .xlsx files are supported for account import. Please use the template.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum size is 50MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await accountImportApi.upload(file);
      setUploadedFile({
        name: result.fileName,
        size: result.fileSize,
        sheets: result.sheets,
      });
      onUploadComplete(result);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      await accountImportApi.downloadTemplate();
    } catch {
      setError('Failed to download template');
    }
    setDownloading(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-lg mx-auto">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Upload Excel File</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upload a multi-sheet Excel (.xlsx) file with Accounts, Contacts, and Subscriptions data.
        Download the template to see the expected format.
      </p>

      {/* Download Template */}
      <button
        onClick={handleDownloadTemplate}
        disabled={downloading}
        className="mb-6 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
      >
        {downloading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {downloading ? 'Downloading...' : 'Download Import Template (.xlsx)'}
      </button>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`p-10 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-slate-800/50'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading and parsing sheets...</p>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{uploadedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatSize(uploadedFile.size)}</p>
            </div>
            {/* Sheet summary */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {uploadedFile.sheets.map((sheet, idx) => (
                <span
                  key={sheet.sheetName || idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                >
                  {sheet.sheetName?.toLowerCase().includes('account') && <Building2 size={12} />}
                  {sheet.sheetName?.toLowerCase().includes('contact') && <Users size={12} />}
                  {sheet.sheetName?.toLowerCase().includes('subscription') && <CreditCard size={12} />}
                  {sheet.sheetName} ({sheet.totalRows?.toLocaleString()} rows)
                </span>
              ))}
            </div>
            {/* Missing sheet warnings */}
            {!uploadedFile.sheets.find(s => s.sheetName?.toLowerCase().includes('contact')) && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                <AlertTriangle size={12} />
                No Contacts sheet found — only accounts will be imported
              </div>
            )}
            {!uploadedFile.sheets.find(s => s.sheetName?.toLowerCase().includes('subscription')) && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                <AlertTriangle size={12} />
                No Subscriptions sheet found — subscriptions will be skipped
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadedFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 mt-1"
            >
              <X size={14} /> Upload a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium text-purple-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Supports .xlsx only (max 50MB)
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Steps 2-4: Map Fields (reusable)
// ────────────────────────────────────────────────────────

interface StepMapFieldsProps {
  title: string;
  description: string;
  sheetName: string;
  headers: string[];
  mapping: Record<string, string>;
  fieldOptions: FieldOption[];
  requiredFields: string[];
  requiredLabel: string;
  note?: string;
  onMappingChange: (mapping: Record<string, string>) => void;
  templates?: any[];
  onLoadTemplate?: (template: any) => void;
  onSaveTemplate?: (name: string) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
}

function StepMapFields({
  title,
  description,
  sheetName,
  headers,
  mapping,
  fieldOptions,
  requiredFields,
  requiredLabel,
  note,
  onMappingChange,
  templates,
  onLoadTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: StepMapFieldsProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!templateName.trim() || !onSaveTemplate) return;
    setSavingTemplate(true);
    try {
      await onSaveTemplate(templateName.trim());
      setTemplateName('');
      setShowSaveForm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      // silently fail
    }
    setSavingTemplate(false);
  };

  const handleFieldChange = (header: string, value: string) => {
    onMappingChange({ ...mapping, [header]: value });
  };

  const mappedValues = Object.values(mapping).filter(v => v && v !== '__skip__');
  const hasRequired = requiredFields.some(f => mappedValues.includes(f));

  // Track field assignment counts for duplicate detection
  const fieldCounts: Record<string, number> = {};
  for (const header of headers) {
    const val = mapping[header];
    if (val && val !== '__skip__') {
      fieldCounts[val] = (fieldCounts[val] || 0) + 1;
    }
  }

  // Build full option list with skip
  const allOptions: FieldOption[] = [
    { value: '__skip__', label: '-- Skip this column --' },
    ...fieldOptions.filter(o => o.value !== '__skip__'),
  ];

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>

      {/* Mapping Template Bar */}
      {templates && onLoadTemplate && onSaveTemplate && (
        <div className="mb-4 flex flex-wrap items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
          {/* Load Template Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <BookmarkPlus size={14} />
              Load Template
              <ChevronDown size={12} />
            </button>
            {showTemplateDropdown && (
              <div className="absolute z-20 left-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                {templates.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                    No saved templates yet
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {templates.map((t: any) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 group"
                      >
                        <button
                          onClick={() => {
                            onLoadTemplate(t);
                            setShowTemplateDropdown(false);
                          }}
                          className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate"
                        >
                          {t.name}
                        </button>
                        {onDeleteTemplate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTemplate(t.id);
                            }}
                            className="ml-2 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete template"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save Template */}
          {!showSaveForm ? (
            <button
              onClick={() => setShowSaveForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <Save size={14} />
              Save as Template
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveForm(false); }}
                placeholder="Template name..."
                autoFocus
                className="w-44 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleSave}
                disabled={!templateName.trim() || savingTemplate}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTemplate ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
              <button
                onClick={() => { setShowSaveForm(false); setTemplateName(''); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Save success toast */}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={12} />
              Template saved
            </span>
          )}
        </div>
      )}

      {/* Sheet badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          <FileSpreadsheet size={12} />
          {sheetName} sheet
        </span>
        <span className="text-xs text-gray-400">
          {headers.length} columns detected
        </span>
      </div>

      {/* Note */}
      {note && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">{note}</p>
        </div>
      )}

      {/* Required field warning */}
      {!hasRequired && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            You must map: {requiredLabel}
          </p>
        </div>
      )}

      {/* Column mapping table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-1/3">File Column</th>
              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-3 w-10"></th>
              <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-1/3">Field</th>
              <th className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 px-4 py-3 w-10">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {headers.map((header, idx) => {
              const selectedField = mapping[header] || '__skip__';
              const isSkipped = selectedField === '__skip__';
              const isRequired = requiredFields.includes(selectedField);
              const isDuplicate = !isSkipped && (fieldCounts[selectedField] || 0) > 1;

              return (
                <tr key={idx} className={isSkipped ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{header}</span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <ArrowRight size={14} className="text-gray-400 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedField}
                      onChange={e => handleFieldChange(header, e.target.value)}
                      className={`w-full text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 ${
                        isDuplicate
                          ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
                      }`}
                    >
                      {allOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}{opt.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSkipped ? (
                      <span className="text-xs text-gray-400">Skipped</span>
                    ) : isDuplicate ? (
                      <AlertTriangle size={16} className="text-amber-500 mx-auto" />
                    ) : isRequired ? (
                      <CheckCircle2 size={16} className="text-purple-500 mx-auto" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Step 5: Settings & Preview
// ────────────────────────────────────────────────────────

interface StepSettingsPreviewProps {
  uploadResult: UploadResult;
  accountMapping: Record<string, string>;
  contactMapping: Record<string, string>;
  subscriptionMapping: Record<string, string>;
  settings: ImportSettings;
  onSettingsChange: (settings: ImportSettings) => void;
}

function StepSettingsPreview({
  uploadResult,
  accountMapping,
  contactMapping,
  subscriptionMapping,
  settings,
  onSettingsChange,
}: StepSettingsPreviewProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [activePreview, setActivePreview] = useState<'accounts' | 'contacts' | 'subscriptions'>('accounts');

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.data || data || []);
    } catch {
      // ignore
    }
    try {
      const teamsData = await teamsApi.getLookup();
      setTeams(teamsData.filter((t: any) => t.isActive));
    } catch {
      // ignore
    }
  };

  const update = (key: keyof ImportSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const findSheetByType = (type: string) => {
    const sheetName = Object.entries(uploadResult.sheetTypes || {}).find(([, t]) => t === type)?.[0];
    return sheetName ? uploadResult.sheets?.find(s => s.sheetName === sheetName) : undefined;
  };
  const accountsSheet = findSheetByType('accounts');
  const contactsSheet = findSheetByType('contacts');
  const subscriptionsSheet = findSheetByType('subscriptions');

  // Get mapped columns for preview
  const getMappedColumns = (headers: string[], mapping: Record<string, string>, fieldOptions: FieldOption[]) => {
    const fieldLabelMap = Object.fromEntries(fieldOptions.map(o => [o.value, o.label]));
    return headers
      .filter(h => mapping[h] && mapping[h] !== '__skip__')
      .map(h => ({
        header: h,
        field: mapping[h],
        label: fieldLabelMap[mapping[h]] || mapping[h],
      }));
  };

  const accountMappedCols = accountsSheet
    ? getMappedColumns(accountsSheet.headers, accountMapping, uploadResult.accountFieldOptions)
    : [];
  const contactMappedCols = contactsSheet
    ? getMappedColumns(contactsSheet.headers, contactMapping, uploadResult.contactFieldOptions)
    : [];
  const subscriptionMappedCols = subscriptionsSheet
    ? getMappedColumns(subscriptionsSheet.headers, subscriptionMapping, uploadResult.subscriptionFieldOptions)
    : [];

  const previewSheets = [
    { key: 'accounts' as const, label: 'Accounts', sheet: accountsSheet, cols: accountMappedCols, mapping: accountMapping, icon: Building2 },
    ...(contactsSheet ? [{ key: 'contacts' as const, label: 'Contacts', sheet: contactsSheet, cols: contactMappedCols, mapping: contactMapping, icon: Users }] : []),
    ...(subscriptionsSheet ? [{ key: 'subscriptions' as const, label: 'Subscriptions', sheet: subscriptionsSheet, cols: subscriptionMappedCols, mapping: subscriptionMapping, icon: CreditCard }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Settings & Preview</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure import options and review the data before importing.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <Building2 className="w-8 h-8 text-purple-500" />
          <div>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
              {accountsSheet?.totalRows.toLocaleString() || 0}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">Accounts</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Users className="w-8 h-8 text-blue-500" />
          <div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {contactsSheet?.totalRows.toLocaleString() || 0}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <CreditCard className="w-8 h-8 text-emerald-500" />
          <div>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {subscriptionsSheet?.totalRows.toLocaleString() || 0}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Subscriptions</p>
          </div>
        </div>
      </div>

      {/* Duplicate Strategy */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Duplicate Handling
        </label>
        <div className="space-y-2">
          {[
            { value: 'skip', label: 'Skip duplicates', desc: 'Do not import accounts that already exist (matched by name)' },
            { value: 'update', label: 'Update existing', desc: 'If a duplicate is found, update the existing account with new data' },
            { value: 'import', label: 'Import all', desc: 'Import all accounts regardless of duplicates' },
          ].map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
              <input
                type="radio"
                name="duplicateStrategy"
                value={opt.value}
                checked={settings.duplicateStrategy === opt.value}
                onChange={() => update('duplicateStrategy', opt.value)}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Owner & Team */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Default Owner
          </label>
          <select
            value={settings.ownerId}
            onChange={e => update('ownerId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">No default owner</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Used when the file doesn't have an owner column
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Default Team
          </label>
          <select
            value={settings.teamId}
            onChange={e => update('teamId', e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="">No default team</option>
            {teams.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Used when the file doesn't have a team column
          </p>
        </div>
      </div>

      {/* Country Code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Country Code (for phone normalization)
        </label>
        <select
          value={settings.countryCode}
          onChange={e => update('countryCode', e.target.value)}
          className="w-full max-w-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.name} ({c.dialCode})</option>
          ))}
        </select>
      </div>

      {/* Default Account Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Default Account Type
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Used when the Type column is empty or not mapped
        </p>
        <div className="flex gap-4">
          {(['B2B', 'B2C'] as const).map(type => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="defaultAccountType"
                value={type}
                checked={settings.defaultAccountType === type}
                onChange={() => update('defaultAccountType', type)}
                className="accent-purple-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Data Preview */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Data Preview</h4>

        {/* Tab buttons */}
        <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {previewSheets.map(ps => {
            const Icon = ps.icon;
            return (
              <button
                key={ps.key}
                onClick={() => setActivePreview(ps.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activePreview === ps.key
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                }`}
              >
                <Icon size={12} />
                {ps.label}
              </button>
            );
          })}
        </div>

        {/* Preview table */}
        {previewSheets.map(ps => {
          if (activePreview !== ps.key || !ps.sheet) return null;
          const cols = ps.cols;
          const rows = ps.sheet.previewRows.slice(0, 5);

          return (
            <div key={ps.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800">
                    <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 w-10">#</th>
                    {cols.map(c => (
                      <th key={c.header} className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 whitespace-nowrap">
                        {c.label}
                        <div className="text-[10px] font-normal text-gray-400">{c.header}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="px-3 py-2 text-gray-400">{rowIdx + 1}</td>
                      {cols.map(c => (
                        <td key={c.header} className="px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap max-w-[200px] truncate">
                          {String(row[c.header] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(ps.sheet.totalRows > 5) && (
                <div className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-100 dark:border-gray-800">
                  ... and {(ps.sheet.totalRows - 5).toLocaleString()} more rows
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Step 6: Progress
// ────────────────────────────────────────────────────────

interface StepProgressProps {
  jobId: string;
  onViewAccounts: () => void;
  onViewHistory: () => void;
}

function StepProgress({ jobId, onViewAccounts, onViewHistory }: StepProgressProps) {
  const [progress, setProgress] = useState<ImportProgressEvent>({
    jobId,
    status: 'pending',
    phase: 'accounts',
    totalRecords: 0,
    processedRecords: 0,
    importedRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    duplicateRecords: 0,
    percentComplete: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const wsUrl = API_URL.replace(/\/api$/, '');

    const socket = io(`${wsUrl}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('account_import_progress', (data: ImportProgressEvent) => {
      if (data.jobId === jobId) {
        setProgress(data);
      }
    });

    socket.on('account_import_complete', (data: ImportProgressEvent) => {
      if (data.jobId === jobId) {
        setProgress(data);
        setIsComplete(true);
      }
    });

    // Poll for status as fallback
    const pollInterval = setInterval(async () => {
      try {
        const job = await accountImportApi.getJob(jobId);
        const p: ImportProgressEvent = {
          jobId: job.id,
          status: job.status,
          phase: job.phase || 'accounts',
          totalRecords: job.totalRecords,
          processedRecords: job.processedRecords,
          importedRecords: job.importedRecords,
          failedRecords: job.failedRecords,
          skippedRecords: job.skippedRecords,
          duplicateRecords: job.duplicateRecords,
          percentComplete: job.percentComplete,
          errorMessage: job.errorMessage || undefined,
          phaseCounts: job.phaseCounts,
        };
        setProgress(p);
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          setIsComplete(true);
          clearInterval(pollInterval);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [jobId]);

  const handleDownloadFailed = async () => {
    setDownloading(true);
    try {
      await accountImportApi.downloadFailed(jobId);
    } catch {
      // ignore
    }
    setDownloading(false);
  };

  const handleCancel = async () => {
    try {
      await accountImportApi.cancelJob(jobId);
      setProgress(prev => ({ ...prev, status: 'cancelled' }));
      setIsComplete(true);
    } catch {
      // ignore
    }
  };

  const isFailed = progress.status === 'failed';
  const isCancelled = progress.status === 'cancelled';
  const isCompleted = progress.status === 'completed';
  const isProcessing = !isComplete;

  const phaseLabels: Record<string, string> = {
    accounts: 'Processing Accounts',
    contacts: 'Processing Contacts',
    subscriptions: 'Processing Subscriptions',
  };

  return (
    <div className="max-w-lg mx-auto text-center">
      {/* Status Icon */}
      <div className="mb-6">
        {isProcessing ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : isCompleted ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
        ) : isFailed ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        ) : (
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {isProcessing
          ? phaseLabels[progress.phase] || 'Importing...'
          : isCompleted
          ? 'Import Complete'
          : isFailed
          ? 'Import Failed'
          : 'Import Cancelled'}
      </h3>

      {progress.errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{progress.errorMessage}</p>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2 mt-4">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            isFailed ? 'bg-red-500' : isCancelled ? 'bg-amber-500' : 'bg-purple-500'
          }`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {(progress.processedRecords ?? 0).toLocaleString()} of {(progress.totalRecords ?? 0).toLocaleString()} records processed
        ({progress.percentComplete ?? 0}%)
      </p>

      {/* Phase counts */}
      {progress.phaseCounts && (
        <div className="grid grid-cols-3 gap-3 mb-6 text-left">
          {[
            { key: 'accounts', label: 'Accounts', icon: Building2, color: 'purple' },
            { key: 'contacts', label: 'Contacts', icon: Users, color: 'blue' },
            { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard, color: 'emerald' },
          ].map(({ key, label, icon: Icon, color }) => {
            const pc = (progress.phaseCounts as any)?.[key];
            if (!pc || pc.total === 0) return null;
            return (
              <div key={key} className={`p-3 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={14} className={`text-${color}-500`} />
                  <span className={`text-xs font-medium text-${color}-700 dark:text-${color}-300`}>{label}</span>
                </div>
                <p className={`text-lg font-bold text-${color}-600`}>
                  {pc.imported}/{pc.total}
                </p>
                {pc.failed > 0 && (
                  <p className="text-xs text-red-500">{pc.failed} failed</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Overall Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">{(progress.importedRecords ?? 0).toLocaleString()}</p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Imported</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-xl sm:text-2xl font-bold text-red-600">{(progress.failedRecords ?? 0).toLocaleString()}</p>
          <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{(progress.skippedRecords ?? 0).toLocaleString()}</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{(progress.duplicateRecords ?? 0).toLocaleString()}</p>
          <p className="text-xs text-blue-700 dark:text-blue-300">Duplicates</p>
        </div>
      </div>

      {/* Actions */}
      {isComplete && (
        <div className="flex flex-wrap justify-center gap-3">
          {progress.failedRecords > 0 && (
            <button
              onClick={handleDownloadFailed}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
            >
              <Download size={16} />
              {downloading ? 'Downloading...' : 'Download Failed Rows'}
            </button>
          )}
          {progress.importedRecords > 0 && (
            <button
              onClick={onViewAccounts}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700"
            >
              View Accounts <ArrowRight size={16} />
            </button>
          )}
          <button
            onClick={onViewHistory}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
          >
            View Import History
          </button>
        </div>
      )}

      {isProcessing && (
        <button
          onClick={handleCancel}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Cancel Import
        </button>
      )}
    </div>
  );
}
