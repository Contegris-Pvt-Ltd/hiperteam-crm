import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface TeamLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  avatarUrl?: string;
  status: string;
  roleName?: string;
  teamRole: string;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  departmentId?: string;
  departmentName?: string;
  teamLeadId?: string;
  teamLead: TeamLead | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  // Detail-only
  members?: TeamMember[];
}

export interface TeamsResponse {
  data: Team[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface TeamsQuery {
  search?: string;
  isActive?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateTeamData {
  name: string;
  description?: string;
  departmentId?: string;
  teamLeadId?: string;
  isActive?: boolean;
  memberIds?: string[];
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  departmentId?: string | null;
  teamLeadId?: string | null;
  isActive?: boolean;
}

export interface AddMemberData {
  userId: string;
  role?: 'member' | 'lead';
}

export interface TeamLookupItem {
  id: string;
  name: string;
  departmentId?: string;
  departmentName?: string;
  isActive: boolean;
}

// ============================================================
// API METHODS
// ============================================================

export const teamsApi = {
  getAll: async (query: TeamsQuery = {}): Promise<TeamsResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.append(key, String(value));
    });
    const { data } = await api.get(`/teams?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Team> => {
    const { data } = await api.get(`/teams/${id}`);
    return data;
  },

  create: async (team: CreateTeamData): Promise<Team> => {
    const { data } = await api.post('/teams', team);
    return data;
  },

  update: async (id: string, team: UpdateTeamData): Promise<Team> => {
    const { data } = await api.put(`/teams/${id}`, team);
    return data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/teams/${id}`);
    return data;
  },

  addMember: async (teamId: string, member: AddMemberData): Promise<Team> => {
    const { data } = await api.post(`/teams/${teamId}/members`, member);
    return data;
  },

  removeMember: async (teamId: string, userId: string): Promise<Team> => {
    const { data } = await api.delete(`/teams/${teamId}/members/${userId}`);
    return data;
  },

  getLookup: async (departmentId?: string): Promise<TeamLookupItem[]> => {
    const params = departmentId ? `?departmentId=${departmentId}` : '';
    const { data } = await api.get(`/teams/lookup${params}`);
    return data;
  },
};