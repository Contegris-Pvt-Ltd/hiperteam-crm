import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface LeadFieldOption {
  value: string;
  label: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  headers: string[];
  totalRows: number;
  previewRows: Record<string, any>[];
  suggestedMapping: Record<string, string>;
  matchingTemplates: MappingTemplate[];
  leadFieldOptions: LeadFieldOption[];
}

export interface StartImportData {
  fileId: string;
  columnMapping: Record<string, string>;
  duplicateStrategy: 'skip' | 'update' | 'import';
  assignmentStrategy: 'specific_user' | 'unassigned';
  ownerId?: string;
  countryCode: string;
  pipelineId?: string;
  stageId?: string;
  source?: string;
  priorityId?: string;
  teamId?: string;
  tags?: string[];
}

export interface ImportJob {
  id: string;
  type: string;
  status: 'pending' | 'parsing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  fileName: string;
  fileSize: number;
  totalRecords: number;
  processedRecords: number;
  importedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  duplicateRecords: number;
  columnMapping: Record<string, string>;
  settings: Record<string, any>;
  failedRowCount: number;
  errorMessage: string | null;
  percentComplete: number;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobsResponse {
  data: ImportJob[];
  meta: { total: number; page: number; limit: number };
}

export interface MappingTemplate {
  id: string;
  name: string;
  type: string;
  columnMapping: Record<string, string>;
  fileHeaders: string[];
  settings: Record<string, any>;
  isDefault: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface SaveTemplateData {
  name: string;
  columnMapping: Record<string, string>;
  fileHeaders?: string[];
  settings?: Record<string, any>;
  isDefault?: boolean;
}

export interface ImportProgressEvent {
  jobId: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  importedRecords: number;
  failedRecords: number;
  skippedRecords: number;
  duplicateRecords: number;
  percentComplete: number;
  errorMessage?: string;
}

// ============================================================
// API
// ============================================================

export const leadImportApi = {
  // Upload file and get parsed headers + preview
  upload: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/lead-import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Start the import job
  startImport: async (importData: StartImportData): Promise<ImportJob> => {
    const { data } = await api.post('/lead-import/start', importData);
    return data;
  },

  // List all import jobs
  getJobs: async (page = 1, limit = 20): Promise<ImportJobsResponse> => {
    const { data } = await api.get(`/lead-import/jobs?page=${page}&limit=${limit}`);
    return data;
  },

  // Get single job details
  getJob: async (id: string): Promise<ImportJob> => {
    const { data } = await api.get(`/lead-import/jobs/${id}`);
    return data;
  },

  // Cancel a running job
  cancelJob: async (id: string): Promise<void> => {
    await api.post(`/lead-import/jobs/${id}/cancel`);
  },

  // Download failed records as Excel
  downloadFailed: async (id: string): Promise<void> => {
    const response = await api.get(`/lead-import/jobs/${id}/failed-file`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `failed-records-${id.substring(0, 8)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Template CRUD
  getTemplates: async (): Promise<MappingTemplate[]> => {
    const { data } = await api.get('/lead-import/templates');
    return data;
  },

  saveTemplate: async (templateData: SaveTemplateData): Promise<MappingTemplate> => {
    const { data } = await api.post('/lead-import/templates', templateData);
    return data;
  },

  updateTemplate: async (id: string, templateData: SaveTemplateData): Promise<void> => {
    await api.put(`/lead-import/templates/${id}`, templateData);
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await api.delete(`/lead-import/templates/${id}`);
  },
};
