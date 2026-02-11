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
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomFieldsService, CreateCustomFieldDto } from './custom-fields.service';
import { ProfileCompletionService } from './profile-completion.service';
import { CustomTabsService, CreateCustomTabDto, UpdateCustomTabDto } from './custom-tabs.service';
import { CustomFieldGroupsService, CreateCustomFieldGroupDto, UpdateCustomFieldGroupDto } from './custom-field-groups.service';
import { AuditService } from '../shared/audit.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { MigrationRunnerService } from '../../database/migration-runner.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    sub: string;
    email: string;
    tenantId: string;
    tenantSchema: string;
  };
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly customFieldsService: CustomFieldsService,
    private readonly profileCompletionService: ProfileCompletionService,
    private readonly customTabsService: CustomTabsService,
    private readonly customFieldGroupsService: CustomFieldGroupsService,
    private readonly migrationRunner: MigrationRunnerService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== CUSTOM FIELDS ====================

  @Get('custom-fields')
  async getCustomFields(
    @Req() req: AuthenticatedRequest,
    @Query('module') module: string,
  ) {
    return this.customFieldsService.findByModule(req.user.tenantSchema, module);
  }

  @Get('custom-fields/:id')
  async getCustomField(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.findOne(req.user.tenantSchema, id);
  }

  @Post('custom-fields')
  async createCustomField(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(req.user.tenantSchema, dto);
  }

  @Put('custom-fields/:id')
  async updateCustomField(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCustomFieldDto>,
  ) {
    return this.customFieldsService.update(req.user.tenantSchema, id, dto);
  }

  @Put('custom-fields/:id/toggle')
  async toggleCustomField(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.toggleActive(req.user.tenantSchema, id);
  }

  @Delete('custom-fields/:id')
  async deleteCustomField(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.customFieldsService.delete(req.user.tenantSchema, id);
  }

  @Put('custom-fields/reorder/:module')
  async reorderCustomFields(
    @Req() req: AuthenticatedRequest,
    @Param('module') module: string,
    @Body() body: { fieldIds: string[] },
  ) {
    return this.customFieldsService.reorder(req.user.tenantSchema, module, body.fieldIds);
  }

  // ==================== CUSTOM TABS ====================

  @Get('tabs')
  async getTabs(
    @Req() req: AuthenticatedRequest,
    @Query('module') module?: string,
  ) {
    if (module) {
      return this.customTabsService.findByModule(req.user.tenantSchema, module);
    }
    return this.customTabsService.findAll(req.user.tenantSchema);
  }

  @Get('tabs/:id')
  async getTab(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.customTabsService.findOne(req.user.tenantSchema, id);
  }

  @Post('tabs')
  async createTab(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomTabDto,
  ) {
    return this.customTabsService.create(req.user.tenantSchema, dto);
  }

  @Put('tabs/:id')
  async updateTab(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomTabDto,
  ) {
    return this.customTabsService.update(req.user.tenantSchema, id, dto);
  }

  @Delete('tabs/:id')
  async deleteTab(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.customTabsService.delete(req.user.tenantSchema, id);
    return { success: true };
  }

  @Put('tabs/reorder/:module')
  async reorderTabs(
    @Req() req: AuthenticatedRequest,
    @Param('module') module: string,
    @Body() body: { tabIds: string[] },
  ) {
    return this.customTabsService.reorder(req.user.tenantSchema, module, body.tabIds);
  }

  // ==================== CUSTOM FIELD GROUPS ====================

  @Get('groups')
  async getGroups(
    @Req() req: AuthenticatedRequest,
    @Query('module') module?: string,
    @Query('section') section?: string,
    @Query('tabId') tabId?: string,
  ) {
    if (tabId) {
      return this.customFieldGroupsService.findByTab(req.user.tenantSchema, tabId);
    }
    if (module && section) {
      return this.customFieldGroupsService.findBySection(req.user.tenantSchema, module, section);
    }
    if (module) {
      return this.customFieldGroupsService.findByModule(req.user.tenantSchema, module);
    }
    return this.customFieldGroupsService.findAll(req.user.tenantSchema);
  }

  @Get('groups/:id')
  async getGroup(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.customFieldGroupsService.findOne(req.user.tenantSchema, id);
  }

  @Post('groups')
  async createGroup(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomFieldGroupDto,
  ) {
    return this.customFieldGroupsService.create(req.user.tenantSchema, dto);
  }

  @Put('groups/:id')
  async updateGroup(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldGroupDto,
  ) {
    return this.customFieldGroupsService.update(req.user.tenantSchema, id, dto);
  }

  @Delete('groups/:id')
  async deleteGroup(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.customFieldGroupsService.delete(req.user.tenantSchema, id);
    return { success: true };
  }

  @Put('groups/reorder/:module')
  async reorderGroups(
    @Req() req: AuthenticatedRequest,
    @Param('module') module: string,
    @Body() body: { groupIds: string[] },
  ) {
    return this.customFieldGroupsService.reorder(req.user.tenantSchema, module, body.groupIds);
  }

  // ==================== PROFILE COMPLETION ====================

  @Get('profile-completion/:module')
  async getProfileCompletionConfig(
    @Req() req: AuthenticatedRequest,
    @Param('module') module: string,
  ) {
    const config = await this.profileCompletionService.getConfig(req.user.tenantSchema, module);
    const standardFields = this.profileCompletionService.getStandardFields(module);
    return { config, standardFields };
  }

  @Put('profile-completion/:module')
  async updateProfileCompletionConfig(
    @Req() req: AuthenticatedRequest,
    @Param('module') module: string,
    @Body() body: {
      isEnabled?: boolean;
      minPercentage?: number;
      fieldWeights?: Record<string, { weight: number; label: string; category?: string }>;
    },
  ) {
    return this.profileCompletionService.updateConfig(
      req.user.tenantSchema,
      module,
      body.fieldWeights || {},
      body.isEnabled ?? true,
      body.minPercentage ?? 0,
    );
  }

  // ==================== MIGRATIONS ====================

  @Post('migrations/run')
  @UseGuards(JwtAuthGuard)
  async runMigrations() {
    const results = await this.migrationRunner.runMigrationsForAllTenants();
    const output: Record<string, string[]> = {};
    results.forEach((migrations, schema) => {
      output[schema] = migrations;
    });
    return { success: true, results: output };
  }

  @Get('migrations/status')
  @UseGuards(JwtAuthGuard)
  async getMigrationStatus() {
    return this.migrationRunner.getMigrationStatus();
  }

  // ==================== D8: AUDIT LOGS ====================

  @Get('audit-logs')
  async getAuditLogs(
    @Req() req: AuthenticatedRequest,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.auditService.query(req.user.tenantSchema, {
      entityType,
      entityId,
      action,
      performedBy,
      startDate,
      endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 50,
      sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
    });
  }

  @Get('audit-logs/:entityType/:entityId')
  async getEntityAuditHistory(
    @Req() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.getHistory(
      req.user.tenantSchema,
      entityType,
      entityId,
      limit ? Math.min(parseInt(limit), 50) : 50,
    );
  }
}