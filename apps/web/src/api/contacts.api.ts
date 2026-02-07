import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Types
export interface EmailEntry {
  type: string;
  email: string;
  primary?: boolean;
}

export interface PhoneEntry {
  type: string;
  number: string;
  primary?: boolean;
}

export interface AddressEntry {
  type: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  primary?: boolean;
}

export interface SocialProfiles {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  avatarUrl?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emails?: EmailEntry[];
  phones?: PhoneEntry[];
  addresses?: AddressEntry[];
  socialProfiles?: SocialProfiles;
  source?: string;
  status: string;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
  doNotContact: boolean;
  doNotEmail: boolean;
  doNotCall: boolean;
  accountId?: string;
  account?: {
    id: string;
    name: string;
    logoUrl?: string;
    industry?: string;
  };
  ownerId?: string;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContactsResponse {
  data: Contact[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ContactsQuery {
  search?: string;
  status?: string;
  company?: string;
  tag?: string;
  ownerId?: string;
  accountId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateContactData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  avatarUrl?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emails?: EmailEntry[];
  phones?: PhoneEntry[];
  addresses?: AddressEntry[];
  source?: string;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
  socialProfiles?: SocialProfiles;
  doNotContact?: boolean;
  doNotEmail?: boolean;
  doNotCall?: boolean;
  accountId?: string;
  ownerId?: string;
}

export interface Activity {
  id: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  relatedType: string | null;
  relatedId: string | null;
  performedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { from: unknown; to: unknown }>;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  performedBy: { id: string; firstName: string; lastName: string; email: string } | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  isPinned: boolean;
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageUrl: string;
  description?: string;  // Make optional
  tags?: string[];       // Make optional
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export const contactsApi = {
  getAll: async (query: ContactsQuery = {}): Promise<ContactsResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/contacts?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Contact> => {
    const { data } = await api.get(`/contacts/${id}`);
    return data;
  },

  create: async (contact: CreateContactData): Promise<Contact> => {
    const { data } = await api.post('/contacts', contact);
    return data;
  },

  update: async (id: string, contact: Partial<CreateContactData>): Promise<Contact> => {
    const { data } = await api.put(`/contacts/${id}`, contact);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/contacts/${id}`);
  },

  // Accounts
  getAccounts: async (id: string): Promise<{ id: string; name: string; logoUrl: string; role: string; isPrimary: boolean }[]> => {
    const { data } = await api.get(`/contacts/${id}/accounts`);
    return data;
  },

  linkAccount: async (id: string, accountId: string, role?: string, isPrimary?: boolean): Promise<void> => {
    await api.post(`/contacts/${id}/accounts/${accountId}`, { role, isPrimary });
  },

  unlinkAccount: async (id: string, accountId: string): Promise<void> => {
    await api.delete(`/contacts/${id}/accounts/${accountId}`);
  },

  // Activities
  getActivities: async (id: string, page = 1, limit = 20): Promise<{ data: Activity[]; total: number }> => {
    const { data } = await api.get(`/contacts/${id}/activities?page=${page}&limit=${limit}`);
    return data;
  },

  // History
  getHistory: async (id: string): Promise<AuditLog[]> => {
    const { data } = await api.get(`/contacts/${id}/history`);
    return data;
  },

  // Notes
  getNotes: async (id: string): Promise<Note[]> => {
    const { data } = await api.get(`/contacts/${id}/notes`);
    return data;
  },

  addNote: async (id: string, content: string): Promise<Note> => {
    const { data } = await api.post(`/contacts/${id}/notes`, { content });
    return data;
  },

  // Documents
  getDocuments: async (id: string): Promise<Document[]> => {
    const { data } = await api.get(`/contacts/${id}/documents`);
    return data;
  },
};

// Export default api instance for use in other modules
export { api };