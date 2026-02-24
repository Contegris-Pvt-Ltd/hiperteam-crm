// ============================================================
// FILE: apps/api/src/modules/targets/targets-refresh.cron.ts
// ============================================================
// Runs every 15 minutes. Iterates all active tenant schemas
// and recomputes stale target progress (assignments whose
// last_computed_at is older than 15 min).
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TargetsService } from './targets.service';
import { GamificationService } from './gamification.service';

@Injectable()
export class TargetsRefreshCron {
  private readonly logger = new Logger(TargetsRefreshCron.name);
  private running = false;

  constructor(
    private dataSource: DataSource,
    private targetsService: TargetsService,
    private gamificationService: GamificationService,
  ) {}

  /**
   * Refresh all stale target progress every 15 minutes.
   * Lock flag prevents overlapping runs.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleTargetsRefresh(): Promise<void> {
    if (this.running) {
      this.logger.debug('Targets refresh already running, skipping...');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Get all active tenant schemas
      const tenants = await this.dataSource.query(
        `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
      );

      let totalComputed = 0;
      let totalErrors = 0;

      for (const tenant of tenants) {
        const schema = tenant.schema_name;

        try {
          // Check if targets table exists in this schema
          const [tableExists] = await this.dataSource.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = $1 AND table_name = 'targets'`,
            [schema],
          ).catch(() => [null]);

          if (!tableExists) continue;

          // Refresh stale progress (only assignments not computed in last 15 min)
          const result = await this.targetsService.refreshAllProgress(schema);
          totalComputed += result.computed;

          if (result.computed > 0) {
            this.logger.debug(
              `${schema}: refreshed ${result.computed}/${result.total} assignments`,
            );
          }

          // Check streaks for any newly completed periods (runs once daily at midnight)
          // This is lightweight — only checks if current period just ended
          if (this.shouldCheckStreaks()) {
            await this.checkStreaksForTenant(schema);
          }
        } catch (err: any) {
          totalErrors++;
          this.logger.warn(`${schema} targets refresh error: ${err.message}`);
        }
      }

      const duration = Date.now() - startTime;
      if (totalComputed > 0 || totalErrors > 0) {
        this.logger.log(
          `Targets cron complete: ${totalComputed} refreshed, ${totalErrors} errors, ${duration}ms`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Targets cron failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Only check streaks once per hour (between :00 and :09 minutes).
   * Streak evaluation is heavier and only matters at period boundaries.
   */
  private shouldCheckStreaks(): boolean {
    return new Date().getMinutes() < 10;
  }

  /**
   * Evaluate streaks for all users with active target assignments.
   */
  private async checkStreaksForTenant(schema: string): Promise<void> {
    try {
      // Get all active user+target pairs with streak tracking
      const pairs = await this.dataSource.query(
        `SELECT DISTINCT ta.user_id, ta.target_id, tp.percentage, ta.period_start
         FROM "${schema}".target_assignments ta
         JOIN "${schema}".targets t ON ta.target_id = t.id
         LEFT JOIN "${schema}".target_progress tp ON tp.assignment_id = ta.id
         WHERE ta.user_id IS NOT NULL
           AND ta.is_active = true AND t.is_active = true
           AND t.streak_tracking = true
           AND ta.period_end < CURRENT_DATE`,
      );

      for (const row of pairs) {
        try {
          const achieved = Number(row.percentage || 0) >= 100;
          await this.gamificationService.updateStreak(
            schema, row.user_id, row.target_id, achieved, row.period_start,
          );
        } catch {
          // Individual streak eval failure shouldn't stop others
        }
      }
    } catch {
      // Streak check is best-effort
    }
  }
}