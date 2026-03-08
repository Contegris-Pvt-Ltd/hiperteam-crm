import { api } from './contacts.api';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApproverType = 'user' | 'role';
export type TriggerEvent = 'publish' | 'close_won' | 'discount_threshold' | 'manual';
export type EntityType = 'proposals' | 'opportunities' | 'deals' | 'leads' | 'custom';

export interface ApprovalRuleStep {
  id?: string;
  stepOrder: number;
  approverType: ApproverType;
  approverUserId?: string | null;
  approverRoleId?: string | null;
  approverName?: string;
}

export interface ApprovalRule {
  id: string;
  name: string;
  entityType: EntityType;
  triggerEvent: TriggerEvent;
  isActive: boolean;
  conditions?: any;
  steps: ApprovalRuleStep[];
  stepCount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequestStep {
  id: string;
  stepOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  comment?: string | null;
  actionedAt?: string | null;
  approverUserId?: string | null;
  approverRoleId?: string | null;
  approverName?: string;
}

export interface ApprovalRequest {
  id: string;
  ruleId?: string;
  entityType: string;
  entityId: string;
  triggerEvent: string;
  status: ApprovalStatus;
  currentStep: number;
  requestedBy?: string;
  requestedByName?: string;
  completedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  steps: ApprovalRequestStep[];
  entityName?: string | null;
  parentEntityId?: string | null;
}

export interface CreateRuleDto {
  name: string;
  entityType: EntityType;
  triggerEvent: TriggerEvent;
  conditions?: any;
  steps: Array<{
    stepOrder: number;
    approverType: ApproverType;
    approverUserId?: string;
    approverRoleId?: string;
  }>;
}

export const approvalsApi = {
  // Queue
  getPending: async (page = 1, limit = 20) => {
    const { data } = await api.get('/approvals/pending', { params: { page, limit } });
    return data as { data: ApprovalRequest[]; total: number };
  },

  getRequest: async (requestId: string) => {
    const { data } = await api.get(`/approvals/requests/${requestId}`);
    return data as ApprovalRequest;
  },

  getEntityRequest: async (entityType: string, entityId: string, triggerEvent?: string) => {
    const { data } = await api.get(`/approvals/entity/${entityType}/${entityId}`, {
      params: triggerEvent ? { triggerEvent } : undefined,
    });
    return data as ApprovalRequest | null;
  },

  approve: async (requestId: string, comment?: string) => {
    const { data } = await api.post(`/approvals/requests/${requestId}/approve`, { comment });
    return data as ApprovalRequest;
  },

  reject: async (requestId: string, comment?: string) => {
    const { data } = await api.post(`/approvals/requests/${requestId}/reject`, { comment });
    return data as ApprovalRequest;
  },

  cancel: async (requestId: string) => {
    await api.post(`/approvals/requests/${requestId}/cancel`);
  },

  // Rules (admin)
  getRules: async (entityType?: string) => {
    const { data } = await api.get('/approvals/rules', {
      params: entityType ? { entityType } : undefined,
    });
    return data as ApprovalRule[];
  },

  getRule: async (ruleId: string) => {
    const { data } = await api.get(`/approvals/rules/${ruleId}`);
    return data as ApprovalRule;
  },

  createRule: async (dto: CreateRuleDto) => {
    const { data } = await api.post('/approvals/rules', dto);
    return data as ApprovalRule;
  },

  updateRule: async (ruleId: string, dto: Partial<CreateRuleDto> & { isActive?: boolean }) => {
    const { data } = await api.put(`/approvals/rules/${ruleId}`, dto);
    return data as ApprovalRule;
  },

  deleteRule: async (ruleId: string) => {
    await api.delete(`/approvals/rules/${ruleId}`);
  },
};
