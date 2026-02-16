// ============================================================
// FILE: apps/web/src/api/accounts.api.ts
// Updated: B2B/B2C classification support
// ============================================================
import { api } from './contacts.api';
import type { Activity, AuditLog, Note, Document, EmailEntry, PhoneEntry, AddressEntry, SocialProfiles } from './contacts.api';

// ============ Classification Constants ============

export type AccountClassification = 'business' | 'individual';

export const ACCOUNT_CLASSIFICATIONS: { value: AccountClassification; label: string }[] = [
  { value: 'business', label: 'Business (B2B)' },
  { value: 'individual', label: 'Individual (B2C)' },
];

// Account types per classification
export const BUSINESS_ACCOUNT_TYPES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'partner', label: 'Partner' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'competitor', label: 'Competitor' },
  { value: 'other', label: 'Other' },
];

export const INDIVIDUAL_ACCOUNT_TYPES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
  { value: 'individual', label: 'Individual' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
];

export function getAccountTypesForClassification(classification: AccountClassification) {
  return classification === 'individual' ? INDIVIDUAL_ACCOUNT_TYPES : BUSINESS_ACCOUNT_TYPES;
}

// ============ Interfaces ============

export interface Account {
  id: string;
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
  parentAccount?: {
    id: string;
    name: string;
    logoUrl?: string;
    industry?: string;
  };
  accountType?: string;
  accountClassification: AccountClassification;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
  status: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  source?: string;
  ownerId?: string;
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  contactsCount: number;
  createdAt: string;
  updatedAt: string;
  profileCompletion?: {
    percentage: number;
    filledFields: string[];
    missingFields: { key: string; label: string; weight: number }[];
    totalWeight: number;
    earnedWeight: number;
  };
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
  accountClassification?: string;
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
  accountClassification?: AccountClassification;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationalId?: string;
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

// ============ API Methods ============

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

  // Child accounts
  getChildAccounts: async (id: string): Promise<Account[]> => {
    const { data } = await api.get(`/accounts/${id}/children`);
    return data;
  },

  // Activities
  getActivities: async (id: string): Promise<Activity[]> => {
    const { data } = await api.get(`/accounts/${id}/activities`);
    return Array.isArray(data) ? data : data.data || [];
  },

  // Audit history
  getHistory: async (id: string): Promise<AuditLog[]> => {
    const { data } = await api.get(`/accounts/${id}/history`);
    return data;
  },

  // Notes
  getNotes: async (id: string): Promise<Note[]> => {
    const { data } = await api.get(`/accounts/${id}/notes`);
    return data;
  },

  createNote: async (id: string, content: string): Promise<Note> => {
    const { data } = await api.post(`/accounts/${id}/notes`, { content });
    return data;
  },

  deleteNote: async (id: string, noteId: string): Promise<void> => {
    await api.delete(`/accounts/${id}/notes/${noteId}`);
  },

  // Documents
  getDocuments: async (id: string): Promise<Document[]> => {
    const { data } = await api.get(`/accounts/${id}/documents`);
    return data;
  },
};