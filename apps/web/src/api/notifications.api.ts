// ============================================================
// FILE: apps/web/src/api/leads.api.ts
// ============================================================
import { api } from './contacts.api';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ============================================================
// TYPES
// ============================================================

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  channels: string[];
  isRead: boolean;
  readAt: string | null;
  isDismissed: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  eventType: string;
  inApp: boolean;
  email: boolean;
  browserPush: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface NotificationTemplate {
  id: string;
  eventType: string;
  name: string;
  emailSubject: string | null;
  emailBodyHtml: string | null;
  emailBodyText: string | null;
  smsBody: string | null;
  whatsappTemplateId: string | null;
  isActive: boolean;
}

export interface NotificationSettings {
  smtp_config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    fromName: string;
  };
  twilio_config: {
    accountSid: string;
    authToken: string;
    fromPhone: string;
    whatsappFrom: string;
  };
  push_config: {
    publicKey: string;
    privateKey: string;
    contact: string;
  };
  default_preferences: Record<string, {
    in_app: boolean;
    email: boolean;
    browser_push: boolean;
    sms: boolean;
    whatsapp: boolean;
  }>;
}

// ============================================================
// NOTIFICATION EVENT TYPE LABELS
// ============================================================
export const EVENT_TYPE_LABELS: Record<string, { label: string; description: string; category: string }> = {
  task_assigned: { label: 'Task Assigned', description: 'When a task is assigned to you', category: 'Tasks' },
  task_due_reminder: { label: 'Task Due Reminder', description: 'Before a task is due', category: 'Tasks' },
  task_overdue: { label: 'Task Overdue', description: 'When a task becomes overdue', category: 'Tasks' },
  task_completed: { label: 'Task Completed', description: 'When a task you own is completed', category: 'Tasks' },
  meeting_reminder: { label: 'Meeting Reminder', description: 'Before a meeting starts', category: 'Meetings' },
  meeting_booked: { label: 'Meeting Booked', description: 'When someone books a meeting with you', category: 'Meetings' },
  meeting_cancelled: { label: 'Meeting Cancelled', description: 'When a meeting is cancelled', category: 'Meetings' },
  meeting_rescheduled: { label: 'Meeting Rescheduled', description: 'When a meeting is rescheduled', category: 'Meetings' },
  lead_assigned: { label: 'Lead Assigned', description: 'When a lead is assigned to you', category: 'Leads' },
  mention: { label: 'Mentions', description: 'When someone mentions you in a note', category: 'General' },
};

// ============================================================
// API
// ============================================================

export const notificationsApi = {
  // ---- Notifications ----
  list: async (params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }): Promise<{ data: Notification[]; total: number; unreadCount: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString();
    const response = await api.get(`/notifications${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<{ markedRead: number }> => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  dismiss: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/dismiss`);
  },

  // ---- Preferences ----
  getPreferences: async (): Promise<NotificationPreference[]> => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  updatePreference: async (eventType: string, data: {
    inApp?: boolean;
    email?: boolean;
    browserPush?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  }): Promise<NotificationPreference> => {
    const response = await api.put(`/notifications/preferences/${eventType}`, data);
    return response.data;
  },

  bulkUpdatePreferences: async (preferences: Array<{
    eventType: string;
    inApp?: boolean;
    email?: boolean;
    browserPush?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  }>): Promise<NotificationPreference[]> => {
    const response = await api.put('/notifications/preferences', { preferences });
    return response.data;
  },

  // ---- Push ----
  getVapidPublicKey: async (): Promise<{ publicKey: string | null }> => {
    const response = await api.get('/notifications/push/public-key');
    return response.data;
  },

  subscribePush: async (subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }): Promise<{ id: string }> => {
    const response = await api.post('/notifications/push/subscribe', subscription);
    return response.data;
  },

  unsubscribePush: async (endpoint: string): Promise<void> => {
    await api.delete('/notifications/push/unsubscribe', { data: { endpoint } });
  },

  generateVapidKeys: async (): Promise<{ publicKey: string; privateKey: string }> => {
    const response = await api.post('/notifications/push/generate-vapid');
    return response.data;
  },

  // ---- Templates (admin) ----
  getTemplates: async (): Promise<NotificationTemplate[]> => {
    const response = await api.get('/notifications/templates');
    return response.data;
  },

  updateTemplate: async (id: string, data: Partial<{
    emailSubject: string;
    emailBodyHtml: string;
    emailBodyText: string;
    smsBody: string;
    whatsappTemplateId: string;
    isActive: boolean;
  }>): Promise<NotificationTemplate> => {
    const response = await api.put(`/notifications/templates/${id}`, data);
    return response.data;
  },

  // ---- Settings (admin) ----
  getSettings: async (): Promise<NotificationSettings> => {
    const response = await api.get('/notifications/settings');
    return response.data;
  },

  updateSetting: async (key: string, value: any): Promise<void> => {
    await api.put(`/notifications/settings/${key}`, { value });
  },

  // ---- Verification (admin) ----
  verifySmtp: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/notifications/verify/smtp');
    return response.data;
  },

  verifyTwilio: async (): Promise<{ success: boolean; error?: string }> => {
    const response = await api.post('/notifications/verify/twilio');
    return response.data;
  },

  // ---- Test ----
  sendTest: async (channel?: string, testEmail?: string) => {
     const { data } = await api.post('/notifications/test', { channel, testEmail });
     return data;
   },
};