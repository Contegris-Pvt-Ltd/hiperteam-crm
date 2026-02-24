// ============================================================
// FILE: apps/api/src/modules/targets/targets.service.ts
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { NotificationService } from '../notifications/notification.service';
import { DataSource } from 'typeorm';
import { METRIC_REGISTRY, getMetricByKey, getMetricsByModule, getOwnerColumn } from './metric-registry';

// ── Period helpers ─────────────────────────────────────────────
function getPeriodDates(period: string, refDate?: Date): { start: Date; end: Date } {
  const now = refDate || new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'weekly': {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); // Monday
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'monthly':
      return {
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
      };
    case 'quarterly': {
      const q = Math.floor(m / 3);
      return {
        start: new Date(y, q * 3, 1),
        end: new Date(y, q * 3 + 3, 0, 23, 59, 59, 999),
      };
    }
    case 'yearly':
      return {
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        start: new Date(y, m, 1),
        end: new Date(y, m + 1, 0, 23, 59, 59, 999),
      };
  }
}

function calculatePace(actual: number, target: number, daysElapsed: number, daysTotal: number): string {
  if (target <= 0) return 'on_track';
  const pct = (actual / target) * 100;
  if (pct >= 100) return 'achieved';

  const expectedByNow = daysTotal > 0 ? (target * daysElapsed) / daysTotal : 0;
  if (expectedByNow <= 0) return 'on_track';

  const paceRatio = actual / expectedByNow;
  if (paceRatio >= 1.1) return 'ahead';
  if (paceRatio >= 0.85) return 'on_track';
  if (paceRatio >= 0.65) return 'at_risk';
  return 'behind';
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86400000));
}

@Injectable()
export class TargetsService {
  private readonly logger = new Logger(TargetsService.name);

  constructor(
    private dataSource: DataSource,
    @Optional() @Inject(NotificationService) private notificationService?: NotificationService,
  ) {}

  // ============================================================
  // METRIC REGISTRY
  // ============================================================

  getAvailableMetrics(module?: string) {
    const metrics = module ? getMetricsByModule(module) : METRIC_REGISTRY;
    return metrics.map(m => ({
      key: m.key,
      label: m.label,
      module: m.module,
      metricType: m.metricType,
      unit: m.unit,
      description: m.description,
      configFields: m.configFields || undefined,
    }));
  }

  // ============================================================
  // TARGET CRUD
  // ============================================================

