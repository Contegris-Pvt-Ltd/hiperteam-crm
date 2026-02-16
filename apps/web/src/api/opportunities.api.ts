// ============================================================
// FILE: apps/web/src/api/opportunities.api.ts
// ============================================================
import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface OpportunityPriority {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
}

export interface OpportunityCloseReason {
  id: string;
  type: 'won' | 'lost';
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface OpportunityStage {
  id: string;
  pipelineId: string;
  pipelineName?: string;
  module: string;
  name: string;
  slug: string;
  color: string;
  description?: string;
  probability: number;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  isSystem: boolean;
  isActive: boolean;
  requiredFields: string[];
  visibleFields: string[];
  autoActions: any[];
  exitCriteria: string[];
  lockPreviousFields: boolean;
  opportunityCount?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  leadStageCount: number;
  oppStageCount: number;
  leadCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityOwner {
  id: string;
  firstName: string;
  lastName: string;
}

export interface OpportunityContact {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  role: string;
  isPrimary: boolean;
  addedAt: string;
}

export interface OpportunityLineItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  totalPrice: number;
  billingFrequency: 'one_time' | 'monthly' | 'annually';
  sortOrder: number;
  createdAt: string;
}

export interface StageHistoryEntry {
  id: string;
  fromStageId: string | null;
  fromStageName: string | null;
  fromStageColor: string | null;
  toStageId: string;
  toStageName: string;
  toStageColor: string;
  changedBy: string;
  changedByFirstName: string;
  changedByLastName: string;
  reason: string | null;
  timeInStage: number | null; // seconds
  createdAt: string;
}

export interface ForecastCategory {
  category: string;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  opportunities: ForecastOpportunity[];
}

export interface ForecastOpportunity {
  id: string;
  name: string;
  amount: number;
  weightedAmount: number;
  probability: number;
  closeDate: string;
  stageName: string;
  ownerName: string;
}

export interface Opportunity {
  id: string;
  name: string;
  pipelineId: string | null;
  pipeline: { id: string; name: string } | null;
  stageId: string | null;
  stage: OpportunityStage | null;
  amount: number | null;
  currency: string;
  weightedAmount: number | null;
  probability: number | null;
  forecastCategory: string | null;
  closeDate: string | null;
  type: string | null;
  source: string | null;
  nextStep: string | null;
  description: string | null;
  competitor: string | null;
  tags: string[];
  customFields: Record<string, any>;
  priorityId: string | null;
  priority: OpportunityPriority | null;
  accountId: string | null;
  account: { id: string; name: string } | null;
  primaryContactId: string | null;
  primaryContact: { id: string; firstName: string; lastName: string } | null;
  ownerId: string | null;
  owner: OpportunityOwner | null;
  closeReasonId: string | null;
  closeReason: OpportunityCloseReason | null;
  closeNotes: string | null;
  stageEnteredAt: string;
  lastActivityAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByUser: OpportunityOwner | null;
  // Enrichment (detail view only)
  teamMembers?: any[];
  stageFields?: any[];
  allStages?: OpportunityStage[];
  stageSettings?: Record<string, any>;
  profileCompletion?: any;
}

export interface OpportunitiesResponse {
  data: Opportunity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface KanbanStageData {
  id: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  count: number;
  totalAmount: number;
  weightedAmount: number;
  opportunities: Opportunity[];
}

export interface OpportunitiesQuery {
  search?: string;
  pipelineId?: string;
  stageId?: string;
  stageSlug?: string;
  priorityId?: string;
  forecastCategory?: string;
  source?: string;
  type?: string;
  accountId?: string;
  ownerId?: string;
  tag?: string;
  amountMin?: number;
  amountMax?: number;
  closeDateFrom?: string;
  closeDateTo?: string;
  status?: 'open' | 'won' | 'lost';
  ownership?: 'my_deals' | 'my_team' | 'created_by_me' | 'all';
  view?: 'list' | 'kanban';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateOpportunityData {
  name: string;
  pipelineId: string;
  stageId?: string;
  amount?: number;
  currency?: string;
  probability?: number;
  forecastCategory?: string;
  closeDate?: string;
  type?: string;
  source?: string;
  nextStep?: string;
  description?: string;
  competitor?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  priorityId?: string;
  accountId?: string;
  primaryContactId?: string;
  ownerId?: string;
}

// ============================================================
// OPPORTUNITIES API
// ============================================================

export const opportunitiesApi = {
  // ── CRUD ──
  getAll: async (query: OpportunitiesQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/opportunities?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Opportunity> => {
    const { data } = await api.get(`/opportunities/${id}`);
    return data;
  },

  create: async (opportunityData: CreateOpportunityData): Promise<Opportunity> => {
    const { data } = await api.post('/opportunities', opportunityData);
    return data;
  },

  update: async (id: string, opportunityData: Partial<CreateOpportunityData>): Promise<Opportunity> => {
    const { data } = await api.put(`/opportunities/${id}`, opportunityData);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/opportunities/${id}`);
    return data;
  },

  // ── Stage management ──
  changeStage: async (id: string, stageId: string, stageFields?: Record<string, any>, unlockReason?: string) => {
    const { data } = await api.post(`/opportunities/${id}/change-stage`, { stageId, stageFields, unlockReason });
    return data;
  },

  closeWon: async (id: string, payload: {
    closeDate?: string;
    finalAmount?: number;
    closeReasonId: string;
    closeNotes?: string;
    competitor?: string;
    createFollowUpTask?: boolean;
    followUpTaskTitle?: string;
  }) => {
    const { data } = await api.post(`/opportunities/${id}/close-won`, payload);
    return data;
  },

  closeLost: async (id: string, payload: {
    closeDate?: string;
    closeReasonId: string;
    closeNotes?: string;
    competitor?: string;
    createFollowUpTask?: boolean;
    followUpMonths?: number;
  }) => {
    const { data } = await api.post(`/opportunities/${id}/close-lost`, payload);
    return data;
  },

  reopen: async (id: string, payload: {
    stageId: string;
    reason: string;
    probability?: number;
  }) => {
    const { data } = await api.post(`/opportunities/${id}/reopen`, payload);
    return data;
  },

  // ── Stage history ──
  getStageHistory: async (id: string): Promise<StageHistoryEntry[]> => {
    const { data } = await api.get(`/opportunities/${id}/stage-history`);
    return data;
  },

  // ── Contact roles ──
  getContactRoles: async (id: string): Promise<OpportunityContact[]> => {
    const { data } = await api.get(`/opportunities/${id}/contacts`);
    return data;
  },

  addContactRole: async (id: string, contactId: string, role: string, isPrimary?: boolean) => {
    const { data } = await api.post(`/opportunities/${id}/contacts`, { contactId, role, isPrimary });
    return data;
  },

  removeContactRole: async (id: string, contactRoleId: string) => {
    const { data } = await api.delete(`/opportunities/${id}/contacts/${contactRoleId}`);
    return data;
  },

  // ── Line items ──
  getLineItems: async (id: string): Promise<OpportunityLineItem[]> => {
    const { data } = await api.get(`/opportunities/${id}/line-items`);
    return data;
  },

  addLineItem: async (id: string, item: {
    productId: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    description?: string;
    sortOrder?: number;
  }) => {
    const { data } = await api.post(`/opportunities/${id}/line-items`, item);
    return data;
  },

  updateLineItem: async (id: string, lineItemId: string, item: {
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    description?: string;
    sortOrder?: number;
  }) => {
    const { data } = await api.put(`/opportunities/${id}/line-items/${lineItemId}`, item);
    return data;
  },

  removeLineItem: async (id: string, lineItemId: string) => {
    const { data } = await api.delete(`/opportunities/${id}/line-items/${lineItemId}`);
    return data;
  },

  // ── Forecast ──
  getForecast: async (pipelineId?: string, ownerId?: string, period?: string): Promise<ForecastCategory[]> => {
    const params = new URLSearchParams();
    if (pipelineId) params.append('pipelineId', pipelineId);
    if (ownerId) params.append('ownerId', ownerId);
    if (period) params.append('period', period);
    const { data } = await api.get(`/opportunities/forecast?${params.toString()}`);
    return data;
  },

  // ── Record team ──
  getTeamMembers: async (id: string) => {
    const { data } = await api.get(`/opportunities/${id}/team`);
    return data;
  },

  addTeamMember: async (id: string, userId: string, roleId?: string, roleName?: string, accessLevel?: string) => {
    const { data } = await api.post(`/opportunities/${id}/team`, { userId, roleId, roleName, accessLevel });
    return data;
  },

  removeTeamMember: async (id: string, userId: string) => {
    const { data } = await api.delete(`/opportunities/${id}/team/${userId}`);
    return data;
  },

  // ── Activities, notes, docs ──
  getActivities: async (id: string, page = 1, limit = 20) => {
    const { data } = await api.get(`/opportunities/${id}/activities?page=${page}&limit=${limit}`);
    return data;
  },

  getHistory: async (id: string) => {
    const { data } = await api.get(`/opportunities/${id}/history`);
    return data;
  },

  getNotes: async (id: string) => {
    const { data } = await api.get(`/opportunities/${id}/notes`);
    return data;
  },

  addNote: async (id: string, content: string) => {
    const { data } = await api.post(`/opportunities/${id}/notes`, { content });
    return data;
  },

  getDocuments: async (id: string) => {
    const { data } = await api.get(`/opportunities/${id}/documents`);
    return data;
  },

  checkDuplicates: async (
    name: string,
    accountId?: string,
    excludeId?: string,
  ): Promise<{ id: string; name: string; accountName?: string; stageName?: string; amount?: number; ownerName?: string }[]> => {
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (accountId) params.append('accountId', accountId);
    if (excludeId) params.append('excludeId', excludeId);
    const { data } = await api.get(`/opportunities/check-duplicates?${params.toString()}`);
    return data;
  },
};

// ============================================================
// OPPORTUNITY SETTINGS API
// (Uses lead-settings endpoints since pipelines/stages are shared)
// ============================================================

export const opportunitySettingsApi = {
  // Pipelines (shared with leads — same endpoints)
  getPipelines: async (): Promise<Pipeline[]> => {
    const { data } = await api.get('/lead-settings/pipelines');
    return data;
  },

  // Stages filtered by module=opportunities
  getStages: async (pipelineId?: string): Promise<OpportunityStage[]> => {
    const params = new URLSearchParams({ module: 'opportunities' });
    if (pipelineId) params.append('pipelineId', pipelineId);
    const { data } = await api.get(`/lead-settings/stages?${params.toString()}`);
    return data;
  },

  getStageFields: async (stageId: string) => {
    const { data } = await api.get(`/lead-settings/stages/${stageId}/fields`);
    return data;
  },

  // Priorities (opportunities-specific)
  getPriorities: async (): Promise<OpportunityPriority[]> => {
    const { data } = await api.get('/opportunity-settings/priorities');
    return data;
  },

  createPriority: async (priority: { name: string; color?: string; icon?: string; sortOrder?: number }) => {
    const { data } = await api.post('/opportunity-settings/priorities', priority);
    return data;
  },

  updatePriority: async (id: string, updates: Partial<OpportunityPriority>) => {
    const { data } = await api.put(`/opportunity-settings/priorities/${id}`, updates);
    return data;
  },

  deletePriority: async (id: string) => {
    const { data } = await api.delete(`/opportunity-settings/priorities/${id}`);
    return data;
  },

  // Close reasons (opportunities-specific)
  getCloseReasons: async (): Promise<OpportunityCloseReason[]> => {
    const { data } = await api.get('/opportunity-settings/close-reasons');
    return data;
  },

  getWonReasons: async (): Promise<OpportunityCloseReason[]> => {
    const reasons = await opportunitySettingsApi.getCloseReasons();
    return reasons.filter(r => r.type === 'won');
  },

  getLostReasons: async (): Promise<OpportunityCloseReason[]> => {
    const reasons = await opportunitySettingsApi.getCloseReasons();
    return reasons.filter(r => r.type === 'lost');
  },

  createCloseReason: async (reason: { type: string; name: string; description?: string; sortOrder?: number }) => {
    const { data } = await api.post('/opportunity-settings/close-reasons', reason);
    return data;
  },

  updateCloseReason: async (id: string, updates: Partial<OpportunityCloseReason>) => {
    const { data } = await api.put(`/opportunity-settings/close-reasons/${id}`, updates);
    return data;
  },

  deleteCloseReason: async (id: string) => {
    const { data } = await api.delete(`/opportunity-settings/close-reasons/${id}`);
    return data;
  },

  // Sources (shared with leads)
  getSources: async (): Promise<{ id: string; name: string }[]> => {
    const { data } = await api.get('/lead-settings/sources');
    return data;
  },

  // Sources CRUD (shared with leads)
  createSource: async (sourceData: { name: string; description?: string }): Promise<any> => {
    const { data } = await api.post('/lead-settings/sources', sourceData);
    return data;
  },

  deleteSource: async (id: string): Promise<void> => {
    await api.delete(`/lead-settings/sources/${id}`);
  },

  // Pipeline CRUD (shared with leads)
  createPipeline: async (pipelineData: { name: string; description?: string; isDefault?: boolean }): Promise<any> => {
    const { data } = await api.post('/lead-settings/pipelines', pipelineData);
    return data;
  },
  updatePipeline: async (id: string, updates: any): Promise<any> => {
    const { data } = await api.put(`/lead-settings/pipelines/${id}`, updates);
    return data;
  },
  deletePipeline: async (id: string): Promise<void> => {
    await api.delete(`/lead-settings/pipelines/${id}`);
  },
  setDefaultPipeline: async (id: string): Promise<any> => {
    const { data } = await api.post(`/lead-settings/pipelines/${id}/set-default`);
    return data;
  },

  // Stage CRUD (for opportunities module)
  createStage: async (stageData: { pipelineId: string; name: string; color?: string; module?: string }): Promise<any> => {
    const { data } = await api.post('/lead-settings/stages', { ...stageData, module: 'opportunities' });
    return data;
  },
  updateStage: async (id: string, updates: any): Promise<any> => {
    const { data } = await api.put(`/lead-settings/stages/${id}`, updates);
    return data;
  },
  deleteStage: async (id: string): Promise<void> => {
    await api.delete(`/lead-settings/stages/${id}`);
  },
  reorderStages: async (orderedIds: string[]): Promise<any> => {
    const { data } = await api.put('/lead-settings/stages/reorder', { orderedIds });
    return data;
  },
  
  // Types
  getTypes: async (): Promise<any[]> => {
    const { data } = await api.get('/opportunity-settings/types');
    return data;
  },
  getAllTypes: async (): Promise<any[]> => {
    const { data } = await api.get('/opportunity-settings/types/all');
    return data;
  },
  createType: async (typeData: { name: string; color?: string; description?: string }): Promise<any> => {
    const { data } = await api.post('/opportunity-settings/types', typeData);
    return data;
  },
  updateType: async (id: string, typeData: any): Promise<any> => {
    const { data } = await api.put(`/opportunity-settings/types/${id}`, typeData);
    return data;
  },
  deleteType: async (id: string): Promise<void> => {
    await api.delete(`/opportunity-settings/types/${id}`);
  },

  // Forecast Categories
  getForecastCategories: async (): Promise<any[]> => {
    const { data } = await api.get('/opportunity-settings/forecast-categories');
    return data;
  },
  getAllForecastCategories: async (): Promise<any[]> => {
    const { data } = await api.get('/opportunity-settings/forecast-categories/all');
    return data;
  },
  createForecastCategory: async (catData: { name: string; color?: string; probabilityMin?: number; probabilityMax?: number }): Promise<any> => {
    const { data } = await api.post('/opportunity-settings/forecast-categories', catData);
    return data;
  },
  updateForecastCategory: async (id: string, catData: any): Promise<any> => {
    const { data } = await api.put(`/opportunity-settings/forecast-categories/${id}`, catData);
    return data;
  },
  deleteForecastCategory: async (id: string): Promise<void> => {
    await api.delete(`/opportunity-settings/forecast-categories/${id}`);
  },

};