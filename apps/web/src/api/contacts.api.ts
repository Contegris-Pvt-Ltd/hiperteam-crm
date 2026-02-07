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

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  source: string | null;
  leadSourceDetails: Record<string, string> | null;
  status: string;
  tags: string[];
  notes: string | null;
  customFields: Record<string, unknown>;
  socialProfiles: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  } | null;
  doNotContact: boolean;
  doNotEmail: boolean;
  doNotCall: boolean;
  profileCompletion: number;
  accountId: string | null;
  ownerId: string | null;
  owner: { firstName: string; lastName: string } | null;
  createdBy: string;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  profileCompletionDetails?: ProfileCompletionDetails;
}

export interface ProfileCompletionDetails {
  percentage: number;
  missingFields: { field: string; label: string; weight: number }[];
  completedFields: { field: string; label: string; weight: number }[];
  categoryBreakdown: Record<string, { completed: number; total: number; percentage: number }>;
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
  company?: string;
  jobTitle?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  doNotContact?: boolean;
  doNotEmail?: boolean;
  doNotCall?: boolean;
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

  getProfileCompletion: async (id: string): Promise<ProfileCompletionDetails> => {
    const { data } = await api.get(`/contacts/${id}/profile-completion`);
    return data;
  },
};