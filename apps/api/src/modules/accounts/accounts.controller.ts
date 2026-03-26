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
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto, QueryAccountsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { DocumentsService } from '../shared/documents.service';
import { NotesService } from '../shared/notes.service';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private accountsService: AccountsService,
    private auditService: AuditService,
    private activityService: ActivityService,
    private documentsService: DocumentsService,
    private notesService: NotesService,
  ) {}

  // ── Bulk operations (named routes MUST come before :id) ──

  @Post('bulk/update')
  @ApiOperation({ summary: 'Bulk update accounts' })
  async bulkUpdate(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[]; updates: Record<string, any> },
  ) {
    return this.accountsService.bulkUpdate(req.user.tenantSchema, req.user.sub, body.ids, body.updates);
  }

  @Post('bulk/delete')
  @ApiOperation({ summary: 'Bulk delete accounts' })
  async bulkDelete(
    @Request() req: { user: JwtPayload },
    @Body() body: { ids: string[] },
  ) {
    return this.accountsService.bulkDelete(req.user.tenantSchema, req.user.sub, body.ids);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get('export')
  @UseGuards(PermissionGuard)
  @RequirePermission('accounts', 'export')
  @ApiOperation({ summary: 'Export accounts to XLSX' })
  async exportData(
    @Request() req: { user: JwtPayload },
    @Query() query: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.accountsService.exportData(req.user.tenantSchema, req.user.sub, query);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Get all accounts' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryAccountsDto,
  ) {
    return this.accountsService.findAll(req.user.tenantSchema, query, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an account by ID' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.accountsService.findOne(req.user.tenantSchema, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.accountsService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // Contacts relationship
  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get contacts linked to this account' })
  async getContacts(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.accountsService.getContacts(req.user.tenantSchema, id);
  }

  @Post(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Link a contact to this account' })
  async linkContact(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() body: { role?: string; isPrimary?: boolean },
  ) {
    return this.accountsService.linkContact(
      req.user.tenantSchema,
      id,
      contactId,
      body.role || '',
      body.isPrimary ?? false,
      req.user.sub,
    );
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Unlink a contact from this account' })
  async unlinkContact(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.accountsService.unlinkContact(req.user.tenantSchema, id, contactId, req.user.sub);
  }

  // Child accounts
  @Get(':id/children')
  @ApiOperation({ summary: 'Get child accounts' })
  async getChildAccounts(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.accountsService.getChildAccounts(req.user.tenantSchema, id);
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
    return this.activityService.getTimeline(req.user.tenantSchema, 'accounts', id, page, limit);
  }

  // Audit history
  @Get(':id/history')
  @ApiOperation({ summary: 'Get change history' })
  async getHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.auditService.getHistory(req.user.tenantSchema, 'accounts', id);
  }

  // Documents
  @Get(':id/documents')
  @ApiOperation({ summary: 'Get documents' })
  async getDocuments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantSchema, 'accounts', id);
  }

  // Notes
  @Get(':id/notes')
  @ApiOperation({ summary: 'Get notes' })
  async getNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.notesService.findByEntity(req.user.tenantSchema, 'accounts', id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note' })
  async addNote(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.notesService.create(req.user.tenantSchema, 'accounts', id, body.content, req.user.sub);
  }
}