  async create(schema: string, dto: any, userId: string) {
    const [target] = await this.dataSource.query(
      `INSERT INTO "${schema}".targets
       (name, description, module, metric_key, metric_type, metric_unit,
        aggregation_field, filter_criteria, custom_query, period,
        cascade_enabled, cascade_method,
        badge_on_achieve, streak_tracking, milestone_notifications,
        sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        dto.name, dto.description || null, dto.module, dto.metricKey,
        dto.metricType || 'count', dto.metricUnit || '',
        dto.aggregationField || null,
        JSON.stringify(dto.filterCriteria || {}),
        dto.customQuery || null,
        dto.period || 'monthly',
        dto.cascadeEnabled ?? false, dto.cascadeMethod || 'equal',
        dto.badgeOnAchieve ?? true, dto.streakTracking ?? true,
        dto.milestoneNotifications ?? true,
        dto.sortOrder || 0, userId,
      ],
    );
    return this.formatTarget(target);
  }

  async update(schema: string, id: string, dto: any) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', period: 'period',
      metricUnit: 'metric_unit', cascadeEnabled: 'cascade_enabled',
      cascadeMethod: 'cascade_method', badgeOnAchieve: 'badge_on_achieve',
      streakTracking: 'streak_tracking', milestoneNotifications: 'milestone_notifications',
      isActive: 'is_active', sortOrder: 'sort_order', customQuery: 'custom_query',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (dto[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(dto[key]);
        idx++;
      }
    }
    if (dto.filterCriteria !== undefined) {
      sets.push(`filter_criteria = $${idx}`);
      params.push(JSON.stringify(dto.filterCriteria));
      idx++;
    }

    if (sets.length === 0) throw new BadRequestException('No fields to update');

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schema}".targets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!updated) throw new NotFoundException('Target not found');
    return this.formatTarget(updated);
  }

  async delete(schema: string, id: string) {
    await this.dataSource.query(`DELETE FROM "${schema}".targets WHERE id = $1`, [id]);
    return { success: true };
  }

  async findAll(schema: string, filters?: { module?: string; isActive?: boolean }) {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters?.module) {
      where += ` AND t.module = $${idx}`;
      params.push(filters.module);
      idx++;
    }
    if (filters?.isActive !== undefined) {
      where += ` AND t.is_active = $${idx}`;
      params.push(filters.isActive);
      idx++;
    }

    const targets = await this.dataSource.query(
      `SELECT t.* FROM "${schema}".targets t ${where} ORDER BY t.module, t.sort_order`,
      params,
    );
    return targets.map((t: any) => this.formatTarget(t));
  }

  async findOne(schema: string, id: string) {
    const [target] = await this.dataSource.query(
      `SELECT * FROM "${schema}".targets WHERE id = $1`, [id],
    );
    if (!target) throw new NotFoundException('Target not found');
    return this.formatTarget(target);
  }

  // ============================================================
  // TARGET ASSIGNMENTS
  // ============================================================

  async createAssignment(schema: string, targetId: string, dto: any, userId: string) {
    const [assignment] = await this.dataSource.query(
      `INSERT INTO "${schema}".target_assignments
       (target_id, scope_type, user_id, team_id, department,
        target_value, period_start, period_end,
        is_cascaded, is_overridden, parent_assignment_id, cascade_weights, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        targetId, dto.scopeType, dto.userId || null, dto.teamId || null,
        dto.department || null, dto.targetValue,
        dto.periodStart, dto.periodEnd,
        dto.isCascaded ?? false, dto.isOverridden ?? false,
        dto.parentAssignmentId || null,
        JSON.stringify(dto.cascadeWeights || {}),
        userId,
      ],
    );

    // Create initial progress record
    await this.dataSource.query(
      `INSERT INTO "${schema}".target_progress (assignment_id, actual_value, percentage, pace_status)
       VALUES ($1, 0, 0, 'on_track')
       ON CONFLICT (assignment_id) DO NOTHING`,
      [assignment.id],
    );

    return this.formatAssignment(assignment);
  }

  async getAssignments(schema: string, targetId: string, periodStart?: string) {
    let where = `WHERE ta.target_id = $1`;
    const params: any[] = [targetId];
    let idx = 2;

    if (periodStart) {
      where += ` AND ta.period_start = $${idx}`;
      params.push(periodStart);
      idx++;
    }

    const rows = await this.dataSource.query(
      `SELECT ta.*,
              u.first_name, u.last_name, u.avatar_url,
              t2.name as team_name,
              tp.actual_value, tp.percentage, tp.pace_status,
              tp.milestone_50, tp.milestone_75, tp.milestone_100, tp.milestone_exceeded,
              tp.last_computed_at
       FROM "${schema}".target_assignments ta
       LEFT JOIN "${schema}".users u ON ta.user_id = u.id
       LEFT JOIN "${schema}".teams t2 ON ta.team_id = t2.id
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       ${where}
       ORDER BY ta.scope_type, ta.created_at`,
      params,
    );
    return rows.map((r: any) => this.formatAssignmentWithProgress(r));
  }

