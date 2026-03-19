import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { accountsApi } from '../../api/accounts.api';
import { customer360Api } from '../../api/customer-360.api';
import type { Subscription, CustomerScores, SubscriptionSummary, UsageSummaryEntry } from '../../api/customer-360.api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ArrowLeft, RefreshCw, Heart, TrendingUp, TrendingDown, AlertTriangle,
  Shield, DollarSign, Package, Calendar, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Plus, ExternalLink, Zap, Target, Users,
  BarChart3, Activity, Mail, FileText, Loader2, AlertCircle, Minus,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════
// Helper Components
// ════════════════════════════════════════════════════════════

function ScoreGauge({ value, size = 'lg' }: { value: number; size?: 'sm' | 'lg' }) {
  const color = value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500';
  const bg = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const sz = size === 'lg' ? 'w-20 h-20' : 'w-12 h-12';
  const textSz = size === 'lg' ? 'text-2xl' : 'text-sm';
  return (
    <div className={`${sz} rounded-full border-4 ${value >= 70 ? 'border-green-200 dark:border-green-900' : value >= 40 ? 'border-amber-200 dark:border-amber-900' : 'border-red-200 dark:border-red-900'} flex items-center justify-center relative`}>
      <span className={`${textSz} font-bold ${color}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    none: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function RenewalBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-gray-400">—</span>;
  if (days < 0) return <span className="text-xs font-medium text-red-600 dark:text-red-400">{Math.abs(days)}d overdue</span>;
  if (days <= 30) return <span className="text-xs font-medium text-red-600 dark:text-red-400">{days}d</span>;
  if (days <= 90) return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{days}d</span>;
  return <span className="text-xs text-green-600 dark:text-green-400">{days}d</span>;
}

function TrendIcon({ trend, change }: { trend: string; change: number }) {
  if (trend === 'up') return <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium"><TrendingUp className="w-3 h-3" /> +{change}%</span>;
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-xs font-medium"><TrendingDown className="w-3 h-3" /> {change}%</span>;
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus className="w-3 h-3" /> 0%</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 ${className}`}>
      {children}
    </div>
  );
}

