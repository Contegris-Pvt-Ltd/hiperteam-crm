// ============================================================
// FILE: apps/api/src/modules/leads/lead-settings.controller.ts
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { LeadSettingsService } from './lead-settings.service';
import { LeadScoringService } from './lead-scoring.service';
import { RecordTeamService } from '../shared/record-team.service';

@ApiTags('Lead Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('lead-settings')
export class LeadSettingsController {
  constructor(
    private settingsService: LeadSettingsService,
    private scoringService: LeadScoringService,
    private recordTeamService: RecordTeamService,
  ) {}

  // ============================================================
  // STAGES
  // ============================================================

  @Get('stages')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all lead stages' })
  async getStages(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getStages(req.user.tenantSchema);
  }

  @Post('stages')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new lead stage' })
  async createStage(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createStage(req.user.tenantSchema, body, req.user.sub);
  }

  @Put('stages/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a lead stage' })
  async updateStage(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateStage(req.user.tenantSchema, id, body, req.user.sub);
  }

  @Put('stages/reorder')
  @AdminOnly()
  @ApiOperation({ summary: 'Reorder lead stages' })
  async reorderStages(@Request() req: { user: JwtPayload }, @Body() body: { orderedIds: string[] }) {
    return this.settingsService.reorderStages(req.user.tenantSchema, body.orderedIds, req.user.sub);
  }

  @Delete('stages/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a lead stage' })
  async deleteStage(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteStage(req.user.tenantSchema, id, req.user.sub);
  }

  // ── Stage Fields ──

  @Get('stages/:stageId/fields')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get fields for a specific stage' })
  async getStageFields(@Request() req: { user: JwtPayload }, @Param('stageId') stageId: string) {
    return this.settingsService.getStageFields(req.user.tenantSchema, stageId);
  }

  @Put('stages/:stageId/fields')
  @AdminOnly()
  @ApiOperation({ summary: 'Set fields for a specific stage (replaces all)' })
  async upsertStageFields(
    @Request() req: { user: JwtPayload },
    @Param('stageId') stageId: string,
    @Body() body: { fields: any[] },
  ) {
    return this.settingsService.upsertStageFields(req.user.tenantSchema, stageId, body.fields, req.user.sub);
  }

  // ============================================================
  // PRIORITIES
  // ============================================================

  @Get('priorities')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all lead priorities' })
  async getPriorities(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getPriorities(req.user.tenantSchema);
  }

  @Post('priorities')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a lead priority' })
  async createPriority(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createPriority(req.user.tenantSchema, body, req.user.sub);
  }

  @Put('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a lead priority' })
  async updatePriority(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updatePriority(req.user.tenantSchema, id, body, req.user.sub);
  }

  @Delete('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a lead priority' })
  async deletePriority(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deletePriority(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // SCORING TEMPLATES & RULES
  // ============================================================

  @Get('scoring')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get scoring templates with rules' })
  async getScoringTemplates(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getScoringTemplates(req.user.tenantSchema);
  }

  @Post('scoring/:templateId/rules')
  @AdminOnly()
  @ApiOperation({ summary: 'Add a scoring rule to a template' })
  async createScoringRule(
    @Request() req: { user: JwtPayload },
    @Param('templateId') templateId: string,
    @Body() body: any,
  ) {
    return this.settingsService.createScoringRule(req.user.tenantSchema, templateId, body, req.user.sub);
  }

  @Put('scoring/rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a scoring rule' })
  async updateScoringRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateScoringRule(req.user.tenantSchema, ruleId, body, req.user.sub);
  }

  @Delete('scoring/rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a scoring rule' })
  async deleteScoringRule(@Request() req: { user: JwtPayload }, @Param('ruleId') ruleId: string) {
    return this.settingsService.deleteScoringRule(req.user.tenantSchema, ruleId, req.user.sub);
  }

  @Post('scoring/rescore-all')
  @AdminOnly()
  @ApiOperation({ summary: 'Re-score all active leads (after rule changes)' })
  async rescoreAll(@Request() req: { user: JwtPayload }) {
    return this.scoringService.rescoreAll(req.user.tenantSchema);
  }

  // ============================================================
  // ROUTING RULES
  // ============================================================

  @Get('routing')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all routing rules' })
  async getRoutingRules(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getRoutingRules(req.user.tenantSchema);
  }

  @Post('routing')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a routing rule' })
  async createRoutingRule(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createRoutingRule(req.user.tenantSchema, body, req.user.sub);
  }

  @Put('routing/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a routing rule' })
  async updateRoutingRule(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateRoutingRule(req.user.tenantSchema, id, body, req.user.sub);
  }

  @Delete('routing/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a routing rule' })
  async deleteRoutingRule(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteRoutingRule(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // QUALIFICATION FRAMEWORKS
  // ============================================================

  @Get('qualification')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all qualification frameworks with fields' })
  async getQualificationFrameworks(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getQualificationFrameworks(req.user.tenantSchema);
  }

  @Post('qualification/:frameworkId/activate')
  @AdminOnly()
  @ApiOperation({ summary: 'Set active qualification framework' })
  async setActiveFramework(
    @Request() req: { user: JwtPayload },
    @Param('frameworkId') frameworkId: string,
  ) {
    return this.settingsService.setActiveFramework(req.user.tenantSchema, frameworkId, req.user.sub);
  }

  // ============================================================
  // DISQUALIFICATION REASONS
  // ============================================================

  @Get('disqualification-reasons')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get disqualification reasons' })
  async getDisqualificationReasons(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getDisqualificationReasons(req.user.tenantSchema);
  }

  @Post('disqualification-reasons')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a disqualification reason' })
  async createDisqualificationReason(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; description?: string },
  ) {
    return this.settingsService.createDisqualificationReason(req.user.tenantSchema, body, req.user.sub);
  }

  // ============================================================
  // LEAD SOURCES
  // ============================================================

  @Get('sources')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get lead sources' })
  async getSources(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getSources(req.user.tenantSchema);
  }

  @Post('sources')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a lead source' })
  async createSource(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; description?: string },
  ) {
    return this.settingsService.createSource(req.user.tenantSchema, body, req.user.sub);
  }

  // ============================================================
  // RECORD TEAM ROLES
  // ============================================================

  @Get('team-roles')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get available record team roles' })
  async getTeamRoles(@Request() req: { user: JwtPayload }) {
    return this.recordTeamService.getRoles(req.user.tenantSchema);
  }

  // ============================================================
  // GENERAL SETTINGS
  // ============================================================

  @Get('settings')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all lead settings' })
  async getSettings(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getSettings(req.user.tenantSchema);
  }

  @Put('settings/:key')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a lead setting by key' })
  async updateSetting(
    @Request() req: { user: JwtPayload },
    @Param('key') key: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateSetting(req.user.tenantSchema, key, body, req.user.sub);
  }
}