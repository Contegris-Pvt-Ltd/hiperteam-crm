import { api } from './contacts.api';

export interface ApiKey {
  id: string;
  email: string;
  label: string;
  description: string | null;
  status: 'active' | 'inactive';
  roleId: string;
  roleName: string;
  roleLevel: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyData {
  label: string;
  description?: string;
  roleId: string;
  expiresIn?: '30d' | '90d' | '1y' | 'never';
}

export interface CreateApiKeyResponse {
  id: string;
  label: string;
  token: string;
  expiresAt: string | null;
}

export const apiKeysApi = {
  getAll: async (): Promise<ApiKey[]> => {
    const { data } = await api.get('/api-keys');
    return data;
  },

  getOne: async (id: string): Promise<ApiKey> => {
    const { data } = await api.get(`/api-keys/${id}`);
    return data;
  },

  create: async (body: CreateApiKeyData): Promise<CreateApiKeyResponse> => {
    const { data } = await api.post('/api-keys', body);
    return data;
  },

  regenerate: async (id: string): Promise<{ token: string }> => {
    const { data } = await api.post(`/api-keys/${id}/regenerate`);
    return data;
  },

  updateStatus: async (id: string, status: 'active' | 'inactive'): Promise<void> => {
    await api.put(`/api-keys/${id}/status`, { status });
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api-keys/${id}`);
  },
};
