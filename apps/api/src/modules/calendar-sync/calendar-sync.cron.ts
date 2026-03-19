// ============================================================
// FILE: apps/api/src/modules/calendar-sync/calendar-sync.cron.ts
// ============================================================
// Optimized calendar sync cron:
//   - Concurrent batch processing (10 connections at a time)
//   - Smart scheduling: backs off to 15 min for idle connections
//   - Quiet logging: only logs when something actually changes
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { CalendarSyncService } from './calendar-sync.service';

/** How many connections to sync concurrently per cycle */
const BATCH_SIZE = 10;

/**
 * After this many consecutive no-change cycles, skip to every 3rd cycle
 * (effectively 15 min instead of 5 min for idle users).
 */
const IDLE_THRESHOLD = 3;

interface ConnectionMeta {
  schema: string;
  connectionId: string;
  userId: string;
  idleCount: number;
}

@Injectable()
export class CalendarSyncCron {
  private readonly logger = new Logger(CalendarSyncCron.name);
  private running = false;
  private cycleCount = 0;

  /**
   * Track consecutive no-change cycles per connection.
   * Key: `${schema}/${userId}`
   */
  private idleMap = new Map<string, number>();

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
      return;
    }

    this.running = true;
    this.cycleCount++;
    const startTime = Date.now();

    try {
      const connections = await this.getAllActiveConnections();
      if (connections.length === 0) {
        return;
      }

      // Filter out idle connections on non-3rd cycles
      const toSync = connections.filter((c) => {
        if (c.idleCount < IDLE_THRESHOLD) return true;
        // Idle connections only sync every 3rd cycle (~15 min)
        return this.cycleCount % 3 === 0;
      });

      if (toSync.length === 0) {
        return;
      }

      let totalChanged = 0;
      let totalErrors = 0;
      const skipped = connections.length - toSync.length;

      // Process in concurrent batches
      for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
        const batch = toSync.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((c) => this.syncConnection(c)),
        );

        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const conn = batch[j];
          const key = `${conn.schema}/${conn.userId}`;

          if (result.status === 'fulfilled') {
            const { pushed, pulled } = result.value;
            if (pushed > 0 || pulled > 0) {
              totalChanged++;
              this.idleMap.set(key, 0); // Reset idle counter
              this.logger.log(
                `Synced ${key}: pushed=${pushed}, pulled=${pulled}`,
              );
            } else {
              // No changes — increment idle counter
              this.idleMap.set(key, (this.idleMap.get(key) || 0) + 1);
            }
          } else {
            totalErrors++;
            this.idleMap.set(key, 0); // Reset on error to retry sooner
            this.logger.warn(
              `Sync failed ${key}: ${result.reason?.message || result.reason}`,
            );
          }
        }
      }

      // Only log summary if something noteworthy happened
      const duration = Date.now() - startTime;
      if (totalChanged > 0 || totalErrors > 0) {
        this.logger.log(
          `Calendar cron: ${totalChanged} changed, ${totalErrors} errors, ${skipped} idle-skipped, ${duration}ms`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Calendar cron failed: ${err.message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Gather all active connections across all tenant schemas in a single pass.
   */
  private async getAllActiveConnections(): Promise<ConnectionMeta[]> {
    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
    );

    const connections: ConnectionMeta[] = [];

    for (const tenant of tenants) {
      const schema = tenant.schema_name;

      try {
        const [tableExists] = await this.dataSource
          .query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = $1 AND table_name = 'calendar_connections'`,
            [schema],
          )
          .catch(() => [null]);

        if (!tableExists) continue;

        const rows = await this.dataSource.query(
          `SELECT id, user_id FROM "${schema}".calendar_connections
           WHERE provider = 'google' AND is_active = true`,
        );

        for (const row of rows) {
          const key = `${schema}/${row.user_id}`;
          connections.push({
            schema,
            connectionId: row.id,
            userId: row.user_id,
            idleCount: this.idleMap.get(key) || 0,
          });
        }
      } catch (err: any) {
        this.logger.warn(`Schema ${schema} lookup error: ${err.message}`);
      }
    }

    return connections;
  }

  /**
   * Sync a single connection — returns pushed/pulled counts.
   */
  private async syncConnection(
    conn: ConnectionMeta,
  ): Promise<{ pushed: number; pulled: number }> {
    return this.calendarSyncService.syncNow(conn.schema, conn.userId);
  }
}
