// ============================================================
// FILE: apps/api/src/modules/calendar-sync/calendar-sync.cron.ts
// ============================================================
// Runs every 5 minutes, finds all active Google Calendar
// connections across all tenant schemas, and pulls new/updated
// events from Google using incremental syncToken.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { CalendarSyncService } from './calendar-sync.service';

@Injectable()
export class CalendarSyncCron {
  private readonly logger = new Logger(CalendarSyncCron.name);
  private running = false;

  constructor(
    private dataSource: DataSource,
    private calendarSyncService: CalendarSyncService,
  ) {}

  /**
   * Poll all active Google Calendar connections every 5 minutes.
   * Uses a lock flag to prevent overlapping runs.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCalendarSync(): Promise<void> {
    if (this.running) {
      this.logger.debug('Calendar sync already running, skipping...');
      return;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Get all tenant schemas
      const tenants = await this.dataSource.query(
        `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
      );

      let totalSynced = 0;
      let totalErrors = 0;

      for (const tenant of tenants) {
        const schema = tenant.schema_name;

        try {
          // Check if calendar_connections table exists in this schema
          const [tableExists] = await this.dataSource.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = $1 AND table_name = 'calendar_connections'`,
            [schema],
          ).catch(() => [null]);

          if (!tableExists) continue;

          // Find all active connections in this schema
          const connections = await this.dataSource.query(
            `SELECT id, user_id FROM "${schema}".calendar_connections
             WHERE provider = 'google' AND is_active = true`,
          );

          for (const conn of connections) {
            try {
              const result = await this.calendarSyncService.syncNow(schema, conn.user_id);
              totalSynced++;
              if (result.pulled > 0 || result.pushed > 0) {
                this.logger.debug(
                  `Synced ${schema}/${conn.user_id}: pushed=${result.pushed}, pulled=${result.pulled}`,
                );
              }
            } catch (err: any) {
              totalErrors++;
              this.logger.warn(
                `Sync failed for ${schema}/${conn.user_id}: ${err.message}`,
              );
            }
          }
        } catch (err: any) {
          this.logger.warn(`Schema ${schema} sync error: ${err.message}`);
        }
      }

      const duration = Date.now() - startTime;
      if (totalSynced > 0 || totalErrors > 0) {
        this.logger.log(
          `Calendar cron complete: ${totalSynced} synced, ${totalErrors} errors, ${duration}ms`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Calendar cron failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }
}