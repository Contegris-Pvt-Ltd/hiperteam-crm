// ============================================================
// FILE: apps/web/src/api/leads.api.ts
// ============================================================
import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface LeadStage {
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
  leadCount?: number;
}

export interface LeadPriority {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  isDefault: boolean;
  scoreMin: number | null;
  scoreMax: number | null;
  isActive: boolean;
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

export interface LeadOwner {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  roleId?: string;
  roleName: string;
  accessLevel: string;
  addedAt: string;
}

export interface DuplicateMatch {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  company?: string;
  entityType: 'lead' | 'contact' | 'account';
  matchType: 'email' | 'phone' | 'domain';
}

export interface QualificationField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  fieldOptions: { label: string; value: string }[];
  scoreWeight: number;
  sortOrder: number;
  isRequired: boolean;
}

export interface Lead {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emails: { type: string; email: string; primary?: boolean }[];
  phones: { type: string; number: string; primary?: boolean }[];
  addresses: any[];
  socialProfiles: Record<string, string>;
  source: string | null;
  sourceDetails: Record<string, any>;
  pipelineId: string | null;
  pipeline: { id: string; name: string } | null;
  stageId: string | null;
  stage: LeadStage | null;
  priorityId: string | null;
  priority: LeadPriority | null;
  score: number;
  scoreBreakdown: Record<string, any>;
  qualification: Record<string, any>;
  qualificationFrameworkId: string | null;
  qualificationFramework: { id: string; name: string; slug: string } | null;
  convertedAt: string | null;
  convertedContactId: string | null;
  convertedAccountId: string | null;
  convertedOpportunityId: string | null;
  disqualifiedAt: string | null;
  disqualificationReasonName: string | null;
  stageEnteredAt: string;
  stageHistory: any[];
  doNotContact: boolean;
  doNotEmail: boolean;
  doNotCall: boolean;
  tags: string[];
  customFields: Record<string, any>;
  ownerId: string | null;
  owner: LeadOwner | null;
  createdBy: string;
  createdByUser: LeadOwner | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Enrichment (only on detail)
  teamMembers?: TeamMember[];
  qualificationFields?: QualificationField[];
  stageFields?: any[];
  allStages?: LeadStage[];
  stageSettings?: Record<string, any>;
  duplicates?: DuplicateMatch[];
}

export interface LeadsQuery {
  search?: string;
  pipelineId?: string;
  stageId?: string;
  stageSlug?: string;
  priorityId?: string;
  source?: string;
  ownerId?: string;
  tag?: string;
  company?: string;
  scoreMin?: number;
  scoreMax?: number;
  convertedStatus?: string;
  ownership?: string;
  view?: 'list' | 'kanban';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
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
  leads: Lead[];
}

export interface CreateLeadData {
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emails?: { type: string; email: string; primary?: boolean }[];
  phones?: { type: string; number: string; primary?: boolean }[];
  addresses?: any[];
  socialProfiles?: Record<string, string>;
  source?: string;
  sourceDetails?: Record<string, any>;
  pipelineId?: string;
  stageId?: string;
  priorityId?: string;
  qualification?: Record<string, any>;
  qualificationFrameworkId?: string;
  doNotContact?: boolean;
  doNotEmail?: boolean;
  doNotCall?: boolean;
  tags?: string[];
  customFields?: Record<string, any>;
  ownerId?: string;
}

export interface ConvertLeadData {
  contactAction: 'create_new' | 'merge_existing';
  existingContactId?: string;
  accountAction: 'create_new' | 'link_existing' | 'skip';
  existingAccountId?: string;
  accountName?: string;
  createOpportunity?: boolean;
  opportunityName?: string;
  pipelineId?: string;
  opportunityStageId?: string;
  amount?: number;
  closeDate?: string;
  newOwnerId?: string;
  notes?: string;
}

// ============================================================
// LEADS API
// ============================================================