  async updateAssignment(schema: string, assignmentId: string, dto: any) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.targetValue !== undefined) {
      sets.push(`target_value = $${idx}`);
      params.push(dto.targetValue);
      idx++;
    }
    if (dto.isOverridden !== undefined) {
      sets.push(`is_overridden = $${idx}`);
      params.push(dto.isOverridden);
      idx++;
    }
    if (dto.isActive !== undefined) {
      sets.push(`is_active = $${idx}`);
      params.push(dto.isActive);
      idx++;
    }
    if (dto.cascadeWeights !== undefined) {
      sets.push(`cascade_weights = $${idx}`);
      params.push(JSON.stringify(dto.cascadeWeights));
      idx++;
    }

    if (sets.length === 0) throw new BadRequestException('No fields to update');
    sets.push(`updated_at = NOW()`);
    params.push(assignmentId);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schema}".target_assignments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!updated) throw new NotFoundException('Assignment not found');
    return this.formatAssignment(updated);
  }

  async deleteAssignment(schema: string, assignmentId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schema}".target_assignments WHERE id = $1`, [assignmentId],
    );
    return { success: true };
  }

  // ============================================================
  // CASCADE LOGIC
  // ============================================================

  async cascadeTarget(
    schema: string,
    targetId: string,
    parentAssignmentId: string,
    toScope: 'department' | 'team' | 'individual',
    userId: string,
  ) {
    // Get parent assignment
    const [parent] = await this.dataSource.query(
      `SELECT ta.*, t.cascade_method, t.period FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       WHERE ta.id = $1`, [parentAssignmentId],
    );
    if (!parent) throw new NotFoundException('Parent assignment not found');

    const method = parent.cascade_method || 'equal';
    const weights = parent.cascade_weights || {};
    const created: any[] = [];

    if (toScope === 'team') {
      // Get teams, either from department or all active teams
      let teams: any[];
      if (parent.department) {
        teams = await this.dataSource.query(
          `SELECT id, name FROM "${schema}".teams WHERE is_active = true AND department = $1`,
          [parent.department],
        );
      } else {
        teams = await this.dataSource.query(
          `SELECT id, name FROM "${schema}".teams WHERE is_active = true`,
        );
      }
      if (teams.length === 0) return [];

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        // Check for existing override
        const [existing] = await this.dataSource.query(
          `SELECT id, is_overridden FROM "${schema}".target_assignments
           WHERE target_id = $1 AND team_id = $2 AND period_start = $3 AND scope_type = 'team'`,
          [targetId, team.id, parent.period_start],
        );
        if (existing?.is_overridden) continue; // Don't touch overridden assignments

        const childValue = this.calculateChildValue(
          parent.target_value, teams.length, i, method, weights[team.id],
        );

        if (existing) {
          await this.dataSource.query(
            `UPDATE "${schema}".target_assignments
             SET target_value = $1, updated_at = NOW() WHERE id = $2`,
            [childValue, existing.id],
          );
          created.push({ ...existing, target_value: childValue });
        } else {
          const a = await this.createAssignment(schema, targetId, {
            scopeType: 'team', teamId: team.id,
            targetValue: childValue,
            periodStart: parent.period_start, periodEnd: parent.period_end,
            isCascaded: true, parentAssignmentId,
          }, userId);
          created.push(a);
        }
      }
    } else if (toScope === 'individual') {
      // Get users from team or all active users
      let users: any[];
      if (parent.team_id) {
        users = await this.dataSource.query(
          `SELECT tm.user_id as id FROM "${schema}".team_members tm
           JOIN "${schema}".users u ON tm.user_id = u.id
           WHERE tm.team_id = $1 AND u.status = 'active' AND u.deleted_at IS NULL`,
          [parent.team_id],
        );
      } else {
        users = await this.dataSource.query(
          `SELECT id FROM "${schema}".users WHERE status = 'active' AND deleted_at IS NULL`,
        );
      }
      if (users.length === 0) return [];

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const [existing] = await this.dataSource.query(
          `SELECT id, is_overridden FROM "${schema}".target_assignments
           WHERE target_id = $1 AND user_id = $2 AND period_start = $3 AND scope_type = 'individual'`,
          [targetId, user.id, parent.period_start],
        );
        if (existing?.is_overridden) continue;

        const childValue = this.calculateChildValue(
          parent.target_value, users.length, i, method, weights[user.id],
        );

        if (existing) {
          await this.dataSource.query(
            `UPDATE "${schema}".target_assignments
             SET target_value = $1, updated_at = NOW() WHERE id = $2`,
            [childValue, existing.id],
          );
          created.push({ ...existing, target_value: childValue });
        } else {
          const a = await this.createAssignment(schema, targetId, {
            scopeType: 'individual', userId: user.id,
            targetValue: childValue,
            periodStart: parent.period_start, periodEnd: parent.period_end,
            isCascaded: true, parentAssignmentId,
          }, userId);
          created.push(a);
        }
      }
    }

    return created;
  }

  private calculateChildValue(
    parentValue: number, childCount: number, index: number,
    method: string, weight?: number,
  ): number {
    if (method === 'weighted' && weight) {
      return Math.round(parentValue * weight * 100) / 100;
    }
    // Equal distribution
    const base = Math.floor(parentValue / childCount * 100) / 100;
    // Give remainder to first child
    if (index === 0) {
      return Math.round((parentValue - base * (childCount - 1)) * 100) / 100;
    }
    return base;
  }

  // ============================================================
  // GENERATE PERIODS
  // ============================================================

  async generatePeriods(schema: string, targetId: string, count: number, dto: any, userId: string) {
    const [target] = await this.dataSource.query(
      `SELECT * FROM "${schema}".targets WHERE id = $1`, [targetId],
    );
    if (!target) throw new NotFoundException('Target not found');

    const created: any[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      let refDate: Date;
      switch (target.period) {
        case 'weekly':
          refDate = new Date(now);
          refDate.setDate(refDate.getDate() + i * 7);
          break;
        case 'monthly':
          refDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
          break;
        case 'quarterly':
          refDate = new Date(now.getFullYear(), now.getMonth() + i * 3, 1);
          break;
        case 'yearly':
          refDate = new Date(now.getFullYear() + i, 0, 1);
          break;
        default:
          refDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      }

      const { start, end } = getPeriodDates(target.period, refDate);

      // Check if assignment already exists
      const [existing] = await this.dataSource.query(
        `SELECT id FROM "${schema}".target_assignments
         WHERE target_id = $1 AND scope_type = $2 AND period_start = $3
         AND user_id IS NOT DISTINCT FROM $4
         AND team_id IS NOT DISTINCT FROM $5`,
        [targetId, dto.scopeType, start.toISOString().split('T')[0],
         dto.userId || null, dto.teamId || null],
      );

      if (!existing) {
        const a = await this.createAssignment(schema, targetId, {
          ...dto,
          periodStart: start.toISOString().split('T')[0],
          periodEnd: end.toISOString().split('T')[0],
        }, userId);
        created.push(a);
      }
    }

    return created;
  }

  // ============================================================
  // PROGRESS COMPUTATION (cached, 15-min refresh)
  // ============================================================

  async computeProgress(schema: string, assignmentId: string): Promise<any> {
    const [row] = await this.dataSource.query(
      `SELECT ta.*, t.metric_key, t.metric_type, t.module, t.custom_query, t.filter_criteria
       FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       WHERE ta.id = $1`,
      [assignmentId],
    );
    if (!row) throw new NotFoundException('Assignment not found');

    const actual = await this.computeActual(schema, row);
    const target = Number(row.target_value);
    const percentage = target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;

    const periodStart = new Date(row.period_start);
    const periodEnd = new Date(row.period_end);
    const now = new Date();
    const daysElapsed = daysBetween(periodStart, now > periodEnd ? periodEnd : now);
    const daysTotal = daysBetween(periodStart, periodEnd);
    const expectedByNow = daysTotal > 0 ? Math.round((target * daysElapsed) / daysTotal * 100) / 100 : 0;
    const pace = calculatePace(actual, target, daysElapsed, daysTotal);

    // Upsert progress
    const [progress] = await this.dataSource.query(
      `INSERT INTO "${schema}".target_progress
       (assignment_id, actual_value, percentage, pace_status, expected_by_now,
        days_elapsed, days_total, last_computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (assignment_id) DO UPDATE SET
         actual_value = $2, percentage = $3, pace_status = $4, expected_by_now = $5,
         days_elapsed = $6, days_total = $7, last_computed_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [assignmentId, actual, percentage, pace, expectedByNow, daysElapsed, daysTotal],
    );

    // Check milestones
    await this.checkMilestones(schema, assignmentId, percentage, progress);

    return {
      assignmentId,
      actual,
      target,
      percentage,
      pace,
      expectedByNow,
      daysElapsed,
      daysTotal,
      lastComputedAt: progress.last_computed_at,
    };
  }

  private async computeActual(schema: string, assignment: any): Promise<number> {
    const metricKey = assignment.metric_key;
    const from = assignment.period_start;
    const to = assignment.period_end;

    // Try custom query first
    if (assignment.custom_query) {
      return this.executeCustomQuery(schema, assignment.custom_query, from, to, assignment);
    }

    // Use registry
    const metric = getMetricByKey(metricKey);
    if (!metric) {
      this.logger.warn(`Unknown metric: ${metricKey}, returning 0`);
      return 0;
    }

    // Build owner filter
    let ownerClause = '';
    const params: any[] = [from, to];

    if (assignment.user_id) {
      const { column } = getOwnerColumn(metric.module);
      ownerClause = `AND ${column} = $3`;
      params.push(assignment.user_id);
    } else if (assignment.team_id) {
      // Get team member IDs and use IN clause
      const members = await this.dataSource.query(
        `SELECT user_id FROM "${schema}".team_members WHERE team_id = $1`,
        [assignment.team_id],
      );
      if (members.length === 0) return 0;
      const { column } = getOwnerColumn(metric.module);
      const memberIds = members.map((m: any) => m.user_id);
      ownerClause = `AND ${column} = ANY($3::uuid[])`;
      params.push(memberIds);
    }
    // company/department scope: no owner filter (all users)

    // Pass filter_criteria for parameterized metrics (e.g. leads_reached_stage)
    const config = assignment.filter_criteria || {};
    const query = metric.buildQuery(schema, ownerClause, config);
    const [result] = await this.dataSource.query(query, params);
    return Number(result?.value || 0);
  }

  private async executeCustomQuery(
    schema: string, customQuery: string,
    from: string, to: string, assignment: any,
  ): Promise<number> {
    try {
      // Replace placeholders
      let query = customQuery
        .replace(/\$SCHEMA/g, `"${schema}"`)
        .replace(/\$FROM/g, `'${from}'`)
        .replace(/\$TO/g, `'${to}'`);

      if (assignment.user_id) {
        query = query.replace(/\$OWNER_ID/g, `'${assignment.user_id}'`);
      }

      const [result] = await this.dataSource.query(query);
      return Number(result?.value || 0);
    } catch (err) {
      this.logger.error(`Custom query failed for assignment ${assignment.id}: ${err}`);
      return 0;
    }
  }

  // ============================================================
  // BULK REFRESH (15-min cache)
  // ============================================================

  async refreshAllProgress(schema: string, force = false) {
    const staleMinutes = force ? 0 : 15;

    const staleAssignments = await this.dataSource.query(
      `SELECT ta.id FROM "${schema}".target_assignments ta
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       JOIN "${schema}".targets t ON ta.target_id = t.id
       WHERE ta.is_active = true AND t.is_active = true
       AND ta.period_start <= CURRENT_DATE AND ta.period_end >= CURRENT_DATE
       AND (tp.last_computed_at IS NULL OR tp.last_computed_at < NOW() - INTERVAL '${staleMinutes} minutes')`,
    );

    let computed = 0;
    for (const row of staleAssignments) {
      try {
        await this.computeProgress(schema, row.id);
        computed++;
      } catch (err) {
        this.logger.warn(`Failed to compute progress for ${row.id}: ${err}`);
      }
    }
    return { computed, total: staleAssignments.length };
  }

  // ============================================================
  // PROGRESS QUERIES (for dashboard)
  // ============================================================

  async getMyProgress(schema: string, userId: string, period?: string) {
    const { start, end } = getPeriodDates(period || 'monthly');

    const rows = await this.dataSource.query(
      `SELECT ta.*, t.name as target_name, t.metric_key, t.metric_type,
              t.metric_unit, t.module, t.streak_tracking,
              tp.actual_value, tp.percentage, tp.pace_status,
              tp.expected_by_now, tp.days_elapsed, tp.days_total,
              tp.milestone_50, tp.milestone_75, tp.milestone_100, tp.milestone_exceeded,
              tp.last_computed_at,
              us.current_streak, us.longest_streak
       FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       LEFT JOIN "${schema}".user_streaks us ON us.user_id = ta.user_id AND us.target_id = ta.target_id
       WHERE ta.user_id = $1 AND ta.is_active = true AND t.is_active = true
       AND ta.period_start <= $3 AND ta.period_end >= $2
       ORDER BY t.module, t.sort_order`,
      [userId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]],
    );

    // Refresh stale progress
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    for (const row of rows) {
      if (!row.last_computed_at || new Date(row.last_computed_at) < staleThreshold) {
        try {
          const fresh = await this.computeProgress(schema, row.id);
          Object.assign(row, {
            actual_value: fresh.actual,
            percentage: fresh.percentage,
            pace_status: fresh.pace,
            expected_by_now: fresh.expectedByNow,
            days_elapsed: fresh.daysElapsed,
            days_total: fresh.daysTotal,
            last_computed_at: fresh.lastComputedAt,
          });
        } catch { /* use cached */ }
      }
    }

    return rows.map((r: any) => ({
      id: r.id,
      targetId: r.target_id,
      targetName: r.target_name,
      metricKey: r.metric_key,
      metricType: r.metric_type,
      metricUnit: r.metric_unit,
      module: r.module,
      targetValue: Number(r.target_value),
      actual: Number(r.actual_value || 0),
      percentage: Number(r.percentage || 0),
      pace: r.pace_status || 'on_track',
      expectedByNow: Number(r.expected_by_now || 0),
      daysElapsed: r.days_elapsed || 0,
      daysTotal: r.days_total || 0,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      milestones: {
        fifty: r.milestone_50, seventyFive: r.milestone_75,
        hundred: r.milestone_100, exceeded: r.milestone_exceeded,
      },
      streak: r.streak_tracking ? {
        current: r.current_streak || 0,
        longest: r.longest_streak || 0,
      } : null,
    }));
  }

  async getTeamProgress(schema: string, teamId: string, period?: string) {
    const { start, end } = getPeriodDates(period || 'monthly');

    // Get team-level targets
    const teamTargets = await this.dataSource.query(
      `SELECT ta.*, t.name as target_name, t.metric_key, t.metric_unit, t.module,
              tp.actual_value, tp.percentage, tp.pace_status
       FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       WHERE ta.team_id = $1 AND ta.scope_type = 'team'
       AND ta.is_active = true AND t.is_active = true
       AND ta.period_start <= $3 AND ta.period_end >= $2
       ORDER BY t.sort_order`,
      [teamId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]],
    );

    // Get individual progress for team members
    const memberProgress = await this.dataSource.query(
      `SELECT ta.*, t.name as target_name, t.metric_key, t.metric_unit,
              tp.actual_value, tp.percentage, tp.pace_status,
              u.first_name, u.last_name, u.avatar_url
       FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       JOIN "${schema}".users u ON ta.user_id = u.id
       JOIN "${schema}".team_members tm ON tm.user_id = u.id AND tm.team_id = $1
       WHERE ta.scope_type = 'individual'
       AND ta.is_active = true AND t.is_active = true
       AND ta.period_start <= $3 AND ta.period_end >= $2
       ORDER BY u.first_name, t.sort_order`,
      [teamId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]],
    );

    return {
      team: teamTargets.map((r: any) => ({
        targetName: r.target_name, metricKey: r.metric_key, metricUnit: r.metric_unit,
        module: r.module, targetValue: Number(r.target_value),
        actual: Number(r.actual_value || 0), percentage: Number(r.percentage || 0),
        pace: r.pace_status || 'on_track',
      })),
      members: memberProgress.map((r: any) => ({
        userId: r.user_id, name: `${r.first_name} ${r.last_name || ''}`.trim(),
        avatarUrl: r.avatar_url, targetName: r.target_name,
        metricKey: r.metric_key, metricUnit: r.metric_unit,
        targetValue: Number(r.target_value),
        actual: Number(r.actual_value || 0), percentage: Number(r.percentage || 0),
        pace: r.pace_status || 'on_track',
      })),
    };
  }

  /**
   * Target-based leaderboard — replaces Effort vs Result
   */
  async getTargetLeaderboard(schema: string, metricKey: string, period?: string) {
    const { start, end } = getPeriodDates(period || 'monthly');

    const rows = await this.dataSource.query(
      `SELECT ta.user_id, ta.target_value,
              tp.actual_value, tp.percentage, tp.pace_status,
              u.first_name, u.last_name, u.avatar_url,
              us.current_streak,
              (SELECT COALESCE(SUM(ba.points_earned), 0)
               FROM "${schema}".badge_awards ba
               WHERE ba.user_id = ta.user_id
               AND ba.awarded_at >= $2 AND ba.awarded_at <= $3) as period_points
       FROM "${schema}".target_assignments ta
       JOIN "${schema}".targets t ON ta.target_id = t.id
       LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
       JOIN "${schema}".users u ON ta.user_id = u.id
       LEFT JOIN "${schema}".user_streaks us ON us.user_id = ta.user_id AND us.target_id = ta.target_id
       WHERE t.metric_key = $1 AND ta.scope_type = 'individual'
       AND ta.is_active = true AND t.is_active = true
       AND ta.period_start <= $3 AND ta.period_end >= $2
       AND u.status = 'active' AND u.deleted_at IS NULL
       ORDER BY tp.percentage DESC NULLS LAST`,
      [metricKey, start.toISOString().split('T')[0], end.toISOString().split('T')[0]],
    );

    return rows.map((r: any, idx: number) => ({
      rank: idx + 1,
      userId: r.user_id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      avatarUrl: r.avatar_url,
      target: Number(r.target_value),
      actual: Number(r.actual_value || 0),
      percentage: Number(r.percentage || 0),
      pace: r.pace_status || 'on_track',
      streak: r.current_streak || 0,
      periodPoints: Number(r.period_points || 0),
    }));
  }

  // ============================================================
  // MILESTONE CHECKS
  // ============================================================

  private async checkMilestones(schema: string, assignmentId: string, percentage: number, progress: any) {
    const milestones: { field: string; threshold: number; message: string }[] = [
      { field: 'milestone_50', threshold: 50, message: '🎯 Halfway there! 50% reached' },
      { field: 'milestone_75', threshold: 75, message: '🎯 Almost there! 75% reached' },
      { field: 'milestone_100', threshold: 100, message: '🏆 Target achieved! 100% reached' },
      { field: 'milestone_exceeded', threshold: 110, message: '🚀 Target exceeded! Over 110%!' },
    ];

    for (const ms of milestones) {
      if (percentage >= ms.threshold && !progress[ms.field]) {
        // Mark milestone
        await this.dataSource.query(
          `UPDATE "${schema}".target_progress SET ${ms.field} = true WHERE assignment_id = $1`,
          [assignmentId],
        );

        // Get assignment details for logging
        const [assignment] = await this.dataSource.query(
          `SELECT ta.user_id, t.name as target_name, t.id as target_id
           FROM "${schema}".target_assignments ta
           JOIN "${schema}".targets t ON ta.target_id = t.id
           WHERE ta.id = $1`,
          [assignmentId],
        );

        if (assignment?.user_id) {
          // Log achievement
          await this.dataSource.query(
            `INSERT INTO "${schema}".achievement_log
             (user_id, event_type, event_data, target_id, message)
             VALUES ($1, 'milestone_hit', $2, $3, $4)`,
            [
              assignment.user_id,
              JSON.stringify({ assignmentId, percentage, threshold: ms.threshold }),
              assignment.target_id,
              `${ms.message} — ${assignment.target_name}`,
            ],
          );

          // Fire-and-forget notification
          this.emitNotification(schema, assignment.user_id, ms.message, assignment.target_name);
        }
      }
    }
  }

  private emitNotification(schema: string, userId: string, title: string, targetName: string) {
    if (this.notificationService) {
      this.notificationService.notify(schema, {
        userId,
        eventType: 'target_milestone',
        title,
        body: `${title} — ${targetName}`,
        icon: '🎯',
        actionUrl: '/dashboard',
        entityType: 'targets',
        metadata: { targetName },
      }).catch((err) => {
        this.logger.warn(`Notification dispatch failed: ${err.message}`);
      });
    }
  }

  // ============================================================
  // FORMAT HELPERS
  // ============================================================

  private formatTarget(t: any) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      module: t.module,
      metricKey: t.metric_key,
      metricType: t.metric_type,
      metricUnit: t.metric_unit,
      aggregationField: t.aggregation_field,
      filterCriteria: t.filter_criteria,
      customQuery: t.custom_query,
      period: t.period,
      cascadeEnabled: t.cascade_enabled,
      cascadeMethod: t.cascade_method,
      badgeOnAchieve: t.badge_on_achieve,
      streakTracking: t.streak_tracking,
      milestoneNotifications: t.milestone_notifications,
      isActive: t.is_active,
      sortOrder: t.sort_order,
      createdAt: t.created_at,
    };
  }

  private formatAssignment(a: any) {
    return {
      id: a.id,
      targetId: a.target_id,
      scopeType: a.scope_type,
      userId: a.user_id,
      teamId: a.team_id,
      department: a.department,
      targetValue: Number(a.target_value),
      periodStart: a.period_start,
      periodEnd: a.period_end,
      isCascaded: a.is_cascaded,
      isOverridden: a.is_overridden,
      parentAssignmentId: a.parent_assignment_id,
      cascadeWeights: a.cascade_weights,
      isActive: a.is_active,
    };
  }

  private formatAssignmentWithProgress(r: any) {
    return {
      ...this.formatAssignment(r),
      user: r.first_name ? {
        name: `${r.first_name} ${r.last_name || ''}`.trim(),
        avatarUrl: r.avatar_url,
      } : null,
      teamName: r.team_name || null,
      progress: {
        actual: Number(r.actual_value || 0),
        percentage: Number(r.percentage || 0),
        pace: r.pace_status || 'on_track',
        milestones: {
          fifty: r.milestone_50, seventyFive: r.milestone_75,
          hundred: r.milestone_100, exceeded: r.milestone_exceeded,
        },
        lastComputedAt: r.last_computed_at,
      },
    };
  }
}