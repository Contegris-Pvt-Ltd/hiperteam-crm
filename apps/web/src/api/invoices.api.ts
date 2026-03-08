import { api } from './contacts.api';

export type InvoiceStatus =
  | 'draft' | 'sent' | 'partially_paid' | 'paid'
  | 'overdue' | 'cancelled' | 'void';

export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface InvoiceLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  taxRate?: number;
  total?: number;
  sortOrder?: number;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  paidAt: string;
  xeroPaymentId?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  opportunityId?: string | null;
  contractId?: string | null;
  proposalId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  accountName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  title: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  issueDate: string;
  dueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  terms?: string | null;
  isRecurring: boolean;
  recurrenceInterval?: RecurrenceInterval | null;
  recurrenceEndDate?: string | null;
  nextInvoiceDate?: string | null;
  xeroInvoiceId?: string | null;
  lineItems?: InvoiceLineItem[];
  payments?: InvoicePayment[];
  paymentCount?: number;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceDto {
  opportunityId?: string;
  contractId?: string;
  proposalId?: string;
  accountId?: string;
  contactId?: string;
  title?: string;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  terms?: string;
  isRecurring?: boolean;
  recurrenceInterval?: RecurrenceInterval;
  recurrenceEndDate?: string;
  lineItems?: InvoiceLineItem[];
  sourceType?: 'contract' | 'proposal';
  sourceId?: string;
}

export const invoicesApi = {
  getAll: async (filters: {
    opportunityId?: string;
    accountId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Invoice[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
    const { data } = await api.get('/invoices', { params: filters });
    return data;
  },

  getOne: async (invoiceId: string): Promise<Invoice> => {
    const { data } = await api.get(`/invoices/${invoiceId}`);
    return data;
  },

  create: async (dto: CreateInvoiceDto): Promise<Invoice> => {
    const { data } = await api.post('/invoices', dto);
    return data;
  },

  update: async (invoiceId: string, dto: Partial<CreateInvoiceDto>): Promise<Invoice> => {
    const { data } = await api.put(`/invoices/${invoiceId}`, dto);
    return data;
  },

  delete: async (invoiceId: string): Promise<void> => {
    await api.delete(`/invoices/${invoiceId}`);
  },

  send: async (invoiceId: string): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${invoiceId}/send`);
    return data;
  },

  cancel: async (invoiceId: string): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${invoiceId}/cancel`);
    return data;
  },

  recordPayment: async (invoiceId: string, dto: {
    amount: number;
    currency?: string;
    paymentMethod?: string;
    reference?: string;
    notes?: string;
    paidAt?: string;
  }): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${invoiceId}/payments`, dto);
    return data;
  },

  getPayments: async (invoiceId: string): Promise<InvoicePayment[]> => {
    const { data } = await api.get(`/invoices/${invoiceId}/payments`);
    return data;
  },

  downloadPdf: async (invoiceId: string): Promise<Blob> => {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  sendByEmail: async (invoiceId: string, payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
  }): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${invoiceId}/send-email`, payload);
    return data;
  },

  pushToXero: async (invoiceId: string): Promise<{ success: boolean; xeroInvoiceId?: string }> => {
    const { data } = await api.post(`/invoices/${invoiceId}/push-xero`);
    return data;
  },
};
