// ============================================================
// FILE: apps/web/src/features/dashboard/ScorecardWidget.tsx
// Scorecard widget — auto-sizing KPI with trend, target,
// thresholds, configurable font size/color, fully responsive.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReportResult } from '../../api/reports.api';

interface Threshold {
  value: number;
  color: string;
  label?: string;
}

interface ScorecardWidgetProps {
  data: ReportResult | null;
  displayConfig: {
    showTrend?: boolean;
    targetValue?: number;
    targetLabel?: string;
    colorScheme?: string;
    fontSize?: 'auto' | 'sm' | 'md' | 'lg' | 'xl';
    fontColor?: string;
    thresholds?: Threshold[];
  };
  loading?: boolean;
}

// Count-up animation hook
function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    if (!target) { setCount(0); return; }
    startRef.current = undefined;

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
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

// Resolve threshold color for a value
function getThresholdColor(value: number, thresholds?: Threshold[]): string | undefined {
  if (!thresholds || thresholds.length === 0) return undefined;
  // Sort ascending by value — pick the last threshold the value meets or exceeds
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  let matched: Threshold | undefined;
  for (const t of sorted) {
    if (value >= t.value) matched = t;
  }
  return matched?.color;
}

// Font size classes mapped by setting
const FONT_SIZE_MAP = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function ScorecardWidget({ data, displayConfig, loading }: ScorecardWidgetProps) {
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!data || !data.data.length || !data.columns.length) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-400">No data</div>
  );

  const measureCols = data.columns.filter(c =>
    ['currency', 'number', 'percent'].includes(c.format || ''),
  );

  if (!measureCols.length) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-400">No numeric measures</div>
  );

  const row = data.data[0];
  const prevRow = data.data[1] || null;
  const isMulti = measureCols.length > 1;

  return (
    <div className={`flex h-full w-full overflow-hidden ${
      isMulti ? 'flex-row flex-wrap items-center justify-around gap-1 p-1' : 'items-center justify-center p-1'
    }`}>
      {measureCols.map((col) => {
        const rawVal = Number(row[col.key]) || 0;
        const prevVal = prevRow ? Number(prevRow[col.key]) || 0 : null;
        const pctChange = prevVal && prevVal !== 0
          ? ((rawVal - prevVal) / prevVal) * 100
          : null;
        const targetValue = displayConfig.targetValue;
        const targetPct = targetValue ? (rawVal / targetValue) * 100 : null;

        return (
          <ScorecardItem
            key={col.key}
            label={col.label}
            value={rawVal}
            format={col.format}
            pctChange={pctChange}
            showTrend={displayConfig.showTrend}
            targetPct={targetPct}
            targetValue={targetValue}
            targetLabel={displayConfig.targetLabel}
            fontSize={displayConfig.fontSize}
            fontColor={displayConfig.fontColor}
            thresholds={displayConfig.thresholds}
            isMulti={isMulti}
          />
        );
      })}
    </div>
  );
}

// Individual scorecard metric — self-sizing
function ScorecardItem({
  label,
  value,
  format,
  pctChange,
  showTrend,
  targetPct,
  targetValue,
  targetLabel,
  fontSize = 'auto',
  fontColor,
  thresholds,
  isMulti,
}: {
  label: string;
  value: number;
  format?: string;
  pctChange: number | null;
  showTrend?: boolean;
  targetPct: number | null;
  targetValue?: number;
  targetLabel?: string;
  fontSize?: 'auto' | 'sm' | 'md' | 'lg' | 'xl';
  fontColor?: string;
  thresholds?: Threshold[];
  isMulti: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');

  // Auto-size: measure container and pick appropriate text size
  const measureSize = useCallback(() => {
    if (!containerRef.current || fontSize !== 'auto') return;
    const { offsetWidth: w, offsetHeight: h } = containerRef.current;
    const area = w * h;
    if (area < 8000 || w < 120 || h < 60) setAutoSize('sm');
    else if (area < 20000 || w < 200 || h < 100) setAutoSize('md');
    else if (area < 50000 || w < 300) setAutoSize('lg');
    else setAutoSize('xl');
  }, [fontSize]);

  useEffect(() => {
    measureSize();
    if (!containerRef.current) return;
    const ro = new ResizeObserver(measureSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measureSize]);

  const resolvedSize = fontSize === 'auto' ? autoSize : fontSize;
  const isCompact = resolvedSize === 'sm';

  // Determine value color: threshold > fontColor > default
  const thresholdColor = getThresholdColor(value, thresholds);
  const valueColor = thresholdColor || fontColor || undefined;

  const animated = useCountUp(value, 800);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center text-center min-w-0 ${
        isMulti ? 'flex-1 min-w-[80px]' : 'w-full h-full'
      }`}
    >
      {/* Label */}
      <p className={`font-medium text-gray-500 dark:text-slate-400 truncate w-full leading-tight ${
        isCompact ? 'text-[10px]' : 'text-xs'
      }`}>
        {label}
      </p>

      {/* Main value */}
      <p
        className={`font-bold leading-none mt-0.5 ${FONT_SIZE_MAP[resolvedSize]} ${
          !valueColor ? 'text-gray-900 dark:text-white' : ''
        }`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {formatValue(animated, format)}
      </p>

      {/* Trend */}
      {pctChange !== null && showTrend && (
        <div className={`flex items-center gap-0.5 font-medium mt-0.5 ${
          isCompact ? 'text-[10px]' : 'text-xs'
        } ${
          pctChange > 0 ? 'text-green-500' : pctChange < 0 ? 'text-red-500' : 'text-gray-400'
        }`}>
          {pctChange > 0 ? <TrendingUp className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> :
           pctChange < 0 ? <TrendingDown className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} /> :
           <Minus className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
          {Math.abs(pctChange).toFixed(1)}%
        </div>
      )}

      {/* Target progress bar */}
      {targetPct !== null && !isCompact && (
        <div className="w-full mt-1.5 px-1 max-w-[200px]">
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>{targetLabel || 'Target'}</span>
            <span>{targetPct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-1 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                targetPct >= 100 ? 'bg-green-500' :
                targetPct >= 75 ? 'bg-blue-500' :
                targetPct >= 50 ? 'bg-amber-500' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(targetPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Compact target — just show percentage */}
      {targetPct !== null && isCompact && (
        <p className={`text-[10px] mt-0.5 ${
          targetPct >= 100 ? 'text-green-500' :
          targetPct >= 75 ? 'text-blue-500' :
          targetPct >= 50 ? 'text-amber-500' : 'text-red-400'
        }`}>
          {targetPct.toFixed(0)}% of target
        </p>
      )}

      {/* Threshold label (if matched) */}
      {thresholds && thresholds.length > 0 && (() => {
        const sorted = [...thresholds].sort((a, b) => a.value - b.value);
        let matched: Threshold | undefined;
        for (const t of sorted) {
          if (value >= t.value) matched = t;
        }
        return matched?.label ? (
          <p className={`font-medium mt-0.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`} style={{ color: matched.color }}>
            {matched.label}
          </p>
        ) : null;
      })()}
    </div>
  );
}
