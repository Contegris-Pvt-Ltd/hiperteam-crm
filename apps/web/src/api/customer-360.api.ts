import { api } from './contacts.api';

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

export interface Subscription {
  id: string;
  accountId: string;
  productId: string;
  productName: string | null;
  productCode: string | null;
  productType: string | null;
  productImageUrl: string | null;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'pending';
  billingFrequency: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  mrr: number;
  arr: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  renewalUrgency: 'overdue' | 'urgent' | 'upcoming' | 'ok' | null;
  autoRenew: boolean;
  renewalReminderDays: number;
  sourceOpportunityId: string | null;
  sourceInvoiceId: string | null;
  sourceContractId: string | null;
  notes: string | null;
  customFields: Record<string, any>;
  usageSourceType: string | null;
  usageLastSyncedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}

export interface SubscriptionSummary {
  activeCount: number;
  trialCount: number;
  expiredCount: number;
  cancelledCount: number;
  totalMrr: number;
  totalArr: number;
  lostMrr: number;
  nextRenewalDate: string | null;
  renewalsIn90Days: number;
}

export interface CustomerScores {
  accountId: string;
  healthScore: number;
  healthStatus: 'healthy' | 'at_risk' | 'critical' | 'unknown';
  healthBreakdown: Record<string, { score: number; weight: number }>;
  cltv: number;
  churnRisk: 'none' | 'low' | 'medium' | 'high';
  churnSignals: { type: string; severity: string; message: string }[];
  upsellScore: number;
  upsellSuggestions: { productId: string; productName: string; score: number; reasons: string[] }[];
  engagementScore: number;
  totalMrr: number;
  totalArr: number;
  activeSubscriptions: number;
  nextRenewalDate: string | null;
  lastActivityAt: string | null;
  lastCalculatedAt: string | null;
}

export interface UsageMetric {
  id: string;
  productId: string;
  metricKey: string;
  metricLabel: string;
  metricUnit: string;
  format: string;
  sortOrder: number;
}

export interface UsageSource {
  id: string;
  accountId: string;
  productId: string;
  sourceType: 'pull_api' | 'push_webhook' | 'manual';
  apiUrl: string | null;
  apiMethod: string;
  apiHeaders: Record<string, string>;
  apiQueryParams: Record<string, string>;
  metricMappings: Record<string, string>;
  pollInterval: string;
  isActive: boolean;
  webhookKey: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface UsageLogEntry {
  metricKey: string;
  metricValue: number;
  recordedAt: string;
  source: string;
}

export interface UsageSummaryEntry {
  metricKey: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
  currentDate: string;
  previousDate: string;
}

export interface RenewalItem extends Subscription {
  accountName: string;
  accountLogoUrl: string | null;
  ownerName: string | null;
}

export interface ProductRecommendation {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  prerequisites: string[];
  exclusions: string[];
  idealMinSize: number | null;
  idealMaxSize: number | null;
  idealIndustries: string[];
  baseScore: number;
  triggerSignals: any[];
  isActive: boolean;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════
// API
// ════════════════════════════════════════════════════════════

export const customer360Api = {
  // ── Health Config (admin) ───────────────────────────────
  getHealthConfig: async () => {
    const { data } = await api.get('/customer-360/health-config');
    return data;
  },

  saveHealthConfig: async (config: any) => {
    const { data } = await api.put('/customer-360/health-config', config);
    return data;
  },

  // ── Subscriptions ───────────────────────────────────────
  getSubscriptions: async (accountId: string): Promise<Subscription[]> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/subscriptions`);
    return data;
  },

  getSubscriptionSummary: async (accountId: string): Promise<SubscriptionSummary> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/subscriptions/summary`);
    return data;
  },

  createSubscription: async (accountId: string, body: Partial<Subscription>): Promise<Subscription> => {
    const { data } = await api.post(`/customer-360/accounts/${accountId}/subscriptions`, body);
    return data;
  },

  updateSubscription: async (id: string, body: Partial<Subscription>): Promise<Subscription> => {
    const { data } = await api.put(`/customer-360/subscriptions/${id}`, body);
    return data;
  },

  deleteSubscription: async (id: string): Promise<void> => {
    await api.delete(`/customer-360/subscriptions/${id}`);
  },

