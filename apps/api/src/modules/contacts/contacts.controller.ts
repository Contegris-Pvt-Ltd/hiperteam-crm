import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, QueryContactsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { DocumentsService } from '../shared/documents.service';
import { NotesService } from '../shared/notes.service';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(
    private contactsService: ContactsService,
    private auditService: AuditService,
    private activityService: ActivityService,
    private documentsService: DocumentsService,
    private notesService: NotesService,
  ) {}

  // ── Bulk operations (named routes MUST come before :id) ──

  @Post('bulk/update')
  @ApiOperation({ summary: 'Bulk update contacts' })
  async bulkUpdate(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[]; updates: Record<string, any> },
  ) {
    return this.contactsService.bulkUpdate(req.user.tenantSchema, req.user.sub, body.ids, body.updates);
  }

  @Post('bulk/delete')
  @ApiOperation({ summary: 'Bulk delete contacts' })
  async bulkDelete(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[] },
  ) {
    return this.contactsService.bulkDelete(req.user.tenantSchema, req.user.sub, body.ids);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contact' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get('export')
  @UseGuards(PermissionGuard)
  @RequirePermission('contacts', 'export')
  @ApiOperation({ summary: 'Export contacts to XLSX' })
  async exportData(
    @Request() req: { user: JwtPayload },
    @Query() query: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.contactsService.exportData(req.user.tenantSchema, req.user.sub, query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contacts' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryContactsDto,
  ) {
    return this.contactsService.findAll(req.user.tenantSchema, query, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact by ID' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.findOne(req.user.tenantSchema, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // Accounts relationship
  @Get(':id/accounts')
  @ApiOperation({ summary: 'Get accounts linked to this contact' })
  async getAccounts(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.contactsService.getAccounts(req.user.tenantSchema, id);
  }

  @Post(':id/accounts/:accountId')
  @ApiOperation({ summary: 'Link an account to this contact' })
  async linkAccount(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Body() body: { role?: string; isPrimary?: boolean },
  ) {
    return this.contactsService.linkAccount(
      req.user.tenantSchema,
      id,
      accountId,
      body.role || '',
      body.isPrimary || false,
      req.user.sub,
    );
  }

  @Delete(':id/accounts/:accountId')
  @ApiOperation({ summary: 'Unlink an account from this contact' })
  async unlinkAccount(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    return this.contactsService.unlinkAccount(req.user.tenantSchema, id, accountId, req.user.sub);
  }

  // Activity timeline
  @Get(':id/activities')
  @ApiOperation({ summary: 'Get activity timeline' })
  async getActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.activityService.getTimeline(req.user.tenantSchema, 'contacts', id, page, limit);
  }

  // Audit history
  @Get(':id/history')
  @ApiOperation({ summary: 'Get change history' })
  async getHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.auditService.getHistory(req.user.tenantSchema, 'contacts', id);
  }

  // Documents
  @Get(':id/documents')
  @ApiOperation({ summary: 'Get documents' })
  async getDocuments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantSchema, 'contacts', id);
  }

  // Notes
  @Get(':id/notes')
  @ApiOperation({ summary: 'Get notes' })
  async getNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.notesService.findByEntity(req.user.tenantSchema, 'contacts', id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note' })
  async addNote(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.notesService.create(req.user.tenantSchema, 'contacts', id, body.content, req.user.sub);
  }
}