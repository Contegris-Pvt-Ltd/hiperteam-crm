// ============================================================
// FILE: apps/web/src/features/reports/AccountForecastPage.tsx
//
// Dedicated standalone page: /reports/account-forecast
// Three tabs/views:
//   1. By Account → Forecast Category breakdown
//   2. By Forecast Category → Accounts breakdown
//   3. Flat Table (one row per account)
// Includes quarter toggle (current/next), scope filter,
// summary KPIs, and expandable detail rows.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, DollarSign, Target, TrendingUp,
  ChevronDown, ChevronRight, Loader2, RefreshCw,
  BarChart3, Table2, Layers, ExternalLink, Search,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { dashboardApi } from '../../api/dashboard.api';
import type {
  AccountForecastData, AccountForecastByAccount,
  AccountForecastByCategory, AccountForecastFlat,
  AccountForecastSummary,
} from '../../api/dashboard.api';

// ── Forecast Category Colors ──
const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string; dot: string }> = {
  commit:    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  best_case: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  pipeline:  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  upside:    { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', bar: 'bg-purple-500', dot: 'bg-purple-500' },
  omitted:   { bg: 'bg-gray-50 dark:bg-gray-800/50', text: 'text-gray-500 dark:text-gray-400', bar: 'bg-gray-400', dot: 'bg-gray-400' },
};

function getCategoryStyle(cat: string) {
  const key = cat?.toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.omitted;
}

function formatCategoryLabel(cat: string): string {
  if (!cat) return 'Uncategorized';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type ViewMode = 'by_account' | 'by_category' | 'flat_table';

const VIEW_TABS: { key: ViewMode; label: string; icon: any; desc: string }[] = [
  { key: 'by_account', label: 'By Account', icon: Building2, desc: 'Accounts with category breakdown' },
  { key: 'by_category', label: 'By Category', icon: Layers, desc: 'Forecast buckets with accounts' },
  { key: 'flat_table', label: 'Flat Table', icon: Table2, desc: 'One row per account with all columns' },
];

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export function AccountForecastPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [data, setData] = useState<AccountForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Controls
  const [view, setView] = useState<ViewMode>('flat_table');
  const [quarter, setQuarter] = useState<'current' | 'next'>('next');
  const [scope, setScope] = useState<'own' | 'team' | 'all'>('all');
  const [search, setSearch] = useState('');

  const canSeeTeam = user?.role === 'admin' || user?.role === 'manager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await dashboardApi.getAccountForecast({ scope, quarter });
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load forecast data');
    } finally {
      setLoading(false);
    }
  }, [scope, quarter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter by search
  const filteredByAccount = data?.byAccount.filter(a =>
    a.accountName.toLowerCase().includes(search.toLowerCase()) ||
    (a.industry || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const filteredFlat = data?.flatTable.filter(a =>
    a.accountName.toLowerCase().includes(search.toLowerCase()) ||
    (a.industry || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.owner || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Account Forecast Report
                </h1>
                {data?.summary && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {quarter === 'next' ? 'Next' : 'Current'} Quarter: {formatDate(data.summary.quarterStart)} — {formatDate(data.summary.quarterEnd)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quarter Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setQuarter('current')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quarter === 'current'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Current Qtr
                </button>
                <button
                  onClick={() => setQuarter('next')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    quarter === 'next'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Next Qtr
                </button>
              </div>

              {/* Scope */}
              {canSeeTeam && (
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'own' | 'team' | 'all')}
                  className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300"
                >
                  <option value="own">My Deals</option>
                  <option value="team">My Team</option>
                  <option value="all">All</option>
                </select>
              )}

              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Loading ── */}
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* ── Summary KPIs ── */}
            <SummaryKPIs summary={data.summary} />

            {/* ── Category Totals Bar ── */}
            <CategoryBreakdownBar summary={data.summary} />

            {/* ── View Tabs + Search ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
                {VIEW_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setView(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      view === tab.key
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search accounts..."
                  className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 w-60"
                />
              </div>
            </div>

            {/* ── View Content ── */}
            {view === 'by_account' && (
              <ByAccountView accounts={filteredByAccount} />
            )}
            {view === 'by_category' && (
              <ByCategoryView categories={data.byCategory} search={search} />
            )}
            {view === 'flat_table' && (
              <FlatTableView rows={filteredFlat} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUMMARY KPIs
// ════════════════════════════════════════════════════════════

function SummaryKPIs({ summary }: { summary: AccountForecastSummary }) {
  const kpis = [
    { label: 'Accounts', value: String(summary.totalAccounts), icon: Building2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Open Deals', value: String(summary.totalDeals), icon: Target, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Total Pipeline', value: formatCurrency(summary.totalAmount), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Weighted Value', value: formatCurrency(summary.totalWeighted), icon: TrendingUp, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Avg Probability', value: `${summary.avgProbability}%`, icon: BarChart3, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map(kpi => (
        <div key={kpi.label} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={`p-1.5 rounded-lg ${kpi.color}`}>
              <kpi.icon className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{kpi.value}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{kpi.label}</p>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CATEGORY BREAKDOWN BAR
// ════════════════════════════════════════════════════════════

function CategoryBreakdownBar({ summary }: { summary: AccountForecastSummary }) {
  const categories = [
    { key: 'commit', label: 'Commit', amount: summary.commitTotal },
    { key: 'best_case', label: 'Best Case', amount: summary.bestCaseTotal },
    { key: 'pipeline', label: 'Pipeline', amount: summary.pipelineTotal },
    { key: 'upside', label: 'Upside', amount: summary.upsideTotal },
  ].filter(c => c.amount > 0);

  const total = summary.totalAmount || 1;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Forecast Category Distribution</h3>
      </div>

      {/* Stacked bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800 mb-3">
        {categories.map(c => {
          const style = getCategoryStyle(c.key);
          const pct = (c.amount / total) * 100;
          return (
            <div
              key={c.key}
              className={`${style.bar} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${c.label}: ${formatCurrency(c.amount)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {categories.map(c => {
          const style = getCategoryStyle(c.key);
          return (
            <div key={c.key} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{c.label}</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{formatCurrency(c.amount)}</span>
              <span className="text-[10px] text-gray-400">({((c.amount / total) * 100).toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VIEW 1: BY ACCOUNT
// ════════════════════════════════════════════════════════════

function ByAccountView({ accounts }: { accounts: AccountForecastByAccount[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (accounts.length === 0) {
    return <EmptyState text="No accounts with deals closing in this quarter" />;
  }

  return (
    <div className="space-y-2">
      {accounts.map(acc => {
        const isOpen = expanded.has(acc.accountId);
        return (
          <div key={acc.accountId} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(acc.accountId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{acc.accountName}</p>
                {acc.industry && <p className="text-[10px] text-gray-400">{acc.industry}</p>}
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(acc.totalAmount)}</p>
                  <p className="text-[10px] text-gray-400">{acc.totalDeals} deal{acc.totalDeals !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-purple-600">{formatCurrency(acc.totalWeighted)}</p>
                  <p className="text-[10px] text-gray-400">weighted</p>
                </div>
                {/* Mini category indicators */}
                <div className="flex gap-1">
                  {acc.categories.map(cat => {
                    const style = getCategoryStyle(cat.forecastCategory);
                    return (
                      <span
                        key={cat.forecastCategory}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}
                        title={`${formatCategoryLabel(cat.forecastCategory)}: ${formatCurrency(cat.totalAmount)}`}
                      >
                        {formatCategoryLabel(cat.forecastCategory)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-gray-100 dark:border-slate-800">
                <table className="w-full mt-2">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                      <th className="text-left py-1 font-medium">Category</th>
                      <th className="text-right py-1 font-medium">Deals</th>
                      <th className="text-right py-1 font-medium">Amount</th>
                      <th className="text-right py-1 font-medium">Weighted</th>
                      <th className="text-right py-1 font-medium">Avg Prob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acc.categories.map(cat => {
                      const style = getCategoryStyle(cat.forecastCategory);
                      return (
                        <tr key={cat.forecastCategory} className="border-t border-gray-50 dark:border-slate-800">
                          <td className="py-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {formatCategoryLabel(cat.forecastCategory)}
                            </span>
                          </td>
                          <td className="text-right text-sm text-gray-600 dark:text-gray-400">{cat.dealCount}</td>
                          <td className="text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(cat.totalAmount)}</td>
                          <td className="text-right text-sm text-purple-600">{formatCurrency(cat.weightedAmount)}</td>
                          <td className="text-right text-sm text-gray-500">{cat.avgProbability}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-end">
                  <Link
                    to={`/accounts/${acc.accountId}`}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    View Account <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VIEW 2: BY FORECAST CATEGORY
// ════════════════════════════════════════════════════════════

function ByCategoryView({ categories, search }: { categories: AccountForecastByCategory[]; search: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(categories.map(c => c.forecastCategory)));

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (categories.length === 0) {
    return <EmptyState text="No forecast data for this quarter" />;
  }

  return (
    <div className="space-y-4">
      {categories.map(cat => {
        const style = getCategoryStyle(cat.forecastCategory);
        const isOpen = expanded.has(cat.forecastCategory);
        const filteredAccounts = search
          ? cat.accounts.filter(a => a.accountName.toLowerCase().includes(search.toLowerCase()))
          : cat.accounts;

        return (
          <div key={cat.forecastCategory} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(cat.forecastCategory)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${style.bg} ${style.text}`}>
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                {formatCategoryLabel(cat.forecastCategory)}
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-6 flex-shrink-0">
                <span className="text-sm text-gray-500">{cat.totalDeals} deal{cat.totalDeals !== 1 ? 's' : ''}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(cat.totalAmount)}</span>
                <span className="text-sm text-purple-600">{formatCurrency(cat.totalWeighted)} weighted</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 dark:border-slate-800">
                {filteredAccounts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No matching accounts</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-50 dark:border-slate-800">
                        <th className="text-left px-4 py-2 font-medium">Account</th>
                        <th className="text-right px-4 py-2 font-medium">Deals</th>
                        <th className="text-right px-4 py-2 font-medium">Amount</th>
                        <th className="text-right px-4 py-2 font-medium">Weighted</th>
                        <th className="text-right px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map(acc => (
                        <tr key={acc.accountId} className="border-t border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2">
                            <Link to={`/accounts/${acc.accountId}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600">
                              {acc.accountName}
                            </Link>
                          </td>
                          <td className="text-right px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{acc.dealCount}</td>
                          <td className="text-right px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(acc.totalAmount)}</td>
                          <td className="text-right px-4 py-2 text-sm text-purple-600">{formatCurrency(acc.weightedAmount)}</td>
                          <td className="text-right px-4 py-2">
                            <Link to={`/accounts/${acc.accountId}`} className="text-gray-400 hover:text-blue-600">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// VIEW 3: FLAT TABLE
// ════════════════════════════════════════════════════════════

function FlatTableView({ rows }: { rows: AccountForecastFlat[] }) {
  const [sortBy, setSortBy] = useState<string>('totalAmount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0;
    const bVal = (b as any)[sortBy] ?? 0;
    if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (rows.length === 0) {
    return <EmptyState text="No accounts with deals closing in this quarter" />;
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return null;
    return sortDir === 'asc'
      ? <ArrowUpRight className="w-3 h-3 inline ml-0.5" />
      : <ArrowDownRight className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <ThSort col="accountName" label="Account" onClick={handleSort}><SortIcon col="accountName" /></ThSort>
              <ThSort col="industry" label="Industry" onClick={handleSort}><SortIcon col="industry" /></ThSort>
              <ThSort col="dealCount" label="Deals" onClick={handleSort} align="right"><SortIcon col="dealCount" /></ThSort>
              <ThSort col="totalAmount" label="Total Amount" onClick={handleSort} align="right"><SortIcon col="totalAmount" /></ThSort>
              <ThSort col="weightedAmount" label="Weighted" onClick={handleSort} align="right"><SortIcon col="weightedAmount" /></ThSort>
              <ThSort col="commitAmount" label="Commit" onClick={handleSort} align="right"><SortIcon col="commitAmount" /></ThSort>
              <ThSort col="bestCaseAmount" label="Best Case" onClick={handleSort} align="right"><SortIcon col="bestCaseAmount" /></ThSort>
              <ThSort col="pipelineAmount" label="Pipeline" onClick={handleSort} align="right"><SortIcon col="pipelineAmount" /></ThSort>
              <ThSort col="avgProbability" label="Avg Prob" onClick={handleSort} align="right"><SortIcon col="avgProbability" /></ThSort>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const style = getCategoryStyle(row.dominantForecast);
              return (
                <tr key={row.accountId} className="border-t border-gray-50 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2.5">
                    <Link to={`/accounts/${row.accountId}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600">
                      {row.accountName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{row.industry || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-600 dark:text-gray-400">{row.dealCount}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(row.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-purple-600">{formatCurrency(row.weightedAmount)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-emerald-600">{row.commitAmount > 0 ? formatCurrency(row.commitAmount) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-blue-600">{row.bestCaseAmount > 0 ? formatCurrency(row.bestCaseAmount) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-amber-600">{row.pipelineAmount > 0 ? formatCurrency(row.pipelineAmount) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-500">{row.avgProbability}%</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-[120px]">{row.owner || '—'}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/accounts/${row.accountId}`} className="text-gray-400 hover:text-blue-600">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sortable TH ──
function ThSort({ col, label, onClick, align = 'left', children }: {
  col: string; label: string; onClick: (col: string) => void;
  align?: 'left' | 'right'; children?: React.ReactNode;
}) {
  return (
    <th
      className={`px-3 py-2 font-medium cursor-pointer hover:text-gray-600 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onClick(col)}
    >
      {label}{children}
    </th>
  );
}

// ── Empty State ──
function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center py-16">
      <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  );
}