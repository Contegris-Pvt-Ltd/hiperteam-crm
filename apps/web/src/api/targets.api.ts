// ============================================================
// FILE: apps/web/src/api/targets.api.ts
// ============================================================

import { api } from './contacts.api';

// ── Types ─────────────────────────────────────────────────────

export interface MetricConfigField {
  key: string;
  label: string;
  type: 'stage_picker' | 'text' | 'number' | 'select';
  module?: string;
  required?: boolean;
}

export interface MetricDefinition {
  key: string;
  label: string;
  module: string;
  metricType: string;
  unit: string;
  description?: string;
  configFields?: MetricConfigField[];
}

export interface Target {
  id: string;
  name: string;
  description?: string;
  module: string;
  metricKey: string;
  metricType: string;
  metricUnit: string;
  period: string;
  cascadeEnabled: boolean;
  cascadeMethod: string;
  badgeOnAchieve: boolean;
  streakTracking: boolean;
  milestoneNotifications: boolean;
  isActive: boolean;
  sortOrder: number;
  customQuery?: string;
  filterCriteria?: Record<string, any>;
}

export interface TargetAssignment {
  id: string;
  targetId: string;
  scopeType: 'company' | 'department' | 'team' | 'individual';
  userId?: string;
  teamId?: string;
  department?: string;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  isCascaded: boolean;
  isOverridden: boolean;
  parentAssignmentId?: string;
  cascadeWeights: Record<string, number>;
  isActive: boolean;
  user?: { name: string; avatarUrl?: string };
  teamName?: string;
  progress?: {
    actual: number;
    percentage: number;
    pace: string;
    milestones: { fifty: boolean; seventyFive: boolean; hundred: boolean; exceeded: boolean };
    lastComputedAt?: string;
  };
}

export interface TargetProgress {
  id: string;
  targetId: string;
  targetName: string;
  metricKey: string;
  metricType: string;
  metricUnit: string;
  module: string;
  targetValue: number;
  actual: number;
  percentage: number;
  pace: string;
  expectedByNow: number;
  daysElapsed: number;
  daysTotal: number;
  periodStart: string;
  periodEnd: string;
  milestones: { fifty: boolean; seventyFive: boolean; hundred: boolean; exceeded: boolean };
  streak?: { current: number; longest: number };
}

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  triggerType: string;
  triggerConfig: Record<string, any>;
  tier: string;
  points: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface BadgeAward {
  id: string;
  badge: { id: string; name: string; description?: string; icon: string; color: string; tier: string };
  awardedFor: string;
  pointsEarned: number;
  awardedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  target: number;
  actual: number;
  percentage: number;
  pace: string;
  streak: number;
  periodPoints: number;
}

export interface AchievementEntry {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  eventType: string;
  message: string;
  badge?: { name: string; icon: string; color: string };
  createdAt: string;
}

// ── Targets API ───────────────────────────────────────────────

export const targetsApi = {
  // Metrics registry
  getMetrics: async (module?: string): Promise<MetricDefinition[]> => {
    const params = module ? { module } : {};
    const { data } = await api.get('/targets/metrics', { params });
    return data;
  },

  // Target CRUD
  getAll: async (module?: string): Promise<Target[]> => {
    const params = module ? { module } : {};
    const { data } = await api.get('/targets', { params });
    return data;
  },
  getOne: async (id: string): Promise<Target> => {
    const { data } = await api.get(`/targets/${id}`);
    return data;
  },
  create: async (dto: Partial<Target> & { metricKey: string; module: string }): Promise<Target> => {
    const { data } = await api.post('/targets', dto);
    return data;
  },
  update: async (id: string, dto: Partial<Target>): Promise<Target> => {
    const { data } = await api.put(`/targets/${id}`, dto);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/targets/${id}`);
  },

  // Assignments
  getAssignments: async (targetId: string, periodStart?: string): Promise<TargetAssignment[]> => {
    const params = periodStart ? { periodStart } : {};
    const { data } = await api.get(`/targets/${targetId}/assignments`, { params });
    return data;
  },
  createAssignment: async (targetId: string, dto: any): Promise<TargetAssignment> => {
    const { data } = await api.post(`/targets/${targetId}/assignments`, dto);
    return data;
  },
  updateAssignment: async (assignmentId: string, dto: any): Promise<TargetAssignment> => {
    const { data } = await api.put(`/targets/assignments/${assignmentId}`, dto);
    return data;
  },
  deleteAssignment: async (assignmentId: string): Promise<void> => {
    await api.delete(`/targets/assignments/${assignmentId}`);
  },

  // Cascade
  cascade: async (targetId: string, parentAssignmentId: string, toScope: string): Promise<TargetAssignment[]> => {
    const { data } = await api.post(`/targets/${targetId}/cascade`, { parentAssignmentId, toScope });
    return data;
  },

  // Generate periods
  generatePeriods: async (targetId: string, dto: any): Promise<TargetAssignment[]> => {
    const { data } = await api.post(`/targets/${targetId}/generate-periods`, dto);
    return data;
  },

  // Progress
  getMyProgress: async (period?: string): Promise<TargetProgress[]> => {
    const params = period ? { period } : {};
    const { data } = await api.get('/targets/progress/my', { params });
    return data;
  },
  getTeamProgress: async (teamId: string, period?: string) => {
    const params = period ? { period } : {};
    const { data } = await api.get(`/targets/progress/team/${teamId}`, { params });
    return data;
  },
  getLeaderboard: async (metricKey: string, period?: string): Promise<LeaderboardEntry[]> => {
    const params: any = { metricKey };
    if (period) params.period = period;
    const { data } = await api.get('/targets/progress/leaderboard', { params });
    return data;
  },
  refreshProgress: async (): Promise<{ computed: number; total: number }> => {
    const { data } = await api.post('/targets/progress/refresh');
    return data;
  },
};

// ── Gamification API ──────────────────────────────────────────

export const gamificationApi = {
  // Badges
  getBadges: async (): Promise<Badge[]> => {
    const { data } = await api.get('/gamification/badges');
    return data;
  },
  createBadge: async (dto: Partial<Badge>): Promise<Badge> => {
    const { data } = await api.post('/gamification/badges', dto);
    return data;
  },
  updateBadge: async (id: string, dto: Partial<Badge>): Promise<Badge> => {
    const { data } = await api.put(`/gamification/badges/${id}`, dto);
    return data;
  },
  deleteBadge: async (id: string): Promise<void> => {
    await api.delete(`/gamification/badges/${id}`);
  },

  // My data
  getMyBadges: async (): Promise<BadgeAward[]> => {
    const { data } = await api.get('/gamification/my-badges');
    return data;
  },
  getMyStreaks: async () => {
    const { data } = await api.get('/gamification/my-streaks');
    return data;
  },

  // Leaderboard & feed
  getLeaderboard: async (period?: string) => {
    const params = period ? { period } : {};
    const { data } = await api.get('/gamification/leaderboard', { params });
    return data;
  },
  getAchievements: async (userId?: string, limit?: number): Promise<AchievementEntry[]> => {
    const params: any = {};
    if (userId) params.userId = userId;
    if (limit) params.limit = limit;
    const { data } = await api.get('/gamification/achievements', { params });
    return data;
  },

  // User-specific
  getUserBadges: async (userId: string): Promise<BadgeAward[]> => {
    const { data } = await api.get(`/gamification/users/${userId}/badges`);
    return data;
  },
};