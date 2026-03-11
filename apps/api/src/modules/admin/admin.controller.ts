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
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomFieldsService, CreateCustomFieldDto } from './custom-fields.service';
import { ProfileCompletionService } from './profile-completion.service';
import { CustomTabsService, CreateCustomTabDto, UpdateCustomTabDto } from './custom-tabs.service';
import { CustomFieldGroupsService, CreateCustomFieldGroupDto, UpdateCustomFieldGroupDto } from './custom-field-groups.service';
import { AuditService } from '../shared/audit.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { MigrationRunnerService } from '../../database/migration-runner.service';
import { XeroService } from '../opportunities/xero.service';
import { AdminService } from './admin.service';

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
    private readonly dataSource: DataSource,
    private readonly xeroService: XeroService,
    private readonly adminService: AdminService,
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

  // ==================== INTEGRATIONS ====================

  @Get('integrations')
  async getIntegrations(@Req() req: AuthenticatedRequest) {
    const rows = await this.dataSource.query(
      `SELECT provider, is_enabled, config
       FROM public.tenant_integrations
       WHERE tenant_id = $1
       ORDER BY provider`,
      [req.user.tenantId],
    );
    return rows.map((r: any) => ({
      provider: r.provider,
      isEnabled: r.is_enabled,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
    }));
  }

  @Put('integrations/:provider')
  async updateIntegration(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
    @Body() body: { isEnabled: boolean; config: Record<string, string> },
  ) {
    const allowedProviders = ['docusign', 'xero', 'twilio', 'sendgrid', 'stripe', 'slack'];
    if (!allowedProviders.includes(provider)) {
      throw new BadRequestException(`Invalid provider: ${provider}`);
    }

    await this.dataSource.query(
      `INSERT INTO public.tenant_integrations (tenant_id, provider, is_enabled, config, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, provider)
       DO UPDATE SET is_enabled = $3, config = $4, updated_at = NOW()`,
      [req.user.tenantId, provider, body.isEnabled, JSON.stringify(body.config || {})],
    );

    await this.auditService.log(req.user.tenantSchema, {
      entityType: 'integration',
      entityId: provider,
      action: 'update',
      changes: {},
      newValues: { provider, isEnabled: body.isEnabled },
      performedBy: req.user.sub,
    });

    return { success: true, provider, isEnabled: body.isEnabled };
  }

  // ==================== XERO INTEGRATION ====================

  @Get('xero/auth-url')
  @ApiOperation({ summary: 'Get Xero OAuth2 consent URL' })
  async getXeroAuthUrl(@Req() req: AuthenticatedRequest) {
    const integration = await this.dataSource.query(
      `SELECT config FROM public.tenant_integrations
       WHERE tenant_id = $1 AND provider = 'xero'`,
      [req.user.tenantId],
    );
    if (!integration.length) {
      throw new BadRequestException('Xero integration not configured');
    }
    const cfg = typeof integration[0].config === 'string'
      ? JSON.parse(integration[0].config)
      : integration[0].config;
    return { url: await this.xeroService.getAuthUrl(req.user.tenantId, cfg.clientId, cfg.clientSecret) };
  }

  @Get('xero/callback')
  @ApiOperation({ summary: 'Handle Xero OAuth2 callback' })
  async handleXeroCallback(
    @Req() req: AuthenticatedRequest,
    @Query('url') url: string,
  ) {
    if (!url) throw new BadRequestException('Missing url query parameter');
    await this.xeroService.handleCallback(req.user.tenantId, url);
    return { success: true };
  }

  @Get('xero/sync-contacts')
  @ApiOperation({ summary: 'Sync CRM contacts/accounts with Xero contacts' })
  async syncXeroContacts(@Req() req: AuthenticatedRequest) {
    return this.xeroService.syncContacts(req.user.tenantId, req.user.tenantSchema);
  }

  @Post('xero/link-contact')
  @ApiOperation({ summary: 'Manually link a CRM record to a Xero contact' })
  async linkXeroContact(
    @Req() req: AuthenticatedRequest,
    @Body() body: { crmType: 'account' | 'contact'; crmId: string; xeroContactId: string },
  ) {
    await this.xeroService.linkContact(
      req.user.tenantSchema, body.crmType, body.crmId, body.xeroContactId,
    );
    return { success: true };
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

  // ==================== COMPANY SETTINGS ====================

  @Get('company-settings')
  async getCompanySettings(@Req() req: AuthenticatedRequest) {
    return this.adminService.getCompanySettings(req.user.tenantSchema);
  }

  @Put('company-settings')
  async updateCompanySettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, any>,
  ) {
    return this.adminService.updateCompanySettings(req.user.tenantSchema, body);
  }

  // ==================== INDUSTRIES ====================

  @Get('industries')
  async getIndustries(@Req() req: AuthenticatedRequest) {
    return this.adminService.getIndustries(req.user.tenantSchema);
  }

  @Post('industries')
  async createIndustry(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string },
  ) {
    return this.adminService.createIndustry(req.user.tenantSchema, body.name);
  }

  @Put('industries/:id')
  async updateIndustry(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    return this.adminService.updateIndustry(req.user.tenantSchema, id, body);
  }

  @Delete('industries/:id')
  async deleteIndustry(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteIndustry(req.user.tenantSchema, id);
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