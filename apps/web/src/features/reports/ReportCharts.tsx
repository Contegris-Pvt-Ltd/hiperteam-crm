// ============================================================
// FILE: apps/web/src/features/reports/ReportCharts.tsx
//
// Recharts wrapper components for the Reporting Engine.
// Supports: bar, stacked_bar, line, pie, funnel, scatter, gauge, table
// ============================================================

import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ReportColumn } from '../../api/reports.api';

// ── Color Palette ──
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#A855F7', '#0EA5E9', '#D946EF',
];

// Compact legend props for dashboard widgets — sits inside chart area
const COMPACT_LEGEND_PROPS = {
  iconSize: 8,
  wrapperStyle: { fontSize: 10, lineHeight: '14px', paddingTop: 0 },
  verticalAlign: 'top' as const,
  align: 'right' as const,
  height: 20,
};

interface ChartProps {
  data: Record<string, any>[];
  columns: ReportColumn[];
  chartType: string;
  height?: number | string;
  compact?: boolean;
}

// ── Format values for display ──
function formatValue(value: any, format?: string): string {
  if (value === null || value === undefined) return '-';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
  if (format === 'percent') {
    return `${Number(value).toFixed(1)}%`;
  }
  if (format === 'number') {
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
  }
  // Date values
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return String(value);
}

