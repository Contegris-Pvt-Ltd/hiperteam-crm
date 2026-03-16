// ============================================================
// FILE: apps/web/src/features/dashboard/chartRegistry.ts
// ============================================================
import {
  BarChart3, TrendingUp, PieChart, Activity, Target,
  Table2, Grid3X3, ScatterChart, Layers, Gauge,
  LayoutDashboard, Users, TrendingDown,
} from 'lucide-react';

export interface ChartTypeDefinition {
  type: string;
  label: string;
  icon: any;
  category: 'basic' | 'advanced' | 'special';
  description: string;
  minMeasures: number;
  maxMeasures: number;
  minDimensions: number;
  maxDimensions: number;
  dimensionHints?: string[];
  measureHints?: string[];
  supportsComparison?: boolean;
}

export const CHART_REGISTRY: ChartTypeDefinition[] = [
  // ── Basic ──────────────────────────────────────────────────
  {
    type: 'bar',
    label: 'Bar Chart',
    icon: BarChart3,
    category: 'basic',
    description: 'Compare values across categories',
    minMeasures: 1, maxMeasures: 5,
    minDimensions: 1, maxDimensions: 2,
    dimensionHints: ['X axis (categories)', 'Group by (optional)'],
  },
  {
    type: 'stacked_bar',
    label: 'Stacked Bar',
    icon: BarChart3,
    category: 'basic',
    description: 'Show composition across categories',
    minMeasures: 1, maxMeasures: 5,
    minDimensions: 1, maxDimensions: 2,
  },
  {
    type: 'line',
    label: 'Line Chart',
    icon: TrendingUp,
    category: 'basic',
    description: 'Show trends over time',
    minMeasures: 1, maxMeasures: 4,
    minDimensions: 1, maxDimensions: 1,
    dimensionHints: ['X axis (usually a date)'],
  },
  {
    type: 'area',
    label: 'Area Chart',
    icon: Activity,
    category: 'basic',
    description: 'Show trends with filled area',
    minMeasures: 1, maxMeasures: 4,
    minDimensions: 1, maxDimensions: 1,
    dimensionHints: ['X axis (usually a date)'],
  },
  {
    type: 'pie',
    label: 'Pie / Donut',
    icon: PieChart,
    category: 'basic',
    description: 'Show proportions of a whole',
    minMeasures: 1, maxMeasures: 1,
    minDimensions: 1, maxDimensions: 1,
    dimensionHints: ['Slice label'],
    measureHints: ['Slice value'],
  },
  {
    type: 'funnel',
    label: 'Funnel',
    icon: TrendingDown,
    category: 'basic',
    description: 'Show conversion through stages',
    minMeasures: 1, maxMeasures: 1,
    minDimensions: 1, maxDimensions: 1,
    dimensionHints: ['Stage name'],
    measureHints: ['Count or value'],
  },
  // ── Advanced ───────────────────────────────────────────────
  {
    type: 'scatter',
    label: 'Scatter Plot',
    icon: ScatterChart,
    category: 'advanced',
    description: 'Correlation between two numeric values',
    minMeasures: 2, maxMeasures: 3,
    minDimensions: 0, maxDimensions: 1,
    measureHints: ['X axis value', 'Y axis value', 'Bubble size (optional)'],
    dimensionHints: ['Point label (optional)'],
  },
  {
    type: 'bubble',
    label: 'Bubble Chart',
    icon: ScatterChart,
    category: 'advanced',
    description: 'Three-dimensional comparison',
    minMeasures: 3, maxMeasures: 3,
    minDimensions: 1, maxDimensions: 1,
    measureHints: ['X axis', 'Y axis', 'Bubble size'],
    dimensionHints: ['Bubble label'],
  },
  {
    type: 'heatmap',
    label: 'Heatmap',
    icon: Grid3X3,
    category: 'advanced',
    description: 'Intensity by two dimensions (e.g. activity by day × hour)',
    minMeasures: 1, maxMeasures: 1,
    minDimensions: 2, maxDimensions: 2,
    dimensionHints: ['X axis (e.g. day of week)', 'Y axis (e.g. rep or hour)'],
    measureHints: ['Value (intensity)'],
  },
  {
    type: 'treemap',
    label: 'Treemap',
    icon: Layers,
    category: 'advanced',
    description: 'Proportional breakdown as nested rectangles',
    minMeasures: 1, maxMeasures: 1,
    minDimensions: 1, maxDimensions: 2,
    dimensionHints: ['Category', 'Sub-category (optional)'],
    measureHints: ['Size value'],
  },
  // ── Special ────────────────────────────────────────────────
  {
    type: 'gauge',
    label: 'KPI / Gauge',
    icon: Gauge,
    category: 'special',
    description: 'Single metric with optional target',
    minMeasures: 1, maxMeasures: 3,
    minDimensions: 0, maxDimensions: 0,
    measureHints: ['Primary value', 'Target (optional)', 'Comparison period (optional)'],
  },
  {
    type: 'table',
    label: 'Data Table',
    icon: Table2,
    category: 'special',
    description: 'Tabular data with sorting and search',
    minMeasures: 0, maxMeasures: 10,
    minDimensions: 0, maxDimensions: 5,
  },
];

export const CHART_REGISTRY_MAP = Object.fromEntries(
  CHART_REGISTRY.map(c => [c.type, c]),
);

export const WIDGET_TYPE_LABELS: Record<string, string> = {
  chart: 'Chart',
  scorecard: 'Scorecard',
  leaderboard: 'Leaderboard',
  table: 'Table',
  projection: 'Projection',
};
