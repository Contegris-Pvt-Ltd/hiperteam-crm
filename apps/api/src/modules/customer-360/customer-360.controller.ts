// ============================================================
// FILE: apps/api/src/modules/customer-360/customer-360.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Customer360Service } from './customer-360.service';
import { ScoringService } from './scoring.service';

@ApiTags('Customer 360')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('customer-360')
export class Customer360Controller {
  constructor(
    private readonly service: Customer360Service,
    private readonly scoringService: ScoringService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // SUBSCRIPTIONS
  // ════════════════════════════════════════════════════════════

  @Get('accounts/:accountId/subscriptions')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get all subscriptions for an account' })
  async getSubscriptions(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
  ) {
    return this.service.getSubscriptions(req.user.tenantSchema, accountId);
  }

  @Get('accounts/:accountId/subscriptions/summary')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get subscription summary (MRR, ARR, counts)' })
  async getSubscriptionSummary(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
  ) {
    return this.service.getSubscriptionSummary(req.user.tenantSchema, accountId);
  }

  @Post('accounts/:accountId/subscriptions')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Manually add a subscription to an account' })
  async createSubscription(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Body() body: any,
  ) {
    return this.service.createSubscription(
      req.user.tenantSchema, req.user.sub, { ...body, accountId },
    );
  }

  @Put('subscriptions/:id')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Update a subscription' })
  async updateSubscription(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.service.updateSubscription(req.user.tenantSchema, id, req.user.sub, body);
  }

  @Delete('subscriptions/:id')
  @RequirePermission('accounts', 'delete')
  @ApiOperation({ summary: 'Delete a subscription' })
  async deleteSubscription(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    await this.service.deleteSubscription(req.user.tenantSchema, id, req.user.sub);
    return { message: 'Subscription deleted' };
  }

  // ════════════════════════════════════════════════════════════
  // RENEWALS
  // ════════════════════════════════════════════════════════════

  @Get('renewals')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get upcoming renewals across all accounts' })
  async getUpcomingRenewals(
    @Request() req: { user: JwtPayload },
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getUpcomingRenewals(
      req.user.tenantSchema,
      parseInt(days || '90'),
      parseInt(page || '1'),
      parseInt(limit || '20'),
    );
  }

  // ════════════════════════════════════════════════════════════
  // AUTO-CREATE FROM OPPORTUNITY
  // ════════════════════════════════════════════════════════════

  @Post('opportunities/:opportunityId/create-subscriptions')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Create subscriptions from a won opportunity line items' })
  async createFromOpportunity(
    @Request() req: { user: JwtPayload },
    @Param('opportunityId') opportunityId: string,
  ) {
    const count = await this.service.createSubscriptionsFromOpportunity(
      req.user.tenantSchema, opportunityId, req.user.sub,
    );
    return { created: count, message: `${count} subscription(s) created` };
  }

  // ════════════════════════════════════════════════════════════
  // PRODUCT USAGE METRICS — admin config
  // ════════════════════════════════════════════════════════════

  @Get('products/:productId/usage-metrics')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get usage metrics config for a product' })
  async getUsageMetrics(
    @Request() req: { user: JwtPayload },
    @Param('productId') productId: string,
  ) {
    return this.service.getUsageMetrics(req.user.tenantSchema, productId);
  }

  @Put('products/:productId/usage-metrics')
  @AdminOnly()
  @ApiOperation({ summary: 'Save usage metrics config for a product (admin)' })
  async saveUsageMetrics(
    @Request() req: { user: JwtPayload },
    @Param('productId') productId: string,
    @Body() body: { metrics: any[] },
  ) {
    return this.service.saveUsageMetrics(req.user.tenantSchema, productId, body.metrics);
  }

  // ════════════════════════════════════════════════════════════
  // ACCOUNT USAGE SOURCES — per account+product
  // ════════════════════════════════════════════════════════════

  @Get('accounts/:accountId/products/:productId/usage-source')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get usage source config for an account+product' })
  async getUsageSource(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Param('productId') productId: string,
  ) {
    return this.service.getUsageSource(req.user.tenantSchema, accountId, productId);
  }

  @Put('accounts/:accountId/products/:productId/usage-source')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Configure usage source for an account+product' })
  async saveUsageSource(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Param('productId') productId: string,
    @Body() body: any,
  ) {
    return this.service.saveUsageSource(
      req.user.tenantSchema, req.user.sub,
      { ...body, accountId, productId },
    );
  }

  // ════════════════════════════════════════════════════════════
  // USAGE DATA — ingest + query
  // ════════════════════════════════════════════════════════════

  @Post('accounts/:accountId/products/:productId/usage')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Manually submit usage data' })
  async ingestUsage(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Param('productId') productId: string,
    @Body() body: { metrics: { metricKey: string; metricValue: number }[] },
  ) {
    return this.service.ingestUsageData(
      req.user.tenantSchema, accountId, productId, body.metrics, 'manual',
    );
  }

  @Get('accounts/:accountId/products/:productId/usage')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get usage logs for an account+product' })
  async getUsageLogs(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Param('productId') productId: string,
    @Query('days') days?: string,
  ) {
    return this.service.getUsageLogs(
      req.user.tenantSchema, accountId, productId, parseInt(days || '30'),
    );
  }

  @Get('accounts/:accountId/products/:productId/usage-summary')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get usage summary with trends' })
  async getUsageSummary(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
    @Param('productId') productId: string,
  ) {
    return this.service.getUsageSummary(req.user.tenantSchema, accountId, productId);
  }

  // ════════════════════════════════════════════════════════════
  // SCORES
  // ════════════════════════════════════════════════════════════

  @Get('accounts/:accountId/scores')
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get customer health scores, churn risk, upsell suggestions' })
  async getScores(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
  ) {
    return this.scoringService.getScores(req.user.tenantSchema, accountId);
  }

  @Post('accounts/:accountId/scores/recalculate')
  @RequirePermission('accounts', 'edit')
  @ApiOperation({ summary: 'Recalculate scores for a specific account' })
  async recalculateScores(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
  ) {
    await this.scoringService.calculateScores(req.user.tenantSchema, accountId);
    return this.scoringService.getScores(req.user.tenantSchema, accountId);
  }

  @Post('scores/recalculate-all')
  @AdminOnly()
  @ApiOperation({ summary: 'Recalculate scores for all accounts (admin)' })
  async recalculateAll(@Request() req: { user: JwtPayload }) {
    const count = await this.scoringService.recalculateAll(req.user.tenantSchema);
    return { recalculated: count, message: `${count} account(s) scored` };
  }

  // ════════════════════════════════════════════════════════════
  // PRODUCT RECOMMENDATIONS — admin config
  // ════════════════════════════════════════════════════════════

  @Get('recommendations')
  @AdminOnly()
  @ApiOperation({ summary: 'List all product recommendation rules' })
  async getRecommendations(@Request() req: { user: JwtPayload }) {
    const rows = await this.service['dataSource'].query(
      `SELECT r.*, p.name as product_name, p.code as product_code
       FROM "${req.user.tenantSchema}".product_recommendations r
       LEFT JOIN "${req.user.tenantSchema}".products p ON r.product_id = p.id
       ORDER BY r.created_at DESC`,
    );
    return rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      productCode: r.product_code,
      prerequisites: r.prerequisites,
      exclusions: r.exclusions,
      idealMinSize: r.ideal_min_size,
      idealMaxSize: r.ideal_max_size,
      idealIndustries: r.ideal_industries,
      baseScore: r.base_score,
      triggerSignals: r.trigger_signals,
      isActive: r.is_active,
      createdAt: r.created_at,
    }));
  }

  @Post('recommendations')
  @AdminOnly()
  @ApiOperation({ summary: 'Create or update a product recommendation rule' })
  async saveRecommendation(
    @Request() req: { user: JwtPayload },
    @Body() body: any,
  ) {
    const schema = req.user.tenantSchema;
    const [row] = await this.service['dataSource'].query(
      `INSERT INTO "${schema}".product_recommendations
       (product_id, prerequisites, exclusions, ideal_min_size, ideal_max_size,
        ideal_industries, base_score, trigger_signals, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       ON CONFLICT (product_id) DO UPDATE SET
         prerequisites = $2, exclusions = $3, ideal_min_size = $4, ideal_max_size = $5,
         ideal_industries = $6, base_score = $7, trigger_signals = $8::jsonb,
         is_active = $9, updated_at = NOW()
       RETURNING *`,
      [
        body.productId, body.prerequisites || '{}', body.exclusions || '{}',
        body.idealMinSize || null, body.idealMaxSize || null,
        body.idealIndustries || '{}', body.baseScore || 50,
        JSON.stringify(body.triggerSignals || []),
        body.isActive !== false, req.user.sub,
      ],
    );
    return row;
  }

  @Delete('recommendations/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a product recommendation rule' })
  async deleteRecommendation(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    await this.service['dataSource'].query(
      `DELETE FROM "${req.user.tenantSchema}".product_recommendations WHERE id = $1`,
      [id],
    );
    return { message: 'Recommendation deleted' };
  }

  // ════════════════════════════════════════════════════════════
  // WEBHOOK — external systems push usage data
  // ════════════════════════════════════════════════════════════

  @Post('webhook/usage/:tenantSchema/:webhookKey')
  @ApiOperation({ summary: 'Receive usage data via webhook (no auth, key-based)' })
  async handleWebhook(
    @Param('tenantSchema') tenantSchema: string,
    @Param('webhookKey') webhookKey: string,
    @Body() body: any,
  ) {
    return this.service.handleUsageWebhook(tenantSchema, webhookKey, body);
  }
}
