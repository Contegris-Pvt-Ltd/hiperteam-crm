// ============================================================
// FILE: apps/api/src/modules/dashboard/dashboard.controller.ts
//
// REST endpoints for dashboard analytics.
// All endpoints accept optional query params:
//   - scope: 'own' | 'team' | 'all' (default: 'own')
//   - from: ISO date string (default: start of current month)
//   - to: ISO date string (default: end of current month)
//   - pipelineId: filter by pipeline (where applicable)
// ============================================================
import {
  Controller, Get, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { TargetsService } from '../targets/targets.service';

interface JwtPayload {
  sub: string;
  tenantSchema: string;
  teamId?: string;
  roleLevel?: number;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private targetsService: TargetsService
) {}

  // ── Parse common query params ──
  private parseParams(
    req: { user: JwtPayload },
    query: { scope?: string; from?: string; to?: string },
  ) {
    const schema = req.user.tenantSchema;
    const userId = req.user.sub;
    const teamId = req.user.teamId || null;
    const scope = (['own', 'team', 'all'].includes(query.scope || '') ? query.scope : 'own') as 'own' | 'team' | 'all';

    // Default date range: current month
    const now = new Date();
    const from = query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = query.to || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    return { schema, userId, teamId, scope, dateRange: { from, to } };
  }

  @Get('target-leaderboard')
  @ApiOperation({ summary: 'Target-based team leaderboard' })
  getTargetLeaderboard(
    @Request() req: { user: JwtPayload },
    @Query('metricKey') metricKey: string,
    @Query('period') period?: string,
  ) {
    return this.targetsService.getTargetLeaderboard(req.user.tenantSchema, metricKey, period);
  }

  // ── 1. Summary KPIs ──
  @Get('summary')
  async getSummary(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, userId, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getSummary(schema, userId, teamId, scope, dateRange);
  }

  // ── 2. Activity Summary ──
  @Get('activity-summary')
  async getActivitySummary(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, userId, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getActivitySummary(schema, userId, teamId, scope, dateRange);
  }

  // ── 3. Pipeline Funnel ──
  @Get('pipeline-funnel')
  async getPipelineFunnel(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; pipelineId?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getPipelineFunnel(schema, userId, teamId, scope, query.pipelineId);
  }

  // ── 4. Lead Funnel ──
  @Get('lead-funnel')
  async getLeadFunnel(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; pipelineId?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getLeadFunnel(schema, userId, teamId, scope, query.pipelineId);
  }

  // ── 5. Pipeline Velocity ──
  @Get('pipeline-velocity')
  async getPipelineVelocity(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; module?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    const mod = query.module === 'leads' ? 'leads' : 'opportunities';
    return this.dashboardService.getPipelineVelocity(schema, userId, teamId, scope, mod);
  }

  // ── 6. Forecast ──
  @Get('forecast')
  async getForecast(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getForecast(schema, userId, teamId, scope);
  }

  // ── 7. Win/Loss Analysis ──
  @Get('win-loss')
  async getWinLoss(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, userId, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getWinLossAnalysis(schema, userId, teamId, scope, dateRange);
  }

  // ── 8. Team Leaderboard ──
  @Get('leaderboard')
  async getLeaderboard(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getTeamLeaderboard(schema, teamId, scope, dateRange);
  }

  // ── 9. Team Activity ──
  @Get('team-activity')
  async getTeamActivity(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getTeamActivity(schema, teamId, scope, dateRange);
  }

  // ── 10. Lead Aging ──
  @Get('lead-aging')
  async getLeadAging(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getLeadAging(schema, userId, teamId, scope);
  }

  // ── 11. Lead Sources ──
  @Get('lead-sources')
  async getLeadSources(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, userId, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getLeadSources(schema, userId, teamId, scope, dateRange);
  }

  // ── 12. Upcoming Tasks ──
  @Get('upcoming-tasks')
  async getUpcomingTasks(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; limit?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getUpcomingTasks(schema, userId, teamId, scope, parseInt(query.limit || '15', 10));
  }

  // ── 13. Deals Closing Soon ──
  @Get('deals-closing')
  async getDealsClosing(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; days?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getDealsClosingSoon(schema, userId, teamId, scope, parseInt(query.days || '7', 10));
  }

  // ── 14. Effort vs Result ──
  @Get('effort-vs-result')
  async getEffortVsResult(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getEffortVsResult(schema, teamId, scope, dateRange);
  }

  // ── 15. Conversion Funnel ──
  @Get('conversion-funnel')
  async getConversionFunnel(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; from?: string; to?: string },
  ) {
    const { schema, userId, teamId, scope, dateRange } = this.parseParams(req, query);
    return this.dashboardService.getConversionFunnel(schema, userId, teamId, scope, dateRange);
  }

  // ── 16. Recent Activity Feed ──
  @Get('recent-activity')
  async getRecentActivity(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; limit?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getRecentActivity(schema, userId, teamId, scope, parseInt(query.limit || '20', 10));
  }

  // ── 17. Stuck Deals ──
  @Get('stuck-deals')
  async getStuckDeals(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; days?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    return this.dashboardService.getStuckDeals(schema, userId, teamId, scope, parseInt(query.days || '14', 10));
  }

  // ── 18. Account Forecast ──
  @Get('account-forecast')
  async getAccountForecast(
    @Request() req: { user: JwtPayload },
    @Query() query: { scope?: string; quarter?: string },
  ) {
    const { schema, userId, teamId, scope } = this.parseParams(req, query);
    const quarter = (query.quarter === 'current' ? 'current' : 'next') as 'current' | 'next';
    return this.dashboardService.getAccountForecast(schema, userId, teamId, scope, quarter);
  }
}