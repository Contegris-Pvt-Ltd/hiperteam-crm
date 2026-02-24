// ============================================================
// FILE: apps/web/src/features/dashboard/TargetsWidget.tsx
// ============================================================

import { useState, useEffect } from 'react';
import { Target, RefreshCw, ChevronDown, Flame, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { targetsApi } from '../../api/targets.api';
import type { TargetProgress, LeaderboardEntry } from '../../api/targets.api';

// ── Pace colors ───────────────────────────────────────────────
const PACE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  achieved: { color: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Achieved', icon: '✅' },
  ahead:    { color: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Ahead', icon: '🟢' },
  on_track: { color: 'text-blue-600',    bg: 'bg-blue-500',    label: 'On Track', icon: '🔵' },
  at_risk:  { color: 'text-amber-600',   bg: 'bg-amber-500',   label: 'At Risk', icon: '🟡' },
  behind:   { color: 'text-red-600',     bg: 'bg-red-500',     label: 'Behind', icon: '🔴' },
};

function getPace(pace: string) {
  return PACE_CONFIG[pace] || PACE_CONFIG.on_track;
}

function formatValue(value: number, unit: string): string {
  if (unit === '$') {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toLocaleString()}`;
  }
  if (unit === '%') return `${value.toFixed(1)}%`;
  return value.toLocaleString();
}

// ── TARGETS WIDGET ────────────────────────────────────────────

interface TargetsWidgetProps {
  className?: string;
}

export function TargetsWidget({ className = '' }: TargetsWidgetProps) {
  const [targets, setTargets] = useState<TargetProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [refreshing, setRefreshing] = useState(false);

  const loadTargets = async () => {
    try {
      const data = await targetsApi.getMyProgress(period);
      setTargets(data);
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTargets(); }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await targetsApi.refreshProgress();
      await loadTargets();
    } finally {
      setRefreshing(false);
    }
  };

  const totalStreak = targets.reduce((max, t) => Math.max(max, t.streak?.current || 0), 0);
  const badgesThisPeriod = targets.filter(t => t.milestones.hundred).length;

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-40" />
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-slate-800 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Targets</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400">No targets assigned yet. Ask your admin to set up targets.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Targets</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-50"
            title="Refresh progress"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Targets list */}
      <div className="space-y-3">
        {targets.map(t => {
          const pace = getPace(t.pace);
          const pctClamped = Math.min(t.percentage, 100);

          return (
            <div key={t.id} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">
                  {t.targetName}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {formatValue(t.actual, t.metricUnit)} / {formatValue(t.targetValue, t.metricUnit)}
                  </span>
                  <span className={`text-xs font-medium ${pace.color}`}>
                    {t.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${pace.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${pctClamped}%` }}
                />
                {/* Expected marker */}
                {t.daysTotal > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-slate-500 opacity-50"
                    style={{ left: `${Math.min((t.daysElapsed / t.daysTotal) * 100, 100)}%` }}
                    title={`Expected: ${formatValue(t.expectedByNow, t.metricUnit)}`}
                  />
                )}
              </div>
              {/* Pace + streak */}
              <div className="flex items-center justify-between mt-0.5">
                <span className={`text-[10px] font-medium ${pace.color}`}>
                  {pace.icon} {pace.label}
                </span>
                {t.streak && t.streak.current > 0 && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                    <Flame className="w-3 h-3" /> {t.streak.current}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {(totalStreak > 0 || badgesThisPeriod > 0) && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
          {totalStreak > 0 && (
            <span className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Best streak: {totalStreak}
            </span>
          )}
          {badgesThisPeriod > 0 && (
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-yellow-500" />
              {badgesThisPeriod} target{badgesThisPeriod !== 1 ? 's' : ''} achieved
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── TARGET KPI CARD (to replace or enhance existing KPI cards) ─

interface TargetKPICardProps {
  label: string;
  actual: number;
  target: number;
  unit: string;
  pace: string;
  comparison?: { value: number; label: string };
}

export function TargetKPICard({ label, actual, target, unit, pace, comparison }: TargetKPICardProps) {
  const paceConfig = getPace(pace);
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 border-l-4 rounded-xl border border-gray-200 dark:border-slate-700`}
      style={{ borderLeftColor: paceConfig.bg.includes('emerald') ? '#10B981' : paceConfig.bg.includes('blue') ? '#3B82F6' : paceConfig.bg.includes('amber') ? '#F59E0B' : '#EF4444' }}
    >
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-gray-900 dark:text-white">
          {formatValue(actual, unit)}
        </span>
        <span className="text-xs text-gray-400">/ {formatValue(target, unit)}</span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full ${paceConfig.bg} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[10px] font-medium ${paceConfig.color}`}>
          {paceConfig.icon} {paceConfig.label} · {pct.toFixed(0)}%
        </span>
        {comparison && (
          <span className={`text-[10px] flex items-center gap-0.5 ${comparison.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {comparison.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {comparison.value >= 0 ? '+' : ''}{comparison.value}% {comparison.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── TARGET LEADERBOARD ────────────────────────────────────────

interface TargetLeaderboardProps {
  className?: string;
}

export function TargetLeaderboard({ className = '' }: TargetLeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricKey, setMetricKey] = useState('revenue_won');
  const [period, setPeriod] = useState('monthly');
  const [metrics, setMetrics] = useState<{ key: string; label: string }[]>([]);

  useEffect(() => {
    targetsApi.getMetrics().then(m => setMetrics(m.map(x => ({ key: x.key, label: x.label }))));
  }, []);

  useEffect(() => {
    setLoading(true);
    targetsApi.getLeaderboard(metricKey, period)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [metricKey, period]);

  const RANK_ICONS = ['🥇', '🥈', '🥉'];

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Team Performance</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={metricKey}
            onChange={e => setMetricKey(e.target.value)}
            className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          >
            {metrics.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-slate-800 rounded" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-4 text-center">
          No target data available for this period
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const pace = getPace(entry.pace);
            const pct = Math.min(entry.percentage, 100);
            const selectedMetric = metrics.find(m => m.key === metricKey);
            const unit = metricKey.includes('revenue') || metricKey.includes('pipeline') || metricKey.includes('deal_size') ? '$' : '';

            return (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  idx < 3 ? 'bg-gray-50 dark:bg-slate-800/50' : ''
                }`}
              >
                {/* Rank */}
                <span className="text-sm w-6 text-center">
                  {idx < 3 ? RANK_ICONS[idx] : <span className="text-gray-400 text-xs">{entry.rank}</span>}
                </span>

                {/* Avatar + name */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-600">
                    {entry.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {entry.name}
                  </span>
                </div>

                {/* Actual / Target */}
                <div className="text-right w-24">
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {formatValue(entry.actual, unit)}
                  </span>
                  <span className="text-[10px] text-gray-400"> / {formatValue(entry.target, unit)}</span>
                </div>

                {/* Progress */}
                <div className="w-16">
                  <div className="h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${pace.bg} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-[10px] font-medium ${pace.color}`}>{entry.percentage.toFixed(0)}%</span>
                </div>

                {/* Pace */}
                <span className={`text-xs w-6 text-center`}>{pace.icon}</span>

                {/* Streak */}
                <span className="text-xs w-6 text-center text-amber-500">
                  {entry.streak > 0 ? `🔥${entry.streak}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}