// ── Custom Tooltip ──
function CustomTooltip({ active, payload, label, columns }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{formatValue(label)}</p>
      {payload.map((entry: any, i: number) => {
        const col = columns.find((c: ReportColumn) => c.key === entry.dataKey);
        return (
          <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{col?.label || entry.name}: {formatValue(entry.value, col?.format)}</span>
          </p>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN CHART COMPONENT
// ============================================================

export function ReportChart({ data, columns, chartType, height = 400, compact = false }: ChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No data to display
      </div>
    );
  }

  switch (chartType) {
    case 'bar':
    case 'stacked_bar':
      return <BarChartRenderer data={data} columns={columns} height={height} stacked={chartType === 'stacked_bar'} compact={compact} />;
    case 'line':
      return <LineChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'pie':
      return <PieChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'funnel':
      return <FunnelChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'scatter':
      return <ScatterChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'bubble':
      return <BubbleChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'area':
      return <AreaChartRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'heatmap':
      return <HeatmapRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'treemap':
      return <TreemapRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'gauge':
      return <GaugeRenderer data={data} columns={columns} height={height} compact={compact} />;
    case 'table':
    case 'none':
      return null; // Table is rendered separately
    default:
      return <BarChartRenderer data={data} columns={columns} height={height} stacked={false} compact={compact} />;
  }
}

// ============================================================
// BAR CHART
// ============================================================

function BarChartRenderer({ data, columns, height, stacked, compact }: Omit<ChartProps, 'chartType'> & { stacked: boolean }) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  // Format x-axis labels
  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  const margin = compact
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : { top: 10, right: 30, left: 20, bottom: 40 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: compact ? 10 : 12 }}
          angle={compact ? 0 : -30}
          textAnchor={compact ? 'middle' : 'end'}
          height={compact ? 30 : 60}
          interval={compact ? 'preserveStartEnd' : undefined}
        />
        <YAxis tick={{ fontSize: compact ? 10 : 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} width={compact ? 40 : undefined} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        {measureCols.length > 1 && (
          <Legend
            {...(compact ? COMPACT_LEGEND_PROPS : {})}
          />
        )}
        {measureCols.map((col, i) => (
          <Bar
            key={col.key}
            dataKey={col.key}
            name={col.label}
            fill={COLORS[i % COLORS.length]}
            stackId={stacked ? 'stack' : undefined}
            radius={stacked ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// LINE CHART
// ============================================================

function LineChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  const margin = compact
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : { top: 10, right: 30, left: 20, bottom: 40 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: compact ? 10 : 12 }}
          angle={compact ? 0 : -30}
          textAnchor={compact ? 'middle' : 'end'}
          height={compact ? 30 : 60}
          interval={compact ? 'preserveStartEnd' : undefined}
        />
        <YAxis tick={{ fontSize: compact ? 10 : 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} width={compact ? 40 : undefined} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        {measureCols.length > 1 && (
          <Legend
            {...(compact ? COMPACT_LEGEND_PROPS : {})}
          />
        )}
        {measureCols.map((col, i) => (
          <Line
            key={col.key}
            type="monotone"
            dataKey={col.key}
            name={col.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={compact ? 1.5 : 2}
            dot={compact ? false : { r: 4 }}
            activeDot={{ r: compact ? 4 : 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// PIE CHART
// ============================================================

function PieChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const dimensionCol = columns.find(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number', 'percent'].includes(c.format || ''));

  if (!dimensionCol || !measureCol) return null;

  const pieData = data.map((row, i) => ({
    name: String(row[dimensionCol.key] || 'Unknown'),
    value: Number(row[measureCol.key]) || 0,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy={compact ? '45%' : '50%'}
          outerRadius={compact ? '70%' : '55%'}
          innerRadius={compact ? '35%' : '28%'}
          dataKey="value"
          nameKey="name"
          label={compact ? false : (props: any) => `${props.name ?? 'Unknown'}: ${((props.percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={!compact}
        >
          {pieData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: any) => formatValue(value, measureCol.format)}
        />
        <Legend
          {...(compact ? { ...COMPACT_LEGEND_PROPS, verticalAlign: 'bottom' as const, align: 'center' as const, height: 24 } : {})}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// FUNNEL CHART (SVG trapezoid pyramid with conversion labels)
// ============================================================

function FunnelChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const dimensionCol = columns.find(c => ['text', 'date'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number'].includes(c.format || ''));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!dimensionCol || !measureCol || data.length === 0) return null;

  const maxVal = Math.max(...data.map(r => Number(r[measureCol.key]) || 0), 1);
  const n = data.length;

  // Proportional widths — minimum 15% so the bottom stage is always visible
  const widths = data.map(r => {
    const val = Number(r[measureCol.key]) || 0;
    return Math.max((val / maxVal) * 100, 15);
  });

  // Conversion rates
  const convRates = data.map((r, i) => {
    if (i === 0) return 100;
    const prev = Number(data[i - 1][measureCol.key]) || 1;
    const cur = Number(r[measureCol.key]) || 0;
    return (cur / prev) * 100;
  });

  // Overall conversion
  const overallConv = n > 1
    ? ((Number(data[n - 1][measureCol.key]) || 0) / maxVal * 100)
    : 100;

  // Layout: each stage is a trapezoid rendered as SVG
  const GAP = compact ? 2 : 3;
  const LABEL_AREA = compact ? 0 : 28; // space below for overall conversion

  return (
    <div className="w-full flex flex-col" style={{ height: height || '100%' }}>
      <div className="flex-1 relative min-h-0">
        {/* SVG funnel */}
        <svg
          viewBox="0 0 400 300"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          style={{ maxHeight: `calc(100% - ${LABEL_AREA}px)` }}
        >
          {data.map((row, i) => {
            const stageH = (300 - GAP * (n - 1)) / n;
            const y = i * (stageH + GAP);

            // Current stage width (centered)
            const topW = (widths[i] / 100) * 380;
            // Next stage width (or taper to ~60% of current for last stage)
            const botW = i < n - 1 ? (widths[i + 1] / 100) * 380 : topW * 0.7;

            const cx = 200; // center x
            const topLeft = cx - topW / 2;
            const topRight = cx + topW / 2;
            const botLeft = cx - botW / 2;
            const botRight = cx + botW / 2;

            // Trapezoid path
            const path = `M ${topLeft} ${y} L ${topRight} ${y} L ${botRight} ${y + stageH} L ${botLeft} ${y + stageH} Z`;

            const val = Number(row[measureCol.key]) || 0;
            const label = String(row[dimensionCol.key]);
            const isHovered = hoveredIdx === i;
            const color = COLORS[i % COLORS.length];

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Trapezoid */}
                <path
                  d={path}
                  fill={color}
                  opacity={isHovered ? 1 : 0.85}
                  className="transition-opacity duration-150"
                />

                {/* Stage label + value */}
                <text
                  x={cx}
                  y={y + stageH / 2 - (compact ? 2 : 4)}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill="white"
                  fontSize={compact ? 11 : 13}
                  fontWeight="600"
                >
                  {label}
                </text>
                <text
                  x={cx}
                  y={y + stageH / 2 + (compact ? 10 : 14)}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill="white"
                  fontSize={compact ? 10 : 11}
                  opacity={0.9}
                >
                  {formatValue(val, measureCol.format)}
                </text>

                {/* Conversion arrow + rate between stages */}
                {i > 0 && !compact && (
                  <text
                    x={cx + topW / 2 + 12}
                    y={y + 2}
                    textAnchor="start"
                    dominantBaseline="auto"
                    fill={convRates[i] >= 50 ? '#22c55e' : convRates[i] >= 25 ? '#f59e0b' : '#ef4444'}
                    fontSize={10}
                    fontWeight="600"
                  >
                    {convRates[i].toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Overall conversion footer */}
      {!compact && n > 1 && (
        <div className="flex items-center justify-center gap-2 py-1 text-xs text-gray-500 dark:text-gray-400">
          <span>Overall conversion:</span>
          <span className={`font-semibold ${overallConv >= 50 ? 'text-green-600' : overallConv >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
            {overallConv.toFixed(1)}%
          </span>
          <span className="text-gray-400">
            ({formatValue(Number(data[0][measureCol.key]), measureCol.format)} → {formatValue(Number(data[n - 1][measureCol.key]), measureCol.format)})
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredIdx !== null && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10">
          <div className="font-semibold text-gray-900 dark:text-white">
            {String(data[hoveredIdx][dimensionCol.key])}
          </div>
          <div className="text-gray-600 dark:text-gray-300">
            Value: {formatValue(Number(data[hoveredIdx][measureCol.key]), measureCol.format)}
          </div>
          {hoveredIdx > 0 && (
            <div className="text-gray-500">
              Drop-off: {(100 - convRates[hoveredIdx]).toFixed(1)}% from previous
            </div>
          )}
          {hoveredIdx > 0 && (
            <div className="text-gray-500">
              Of total: {((Number(data[hoveredIdx][measureCol.key]) || 0) / maxVal * 100).toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SCATTER CHART
// ============================================================

function ScatterChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xCol = measureCols[0];
  const yCol = measureCols[1];
  const labelCol = columns.find(c => c.format === 'text');

  if (!xCol || !yCol) return null;

  const margin = compact
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : { top: 10, right: 30, left: 20, bottom: 40 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xCol.key}
          name={xCol.label}
          tick={{ fontSize: compact ? 10 : 12 }}
          label={compact ? undefined : { value: xCol.label, position: 'bottom', offset: 20 }}
        />
        <YAxis
          dataKey={yCol.key}
          name={yCol.label}
          tick={{ fontSize: compact ? 10 : 12 }}
          label={compact ? undefined : { value: yCol.label, angle: -90, position: 'insideLeft' }}
          width={compact ? 40 : undefined}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload;
            return (
              <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3 text-sm">
                {labelCol && <p className="font-medium">{p[labelCol.key]}</p>}
                <p>{xCol.label}: {formatValue(p[xCol.key], xCol.format)}</p>
                <p>{yCol.label}: {formatValue(p[yCol.key], yCol.format)}</p>
              </div>
            );
          }}
        />
        <Scatter data={data} fill={COLORS[0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// GAUGE (rendered as a summary metric)
// ============================================================

function GaugeRenderer({ data, columns, height: _height, compact: _compact }: Omit<ChartProps, 'chartType'>) {
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));

  if (!data.length || !measureCols.length) return null;

  const row = data[0];

  return (
    <div className="flex flex-wrap gap-6 justify-center items-center py-8">
      {measureCols.map((col, i) => (
        <div key={col.key} className="text-center">
          <div className="text-4xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>
            {formatValue(row[col.key], col.format)}
          </div>
          <div className="text-sm text-gray-500 mt-1">{col.label}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// AREA CHART
// ============================================================

function AreaChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  const margin = compact
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : { top: 10, right: 30, left: 20, bottom: 40 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={margin}>
        <defs>
          {measureCols.map((col, i) => (
            <linearGradient key={col.key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: compact ? 10 : 12 }}
          angle={compact ? 0 : -30}
          textAnchor={compact ? 'middle' : 'end'}
          height={compact ? 30 : 60}
          interval={compact ? 'preserveStartEnd' : undefined}
        />
        <YAxis tick={{ fontSize: compact ? 10 : 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} width={compact ? 40 : undefined} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        {measureCols.length > 1 && (
          <Legend
            {...(compact ? COMPACT_LEGEND_PROPS : {})}
          />
        )}
        {measureCols.map((col, i) => (
          <Area
            key={col.key}
            type="monotone"
            dataKey={col.key}
            name={col.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={compact ? 1.5 : 2}
            fill={`url(#gradient-${i})`}
            dot={compact ? false : { r: 3 }}
            activeDot={{ r: compact ? 4 : 5 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// BUBBLE CHART
// ============================================================

function BubbleChartRenderer({ data, columns, height, compact }: Omit<ChartProps, 'chartType'>) {
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const labelCol = columns.find(c => c.format === 'text');
  const xCol = measureCols[0];
  const yCol = measureCols[1];
  const zCol = measureCols[2];

  if (!xCol || !yCol) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Bubble chart requires at least 2 numeric measures
    </div>
  );

  const margin = compact
    ? { top: 5, right: 10, left: 0, bottom: 5 }
    : { top: 10, right: 30, left: 20, bottom: 40 };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xCol.key}
          name={xCol.label}
          tick={{ fontSize: compact ? 10 : 12 }}
          label={compact ? undefined : { value: xCol.label, position: 'bottom', offset: 20 }}
        />
        <YAxis
          dataKey={yCol.key}
          name={yCol.label}
          tick={{ fontSize: compact ? 10 : 12 }}
          label={compact ? undefined : { value: yCol.label, angle: -90, position: 'insideLeft' }}
          width={compact ? 40 : undefined}
        />
        {zCol && <ZAxis dataKey={zCol.key} range={[40, 400]} name={zCol.label} />}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload;
            return (
              <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-3 text-sm">
                {labelCol && <p className="font-medium mb-1">{p[labelCol.key]}</p>}
                <p>{xCol.label}: {formatValue(p[xCol.key], xCol.format)}</p>
                <p>{yCol.label}: {formatValue(p[yCol.key], yCol.format)}</p>
                {zCol && <p>{zCol.label}: {formatValue(p[zCol.key], zCol.format)}</p>}
              </div>
            );
          }}
        />
        <Scatter data={data} fill={COLORS[0]} fillOpacity={0.7}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// HEATMAP
// ============================================================

function HeatmapRenderer({ data, columns, height, compact: _compact }: Omit<ChartProps, 'chartType'>) {
  const dimCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number', 'percent'].includes(c.format || ''));

  const xCol = dimCols[0];
  const yCol = dimCols[1];

  if (!xCol || !yCol || !measureCol) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Heatmap requires 2 dimensions and 1 measure
    </div>
  );

  // Build grid
  const xVals = [...new Set(data.map(r => String(r[xCol.key])))];
  const yVals = [...new Set(data.map(r => String(r[yCol.key])))];
  const maxVal = Math.max(...data.map(r => Number(r[measureCol.key]) || 0));
  const minVal = Math.min(...data.map(r => Number(r[measureCol.key]) || 0));

  const getColor = (value: number) => {
    if (!maxVal) return '#f1f5f9';
    const ratio = (value - minVal) / (maxVal - minVal || 1);
    // Blue scale
    const r = Math.round(59 + (147 - 59) * (1 - ratio));
    const g = Math.round(130 + (197 - 130) * (1 - ratio));
    const b = Math.round(246 + (253 - 246) * (1 - ratio));
    const alpha = 0.2 + ratio * 0.8;
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const cellHeight = Math.max(28, Math.floor((height - 60) / Math.max(yVals.length, 1)));
  const cellWidth = Math.max(40, Math.floor(500 / Math.max(xVals.length, 1)));

  return (
    <div className="overflow-auto" style={{ height }}>
      <div className="min-w-max">
        {/* X axis header */}
        <div className="flex" style={{ marginLeft: 80 }}>
          {xVals.map(x => (
            <div
              key={x}
              className="text-xs text-gray-500 text-center font-medium truncate"
              style={{ width: cellWidth, minWidth: cellWidth }}
            >
              {x}
            </div>
          ))}
        </div>
        {/* Rows */}
        {yVals.map(y => (
          <div key={y} className="flex items-center">
            <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate pr-2 text-right" style={{ width: 80, minWidth: 80 }}>
              {y}
            </div>
            {xVals.map(x => {
              const cell = data.find(r => String(r[xCol.key]) === x && String(r[yCol.key]) === y);
              const val = cell ? Number(cell[measureCol.key]) || 0 : 0;
              return (
                <div
                  key={x}
                  className="border border-white dark:border-slate-700 flex items-center justify-center text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    width: cellWidth, minWidth: cellWidth,
                    height: cellHeight,
                    backgroundColor: getColor(val),
                    color: val > maxVal * 0.6 ? '#1e3a5f' : '#64748b',
                  }}
                  title={`${x} / ${y}: ${formatValue(val, measureCol.format)}`}
                >
                  {val > 0 ? formatValue(val, measureCol.format) : ''}
                </div>
              );
            })}
          </div>
        ))}
        {/* Color legend */}
        <div className="flex items-center gap-2 mt-3 ml-20">
          <span className="text-xs text-gray-400">Low</span>
          <div className="flex">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => (
              <div key={r} style={{ width: 24, height: 12, backgroundColor: getColor(minVal + r * (maxVal - minVal)) }} />
            ))}
          </div>
          <span className="text-xs text-gray-400">High</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TREEMAP
// ============================================================

function TreemapRenderer({ data, columns, height, compact: _compact }: Omit<ChartProps, 'chartType'>) {
  const dimCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const labelCol = dimCols[0];

  if (!labelCol || !measureCol) return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Treemap requires 1 dimension and 1 measure
    </div>
  );

  const total = data.reduce((s, r) => s + (Number(r[measureCol.key]) || 0), 0);
  const sorted = [...data]
    .filter(r => Number(r[measureCol.key]) > 0)
    .sort((a, b) => Number(b[measureCol.key]) - Number(a[measureCol.key]));

  // Simple squarified-like layout using flex wrapping
  return (
    <div className="flex flex-wrap gap-1 p-2" style={{ height, alignContent: 'flex-start' }}>
      {sorted.map((row, i) => {
        const val = Number(row[measureCol.key]) || 0;
        const pct = total > 0 ? (val / total) * 100 : 0;
        const minPct = 3;
        const displayPct = Math.max(minPct, pct);

        return (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-lg text-white font-semibold overflow-hidden transition-all hover:opacity-90 cursor-pointer"
            style={{
              width: `calc(${Math.min(displayPct, 100)}% - 4px)`,
              minWidth: 60,
              height: Math.max(50, Math.min(120, (pct / 100) * height * 2)),
              backgroundColor: COLORS[i % COLORS.length],
              padding: 4,
            }}
            title={`${row[labelCol.key]}: ${formatValue(val, measureCol.format)} (${pct.toFixed(1)}%)`}
          >
            <p className="text-xs font-bold truncate w-full text-center">
              {String(row[labelCol.key])}
            </p>
            <p className="text-xs opacity-90">
              {formatValue(val, measureCol.format)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DATA TABLE (for table chart type or below any chart)
// ============================================================

export function ReportDataTable({ data, columns }: { data: Record<string, any>[]; columns: ReportColumn[] }) {
  if (!data.length) {
    return (
      <div className="text-center py-8 text-gray-400">No data to display</div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-4 py-2.5 text-sm whitespace-nowrap ${
                    ['currency', 'number', 'percent'].includes(col.format || '')
                      ? 'text-right font-mono'
                      : 'text-left'
                  } text-gray-900 dark:text-gray-100`}
                >
                  {formatValue(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}