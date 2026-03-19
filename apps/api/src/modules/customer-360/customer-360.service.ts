// ============================================================
// FILE: apps/api/src/modules/customer-360/customer-360.service.ts
// ============================================================
// Handles account subscriptions (CRUD + auto-create from won opp),
// product usage metrics, usage sources, and usage log ingestion.
// ============================================================

import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { WorkflowRunnerService } from '../workflows/workflow-runner.service';

@Injectable()
export class Customer360Service {
  private readonly logger = new Logger(Customer360Service.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly activityService: ActivityService,
    private readonly workflowRunner: WorkflowRunnerService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS — CRUD
  // ════════════════════════════════════════════════════════════

  async getSubscriptions(schemaName: string, accountId: string) {
    const rows = await this.dataSource.query(
      `SELECT s.*, p.name as product_name, p.code as product_code,
              p.type as product_type, p.image_url as product_image_url,
              aus.source_type as usage_source_type, aus.last_synced_at as usage_last_synced_at
       FROM "${schemaName}".account_subscriptions s
       LEFT JOIN "${schemaName}".products p ON s.product_id = p.id
       LEFT JOIN "${schemaName}".account_usage_sources aus ON aus.account_id = s.account_id AND aus.product_id = s.product_id
       WHERE s.account_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.status ASC, s.created_at DESC`,
      [accountId],
    );
    return rows.map((r: any) => this.formatSubscription(r));
  }

  async getSubscriptionById(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT s.*, p.name as product_name, p.code as product_code,
              p.type as product_type, p.image_url as product_image_url
       FROM "${schemaName}".account_subscriptions s
       LEFT JOIN "${schemaName}".products p ON s.product_id = p.id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('Subscription not found');
    return this.formatSubscription(row);
  }

  async createSubscription(schemaName: string, userId: string, data: any) {
    const mrr = this.calculateMrr(
      data.unitPrice || 0, data.quantity || 1,
      data.discountPercent || 0, data.discountAmount || 0,
      data.billingFrequency || 'monthly',
    );

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".account_subscriptions
       (account_id, product_id, status, billing_frequency, quantity, unit_price,
        discount_percent, discount_amount, mrr, currency, start_date, end_date,
        renewal_date, auto_renew, renewal_reminder_days, source_opportunity_id,
        source_invoice_id, source_contract_id, notes, custom_fields, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        data.accountId, data.productId, data.status || 'active',
        data.billingFrequency || 'monthly', data.quantity || 1, data.unitPrice || 0,
        data.discountPercent || 0, data.discountAmount || 0, mrr,
        data.currency || 'USD', data.startDate || null, data.endDate || null,
        data.renewalDate || null, data.autoRenew || false,
        data.renewalReminderDays || 60, data.sourceOpportunityId || null,
        data.sourceInvoiceId || null, data.sourceContractId || null,
        data.notes || null, JSON.stringify(data.customFields || {}), userId,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'account_subscriptions', entityId: row.id,
      action: 'create', changes: {}, newValues: row, performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'accounts', entityId: data.accountId,
      activityType: 'subscription_created',
      title: 'Subscription added',
      description: `Product subscription created`,
      performedBy: userId,
    });

    // Trigger subscription_created workflow
    try {
      await this.workflowRunner.trigger(
        schemaName, 'accounts', 'subscription_created',
        row.id, row, undefined, { accountId: data.accountId },
      );
    } catch (err) {
      this.logger.warn(`Workflow trigger failed for subscription_created: ${err.message}`);
    }

    return this.getSubscriptionById(schemaName, row.id);
  }

