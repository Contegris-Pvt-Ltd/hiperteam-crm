import { api } from './contacts.api';

// ==================== TYPES ====================

export type WidgetType =
  | 'fields-section'
  | 'custom-tab'
  | 'field-group'
  | 'profile-completion'
  | 'related-records'
  | 'activity-timeline'
  | 'files-attachments'
  | 'notes'
  | 'tasks'
  | 'custom-html'
  | 'spacer'
  | 'divider';

export type LayoutTemplateType =
  | 'single-column'
  | 'two-column-equal'
  | 'two-column-wide-left'
  | 'two-column-wide-right'
  | 'three-column'
  | 'sidebar-left'
  | 'sidebar-right';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  collapsed?: boolean;
  section?: string;
  tabId?: string;
  groupId?: string;
  relatedModule?: string;
  maxItems?: number;
  showAddButton?: boolean;
  customContent?: string;
  height?: number;
}

export interface RegionConfig {
  id: string;
  widgets: WidgetConfig[];
}

export interface PageLayoutConfig {
  template: LayoutTemplateType;
  regions: Record<string, RegionConfig>;
  settings?: {
    showHeader?: boolean;
    headerStyle?: 'default' | 'compact' | 'hero';
    showBreadcrumb?: boolean;
    stickyHeader?: boolean;
  };
}

export interface PageLayout {
  id: string;
  module: string;
  layoutType: 'detail' | 'edit' | 'create';
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  config: PageLayoutConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetMetadata {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  configurable: string[];
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  regions: string[];
  preview: string;
}

// ==================== API ====================

export const pageLayoutApi = {
  // Get all layouts for a module
  getLayouts: async (module: string, layoutType?: 'detail' | 'edit' | 'create'): Promise<PageLayout[]> => {
    const params = new URLSearchParams({ module });
    if (layoutType) params.append('layoutType', layoutType);
    const response = await api.get<{ data: PageLayout[] }>(`/admin/page-layouts?${params}`);
    return response.data.data;
  },

  // Get active layout for runtime rendering
  getActiveLayout: async (module: string, layoutType: 'detail' | 'edit' | 'create'): Promise<PageLayoutConfig | null> => {
    const response = await api.get<{ data: PageLayout | null }>(`/admin/page-layouts/active/${module}/${layoutType}`);
    return response.data.data?.config || null;
  },

  // Get a specific layout
  getLayout: async (id: string): Promise<PageLayout> => {
    const response = await api.get<{ data: PageLayout }>(`/admin/page-layouts/${id}`);
    return response.data.data;
  },

  // Get available widgets
  getAvailableWidgets: async (): Promise<WidgetMetadata[]> => {
    const response = await api.get<{ data: WidgetMetadata[] }>('/admin/page-layouts/widgets');
    return response.data.data;
  },

  // Get available templates
  getAvailableTemplates: async (): Promise<TemplateMetadata[]> => {
    const response = await api.get<{ data: TemplateMetadata[] }>('/admin/page-layouts/templates');
    return response.data.data;
  },

  // Create a new layout
  createLayout: async (data: {
    module: string;
    layoutType: 'detail' | 'edit' | 'create';
    name: string;
    description?: string;
    config: PageLayoutConfig;
    isDefault?: boolean;
  }): Promise<PageLayout> => {
    const response = await api.post<{ data: PageLayout }>('/admin/page-layouts', data);
    return response.data.data;
  },

  // Update a layout
  updateLayout: async (id: string, data: {
    name?: string;
    description?: string;
    config?: PageLayoutConfig;
    isDefault?: boolean;
    isActive?: boolean;
  }): Promise<PageLayout> => {
    const response = await api.put<{ data: PageLayout }>(`/admin/page-layouts/${id}`, data);
    return response.data.data;
  },

  // Delete a layout
  deleteLayout: async (id: string): Promise<void> => {
    await api.delete(`/admin/page-layouts/${id}`);
  },

  // Duplicate a layout
  duplicateLayout: async (id: string, name: string): Promise<PageLayout> => {
    const response = await api.post<{ data: PageLayout }>(`/admin/page-layouts/${id}/duplicate`, { name });
    return response.data.data;
  },

  // Set as default
  setDefaultLayout: async (id: string): Promise<PageLayout> => {
    const response = await api.put<{ data: PageLayout }>(`/admin/page-layouts/${id}/set-default`);
    return response.data.data;
  },

  // Reset to system default
  resetToDefault: async (module: string, layoutType: 'detail' | 'edit' | 'create'): Promise<void> => {
    await api.post('/admin/page-layouts/reset-default', { module, layoutType });
  },
};