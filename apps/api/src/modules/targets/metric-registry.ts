// ============================================================
// FILE: apps/api/src/modules/targets/metric-registry.ts
// ============================================================
// Pre-defined metrics + parameterized + custom metric support.
//
// Parameterized metrics:
//   Some metrics need extra config (e.g. which stage to track).
//   These have `configFields` that describe what the admin must
//   supply. The config is stored in targets.filter_criteria and
//   passed to buildQuery at compute time.
// ============================================================

export interface MetricConfigField {
  key: string;           // e.g. 'stageId'
  label: string;         // e.g. 'Target Stage'
  type: 'stage_picker' | 'text' | 'number' | 'select';
  module?: string;       // for stage_picker: which module's stages to show
  required?: boolean;
}

export interface MetricDefinition {
  key: string;
  label: string;
  module: string;            // 'leads' | 'opportunities' | 'activities' | 'tasks'
  metricType: 'count' | 'sum' | 'percentage';
  unit: string;
  aggregationField?: string;
  description?: string;
  configFields?: MetricConfigField[];  // if set, metric requires extra configuration
  buildQuery: (schema: string, ownerColumn: string, config?: Record<string, any>) => string;
}

// ── Owner column per module ───────────────────────────────────
export function getOwnerColumn(module: string, metricKey?: string): { column: string; alias: string } {
  if (metricKey && (metricKey.startsWith('lead_') || metricKey.startsWith('opp_'))) {
    return { column: 'a.performed_by', alias: 'a' };
  }
  switch (module) {
    case 'leads':         return { column: 'l.owner_id', alias: 'l' };
    case 'opportunities': return { column: 'o.owner_id', alias: 'o' };
    case 'activities':    return { column: 'a.performed_by', alias: 'a' };
    case 'tasks':         return { column: 't.assigned_to', alias: 't' };
    default:              return { column: 'owner_id', alias: '' };
  }
}

// ============================================================
// METRIC REGISTRY
// ============================================================

