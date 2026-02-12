import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;

  // Role
  role: string;
  roleId?: string;
  roleLevel?: number;

  // RBAC — 3 levels
  permissions?: Record<string, Record<string, boolean>>;
  recordAccess?: Record<string, string>;
  fieldPermissions?: Record<string, Record<string, string>>;

  // Org context
  departmentId?: string;
  teamIds?: string[];
  managerId?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

interface RegisterData {
  companyName: string;
  companySlug: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (tenantSlug: string, email: string, password: string) => {
    const response = await api.post('/auth/login', { tenantSlug, email, password });
    const { user, tenant, accessToken, refreshToken } = response.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant', JSON.stringify(tenant));
    
    set({ user, tenant, isAuthenticated: true });
  },

  register: async (data: RegisterData) => {
    const response = await api.post('/auth/register', data);
    const { user, tenant, accessToken, refreshToken } = response.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant', JSON.stringify(tenant));
    
    set({ user, tenant, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    set({ user: null, tenant: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');

    if (!token) {
      set({ isLoading: false });
      return;
    }

    // First try to use stored user/tenant data
    if (storedUser && storedTenant) {
      set({
        user: JSON.parse(storedUser),
        tenant: JSON.parse(storedTenant),
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    // Fallback to /me endpoint — now returns full RBAC context
    try {
      const response = await api.get('/auth/me');
      const data = response.data;

      const user: User = {
        id: data.userId,
        email: data.email,
        firstName: '',
        lastName: '',
        role: data.role,
        roleId: data.roleId,
        roleLevel: data.roleLevel,
        permissions: data.permissions,
        recordAccess: data.recordAccess,
        fieldPermissions: data.fieldPermissions,
        departmentId: data.departmentId,
        teamIds: data.teamIds,
        managerId: data.managerId,
      };

      set({ 
        user,
        tenant: {
          id: data.tenantId,
          name: '',
          slug: data.tenantSlug,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      set({ isLoading: false });
    }
  },

  /**
   * Update specific user fields without re-fetching.
   * Useful after profile edits, role changes, etc.
   */
  updateUser: (updates: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      const updatedUser = { ...state.user, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return { user: updatedUser };
    });
  },
}));