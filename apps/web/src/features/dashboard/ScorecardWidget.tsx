// ============================================================
// FILE: apps/web/src/features/dashboard/ScorecardWidget.tsx
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReportResult } from '../../api/reports.api';

interface ScorecardWidgetProps {
  data: ReportResult | null;
  displayConfig: {
    showTrend?: boolean;
    targetValue?: number;
    targetLabel?: string;
    colorScheme?: string;
  };
  loading?: boolean;
}

// Count-up animation hook
function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    if (!target) { setCount(0); return; }
    startRef.current = undefined;

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return count;
}

function formatValue(value: number, format?: string): string {
  if (format === 'currency') {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function ScorecardWidget({ data, displayConfig, loading }: ScorecardWidgetProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!data || !data.data.length || !data.columns.length) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">No data</div>
  );

  const measureCols = data.columns.filter(c =>
    ['currency', 'number', 'percent'].includes(c.format || ''),
  );

  if (!measureCols.length) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">No numeric measures</div>
  );

  const row = data.data[0];

  // For trend comparison (if data has 2 rows: current and previous period)
  const prevRow = data.data[1] || null;

  return (
    <div className="flex flex-wrap gap-4 items-center justify-around h-full p-2">
      {measureCols.map((col) => {
        const rawVal = Number(row[col.key]) || 0;
        const prevVal = prevRow ? Number(prevRow[col.key]) || 0 : null;
        const pctChange = prevVal && prevVal !== 0
          ? ((rawVal - prevVal) / prevVal) * 100
          : null;

        const targetValue = displayConfig.targetValue;
        const targetPct = targetValue ? (rawVal / targetValue) * 100 : null;

        return (
          <div key={col.key} className="flex flex-col items-center text-center min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 truncate w-full">
              {col.label}
            </p>
            <AnimatedValue value={rawVal} format={col.format} />

            {/* Trend vs previous period */}
            {pctChange !== null && displayConfig.showTrend && (
              <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
                pctChange > 0 ? 'text-green-500' : pctChange < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                {pctChange > 0 ? <TrendingUp className="w-3 h-3" /> :
                 pctChange < 0 ? <TrendingDown className="w-3 h-3" /> :
                 <Minus className="w-3 h-3" />}
                {Math.abs(pctChange).toFixed(1)}%
              </div>
            )}

            {/* Target progress */}
            {targetPct !== null && (
              <div className="w-full mt-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Target</span>
                  <span>{targetPct.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      targetPct >= 100 ? 'bg-green-500' :
                      targetPct >= 75 ? 'bg-blue-500' :
                      targetPct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(targetPct, 100)}%` }}
                  />
                </div>
                {displayConfig.targetLabel && (
                  <p className="text-xs text-gray-400 mt-1">
                    {displayConfig.targetLabel}: {formatValue(targetValue!, col.format)}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnimatedValue({ value, format }: { value: number; format?: string }) {
  const animated = useCountUp(value, 800);
  return (
    <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
      {formatValue(animated, format)}
    </p>
  );
}
