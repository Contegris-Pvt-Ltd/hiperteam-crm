// ============================================================
// FILE: apps/web/src/features/opportunities/components/ForecastView.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Loader2, BarChart3 } from 'lucide-react';
import { opportunitiesApi } from '../../../api/opportunities.api';
import type { ForecastCategory } from '../../../api/opportunities.api';

interface ForecastViewProps {
  pipelineId?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  'Pipeline':   { bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', bar: 'bg-blue-500' },
  'Best Case':  { bg: 'bg-purple-50 dark:bg-purple-900/10', text: 'text-purple-700 dark:text-purple-400', bar: 'bg-purple-500' },
  'Commit':     { bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' },
  'Closed':     { bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-700 dark:text-green-400', bar: 'bg-green-600' },
  'Omitted':    { bg: 'bg-gray-50 dark:bg-gray-900/10', text: 'text-gray-600 dark:text-gray-400', bar: 'bg-gray-400' },
};

export function ForecastView({ pipelineId }: ForecastViewProps) {
  const [categories, setCategories] = useState<ForecastCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    opportunitiesApi.getForecast(pipelineId)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pipelineId]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const totalAmount = categories.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalWeighted = categories.reduce((sum, c) => sum + c.weightedAmount, 0);
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);
  const maxAmount = Math.max(...categories.map(c => c.totalAmount), 1);

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">No forecast data available</p>
        <p className="text-xs text-gray-400 mt-1">Opportunities need amounts and forecast categories to appear here</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <BarChart3 size={14} />
            Total Pipeline
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-gray-400">{totalCount} opportunities</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp size={14} />
            Weighted Pipeline
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalWeighted)}</p>
          <p className="text-xs text-gray-400">probability-adjusted</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign size={14} />
            Avg Deal Size
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalCount > 0 ? formatCurrency(totalAmount / totalCount) : '$0'}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Omitted'];
          const barWidth = (cat.totalAmount / maxAmount) * 100;
          const isExpanded = expandedCategory === cat.category;

          return (
            <div key={cat.category} className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${colors.bg}`}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${colors.text}`}>{cat.category}</span>
                    <span className="text-xs text-gray-400">({cat.count})</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(cat.totalAmount)}</p>
                    <p className="text-xs text-gray-500">Wtd: {formatCurrency(cat.weightedAmount)}</p>
                  </div>
                </div>
                {/* Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${colors.bar} transition-all`} style={{ width: `${barWidth}%` }} />
                </div>
              </button>

              {/* Expanded: show individual opportunities */}
              {isExpanded && cat.opportunities.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 pb-3">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1 font-medium">Opportunity</th>
                        <th className="text-right py-1 font-medium">Amount</th>
                        <th className="text-right py-1 font-medium">Prob.</th>
                        <th className="text-right py-1 font-medium">Weighted</th>
                        <th className="text-right py-1 font-medium">Close</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.opportunities.map((opp) => (
                        <tr key={opp.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-1.5">
                            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{opp.name}</p>
                            <p className="text-gray-400">{opp.ownerName} · {opp.stageName}</p>
                          </td>
                          <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{formatCurrency(opp.amount)}</td>
                          <td className="py-1.5 text-right text-gray-500">{opp.probability}%</td>
                          <td className="py-1.5 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(opp.weightedAmount)}</td>
                          <td className="py-1.5 text-right text-gray-500">
                            {new Date(opp.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}