  async updateSubscription(schemaName: string, id: string, userId: string, data: any) {
    const existing = await this.getSubscriptionById(schemaName, id);

    const mrr = this.calculateMrr(
      data.unitPrice ?? existing.unitPrice,
      data.quantity ?? existing.quantity,
      data.discountPercent ?? existing.discountPercent,
      data.discountAmount ?? existing.discountAmount,
      data.billingFrequency ?? existing.billingFrequency,
    );

    await this.dataSource.query(
      `UPDATE "${schemaName}".account_subscriptions SET
        status = COALESCE($1, status),
        billing_frequency = COALESCE($2, billing_frequency),
        quantity = COALESCE($3, quantity),
        unit_price = COALESCE($4, unit_price),
        discount_percent = COALESCE($5, discount_percent),
        discount_amount = COALESCE($6, discount_amount),
        mrr = $7,
        currency = COALESCE($8, currency),
        start_date = COALESCE($9, start_date),
        end_date = COALESCE($10, end_date),
        renewal_date = COALESCE($11, renewal_date),
        auto_renew = COALESCE($12, auto_renew),
        renewal_reminder_days = COALESCE($13, renewal_reminder_days),
        notes = COALESCE($14, notes),
        custom_fields = COALESCE($15::jsonb, custom_fields),
        cancelled_at = $16,
        updated_at = NOW()
       WHERE id = $17`,
      [
        data.status, data.billingFrequency, data.quantity, data.unitPrice,
        data.discountPercent, data.discountAmount, mrr,
        data.currency, data.startDate, data.endDate,
        data.renewalDate, data.autoRenew, data.renewalReminderDays,
        data.notes, data.customFields ? JSON.stringify(data.customFields) : null,
        data.status === 'cancelled' ? new Date().toISOString() : existing.cancelledAt,
        id,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'account_subscriptions', entityId: id,
      action: 'update', changes: {}, newValues: data, performedBy: userId,
    });

    // Trigger workflow on status change to expired or cancelled
    if (data.status && data.status !== existing.status) {
      const triggerType = data.status === 'expired'
        ? 'subscription_expired'
        : data.status === 'cancelled'
          ? 'subscription_cancelled'
          : null;
      if (triggerType) {
        try {
          await this.workflowRunner.trigger(
            schemaName, 'accounts', triggerType,
            id, { ...existing, ...data }, { status: existing.status },
            { accountId: existing.accountId },
          );
        } catch (err) {
          this.logger.warn(`Workflow trigger failed for ${triggerType}: ${err.message}`);
        }
      }
    }

    return this.getSubscriptionById(schemaName, id);
  }