export const leadsApi = {
  // CRUD
  getAll: async (query: LeadsQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const { data } = await api.get(`/leads?${params.toString()}`);
    return data;
  },

  getOne: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },

  create: async (leadData: CreateLeadData): Promise<Lead> => {
    const { data } = await api.post('/leads', leadData);
    return data;
  },

  update: async (id: string, leadData: Partial<CreateLeadData>): Promise<Lead> => {
    const { data } = await api.put(`/leads/${id}`, leadData);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`/leads/${id}`);
    return data;
  },

  // Stage management
  changeStage: async (id: string, stageId: string, stageFields?: Record<string, any>, unlockReason?: string) => {
    const { data } = await api.post(`/leads/${id}/change-stage`, { stageId, stageFields, unlockReason });
    return data;
  },

  disqualify: async (id: string, reasonId: string, notes?: string) => {
    const { data } = await api.post(`/leads/${id}/disqualify`, { reasonId, notes });
    return data;
  },

  convert: async (id: string, conversionData: ConvertLeadData) => {
    const { data } = await api.post(`/leads/${id}/convert`, conversionData);
    return data;
  },

  // Duplicate check
  checkDuplicates: async (email?: string, phone?: string, excludeId?: string): Promise<DuplicateMatch[]> => {
    const params = new URLSearchParams();
    if (email) params.append('email', email);
    if (phone) params.append('phone', phone);
    if (excludeId) params.append('excludeId', excludeId);
    const { data } = await api.get(`/leads/check-duplicates?${params.toString()}`);
    return data;
  },

  // Record team
  getTeamMembers: async (id: string): Promise<TeamMember[]> => {
    const { data } = await api.get(`/leads/${id}/team`);
    return data;
  },

  addTeamMember: async (id: string, userId: string, roleId?: string, roleName?: string, accessLevel?: string) => {
    const { data } = await api.post(`/leads/${id}/team`, { userId, roleId, roleName, accessLevel });
    return data;
  },

  removeTeamMember: async (id: string, userId: string) => {
    const { data } = await api.delete(`/leads/${id}/team/${userId}`);
    return data;
  },

  // Activities, notes, docs, history
  getActivities: async (id: string, page = 1, limit = 20) => {
    const { data } = await api.get(`/leads/${id}/activities?page=${page}&limit=${limit}`);
    return data;
  },

  getHistory: async (id: string) => {
    const { data } = await api.get(`/leads/${id}/history`);
    return data;
  },

  getNotes: async (id: string) => {
    const { data } = await api.get(`/leads/${id}/notes`);
    return data;
  },

  addNote: async (id: string, content: string) => {
    const { data } = await api.post(`/leads/${id}/notes`, { content });
    return data;
  },

  getDocuments: async (id: string) => {
    const { data } = await api.get(`/leads/${id}/documents`);
    return data;
  },
};

// ============================================================
// LEAD SETTINGS API
// ============================================================