function formatCurrency(val: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = usePermissions();
  const [account, setAccount] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [scores, setScores] = useState<CustomerScores | null>(null);
  const [usageSummaries, setUsageSummaries] = useState<Record<string, UsageSummaryEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'usage' | 'signals'>('overview');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [acc, subs, sum, sc] = await Promise.all([
        accountsApi.getOne(id),
        customer360Api.getSubscriptions(id),
        customer360Api.getSubscriptionSummary(id),
        customer360Api.getScores(id).catch(() => null),
      ]);
      setAccount(acc);
      setSubscriptions(subs);
      setSummary(sum);
      setScores(sc);

      // Load usage summaries for active subscriptions
      const usageMap: Record<string, UsageSummaryEntry[]> = {};
      for (const sub of subs.filter(s => s.status === 'active' && s.usageSourceType)) {
        try {
          const entries = await customer360Api.getUsageSummary(id, sub.productId);
          if (entries.length > 0) usageMap[sub.productId] = entries;
        } catch { /* ignore */ }
      }
      setUsageSummaries(usageMap);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRecalculate = async () => {
    if (!id) return;
    setRecalculating(true);
    try {
      const newScores = await customer360Api.recalculateScores(id);
      setScores(newScores);
    } catch { /* ignore */ }
    setRecalculating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-slate-400">{error || 'Account not found'}</p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700">Retry</button>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'subscriptions', label: `Subscriptions (${subscriptions.length})` },
    { key: 'usage', label: 'Usage Insights' },
    { key: 'signals', label: `Signals${scores?.churnSignals?.length ? ` (${scores.churnSignals.length})` : ''}` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header ───────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link to={`/accounts/${id}`} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {account.logoUrl ? (
              <img src={account.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {(account.name || '?')[0]}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{account.name}</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {[account.industry, account.accountType, account.companySize].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      {/* ── Score Cards ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Health</span>
            <Heart className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-3">
            <ScoreGauge value={scores?.healthScore || 0} size="sm" />
            <div>
              <StatusBadge status={scores?.healthStatus || 'unknown'} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Revenue</span>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary?.totalMrr || 0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">MRR · {formatCurrency(summary?.totalArr || 0)} ARR</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Churn Risk</span>
            <Shield className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-1">
            <StatusBadge status={scores?.churnRisk || 'unknown'} />
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{scores?.churnSignals?.length || 0} signal(s)</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">CLTV</span>
            <Target className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(scores?.cltv || 0)}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{scores?.upsellSuggestions?.length || 0} upsell opportunities</p>
        </Card>
      </div>

      {/* ── Tabs ─────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors ${
                activeTab === t.key
                  ? 'bg-white dark:bg-slate-800 border border-b-0 border-gray-200 dark:border-slate-700 text-purple-600 dark:text-purple-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab
          scores={scores}
          subscriptions={subscriptions}
          summary={summary}
          usageSummaries={usageSummaries}
          accountId={id!}
        />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionsTab
          subscriptions={subscriptions}
          summary={summary}
          onRefresh={loadData}
          accountId={id!}
        />
      )}

      {activeTab === 'usage' && (
        <UsageTab
          subscriptions={subscriptions.filter(s => s.status === 'active')}
          usageSummaries={usageSummaries}
          accountId={id!}
        />
      )}

      {activeTab === 'signals' && (
        <SignalsTab scores={scores} accountId={id!} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Overview Tab
// ════════════════════════════════════════════════════════════

function OverviewTab({
  scores, subscriptions, summary, usageSummaries, accountId,
}: {
  scores: CustomerScores | null;
  subscriptions: Subscription[];
  summary: SubscriptionSummary | null;
  usageSummaries: Record<string, UsageSummaryEntry[]>;
  accountId: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Health Breakdown */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500" /> Health Score Breakdown
        </h3>
        {scores?.healthBreakdown ? (
          <div className="space-y-3">
            {Object.entries(scores.healthBreakdown).map(([key, { score, weight }]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{score}/100 <span className="text-xs text-gray-400">({weight}%)</span></span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No scores calculated yet. Click Recalculate.</p>
        )}
      </Card>

      {/* Upsell Opportunities */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Upsell Opportunities
        </h3>
        {scores?.upsellSuggestions && scores.upsellSuggestions.length > 0 ? (
          <div className="space-y-3">
            {scores.upsellSuggestions.map((s, i) => (
              <div key={s.productId} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">{i + 1}. {s.productName}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    s.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : s.score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-slate-300'
                  }`}>
                    Score: {s.score}
                  </span>
                </div>
                <ul className="text-xs text-gray-500 dark:text-slate-400 space-y-0.5">
                  {s.reasons.map((r, j) => <li key={j}>• {r}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No upsell opportunities detected.</p>
        )}
      </Card>

      {/* Subscriptions Summary */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" /> Subscriptions
        </h3>
        {subscriptions.length > 0 ? (
          <div className="space-y-2">
            {subscriptions.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{s.productName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(s.mrr)}/mo</span>
                  <RenewalBadge days={s.daysUntilRenewal} />
                </div>
              </div>
            ))}
            {subscriptions.length > 6 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{subscriptions.length - 6} more</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No subscriptions yet.</p>
        )}
      </Card>

      {/* Usage Insights */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Usage Insights
        </h3>
        {Object.keys(usageSummaries).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(usageSummaries).map(([productId, entries]) => {
              const sub = subscriptions.find(s => s.productId === productId);
              return entries.map((e) => (
                <div key={`${productId}-${e.metricKey}`} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                  <div>
                    <span className="text-sm text-gray-900 dark:text-white">{e.metricKey.replace(/_/g, ' ')}</span>
                    {sub && <span className="text-xs text-gray-400 ml-2">({sub.productName})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{e.currentValue.toLocaleString()}</span>
                    <TrendIcon trend={e.trend} change={e.changePercent} />
                  </div>
                </div>
              ));
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No usage data configured. Set up usage sources on subscriptions.</p>
        )}
      </Card>

      {/* Churn Signals */}
      {scores?.churnSignals && scores.churnSignals.length > 0 && (
        <Card className="p-5 lg:col-span-2 border-amber-200 dark:border-amber-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Churn Signals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {scores.churnSignals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  s.severity === 'high' ? 'bg-red-500' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <span className="text-sm text-gray-700 dark:text-slate-300">{s.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Subscriptions Tab
// ════════════════════════════════════════════════════════════

function SubscriptionsTab({
  subscriptions, summary, onRefresh, accountId,
}: {
  subscriptions: Subscription[];
  summary: SubscriptionSummary | null;
  onRefresh: () => void;
  accountId: string;
}) {
  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active', value: summary.activeCount, color: 'text-green-600' },
            { label: 'Trial', value: summary.trialCount, color: 'text-blue-600' },
            { label: 'MRR', value: formatCurrency(summary.totalMrr), color: 'text-gray-900 dark:text-white' },
            { label: 'ARR', value: formatCurrency(summary.totalArr), color: 'text-gray-900 dark:text-white' },
            { label: 'Renewals (90d)', value: summary.renewalsIn90Days, color: summary.renewalsIn90Days > 0 ? 'text-amber-600' : 'text-gray-400' },
          ].map((s, i) => (
            <Card key={i} className="p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700/50 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">MRR</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Renewal</th>
                <th className="px-4 py-3">Auto</th>
                <th className="px-4 py-3">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{s.productName || 'Unknown'}</span>
                      {s.productCode && <span className="text-xs text-gray-400 ml-2">{s.productCode}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(s.mrr)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{s.billingFrequency}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3"><RenewalBadge days={s.daysUntilRenewal} /></td>
                  <td className="px-4 py-3">
                    {s.autoRenew ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-4 py-3">
                    {s.usageSourceType ? (
                      <span className="text-xs text-green-600 dark:text-green-400">● {s.usageSourceType}</span>
                    ) : (
                      <span className="text-xs text-gray-400">Not configured</span>
                    )}
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No subscriptions. Click + to add one manually.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Usage Tab
// ════════════════════════════════════════════════════════════

function UsageTab({
  subscriptions, usageSummaries, accountId,
}: {
  subscriptions: Subscription[];
  usageSummaries: Record<string, UsageSummaryEntry[]>;
  accountId: string;
}) {
  return (
    <div className="space-y-6">
      {subscriptions.map((sub) => {
        const entries = usageSummaries[sub.productId];
        return (
          <Card key={sub.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                {sub.productName}
              </h3>
              {sub.usageSourceType ? (
                <span className="text-xs text-gray-400">
                  Source: {sub.usageSourceType} · Last sync: {sub.usageLastSyncedAt ? new Date(sub.usageLastSyncedAt).toLocaleString() : 'Never'}
                </span>
              ) : (
                <span className="text-xs text-amber-500">Usage source not configured</span>
              )}
            </div>

            {entries && entries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entries.map((e) => (
                  <div key={e.metricKey} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{e.metricKey.replace(/_/g, ' ')}</p>
                    <div className="flex items-end justify-between mt-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">{e.currentValue.toLocaleString()}</span>
                      <TrendIcon trend={e.trend} change={e.changePercent} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Previous: {e.previousValue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No usage data available for this product.</p>
            )}
          </Card>
        );
      })}

      {subscriptions.length === 0 && (
        <Card className="p-8 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No active subscriptions to show usage for.</p>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Signals Tab
// ════════════════════════════════════════════════════════════

function SignalsTab({ scores, accountId }: { scores: CustomerScores | null; accountId: string }) {
  if (!scores) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400">No scores calculated. Click Recalculate to generate signals.</p>
      </Card>
    );
  }

  const signals = scores.churnSignals || [];
  const suggestions = scores.upsellSuggestions || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Churn Signals */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" /> Churn Risk: <StatusBadge status={scores.churnRisk} />
        </h3>
        {signals.length > 0 ? (
          <div className="space-y-2">
            {signals.map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${
                s.severity === 'high' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                : s.severity === 'medium' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium uppercase ${
                    s.severity === 'high' ? 'text-red-600' : s.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                  }`}>
                    {s.severity}
                  </span>
                  <span className="text-xs text-gray-400">{s.type.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-slate-300">{s.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-green-700 dark:text-green-400">No churn signals detected. Account looks healthy!</p>
          </div>
        )}
      </Card>

      {/* Upsell Suggestions */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Upsell Suggestions
        </h3>
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={s.productId} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{s.productName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${s.score >= 80 ? 'bg-green-500' : s.score >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-300">{s.score}</span>
                  </div>
                </div>
                <ul className="space-y-1">
                  {s.reasons.map((r, j) => (
                    <li key={j} className="text-xs text-gray-500 dark:text-slate-400 flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/opportunities/new?accountId=${accountId}&productId=${s.productId}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Create Opportunity
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No upsell suggestions at this time.</p>
        )}
      </Card>

      {/* Key Metrics */}
      <Card className="p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" /> Key Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Engagement', value: scores.engagementScore, icon: Users, suffix: '/100' },
            { label: 'Active Subs', value: scores.activeSubscriptions, icon: Package, suffix: '' },
            { label: 'Total MRR', value: formatCurrency(scores.totalMrr), icon: DollarSign, suffix: '' },
            { label: 'Next Renewal', value: scores.nextRenewalDate ? new Date(scores.nextRenewalDate).toLocaleDateString() : 'None', icon: Calendar, suffix: '' },
          ].map((m, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-slate-400">{m.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{m.value}{m.suffix}</p>
            </div>
          ))}
        </div>
        {scores.lastCalculatedAt && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last calculated: {new Date(scores.lastCalculatedAt).toLocaleString()}
          </p>
        )}
      </Card>
    </div>
  );
}
