// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard.service.ts
//
// Full analytics engine for CRM dashboard.
// All methods accept a `scope` parameter:
//   - 'own' = current user only
//   - 'team' = user's team
//   - 'all'  = entire tenant
//
// Data is computed from existing tables (leads, opportunities,
// tasks, activity_logs, audit_logs, stage history tables).
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

type Scope = 'own' | 'team' | 'all';

interface DateRange {
  from: string; // ISO date
  to: string;   // ISO date
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private dataSource: DataSource) {}

  // ════════════════════════════════════════════════════════════
  // HELPER: Build ownership WHERE clause
  // ════════════════════════════════════════════════════════════
  private buildOwnerFilter(
    scope: Scope,
    userId: string,
    teamId: string | null,
    alias: string,
    ownerCol = 'owner_id',
  ): { clause: string; params: string[] } {
    if (scope === 'own') {
      return { clause: `${alias}.${ownerCol} = $PARAM$`, params: [userId] };
    }
    if (scope === 'team' && teamId) {
      return {
        clause: `${alias}.${ownerCol} IN (SELECT id FROM "$SCHEMA$".users WHERE team_id = $PARAM$)`,
        params: [teamId],
      };
    }
    // 'all' scope — no filter
    return { clause: '1=1', params: [] };
  }

  /**
   * Replace $PARAM$ placeholders with positional params ($1, $2...)
   * and $SCHEMA$ with the actual schema name
   */
  private buildQuery(
    schema: string,
    baseSQL: string,
    ownerFilter: { clause: string; params: string[] },
    extraParams: any[] = [],
    startParamIdx = 1,
  ): { sql: string; params: any[] } {
    let paramIdx = startParamIdx;
    let clause = ownerFilter.clause;

    // Replace each $PARAM$ with $N
    for (const _p of ownerFilter.params) {
      clause = clause.replace('$PARAM$', `$${paramIdx}`);
      paramIdx++;
    }

    // Replace extra param placeholders
    let sql = baseSQL
      .replace(/\$SCHEMA\$/g, schema)
      .replace('$OWNER_FILTER$', clause);

    const allParams = [...ownerFilter.params, ...extraParams];

    // Replace remaining $PARAM$ from extraParams
    for (let i = ownerFilter.params.length; i < allParams.length; i++) {
      sql = sql.replace('$PARAM$', `$${i + startParamIdx}`);
    }

    return { sql: sql.replace(/\$SCHEMA\$/g, schema), params: allParams };
  }

  // ════════════════════════════════════════════════════════════
  // 1. MY SUMMARY (KPI cards)
  // ════════════════════════════════════════════════════════════
  async getSummary(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    const ownerLead = this.buildOwnerFilter(scope, userId, teamId, 'l');
    const ownerOpp = this.buildOwnerFilter(scope, userId, teamId, 'o');
    const ownerTask = this.buildOwnerFilter(scope, userId, teamId, 't', 'assigned_to');

    // Open pipeline value
    const [pipeline] = await this.dataSource.query(
      `SELECT COALESCE(SUM(o.amount), 0) as total, COUNT(*) as count
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at IS NULL AND o.lost_at IS NULL
       AND ${this.inlineOwnerFilter(ownerOpp, schema)}`,
      ownerOpp.params,
    );

    // Won this period
    const [won] = await this.dataSource.query(
      `SELECT COALESCE(SUM(o.amount), 0) as total, COUNT(*) as count
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at IS NOT NULL
       AND o.won_at >= $${ownerOpp.params.length + 1}
       AND o.won_at <= $${ownerOpp.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerOpp, schema)}`,
      [...ownerOpp.params, dateRange.from, dateRange.to],
    );

    // Lost this period
    const [lost] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.lost_at IS NOT NULL
       AND o.lost_at >= $${ownerOpp.params.length + 1}
       AND o.lost_at <= $${ownerOpp.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerOpp, schema)}`,
      [...ownerOpp.params, dateRange.from, dateRange.to],
    );

    // Win rate
    const totalClosed = parseInt(won.count, 10) + parseInt(lost.count, 10);
    const winRate = totalClosed > 0 ? Math.round((parseInt(won.count, 10) / totalClosed) * 100) : 0;

    // Tasks due today
    const today = new Date().toISOString().split('T')[0];
    const [tasksDue] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schema}".tasks t
       WHERE t.deleted_at IS NULL AND t.completed_at IS NULL
       AND t.due_date::date = $${ownerTask.params.length + 1}
       AND ${this.inlineOwnerFilter(ownerTask, schema, 'assigned_to')}`,
      [...ownerTask.params, today],
    );

    // Tasks overdue
    const [tasksOverdue] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schema}".tasks t
       WHERE t.deleted_at IS NULL AND t.completed_at IS NULL
       AND t.due_date < NOW()
       AND ${this.inlineOwnerFilter(ownerTask, schema, 'assigned_to')}`,
      ownerTask.params,
    );

    // New leads this period
    const [newLeads] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL
       AND l.created_at >= $${ownerLead.params.length + 1}
       AND l.created_at <= $${ownerLead.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerLead, schema)}`,
      [...ownerLead.params, dateRange.from, dateRange.to],
    );

    // Converted leads this period
    const [convertedLeads] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.converted_at IS NOT NULL
       AND l.converted_at >= $${ownerLead.params.length + 1}
       AND l.converted_at <= $${ownerLead.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerLead, schema)}`,
      [...ownerLead.params, dateRange.from, dateRange.to],
    );

    // Previous period comparison
    const periodDays = Math.ceil(
      (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000,
    );
    const prevFrom = new Date(new Date(dateRange.from).getTime() - periodDays * 86400000).toISOString();
    const prevTo = dateRange.from;

    const [prevWon] = await this.dataSource.query(
      `SELECT COALESCE(SUM(o.amount), 0) as total, COUNT(*) as count
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL AND o.won_at IS NOT NULL
       AND o.won_at >= $${ownerOpp.params.length + 1} AND o.won_at < $${ownerOpp.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerOpp, schema)}`,
      [...ownerOpp.params, prevFrom, prevTo],
    );

    const [prevLeads] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL
       AND l.created_at >= $${ownerLead.params.length + 1} AND l.created_at < $${ownerLead.params.length + 2}
       AND ${this.inlineOwnerFilter(ownerLead, schema)}`,
      [...ownerLead.params, prevFrom, prevTo],
    );

    return {
      pipelineValue: parseFloat(pipeline.total),
      pipelineCount: parseInt(pipeline.count, 10),
      wonRevenue: parseFloat(won.total),
      wonCount: parseInt(won.count, 10),
      lostCount: parseInt(lost.count, 10),
      winRate,
      tasksDueToday: parseInt(tasksDue.count, 10),
      tasksOverdue: parseInt(tasksOverdue.count, 10),
      newLeads: parseInt(newLeads.count, 10),
      convertedLeads: parseInt(convertedLeads.count, 10),
      // Comparisons
      prevWonRevenue: parseFloat(prevWon.total),
      prevWonCount: parseInt(prevWon.count, 10),
      prevNewLeads: parseInt(prevLeads.count, 10),
      revenueChange: this.calcChange(parseFloat(won.total), parseFloat(prevWon.total)),
      leadsChange: this.calcChange(parseInt(newLeads.count, 10), parseInt(prevLeads.count, 10)),
    };
  }

  // ════════════════════════════════════════════════════════════
  // 2. ACTIVITY SUMMARY (by type, for chart)
  // ════════════════════════════════════════════════════════════
  async getActivitySummary(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    const ownerClause = scope === 'own'
      ? `AND a.performed_by = $3`
      : scope === 'team' && teamId
        ? `AND a.performed_by IN (SELECT id FROM "${schema}".users WHERE team_id = $3)`
        : '';
    const params: any[] = [dateRange.from, dateRange.to];
    if (scope !== 'all') params.push(scope === 'own' ? userId : teamId);

    const rows = await this.dataSource.query(
      `SELECT a.activity_type, COUNT(*) as count
       FROM "${schema}".activities a
       WHERE a.created_at >= $1 AND a.created_at <= $2
       ${ownerClause}
       GROUP BY a.activity_type
       ORDER BY count DESC`,
      params,
    );

    // Activity by day (for sparkline/chart)
    const daily = await this.dataSource.query(
      `SELECT a.created_at::date as date, COUNT(*) as count
       FROM "${schema}".activities a
       WHERE a.created_at >= $1 AND a.created_at <= $2
       ${ownerClause}
       GROUP BY a.created_at::date
       ORDER BY date ASC`,
      params,
    );

    return {
      byType: rows.map((r: any) => ({ type: r.activity_type, count: parseInt(r.count, 10) })),
      daily: daily.map((r: any) => ({ date: r.date, count: parseInt(r.count, 10) })),
    };
  }

  // ════════════════════════════════════════════════════════════
  // 3. PIPELINE FUNNEL
  // ════════════════════════════════════════════════════════════
  async getPipelineFunnel(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, pipelineId?: string,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'o');
    let paramIdx = ownerFilter.params.length + 1;
    let pipelineClause = '';
    const params = [...ownerFilter.params];

    if (pipelineId) {
      pipelineClause = `AND o.pipeline_id = $${paramIdx}`;
      params.push(pipelineId);
    }

    const stages = await this.dataSource.query(
      `SELECT ps.id, ps.name, ps.color, ps.sort_order, ps.probability,
              ps.is_won, ps.is_lost,
              COUNT(o.id) as count,
              COALESCE(SUM(o.amount), 0) as total_amount,
              COALESCE(SUM(o.weighted_amount), 0) as weighted_amount
       FROM "${schema}".pipeline_stages ps
       LEFT JOIN "${schema}".opportunities o ON o.stage_id = ps.id
         AND o.deleted_at IS NULL
         AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       WHERE ps.module = 'opportunities' AND ps.is_active = true
       ${pipelineClause}
       GROUP BY ps.id, ps.name, ps.color, ps.sort_order, ps.probability, ps.is_won, ps.is_lost
       ORDER BY ps.sort_order ASC`,
      params,
    );

    return stages.map((s: any) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      sortOrder: s.sort_order,
      probability: s.probability,
      isWon: s.is_won,
      isLost: s.is_lost,
      count: parseInt(s.count, 10),
      totalAmount: parseFloat(s.total_amount),
      weightedAmount: parseFloat(s.weighted_amount),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 4. LEAD FUNNEL (lead stages)
  // ════════════════════════════════════════════════════════════
  async getLeadFunnel(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, pipelineId?: string,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'l');
    const params = [...ownerFilter.params];
    let paramIdx = params.length + 1;
    let pipelineClause = '';

    if (pipelineId) {
      pipelineClause = `AND l.pipeline_id = $${paramIdx}`;
      params.push(pipelineId);
    }

    const stages = await this.dataSource.query(
      `SELECT ps.id, ps.name, ps.color, ps.sort_order,
              ps.is_won, ps.is_lost,
              COUNT(l.id) as count
       FROM "${schema}".pipeline_stages ps
       LEFT JOIN "${schema}".leads l ON l.stage_id = ps.id
         AND l.deleted_at IS NULL
         AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       WHERE ps.module = 'leads' AND ps.is_active = true
       ${pipelineClause}
       GROUP BY ps.id, ps.name, ps.color, ps.sort_order, ps.is_won, ps.is_lost
       ORDER BY ps.sort_order ASC`,
      params,
    );

    return stages.map((s: any) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      sortOrder: s.sort_order,
      isWon: s.is_won,
      isLost: s.is_lost,
      count: parseInt(s.count, 10),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 5. PIPELINE VELOCITY (avg time in each stage)
  // ════════════════════════════════════════════════════════════
  async getPipelineVelocity(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, module: 'leads' | 'opportunities' = 'opportunities',
  ) {
    const historyTable = module === 'leads' ? 'lead_stage_history' : 'opportunity_stage_history';
    const entityTable = module === 'leads' ? 'leads' : 'opportunities';
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'e');
    const params = [...ownerFilter.params];

    const rows = await this.dataSource.query(
      `SELECT ps.name, ps.color, ps.sort_order,
              AVG(EXTRACT(EPOCH FROM h.time_in_stage)) as avg_seconds,
              MIN(EXTRACT(EPOCH FROM h.time_in_stage)) as min_seconds,
              MAX(EXTRACT(EPOCH FROM h.time_in_stage)) as max_seconds,
              COUNT(*) as transitions
       FROM "${schema}".${historyTable} h
       JOIN "${schema}".pipeline_stages ps ON h.to_stage_id = ps.id
       JOIN "${schema}".${entityTable} e ON h.${module === 'leads' ? 'lead_id' : 'opportunity_id'} = e.id
       WHERE h.time_in_stage IS NOT NULL
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY ps.name, ps.color, ps.sort_order
       ORDER BY ps.sort_order ASC`,
      params,
    );

    return rows.map((r: any) => ({
      stage: r.name,
      color: r.color,
      avgDays: r.avg_seconds ? Math.round(parseFloat(r.avg_seconds) / 86400 * 10) / 10 : 0,
      minDays: r.min_seconds ? Math.round(parseFloat(r.min_seconds) / 86400 * 10) / 10 : 0,
      maxDays: r.max_seconds ? Math.round(parseFloat(r.max_seconds) / 86400 * 10) / 10 : 0,
      transitions: parseInt(r.transitions, 10),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 6. PIPELINE FORECAST (weighted by stage probability)
  // ════════════════════════════════════════════════════════════
  async getForecast(
    schema: string, userId: string, teamId: string | null,
    scope: Scope,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'o');
    const params = [...ownerFilter.params];

    const rows = await this.dataSource.query(
      `SELECT
         TO_CHAR(o.close_date, 'YYYY-MM') as month,
         COALESCE(SUM(o.amount), 0) as total_amount,
         COALESCE(SUM(o.weighted_amount), 0) as weighted_amount,
         COUNT(*) as deal_count
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL
       AND o.won_at IS NULL AND o.lost_at IS NULL
       AND o.close_date IS NOT NULL
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY TO_CHAR(o.close_date, 'YYYY-MM')
       ORDER BY month ASC`,
      params,
    );

    return rows.map((r: any) => ({
      month: r.month,
      totalAmount: parseFloat(r.total_amount),
      weightedAmount: parseFloat(r.weighted_amount),
      dealCount: parseInt(r.deal_count, 10),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 7. WIN/LOSS ANALYSIS
  // ════════════════════════════════════════════════════════════
  async getWinLossAnalysis(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'o');
    const params = [...ownerFilter.params, dateRange.from, dateRange.to];
    const fromIdx = ownerFilter.params.length + 1;
    const toIdx = ownerFilter.params.length + 2;

    // Monthly trend
    const trend = await this.dataSource.query(
      `SELECT
         TO_CHAR(COALESCE(o.won_at, o.lost_at), 'YYYY-MM') as month,
         COUNT(*) FILTER (WHERE o.won_at IS NOT NULL) as won,
         COUNT(*) FILTER (WHERE o.lost_at IS NOT NULL) as lost,
         COALESCE(SUM(o.amount) FILTER (WHERE o.won_at IS NOT NULL), 0) as won_amount,
         COALESCE(SUM(o.amount) FILTER (WHERE o.lost_at IS NOT NULL), 0) as lost_amount
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL
       AND (o.won_at IS NOT NULL OR o.lost_at IS NOT NULL)
       AND COALESCE(o.won_at, o.lost_at) >= $${fromIdx}
       AND COALESCE(o.won_at, o.lost_at) <= $${toIdx}
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY month ORDER BY month ASC`,
      params,
    );

    // Loss reasons
    const lossReasons = await this.dataSource.query(
      `SELECT cr.name as reason, COUNT(*) as count
       FROM "${schema}".opportunities o
       LEFT JOIN "${schema}".opportunity_close_reasons cr ON o.close_reason_id = cr.id
       WHERE o.deleted_at IS NULL AND o.lost_at IS NOT NULL
       AND o.lost_at >= $${fromIdx} AND o.lost_at <= $${toIdx}
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY cr.name
       ORDER BY count DESC`,
      params,
    );

    // By source
    const bySource = await this.dataSource.query(
      `SELECT o.source,
              COUNT(*) FILTER (WHERE o.won_at IS NOT NULL) as won,
              COUNT(*) FILTER (WHERE o.lost_at IS NOT NULL) as lost
       FROM "${schema}".opportunities o
       WHERE o.deleted_at IS NULL
       AND (o.won_at IS NOT NULL OR o.lost_at IS NOT NULL)
       AND COALESCE(o.won_at, o.lost_at) >= $${fromIdx}
       AND COALESCE(o.won_at, o.lost_at) <= $${toIdx}
       AND o.source IS NOT NULL
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY o.source ORDER BY (COUNT(*) FILTER (WHERE o.won_at IS NOT NULL)) DESC`,
      params,
    );

    return {
      trend: trend.map((r: any) => ({
        month: r.month,
        won: parseInt(r.won, 10),
        lost: parseInt(r.lost, 10),
        wonAmount: parseFloat(r.won_amount),
        lostAmount: parseFloat(r.lost_amount),
      })),
      lossReasons: lossReasons.map((r: any) => ({
        reason: r.reason || 'No reason',
        count: parseInt(r.count, 10),
      })),
      bySource: bySource.map((r: any) => ({
        source: r.source,
        won: parseInt(r.won, 10),
        lost: parseInt(r.lost, 10),
        winRate: (parseInt(r.won, 10) + parseInt(r.lost, 10)) > 0
          ? Math.round(parseInt(r.won, 10) / (parseInt(r.won, 10) + parseInt(r.lost, 10)) * 100)
          : 0,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════
  // 8. TEAM LEADERBOARD
  // ════════════════════════════════════════════════════════════
  async getTeamLeaderboard(
    schema: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    let teamClause = '';
    const params: any[] = [dateRange.from, dateRange.to];

    if (scope === 'team' && teamId) {
      teamClause = `AND u.team_id = $3`;
      params.push(teamId);
    }

    const rows = await this.dataSource.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.avatar_url,
         -- Revenue won
         COALESCE(SUM(o.amount) FILTER (WHERE o.won_at IS NOT NULL AND o.won_at >= $1 AND o.won_at <= $2), 0) as revenue_won,
         COUNT(o.id) FILTER (WHERE o.won_at IS NOT NULL AND o.won_at >= $1 AND o.won_at <= $2) as deals_won,
         COUNT(o.id) FILTER (WHERE o.lost_at IS NOT NULL AND o.lost_at >= $1 AND o.lost_at <= $2) as deals_lost,
         -- Open pipeline
         COALESCE(SUM(o.amount) FILTER (WHERE o.won_at IS NULL AND o.lost_at IS NULL), 0) as open_pipeline,
         COUNT(o.id) FILTER (WHERE o.won_at IS NULL AND o.lost_at IS NULL) as open_deals,
         -- Leads converted
         (SELECT COUNT(*) FROM "${schema}".leads l
          WHERE l.owner_id = u.id AND l.converted_at IS NOT NULL
          AND l.converted_at >= $1 AND l.converted_at <= $2) as leads_converted,
         -- Activities
         (SELECT COUNT(*) FROM "${schema}".activities a
          WHERE a.performed_by = u.id
          AND a.created_at >= $1 AND a.created_at <= $2) as total_activities,
         -- Tasks completed
         (SELECT COUNT(*) FROM "${schema}".tasks t
          WHERE t.assigned_to = u.id AND t.completed_at IS NOT NULL
          AND t.completed_at >= $1 AND t.completed_at <= $2) as tasks_completed
       FROM "${schema}".users u
       LEFT JOIN "${schema}".opportunities o ON o.owner_id = u.id AND o.deleted_at IS NULL
       WHERE u.deleted_at IS NULL AND u.status = 'active'
       ${teamClause}
       GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
       ORDER BY revenue_won DESC`,
      params,
    );

    return rows.map((r: any, idx: number) => ({
      rank: idx + 1,
      userId: r.id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      avatarUrl: r.avatar_url,
      revenueWon: parseFloat(r.revenue_won),
      dealsWon: parseInt(r.deals_won, 10),
      dealsLost: parseInt(r.deals_lost, 10),
      winRate: (parseInt(r.deals_won, 10) + parseInt(r.deals_lost, 10)) > 0
        ? Math.round(parseInt(r.deals_won, 10) / (parseInt(r.deals_won, 10) + parseInt(r.deals_lost, 10)) * 100)
        : 0,
      openPipeline: parseFloat(r.open_pipeline),
      openDeals: parseInt(r.open_deals, 10),
      leadsConverted: parseInt(r.leads_converted, 10),
      totalActivities: parseInt(r.total_activities, 10),
      tasksCompleted: parseInt(r.tasks_completed, 10),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 9. TEAM ACTIVITY COMPARISON (effort by rep)
  // ════════════════════════════════════════════════════════════
  async getTeamActivity(
    schema: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    let teamClause = '';
    const params: any[] = [dateRange.from, dateRange.to];

    if (scope === 'team' && teamId) {
      teamClause = `AND u.team_id = $3`;
      params.push(teamId);
    }

    const rows = await this.dataSource.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         a.activity_type,
         COUNT(*) as count
       FROM "${schema}".users u
       JOIN "${schema}".activities a ON a.performed_by = u.id
       WHERE u.deleted_at IS NULL AND u.status = 'active'
       AND a.created_at >= $1 AND a.created_at <= $2
       ${teamClause}
       GROUP BY u.id, u.first_name, u.last_name, a.activity_type
       ORDER BY u.first_name, a.activity_type`,
      params,
    );

    // Group by user
    const byUser: Record<string, any> = {};
    for (const r of rows) {
      const key = r.id;
      if (!byUser[key]) {
        byUser[key] = {
          userId: r.id,
          name: `${r.first_name} ${r.last_name || ''}`.trim(),
          activities: {},
          total: 0,
        };
      }
      byUser[key].activities[r.activity_type] = parseInt(r.count, 10);
      byUser[key].total += parseInt(r.count, 10);
    }

    return Object.values(byUser).sort((a: any, b: any) => b.total - a.total);
  }

  // ════════════════════════════════════════════════════════════
  // 10. LEAD AGING (idle leads)
  // ════════════════════════════════════════════════════════════
  async getLeadAging(
    schema: string, userId: string, teamId: string | null,
    scope: Scope,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'l');
    const params = [...ownerFilter.params];

    // Distribution by days idle
    const rows = await this.dataSource.query(
      `SELECT
         CASE
           WHEN EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 < 1 THEN 'Today'
           WHEN EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 < 3 THEN '1-3 days'
           WHEN EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 < 7 THEN '3-7 days'
           WHEN EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 < 14 THEN '1-2 weeks'
           WHEN EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 < 30 THEN '2-4 weeks'
           ELSE '30+ days'
         END as bucket,
         COUNT(*) as count
       FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.converted_at IS NULL AND l.disqualified_at IS NULL
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY bucket
       ORDER BY MIN(EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at))) ASC`,
      params,
    );

    // Top idle leads (for action panel)
    const idleLeads = await this.dataSource.query(
      `SELECT l.id, l.first_name, l.last_name, l.company, l.email,
              l.last_activity_at, l.created_at,
              EXTRACT(EPOCH FROM NOW() - COALESCE(l.last_activity_at, l.created_at)) / 86400 as idle_days,
              ps.name as stage_name, ps.color as stage_color
       FROM "${schema}".leads l
       LEFT JOIN "${schema}".pipeline_stages ps ON l.stage_id = ps.id
       WHERE l.deleted_at IS NULL AND l.converted_at IS NULL AND l.disqualified_at IS NULL
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       ORDER BY idle_days DESC
       LIMIT 10`,
      params,
    );

    return {
      distribution: rows.map((r: any) => ({ bucket: r.bucket, count: parseInt(r.count, 10) })),
      topIdle: idleLeads.map((r: any) => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name || ''}`.trim(),
        company: r.company,
        email: r.email,
        idleDays: Math.round(parseFloat(r.idle_days)),
        stage: r.stage_name,
        stageColor: r.stage_color,
      })),
    };
  }

  // ════════════════════════════════════════════════════════════
  // 11. LEAD SOURCES (leads + conversions by source)
  // ════════════════════════════════════════════════════════════
  async getLeadSources(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'l');
    const params = [...ownerFilter.params, dateRange.from, dateRange.to];
    const fromIdx = ownerFilter.params.length + 1;
    const toIdx = ownerFilter.params.length + 2;

    const rows = await this.dataSource.query(
      `SELECT
         COALESCE(l.source, 'Unknown') as source,
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE l.converted_at IS NOT NULL) as converted,
         COUNT(*) FILTER (WHERE l.disqualified_at IS NOT NULL) as disqualified
       FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL
       AND l.created_at >= $${fromIdx} AND l.created_at <= $${toIdx}
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       GROUP BY l.source
       ORDER BY total DESC`,
      params,
    );

    return rows.map((r: any) => ({
      source: r.source,
      total: parseInt(r.total, 10),
      converted: parseInt(r.converted, 10),
      disqualified: parseInt(r.disqualified, 10),
      conversionRate: parseInt(r.total, 10) > 0
        ? Math.round(parseInt(r.converted, 10) / parseInt(r.total, 10) * 100)
        : 0,
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 12. UPCOMING TASKS
  // ════════════════════════════════════════════════════════════
  async getUpcomingTasks(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, limit = 15,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 't', 'assigned_to');
    const params = [...ownerFilter.params, limit];

    const rows = await this.dataSource.query(
        `SELECT t.id, t.title, t.due_date, t.priority_id,
                tp.name as priority_name, tp.color as priority_color,
                ts.name as status_name, ts.color as status_color,
                u.first_name as assignee_first, u.last_name as assignee_last
        FROM "${schema}".tasks t
        LEFT JOIN "${schema}".task_priorities tp ON t.priority_id = tp.id
        LEFT JOIN "${schema}".task_statuses ts ON t.status_id = ts.id
        LEFT JOIN "${schema}".users u ON t.assigned_to = u.id
        WHERE t.deleted_at IS NULL AND t.completed_at IS NULL
        AND ${this.inlineOwnerFilter(ownerFilter, schema, 'assigned_to')}
        ORDER BY
            CASE WHEN t.due_date < NOW() THEN 0 ELSE 1 END ASC,
            t.due_date ASC NULLS LAST
        LIMIT $${ownerFilter.params.length + 1}`,
        params,
    );

    return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        dueDate: r.due_date,
        isOverdue: r.due_date ? new Date(r.due_date) < new Date() : false,
        priority: r.priority_name ? { name: r.priority_name, color: r.priority_color } : null,
        status: r.status_name ? { name: r.status_name, color: r.status_color } : null,
        type: null,
        assignee: r.assignee_first ? `${r.assignee_first} ${r.assignee_last || ''}`.trim() : null,
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 13. DEALS CLOSING SOON
  // ════════════════════════════════════════════════════════════
  async getDealsClosingSoon(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, days = 7,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'o');
    const params = [...ownerFilter.params, days];

    const rows = await this.dataSource.query(
      `SELECT o.id, o.name, o.amount, o.close_date, o.probability,
              ps.name as stage_name, ps.color as stage_color,
              a.name as account_name,
              u.first_name as owner_first, u.last_name as owner_last
       FROM "${schema}".opportunities o
       LEFT JOIN "${schema}".pipeline_stages ps ON o.stage_id = ps.id
       LEFT JOIN "${schema}".accounts a ON o.account_id = a.id
       LEFT JOIN "${schema}".users u ON o.owner_id = u.id
       WHERE o.deleted_at IS NULL AND o.won_at IS NULL AND o.lost_at IS NULL
       AND o.close_date IS NOT NULL
       AND o.close_date <= NOW() + INTERVAL '1 day' * $${ownerFilter.params.length + 1}
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       ORDER BY o.close_date ASC`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      amount: parseFloat(r.amount || 0),
      closeDate: r.close_date,
      probability: r.probability,
      stage: { name: r.stage_name, color: r.stage_color },
      account: r.account_name,
      owner: r.owner_first ? `${r.owner_first} ${r.owner_last || ''}`.trim() : null,
      isOverdue: new Date(r.close_date) < new Date(),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 14. EFFORT VS RESULT (scatter plot data)
  // ════════════════════════════════════════════════════════════
  async getEffortVsResult(
    schema: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    let teamClause = '';
    const params: any[] = [dateRange.from, dateRange.to];
    if (scope === 'team' && teamId) {
      teamClause = `AND u.team_id = $3`;
      params.push(teamId);
    }

    const rows = await this.dataSource.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         -- Effort = total activities
         (SELECT COUNT(*) FROM "${schema}".activities a
          WHERE a.performed_by = u.id AND a.created_at >= $1 AND a.created_at <= $2) as effort,
         -- Result = revenue won
         COALESCE(SUM(o.amount) FILTER (WHERE o.won_at IS NOT NULL AND o.won_at >= $1 AND o.won_at <= $2), 0) as result
       FROM "${schema}".users u
       LEFT JOIN "${schema}".opportunities o ON o.owner_id = u.id AND o.deleted_at IS NULL
       WHERE u.deleted_at IS NULL AND u.status = 'active'
       ${teamClause}
       GROUP BY u.id, u.first_name, u.last_name
       HAVING (SELECT COUNT(*) FROM "${schema}".activities a
        WHERE a.performed_by = u.id AND a.created_at >= $1 AND a.created_at <= $2) > 0`,
      params,
    );

    return rows.map((r: any) => ({
      userId: r.id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      effort: parseInt(r.effort, 10),
      result: parseFloat(r.result),
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 15. CONVERSION FUNNEL (Lead → Demo → Opp → Won)
  // ════════════════════════════════════════════════════════════
  async getConversionFunnel(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, dateRange: DateRange,
  ) {
    const params: any[] = [dateRange.from, dateRange.to];
    let ownerClause = '';

    if (scope === 'own') {
      ownerClause = `AND l.owner_id = $3`;
      params.push(userId);
    } else if (scope === 'team' && teamId) {
      ownerClause = `AND l.owner_id IN (SELECT id FROM "${schema}".users WHERE team_id = $3)`;
      params.push(teamId);
    }

    // Total leads created in period
    const [totalLeads] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.created_at >= $1 AND l.created_at <= $2 ${ownerClause}`,
      params,
    );

    // Qualified (reached any stage beyond first)
    const [qualified] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT h.lead_id) as count
       FROM "${schema}".lead_stage_history h
       JOIN "${schema}".leads l ON h.lead_id = l.id
       JOIN "${schema}".pipeline_stages ps ON h.to_stage_id = ps.id
       WHERE l.deleted_at IS NULL AND l.created_at >= $1 AND l.created_at <= $2
       AND ps.sort_order > 1
       ${ownerClause}`,
      params,
    );

    // Converted to opportunity
    const [converted] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".leads l
       WHERE l.deleted_at IS NULL AND l.converted_at IS NOT NULL
       AND l.created_at >= $1 AND l.created_at <= $2 ${ownerClause}`,
      params,
    );

    // Won (via converted_opportunity_id)
    const [won] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".leads l
       JOIN "${schema}".opportunities o ON l.converted_opportunity_id = o.id
       WHERE l.deleted_at IS NULL AND l.converted_at IS NOT NULL AND o.won_at IS NOT NULL
       AND l.created_at >= $1 AND l.created_at <= $2 ${ownerClause}`,
      params,
    );

    const total = parseInt(totalLeads.count, 10);

    return [
      { stage: 'New Leads', count: total, rate: 100 },
      { stage: 'Qualified', count: parseInt(qualified.count, 10), rate: total > 0 ? Math.round(parseInt(qualified.count, 10) / total * 100) : 0 },
      { stage: 'Converted to Opp', count: parseInt(converted.count, 10), rate: total > 0 ? Math.round(parseInt(converted.count, 10) / total * 100) : 0 },
      { stage: 'Won', count: parseInt(won.count, 10), rate: total > 0 ? Math.round(parseInt(won.count, 10) / total * 100) : 0 },
    ];
  }

  // ════════════════════════════════════════════════════════════
  // 16. RECENT ACTIVITY FEED
  // ════════════════════════════════════════════════════════════
  async getRecentActivity(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, limit = 20,
  ) {
    let ownerClause = '';
    const params: any[] = [limit];

    if (scope === 'own') {
      ownerClause = `AND a.performed_by = $2`;
      params.push(userId);
    } else if (scope === 'team' && teamId) {
      ownerClause = `AND a.performed_by IN (SELECT id FROM "${schema}".users WHERE team_id = $2)`;
      params.push(teamId);
    }

    const rows = await this.dataSource.query(
      `SELECT a.id, a.entity_type, a.entity_id, a.activity_type, a.title,
              a.description, a.created_at,
              u.first_name, u.last_name, u.avatar_url
       FROM "${schema}".activities a
       LEFT JOIN "${schema}".users u ON a.performed_by = u.id
       WHERE 1=1 ${ownerClause}
       ORDER BY a.created_at DESC
       LIMIT $1`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      activityType: r.activity_type,
      title: r.title,
      description: r.description,
      createdAt: r.created_at,
      user: {
        name: `${r.first_name} ${r.last_name || ''}`.trim(),
        avatarUrl: r.avatar_url,
      },
    }));
  }

  // ════════════════════════════════════════════════════════════
  // 17. STUCK DEALS (in same stage too long)
  // ════════════════════════════════════════════════════════════
  async getStuckDeals(
    schema: string, userId: string, teamId: string | null,
    scope: Scope, stuckDays = 14,
  ) {
    const ownerFilter = this.buildOwnerFilter(scope, userId, teamId, 'o');
    const params = [...ownerFilter.params, stuckDays];

    const rows = await this.dataSource.query(
      `SELECT o.id, o.name, o.amount, o.stage_entered_at,
              EXTRACT(EPOCH FROM NOW() - o.stage_entered_at) / 86400 as days_in_stage,
              ps.name as stage_name, ps.color as stage_color,
              a.name as account_name,
              u.first_name as owner_first, u.last_name as owner_last
       FROM "${schema}".opportunities o
       LEFT JOIN "${schema}".pipeline_stages ps ON o.stage_id = ps.id
       LEFT JOIN "${schema}".accounts a ON o.account_id = a.id
       LEFT JOIN "${schema}".users u ON o.owner_id = u.id
       WHERE o.deleted_at IS NULL AND o.won_at IS NULL AND o.lost_at IS NULL
       AND o.stage_entered_at IS NOT NULL
       AND EXTRACT(EPOCH FROM NOW() - o.stage_entered_at) / 86400 > $${ownerFilter.params.length + 1}
       AND ${this.inlineOwnerFilter(ownerFilter, schema)}
       ORDER BY days_in_stage DESC
       LIMIT 10`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      amount: parseFloat(r.amount || 0),
      daysInStage: Math.round(parseFloat(r.days_in_stage)),
      stage: { name: r.stage_name, color: r.stage_color },
      account: r.account_name,
      owner: r.owner_first ? `${r.owner_first} ${r.owner_last || ''}`.trim() : null,
    }));
  }

  // ════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════

  private inlineOwnerFilter(
    filter: { clause: string; params: string[] },
    schema: string,
    ownerCol = 'owner_id',
  ): string {
    let clause = filter.clause.replace(/\$SCHEMA\$/g, schema);
    // Replace $PARAM$ with actual $N params (already set by caller)
    let idx = 1;
    while (clause.includes('$PARAM$')) {
      clause = clause.replace('$PARAM$', `$${idx}`);
      idx++;
    }
    console.log(ownerCol)
    return clause;
  }

  private calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}