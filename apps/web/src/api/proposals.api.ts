import { api } from './contacts.api';

export type ProposalStatus = 'draft' | 'published' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface ProposalLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  total?: number;
  sortOrder?: number;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  tenantId?: string;
  title: string;
  coverMessage?: string | null;
  terms?: string | null;
  validUntil?: string | null;
  status: ProposalStatus;
  publicToken?: string;
  currency: string;
  totalAmount: number;
  sentAt?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  lineItems?: ProposalLineItem[];
  lineItemCount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalData {
  title: string;
  coverMessage?: string;
  terms?: string;
  validUntil?: string;
  currency?: string;
  lineItems?: ProposalLineItem[];
}

export const proposalsApi = {
  getAll: async (opportunityId: string): Promise<Proposal[]> => {
    const { data } = await api.get(`/opportunities/${opportunityId}/proposals`);
    return data;
  },

  getOne: async (opportunityId: string, proposalId: string): Promise<Proposal> => {
    const { data } = await api.get(`/opportunities/${opportunityId}/proposals/${proposalId}`);
    return data;
  },

  create: async (opportunityId: string, dto: CreateProposalData): Promise<Proposal> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/proposals`, dto);
    return data;
  },

  update: async (opportunityId: string, proposalId: string, dto: Partial<CreateProposalData>): Promise<Proposal> => {
    const { data } = await api.put(`/opportunities/${opportunityId}/proposals/${proposalId}`, dto);
    return data;
  },

  delete: async (opportunityId: string, proposalId: string): Promise<void> => {
    await api.delete(`/opportunities/${opportunityId}/proposals/${proposalId}`);
  },

  publish: async (opportunityId: string, proposalId: string): Promise<Proposal> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/proposals/${proposalId}/publish`);
    return data;
  },

  send: async (opportunityId: string, proposalId: string): Promise<Proposal> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/proposals/${proposalId}/send`);
    return data;
  },

  sendWithEmail: async (
    opportunityId: string,
    proposalId: string,
    payload: { to: string[]; cc?: string[]; bcc?: string[]; subject?: string },
  ): Promise<Proposal> => {
    const { data } = await api.post(
      `/opportunities/${opportunityId}/proposals/${proposalId}/send-email`,
      payload,
    );
    return data;
  },

  // Public endpoints — no auth needed
  getByToken: async (tenantId: string, token: string): Promise<Proposal> => {
    const { data } = await api.get(`/proposals/public/${tenantId}/${token}`);
    return data;
  },

  accept: async (tenantId: string, token: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/proposals/public/${tenantId}/${token}/accept`);
    return data;
  },

  decline: async (tenantId: string, token: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/proposals/public/${tenantId}/${token}/decline`);
    return data;
  },
};
