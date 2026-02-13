// ============================================================
// FILE: apps/api/src/modules/leads/lead-settings.controller.ts
//
// CHANGES from existing file:
//   ✅ NEW: Pipeline CRUD endpoints (GET/POST/PUT/DELETE /pipelines)
//   ✅ MODIFIED: GET /stages now accepts ?pipelineId=&module= query params
//   ✅ MODIFIED: reorderStages / deleteStage signatures simplified
//   ✅ ALL OTHER ENDPOINTS: Unchanged
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  // PIPELINES (NEW)
  // ============================================================

  @Get('pipelines')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all pipelines' })
  async getPipelines(@Request() req: { user: JwtPayload }) {
    return this.settingsService.getPipelines(req.user.tenantSchema);
  }

  @Get('pipelines/:id')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get a single pipeline by ID' })
  async getPipeline(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.getPipeline(req.user.tenantSchema, id);
  }

  @Post('pipelines')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new pipeline' })
  async createPipeline(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createPipeline(req.user.tenantSchema, body, req.user.sub);
  }

  @Put('pipelines/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a pipeline' })
  async updatePipeline(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updatePipeline(req.user.tenantSchema, id, body, req.user.sub);
  }

  @Delete('pipelines/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a pipeline' })
  async deletePipeline(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deletePipeline(req.user.tenantSchema, id);
  }

  @Post('pipelines/:id/set-default')
  @AdminOnly()
  @ApiOperation({ summary: 'Set a pipeline as the default' })
  async setDefaultPipeline(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.setDefaultPipeline(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // STAGES (MODIFIED — now accepts pipelineId + module)
  // ============================================================

  @Get('stages')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get stages for a pipeline and module' })
  @ApiQuery({ name: 'pipelineId', required: false })
  @ApiQuery({ name: 'module', required: false, enum: ['leads', 'opportunities'] })
  async getStages(
    @Request() req: { user: JwtPayload },
    @Query('pipelineId') pipelineId?: string,
    @Query('module') module?: string,
  ) {
    return this.settingsService.getStages(req.user.tenantSchema, pipelineId, module || 'leads');
  }

  @Post('stages')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new stage in a pipeline' })
  async createStage(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.settingsService.createStage(req.user.tenantSchema, body, req.user.sub);
  }

  @Put('stages/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a stage' })
  async updateStage(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateStage(req.user.tenantSchema, id, body, req.user.sub);
  }

  @Put('stages/reorder')
  @AdminOnly()
  @ApiOperation({ summary: 'Reorder stages' })
  async reorderStages(@Request() req: { user: JwtPayload }, @Body() body: { orderedIds: string[] }) {
    return this.settingsService.reorderStages(req.user.tenantSchema, body.orderedIds);
  }

  @Delete('stages/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a stage' })
  async deleteStage(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteStage(req.user.tenantSchema, id);
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
  // PRIORITIES (unchanged)
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
    return this.settingsService.createPriority(req.user.tenantSchema, body);
  }

  @Put('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a lead priority' })
  async updatePriority(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updatePriority(req.user.tenantSchema, id, body);
  }

  @Delete('priorities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a lead priority' })
  async deletePriority(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deletePriority(req.user.tenantSchema, id);
  }

  // ============================================================
  // SCORING TEMPLATES & RULES (unchanged)
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
    return this.settingsService.createScoringRule(req.user.tenantSchema, templateId, body);
  }

  @Put('scoring/rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a scoring rule' })
  async updateScoringRule(
    @Request() req: { user: JwtPayload },
    @Param('ruleId') ruleId: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateScoringRule(req.user.tenantSchema, ruleId, body);
  }

  @Delete('scoring/rules/:ruleId')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a scoring rule' })
  async deleteScoringRule(@Request() req: { user: JwtPayload }, @Param('ruleId') ruleId: string) {
    return this.settingsService.deleteScoringRule(req.user.tenantSchema, ruleId);
  }

  @Post('scoring/rescore-all')
  @AdminOnly()
  @ApiOperation({ summary: 'Re-score all active leads (after rule changes)' })
  async rescoreAll(@Request() req: { user: JwtPayload }) {
    return this.scoringService.rescoreAll(req.user.tenantSchema);
  }

  // ============================================================
  // ROUTING RULES (unchanged)
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
    return this.settingsService.createRoutingRule(req.user.tenantSchema, body);
  }

  @Put('routing/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update a routing rule' })
  async updateRoutingRule(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.settingsService.updateRoutingRule(req.user.tenantSchema, id, body);
  }

  @Delete('routing/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a routing rule' })
  async deleteRoutingRule(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.settingsService.deleteRoutingRule(req.user.tenantSchema, id);
  }

  // ============================================================
  // QUALIFICATION FRAMEWORKS (unchanged)
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
    return this.settingsService.setActiveFramework(req.user.tenantSchema, frameworkId);
  }

  // ============================================================
  // DISQUALIFICATION REASONS (unchanged)
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
    return this.settingsService.createDisqualificationReason(req.user.tenantSchema, body);
  }

  // ============================================================
  // LEAD SOURCES (unchanged)
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
    return this.settingsService.createSource(req.user.tenantSchema, body);
  }

  // ============================================================
  // RECORD TEAM ROLES (unchanged)
  // ============================================================

  @Get('team-roles')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get available record team roles' })
  async getTeamRoles(@Request() req: { user: JwtPayload }) {
    return this.recordTeamService.getRoles(req.user.tenantSchema);
  }

  // ============================================================
  // GENERAL SETTINGS (unchanged)
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
    return this.settingsService.updateSetting(req.user.tenantSchema, key, body);
  }
}