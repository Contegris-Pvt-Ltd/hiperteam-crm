import { api } from './contacts.api';
import type { Activity, AuditLog, Note, Document, EmailEntry, PhoneEntry, AddressEntry, SocialProfiles } from './contacts.api';

export interface Account {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  annualRevenue: number | null;
  description: string | null;
  emails: EmailEntry[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  socialProfiles: SocialProfiles | null;
  parentAccountId: string | null;
  parentAccount: { id: string; name: string } | null;
  accountType: string;
  status: string;
  tags: string[];
  customFields: Record<string, unknown>;
  source: string | null;
  ownerId: string | null;
  owner: { id: string; firstName: string; lastName: string } | null;
  contactsCount: number;
  createdBy: string;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsResponse {
  data: Account[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AccountsQuery {
  search?: string;
  status?: string;
  accountType?: string;
  industry?: string;
  tag?: string;
  ownerId?: string;
  parentAccountId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateAccountData {
  name: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  annualRevenue?: number;
  description?: string;
  emails?: EmailEntry[];
  phones?: PhoneEntry[];
  addresses?: AddressEntry[];
  socialProfiles?: SocialProfiles;
  parentAccountId?: string;
  accountType?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  source?: string;
  ownerId?: string;
}

export interface LinkedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  avatarUrl: string | null;
  role: string;
  isPrimary: boolean;
}

export const accountsApi = {
  getAll: async (query: AccountsQuery = {}): Promise<AccountsResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/accounts?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Account> => {
    const { data } = await api.get(`/accounts/${id}`);
    return data;
  },

  create: async (account: CreateAccountData): Promise<Account> => {
    const { data } = await api.post('/accounts', account);
    return data;
  },

  update: async (id: string, account: Partial<CreateAccountData>): Promise<Account> => {
    const { data } = await api.put(`/accounts/${id}`, account);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  // Contacts
  getContacts: async (id: string): Promise<LinkedContact[]> => {
    const { data } = await api.get(`/accounts/${id}/contacts`);
    return data;
  },

  linkContact: async (id: string, contactId: string, role?: string, isPrimary?: boolean): Promise<void> => {
    await api.post(`/accounts/${id}/contacts/${contactId}`, { role, isPrimary });
  },

  unlinkContact: async (id: string, contactId: string): Promise<void> => {
    await api.delete(`/accounts/${id}/contacts/${contactId}`);
  },

  // Children
  getChildren: async (id: string): Promise<Account[]> => {
    const { data } = await api.get(`/accounts/${id}/children`);
    return data;
  },

  // Activities
  getActivities: async (id: string, page = 1, limit = 20): Promise<{ data: Activity[]; total: number }> => {
    const { data } = await api.get(`/accounts/${id}/activities?page=${page}&limit=${limit}`);
    return data;
  },

  // History
  getHistory: async (id: string): Promise<AuditLog[]> => {
    const { data } = await api.get(`/accounts/${id}/history`);
    return data;
  },

  // Notes
  getNotes: async (id: string): Promise<Note[]> => {
    const { data } = await api.get(`/accounts/${id}/notes`);
    return data;
  },

  addNote: async (id: string, content: string): Promise<Note> => {
    const { data } = await api.post(`/accounts/${id}/notes`, { content });
    return data;
  },

  // Documents
  getDocuments: async (id: string): Promise<Document[]> => {
    const { data } = await api.get(`/accounts/${id}/documents`);
    return data;
  },
};