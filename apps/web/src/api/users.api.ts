import { api } from './contacts.api';

export interface UserRole { id: string; name: string; level: number; }
export interface UserDepartment { id: string; name: string; code?: string; }
export interface UserManager { id: string; firstName: string; lastName: string; email?: string; }
export interface UserTeam { id: string; name: string; description?: string; role: string; joinedAt?: string; }
export interface UserTerritory { id: string; name: string; code?: string; type: string; role: string; }

export interface User {
  id: string; email: string; firstName: string; lastName: string;
  phone?: string; status: string; jobTitle?: string; avatarUrl?: string;
  timezone?: string; employeeId?: string; departmentId?: string; managerId?: string;
  lastLoginAt?: string; createdAt: string; updatedAt: string;
  role: UserRole | null; department: UserDepartment | null; manager: UserManager | null;
  teams?: UserTeam[]; territories?: UserTerritory[]; directReportsCount?: number;
}

export interface UsersResponse {
  data: User[];
  meta: { total: number; page: number; limit: number; totalPages: number; };
}

export interface UsersQuery {
  search?: string; departmentId?: string; teamId?: string; roleId?: string;
  status?: string; managerId?: string; page?: number; limit?: number;
  sortBy?: string; sortOrder?: 'ASC' | 'DESC';
}

export interface CreateUserData {
  email: string; firstName: string; lastName: string; password: string;
  roleId?: string; departmentId?: string; managerId?: string;
  jobTitle?: string; phone?: string; timezone?: string; employeeId?: string; teamIds?: string[];
}

export interface InviteUserData {
  email: string; firstName?: string; lastName?: string;
  roleId?: string; departmentId?: string; jobTitle?: string; teamIds?: string[];
}

export interface UpdateUserData {
  firstName?: string; lastName?: string; phone?: string; roleId?: string;
  departmentId?: string; managerId?: string; jobTitle?: string; avatarUrl?: string;
  timezone?: string; employeeId?: string; status?: string; teamIds?: string[];
}

export interface RoleLookup { id: string; name: string; description: string; level: number; is_system: boolean; is_custom: boolean; }
export interface DepartmentLookup { id: string; name: string; code: string; description?: string; parent_department_id?: string; }
export interface TeamLookup { id: string; name: string; description?: string; department_id?: string; }

export interface PendingInvitation {
  id: string; email: string; first_name?: string; last_name?: string;
  job_title?: string; status: string; expires_at: string; created_at: string;
  role_name?: string; department_name?: string;
  inviter_first_name?: string; inviter_last_name?: string;
}

export const usersApi = {
  getAll: async (query: UsersQuery = {}): Promise<UsersResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const { data } = await api.get(`/users?${params.toString()}`);
    return data;
  },
  getOne: async (id: string): Promise<User> => { const { data } = await api.get(`/users/${id}`); return data; },
  create: async (userData: CreateUserData): Promise<User> => { const { data } = await api.post('/users', userData); return data; },
  invite: async (inviteData: InviteUserData) => { const { data } = await api.post('/users/invite', inviteData); return data; },
  update: async (id: string, userData: UpdateUserData): Promise<User> => { const { data } = await api.put(`/users/${id}`, userData); return data; },
  deactivate: async (id: string) => { const { data } = await api.put(`/users/${id}/deactivate`); return data; },
  delete: async (id: string): Promise<void> => { await api.delete(`/users/${id}`); },
  getDirectReports: async (id: string): Promise<User[]> => { const { data } = await api.get(`/users/${id}/direct-reports`); return data; },
  getRoles: async (): Promise<RoleLookup[]> => { const { data } = await api.get('/users/lookup/roles'); return data; },
  getDepartments: async (): Promise<DepartmentLookup[]> => { const { data } = await api.get('/users/lookup/departments'); return data; },
  getTeams: async (): Promise<TeamLookup[]> => { const { data } = await api.get('/users/lookup/teams'); return data; },
  getPendingInvitations: async (): Promise<PendingInvitation[]> => { const { data } = await api.get('/users/invitations'); return data; },
  resendInvitation: async (id: string) => { const { data } = await api.post(`/users/invitations/${id}/resend`); return data; },
  cancelInvitation: async (id: string) => { const { data } = await api.delete(`/users/invitations/${id}`); return data; },
};