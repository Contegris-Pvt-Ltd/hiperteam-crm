import { create } from 'zustand';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
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

    // Fallback to /me endpoint
    try {
      const response = await api.get('/auth/me');
      set({ 
        user: {
          id: response.data.userId,
          email: response.data.email,
          firstName: '',
          lastName: '',
          role: response.data.role,
        },
        tenant: {
          id: response.data.tenantId,
          name: '',
          slug: response.data.tenantSlug,
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
}));