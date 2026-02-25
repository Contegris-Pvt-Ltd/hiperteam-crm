// ============================================================
// FILE: apps/web/src/features/dashboard/AccountForecastWidget.tsx
//
// Dashboard widget showing top accounts with forecast category
// breakdown for the coming quarter. Compact display with
// expandable rows and link to full report.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, ArrowRight, ChevronDown, ChevronRight,
  Loader2, DollarSign, TrendingUp, ExternalLink,
} from 'lucide-react';
import { dashboardApi } from '../../api/dashboard.api';
import type { AccountForecastData } from '../../api/dashboard.api';

// ── Forecast Category Colors ──
const CAT_COLORS: Record<string, { dot: string; text: string }> = {
  commit:    { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  best_case: { dot: 'bg-blue-500', text: 'text-blue-600' },
  pipeline:  { dot: 'bg-amber-500', text: 'text-amber-600' },
  upside:    { dot: 'bg-purple-500', text: 'text-purple-600' },
};

function getCatColor(cat: string) {
  const key = cat?.toLowerCase().replace(/\s+/g, '_');
  return CAT_COLORS[key] || { dot: 'bg-gray-400', text: 'text-gray-500' };
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

function formatCatLabel(cat: string): string {
  if (!cat) return 'N/A';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ════════════════════════════════════════════════════════════
// WIDGET
// ════════════════════════════════════════════════════════════

interface AccountForecastWidgetProps {
  className?: string;
  scope?: 'own' | 'team' | 'all';
  limit?: number;
}

export function AccountForecastWidget({
  className = '',
  scope = 'all',
  limit = 8,
}: AccountForecastWidgetProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<AccountForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.getAccountForecast({ scope, quarter: 'next' })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scope]);

  const topAccounts = data?.flatTable.slice(0, limit) || [];

  return (
    <div className={`bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Account Forecast — Next Quarter</h3>
        </div>
        <button
          onClick={() => navigate('/reports/account-forecast')}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
        >
          Full Report <ArrowRight size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : topAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">No account forecast data for next quarter</p>
          </div>
        ) : (
          <>
            {/* Mini KPIs */}
            {data?.summary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniKpi
                  icon={Building2}
                  label="Accounts"
                  value={String(data.summary.totalAccounts)}
                  color="text-blue-600"
                />
                <MiniKpi
                  icon={DollarSign}
                  label="Pipeline"
                  value={formatCurrency(data.summary.totalAmount)}
                  color="text-emerald-600"
                />
                <MiniKpi
                  icon={TrendingUp}
                  label="Weighted"
                  value={formatCurrency(data.summary.totalWeighted)}
                  color="text-purple-600"
                />
              </div>
            )}

            {/* Category breakdown mini-bar */}
            {data?.summary && data.summary.totalAmount > 0 && (
              <div className="mb-4">
                <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800">
                  {data.summary.commitTotal > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${(data.summary.commitTotal / data.summary.totalAmount) * 100}%` }} />
                  )}
                  {data.summary.bestCaseTotal > 0 && (
                    <div className="bg-blue-500" style={{ width: `${(data.summary.bestCaseTotal / data.summary.totalAmount) * 100}%` }} />
                  )}
                  {data.summary.pipelineTotal > 0 && (
                    <div className="bg-amber-500" style={{ width: `${(data.summary.pipelineTotal / data.summary.totalAmount) * 100}%` }} />
                  )}
                  {data.summary.upsideTotal > 0 && (
                    <div className="bg-purple-500" style={{ width: `${(data.summary.upsideTotal / data.summary.totalAmount) * 100}%` }} />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {[
                    { k: 'commit', v: data.summary.commitTotal, c: 'bg-emerald-500' },
                    { k: 'best_case', v: data.summary.bestCaseTotal, c: 'bg-blue-500' },
                    { k: 'pipeline', v: data.summary.pipelineTotal, c: 'bg-amber-500' },
                    { k: 'upside', v: data.summary.upsideTotal, c: 'bg-purple-500' },
                  ].filter(x => x.v > 0).map(x => (
                    <span key={x.k} className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${x.c}`} />
                      {formatCatLabel(x.k)} {formatCurrency(x.v)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Account rows */}
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {topAccounts.map(acc => {
                const isOpen = expanded === acc.accountId;
                const catColor = getCatColor(acc.dominantForecast);

                return (
                  <div key={acc.accountId}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : acc.accountId)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-left transition-colors"
                    >
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{acc.accountName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`flex items-center gap-1 text-[10px] font-medium ${catColor.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`} />
                            {formatCatLabel(acc.dominantForecast)}
                          </span>
                          <span className="text-[10px] text-gray-400">{acc.dealCount} deal{acc.dealCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(acc.totalAmount)}</p>
                        <p className="text-[10px] text-purple-500">{formatCurrency(acc.weightedAmount)} wtd</p>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="ml-8 mr-3 mb-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {acc.commitAmount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Commit
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(acc.commitAmount)}</span>
                            </div>
                          )}
                          {acc.bestCaseAmount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-blue-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Best Case
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(acc.bestCaseAmount)}</span>
                            </div>
                          )}
                          {acc.pipelineAmount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-amber-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pipeline
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(acc.pipelineAmount)}</span>
                            </div>
                          )}
                          {acc.upsideAmount > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-purple-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Upside
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(acc.upsideAmount)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                          <span className="text-[10px] text-gray-400">
                            {acc.industry || 'No industry'} · {acc.owner || 'Unassigned'} · {acc.avgProbability}% avg prob
                          </span>
                          <Link
                            to={`/accounts/${acc.accountId}`}
                            className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mini KPI ──
function MiniKpi({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: string;
}) {
  return (
    <div className="text-center">
      <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${color}`} />
      <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}