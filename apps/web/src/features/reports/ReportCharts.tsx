// ============================================================
// FILE: apps/web/src/features/reports/ReportCharts.tsx
//
// Recharts wrapper components for the Reporting Engine.
// Supports: bar, stacked_bar, line, pie, funnel, scatter, gauge, table
// ============================================================

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
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