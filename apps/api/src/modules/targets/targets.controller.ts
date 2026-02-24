// ============================================================
// FILE: apps/api/src/modules/targets/targets.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { TargetsService } from './targets.service';

@ApiTags('Targets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  // ============================================================
  // METRIC REGISTRY
  // ============================================================

  @Get('metrics')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Get all available metrics from registry' })
  getAvailableMetrics(@Query('module') module?: string) {
    return this.targetsService.getAvailableMetrics(module);
  }

  // ============================================================
  // TARGET CRUD
  // ============================================================

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List all configured targets' })
  findAll(
    @Request() req: { user: JwtPayload },
    @Query('module') module?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.targetsService.findAll(req.user.tenantSchema, {
      module,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Get a single target' })
  findOne(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.targetsService.findOne(req.user.tenantSchema, id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new target' })
  create(@Request() req: { user: JwtPayload }, @Body() dto: any) {
    return this.targetsService.create(req.user.tenantSchema, dto, req.user.sub);
  }

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a target' })
  update(@Request() req: { user: JwtPayload }, @Param('id') id: string, @Body() dto: any) {
    return this.targetsService.update(req.user.tenantSchema, id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a target' })
  delete(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.targetsService.delete(req.user.tenantSchema, id);
  }

  // ============================================================
  // ASSIGNMENTS
  // ============================================================

  @Get(':id/assignments')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List assignments for a target' })
  getAssignments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('periodStart') periodStart?: string,
  ) {
    return this.targetsService.getAssignments(req.user.tenantSchema, id, periodStart);
  }

  @Post(':id/assignments')
  @AdminOnly()
  @ApiOperation({ summary: 'Create an assignment' })
  createAssignment(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.targetsService.createAssignment(req.user.tenantSchema, id, dto, req.user.sub);
  }

  @Put('assignments/:assignmentId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update an assignment (override)' })
  updateAssignment(
    @Request() req: { user: JwtPayload },
    @Param('assignmentId') assignmentId: string,
    @Body() dto: any,
  ) {
    return this.targetsService.updateAssignment(req.user.tenantSchema, assignmentId, dto);
  }

  @Delete('assignments/:assignmentId')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete an assignment' })
  deleteAssignment(
    @Request() req: { user: JwtPayload },
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.targetsService.deleteAssignment(req.user.tenantSchema, assignmentId);
  }

  // ============================================================
  // CASCADE
  // ============================================================

  @Post(':id/cascade')
  @AdminOnly()
  @ApiOperation({ summary: 'Auto-distribute target from parent scope' })
  cascadeTarget(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: { parentAssignmentId: string; toScope: 'department' | 'team' | 'individual' },
  ) {
    return this.targetsService.cascadeTarget(
      req.user.tenantSchema, id, dto.parentAssignmentId, dto.toScope, req.user.sub,
    );
  }

  // ============================================================
  // GENERATE PERIODS
  // ============================================================

  @Post(':id/generate-periods')
  @AdminOnly()
  @ApiOperation({ summary: 'Generate assignments for next N periods' })
  generatePeriods(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: { count: number; scopeType: string; userId?: string; teamId?: string; department?: string; targetValue: number },
  ) {
    return this.targetsService.generatePeriods(
      req.user.tenantSchema, id, dto.count || 3, dto, req.user.sub,
    );
  }

  // ============================================================
  // PROGRESS
  // ============================================================

  @Get('progress/my')
  @ApiOperation({ summary: 'My current target progress' })
  getMyProgress(
    @Request() req: { user: JwtPayload },
    @Query('period') period?: string,
  ) {
    return this.targetsService.getMyProgress(req.user.tenantSchema, req.user.sub, period);
  }

  @Get('progress/team/:teamId')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Team target progress' })
  getTeamProgress(
    @Request() req: { user: JwtPayload },
    @Param('teamId') teamId: string,
    @Query('period') period?: string,
  ) {
    return this.targetsService.getTeamProgress(req.user.tenantSchema, teamId, period);
  }

  @Get('progress/leaderboard')
  @ApiOperation({ summary: 'Target-based leaderboard' })
  getLeaderboard(
    @Request() req: { user: JwtPayload },
    @Query('metricKey') metricKey: string,
    @Query('period') period?: string,
  ) {
    return this.targetsService.getTargetLeaderboard(req.user.tenantSchema, metricKey, period);
  }

  @Post('progress/refresh')
  @AdminOnly()
  @ApiOperation({ summary: 'Force recompute all progress' })
  refreshProgress(@Request() req: { user: JwtPayload }) {
    return this.targetsService.refreshAllProgress(req.user.tenantSchema, true);
  }
}