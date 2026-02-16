// ============================================================
// FILE: apps/api/src/modules/opportunities/opportunities.controller.ts
//
// 20 endpoints covering full CRUD, stage management, close won/lost,
// reopen, contact roles, line items, forecast, priorities, close reasons
//
// Permission module: 'deals' (already seeded in RBAC)
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/guards/permissions.guard';
import { OpportunitiesService } from './opportunities.service';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { NotesService } from '../shared/notes.service';
import { DocumentsService } from '../shared/documents.service';
import { RecordTeamService } from '../shared/record-team.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  QueryOpportunitiesDto,
  ChangeOpportunityStageDto,
  CloseWonDto,
  CloseLostDto,
  ReopenOpportunityDto,
} from './dto';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  tenantSlug: string;
}

@ApiTags('Opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly auditService: AuditService,
    private readonly activityService: ActivityService,
    private readonly notesService: NotesService,
    private readonly documentsService: DocumentsService,
    private readonly recordTeamService: RecordTeamService,
  ) {}

  // ============================================================
  // CORE CRUD
  // ============================================================

  @Get()
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'List opportunities (list + kanban)' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryOpportunitiesDto,
  ) {
    return this.opportunitiesService.findAll(req.user.tenantSchema, query, req.user.sub);
  }

  @Get('forecast')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get forecast data (weighted pipeline by period)' })
  async getForecast(
    @Request() req: { user: JwtPayload },
    @Query('pipelineId') pipelineId?: string,
  ) {
    return this.opportunitiesService.getForecast(req.user.tenantSchema, pipelineId);
  }

  @Get('priorities')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity priorities' })
  async getPriorities(@Request() req: { user: JwtPayload }) {
    return this.opportunitiesService.getPriorities(req.user.tenantSchema);
  }

  @Get('close-reasons')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get close reasons (won/lost)' })
  async getCloseReasons(
    @Request() req: { user: JwtPayload },
    @Query('type') type?: string,
  ) {
    return this.opportunitiesService.getCloseReasons(req.user.tenantSchema, type);
  }

  @Get(':id')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity by ID (enriched with contacts, history, team)' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.findOne(req.user.tenantSchema, id);
  }

  @Post()
  @RequirePermission('deals', 'create')
  @ApiOperation({ summary: 'Create new opportunity' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.opportunitiesService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Put(':id')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update opportunity' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Soft-delete opportunity' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // STAGE MANAGEMENT
  // ============================================================

  @Post(':id/change-stage')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Change opportunity stage (with validation)' })
  async changeStage(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ChangeOpportunityStageDto,
  ) {
    return this.opportunitiesService.changeStage(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Post(':id/close-won')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Close opportunity as Won' })
  async closeWon(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: CloseWonDto,
  ) {
    return this.opportunitiesService.closeWon(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Post(':id/close-lost')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Close opportunity as Lost' })
  async closeLost(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: CloseLostDto,
  ) {
    return this.opportunitiesService.closeLost(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Post(':id/reopen')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Reopen a closed opportunity (admin only)' })
  async reopen(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ReopenOpportunityDto,
  ) {
    // Note: frontend should restrict this to admin/manager roles
    // Backend validates the DTO but does not enforce role check here
    // because RBAC is handled by @RequirePermission
    return this.opportunitiesService.reopen(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Get(':id/stage-history')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get stage change timeline' })
  async getStageHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.getStageHistory(req.user.tenantSchema, id);
  }

  // ============================================================
  // CONTACT ROLES
  // ============================================================

  @Get(':id/contacts')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get contact roles for opportunity' })
  async getContactRoles(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.getContactRoles(req.user.tenantSchema, id);
  }

  @Post(':id/contacts')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Add contact role to opportunity' })
  async addContactRole(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { contactId: string; role: string; isPrimary?: boolean; notes?: string },
  ) {
    return this.opportunitiesService.addContactRole(
      req.user.tenantSchema, id,
      body.contactId, body.role, body.isPrimary || false, body.notes || null,
      req.user.sub,
    );
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Remove contact role from opportunity' })
  async removeContactRole(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.opportunitiesService.removeContactRole(
      req.user.tenantSchema, id, contactId, req.user.sub,
    );
  }

  // ============================================================
  // LINE ITEMS
  // ============================================================

  @Get(':id/line-items')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get line items (products) for opportunity' })
  async getLineItems(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.getLineItems(req.user.tenantSchema, id);
  }

  @Post(':id/line-items')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Add line item to opportunity' })
  async addLineItem(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: {
      productId?: string;
      priceBookEntryId?: string;
      description?: string;
      quantity?: number;
      unitPrice: number;
      discount?: number;
      discountType?: 'percentage' | 'fixed';
      discountPercent?: number;   // backward compat
      discountAmount?: number;    // backward compat
      billingFrequency?: string;
      sortOrder?: number;
    },
  ) {
    return this.opportunitiesService.addLineItem(
      req.user.tenantSchema, id, body, req.user.sub,
    );
  }

  @Put(':id/line-items/:itemId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update a line item' })
  async updateLineItem(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: {
      quantity?: number;
      unitPrice?: number;
      discount?: number;
      discountType?: 'percentage' | 'fixed';
      discountPercent?: number;   // backward compat
      discountAmount?: number;    // backward compat
      description?: string;
      billingFrequency?: string;
      sortOrder?: number;
    },
  ) {
    return this.opportunitiesService.updateLineItem(
      req.user.tenantSchema, id, itemId, body,
    );
  }

  @Delete(':id/line-items/:itemId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Remove a line item' })
  async removeLineItem(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.opportunitiesService.removeLineItem(
      req.user.tenantSchema, id, itemId, req.user.sub,
    );
  }

  // ============================================================
  // SHARED: Activities, Notes, Documents, Audit History
  // ============================================================

  @Get(':id/activities')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get activity timeline' })
  async getActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.activityService.getTimeline(req.user.tenantSchema, 'opportunities', id, page, limit);
  }

  @Get(':id/history')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get audit/change history' })
  async getHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.auditService.getHistory(req.user.tenantSchema, 'opportunities', id);
  }

  // ============================================================
  // RECORD TEAM
  // ============================================================

  @Get(':id/team')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get record team members' })
  async getTeamMembers(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.recordTeamService.getMembers(req.user.tenantSchema, 'opportunities', id);
  }

  @Post(':id/team')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Add a member to opportunity record team' })
  async addTeamMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { userId: string; roleId?: string; roleName?: string; accessLevel?: 'read' | 'write' },
  ) {
    return this.recordTeamService.addMember(req.user.tenantSchema, {
      entityType: 'opportunities',
      entityId: id,
      userId: body.userId,
      roleId: body.roleId,
      roleName: body.roleName,
      accessLevel: body.accessLevel,
      addedBy: req.user.sub,
    });
  }

  @Delete(':id/team/:userId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Remove a member from opportunity record team' })
  async removeTeamMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.recordTeamService.removeMember(req.user.tenantSchema, 'opportunities', id, userId);
  }

  // ============================================================
  // NOTES
  // ============================================================

  @Get(':id/notes')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity notes' })
  async getNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.notesService.findByEntity(req.user.tenantSchema, 'opportunities', id);
  }

  @Post(':id/notes')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Add a note to an opportunity' })
  async addNote(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const note = await this.notesService.create(
      req.user.tenantSchema, 'opportunities', id, body.content, req.user.sub,
    );

    await this.activityService.create(req.user.tenantSchema, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'note_added',
      title: 'Note added',
      performedBy: req.user.sub,
    });

    return note;
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================

  @Get(':id/documents')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Get opportunity documents' })
  async getDocuments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantSchema, 'opportunities', id);
  }

  // ============================================================
  // SETTINGS: Priorities CRUD
  // ============================================================

  @Post('priorities')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Create opportunity priority' })
  async createPriority(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; color?: string; icon?: string; sortOrder?: number },
  ) {
    return this.opportunitiesService.createPriority(req.user.tenantSchema, body);
  }

  @Put('priorities/:priorityId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update opportunity priority' })
  async updatePriority(
    @Request() req: { user: JwtPayload },
    @Param('priorityId') priorityId: string,
    @Body() body: { name?: string; color?: string; icon?: string; sortOrder?: number; isActive?: boolean; isDefault?: boolean },
  ) {
    return this.opportunitiesService.updatePriority(req.user.tenantSchema, priorityId, body);
  }

  @Delete('priorities/:priorityId')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Delete opportunity priority' })
  async deletePriority(
    @Request() req: { user: JwtPayload },
    @Param('priorityId') priorityId: string,
  ) {
    return this.opportunitiesService.deletePriority(req.user.tenantSchema, priorityId);
  }

  // ============================================================
  // SETTINGS: Close Reasons CRUD
  // ============================================================

  @Post('close-reasons')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Create close reason' })
  async createCloseReason(
    @Request() req: { user: JwtPayload },
    @Body() body: { type: string; name: string; description?: string; sortOrder?: number },
  ) {
    return this.opportunitiesService.createCloseReason(req.user.tenantSchema, body);
  }

  @Get('check-duplicates')
  @RequirePermission('deals', 'view')
  @ApiOperation({ summary: 'Check for potential duplicate opportunities' })
  async checkDuplicates(
    @Request() req: { user: JwtPayload },
    @Query('name') name?: string,
    @Query('accountId') accountId?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.opportunitiesService.checkDuplicates(
      req.user.tenantSchema, name, accountId, excludeId,
    );
  }
  
  @Put('close-reasons/:reasonId')
  @RequirePermission('deals', 'edit')
  @ApiOperation({ summary: 'Update close reason' })
  async updateCloseReason(
    @Request() req: { user: JwtPayload },
    @Param('reasonId') reasonId: string,
    @Body() body: { name?: string; description?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.opportunitiesService.updateCloseReason(req.user.tenantSchema, reasonId, body);
  }

  @Delete('close-reasons/:reasonId')
  @RequirePermission('deals', 'delete')
  @ApiOperation({ summary: 'Delete close reason' })
  async deleteCloseReason(
    @Request() req: { user: JwtPayload },
    @Param('reasonId') reasonId: string,
  ) {
    return this.opportunitiesService.deleteCloseReason(req.user.tenantSchema, reasonId);
  }
}