  async deleteSubscription(schemaName: string, id: string, userId: string) {
    const existing = await this.getSubscriptionById(schemaName, id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".account_subscriptions SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );
    await this.auditService.log(schemaName, {
      entityType: 'account_subscriptions', entityId: id,
      action: 'delete', changes: {}, newValues: {}, performedBy: userId,
    });
    await this.activityService.create(schemaName, {
      entityType: 'accounts', entityId: existing.accountId,
      activityType: 'subscription_deleted',
      title: 'Subscription removed',
      description: `Removed subscription for ${existing.productName}`,
      performedBy: userId,
    });
  }

  // ════════════════════════════════════════════════════════════
  // AUTO-CREATE FROM WON OPPORTUNITY
  // ════════════════════════════════════════════════════════════

  async createSubscriptionsFromOpportunity(
    schemaName: string, opportunityId: string, userId: string,
  ): Promise<number> {
    // Get opportunity with account
    const [opp] = await this.dataSource.query(
      `SELECT id, name, account_id, currency FROM "${schemaName}".opportunities
       WHERE id = $1 AND deleted_at IS NULL`,
      [opportunityId],
    );
    if (!opp || !opp.account_id) return 0;

    // Get line items with products
    const lineItems = await this.dataSource.query(
      `SELECT oli.*, p.name as product_name, p.type as product_type
       FROM "${schemaName}".opportunity_line_items oli
       LEFT JOIN "${schemaName}".products p ON p.id = oli.product_id
       WHERE oli.opportunity_id = $1 AND oli.product_id IS NOT NULL
         AND oli.line_item_type != 'bundle_child'`,
      [opportunityId],
    );

    let created = 0;
    for (const item of lineItems) {
      // Skip if active subscription already exists for this account+product
      const [existing] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".account_subscriptions
         WHERE account_id = $1 AND product_id = $2 AND deleted_at IS NULL
           AND status IN ('active', 'trial')`,
        [opp.account_id, item.product_id],
      );
      if (existing) continue;

      const billingFreq = item.billing_frequency || 'one_time';
      const mrr = this.calculateMrr(
        parseFloat(item.unit_price) || 0,
        parseFloat(item.quantity) || 1,
        parseFloat(item.discount_percent) || 0,
        parseFloat(item.discount_amount) || 0,
        billingFreq,
      );

      // Default: 1 year subscription, renewal 60 days before end
      const startDate = new Date();
      const endDate = billingFreq === 'one_time' ? null : new Date(startDate);
      if (endDate) {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
      const renewalDate = endDate ? new Date(endDate) : null;
      if (renewalDate) {
        renewalDate.setDate(renewalDate.getDate() - 60);
      }

      await this.dataSource.query(
        `INSERT INTO "${schemaName}".account_subscriptions
         (account_id, product_id, status, billing_frequency, quantity, unit_price,
          discount_percent, discount_amount, mrr, currency,
          start_date, end_date, renewal_date, auto_renew,
          source_opportunity_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT ON CONSTRAINT idx_accsub_account_product_active DO NOTHING`,
        [
          opp.account_id, item.product_id,
          item.product_type === 'subscription' ? 'active' : 'active',
          billingFreq, parseFloat(item.quantity) || 1,
          parseFloat(item.unit_price) || 0,
          parseFloat(item.discount_percent) || 0,
          parseFloat(item.discount_amount) || 0,
          mrr, opp.currency || 'USD',
          startDate.toISOString().split('T')[0],
          endDate ? endDate.toISOString().split('T')[0] : null,
          renewalDate ? renewalDate.toISOString().split('T')[0] : null,
          billingFreq !== 'one_time',
          opportunityId, userId,
        ],
      );
      created++;
    }

    if (created > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'accounts', entityId: opp.account_id,
        activityType: 'subscriptions_from_opportunity',
        title: 'Subscriptions created from won opportunity',
        description: `${created} subscription(s) added from "${opp.name}"`,
        metadata: { opportunityId, count: created },
        performedBy: userId,
      });
    }

    return created;
  }

  // ════════════════════════════════════════════════════════════
  // SUBSCRIPTION SUMMARY (for account header)
  // ════════════════════════════════════════════════════════════

  async getSubscriptionSummary(schemaName: string, accountId: string) {
    const [summary] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') as active_count,
         COUNT(*) FILTER (WHERE status = 'trial') as trial_count,
         COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
         COALESCE(SUM(mrr) FILTER (WHERE status = 'active'), 0) as total_mrr,
         COALESCE(SUM(mrr) FILTER (WHERE status = 'expired'), 0) as lost_mrr,
         MIN(renewal_date) FILTER (WHERE status = 'active' AND renewal_date IS NOT NULL) as next_renewal_date,
         COUNT(*) FILTER (WHERE status = 'active' AND renewal_date <= CURRENT_DATE + INTERVAL '90 days') as renewals_in_90_days
       FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    return {
      activeCount: parseInt(summary.active_count) || 0,
      trialCount: parseInt(summary.trial_count) || 0,
      expiredCount: parseInt(summary.expired_count) || 0,
      cancelledCount: parseInt(summary.cancelled_count) || 0,
      totalMrr: parseFloat(summary.total_mrr) || 0,
      totalArr: (parseFloat(summary.total_mrr) || 0) * 12,
      lostMrr: parseFloat(summary.lost_mrr) || 0,
      nextRenewalDate: summary.next_renewal_date,
      renewalsIn90Days: parseInt(summary.renewals_in_90_days) || 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // RENEWALS — upcoming across all accounts
  // ════════════════════════════════════════════════════════════

  async getUpcomingRenewals(
    schemaName: string, daysAhead: number = 90, page: number = 1, limit: number = 20,
  ) {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".account_subscriptions
       WHERE deleted_at IS NULL AND status = 'active'
         AND renewal_date IS NOT NULL
         AND renewal_date <= CURRENT_DATE + $1 * INTERVAL '1 day'`,
      [daysAhead],
    );

    const rows = await this.dataSource.query(
      `SELECT s.*, p.name as product_name, p.code as product_code,
              a.name as account_name, a.logo_url as account_logo_url,
              u.first_name as owner_first_name, u.last_name as owner_last_name
       FROM "${schemaName}".account_subscriptions s
       LEFT JOIN "${schemaName}".products p ON s.product_id = p.id
       LEFT JOIN "${schemaName}".accounts a ON s.account_id = a.id
       LEFT JOIN "${schemaName}".users u ON a.owner_id = u.id
       WHERE s.deleted_at IS NULL AND s.status = 'active'
         AND s.renewal_date IS NOT NULL
         AND s.renewal_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
       ORDER BY s.renewal_date ASC
       LIMIT $2 OFFSET $3`,
      [daysAhead, limit, offset],
    );

    return {
      data: rows.map((r: any) => ({
        ...this.formatSubscription(r),
        accountName: r.account_name,
        accountLogoUrl: r.account_logo_url,
        ownerName: r.owner_first_name
          ? `${r.owner_first_name} ${r.owner_last_name}`.trim()
          : null,
        daysUntilRenewal: r.renewal_date
          ? Math.ceil((new Date(r.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      meta: {
        total: parseInt(count),
        page, limit,
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    };
  }

  // ════════════════════════════════════════════════════════════
  // PRODUCT USAGE METRICS — admin config per product
  // ════════════════════════════════════════════════════════════

  async getUsageMetrics(schemaName: string, productId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".product_usage_metrics
       WHERE product_id = $1 AND is_active = true
       ORDER BY sort_order ASC`,
      [productId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      metricKey: r.metric_key,
      metricLabel: r.metric_label,
      metricUnit: r.metric_unit,
      format: r.format,
      sortOrder: r.sort_order,
    }));
  }

  async saveUsageMetrics(schemaName: string, productId: string, metrics: any[]) {
    // Deactivate all existing, then upsert
    await this.dataSource.query(
      `UPDATE "${schemaName}".product_usage_metrics SET is_active = false WHERE product_id = $1`,
      [productId],
    );

    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".product_usage_metrics
         (product_id, metric_key, metric_label, metric_unit, format, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (product_id, metric_key) DO UPDATE SET
           metric_label = $3, metric_unit = $4, format = $5, sort_order = $6, is_active = true`,
        [productId, m.metricKey, m.metricLabel, m.metricUnit || '', m.format || 'number', i],
      );
    }
    return this.getUsageMetrics(schemaName, productId);
  }

  // ════════════════════════════════════════════════════════════
  // ACCOUNT USAGE SOURCES — per account+product config
  // ════════════════════════════════════════════════════════════

  async getUsageSource(schemaName: string, accountId: string, productId: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".account_usage_sources
       WHERE account_id = $1 AND product_id = $2`,
      [accountId, productId],
    );
    if (!row) return null;
    return this.formatUsageSource(row);
  }

  async saveUsageSource(schemaName: string, userId: string, data: any) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".account_usage_sources
       (account_id, product_id, source_type, api_url, api_method, api_headers,
        api_query_params, metric_mappings, poll_interval, is_active, webhook_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12)
       ON CONFLICT (account_id, product_id) DO UPDATE SET
         source_type = $3, api_url = $4, api_method = $5, api_headers = $6::jsonb,
         api_query_params = $7::jsonb, metric_mappings = $8::jsonb,
         poll_interval = $9, is_active = $10, webhook_key = $11, updated_at = NOW()
       RETURNING *`,
      [
        data.accountId, data.productId, data.sourceType || 'manual',
        data.apiUrl || null, data.apiMethod || 'GET',
        JSON.stringify(data.apiHeaders || {}),
        JSON.stringify(data.apiQueryParams || {}),
        JSON.stringify(data.metricMappings || {}),
        data.pollInterval || 'daily', data.isActive !== false,
        data.webhookKey || null, userId,
      ],
    );
    return this.formatUsageSource(row);
  }

  // ════════════════════════════════════════════════════════════
  // USAGE LOGS — ingest + query
  // ════════════════════════════════════════════════════════════

  async ingestUsageData(
    schemaName: string, accountId: string, productId: string,
    metrics: { metricKey: string; metricValue: number }[],
    source: string = 'api',
  ) {
    for (const m of metrics) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".product_usage_logs
         (account_id, product_id, metric_key, metric_value, source)
         VALUES ($1, $2, $3, $4, $5)`,
        [accountId, productId, m.metricKey, m.metricValue, source],
      );
    }

    // Update last_synced_at on usage source
    await this.dataSource.query(
      `UPDATE "${schemaName}".account_usage_sources
       SET last_synced_at = NOW(), last_sync_error = NULL
       WHERE account_id = $1 AND product_id = $2`,
      [accountId, productId],
    );

    return { ingested: metrics.length };
  }

  async getUsageLogs(
    schemaName: string, accountId: string, productId: string,
    days: number = 30,
  ) {
    const rows = await this.dataSource.query(
      `SELECT metric_key, metric_value, recorded_at, source
       FROM "${schemaName}".product_usage_logs
       WHERE account_id = $1 AND product_id = $2
         AND recorded_at >= NOW() - $3 * INTERVAL '1 day'
       ORDER BY recorded_at DESC`,
      [accountId, productId, days],
    );

    return rows.map((r: any) => ({
      metricKey: r.metric_key,
      metricValue: parseFloat(r.metric_value),
      recordedAt: r.recorded_at,
      source: r.source,
    }));
  }

  async getUsageSummary(schemaName: string, accountId: string, productId: string) {
    // Get latest value + previous period for each metric
    const rows = await this.dataSource.query(
      `WITH latest AS (
        SELECT DISTINCT ON (metric_key)
          metric_key, metric_value, recorded_at
        FROM "${schemaName}".product_usage_logs
        WHERE account_id = $1 AND product_id = $2
        ORDER BY metric_key, recorded_at DESC
      ),
      previous AS (
        SELECT DISTINCT ON (metric_key)
          metric_key, metric_value, recorded_at
        FROM "${schemaName}".product_usage_logs
        WHERE account_id = $1 AND product_id = $2
          AND recorded_at < (SELECT MIN(recorded_at) FROM latest) - INTERVAL '1 day'
        ORDER BY metric_key, recorded_at DESC
      )
      SELECT l.metric_key, l.metric_value as current_value, l.recorded_at as current_date,
             p.metric_value as previous_value, p.recorded_at as previous_date
      FROM latest l
      LEFT JOIN previous p ON l.metric_key = p.metric_key`,
      [accountId, productId],
    );

    return rows.map((r: any) => {
      const current = parseFloat(r.current_value) || 0;
      const previous = parseFloat(r.previous_value) || 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      return {
        metricKey: r.metric_key,
        currentValue: current,
        previousValue: previous,
        changePercent: Math.round(change * 10) / 10,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
        currentDate: r.current_date,
        previousDate: r.previous_date,
      };
    });
  }

  // ════════════════════════════════════════════════════════════
  // WEBHOOK RECEIVER — external systems push usage data
  // ════════════════════════════════════════════════════════════

  async handleUsageWebhook(schemaName: string, webhookKey: string, body: any) {
    const [source] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".account_usage_sources
       WHERE webhook_key = $1 AND is_active = true AND source_type = 'push_webhook'`,
      [webhookKey],
    );
    if (!source) throw new NotFoundException('Invalid webhook key');

    const mappings = typeof source.metric_mappings === 'string'
      ? JSON.parse(source.metric_mappings) : source.metric_mappings;

    const metrics: { metricKey: string; metricValue: number }[] = [];
    for (const [metricKey, jsonPath] of Object.entries(mappings)) {
      const value = this.extractJsonPath(body, jsonPath as string);
      if (value !== null && value !== undefined) {
        metrics.push({ metricKey, metricValue: Number(value) });
      }
    }

    if (metrics.length === 0) {
      throw new BadRequestException('No metrics could be extracted from the payload');
    }

    return this.ingestUsageData(schemaName, source.account_id, source.product_id, metrics, 'webhook');
  }

  // ════════════════════════════════════════════════════════════
  // ACCOUNT ASSOCIATIONS — leads, opportunities, invoices, projects
  // ════════════════════════════════════════════════════════════

  async getAccountLeads(schemaName: string, accountId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".leads
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    const rows = await this.dataSource.query(
      `SELECT l.id, l.first_name, l.last_name, l.email, l.company,
              l.created_at, l.owner_id,
              ps.name as stage_name, ps.color as stage_color,
              u.first_name as owner_first_name, u.last_name as owner_last_name
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".pipeline_stages ps ON l.stage_id = ps.id
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       WHERE l.account_id = $1 AND l.deleted_at IS NULL
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );

    const total = parseInt(count);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        company: r.company,
        stageName: r.stage_name,
        stageColor: r.stage_color,
        ownerName: r.owner_first_name
          ? `${r.owner_first_name} ${r.owner_last_name}`.trim()
          : null,
        createdAt: r.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAccountOpportunities(schemaName: string, accountId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".opportunities
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    const rows = await this.dataSource.query(
      `SELECT o.id, o.name, o.amount, o.currency, o.probability,
              o.close_date, o.created_at, o.owner_id,
              ps.name as stage_name, ps.color as stage_color,
              ps.is_won, ps.is_lost,
              u.first_name as owner_first_name, u.last_name as owner_last_name
       FROM "${schemaName}".opportunities o
       LEFT JOIN "${schemaName}".pipeline_stages ps ON o.stage_id = ps.id
       LEFT JOIN "${schemaName}".users u ON o.owner_id = u.id
       WHERE o.account_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );

    const total = parseInt(count);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        amount: parseFloat(r.amount) || 0,
        currency: r.currency,
        probability: parseInt(r.probability) || 0,
        stageName: r.stage_name,
        stageColor: r.stage_color,
        isWon: r.is_won || false,
        isLost: r.is_lost || false,
        closeDate: r.close_date,
        ownerName: r.owner_first_name
          ? `${r.owner_first_name} ${r.owner_last_name}`.trim()
          : null,
        createdAt: r.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAccountInvoices(schemaName: string, accountId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".invoices
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    const rows = await this.dataSource.query(
      `SELECT id, invoice_number, title, status, total_amount, amount_paid,
              amount_due, currency, issue_date, due_date, paid_at, created_at
       FROM "${schemaName}".invoices
       WHERE account_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );

    const total = parseInt(count);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        title: r.title,
        status: r.status,
        totalAmount: parseFloat(r.total_amount) || 0,
        amountPaid: parseFloat(r.amount_paid) || 0,
        amountDue: parseFloat(r.amount_due) || 0,
        currency: r.currency,
        issueDate: r.issue_date,
        dueDate: r.due_date,
        paidAt: r.paid_at,
        createdAt: r.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAccountProjects(schemaName: string, accountId: string, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".projects
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    const rows = await this.dataSource.query(
      `SELECT p.id, p.name, p.health_status, p.start_date, p.end_date,
              p.budget, p.created_at, p.owner_id,
              ps.name as status_name, ps.color as status_color,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              (SELECT COUNT(*) FROM "${schemaName}".project_tasks pt
               WHERE pt.project_id = p.id AND pt.deleted_at IS NULL) as task_count,
              (SELECT COUNT(*) FROM "${schemaName}".project_tasks pt
               WHERE pt.project_id = p.id AND pt.deleted_at IS NULL AND pt.status = 'completed') as completed_task_count
       FROM "${schemaName}".projects p
       LEFT JOIN "${schemaName}".project_statuses ps ON p.status_id = ps.id
       LEFT JOIN "${schemaName}".users u ON p.owner_id = u.id
       WHERE p.account_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );

    const total = parseInt(count);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        statusName: r.status_name,
        statusColor: r.status_color,
        healthStatus: r.health_status,
        startDate: r.start_date,
        endDate: r.end_date,
        budget: parseFloat(r.budget) || 0,
        ownerName: r.owner_first_name
          ? `${r.owner_first_name} ${r.owner_last_name}`.trim()
          : null,
        taskCount: parseInt(r.task_count) || 0,
        completedTaskCount: parseInt(r.completed_task_count) || 0,
        createdAt: r.created_at,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAccountTimeline(schemaName: string, accountId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Get activities directly on the account + activities on related entities
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM (
        SELECT id FROM "${schemaName}".activities
        WHERE entity_type = 'accounts' AND entity_id = $1
        UNION ALL
        SELECT a.id FROM "${schemaName}".activities a
        INNER JOIN "${schemaName}".leads l ON a.entity_type = 'leads' AND a.entity_id = l.id::text
        WHERE l.account_id = $1 AND l.deleted_at IS NULL
        UNION ALL
        SELECT a.id FROM "${schemaName}".activities a
        INNER JOIN "${schemaName}".opportunities o ON a.entity_type = 'opportunities' AND a.entity_id = o.id::text
        WHERE o.account_id = $1 AND o.deleted_at IS NULL
      ) combined`,
      [accountId],
    );

    const rows = await this.dataSource.query(
      `SELECT * FROM (
        SELECT id, entity_type, entity_id, activity_type, title, description,
               metadata, created_at, performed_by
        FROM "${schemaName}".activities
        WHERE entity_type = 'accounts' AND entity_id = $1
        UNION ALL
        SELECT a.id, a.entity_type, a.entity_id, a.activity_type, a.title, a.description,
               a.metadata, a.created_at, a.performed_by
        FROM "${schemaName}".activities a
        INNER JOIN "${schemaName}".leads l ON a.entity_type = 'leads' AND a.entity_id = l.id::text
        WHERE l.account_id = $1 AND l.deleted_at IS NULL
        UNION ALL
        SELECT a.id, a.entity_type, a.entity_id, a.activity_type, a.title, a.description,
               a.metadata, a.created_at, a.performed_by
        FROM "${schemaName}".activities a
        INNER JOIN "${schemaName}".opportunities o ON a.entity_type = 'opportunities' AND a.entity_id = o.id::text
        WHERE o.account_id = $1 AND o.deleted_at IS NULL
      ) combined
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );

    const total = parseInt(count);
    return {
      data: rows.map((r: any) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        activityType: r.activity_type,
        title: r.title,
        description: r.description,
        metadata: r.metadata,
        date: r.created_at,
        performedBy: r.performed_by,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomerJourney(schemaName: string, accountId: string) {
    const milestones: any[] = [];

    // 1. First lead
    const [firstLead] = await this.dataSource.query(
      `SELECT id, first_name, last_name, created_at
       FROM "${schemaName}".leads
       WHERE account_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [accountId],
    );
    if (firstLead) {
      milestones.push({
        stage: 'Lead',
        date: firstLead.created_at,
        name: `${firstLead.first_name} ${firstLead.last_name}`.trim(),
        entityId: firstLead.id,
      });
    }

    // 2. First opportunity
    const [firstOpp] = await this.dataSource.query(
      `SELECT id, name, amount, created_at
       FROM "${schemaName}".opportunities
       WHERE account_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [accountId],
    );
    if (firstOpp) {
      milestones.push({
        stage: 'Opportunity',
        date: firstOpp.created_at,
        name: firstOpp.name,
        amount: parseFloat(firstOpp.amount) || 0,
        entityId: firstOpp.id,
      });
    }

    // 3. First won opportunity
    const [firstWon] = await this.dataSource.query(
      `SELECT o.id, o.name, o.amount, o.updated_at
       FROM "${schemaName}".opportunities o
       INNER JOIN "${schemaName}".pipeline_stages ps ON o.stage_id = ps.id
       WHERE o.account_id = $1 AND o.deleted_at IS NULL AND ps.is_won = true
       ORDER BY o.updated_at ASC LIMIT 1`,
      [accountId],
    );
    if (firstWon) {
      milestones.push({
        stage: 'Deal Won',
        date: firstWon.updated_at,
        name: firstWon.name,
        amount: parseFloat(firstWon.amount) || 0,
        entityId: firstWon.id,
      });
    }

    // 4. First project
    const [firstProject] = await this.dataSource.query(
      `SELECT id, name, created_at
       FROM "${schemaName}".projects
       WHERE account_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [accountId],
    );
    if (firstProject) {
      milestones.push({
        stage: 'Project',
        date: firstProject.created_at,
        name: firstProject.name,
        entityId: firstProject.id,
      });
    }

    // 5. First invoice paid
    const [firstPaid] = await this.dataSource.query(
      `SELECT id, invoice_number, total_amount, paid_at
       FROM "${schemaName}".invoices
       WHERE account_id = $1 AND deleted_at IS NULL AND paid_at IS NOT NULL
       ORDER BY paid_at ASC LIMIT 1`,
      [accountId],
    );
    if (firstPaid) {
      milestones.push({
        stage: 'Revenue',
        date: firstPaid.paid_at,
        amount: parseFloat(firstPaid.total_amount) || 0,
        entityId: firstPaid.id,
      });
    }

    // 6. Next renewal from subscriptions
    const [nextRenewal] = await this.dataSource.query(
      `SELECT s.id, s.renewal_date, s.mrr, p.name as product_name
       FROM "${schemaName}".account_subscriptions s
       LEFT JOIN "${schemaName}".products p ON s.product_id = p.id
       WHERE s.account_id = $1 AND s.deleted_at IS NULL
         AND s.status = 'active' AND s.renewal_date IS NOT NULL
         AND s.renewal_date >= CURRENT_DATE
       ORDER BY s.renewal_date ASC LIMIT 1`,
      [accountId],
    );
    if (nextRenewal) {
      milestones.push({
        stage: 'Renewal',
        date: nextRenewal.renewal_date,
        name: nextRenewal.product_name,
        amount: (parseFloat(nextRenewal.mrr) || 0) * 12,
        entityId: nextRenewal.id,
        isFuture: true,
      });
    }

    // Sort chronologically
    milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return milestones;
  }

  async getRevenueTrend(schemaName: string, accountId: string, months = 12) {
    const rows = await this.dataSource.query(
      `WITH months AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE) - ($2 - 1) * INTERVAL '1 month',
          date_trunc('month', CURRENT_DATE),
          '1 month'
        )::date as month
      ),
      invoice_revenue AS (
        SELECT date_trunc('month', paid_at)::date as month,
               COALESCE(SUM(total_amount), 0) as revenue
        FROM "${schemaName}".invoices
        WHERE account_id = $1 AND deleted_at IS NULL AND paid_at IS NOT NULL
          AND paid_at >= date_trunc('month', CURRENT_DATE) - ($2 - 1) * INTERVAL '1 month'
        GROUP BY date_trunc('month', paid_at)
      ),
      subscription_mrr AS (
        SELECT COALESCE(SUM(mrr), 0) as mrr
        FROM "${schemaName}".account_subscriptions
        WHERE account_id = $1 AND deleted_at IS NULL AND status = 'active'
      )
      SELECT to_char(m.month, 'YYYY-MM') as month,
             COALESCE(ir.revenue, 0) as revenue,
             smrr.mrr as mrr
      FROM months m
      LEFT JOIN invoice_revenue ir ON m.month = ir.month
      CROSS JOIN subscription_mrr smrr
      ORDER BY m.month ASC`,
      [accountId, months],
    );

    return rows.map((r: any) => ({
      month: r.month,
      revenue: parseFloat(r.revenue) || 0,
      mrr: parseFloat(r.mrr) || 0,
    }));
  }

  // ════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════

  private calculateMrr(
    unitPrice: number, quantity: number,
    discountPercent: number, discountAmount: number,
    billingFrequency: string,
  ): number {
    let total = unitPrice * quantity;
    if (discountPercent > 0) total -= total * (discountPercent / 100);
    if (discountAmount > 0) total -= discountAmount;
    total = Math.max(0, total);

    switch (billingFrequency) {
      case 'annually': return Math.round((total / 12) * 100) / 100;
      case 'quarterly': return Math.round((total / 3) * 100) / 100;
      case 'monthly': return total;
      case 'weekly': return Math.round(total * 4.33 * 100) / 100;
      case 'one_time': return 0;
      default: return total;
    }
  }

  private extractJsonPath(obj: any, path: string): any {
    // Simple JSON path: $.data.activeUsers → obj.data.activeUsers
    const parts = path.replace(/^\$\.?/, '').split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return null;
      current = current[part];
    }
    return current;
  }

  private formatSubscription(r: any) {
    const renewalDate = r.renewal_date ? new Date(r.renewal_date) : null;
    const daysUntilRenewal = renewalDate
      ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: r.id,
      accountId: r.account_id,
      productId: r.product_id,
      productName: r.product_name || null,
      productCode: r.product_code || null,
      productType: r.product_type || null,
      productImageUrl: r.product_image_url || null,
      status: r.status,
      billingFrequency: r.billing_frequency,
      quantity: parseFloat(r.quantity) || 1,
      unitPrice: parseFloat(r.unit_price) || 0,
      discountPercent: parseFloat(r.discount_percent) || 0,
      discountAmount: parseFloat(r.discount_amount) || 0,
      mrr: parseFloat(r.mrr) || 0,
      arr: (parseFloat(r.mrr) || 0) * 12,
      currency: r.currency,
      startDate: r.start_date,
      endDate: r.end_date,
      renewalDate: r.renewal_date,
      daysUntilRenewal,
      renewalUrgency: daysUntilRenewal === null ? null
        : daysUntilRenewal < 0 ? 'overdue'
        : daysUntilRenewal <= 30 ? 'urgent'
        : daysUntilRenewal <= 90 ? 'upcoming'
        : 'ok',
      autoRenew: r.auto_renew,
      renewalReminderDays: r.renewal_reminder_days,
      sourceOpportunityId: r.source_opportunity_id,
      sourceInvoiceId: r.source_invoice_id,
      sourceContractId: r.source_contract_id,
      notes: r.notes,
      customFields: r.custom_fields,
      usageSourceType: r.usage_source_type || null,
      usageLastSyncedAt: r.usage_last_synced_at || null,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      cancelledAt: r.cancelled_at,
    };
  }

  private formatUsageSource(r: any) {
    return {
      id: r.id,
      accountId: r.account_id,
      productId: r.product_id,
      sourceType: r.source_type,
      apiUrl: r.api_url,
      apiMethod: r.api_method,
      apiHeaders: r.api_headers,
      apiQueryParams: r.api_query_params,
      metricMappings: r.metric_mappings,
      pollInterval: r.poll_interval,
      isActive: r.is_active,
      webhookKey: r.webhook_key,
      lastSyncedAt: r.last_synced_at,
      lastSyncError: r.last_sync_error,
    };
  }
}
