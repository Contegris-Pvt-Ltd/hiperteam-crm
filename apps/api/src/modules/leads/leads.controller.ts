// ============================================================
// FILE: apps/api/src/modules/leads/leads.controller.ts
// ============================================================
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto, QueryLeadsDto, ConvertLeadDto, ChangeStageDto } from './dto';
import { DisqualifyLeadDto } from './dto/change-stage.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { DocumentsService } from '../shared/documents.service';
import { NotesService } from '../shared/notes.service';
import { RecordTeamService } from '../shared/record-team.service';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private leadsService: LeadsService,
    private auditService: AuditService,
    private activityService: ActivityService,
    private documentsService: DocumentsService,
    private notesService: NotesService,
    private recordTeamService: RecordTeamService,
  ) {}

  // ============================================================
  // LEADS CRUD
  // ============================================================

  @Post()
  @RequirePermission('leads', 'create')
  @ApiOperation({ summary: 'Create a new lead' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get()
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get all leads (list or kanban view)' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryLeadsDto,
  ) {
    return this.leadsService.findAll(req.user.tenantSchema, query, req.user.sub);
  }

  // ============================================================
  // DUPLICATE CHECK (real-time, from frontend)
  // ============================================================

  @Get('check-duplicates')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Check for duplicate leads/contacts/accounts' })
  async checkDuplicates(
    @Request() req: { user: JwtPayload },
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.leadsService.findDuplicates(
      req.user.tenantSchema, email || null, phone || null, excludeId && excludeId.trim() ? excludeId : null,
    );
  }

  @Get(':id')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get a lead by ID (with full enrichment)' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.leadsService.findOne(req.user.tenantSchema, id);
  }

  @Put(':id')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Update a lead' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @RequirePermission('leads', 'delete')
  @ApiOperation({ summary: 'Soft-delete a lead' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.leadsService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // STAGE MANAGEMENT
  // ============================================================

  @Post(':id/change-stage')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Change lead stage (journey bar click)' })
  async changeStage(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
  ) {
    return this.leadsService.changeStage(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Post(':id/disqualify')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Disqualify a lead' })
  async disqualify(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: DisqualifyLeadDto,
  ) {
    return this.leadsService.disqualify(req.user.tenantSchema, id, req.user.sub, dto);
  }

  // ============================================================
  // CONVERSION
  // ============================================================

  @Get(':id/conversion-check')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Check for duplicate contacts/accounts before lead conversion' })
  async checkConversionDuplicates(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.leadsService.checkConversionDuplicates(req.user.tenantSchema, id);
  }
  
  @Post(':id/convert')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Convert lead to contact + account + opportunity' })
  async convert(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(req.user.tenantSchema, id, req.user.sub, dto);
  }

  // ============================================================
  // RECORD TEAM
  // ============================================================

  @Get(':id/team')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get record team members for a lead' })
  async getTeamMembers(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.recordTeamService.getMembers(req.user.tenantSchema, 'leads', id);
  }

  @Post(':id/team')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Add a member to lead record team' })
  async addTeamMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { userId: string; roleId?: string; roleName?: string; accessLevel?: 'read' | 'write' },
  ) {
    return this.recordTeamService.addMember(req.user.tenantSchema, {
      entityType: 'leads',
      entityId: id,
      userId: body.userId,
      roleId: body.roleId,
      roleName: body.roleName,
      accessLevel: body.accessLevel,
      addedBy: req.user.sub,
    });
  }

  @Delete(':id/team/:userId')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Remove a member from lead record team' })
  async removeTeamMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.recordTeamService.removeMember(req.user.tenantSchema, 'leads', id, userId);
  }

  // ============================================================
  // LEAD PRODUCTS
  // ============================================================

  @Get(':id/products')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get products linked to a lead' })
  async getLeadProducts(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.leadsService.getLeadProducts(req.user.tenantSchema, id);
  }

  @Post(':id/products/:productId')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Link a product to a lead' })
  async linkProduct(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: { notes?: string },
  ) {
    return this.leadsService.linkProduct(
      req.user.tenantSchema,
      id,
      productId,
      req.user.sub,
      body.notes,
    );
  }

  @Delete(':id/products/:productId')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Unlink a product from a lead' })
  async unlinkProduct(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.leadsService.unlinkProduct(
      req.user.tenantSchema,
      id,
      productId,
      req.user.sub,
    );
  }

  @Put(':id/products/:productId/notes')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Update notes on a lead-product link' })
  async updateProductNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: { notes: string },
  ) {
    return this.leadsService.updateProductNotes(
      req.user.tenantSchema,
      id,
      productId,
      body.notes,
    );
  }
  
  // ============================================================
  // ACTIVITIES / NOTES / DOCUMENTS / HISTORY (shared pattern)
  // ============================================================

  @Get(':id/activities')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get lead activities' })
  async getActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.activityService.getTimeline(req.user.tenantSchema, 'leads', id, page, limit);
  }

  @Get(':id/history')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get lead change history' })
  async getHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.auditService.getHistory(req.user.tenantSchema, 'leads', id);
  }

  @Get(':id/notes')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get lead notes' })
  async getNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.notesService.findByEntity(req.user.tenantSchema, 'leads', id);
  }

  @Post(':id/notes')
  @RequirePermission('leads', 'edit')
  @ApiOperation({ summary: 'Add a note to a lead' })
  async addNote(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const note = await this.notesService.create(
      req.user.tenantSchema, 'leads', id, body.content, req.user.sub,
    );

    await this.activityService.create(req.user.tenantSchema, {
      entityType: 'leads',
      entityId: id,
      activityType: 'note_added',
      title: 'Note added',
      performedBy: req.user.sub,
    });

    // Update last_activity_at
    await this.leadsService['dataSource'].query(
      `UPDATE "${req.user.tenantSchema}".leads SET last_activity_at = NOW() WHERE id = $1`,
      [id],
    );

    return note;
  }

  @Get(':id/documents')
  @RequirePermission('leads', 'view')
  @ApiOperation({ summary: 'Get lead documents' })
  async getDocuments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantSchema, 'leads', id);
  }
}
