import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface DepartmentHead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface DepartmentMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  avatarUrl?: string;
  status: string;
  roleName?: string;
}

export interface DepartmentTeam {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  leadName?: string;
  memberCount: number;
}

export interface DepartmentChild {
  id: string;
  name: string;
  code?: string;
  isActive: boolean;
  memberCount: number;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string;
  parentDepartmentName?: string;
  headId?: string;
  head: DepartmentHead | null;
  isActive: boolean;
  memberCount?: number;
  teamCount?: number;
  childCount?: number;
  createdAt: string;
  updatedAt: string;
  // Detail-only fields
  members?: DepartmentMember[];
  teams?: DepartmentTeam[];
  children?: DepartmentChild[];
}

export interface DepartmentsResponse {
  data: Department[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DepartmentsQuery {
  search?: string;
  isActive?: string;
  parentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateDepartmentData {
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string;
  headId?: string;
  isActive?: boolean;
}

export interface UpdateDepartmentData {
  name?: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string | null;
  headId?: string | null;
  isActive?: boolean;
}

export interface DepartmentLookupItem {
  id: string;
  name: string;
  code?: string;
  parentDepartmentId?: string;
  isActive: boolean;
}

export interface DepartmentHierarchyNode {
  id: string;
  name: string;
  code?: string;
  description?: string;
  parentDepartmentId?: string;
  headId?: string;
  headName?: string;
  isActive: boolean;
  memberCount: number;
  teamCount: number;
  children: DepartmentHierarchyNode[];
}

// ============================================================
// API METHODS
// ============================================================

export const departmentsApi = {
  getAll: async (query: DepartmentsQuery = {}): Promise<DepartmentsResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const { data } = await api.get(`/departments?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Department> => {
    const { data } = await api.get(`/departments/${id}`);
    return data;
  },

  create: async (dept: CreateDepartmentData): Promise<Department> => {
    const { data } = await api.post('/departments', dept);
    return data;
  },

  update: async (id: string, dept: UpdateDepartmentData): Promise<Department> => {
    const { data } = await api.put(`/departments/${id}`, dept);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/departments/${id}`);
    return data;
  },

  getHierarchy: async (): Promise<DepartmentHierarchyNode[]> => {
    const { data } = await api.get('/departments/hierarchy');
    return data;
  },

  getLookup: async (excludeId?: string): Promise<DepartmentLookupItem[]> => {
    const params = excludeId ? `?excludeId=${excludeId}` : '';
    const { data } = await api.get(`/departments/lookup${params}`);
    return data;
  },
};