export const METRIC_REGISTRY: MetricDefinition[] = [

  // ── LEADS: Core ─────────────────────────────────────────────
  {
    key: 'leads_created',
    label: 'Leads Created',
    module: 'leads',
    metricType: 'count',
    unit: 'leads',
    description: 'Total new leads created in the period',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.created_at >= $1 AND l.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'leads_converted',
    label: 'Leads Converted',
    module: 'leads',
    metricType: 'count',
    unit: 'leads',
    description: 'Leads that were converted to opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.converted_at >= $1 AND l.converted_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'leads_disqualified',
    label: 'Leads Disqualified',
    module: 'leads',
    metricType: 'count',
    unit: 'leads',
    description: 'Leads that were disqualified',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.disqualified_at >= $1 AND l.disqualified_at <= $2
       ${ownerCol}`,
  },

  // ── LEADS: Parameterized Stage Metrics ──────────────────────
  {
    key: 'leads_reached_stage',
    label: 'Leads Reached Stage',
    module: 'leads',
    metricType: 'count',
    unit: 'leads',
    description: 'Unique leads moved to a specific stage (e.g. Qualified, Proposal)',
    configFields: [
      { key: 'stageId', label: 'Target Stage', type: 'stage_picker', module: 'leads', required: true },
    ],
    buildQuery: (schema, ownerCol, config) => {
      const stageId = config?.stageId;
      if (!stageId) {
        // fallback: count all stage changes
        return `SELECT COUNT(DISTINCT a.entity_id) as value FROM "${schema}".activities a
                WHERE a.entity_type = 'leads' AND a.activity_type = 'stage_changed'
                AND a.created_at >= $1 AND a.created_at <= $2
                ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`;
      }
      return `SELECT COUNT(DISTINCT a.entity_id) as value FROM "${schema}".activities a
              WHERE a.entity_type = 'leads' AND a.activity_type = 'stage_changed'
              AND (a.metadata->>'stageId' = '${stageId}' OR a.metadata->>'toStageId' = '${stageId}')
              AND a.created_at >= $1 AND a.created_at <= $2
              ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`;
    },
  },

  // ── LEADS: Entity-scoped Activities ─────────────────────────
  {
    key: 'lead_calls',
    label: 'Calls on Leads',
    module: 'leads',
    metricType: 'count',
    unit: 'calls',
    description: 'Phone calls logged against leads',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'leads' AND a.activity_type = 'call'
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'lead_emails',
    label: 'Emails on Leads',
    module: 'leads',
    metricType: 'count',
    unit: 'emails',
    description: 'Emails logged against leads',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'leads' AND a.activity_type IN ('email', 'email_sent')
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'lead_demos',
    label: 'Demos on Leads',
    module: 'leads',
    metricType: 'count',
    unit: 'demos',
    description: 'Demos/presentations logged against leads',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'leads' AND a.activity_type IN ('demo', 'presentation')
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'lead_meetings',
    label: 'Meetings on Leads',
    module: 'leads',
    metricType: 'count',
    unit: 'meetings',
    description: 'Meetings logged against leads',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'leads' AND a.activity_type = 'meeting'
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('l.owner_id', 'a.performed_by') : ''}`,
  },

  // ── OPPORTUNITIES: Core ─────────────────────────────────────
  {
    key: 'opps_created',
    label: 'Opportunities Created',
    module: 'opportunities',
    metricType: 'count',
    unit: 'deals',
    description: 'New opportunities created',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.created_at >= $1 AND o.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'opps_won',
    label: 'Deals Won',
    module: 'opportunities',
    metricType: 'count',
    unit: 'deals',
    description: 'Opportunities marked as won',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at >= $1 AND o.won_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'opps_lost',
    label: 'Deals Lost',
    module: 'opportunities',
    metricType: 'count',
    unit: 'deals',
    description: 'Opportunities marked as lost',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.lost_at >= $1 AND o.lost_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'revenue_won',
    label: 'Revenue Won',
    module: 'opportunities',
    metricType: 'sum',
    unit: '$',
    aggregationField: 'amount',
    description: 'Total revenue from won opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COALESCE(SUM(o.amount), 0) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at >= $1 AND o.won_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'pipeline_value',
    label: 'Open Pipeline Value',
    module: 'opportunities',
    metricType: 'sum',
    unit: '$',
    aggregationField: 'amount',
    description: 'Total value of open opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COALESCE(SUM(o.amount), 0) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at IS NULL AND o.lost_at IS NULL
       AND o.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'avg_deal_size',
    label: 'Average Deal Size',
    module: 'opportunities',
    metricType: 'sum',
    unit: '$',
    description: 'Average amount of won deals',
    buildQuery: (schema, ownerCol) =>
      `SELECT COALESCE(AVG(o.amount), 0) as value FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at >= $1 AND o.won_at <= $2
       ${ownerCol}`,
  },

  // ── OPPORTUNITIES: Parameterized Stage Metrics ──────────────
  {
    key: 'opps_reached_stage',
    label: 'Opportunities Reached Stage',
    module: 'opportunities',
    metricType: 'count',
    unit: 'deals',
    description: 'Unique opportunities moved to a specific stage (e.g. Negotiation, Proposal)',
    configFields: [
      { key: 'stageId', label: 'Target Stage', type: 'stage_picker', module: 'opportunities', required: true },
    ],
    buildQuery: (schema, ownerCol, config) => {
      const stageId = config?.stageId;
      if (!stageId) {
        return `SELECT COUNT(DISTINCT a.entity_id) as value FROM "${schema}".activities a
                WHERE a.entity_type = 'opportunities' AND a.activity_type = 'stage_changed'
                AND a.created_at >= $1 AND a.created_at <= $2
                ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`;
      }
      return `SELECT COUNT(DISTINCT a.entity_id) as value FROM "${schema}".activities a
              WHERE a.entity_type = 'opportunities' AND a.activity_type = 'stage_changed'
              AND (a.metadata->>'stageId' = '${stageId}' OR a.metadata->>'toStageId' = '${stageId}')
              AND a.created_at >= $1 AND a.created_at <= $2
              ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`;
    },
  },

  // ── OPPORTUNITIES: Entity-scoped Activities ─────────────────
  {
    key: 'opp_calls',
    label: 'Calls on Opportunities',
    module: 'opportunities',
    metricType: 'count',
    unit: 'calls',
    description: 'Phone calls logged against opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'opportunities' AND a.activity_type = 'call'
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'opp_emails',
    label: 'Emails on Opportunities',
    module: 'opportunities',
    metricType: 'count',
    unit: 'emails',
    description: 'Emails logged against opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'opportunities' AND a.activity_type IN ('email', 'email_sent')
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'opp_demos',
    label: 'Demos on Opportunities',
    module: 'opportunities',
    metricType: 'count',
    unit: 'demos',
    description: 'Demos/presentations logged against opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'opportunities' AND a.activity_type IN ('demo', 'presentation')
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`,
  },
  {
    key: 'opp_meetings',
    label: 'Meetings on Opportunities',
    module: 'opportunities',
    metricType: 'count',
    unit: 'meetings',
    description: 'Meetings logged against opportunities',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.entity_type = 'opportunities' AND a.activity_type = 'meeting'
       AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol ? ownerCol.replace('o.owner_id', 'a.performed_by') : ''}`,
  },

  // ── GLOBAL ACTIVITIES ───────────────────────────────────────
  {
    key: 'activities_total',
    label: 'Total Activities (All)',
    module: 'activities',
    metricType: 'count',
    unit: 'activities',
    description: 'All activities across all modules',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'calls_made',
    label: 'All Calls (Global)',
    module: 'activities',
    metricType: 'count',
    unit: 'calls',
    description: 'Phone calls across all modules',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.activity_type = 'call' AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'emails_sent',
    label: 'All Emails (Global)',
    module: 'activities',
    metricType: 'count',
    unit: 'emails',
    description: 'Emails across all modules',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.activity_type IN ('email', 'email_sent') AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'meetings_held',
    label: 'All Meetings (Global)',
    module: 'activities',
    metricType: 'count',
    unit: 'meetings',
    description: 'Meetings across all modules',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.activity_type = 'meeting' AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'demos_given',
    label: 'All Demos (Global)',
    module: 'activities',
    metricType: 'count',
    unit: 'demos',
    description: 'Demos/presentations across all modules',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".activities a
       WHERE a.activity_type IN ('demo', 'presentation') AND a.created_at >= $1 AND a.created_at <= $2
       ${ownerCol}`,
  },

  // ── TASKS ───────────────────────────────────────────────────
  {
    key: 'tasks_completed',
    label: 'Tasks Completed',
    module: 'tasks',
    metricType: 'count',
    unit: 'tasks',
    description: 'Tasks marked as completed',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".tasks t
       WHERE t.deleted_at IS NULL AND t.completed_at >= $1 AND t.completed_at <= $2
       ${ownerCol}`,
  },
  {
    key: 'tasks_created',
    label: 'Tasks Created',
    module: 'tasks',
    metricType: 'count',
    unit: 'tasks',
    description: 'New tasks created',
    buildQuery: (schema, ownerCol) =>
      `SELECT COUNT(*) as value FROM "${schema}".tasks t
       WHERE t.deleted_at IS NULL AND t.created_at >= $1 AND t.created_at <= $2
       ${ownerCol}`,
  },
];

// ── Helpers ───────────────────────────────────────────────────

export function getMetricByKey(key: string): MetricDefinition | undefined {
  return METRIC_REGISTRY.find(m => m.key === key);
}

export function getMetricsByModule(module: string): MetricDefinition[] {
  return METRIC_REGISTRY.filter(m => m.module === module);
}

export function getAvailableModules(): string[] {
  return [...new Set(METRIC_REGISTRY.map(m => m.module))];
}