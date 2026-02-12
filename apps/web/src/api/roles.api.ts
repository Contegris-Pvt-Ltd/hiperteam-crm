import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface RoleUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  avatarUrl?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, Record<string, boolean>>;
  recordAccess: Record<string, string>;
  fieldPermissions: Record<string, unknown>;
  isSystem: boolean;
  isCustom: boolean;
  level: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
  // Detail-only
  users?: RoleUser[];
}

export interface RolesResponse {
  data: Role[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface RolesQuery {
  search?: string;
  type?: string; // 'system' | 'custom'
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateRoleData {
  name: string;
  description?: string;
  permissions: Record<string, Record<string, boolean>>;
  recordAccess?: Record<string, string>;
  fieldPermissions?: Record<string, unknown>;
  level?: number;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: Record<string, Record<string, boolean>>;
  recordAccess?: Record<string, string>;
  fieldPermissions?: Record<string, unknown>;
  level?: number;
}

export interface ModuleDefinition {
  label: string;
  actions: string[];
}

export interface ModuleDefinitionsResponse {
  modules: Record<string, ModuleDefinition>;
  recordAccessModules: string[];
  recordAccessLevels: string[];
}

// ============================================================
// API METHODS
// ============================================================

export const rolesApi = {
  getAll: async (query: RolesQuery = {}): Promise<RolesResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const { data } = await api.get(`/roles?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Role> => {
    const { data } = await api.get(`/roles/${id}`);
    return data;
  },

  create: async (role: CreateRoleData): Promise<Role> => {
    const { data } = await api.post('/roles', role);
    return data;
  },

  update: async (id: string, role: UpdateRoleData): Promise<Role> => {
    const { data } = await api.put(`/roles/${id}`, role);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/roles/${id}`);
    return data;
  },

  clone: async (id: string, name: string): Promise<Role> => {
    const { data } = await api.post(`/roles/${id}/clone`, { name });
    return data;
  },

  getModuleDefinitions: async (): Promise<ModuleDefinitionsResponse> => {
    const { data } = await api.get('/roles/module-definitions');
    return data;
  },
};