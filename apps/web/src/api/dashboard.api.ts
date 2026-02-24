// ============================================================
// FILE: apps/web/src/api/dashboard.api.ts
// ============================================================
import { api } from './contacts.api';

// ── Types ──

export interface DashboardSummary {
  pipelineValue: number;
  pipelineCount: number;
  wonRevenue: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  tasksDueToday: number;
  tasksOverdue: number;
  newLeads: number;
  convertedLeads: number;
  prevWonRevenue: number;
  prevWonCount: number;
  prevNewLeads: number;
  revenueChange: number;
  leadsChange: number;
}

export interface ActivitySummary {
  byType: { type: string; count: number }[];
  daily: { date: string; count: number }[];
}

export interface FunnelStage {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  probability?: number;
  isWon?: boolean;
  isLost?: boolean;
  count: number;
  totalAmount?: number;
  weightedAmount?: number;
}

export interface VelocityStage {
  stage: string;
  color: string;
  avgDays: number;
  minDays: number;
  maxDays: number;
  transitions: number;
}

export interface ForecastMonth {
  month: string;
  totalAmount: number;
  weightedAmount: number;
  dealCount: number;
}

export interface WinLossAnalysis {
  trend: { month: string; won: number; lost: number; wonAmount: number; lostAmount: number }[];
  lossReasons: { reason: string; count: number }[];
  bySource: { source: string; won: number; lost: number; winRate: number }[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  revenueWon: number;
  dealsWon: number;
  dealsLost: number;
  winRate: number;
  openPipeline: number;
  openDeals: number;
  leadsConverted: number;
  totalActivities: number;
  tasksCompleted: number;
}

export interface TeamActivityEntry {
  userId: string;
  name: string;
  activities: Record<string, number>;
  total: number;
}

export interface LeadAgingData {
  distribution: { bucket: string; count: number }[];
  topIdle: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    idleDays: number;
    stage: string;
    stageColor: string;
  }[];
}

export interface LeadSourceData {
  source: string;
  total: number;
  converted: number;
  disqualified: number;
  conversionRate: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  dueDate: string | null;
  isOverdue: boolean;
  priority: { name: string; color: string } | null;
  status: { name: string; color: string } | null;
  type: { name: string; icon: string } | null;
  assignee: string | null;
}

export interface ClosingDeal {
  id: string;
  name: string;
  amount: number;
  closeDate: string;
  probability: number | null;
  stage: { name: string; color: string };
  account: string | null;
  owner: string | null;
  isOverdue: boolean;
}

export interface EffortVsResult {
  userId: string;
  name: string;
  effort: number;
  result: number;
}

export interface ConversionStep {
  stage: string;
  count: number;
  rate: number;
}

export interface ActivityFeedItem {
  id: string;
  entityType: string;
  entityId: string;
  activityType: string;
  title: string;
  description: string | null;
  createdAt: string;
  user: { name: string; avatarUrl: string | null };
}

export interface StuckDeal {
  id: string;
  name: string;
  amount: number;
  daysInStage: number;
  stage: { name: string; color: string };
  account: string | null;
  owner: string | null;
}

// ── Query params ──

interface DashboardQuery {
  scope?: 'own' | 'team' | 'all';
  from?: string;
  to?: string;
}

function buildParams(query: DashboardQuery & Record<string, any> = {}): string {
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const str = p.toString();
  return str ? `?${str}` : '';
}

// ── API ──

export const dashboardApi = {
  getSummary: (q?: DashboardQuery) =>
    api.get<DashboardSummary>(`/dashboard/summary${buildParams(q)}`).then(r => r.data),

  getActivitySummary: (q?: DashboardQuery) =>
    api.get<ActivitySummary>(`/dashboard/activity-summary${buildParams(q)}`).then(r => r.data),

  getPipelineFunnel: (q?: DashboardQuery & { pipelineId?: string }) =>
    api.get<FunnelStage[]>(`/dashboard/pipeline-funnel${buildParams(q)}`).then(r => r.data),

  getLeadFunnel: (q?: DashboardQuery & { pipelineId?: string }) =>
    api.get<FunnelStage[]>(`/dashboard/lead-funnel${buildParams(q)}`).then(r => r.data),

  getPipelineVelocity: (q?: DashboardQuery & { module?: string }) =>
    api.get<VelocityStage[]>(`/dashboard/pipeline-velocity${buildParams(q)}`).then(r => r.data),

  getForecast: (q?: DashboardQuery) =>
    api.get<ForecastMonth[]>(`/dashboard/forecast${buildParams(q)}`).then(r => r.data),

  getWinLoss: (q?: DashboardQuery) =>
    api.get<WinLossAnalysis>(`/dashboard/win-loss${buildParams(q)}`).then(r => r.data),

  getLeaderboard: (q?: DashboardQuery) =>
    api.get<LeaderboardEntry[]>(`/dashboard/leaderboard${buildParams(q)}`).then(r => r.data),

  getTeamActivity: (q?: DashboardQuery) =>
    api.get<TeamActivityEntry[]>(`/dashboard/team-activity${buildParams(q)}`).then(r => r.data),

  getLeadAging: (q?: DashboardQuery) =>
    api.get<LeadAgingData>(`/dashboard/lead-aging${buildParams(q)}`).then(r => r.data),

  getLeadSources: (q?: DashboardQuery) =>
    api.get<LeadSourceData[]>(`/dashboard/lead-sources${buildParams(q)}`).then(r => r.data),

  getUpcomingTasks: (q?: DashboardQuery & { limit?: number }) =>
    api.get<UpcomingTask[]>(`/dashboard/upcoming-tasks${buildParams(q)}`).then(r => r.data),

  getDealsClosing: (q?: DashboardQuery & { days?: number }) =>
    api.get<ClosingDeal[]>(`/dashboard/deals-closing${buildParams(q)}`).then(r => r.data),

  getEffortVsResult: (q?: DashboardQuery) =>
    api.get<EffortVsResult[]>(`/dashboard/effort-vs-result${buildParams(q)}`).then(r => r.data),

  getConversionFunnel: (q?: DashboardQuery) =>
    api.get<ConversionStep[]>(`/dashboard/conversion-funnel${buildParams(q)}`).then(r => r.data),

  getRecentActivity: (q?: DashboardQuery & { limit?: number }) =>
    api.get<ActivityFeedItem[]>(`/dashboard/recent-activity${buildParams(q)}`).then(r => r.data),

  getStuckDeals: (q?: DashboardQuery & { days?: number }) =>
    api.get<StuckDeal[]>(`/dashboard/stuck-deals${buildParams(q)}`).then(r => r.data),
};