export const leadSettingsApi = {
  // Pipelines
  getPipelines: async (): Promise<Pipeline[]> => {
    const { data } = await api.get('/lead-settings/pipelines');
    return data;
  },
  getPipeline: async (id: string): Promise<Pipeline> => {
    const { data } = await api.get(`/lead-settings/pipelines/${id}`);
    return data;
  },
  createPipeline: async (pipelineData: { name: string; description?: string; isDefault?: boolean }) => {
    const { data } = await api.post('/lead-settings/pipelines', pipelineData);
    return data;
  },
  updatePipeline: async (id: string, pipelineData: Partial<Pipeline>) => {
    const { data } = await api.put(`/lead-settings/pipelines/${id}`, pipelineData);
    return data;
  },
  deletePipeline: async (id: string) => {
    const { data } = await api.delete(`/lead-settings/pipelines/${id}`);
    return data;
  },
  setDefaultPipeline: async (id: string) => {
    const { data } = await api.post(`/lead-settings/pipelines/${id}/set-default`);
    return data;
  },
  // Stages
  getStages: async (pipelineId?: string, module: string = 'leads'): Promise<LeadStage[]> => {
    const params: Record<string, string> = { module };
    if (pipelineId) params.pipelineId = pipelineId;
    const { data } = await api.get('/lead-settings/stages', { params });
    return data;
  },
  createStage: async (stageData: any) => {
    const { data } = await api.post('/lead-settings/stages', stageData);
    return data;
  },
  updateStage: async (id: string, stageData: any) => {
    const { data } = await api.put(`/lead-settings/stages/${id}`, stageData);
    return data;
  },
  deleteStage: async (id: string) => {
    const { data } = await api.delete(`/lead-settings/stages/${id}`);
    return data;
  },
  reorderStages: async (orderedIds: string[]) => {
    const { data } = await api.put('/lead-settings/stages/reorder', { orderedIds });
    return data;
  },
  getStageFields: async (stageId: string) => {
    const { data } = await api.get(`/lead-settings/stages/${stageId}/fields`);
    return data;
  },
  upsertStageFields: async (stageId: string, fields: any[]) => {
    const { data } = await api.put(`/lead-settings/stages/${stageId}/fields`, { fields });
    return data;
  },

  // Priorities
  getPriorities: async (): Promise<LeadPriority[]> => {
    const { data } = await api.get('/lead-settings/priorities');
    return data;
  },
  createPriority: async (priorityData: any) => {
    const { data } = await api.post('/lead-settings/priorities', priorityData);
    return data;
  },
  updatePriority: async (id: string, priorityData: any) => {
    const { data } = await api.put(`/lead-settings/priorities/${id}`, priorityData);
    return data;
  },
  deletePriority: async (id: string) => {
    const { data } = await api.delete(`/lead-settings/priorities/${id}`);
    return data;
  },

  // Scoring
  getScoringTemplates: async () => {
    const { data } = await api.get('/lead-settings/scoring');
    return data;
  },
  createScoringRule: async (templateId: string, ruleData: any) => {
    const { data } = await api.post(`/lead-settings/scoring/${templateId}/rules`, ruleData);
    return data;
  },
  updateScoringRule: async (ruleId: string, ruleData: any) => {
    const { data } = await api.put(`/lead-settings/scoring/rules/${ruleId}`, ruleData);
    return data;
  },
  deleteScoringRule: async (ruleId: string) => {
    const { data } = await api.delete(`/lead-settings/scoring/rules/${ruleId}`);
    return data;
  },
  rescoreAll: async () => {
    const { data } = await api.post('/lead-settings/scoring/rescore-all');
    return data;
  },

  // Routing
  getRoutingRules: async () => {
    const { data } = await api.get('/lead-settings/routing');
    return data;
  },
  createRoutingRule: async (ruleData: any) => {
    const { data } = await api.post('/lead-settings/routing', ruleData);
    return data;
  },
  updateRoutingRule: async (id: string, ruleData: any) => {
    const { data } = await api.put(`/lead-settings/routing/${id}`, ruleData);
    return data;
  },
  deleteRoutingRule: async (id: string) => {
    const { data } = await api.delete(`/lead-settings/routing/${id}`);
    return data;
  },

  // Qualification
  getQualificationFrameworks: async () => {
    const { data } = await api.get('/lead-settings/qualification');
    return data;
  },
  setActiveFramework: async (frameworkId: string) => {
    const { data } = await api.post(`/lead-settings/qualification/${frameworkId}/activate`);
    return data;
  },

  // Disqualification reasons
  getDisqualificationReasons: async () => {
    const { data } = await api.get('/lead-settings/disqualification-reasons');
    return data;
  },
  createDisqualificationReason: async (reasonData: { name: string; description?: string }) => {
    const { data } = await api.post('/lead-settings/disqualification-reasons', reasonData);
    return data;
  },

  // Sources
  getSources: async () => {
    const { data } = await api.get('/lead-settings/sources');
    return data;
  },
  createSource: async (sourceData: { name: string; description?: string }) => {
    const { data } = await api.post('/lead-settings/sources', sourceData);
    return data;
  },

  // Team roles
  getTeamRoles: async () => {
    const { data } = await api.get('/lead-settings/team-roles');
    return data;
  },

  // General settings
  getSettings: async () => {
    const { data } = await api.get('/lead-settings/settings');
    return data;
  },
  updateSetting: async (key: string, value: any) => {
    const { data } = await api.put(`/lead-settings/settings/${key}`, value);
    return data;
  },
};