  createFromOpportunity: async (opportunityId: string): Promise<{ created: number; message: string }> => {
    const { data } = await api.post(`/customer-360/opportunities/${opportunityId}/create-subscriptions`);
    return data;
  },

  // ── Renewals ────────────────────────────────────────────
  getUpcomingRenewals: async (params?: { days?: number; page?: number; limit?: number }) => {
    const { data } = await api.get('/customer-360/renewals', { params });
    return data as { data: RenewalItem[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  // ── Scores ──────────────────────────────────────────────
  getScores: async (accountId: string): Promise<CustomerScores | null> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/scores`);
    return data;
  },

  recalculateScores: async (accountId: string): Promise<CustomerScores> => {
    const { data } = await api.post(`/customer-360/accounts/${accountId}/scores/recalculate`);
    return data;
  },

  recalculateAll: async (): Promise<{ recalculated: number }> => {
    const { data } = await api.post('/customer-360/scores/recalculate-all');
    return data;
  },

  // ── Usage Metrics (admin per product) ───────────────────
  getUsageMetrics: async (productId: string): Promise<UsageMetric[]> => {
    const { data } = await api.get(`/customer-360/products/${productId}/usage-metrics`);
    return data;
  },

  saveUsageMetrics: async (productId: string, metrics: Partial<UsageMetric>[]): Promise<UsageMetric[]> => {
    const { data } = await api.put(`/customer-360/products/${productId}/usage-metrics`, { metrics });
    return data;
  },

  // ── Usage Source (per account+product) ──────────────────
  getUsageSource: async (accountId: string, productId: string): Promise<UsageSource | null> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/products/${productId}/usage-source`);
    return data;
  },

  saveUsageSource: async (accountId: string, productId: string, body: Partial<UsageSource>): Promise<UsageSource> => {
    const { data } = await api.put(`/customer-360/accounts/${accountId}/products/${productId}/usage-source`, body);
    return data;
  },

  // ── Usage Data ──────────────────────────────────────────
  ingestUsage: async (accountId: string, productId: string, metrics: { metricKey: string; metricValue: number }[]) => {
    const { data } = await api.post(`/customer-360/accounts/${accountId}/products/${productId}/usage`, { metrics });
    return data as { ingested: number };
  },

  getUsageLogs: async (accountId: string, productId: string, days?: number): Promise<UsageLogEntry[]> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/products/${productId}/usage`, { params: { days } });
    return data;
  },

  getUsageSummary: async (accountId: string, productId: string): Promise<UsageSummaryEntry[]> => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/products/${productId}/usage-summary`);
    return data;
  },

  // ── Product Recommendations (admin) ─────────────────────
  getRecommendations: async (): Promise<ProductRecommendation[]> => {
    const { data } = await api.get('/customer-360/recommendations');
    return data;
  },

  saveRecommendation: async (body: Partial<ProductRecommendation>): Promise<ProductRecommendation> => {
    const { data } = await api.post('/customer-360/recommendations', body);
    return data;
  },

  deleteRecommendation: async (id: string): Promise<void> => {
    await api.delete(`/customer-360/recommendations/${id}`);
  },

  // ── Account Associations ──────────────────────────────────
  getAccountLeads: async (accountId: string, params?: { page?: number; limit?: number }) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/leads`, { params });
    return data;
  },

  getAccountOpportunities: async (accountId: string, params?: { page?: number; limit?: number }) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/opportunities`, { params });
    return data;
  },

  getAccountInvoices: async (accountId: string, params?: { page?: number; limit?: number }) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/invoices`, { params });
    return data;
  },

  getAccountProjects: async (accountId: string, params?: { page?: number; limit?: number }) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/projects`, { params });
    return data;
  },

  // ── Timeline & Journey ────────────────────────────────────
  getTimeline: async (accountId: string, params?: { page?: number; limit?: number; filter?: string }) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/timeline`, { params });
    return data;
  },

  getJourney: async (accountId: string) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/journey`);
    return data;
  },

  getRevenueTrend: async (accountId: string, months?: number) => {
    const { data } = await api.get(`/customer-360/accounts/${accountId}/revenue-trend`, { params: { months } });
    return data;
  },
};
