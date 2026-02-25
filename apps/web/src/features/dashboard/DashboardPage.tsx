// ============================================================
// FILE: apps/web/src/features/dashboard/DashboardPage.tsx
//
// Full analytics dashboard with Personal / Team toggle.
// Personal = "My" data. Team = all reps (visible to managers).
// ============================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Target, CheckSquare,
  Users, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  BarChart3, Activity, Zap, Calendar, ChevronDown,
  Loader2, RefreshCw, Trophy, ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { dashboardApi } from '../../api/dashboard.api';
import type {
  DashboardSummary, ActivitySummary, FunnelStage, VelocityStage,
  WinLossAnalysis, LeaderboardEntry, LeadAgingData, LeadSourceData,
  UpcomingTask, ClosingDeal, ConversionStep, ActivityFeedItem,
  StuckDeal, EffortVsResult,
} from '../../api/dashboard.api';
import { TargetsWidget } from './TargetsWidget';
import { MyBadgesWidget, AchievementFeed, PointsLeaderboard } from './BadgesDisplay';
import { AccountForecastWidget } from './AccountForecastWidget';

// ════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════

const DATE_PRESETS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'This Year', value: 'year' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'Last 90 Days', value: 'last90' },
];

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (preset) {
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      from = d;
      break;
    }
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), q, 1);
      break;
    }
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case 'last30':
      from = new Date(now.getTime() - 30 * 86400000);
      break;
    case 'last90':
      from = new Date(now.getTime() - 90 * 86400000);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { from: from.toISOString(), to };
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

  // Can user see team data?
  const recordAccess = (user?.recordAccess || {}) as Record<string, string>;
  const canViewTeam = Object.values(recordAccess).some(v => v === 'team' || v === 'all' || v === 'department')
    || (user?.roleLevel || 0) >= 50;

  // State
  const [scope, setScope] = useState<'own' | 'team'>('own');
  const [datePreset, setDatePreset] = useState('month');
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [pipelineFunnel, setPipelineFunnel] = useState<FunnelStage[]>([]);
  const [_leadFunnel, setLeadFunnel] = useState<FunnelStage[]>([]);
  const [velocity, setVelocity] = useState<VelocityStage[]>([]);
  const [winLoss, setWinLoss] = useState<WinLossAnalysis | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leadAging, setLeadAging] = useState<LeadAgingData | null>(null);
  const [leadSources, setLeadSources] = useState<LeadSourceData[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [closingDeals, setClosingDeals] = useState<ClosingDeal[]>([]);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionStep[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityFeedItem[]>([]);
  const [stuckDeals, setStuckDeals] = useState<StuckDeal[]>([]);
  const [_effortVsResult, setEffortVsResult] = useState<EffortVsResult[]>([]);

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const query = useMemo(() => ({ scope, ...dateRange }), [scope, dateRange]);

  // ── Fetch all data ──
  const fetchAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const [
        sumRes, actRes, pipRes, leadFRes, velRes, wlRes,
        lbRes, laRes, lsRes, taskRes, dealRes, convRes,
        actFeedRes, stuckRes, evrRes,
      ] = await Promise.all([
        dashboardApi.getSummary(query),
        dashboardApi.getActivitySummary(query),
        dashboardApi.getPipelineFunnel(query),
        dashboardApi.getLeadFunnel(query),
        dashboardApi.getPipelineVelocity({ scope, module: 'opportunities' }),
        dashboardApi.getWinLoss(query),
        dashboardApi.getLeaderboard(query),
        dashboardApi.getLeadAging({ scope }),
        dashboardApi.getLeadSources(query),
        dashboardApi.getUpcomingTasks({ scope, limit: 10 }),
        dashboardApi.getDealsClosing({ scope, days: 7 }),
        dashboardApi.getConversionFunnel(query),
        dashboardApi.getRecentActivity({ scope, limit: 15 }),
        dashboardApi.getStuckDeals({ scope, days: 14 }),
        dashboardApi.getEffortVsResult(query),
      ]);

      setSummary(sumRes);
      setActivitySummary(actRes);
      setPipelineFunnel(pipRes);
      setLeadFunnel(leadFRes);
      setVelocity(velRes);
      setWinLoss(wlRes);
      setLeaderboard(lbRes);
      setLeadAging(laRes);
      setLeadSources(lsRes);
      setUpcomingTasks(taskRes);
      setClosingDeals(dealRes);
      setConversionFunnel(convRes);
      setRecentActivity(actFeedRes);
      setStuckDeals(stuckRes);
      setEffortVsResult(evrRes);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, scope]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Good {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {scope === 'own' ? "Here's your personal performance snapshot." : "Here's how your team is performing."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scope toggle */}
          {canViewTeam && (
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setScope('own')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  scope === 'own'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setScope('team')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  scope === 'team'
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                Team
              </button>
            </div>
          )}

          {/* Date range picker */}
          <div className="relative">
            <button
              onClick={() => setShowDateMenu(!showDateMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <Calendar size={14} />
              {DATE_PRESETS.find(p => p.value === datePreset)?.label}
              <ChevronDown size={14} />
            </button>
            {showDateMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDateMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  {DATE_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => { setDatePreset(p.value); setShowDateMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 ${
                        datePreset === p.value ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchAll(false)}
            disabled={refreshing}
            className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Open Pipeline"
            value={formatCurrency(summary.pipelineValue)}
            subtitle={`${summary.pipelineCount} deals`}
            icon={DollarSign}
            color="blue"
          />
          <KpiCard
            title="Revenue Won"
            value={formatCurrency(summary.wonRevenue)}
            subtitle={`${summary.wonCount} deals closed`}
            icon={TrendingUp}
            color="emerald"
            change={summary.revenueChange}
          />
          <KpiCard
            title="Win Rate"
            value={`${summary.winRate}%`}
            subtitle={`${summary.wonCount}W / ${summary.lostCount}L`}
            icon={Target}
            color="purple"
          />
          <KpiCard
            title="Tasks Due Today"
            value={String(summary.tasksDueToday)}
            subtitle={summary.tasksOverdue > 0 ? `${summary.tasksOverdue} overdue` : 'All on track'}
            icon={CheckSquare}
            color={summary.tasksOverdue > 0 ? 'red' : 'amber'}
            alert={summary.tasksOverdue > 0}
          />
        </div>
      )}

      {/* ── Second KPI row ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="New Leads"
            value={String(summary.newLeads)}
            subtitle="this period"
            icon={Users}
            color="indigo"
            change={summary.leadsChange}
          />
          <KpiCard
            title="Converted Leads"
            value={String(summary.convertedLeads)}
            subtitle={summary.newLeads > 0 ? `${Math.round(summary.convertedLeads / summary.newLeads * 100)}% conversion` : 'No leads yet'}
            icon={Zap}
            color="teal"
          />
          <KpiCard
            title="Deals Closing Soon"
            value={String(closingDeals.length)}
            subtitle="within 7 days"
            icon={Clock}
            color="orange"
            onClick={() => navigate('/opportunities')}
          />
          <KpiCard
            title="Stuck Deals"
            value={String(stuckDeals.length)}
            subtitle="> 14 days in stage"
            icon={AlertTriangle}
            color={stuckDeals.length > 0 ? 'red' : 'gray'}
            alert={stuckDeals.length > 0}
          />
        </div>
      )}

      {/* ── Targets & Gamification ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TargetsWidget className="lg:col-span-2" />
        <div className="space-y-4">
          <MyBadgesWidget />
          <AchievementFeed limit={8} />
        </div>
      </div>

      {/* ── Action Panels: Tasks + Aging Leads ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Tasks */}
        <WidgetCard title="Upcoming Tasks" icon={CheckSquare} action={{ label: 'View All', onClick: () => navigate('/tasks') }}>
          {upcomingTasks.length === 0 ? (
            <EmptyState text="No upcoming tasks" />
          ) : (
            <div className="space-y-1">
              {upcomingTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => navigate('/tasks')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: task.priority?.color || '#9CA3AF' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.assignee && scope === 'team' && (
                        <span className="text-[10px] text-gray-400">{task.assignee}</span>
                      )}
                    </div>
                  </div>
                  {task.dueDate && (
                    <span className={`text-xs flex-shrink-0 ${task.isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {task.isOverdue ? 'Overdue' : formatRelativeDate(task.dueDate)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Aging Leads */}
        <WidgetCard title="Aging Leads" icon={AlertTriangle} action={{ label: 'View All', onClick: () => navigate('/leads') }}>
          {!leadAging || leadAging.topIdle.length === 0 ? (
            <EmptyState text="No idle leads — great job!" />
          ) : (
            <div className="space-y-1">
              {leadAging.topIdle.slice(0, 8).map(lead => (
                <button
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: lead.stageColor || '#9CA3AF' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{lead.name}</p>
                    {lead.company && (
                      <p className="text-[10px] text-gray-400 truncate">{lead.company}</p>
                    )}
                  </div>
                  <span className={`text-xs flex-shrink-0 font-medium ${
                    lead.idleDays > 7 ? 'text-red-500' : lead.idleDays > 3 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    {lead.idleDays}d idle
                  </span>
                </button>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Funnels: Pipeline + Conversion ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Funnel */}
        <WidgetCard title="Sales Pipeline" icon={BarChart3}>
          {pipelineFunnel.length === 0 ? (
            <EmptyState text="No pipeline data" />
          ) : (
            <FunnelChart
              stages={pipelineFunnel.filter(s => !s.isWon && !s.isLost)}
              showAmount
            />
          )}
        </WidgetCard>

        {/* Conversion Funnel */}
        <WidgetCard title="Lead Conversion Funnel" icon={Zap}>
          {conversionFunnel.length === 0 ? (
            <EmptyState text="No conversion data" />
          ) : (
            <FunnelChart stages={conversionFunnel.map((s, i) => ({
              id: String(i),
              name: s.stage,
              color: ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981'][i] || '#6B7280',
              sortOrder: i,
              count: s.count,
            }))} />
          )}
        </WidgetCard>
      </div>

      {/* ── Charts: Velocity + Win/Loss ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Velocity */}
        <WidgetCard title="Avg Days in Stage" icon={Clock}>
          {velocity.length === 0 ? (
            <EmptyState text="No velocity data yet" />
          ) : (
            <div className="space-y-2">
              {velocity.map(v => (
                <div key={v.stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate">{v.stage}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-2"
                      style={{
                        backgroundColor: v.color || '#3B82F6',
                        width: `${Math.min(100, (v.avgDays / Math.max(...velocity.map(x => x.avgDays), 1)) * 100)}%`,
                        minWidth: '2rem',
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">{v.avgDays}d</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Win/Loss Trend */}
        <WidgetCard title="Win / Loss Trend" icon={TrendingUp}>
          {!winLoss || winLoss.trend.length === 0 ? (
            <EmptyState text="No win/loss data" />
          ) : (
            <div className="space-y-3">
              {winLoss.trend.map(t => {
                const total = t.won + t.lost;
                const wonPct = total > 0 ? (t.won / total) * 100 : 0;
                return (
                  <div key={t.month} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{t.month}</span>
                      <span className="text-xs text-gray-400">{t.won}W / {t.lost}L</span>
                    </div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
                      {wonPct > 0 && (
                        <div className="bg-emerald-500 h-full" style={{ width: `${wonPct}%` }} />
                      )}
                      {wonPct < 100 && (
                        <div className="bg-red-400 h-full" style={{ width: `${100 - wonPct}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Lead Sources + Activity Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lead Sources */}
        <WidgetCard title="Lead Sources" icon={Users}>
          {leadSources.length === 0 ? (
            <EmptyState text="No lead source data" />
          ) : (
            <div className="space-y-2">
              {leadSources.slice(0, 8).map(s => (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate">{s.source}</span>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (s.total / Math.max(...leadSources.map(x => x.total), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{s.total}</span>
                  </div>
                  <span className={`text-xs font-medium w-10 text-right ${s.conversionRate > 20 ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {s.conversionRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Activity Summary */}
        <WidgetCard title="Activity Breakdown" icon={Activity}>
          {!activitySummary || activitySummary.byType.length === 0 ? (
            <EmptyState text="No activity recorded" />
          ) : (
            <div className="space-y-2">
              {activitySummary.byType.slice(0, 10).map(a => {
                const maxCount = Math.max(...activitySummary.byType.map(x => x.count), 1);
                return (
                  <div key={a.type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate capitalize">
                      {a.type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(a.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{a.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Account Forecast (Next Quarter) ── */}
      <AccountForecastWidget scope={scope} className="" />

      {/* ── Deals Closing + Stuck Deals ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deals Closing This Week */}
        <WidgetCard title="Deals Closing This Week" icon={Clock}>
          {closingDeals.length === 0 ? (
            <EmptyState text="No deals closing soon" />
          ) : (
            <div className="space-y-1">
              {closingDeals.slice(0, 8).map(deal => (
                <button
                  key={deal.id}
                  onClick={() => navigate(`/opportunities/${deal.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: deal.stage.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{deal.name}</p>
                    <p className="text-[10px] text-gray-400">{deal.account} {deal.owner && scope === 'team' ? `· ${deal.owner}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(deal.amount)}</p>
                    <p className={`text-[10px] ${deal.isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                      {deal.isOverdue ? 'Overdue' : formatRelativeDate(deal.closeDate)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Stuck Deals */}
        <WidgetCard title="Stuck Deals" icon={AlertTriangle}>
          {stuckDeals.length === 0 ? (
            <EmptyState text="No stuck deals — pipeline is moving!" />
          ) : (
            <div className="space-y-1">
              {stuckDeals.map(deal => (
                <button
                  key={deal.id}
                  onClick={() => navigate(`/opportunities/${deal.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: deal.stage.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{deal.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {deal.stage.name} {deal.owner && scope === 'team' ? `· ${deal.owner}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(deal.amount)}</p>
                    <p className="text-[10px] text-red-500 font-medium">{deal.daysInStage}d stuck</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      {/* ── Leaderboards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetCard title="Leaderboard" icon={Trophy}>
          {leaderboard.length === 0 ? (
            <EmptyState text="No leaderboard data" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-3">#</th>
                    <th className="text-left py-2 px-3">Rep</th>
                    <th className="text-right py-2 px-3">Revenue</th>
                    <th className="text-right py-2 px-3">Won</th>
                    <th className="text-right py-2 px-3">Win %</th>
                    <th className="text-right py-2 px-3">Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => (
                    <tr
                      key={entry.userId}
                      className={`border-b border-gray-50 dark:border-gray-800/50 ${
                        entry.userId === user?.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        {idx < 3 ? (
                          <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        ) : (
                          <span className="text-xs text-gray-400">{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            {entry.name.charAt(0)}
                          </div>
                          <span className={`text-xs ${entry.userId === user?.id ? 'font-semibold text-blue-600' : 'text-gray-800 dark:text-gray-200'}`}>
                            {entry.name} {entry.userId === user?.id ? '(You)' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(entry.revenueWon)}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-gray-600 dark:text-gray-400">{entry.dealsWon}</td>
                      <td className="py-2.5 px-3 text-right text-xs">
                        <span className={entry.winRate >= 50 ? 'text-emerald-600' : entry.winRate >= 30 ? 'text-amber-600' : 'text-red-500'}>
                          {entry.winRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-gray-600 dark:text-gray-400">{entry.totalActivities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WidgetCard>

        <PointsLeaderboard />
      </div>

      {/* ── Recent Activity Feed ── */}
      <WidgetCard title="Recent Activity" icon={Activity}>
        {recentActivity.length === 0 ? (
          <EmptyState text="No recent activity" />
        ) : (
          <div className="space-y-0">
            {recentActivity.map((item, idx) => (
              <div key={item.id} className="flex gap-3 py-2 px-3">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
                    {item.user.name.charAt(0)}
                  </div>
                  {idx < recentActivity.length - 1 && (
                    <div className="w-px flex-1 bg-gray-100 dark:bg-slate-800 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{item.user.name}</span>{' '}
                    <span className="text-gray-500">{item.title}</span>
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{formatTimeAgo(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600',
  gray: 'bg-gray-50 dark:bg-gray-800 text-gray-500',
};

function KpiCard({
  title, value, subtitle, icon: Icon, color, change, alert, onClick,
}: {
  title: string; value: string; subtitle: string;
  icon: any; color: string; change?: number;
  alert?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 lg:p-5 hover:shadow-md dark:hover:border-slate-700 transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl ${COLOR_MAP[color] || COLOR_MAP.gray}`}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && change !== 0 && (
          <span className={`flex items-center text-xs font-medium ${change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {Math.abs(change)}%
          </span>
        )}
        {alert && !change && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{title}</p>
    </div>
  );
}

function WidgetCard({
  title, icon: Icon, children, action,
}: {
  title: string; icon: any; children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
          >
            {action.label} <ArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="p-4 lg:p-5 max-h-[400px] overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  );
}

function FunnelChart({ stages, showAmount }: { stages: FunnelStage[]; showAmount?: boolean }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => {
        const widthPct = Math.max(8, (stage.count / maxCount) * 100);
        return (
          <div key={stage.id || idx} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate">{stage.name}</span>
            <div className="flex-1">
              <div
                className="h-7 rounded-lg flex items-center px-2.5 transition-all"
                style={{
                  backgroundColor: stage.color || '#3B82F6',
                  width: `${widthPct}%`,
                  minWidth: '3rem',
                }}
              >
                <span className="text-xs font-bold text-white">{stage.count}</span>
              </div>
            </div>
            {showAmount && stage.totalAmount !== undefined && (
              <span className="text-xs text-gray-500 w-20 text-right">{formatCurrencyShort(stage.totalAmount)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return `$${n.toLocaleString()}`;
}

function formatCurrencyShort(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days <= 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}