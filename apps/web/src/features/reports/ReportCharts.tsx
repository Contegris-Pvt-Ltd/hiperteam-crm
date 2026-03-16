// ============================================================
// FILE: apps/web/src/features/reports/ReportCharts.tsx
//
// Recharts wrapper components for the Reporting Engine.
// Supports: bar, stacked_bar, line, pie, funnel, scatter, gauge, table
// ============================================================

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

interface ChartProps {
  data: Record<string, any>[];
  columns: ReportColumn[];
  chartType: string;
  height?: number;
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

export function ReportChart({ data, columns, chartType, height = 400 }: ChartProps) {
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
      return <BarChartRenderer data={data} columns={columns} height={height} stacked={chartType === 'stacked_bar'} />;
    case 'line':
      return <LineChartRenderer data={data} columns={columns} height={height} />;
    case 'pie':
      return <PieChartRenderer data={data} columns={columns} height={height} />;
    case 'funnel':
      return <FunnelChartRenderer data={data} columns={columns} height={height} />;
    case 'scatter':
      return <ScatterChartRenderer data={data} columns={columns} height={height} />;
    case 'bubble':
      return <BubbleChartRenderer data={data} columns={columns} height={height} />;
    case 'area':
      return <AreaChartRenderer data={data} columns={columns} height={height} />;
    case 'heatmap':
      return <HeatmapRenderer data={data} columns={columns} height={height} />;
    case 'treemap':
      return <TreemapRenderer data={data} columns={columns} height={height} />;
    case 'gauge':
      return <GaugeRenderer data={data} columns={columns} height={height} />;
    case 'table':
    case 'none':
      return null; // Table is rendered separately
    default:
      return <BarChartRenderer data={data} columns={columns} height={height} stacked={false} />;
  }
}

// ============================================================
// BAR CHART
// ============================================================

function BarChartRenderer({ data, columns, height, stacked }: Omit<ChartProps, 'chartType'> & { stacked: boolean }) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  // Format x-axis labels
  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        <Legend />
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

function LineChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        <Legend />
        {measureCols.map((col, i) => (
          <Line
            key={col.key}
            type="monotone"
            dataKey={col.key}
            name={col.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// PIE CHART
// ============================================================

function PieChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
  const dimensionCol = columns.find(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number', 'percent'].includes(c.format || ''));

  if (!dimensionCol || !measureCol) return null;

  const pieData = data.map((row, i) => ({
    name: String(row[dimensionCol.key] || 'Unknown'),
    value: Number(row[measureCol.key]) || 0,
    fill: COLORS[i % COLORS.length],
  }));

  const h = height ?? 400;

  return (
    <ResponsiveContainer width="100%" height={h}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          outerRadius={h / 3}
          innerRadius={h / 6}
          dataKey="value"
          nameKey="name"
          label={(props: any) => `${props.name ?? 'Unknown'}: ${((props.percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={true}
        >
          {pieData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: any) => formatValue(value, measureCol.format)}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// FUNNEL CHART (rendered as horizontal bar)
// ============================================================

function FunnelChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
  const dimensionCol = columns.find(c => ['text', 'date'].includes(c.format || ''));
  const measureCol = columns.find(c => ['currency', 'number'].includes(c.format || ''));

  if (!dimensionCol || !measureCol) return null;

  const maxVal = Math.max(...data.map(r => Number(r[measureCol.key]) || 0));

  return (
    <div className="flex flex-col items-center gap-1 py-4" style={{ height }}>
      {data.map((row, i) => {
        const val = Number(row[measureCol.key]) || 0;
        const widthPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const convRate = i > 0 ? ((val / (Number(data[i - 1][measureCol.key]) || 1)) * 100).toFixed(1) : '100';

        return (
          <div key={i} className="flex items-center w-full gap-3">
            <div className="w-32 text-right text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {String(row[dimensionCol.key])}
            </div>
            <div className="flex-1 relative">
              <div
                className="h-8 rounded-md flex items-center justify-center text-white text-xs font-medium transition-all"
                style={{
                  width: `${Math.max(widthPct, 5)}%`,
                  backgroundColor: COLORS[i % COLORS.length],
                  margin: '0 auto',
                }}
              >
                {formatValue(val, measureCol.format)}
              </div>
            </div>
            <div className="w-16 text-left text-xs text-gray-500">
              {i > 0 ? `${convRate}%` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// SCATTER CHART
// ============================================================

function ScatterChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xCol = measureCols[0];
  const yCol = measureCols[1];
  const labelCol = columns.find(c => c.format === 'text');

  if (!xCol || !yCol) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xCol.key}
          name={xCol.label}
          tick={{ fontSize: 12 }}
          label={{ value: xCol.label, position: 'bottom', offset: 20 }}
        />
        <YAxis
          dataKey={yCol.key}
          name={yCol.label}
          tick={{ fontSize: 12 }}
          label={{ value: yCol.label, angle: -90, position: 'insideLeft' }}
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

function GaugeRenderer({ data, columns, height: _height }: Omit<ChartProps, 'chartType'>) {
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

function AreaChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
  const dimensionCols = columns.filter(c => ['text', 'date', 'datetime'].includes(c.format || ''));
  const measureCols = columns.filter(c => ['currency', 'number', 'percent'].includes(c.format || ''));
  const xKey = dimensionCols[0]?.key || columns[0]?.key;

  const formatted = data.map(row => ({
    ...row,
    [xKey]: formatValue(row[xKey], dimensionCols[0]?.format),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <defs>
          {measureCols.map((col, i) => (
            <linearGradient key={col.key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatValue(v, measureCols[0]?.format)} />
        <Tooltip content={<CustomTooltip columns={columns} />} />
        <Legend />
        {measureCols.map((col, i) => (
          <Area
            key={col.key}
            type="monotone"
            dataKey={col.key}
            name={col.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            fill={`url(#gradient-${i})`}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// BUBBLE CHART
// ============================================================

function BubbleChartRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey={xCol.key}
          name={xCol.label}
          tick={{ fontSize: 12 }}
          label={{ value: xCol.label, position: 'bottom', offset: 20 }}
        />
        <YAxis
          dataKey={yCol.key}
          name={yCol.label}
          tick={{ fontSize: 12 }}
          label={{ value: yCol.label, angle: -90, position: 'insideLeft' }}
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

function HeatmapRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
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

function TreemapRenderer({ data, columns, height }: Omit<ChartProps, 'chartType'>) {
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