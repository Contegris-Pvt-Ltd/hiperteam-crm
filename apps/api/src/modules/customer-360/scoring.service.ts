// ============================================================
// FILE: apps/api/src/modules/customer-360/scoring.service.ts
// ============================================================
// Calculates health score, churn risk, CLTV, engagement score,
// and upsell suggestions for each account.
// Runs on-demand or via cron.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface HealthFactor {
  key: string;
  label: string;
  weight: number;
}

interface HealthConfig {
  factors: HealthFactor[];
  thresholds: { healthy: number; at_risk: number };
}

interface ChurnSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

interface UpsellSuggestion {
  productId: string;
  productName: string;
  score: number;
  reasons: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ════════════════════════════════════════════════════════════
  // MAIN: Calculate all scores for an account
  // ════════════════════════════════════════════════════════════

  async calculateScores(schemaName: string, accountId: string): Promise<void> {
    const config = await this.getHealthConfig(schemaName);

    const [healthScore, healthBreakdown] = await this.calculateHealthScore(schemaName, accountId, config);
    const healthStatus = healthScore >= config.thresholds.healthy ? 'healthy'
      : healthScore >= config.thresholds.at_risk ? 'at_risk' : 'critical';

    const churnSignals = await this.detectChurnSignals(schemaName, accountId);
    const churnRisk = this.assessChurnRisk(churnSignals);

    const cltv = await this.calculateCltv(schemaName, accountId);
    const engagementScore = await this.calculateEngagementScore(schemaName, accountId);
    const upsellSuggestions = await this.calculateUpsellSuggestions(schemaName, accountId);
    const upsellScore = upsellSuggestions.length > 0
      ? Math.max(...upsellSuggestions.map(s => s.score)) : 0;

    // Get subscription stats
    const [subStats] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(mrr) FILTER (WHERE status = 'active'), 0) as total_mrr,
         COUNT(*) FILTER (WHERE status = 'active') as active_subs,
         MIN(renewal_date) FILTER (WHERE status = 'active' AND renewal_date IS NOT NULL) as next_renewal
       FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    // Get last activity timestamps
    const [activity] = await this.dataSource.query(
      `SELECT
         MAX(created_at) as last_activity_at
       FROM "${schemaName}".activities
       WHERE entity_type = 'accounts' AND entity_id = $1`,
      [accountId],
    ).catch(() => [{ last_activity_at: null }]);

