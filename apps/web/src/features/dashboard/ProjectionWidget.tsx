// ============================================================
// FILE: apps/web/src/features/dashboard/ProjectionWidget.tsx
// ============================================================
import { useState, useMemo } from 'react';
import { Rocket } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ReportResult } from '../../api/reports.api';

interface ProjectionWidgetProps {
  data: ReportResult | null;
  displayConfig: {
    sliderLabel?: string;
    sliderMin?: number;
    sliderMax?: number;
    sliderStep?: number;
    sliderDefault?: number;
    projectionMeasure?: string;
    baseSeriesLabel?: string;
    projectedSeriesLabel?: string;
  };
  loading?: boolean;
}

function fmt(v: number, format?: string): string {
  if (format === 'currency') {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export function ProjectionWidget({ data, displayConfig, loading }: ProjectionWidgetProps) {
  const {
    sliderMin = 0,
    sliderMax = 100,
    sliderStep = 5,
    sliderDefault = 20,
    baseSeriesLabel = 'Actual',
    projectedSeriesLabel = 'Projected',
    sliderLabel = 'Growth Target',
  } = displayConfig;

  const [growth, setGrowth] = useState(sliderDefault);

  const measureCol = useMemo(() => {
    if (!data) return null;
    return data.columns.find(c => ['currency', 'number', 'percent'].includes(c.format || '')) || null;
  }, [data]);

  const dimCol = useMemo(() => {
    if (!data) return null;
    return data.columns.find(c => ['text', 'date', 'datetime'].includes(c.format || '')) || null;
  }, [data]);

  const chartData = useMemo(() => {
    if (!data || !measureCol || !dimCol) return [];
    return data.data.map(row => {
      const base = Number(row[measureCol.key]) || 0;
      return {
        name: String(row[dimCol.key] || ''),
        [baseSeriesLabel]: base,
        [projectedSeriesLabel]: Math.round(base * (1 + growth / 100)),
      };
    });
  }, [data, measureCol, dimCol, growth, baseSeriesLabel, projectedSeriesLabel]);

  const totalProjected = useMemo(
    () => chartData.reduce((s, r) => s + (Number(r[projectedSeriesLabel]) || 0), 0),
    [chartData, projectedSeriesLabel],
  );

  const totalBase = useMemo(
    () => chartData.reduce((s, r) => s + (Number(r[baseSeriesLabel]) || 0), 0),
    [chartData, baseSeriesLabel],
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  if (!data || !chartData.length) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">No data</div>
  );

  return (
    <div className="flex flex-col h-full gap-3 p-1">
      {/* Slider control */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-3 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold">{sliderLabel}</span>
          </div>
          <span className="text-lg font-bold text-yellow-300">{growth}%</span>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={growth}
          onChange={e => setGrowth(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-yellow-400"
        />
        <div className="flex justify-between text-xs text-indigo-200 mt-1">
          <span>{sliderMin}%</span>
          <span>{sliderMax}%</span>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">Baseline</p>
          <p className="font-bold text-gray-800 dark:text-white text-sm">
            {fmt(totalBase, measureCol?.format)}
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Projected</p>
          <p className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
            {fmt(totalProjected, measureCol?.format)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} margin={{ top: 4, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmt(v, measureCol?.format)} width={45} />
            <Tooltip
              formatter={(val: any, name: string) => [fmt(Number(val), measureCol?.format), name]}
              cursor={{ fill: '#f8fafc' }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey={baseSeriesLabel} fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey={projectedSeriesLabel} fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
