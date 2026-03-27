import { api } from './contacts.api';
import type { MeetingConfig } from './scheduling.api';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'file' | 'heading' | 'paragraph' | 'divider';
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  validation?: Record<string, any>;
  width?: 'full' | 'half';
}

export interface FormSubmitAction {
  type: 'create_lead' | 'create_contact' | 'create_account' | 'webhook' | 'send_email';
  enabled: boolean;
  fieldMapping?: Record<string, string>;
  webhookUrl?: string;
  // send_email fields
  emailFieldName?: string;
  subject?: string;
  body?: string;
}

export interface FormLandingPageConfig {
  heroTitle?: string;
  heroSubtitle?: string;
  heroImageUrl?: string;
  heroBgColor?: string;
  sections?: Array<{
    id: string;
    type: 'text' | 'image' | 'cta';
    content?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaUrl?: string;
  }>;
  seoTitle?: string;
  seoDescription?: string;
  faviconUrl?: string;
  customCss?: string;
}

export interface FormSettings {
  successMessage?: string;
  redirectUrl?: string;
  allowMultiple?: boolean;
  requireCaptcha?: boolean;
  notifyEmails?: string[];
}

export interface FormBranding {
  logoUrl?: string;
  primaryColor?: string;
  backgroundColor?: string;
  headerText?: string;
  footerText?: string;
}

export interface FormRecord {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  fields: FormField[];
  settings: FormSettings;
  submitActions: FormSubmitAction[];
  branding: FormBranding;
  token: string;
  tenantSlug: string;
  submissionCount: number;
  type?: 'standard' | 'meeting_booking';
  meetingConfig?: MeetingConfig;
  isLandingPage?: boolean;
  landingPageConfig?: FormLandingPageConfig;
  availableModules?: string[];
  allowMultipleSubmissions?: boolean;
  createdBy: string;
  createdByName?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
  actionResults: { type: string; status: string; result?: any; error?: string; retriedAt?: string }[];
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface EntityFormSubmission {
  id: string;
  formId: string;
  formName: string;
  formFields: FormField[];
  data: Record<string, any>;
  metadata?: Record<string, any>;
  entityType: string;
  entityId: string;
  submittedBy?: string;
  submitterName?: string;
  filledByEmail?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ModuleForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  settings: FormSettings;
  allowMultipleSubmissions: boolean;
  status: string;
}

export const formsApi = {
  getAll: async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const { data } = await api.get('/forms', { params });
    return data;
  },
  getById: async (id: string): Promise<FormRecord> => {
    const { data } = await api.get(`/forms/${id}`);
    return data;
  },
  create: async (body: Partial<FormRecord>): Promise<FormRecord> => {
    const { data } = await api.post('/forms', body);
    return data;
  },
  update: async (id: string, body: Partial<FormRecord>): Promise<FormRecord> => {
    const { data } = await api.put(`/forms/${id}`, body);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/forms/${id}`);
  },
  duplicate: async (id: string): Promise<FormRecord> => {
    const { data } = await api.post(`/forms/${id}/duplicate`);
    return data;
  },
  getSubmissions: async (formId: string, params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    actionStatus?: 'success' | 'error' | '';
  }) => {
    const { data } = await api.get(`/forms/${formId}/submissions`, { params });
    return data;
  },
  retryWebhook: async (formId: string, submissionId: string, actionIndex: number) => {
    const { data } = await api.post(
      `/forms/${formId}/submissions/${submissionId}/retry-webhook`,
      { actionIndex },
    );
    return data;
  },
  getAnalytics: async (formId: string) => {
    const { data } = await api.get(`/forms/${formId}/analytics`);
    return data;
  },
  // Module-linked form methods
  getFormsForModule: async (moduleName: string): Promise<ModuleForm[]> => {
    const { data } = await api.get(`/forms/module/${moduleName}`);
    return data;
  },
  getEntitySubmissions: async (entityType: string, entityId: string, formId?: string): Promise<EntityFormSubmission[]> => {
    const { data } = await api.get(`/forms/entity/${entityType}/${entityId}/submissions`, {
      params: formId ? { formId } : undefined,
    });
    return data;
  },
  submitEntityForm: async (body: { formId: string; entityType: string; entityId: string; data: any }) => {
    const { data } = await api.post('/forms/entity/submit', body);
    return data;
  },
  sendFormEmail: async (body: { formId: string; entityType: string; entityId: string; recipients: string[]; subject: string; body: string }) => {
    const { data } = await api.post('/forms/entity/send-email', body);
    return data;
  },
  generateFormLink: async (body: { formId: string; entityType: string; entityId: string }) => {
    const { data } = await api.post('/forms/entity/generate-link', body);
    return data;
  },
  deleteSubmission: async (submissionId: string) => {
    const { data } = await api.delete(`/forms/entity/submissions/${submissionId}`);
    return data;
  },
  // Public (no auth)
  getPublicForm: async (tenantSlug: string, token: string) => {
    const { data } = await api.get(`/forms/public/${tenantSlug}/${token}`);
    return data;
  },
  submitPublicForm: async (tenantSlug: string, token: string, formData: Record<string, any>) => {
    const { data } = await api.post(`/forms/public/${tenantSlug}/${token}/submit`, formData);
    return data;
  },
};
