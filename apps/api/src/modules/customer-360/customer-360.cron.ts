// ============================================================
// FILE: apps/api/src/modules/customer-360/customer-360.cron.ts
// ============================================================
// Periodic jobs:
//   1. Recalculate customer scores (hourly)
//   2. Poll external usage APIs (based on poll_interval)
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ScoringService } from './scoring.service';
import { Customer360Service } from './customer-360.service';

@Injectable()
export class Customer360Cron {
  private readonly logger = new Logger(Customer360Cron.name);
  private scoringRunning = false;
  private usageRunning = false;

  constructor(
    private dataSource: DataSource,
    private scoringService: ScoringService,
    private customer360Service: Customer360Service,
  ) {}

  // ════════════════════════════════════════════════════════════
  // RECALCULATE SCORES — every hour
  // ════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_HOUR)
  async handleScoreRecalculation(): Promise<void> {
    if (this.scoringRunning) return;
    this.scoringRunning = true;

    try {
      const tenants = await this.dataSource.query(
        `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
      );

      let totalScored = 0;
      for (const tenant of tenants) {
        const schema = tenant.schema_name;
        try {
          const [tableExists] = await this.dataSource
            .query(
              `SELECT 1 FROM information_schema.tables
               WHERE table_schema = $1 AND table_name = 'customer_scores'`,
              [schema],
            )
            .catch(() => [null]);
          if (!tableExists) continue;

          const count = await this.scoringService.recalculateAll(schema);
          totalScored += count;
        } catch (err: any) {
          this.logger.warn(`Scoring failed for ${schema}: ${err.message}`);
        }
      }

      if (totalScored > 0) {
        this.logger.log(`Scoring cron: ${totalScored} accounts recalculated`);
      }
    } catch (err: any) {
      this.logger.error(`Scoring cron failed: ${err.message}`);
    } finally {
      this.scoringRunning = false;
    }
  }

  // ════════════════════════════════════════════════════════════
  // POLL USAGE APIs — every hour (filters by poll_interval)
  // ════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_HOUR)
  async handleUsagePolling(): Promise<void> {
    if (this.usageRunning) return;
    this.usageRunning = true;

    try {
      const tenants = await this.dataSource.query(
        `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
      );

      let totalPolled = 0;
      let totalErrors = 0;

      for (const tenant of tenants) {
        const schema = tenant.schema_name;
        try {
          const [tableExists] = await this.dataSource
            .query(
              `SELECT 1 FROM information_schema.tables
               WHERE table_schema = $1 AND table_name = 'account_usage_sources'`,
              [schema],
            )
            .catch(() => [null]);
          if (!tableExists) continue;

          // Find sources due for polling
          const sources = await this.dataSource.query(
            `SELECT * FROM "${schema}".account_usage_sources
             WHERE is_active = true AND source_type = 'pull_api' AND api_url IS NOT NULL
               AND (
                 last_synced_at IS NULL
                 OR (poll_interval = 'hourly')
                 OR (poll_interval = 'daily' AND last_synced_at < NOW() - INTERVAL '23 hours')
                 OR (poll_interval = 'weekly' AND last_synced_at < NOW() - INTERVAL '6 days 23 hours')
               )`,
          );

          for (const source of sources) {
            try {
              await this.pollUsageApi(schema, source);
              totalPolled++;
            } catch (err: any) {
              totalErrors++;
              await this.dataSource.query(
                `UPDATE "${schema}".account_usage_sources
                 SET last_sync_error = $1, updated_at = NOW()
                 WHERE id = $2`,
                [err.message, source.id],
              );
            }
          }
        } catch (err: any) {
          this.logger.warn(`Usage polling failed for ${schema}: ${err.message}`);
        }
      }

      if (totalPolled > 0 || totalErrors > 0) {
        this.logger.log(`Usage cron: ${totalPolled} polled, ${totalErrors} errors`);
      }
    } catch (err: any) {
      this.logger.error(`Usage cron failed: ${err.message}`);
    } finally {
      this.usageRunning = false;
    }
  }

  // ════════════════════════════════════════════════════════════
  // PULL FROM EXTERNAL API
  // ════════════════════════════════════════════════════════════

  private async pollUsageApi(schemaName: string, source: any): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(typeof source.api_headers === 'string'
        ? JSON.parse(source.api_headers) : (source.api_headers || {})),
    };

    const queryParams = typeof source.api_query_params === 'string'
      ? JSON.parse(source.api_query_params) : (source.api_query_params || {});

    let url = source.api_url;
    const params = new URLSearchParams(queryParams);
    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    const res = await fetch(url, {
      method: source.api_method || 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
    }

    const body = await res.json();

    const mappings = typeof source.metric_mappings === 'string'
      ? JSON.parse(source.metric_mappings) : (source.metric_mappings || {});

    const metrics: { metricKey: string; metricValue: number }[] = [];
    for (const [metricKey, jsonPath] of Object.entries(mappings)) {
      const value = this.extractJsonPath(body, jsonPath as string);
      if (value !== null && value !== undefined && !isNaN(Number(value))) {
        metrics.push({ metricKey, metricValue: Number(value) });
      }
    }

    if (metrics.length > 0) {
      await this.customer360Service.ingestUsageData(
        schemaName, source.account_id, source.product_id, metrics, 'api',
      );
    }
  }

  private extractJsonPath(obj: any, path: string): any {
    const parts = path.replace(/^\$\.?/, '').split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return null;
      current = current[part];
    }
    return current;
  }
}
