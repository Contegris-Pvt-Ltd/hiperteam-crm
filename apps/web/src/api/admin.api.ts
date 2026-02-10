import { api } from './contacts.api';
import type { PageLayout } from './page-layout.api';

// ==================== INTERFACES ====================

export interface CustomField {
  id: string;
  module: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'textarea' | 'url' | 'email' | 'phone' | 'file';
  fieldOptions: { label: string; value: string }[];
  isRequired: boolean;
  defaultValue: string | null;
  validationRules: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  displayOrder: number;
  placeholder: string | null;
  helpText: string | null;
  includeInCompletion: boolean;
  completionWeight: number;
  isActive: boolean;
  dependsOnFieldId: string | null;
  dependsOnField?: { id: string; fieldKey: string; fieldLabel: string };
  conditionalOptions: Record<string, { label: string; value: string }[]>;
  // New fields
  groupId: string | null;
  tabId: string | null;
  section: string;
  columnSpan: number;
  group?: { id: string; name: string };
  tab?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CustomTab {
  id: string;
  name: string;
  module: string;
  icon: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldGroup {
  id: string;
  name: string;
  module: string;
  tabId: string | null;
  section: string | null;
  icon: string | null;
  description: string | null;
  displayOrder: number;
  collapsedByDefault: boolean;
  columns: number;
  isActive: boolean;
  tab?: { id: string; name: string };
  fieldCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletionConfig {
  module: string;
  fieldWeights: Record<string, { weight: number; label: string; category?: string }>;
  isEnabled: boolean;
  minPercentage: number;
}

export interface ModuleLayoutSetting {
  id: string;
  tenantId: string;
  module: string;
  layoutType: string;
  useCustomLayout: boolean;
  layoutId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutCheckResult {
  useCustomLayout: boolean;
  config: Record<string, unknown> | null;
}

// ==================== API ====================

export const adminApi = {
  // ==================== CUSTOM FIELDS ====================
  
  getCustomFields: async (module: string): Promise<CustomField[]> => {
    const response = await api.get<CustomField[]>(`/admin/custom-fields?module=${module}`);
    return response.data;
  },

  getCustomField: async (id: string): Promise<CustomField> => {
    const response = await api.get<CustomField>(`/admin/custom-fields/${id}`);
    return response.data;
  },

  createCustomField: async (data: Partial<CustomField>): Promise<CustomField> => {
    const response = await api.post<CustomField>('/admin/custom-fields', data);
    return response.data;
  },

  updateCustomField: async (id: string, data: Partial<CustomField>): Promise<CustomField> => {
    const response = await api.put<CustomField>(`/admin/custom-fields/${id}`, data);
    return response.data;
  },

  toggleCustomField: async (id: string): Promise<CustomField> => {
    const response = await api.put<CustomField>(`/admin/custom-fields/${id}/toggle`);
    return response.data;
  },

  deleteCustomField: async (id: string): Promise<void> => {
    await api.delete(`/admin/custom-fields/${id}`);
  },

  reorderCustomFields: async (module: string, fieldIds: string[]): Promise<CustomField[]> => {
    const response = await api.put<CustomField[]>(`/admin/custom-fields/reorder/${module}`, { fieldIds });
    return response.data;
  },

  // ==================== CUSTOM TABS ====================

  getTabs: async (module?: string): Promise<CustomTab[]> => {
    const url = module ? `/admin/tabs?module=${module}` : '/admin/tabs';
    const response = await api.get<CustomTab[]>(url);
    return response.data;
  },

  getTab: async (id: string): Promise<CustomTab> => {
    const response = await api.get<CustomTab>(`/admin/tabs/${id}`);
    return response.data;
  },

  createTab: async (data: { name: string; module: string; icon?: string; description?: string }): Promise<CustomTab> => {
    const response = await api.post<CustomTab>('/admin/tabs', data);
    return response.data;
  },

  updateTab: async (id: string, data: Partial<CustomTab>): Promise<CustomTab> => {
    const response = await api.put<CustomTab>(`/admin/tabs/${id}`, data);
    return response.data;
  },

  deleteTab: async (id: string): Promise<void> => {
    await api.delete(`/admin/tabs/${id}`);
  },

  reorderTabs: async (module: string, tabIds: string[]): Promise<CustomTab[]> => {
    const response = await api.put<CustomTab[]>(`/admin/tabs/reorder/${module}`, { tabIds });
    return response.data;
  },

  // ==================== CUSTOM FIELD GROUPS ====================

  getGroups: async (params?: { module?: string; section?: string; tabId?: string }): Promise<CustomFieldGroup[]> => {
    const searchParams = new URLSearchParams();
    if (params?.module) searchParams.append('module', params.module);
    if (params?.section) searchParams.append('section', params.section);
    if (params?.tabId) searchParams.append('tabId', params.tabId);
    
    const url = `/admin/groups${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await api.get<CustomFieldGroup[]>(url);
    return response.data;
  },

  getGroup: async (id: string): Promise<CustomFieldGroup> => {
    const response = await api.get<CustomFieldGroup>(`/admin/groups/${id}`);
    return response.data;
  },

  createGroup: async (data: {
    name: string;
    module: string;
    tabId?: string;
    section?: string;
    icon?: string;
    description?: string;
    collapsedByDefault?: boolean;
    columns?: number;
  }): Promise<CustomFieldGroup> => {
    const response = await api.post<CustomFieldGroup>('/admin/groups', data);
    return response.data;
  },

  updateGroup: async (id: string, data: Partial<CustomFieldGroup>): Promise<CustomFieldGroup> => {
    const response = await api.put<CustomFieldGroup>(`/admin/groups/${id}`, data);
    return response.data;
  },

  deleteGroup: async (id: string): Promise<void> => {
    await api.delete(`/admin/groups/${id}`);
  },

  reorderGroups: async (module: string, groupIds: string[]): Promise<CustomFieldGroup[]> => {
    const response = await api.put<CustomFieldGroup[]>(`/admin/groups/reorder/${module}`, { groupIds });
    return response.data;
  },

  // ==================== PROFILE COMPLETION ====================

  getProfileCompletionConfig: async (module: string): Promise<{ config: ProfileCompletionConfig; standardFields: Record<string, { weight: number; label: string; category: string }> }> => {
    const response = await api.get(`/admin/profile-completion/${module}`);
    return response.data;
  },

  updateProfileCompletionConfig: async (module: string, data: {
    isEnabled?: boolean;
    minPercentage?: number;
    fieldWeights?: Record<string, { weight: number; label: string; category?: string }>;
  }): Promise<ProfileCompletionConfig> => {
    const response = await api.put<ProfileCompletionConfig>(`/admin/profile-completion/${module}`, data);
    return response.data;
  },

  // ==================== MODULE LAYOUT SETTINGS ====================

  getModuleLayoutSettings: async (): Promise<ModuleLayoutSetting[]> => {
    const response = await api.get<{ data: ModuleLayoutSetting[] }>('/admin/module-layout-settings');
    return response.data.data;
  },

  checkModuleLayout: async (module: string, layoutType: string): Promise<LayoutCheckResult> => {
    const response = await api.get<LayoutCheckResult>('/admin/module-layout-settings/check', {
      params: { module, layoutType },
    });
    return response.data;
  },

  getAvailableLayoutsForModule: async (module: string, layoutType: string): Promise<PageLayout[]> => {
    const response = await api.get<{ data: PageLayout[] }>('/admin/module-layout-settings/available-layouts', {
      params: { module, layoutType },
    });
    return response.data.data;
  },

  updateModuleLayoutSetting: async (
    module: string,
    layoutType: string,
    useCustomLayout: boolean,
    layoutId?: string,
  ): Promise<ModuleLayoutSetting> => {
    const response = await api.put<{ data: ModuleLayoutSetting }>('/admin/module-layout-settings', {
      module,
      layoutType,
      useCustomLayout,
      layoutId,
    });
    return response.data.data;
  },
};