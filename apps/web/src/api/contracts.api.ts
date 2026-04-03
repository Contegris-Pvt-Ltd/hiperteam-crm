import { api } from './contacts.api';

export type ContractStatus =
  | 'draft' | 'sent_for_signing' | 'partially_signed'
  | 'fully_signed' | 'expired' | 'terminated' | 'renewed';

export type ContractType = 'nda' | 'msa' | 'sow' | 'service_agreement' | 'custom';
export type SignMode = 'docusign' | 'internal';
export type SignatoryStatus = 'pending' | 'sent' | 'signed' | 'declined';

export interface ContractSignatory {
  id: string;
  contractId: string;
  signatoryType: 'internal' | 'external';
  signOrder: number;
  userId?: string | null;
  contactId?: string | null;
  name: string;
  email: string;
  status: SignatoryStatus;
  signedAt?: string | null;
  token?: string;
  isCurrentUser?: boolean;
  declineReason?: string | null;
}

export interface Contract {
  id: string;
  contractNumber: string;
  opportunityId: string;
  proposalId?: string | null;
  proposalTitle?: string | null;
  title: string;
  type: ContractType;
  status: ContractStatus;
  signMode: SignMode;
  value: number;
  currency: string;
  startDate?: string | null;
  endDate?: string | null;
  renewalDate?: string | null;
  autoRenewal: boolean;
  terms?: string | null;
  documentUrl?: string | null;
  documentName?: string | null;
  documentSize?: number | null;
  docusignEnvelopeId?: string | null;
  createdByName?: string | null;
  signatories: ContractSignatory[];
  signatoryCount?: number;
  signedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractDto {
  proposalId?: string;
  title?: string;
  type?: ContractType;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  autoRenewal?: boolean;
  terms?: string;
  signMode?: SignMode;
  signatories?: Array<{
    signatoryType: 'internal' | 'external';
    signOrder: number;
    userId?: string;
    contactId?: string;
    name: string;
    email: string;
  }>;
}

export const contractsApi = {
  getAll: async (opportunityId: string): Promise<Contract[]> => {
    const { data } = await api.get(`/opportunities/${opportunityId}/contracts`);
    return data;
  },

  getOne: async (opportunityId: string, contractId: string): Promise<Contract> => {
    const { data } = await api.get(`/opportunities/${opportunityId}/contracts/${contractId}`);
    return data;
  },

  create: async (opportunityId: string, dto: CreateContractDto): Promise<Contract> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/contracts`, dto);
    return data;
  },

  update: async (opportunityId: string, contractId: string, dto: Partial<CreateContractDto>): Promise<Contract> => {
    const { data } = await api.put(`/opportunities/${opportunityId}/contracts/${contractId}`, dto);
    return data;
  },

  delete: async (opportunityId: string, contractId: string): Promise<void> => {
    await api.delete(`/opportunities/${opportunityId}/contracts/${contractId}`);
  },

  send: async (opportunityId: string, contractId: string): Promise<Contract> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/contracts/${contractId}/send`);
    return data;
  },

  resend: async (opportunityId: string, contractId: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/opportunities/${opportunityId}/contracts/${contractId}/resend`);
    return data;
  },

  terminate: async (opportunityId: string, contractId: string, reason?: string): Promise<Contract> => {
    const { data } = await api.post(
      `/opportunities/${opportunityId}/contracts/${contractId}/terminate`,
      { reason }
    );
    return data;
  },

  addSignatory: async (opportunityId: string, contractId: string, dto: {
    signatoryType: 'internal' | 'external';
    signOrder: number;
    userId?: string;
    contactId?: string;
    name: string;
    email: string;
  }): Promise<Contract> => {
    const { data } = await api.post(
      `/opportunities/${opportunityId}/contracts/${contractId}/signatories`,
      dto
    );
    return data;
  },

  removeSignatory: async (opportunityId: string, contractId: string, signatoryId: string): Promise<Contract> => {
    const { data } = await api.delete(
      `/opportunities/${opportunityId}/contracts/${contractId}/signatories/${signatoryId}`
    );
    return data;
  },

  // Public endpoints — no auth
  getByToken: async (token: string): Promise<Contract> => {
    const { data } = await api.get(`/contracts/public/${token}`);
    return data;
  },

  sign: async (token: string, signatureData: string): Promise<Contract> => {
    const { data } = await api.post(`/contracts/public/${token}/sign`, { signatureData });
    return data;
  },

  decline: async (token: string, reason?: string): Promise<any> => {
    const { data } = await api.post(`/contracts/public/${token}/decline`, { reason });
    return data;
  },

  uploadDocument: async (opportunityId: string, contractId: string, file: File): Promise<Contract> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post(
      `/opportunities/${opportunityId}/contracts/${contractId}/upload-document`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  downloadDocument: (url: string) => {
    window.open(url, '_blank');
  },
};
