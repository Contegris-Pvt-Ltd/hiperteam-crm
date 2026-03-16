// ============================================================
// FILE: apps/web/src/features/dashboard/LeaderboardWidget.tsx
// ============================================================
import { useState } from 'react';
import { Crown, ArrowUpDown } from 'lucide-react';
import type { ReportResult } from '../../api/reports.api';

interface LeaderboardWidgetProps {
  data: ReportResult | null;
  displayConfig: {
    rankBy?: string;
    showCrown?: boolean;
  };
  loading?: boolean;
}

function formatCell(value: any, format?: string): string {
  if (value === null || value === undefined) return '—';
  if (format === 'currency') {
    const n = Number(value);
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }
  if (format === 'percent') return `${Number(value).toFixed(1)}%`;
  if (format === 'number') return Number(value).toLocaleString();
  return String(value);
}

const MEDAL_COLORS = ['#EAB308', '#94A3B8', '#CD7F32'];

export function LeaderboardWidget({ data, displayConfig, loading }: LeaderboardWidgetProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!data || !data.data.length) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">No data</div>
  );

  const dimCols = data.columns.filter(c => ['text', 'date'].includes(c.format || ''));
  const measureCols = data.columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));

  // Sort
  const sortedData = [...data.data].sort((a, b) => {
    const k = sortKey || displayConfig.rankBy || measureCols[0]?.key;
    if (!k) return 0;
    const av = Number(a[k]) || 0;
    const bv = Number(b[k]) || 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const maxVal = measureCols[0]
    ? Math.max(...sortedData.map(r => Number(r[measureCols[0].key]) || 0))
    : 0;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 w-8">#</th>
              {dimCols.map(col => (
                <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {col.label}
                </th>
              ))}
              {measureCols.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    {col.label}
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </div>
                </th>
              ))}
              {measureCols.length > 0 && (
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 w-24">
                  Progress
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {sortedData.map((row, idx) => {
              const primaryVal = measureCols[0] ? Number(row[measureCols[0].key]) || 0 : 0;
              const progress = maxVal > 0 ? (primaryVal / maxVal) * 100 : 0;
              const isTopRank = idx === 0;

              return (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/40 ${
                    isTopRank ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                  }`}
                >
                  <td className="px-3 py-2.5">
                    {isTopRank && displayConfig.showCrown ? (
                      <Crown
                        className="w-4 h-4 text-yellow-500"
                        style={{ animation: 'crownPulse 2s infinite ease-in-out' }}
                      />
                    ) : (
                      <span
                        className="text-xs font-bold"
                        style={{ color: MEDAL_COLORS[idx] || '#94a3b8' }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </td>
                  {dimCols.map(col => (
                    <td key={col.key} className="px-3 py-2.5 font-medium text-gray-800 dark:text-white">
                      {String(row[col.key] || '—')}
                    </td>
                  ))}
                  {measureCols.map(col => (
                    <td key={col.key} className="px-3 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-200">
                      {formatCell(row[col.key], col.format)}
                    </td>
                  ))}
                  {measureCols.length > 0 && (
                    <td className="px-3 py-2.5">
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