    const totalMrr = parseFloat(subStats?.total_mrr) || 0;

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".customer_scores
       (account_id, health_score, health_status, health_breakdown,
        cltv, churn_risk, churn_signals, upsell_score, upsell_suggestions,
        engagement_score, total_mrr, total_arr, active_subscriptions,
        next_renewal_date, last_activity_at, last_calculated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (account_id) DO UPDATE SET
         health_score=$2, health_status=$3, health_breakdown=$4::jsonb,
         cltv=$5, churn_risk=$6, churn_signals=$7::jsonb,
         upsell_score=$8, upsell_suggestions=$9::jsonb,
         engagement_score=$10, total_mrr=$11, total_arr=$12,
         active_subscriptions=$13, next_renewal_date=$14,
         last_activity_at=$15, last_calculated_at=NOW(), updated_at=NOW()`,
      [
        accountId, healthScore, healthStatus, JSON.stringify(healthBreakdown),
        cltv, churnRisk, JSON.stringify(churnSignals),
        upsellScore, JSON.stringify(upsellSuggestions),
        engagementScore, totalMrr, totalMrr * 12,
        parseInt(subStats?.active_subs) || 0,
        subStats?.next_renewal || null,
        activity?.last_activity_at || null,
      ],
    );
  }

  // ════════════════════════════════════════════════════════════
  // GET SCORES (read from materialized table)
  // ════════════════════════════════════════════════════════════

  async getScores(schemaName: string, accountId: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".customer_scores WHERE account_id = $1`,
      [accountId],
    );
    if (!row) return null;
    return this.formatScores(row);
  }

  // ════════════════════════════════════════════════════════════
  // BULK: Recalculate all accounts
  // ════════════════════════════════════════════════════════════

  async recalculateAll(schemaName: string): Promise<number> {
    const accounts = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".accounts WHERE deleted_at IS NULL AND status = 'active'`,
    );

    let count = 0;
    for (const acc of accounts) {
      try {
        await this.calculateScores(schemaName, acc.id);
        count++;
      } catch (err: any) {
        this.logger.warn(`Scoring failed for account ${acc.id}: ${err.message}`);
      }
    }
    return count;
  }

  // ════════════════════════════════════════════════════════════
  // HEALTH SCORE
  // ════════════════════════════════════════════════════════════

  private async calculateHealthScore(
    schemaName: string, accountId: string, config: HealthConfig,
  ): Promise<[number, Record<string, { score: number; weight: number }>]> {
    const breakdown: Record<string, { score: number; weight: number }> = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const factor of config.factors) {
      let score = 50; // default neutral

      switch (factor.key) {
        case 'payment_health':
          score = await this.scorePaymentHealth(schemaName, accountId);
          break;
        case 'engagement':
          score = await this.scoreEngagement(schemaName, accountId);
          break;
        case 'product_usage':
          score = await this.scoreProductUsage(schemaName, accountId);
          break;
        case 'support_health':
          score = await this.scoreSupportHealth(schemaName, accountId);
          break;
        case 'relationship':
          score = await this.scoreRelationship(schemaName, accountId);
          break;
        case 'contract_status':
          score = await this.scoreContractStatus(schemaName, accountId);
          break;
        default:
          score = 50;
      }

      breakdown[factor.key] = { score, weight: factor.weight };
      totalWeightedScore += score * factor.weight;
      totalWeight += factor.weight;
    }

    const finalScore = totalWeight > 0
      ? Math.round(totalWeightedScore / totalWeight) : 0;

    return [finalScore, breakdown];
  }

  private async scorePaymentHealth(schemaName: string, accountId: string): Promise<number> {
    // Check invoices: overdue count, avg payment speed
    const [stats] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
         COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
         COUNT(*) as total_count
       FROM "${schemaName}".invoices
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    ).catch(() => [{ overdue_count: 0, paid_count: 0, total_count: 0 }]);

    const overdue = parseInt(stats.overdue_count) || 0;
    const paid = parseInt(stats.paid_count) || 0;
    const total = parseInt(stats.total_count) || 0;

    if (total === 0) return 70; // No invoices = neutral-positive
    if (overdue >= 3) return 15;
    if (overdue === 2) return 30;
    if (overdue === 1) return 55;

    // All paid on time
    const payRate = total > 0 ? (paid / total) * 100 : 70;
    return Math.min(100, Math.round(payRate));
  }

  private async scoreEngagement(schemaName: string, accountId: string): Promise<number> {
    // Recent activities, emails, notes
    const [stats] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30d,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days') as last_90d,
         MAX(created_at) as last_activity
       FROM "${schemaName}".activities
       WHERE entity_type = 'accounts' AND entity_id = $1`,
      [accountId],
    ).catch(() => [{ last_7d: 0, last_30d: 0, last_90d: 0, last_activity: null }]);

    const last7d = parseInt(stats.last_7d) || 0;
    const last30d = parseInt(stats.last_30d) || 0;

    if (!stats.last_activity) return 20; // No activity ever
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(stats.last_activity).getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceActivity > 60) return 15;
    if (daysSinceActivity > 30) return 35;
    if (daysSinceActivity > 14) return 55;
    if (last7d >= 3) return 95;
    if (last30d >= 5) return 80;
    return 65;
  }

  private async scoreProductUsage(schemaName: string, accountId: string): Promise<number> {
    // Check recent usage logs — are metrics trending up or down?
    const rows = await this.dataSource.query(
      `SELECT metric_key,
         AVG(metric_value) FILTER (WHERE recorded_at >= NOW() - INTERVAL '30 days') as current_avg,
         AVG(metric_value) FILTER (WHERE recorded_at < NOW() - INTERVAL '30 days'
                                     AND recorded_at >= NOW() - INTERVAL '60 days') as previous_avg
       FROM "${schemaName}".product_usage_logs
       WHERE account_id = $1 AND recorded_at >= NOW() - INTERVAL '60 days'
       GROUP BY metric_key`,
      [accountId],
    ).catch(() => []);

    if (rows.length === 0) return 50; // No usage data

    let trendScore = 0;
    let count = 0;
    for (const r of rows) {
      const current = parseFloat(r.current_avg) || 0;
      const previous = parseFloat(r.previous_avg) || 0;
      if (previous > 0) {
        const change = ((current - previous) / previous) * 100;
        if (change > 20) trendScore += 95;
        else if (change > 5) trendScore += 80;
        else if (change > -5) trendScore += 65;
        else if (change > -20) trendScore += 40;
        else trendScore += 20;
      } else {
        trendScore += current > 0 ? 70 : 30;
      }
      count++;
    }

    return count > 0 ? Math.round(trendScore / count) : 50;
  }

  private async scoreSupportHealth(schemaName: string, accountId: string): Promise<number> {
    // Check tasks tagged as support or tickets
    const [stats] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE completed_at IS NULL AND deleted_at IS NULL) as open_tasks,
         COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND deleted_at IS NULL
                          AND created_at >= NOW() - INTERVAL '90 days') as resolved_90d
       FROM "${schemaName}".tasks
       WHERE (description ILIKE '%support%' OR description ILIKE '%ticket%' OR description ILIKE '%issue%')
         AND (
           owner_id IN (SELECT id FROM "${schemaName}".users)
           OR assigned_to IN (SELECT id FROM "${schemaName}".users)
         )
         AND entity_type = 'accounts' AND entity_id = $1`,
      [accountId],
    ).catch(() => [{ open_tasks: 0, resolved_90d: 0 }]);

    const openTasks = parseInt(stats.open_tasks) || 0;
    const resolved = parseInt(stats.resolved_90d) || 0;

    if (openTasks === 0 && resolved === 0) return 80; // No issues = healthy
    if (openTasks >= 5) return 20;
    if (openTasks >= 3) return 40;
    if (openTasks >= 1) return 60;
    return Math.min(95, 70 + resolved); // Resolved issues show engagement
  }

  private async scoreRelationship(schemaName: string, accountId: string): Promise<number> {
    // Contact depth + recent notes
    const [contactStats] = await this.dataSource.query(
      `SELECT COUNT(*) as contact_count
       FROM "${schemaName}".contact_accounts
       WHERE account_id = $1`,
      [accountId],
    ).catch(() => [{ contact_count: 0 }]);

    const [noteStats] = await this.dataSource.query(
      `SELECT COUNT(*) as note_count
       FROM "${schemaName}".notes
       WHERE entity_type = 'accounts' AND entity_id = $1
         AND created_at >= NOW() - INTERVAL '90 days'`,
      [accountId],
    ).catch(() => [{ note_count: 0 }]);

    const contacts = parseInt(contactStats.contact_count) || 0;
    const recentNotes = parseInt(noteStats.note_count) || 0;

    let score = 30; // baseline
    if (contacts >= 3) score += 30;
    else if (contacts >= 1) score += 15;
    if (recentNotes >= 5) score += 30;
    else if (recentNotes >= 2) score += 20;
    else if (recentNotes >= 1) score += 10;

    return Math.min(100, score);
  }

  private async scoreContractStatus(schemaName: string, accountId: string): Promise<number> {
    // Active subscriptions + renewal proximity
    const [stats] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'expired') as expired,
         MIN(renewal_date) FILTER (WHERE status = 'active' AND renewal_date IS NOT NULL) as next_renewal
       FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND deleted_at IS NULL`,
      [accountId],
    );

    const active = parseInt(stats.active) || 0;
    const expired = parseInt(stats.expired) || 0;

    if (active === 0 && expired === 0) return 50; // No subscriptions
    if (active === 0 && expired > 0) return 15; // All expired

    let score = 70;
    if (expired > 0) score -= expired * 10; // Penalty for expired

    // Renewal proximity bonus/penalty
    if (stats.next_renewal) {
      const daysUntil = Math.ceil(
        (new Date(stats.next_renewal).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil < 0) score -= 20; // Overdue
      else if (daysUntil < 30) score -= 5;
      else score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // ════════════════════════════════════════════════════════════
  // CHURN DETECTION
  // ════════════════════════════════════════════════════════════

  private async detectChurnSignals(schemaName: string, accountId: string): Promise<ChurnSignal[]> {
    const signals: ChurnSignal[] = [];

    // 1. Overdue invoices
    const [invoiceStats] = await this.dataSource.query(
      `SELECT COUNT(*) as overdue_count,
              SUM(amount_due) as overdue_amount
       FROM "${schemaName}".invoices
       WHERE account_id = $1 AND status = 'overdue' AND deleted_at IS NULL`,
      [accountId],
    ).catch(() => [{ overdue_count: 0, overdue_amount: 0 }]);

    const overdueCount = parseInt(invoiceStats.overdue_count) || 0;
    if (overdueCount > 0) {
      signals.push({
        type: 'overdue_invoices',
        severity: overdueCount >= 3 ? 'high' : overdueCount >= 2 ? 'medium' : 'low',
        message: `${overdueCount} overdue invoice(s) totaling $${parseFloat(invoiceStats.overdue_amount || 0).toFixed(0)}`,
      });
    }

    // 2. Expired subscriptions
    const [expiredSubs] = await this.dataSource.query(
      `SELECT COUNT(*) as count, SUM(mrr) as lost_mrr
       FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND status = 'expired' AND deleted_at IS NULL`,
      [accountId],
    );
    if (parseInt(expiredSubs.count) > 0) {
      signals.push({
        type: 'expired_subscriptions',
        severity: 'medium',
        message: `${expiredSubs.count} expired subscription(s) — $${parseFloat(expiredSubs.lost_mrr || 0).toFixed(0)}/mo lost`,
      });
    }

    // 3. No recent activity
    const [lastActivity] = await this.dataSource.query(
      `SELECT MAX(created_at) as last_at
       FROM "${schemaName}".activities
       WHERE entity_type = 'accounts' AND entity_id = $1`,
      [accountId],
    ).catch(() => [{ last_at: null }]);

    if (lastActivity.last_at) {
      const daysSince = Math.floor(
        (Date.now() - new Date(lastActivity.last_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince > 60) {
        signals.push({
          type: 'no_engagement',
          severity: 'high',
          message: `No activity in ${daysSince} days`,
        });
      } else if (daysSince > 30) {
        signals.push({
          type: 'low_engagement',
          severity: 'medium',
          message: `No activity in ${daysSince} days`,
        });
      }
    }

    // 4. Declining usage
    const usageRows = await this.dataSource.query(
      `SELECT metric_key,
         AVG(metric_value) FILTER (WHERE recorded_at >= NOW() - INTERVAL '30 days') as current_avg,
         AVG(metric_value) FILTER (WHERE recorded_at < NOW() - INTERVAL '30 days'
                                     AND recorded_at >= NOW() - INTERVAL '60 days') as previous_avg
       FROM "${schemaName}".product_usage_logs
       WHERE account_id = $1 AND recorded_at >= NOW() - INTERVAL '60 days'
       GROUP BY metric_key`,
      [accountId],
    ).catch(() => []);

    for (const r of usageRows) {
      const current = parseFloat(r.current_avg) || 0;
      const previous = parseFloat(r.previous_avg) || 0;
      if (previous > 0) {
        const change = ((current - previous) / previous) * 100;
        if (change < -30) {
          signals.push({
            type: 'usage_decline',
            severity: 'high',
            message: `${r.metric_key} dropped ${Math.abs(Math.round(change))}% month-over-month`,
          });
        } else if (change < -15) {
          signals.push({
            type: 'usage_decline',
            severity: 'medium',
            message: `${r.metric_key} declined ${Math.abs(Math.round(change))}% month-over-month`,
          });
        }
      }
    }

    // 5. Renewal overdue
    const overdueRenewals = await this.dataSource.query(
      `SELECT p.name as product_name,
              CURRENT_DATE - s.renewal_date as days_overdue
       FROM "${schemaName}".account_subscriptions s
       LEFT JOIN "${schemaName}".products p ON s.product_id = p.id
       WHERE s.account_id = $1 AND s.status = 'active' AND s.deleted_at IS NULL
         AND s.renewal_date < CURRENT_DATE`,
      [accountId],
    );

    for (const r of overdueRenewals) {
      signals.push({
        type: 'renewal_overdue',
        severity: parseInt(r.days_overdue) > 30 ? 'high' : 'medium',
        message: `${r.product_name} renewal overdue by ${r.days_overdue} days`,
      });
    }

    return signals;
  }

  private assessChurnRisk(signals: ChurnSignal[]): string {
    const highCount = signals.filter(s => s.severity === 'high').length;
    const mediumCount = signals.filter(s => s.severity === 'medium').length;

    if (highCount >= 2 || (highCount >= 1 && mediumCount >= 2)) return 'high';
    if (highCount >= 1 || mediumCount >= 2) return 'medium';
    if (mediumCount >= 1 || signals.length > 0) return 'low';
    return 'none';
  }

  // ════════════════════════════════════════════════════════════
  // CLTV (Customer Lifetime Value)
  // ════════════════════════════════════════════════════════════

  private async calculateCltv(schemaName: string, accountId: string): Promise<number> {
    // CLTV = Total revenue to date + (Current MRR × estimated remaining months)
    const [revenue] = await this.dataSource.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue
       FROM "${schemaName}".invoices
       WHERE account_id = $1 AND status IN ('paid', 'partially_paid') AND deleted_at IS NULL`,
      [accountId],
    ).catch(() => [{ total_revenue: 0 }]);

    const [mrr] = await this.dataSource.query(
      `SELECT COALESCE(SUM(mrr), 0) as current_mrr
       FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [accountId],
    );

    const totalRevenue = parseFloat(revenue.total_revenue) || 0;
    const currentMrr = parseFloat(mrr.current_mrr) || 0;

    // Estimate 24 months forward for active subscriptions
    const projectedRevenue = currentMrr * 24;

    return Math.round((totalRevenue + projectedRevenue) * 100) / 100;
  }

  // ════════════════════════════════════════════════════════════
  // ENGAGEMENT SCORE (0-100)
  // ════════════════════════════════════════════════════════════

  private async calculateEngagementScore(schemaName: string, accountId: string): Promise<number> {
    return this.scoreEngagement(schemaName, accountId);
  }

  // ════════════════════════════════════════════════════════════
  // UPSELL SUGGESTIONS
  // ════════════════════════════════════════════════════════════

  private async calculateUpsellSuggestions(
    schemaName: string, accountId: string,
  ): Promise<UpsellSuggestion[]> {
    // Get account details
    const [account] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".accounts WHERE id = $1 AND deleted_at IS NULL`,
      [accountId],
    );
    if (!account) return [];

    // Get current product IDs
    const currentProducts = await this.dataSource.query(
      `SELECT product_id FROM "${schemaName}".account_subscriptions
       WHERE account_id = $1 AND status IN ('active', 'trial') AND deleted_at IS NULL`,
      [accountId],
    );
    const currentProductIds = new Set(currentProducts.map((r: any) => r.product_id));

    // Get all active recommendations
    const recommendations = await this.dataSource.query(
      `SELECT r.*, p.name as product_name, p.code as product_code
       FROM "${schemaName}".product_recommendations r
       LEFT JOIN "${schemaName}".products p ON r.product_id = p.id
       WHERE r.is_active = true AND p.status = 'active' AND p.deleted_at IS NULL`,
    );

    const suggestions: UpsellSuggestion[] = [];

    for (const rec of recommendations) {
      // Skip if already has this product
      if (currentProductIds.has(rec.product_id)) continue;

      // Check prerequisites
      const prereqs: string[] = rec.prerequisites || [];
      if (prereqs.length > 0 && !prereqs.every((id: string) => currentProductIds.has(id))) continue;

      // Check exclusions
      const exclusions: string[] = rec.exclusions || [];
      if (exclusions.some((id: string) => currentProductIds.has(id))) continue;

      let score = rec.base_score || 50;
      const reasons: string[] = [];

      // Check ideal company size
      if (rec.ideal_min_size && account.company_size) {
        const size = this.parseCompanySize(account.company_size);
        if (size >= (rec.ideal_min_size || 0) && size <= (rec.ideal_max_size || 999999)) {
          score += 5;
          reasons.push('Company size matches ideal profile');
        }
      }

      // Check ideal industries
      const idealIndustries: string[] = rec.ideal_industries || [];
      if (idealIndustries.length > 0 && account.industry) {
        if (idealIndustries.some((ind: string) => ind.toLowerCase() === account.industry.toLowerCase())) {
          score += 5;
          reasons.push(`Industry "${account.industry}" is a strong fit`);
        }
      }

      // Evaluate trigger signals
      const triggerSignals = typeof rec.trigger_signals === 'string'
        ? JSON.parse(rec.trigger_signals) : (rec.trigger_signals || []);

      for (const signal of triggerSignals) {
        const triggered = await this.evaluateTriggerSignal(schemaName, accountId, signal);
        if (triggered) {
          score += signal.weight || 10;
          reasons.push(triggered);
        }
      }

      score = Math.min(100, Math.max(0, score));

      if (score >= 40) { // Only suggest if score is meaningful
        suggestions.push({
          productId: rec.product_id,
          productName: rec.product_name,
          score,
          reasons,
        });
      }
    }

    // Sort by score descending, return top 5
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private async evaluateTriggerSignal(
    schemaName: string, accountId: string, signal: any,
  ): Promise<string | null> {
    switch (signal.type) {
      case 'renewal_within_days': {
        const [row] = await this.dataSource.query(
          `SELECT MIN(renewal_date) as next_renewal
           FROM "${schemaName}".account_subscriptions
           WHERE account_id = $1 AND status = 'active' AND deleted_at IS NULL
             AND renewal_date IS NOT NULL`,
          [accountId],
        );
        if (row?.next_renewal) {
          const days = Math.ceil(
            (new Date(row.next_renewal).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          if (days <= (signal.value || 90)) {
            return `Renewal coming up in ${days} days — natural buying moment`;
          }
        }
        return null;
      }

      case 'revenue_growth_percent': {
        const [rev] = await this.dataSource.query(
          `SELECT
             COALESCE(SUM(total_amount) FILTER (WHERE issue_date >= NOW() - INTERVAL '90 days'), 0) as recent,
             COALESCE(SUM(total_amount) FILTER (WHERE issue_date < NOW() - INTERVAL '90 days'
                                                  AND issue_date >= NOW() - INTERVAL '180 days'), 0) as previous
           FROM "${schemaName}".invoices
           WHERE account_id = $1 AND status IN ('paid', 'partially_paid') AND deleted_at IS NULL`,
          [accountId],
        ).catch(() => [{ recent: 0, previous: 0 }]);

        const recent = parseFloat(rev.recent) || 0;
        const previous = parseFloat(rev.previous) || 0;
        if (previous > 0) {
          const growth = ((recent - previous) / previous) * 100;
          if (growth >= (signal.value || 10)) {
            return `Revenue grew ${Math.round(growth)}% — account is expanding`;
          }
        }
        return null;
      }

      case 'usage_metric_above': {
        const [usage] = await this.dataSource.query(
          `SELECT AVG(metric_value) as avg_value
           FROM "${schemaName}".product_usage_logs
           WHERE account_id = $1 AND metric_key = $2
             AND recorded_at >= NOW() - INTERVAL '30 days'`,
          [accountId, signal.metric],
        ).catch(() => [{ avg_value: 0 }]);

        if ((parseFloat(usage.avg_value) || 0) >= (signal.threshold || 0)) {
          return `${signal.metric} averaging ${Math.round(parseFloat(usage.avg_value))} (above ${signal.threshold} threshold)`;
        }
        return null;
      }

      case 'subscription_expired': {
        const [exp] = await this.dataSource.query(
          `SELECT COUNT(*) as count
           FROM "${schemaName}".account_subscriptions
           WHERE account_id = $1 AND status = 'expired' AND deleted_at IS NULL`,
          [accountId],
        );
        if (parseInt(exp.count) > 0) {
          return `${exp.count} expired subscription(s) — re-engagement opportunity`;
        }
        return null;
      }

      default:
        return null;
    }
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  private async getHealthConfig(schemaName: string): Promise<HealthConfig> {
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".module_settings
       WHERE module = 'customer_360' AND setting_key = 'health_score_config'`,
    ).catch(() => [null]);

    if (row?.setting_value) {
      return typeof row.setting_value === 'string'
        ? JSON.parse(row.setting_value) : row.setting_value;
    }

    // Default config
    return {
      factors: [
        { key: 'payment_health', label: 'Payment Health', weight: 25 },
        { key: 'engagement', label: 'Engagement', weight: 20 },
        { key: 'product_usage', label: 'Product Usage', weight: 20 },
        { key: 'support_health', label: 'Support Health', weight: 15 },
        { key: 'relationship', label: 'Relationship', weight: 10 },
        { key: 'contract_status', label: 'Contract Status', weight: 10 },
      ],
      thresholds: { healthy: 70, at_risk: 40 },
    };
  }

  private parseCompanySize(size: string): number {
    // Parse ranges like "11-50", "51-200", "201-500"
    const match = size.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private formatScores(r: any) {
    return {
      accountId: r.account_id,
      healthScore: r.health_score,
      healthStatus: r.health_status,
      healthBreakdown: r.health_breakdown,
      cltv: parseFloat(r.cltv) || 0,
      churnRisk: r.churn_risk,
      churnSignals: r.churn_signals,
      upsellScore: r.upsell_score,
      upsellSuggestions: r.upsell_suggestions,
      engagementScore: r.engagement_score,
      totalMrr: parseFloat(r.total_mrr) || 0,
      totalArr: parseFloat(r.total_arr) || 0,
      activeSubscriptions: r.active_subscriptions,
      nextRenewalDate: r.next_renewal_date,
      lastActivityAt: r.last_activity_at,
      lastCalculatedAt: r.last_calculated_at,
    };
  }
}
