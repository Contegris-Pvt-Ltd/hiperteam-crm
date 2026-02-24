// ============================================================
// FILE: apps/api/src/modules/leads/sla.service.ts
//
// SLA calculation engine for lead first-contact timer.
// Supports:
//   - Working hours / business days calculation
//   - Breach detection
//   - Escalation triggers
//   - Timezone-aware due date computation
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActivityService } from '../shared/activity.service';
import { AuditService } from '../shared/audit.service';

export interface SlaConfig {
  enabled: boolean;
  firstContactHours: number;        // e.g. 4
  workingHoursStart: string;         // "09:00"
  workingHoursEnd: string;           // "18:00"
  workingDays: number[];             // [1,2,3,4,5] = Mon-Fri
  timezone: string;                  // "Asia/Karachi"
  breachNotifyOwner: boolean;
  breachNotifyManager: boolean;
  escalationEnabled: boolean;
  escalationHours: number;           // e.g. 8
  escalationNotifyManager: boolean;
  escalationNotifyAdmin: boolean;
  excludeWeekends: boolean;
}

const DEFAULT_SLA_CONFIG: SlaConfig = {
  enabled: false,
  firstContactHours: 4,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'UTC',
  breachNotifyOwner: true,
  breachNotifyManager: true,
  escalationEnabled: true,
  escalationHours: 8,
  escalationNotifyManager: true,
  escalationNotifyAdmin: false,
  excludeWeekends: true,
};

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private dataSource: DataSource,
    private activityService: ActivityService,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // GET SLA CONFIG
  // ============================================================
  async getSlaConfig(schemaName: string): Promise<SlaConfig> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'sla'`,
      );
      if (!row) return DEFAULT_SLA_CONFIG;
      const val = typeof row.setting_value === 'string'
        ? JSON.parse(row.setting_value)
        : row.setting_value;
      return { ...DEFAULT_SLA_CONFIG, ...val };
    } catch {
      return DEFAULT_SLA_CONFIG;
    }
  }

  // ============================================================
  // CALCULATE DUE DATE (working hours aware)
  // ============================================================
  /**
   * Given a start time, add N working hours respecting business days/hours.
   * Returns the UTC timestamp of the due date.
   */
  calculateDueDate(startUtc: Date, workingHours: number, config: SlaConfig): Date {
    const { workingHoursStart, workingHoursEnd, workingDays, timezone } = config;

    const [startH, startM] = workingHoursStart.split(':').map(Number);
    const [endH, endM] = workingHoursEnd.split(':').map(Number);

    // Working minutes per day
    const dayStartMinutes = startH * 60 + startM;
    const dayEndMinutes = endH * 60 + endM;
    const workingMinutesPerDay = dayEndMinutes - dayStartMinutes;

    if (workingMinutesPerDay <= 0) {
      // Fallback: treat as 24hr if misconfigured
      return new Date(startUtc.getTime() + workingHours * 60 * 60 * 1000);
    }

    let remainingMinutes = workingHours * 60;

    // Convert start time to the tenant's local timezone for day/hour calculation
    const cursor = new Date(startUtc);

    // Helper: get local hour/minute in timezone
    const getLocalTime = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(d);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      return hour * 60 + minute;
    };

    // Helper: get local day of week (0=Sun, 1=Mon, ..., 6=Sat)
    const getLocalDow = (d: Date) => {
      const str = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      }).format(d);
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return map[str] ?? 0;
    };

    // Helper: is working day
    const isWorkingDay = (d: Date) => workingDays.includes(getLocalDow(d));

    // Safety counter to prevent infinite loops
    let iterations = 0;
    const MAX_ITERATIONS = 365 * 24; // max 1 year of hours

    while (remainingMinutes > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      if (!isWorkingDay(cursor)) {
        // Skip to next day start
        cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
        // Reset to day start (approximate — advance to next midnight then adjust)
        continue;
      }

      const localMinutes = getLocalTime(cursor);

      if (localMinutes < dayStartMinutes) {
        // Before working hours — advance to day start
        const diff = dayStartMinutes - localMinutes;
        cursor.setTime(cursor.getTime() + diff * 60 * 1000);
        continue;
      }

      if (localMinutes >= dayEndMinutes) {
        // After working hours — advance to next day
        cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
        // Will be corrected on next iteration
        continue;
      }

      // Within working hours — consume remaining minutes or until day end
      const minutesUntilDayEnd = dayEndMinutes - localMinutes;
      const consumed = Math.min(remainingMinutes, minutesUntilDayEnd);
      remainingMinutes -= consumed;
      cursor.setTime(cursor.getTime() + consumed * 60 * 1000);
    }

    return cursor;
  }

  // ============================================================
  // SET SLA ON LEAD CREATION
  // ============================================================
  async setSlaDueDate(schemaName: string, leadId: string, createdAt: Date): Promise<void> {
    const config = await this.getSlaConfig(schemaName);
    if (!config.enabled) return;

    const dueDate = this.calculateDueDate(createdAt, config.firstContactHours, config);

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET sla_first_contact_due_at = $1
       WHERE id = $2`,
      [dueDate, leadId],
    );

    this.logger.debug(`SLA set for lead ${leadId}: due at ${dueDate.toISOString()}`);
  }

  // ============================================================
  // MARK SLA MET (on first activity/contact)
  // ============================================================
  async markSlaMet(schemaName: string, leadId: string, userId: string): Promise<void> {
    // Only mark if not already met
    const [lead] = await this.dataSource.query(
      `SELECT sla_first_contact_due_at, sla_first_contact_met_at
       FROM "${schemaName}".leads
       WHERE id = $1 AND deleted_at IS NULL`,
      [leadId],
    );

    if (!lead || !lead.sla_first_contact_due_at || lead.sla_first_contact_met_at) {
      return; // No SLA set or already met
    }

    const metAt = new Date();
    const wasBreach = lead.sla_breached === true;

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET sla_first_contact_met_at = $1
       WHERE id = $2`,
      [metAt, leadId],
    );

    // Calculate response time in minutes
    const dueAt = new Date(lead.sla_first_contact_due_at);
    const createdAt = new Date(lead.created_at || metAt);
    const responseMinutes = Math.round((metAt.getTime() - createdAt.getTime()) / 60000);

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: leadId,
      activityType: 'sla_met',
      title: wasBreach ? 'SLA met (after breach)' : 'SLA met',
      description: `First contact made in ${this.formatDuration(responseMinutes)}`,
      metadata: {
        responseMinutes,
        dueAt: dueAt.toISOString(),
        metAt: metAt.toISOString(),
        wasBreach,
      },
      performedBy: userId,
    });
  }

  // ============================================================
  // CHECK FOR BREACHES (called periodically or on-demand)
  // ============================================================
  async checkBreaches(schemaName: string): Promise<{
    breached: number;
    escalated: number;
    notifications: Array<{ leadId: string; type: 'breach' | 'escalation'; ownerId?: string; managerIds: string[] }>;
  }> {
    const config = await this.getSlaConfig(schemaName);
    if (!config.enabled) return { breached: 0, escalated: 0, notifications: [] };

    const now = new Date();
    const notifications: Array<{ leadId: string; type: 'breach' | 'escalation'; ownerId?: string; managerIds: string[] }> = [];

    // ── Find newly breached leads ──
    const newlyBreached = await this.dataSource.query(
      `SELECT l.id, l.owner_id,
              u.manager_id as owner_manager_id
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       WHERE l.sla_first_contact_due_at < $1
         AND l.sla_first_contact_met_at IS NULL
         AND l.sla_breached = false
         AND l.deleted_at IS NULL
         AND l.converted_at IS NULL
         AND l.disqualified_at IS NULL`,
      [now],
    );

    for (const lead of newlyBreached) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".leads
         SET sla_breached = true, sla_breached_at = $1
         WHERE id = $2`,
        [now, lead.id],
      );

      await this.activityService.create(schemaName, {
        entityType: 'leads',
        entityId: lead.id,
        activityType: 'sla_breached',
        title: 'SLA breached',
        description: 'First contact deadline has passed without any activity',
        metadata: { breachedAt: now.toISOString() },
        performedBy: 'system',
      });

      // Collect notification targets
      const managerIds: string[] = [];
      if (config.breachNotifyManager && lead.owner_manager_id) {
        managerIds.push(lead.owner_manager_id);
      }

      notifications.push({
        leadId: lead.id,
        type: 'breach',
        ownerId: config.breachNotifyOwner ? lead.owner_id : undefined,
        managerIds,
      });
    }

    // ── Find leads needing escalation ──
    let escalatedCount = 0;
    if (config.escalationEnabled) {
      const escalationDueAt = this.calculateDueDate(
        now,
        -(config.escalationHours), // We need leads where breach happened > escalationHours ago
        config,
      );
      console.log(escalationDueAt);
      
      // Simpler approach: escalate if breached AND breach time + escalation hours has passed
      const needsEscalation = await this.dataSource.query(
        `SELECT l.id, l.owner_id, l.sla_breached_at,
                u.manager_id as owner_manager_id
         FROM "${schemaName}".leads l
         LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
         WHERE l.sla_breached = true
           AND l.sla_escalated = false
           AND l.sla_first_contact_met_at IS NULL
           AND l.deleted_at IS NULL
           AND l.converted_at IS NULL
           AND l.disqualified_at IS NULL`,
        [],
      );

      for (const lead of needsEscalation) {
        // Check if enough working hours have passed since breach
        const breachTime = new Date(lead.sla_breached_at);
        const escalationDue = this.calculateDueDate(breachTime, config.escalationHours - config.firstContactHours, config);

        if (now >= escalationDue) {
          await this.dataSource.query(
            `UPDATE "${schemaName}".leads
             SET sla_escalated = true, sla_escalated_at = $1
             WHERE id = $2`,
            [now, lead.id],
          );

          await this.activityService.create(schemaName, {
            entityType: 'leads',
            entityId: lead.id,
            activityType: 'sla_escalated',
            title: 'SLA escalated',
            description: `No first contact after ${config.escalationHours} working hours`,
            metadata: {
              escalatedAt: now.toISOString(),
              escalationHours: config.escalationHours,
            },
            performedBy: 'system',
          });

          const managerIds: string[] = [];
          if (config.escalationNotifyManager && lead.owner_manager_id) {
            managerIds.push(lead.owner_manager_id);
          }

          notifications.push({
            leadId: lead.id,
            type: 'escalation',
            ownerId: lead.owner_id,
            managerIds,
          });

          escalatedCount++;
        }
      }
    }

    return {
      breached: newlyBreached.length,
      escalated: escalatedCount,
      notifications,
    };
  }

  // ============================================================
  // GET SLA STATUS FOR A LEAD
  // ============================================================
  async getSlaStatus(schemaName: string, leadId: string): Promise<{
    hasSla: boolean;
    dueAt: string | null;
    metAt: string | null;
    breached: boolean;
    breachedAt: string | null;
    escalated: boolean;
    escalatedAt: string | null;
    status: 'no_sla' | 'on_track' | 'at_risk' | 'breached' | 'escalated' | 'met' | 'met_late';
    remainingMinutes: number | null;
    responseMinutes: number | null;
  }> {
    const [lead] = await this.dataSource.query(
      `SELECT sla_first_contact_due_at, sla_first_contact_met_at,
              sla_breached, sla_breached_at,
              sla_escalated, sla_escalated_at,
              created_at
       FROM "${schemaName}".leads
       WHERE id = $1 AND deleted_at IS NULL`,
      [leadId],
    );

    if (!lead || !lead.sla_first_contact_due_at) {
      return {
        hasSla: false, dueAt: null, metAt: null, breached: false,
        breachedAt: null, escalated: false, escalatedAt: null,
        status: 'no_sla', remainingMinutes: null, responseMinutes: null,
      };
    }

    const now = new Date();
    const dueAt = new Date(lead.sla_first_contact_due_at);
    const metAt = lead.sla_first_contact_met_at ? new Date(lead.sla_first_contact_met_at) : null;
    const createdAt = new Date(lead.created_at);

    let status: string;
    let remainingMinutes: number | null = null;
    let responseMinutes: number | null = null;

    if (metAt) {
      responseMinutes = Math.round((metAt.getTime() - createdAt.getTime()) / 60000);
      status = lead.sla_breached ? 'met_late' : 'met';
    } else if (lead.sla_escalated) {
      status = 'escalated';
      remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
    } else if (lead.sla_breached) {
      status = 'breached';
      remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
    } else {
      remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000);
      // At risk if less than 25% of time remaining
      const totalMinutes = Math.round((dueAt.getTime() - createdAt.getTime()) / 60000);
      const threshold = totalMinutes * 0.25;
      status = remainingMinutes <= 0 ? 'breached' : remainingMinutes <= threshold ? 'at_risk' : 'on_track';
    }

    return {
      hasSla: true,
      dueAt: lead.sla_first_contact_due_at,
      metAt: lead.sla_first_contact_met_at,
      breached: lead.sla_breached || false,
      breachedAt: lead.sla_breached_at,
      escalated: lead.sla_escalated || false,
      escalatedAt: lead.sla_escalated_at,
      status: status as any,
      remainingMinutes,
      responseMinutes,
    };
  }

  // ============================================================
  // GET SLA SUMMARY (for dashboard/reporting)
  // ============================================================
  async getSlaSummary(schemaName: string, filters?: {
    ownerId?: string;
    pipelineId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    totalWithSla: number;
    onTrack: number;
    atRisk: number;
    breached: number;
    escalated: number;
    met: number;
    metLate: number;
    avgResponseMinutes: number | null;
    breachRate: number;
  }> {
    const conditions = [
      'l.sla_first_contact_due_at IS NOT NULL',
      'l.deleted_at IS NULL',
    ];
    const params: unknown[] = [];
    let pi = 1;

    if (filters?.ownerId) {
      conditions.push(`l.owner_id = $${pi}`);
      params.push(filters.ownerId);
      pi++;
    }
    if (filters?.pipelineId) {
      conditions.push(`l.pipeline_id = $${pi}`);
      params.push(filters.pipelineId);
      pi++;
    }
    if (filters?.dateFrom) {
      conditions.push(`l.created_at >= $${pi}`);
      params.push(filters.dateFrom);
      pi++;
    }
    if (filters?.dateTo) {
      conditions.push(`l.created_at <= $${pi}`);
      params.push(filters.dateTo);
      pi++;
    }

    const whereClause = conditions.join(' AND ');

    const [summary] = await this.dataSource.query(
      `SELECT
        COUNT(*) as total_with_sla,
        COUNT(*) FILTER (WHERE sla_first_contact_met_at IS NOT NULL AND sla_breached = false) as met,
        COUNT(*) FILTER (WHERE sla_first_contact_met_at IS NOT NULL AND sla_breached = true) as met_late,
        COUNT(*) FILTER (WHERE sla_breached = true AND sla_first_contact_met_at IS NULL) as breached,
        COUNT(*) FILTER (WHERE sla_escalated = true AND sla_first_contact_met_at IS NULL) as escalated,
        COUNT(*) FILTER (WHERE sla_first_contact_met_at IS NULL AND sla_breached = false AND sla_first_contact_due_at > NOW()) as on_track,
        AVG(
          CASE WHEN sla_first_contact_met_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (sla_first_contact_met_at - l.created_at)) / 60
          END
        ) as avg_response_minutes
       FROM "${schemaName}".leads l
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(summary.total_with_sla, 10) || 0;
    const met = parseInt(summary.met, 10) || 0;
    const metLate = parseInt(summary.met_late, 10) || 0;
    const breached = parseInt(summary.breached, 10) || 0;
    const escalated = parseInt(summary.escalated, 10) || 0;
    const onTrack = parseInt(summary.on_track, 10) || 0;
    const resolved = met + metLate;
    const atRisk = total - met - metLate - breached - onTrack;

    return {
      totalWithSla: total,
      onTrack: Math.max(0, onTrack),
      atRisk: Math.max(0, atRisk),
      breached,
      escalated,
      met,
      metLate,
      avgResponseMinutes: summary.avg_response_minutes
        ? Math.round(parseFloat(summary.avg_response_minutes))
        : null,
      breachRate: resolved > 0 ? Math.round((metLate / resolved) * 100) : 0,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
}