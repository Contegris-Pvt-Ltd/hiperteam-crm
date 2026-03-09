import { api } from './contacts.api';

// ── Types ─────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'microsoft' | 'imap';
export type EmailDirection = 'inbound' | 'outbound';

export interface EmailAccount {
  id: string;
  email: string;
  displayName?: string;
  provider: EmailProvider;
  isShared: boolean;
  syncEnabled: boolean;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface Email {
  id: string;
  accountId: string;
  accountEmail?: string;
  accountProvider?: string;
  messageId: string;
  threadId?: string;
  direction: EmailDirection;
  subject: string;
  snippet: string;
  fromEmail: string;
  fromName?: string;
  toEmails: EmailAddress[];
  ccEmails: EmailAddress[];
  sentAt?: string;
  receivedAt?: string;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  bodyHtml?: string;
  bodyText?: string;
  opensCount: number;
  clicksCount: number;
  labels: string[];
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageUrl: string;
  }>;
  links?: Array<{
    id: string;
    entityType: string;
    entityId: string;
    autoLinked: boolean;
  }>;
  createdAt: string;
  // Thread stats (only in list view)
  threadCount?: number;
  threadUnreadCount?: number;
  threadHasAttachments?: boolean;
  threadHasStar?: boolean;
}

export interface SendEmailDto {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  inReplyTo?: string;
  threadId?: string;
}

export interface EmailsResponse {
  data: Email[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface EmailQuery {
  accountId?: string;
  direction?: string;
  isRead?: boolean;
  isStarred?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Rule Types ────────────────────────────────────────────────

export type RuleField = 'from' | 'to' | 'subject' | 'body' | 'has_attachments' | 'header';
export type RuleOperator = 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
export type RuleActionType =
  | 'mark_read' | 'star' | 'label'
  | 'link_contact' | 'link_lead' | 'link_opportunity' | 'link_account'
  | 'forward' | 'auto_reply' | 'delete';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface RuleAction {
  type: RuleActionType;
  config?: Record<string, any>;
}

export interface InboxRule {
  id: string;
  name: string;
  isActive: boolean;
  applyTo: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  stopProcessing: boolean;
  priority: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── API ───────────────────────────────────────────────────────

export const emailApi = {
  // Accounts
  getAccounts: async (): Promise<EmailAccount[]> => {
    const { data } = await api.get('/email/accounts');
    return data;
  },

  deleteAccount: async (id: string): Promise<void> => {
    await api.delete(`/email/accounts/${id}`);
  },

  connectImap: async (dto: {
    email: string;
    displayName?: string;
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    password: string;
    isShared: boolean;
  }): Promise<{ success: boolean; accountId: string }> => {
    const { data } = await api.post('/email/connect/imap', dto);
    return data;
  },

  testImap: async (dto: {
    email: string;
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    password: string;
  }): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post('/email/test-imap', dto);
    return data;
  },

  getGmailOAuthUrl: async (isShared = false): Promise<{ url: string }> => {
    const { data } = await api.get(`/email/connect/gmail?isShared=${isShared}`);
    return data;
  },

  getMicrosoftOAuthUrl: async (isShared = false): Promise<{ url: string }> => {
    const { data } = await api.get(`/email/connect/microsoft?isShared=${isShared}`);
    return data;
  },

  syncAccount: async (id: string): Promise<void> => {
    await api.post(`/email/accounts/${id}/sync`);
  },

  // Emails
  getEmails: async (params: EmailQuery = {}): Promise<EmailsResponse> => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.append(key, String(value));
      }
    });
    const { data } = await api.get(`/email?${query.toString()}`);
    return data;
  },

  getEmailById: async (id: string): Promise<Email> => {
    const { data } = await api.get(`/email/${id}`);
    return data;
  },

  getThreadEmails: async (threadId: string): Promise<Email[]> => {
    const { data } = await api.get(`/email/thread/${threadId}`);
    return data;
  },

  sendEmail: async (dto: SendEmailDto, files?: File[]): Promise<{ id: string }> => {
    if (files?.length) {
      const formData = new FormData();
      formData.append('accountId', dto.accountId);
      formData.append('to', JSON.stringify(dto.to));
      if (dto.cc?.length) formData.append('cc', JSON.stringify(dto.cc));
      if (dto.bcc?.length) formData.append('bcc', JSON.stringify(dto.bcc));
      formData.append('subject', dto.subject);
      formData.append('bodyHtml', dto.bodyHtml);
      if (dto.bodyText) formData.append('bodyText', dto.bodyText);
      for (const file of files) {
        formData.append('attachments', file);
      }
      const { data } = await api.post('/email/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    }
    const { data } = await api.post('/email/send', dto);
    return data;
  },

  replyToEmail: async (id: string, dto: { accountId: string; to: string[]; cc?: string[]; bodyHtml: string }): Promise<{ id: string }> => {
    const { data } = await api.post(`/email/${id}/reply`, dto);
    return data;
  },

  forwardEmail: async (id: string, dto: { accountId: string; to: string[]; bodyHtml?: string }): Promise<{ id: string }> => {
    const { data } = await api.post(`/email/${id}/forward`, dto);
    return data;
  },

  markRead: async (id: string, isRead: boolean): Promise<void> => {
    await api.patch(`/email/${id}/read`, { isRead });
  },

  toggleStar: async (id: string): Promise<void> => {
    await api.patch(`/email/${id}/star`);
  },

  linkEmail: async (id: string, entityType: string, entityId: string): Promise<void> => {
    await api.post(`/email/${id}/link`, { entityType, entityId });
  },

  unlinkEmail: async (id: string, entityType: string, entityId: string): Promise<void> => {
    await api.delete(`/email/${id}/link`, { data: { entityType, entityId } });
  },

  deleteEmail: async (id: string): Promise<void> => {
    await api.delete(`/email/${id}`);
  },

  bulkDelete: async (ids: string[]): Promise<{ deleted: number }> => {
    const { data } = await api.post('/email/bulk/delete', { ids });
    return data;
  },

  bulkMarkRead: async (ids: string[], isRead: boolean): Promise<void> => {
    await api.post('/email/bulk/read', { ids, isRead });
  },

  // Entity emails
  getEntityEmails: async (entityType: string, entityId: string): Promise<Email[]> => {
    const { data } = await api.get(`/email/linked/${entityType}/${entityId}`);
    return data;
  },

  // Inbox Rules
  getRules: async (): Promise<InboxRule[]> => {
    const { data } = await api.get('/email/rules');
    return data;
  },

  createRule: async (dto: {
    name: string;
    applyTo?: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    stopProcessing?: boolean;
    priority?: number;
  }): Promise<InboxRule> => {
    const { data } = await api.post('/email/rules', dto);
    return data;
  },

  updateRule: async (id: string, dto: Partial<{
    name: string;
    isActive: boolean;
    applyTo: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    stopProcessing: boolean;
    priority: number;
  }>): Promise<InboxRule> => {
    const { data } = await api.patch(`/email/rules/${id}`, dto);
    return data;
  },

  deleteRule: async (id: string): Promise<void> => {
    await api.delete(`/email/rules/${id}`);
  },
};
