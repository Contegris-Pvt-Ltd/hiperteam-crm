import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { FormsService } from './forms.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

// ── Authenticated Controller ────────────────────────────────
@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @RequirePermission('forms', 'view')
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.formsService.findAll(req.user.tenantSchema, {
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ── Module-linked form endpoints (named routes BEFORE :id) ──

  @Get('module/:moduleName')
  @RequirePermission('forms', 'view')
  async getFormsForModule(
    @Request() req: { user: JwtPayload },
    @Param('moduleName') moduleName: string,
  ) {
    return this.formsService.getFormsForModule(req.user.tenantSchema, moduleName);
  }

  @Get('entity/:entityType/:entityId/submissions')
  @RequirePermission('forms', 'view')
  async getEntitySubmissions(
    @Request() req: { user: JwtPayload },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('formId') formId?: string,
  ) {
    return this.formsService.getEntitySubmissions(
      req.user.tenantSchema,
      entityType,
      entityId,
      formId,
    );
  }

  @Post('entity/submit')
  @RequirePermission('forms', 'create')
  async submitEntityForm(
    @Request() req: { user: JwtPayload },
    @Body() body: { formId: string; entityType: string; entityId: string; data: Record<string, any> },
  ) {
    return this.formsService.submitEntityForm(req.user.tenantSchema, req.user.sub, body);
  }

  @Post('entity/send-email')
  @RequirePermission('forms', 'create')
  async sendFormEmail(
    @Request() req: { user: JwtPayload },
    @Body() body: {
      formId: string;
      entityType: string;
      entityId: string;
      recipients: string[];
      subject: string;
      body: string;
      expiresInHours?: number;
    },
  ) {
    return this.formsService.sendFormEmail(req.user.tenantSchema, req.user.sub, body);
  }

  @Post('entity/generate-link')
  @RequirePermission('forms', 'create')
  async generateFormLink(
    @Request() req: { user: JwtPayload },
    @Body() body: { formId: string; entityType: string; entityId: string; expiresInHours?: number },
  ) {
    return this.formsService.generateFormLink(req.user.tenantSchema, req.user.sub, body);
  }

  @Delete('entity/submissions/:submissionId')
  @RequirePermission('forms', 'delete')
  async deleteEntitySubmission(
    @Request() req: { user: JwtPayload },
    @Param('submissionId') submissionId: string,
  ) {
    return this.formsService.deleteEntitySubmission(req.user.tenantSchema, req.user.sub, submissionId);
  }

  // ── Existing :id routes ───────────────────────────────────

  @Get(':id')
  @RequirePermission('forms', 'view')
  async findById(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.formsService.findById(req.user.tenantSchema, id);
  }

  @Post()
  @RequirePermission('forms', 'create')
  async create(@Request() req: { user: JwtPayload }, @Body() body: any) {
    return this.formsService.create(req.user.tenantSchema, req.user.sub, body);
  }

  @Put(':id')
  @RequirePermission('forms', 'edit')
  async update(@Request() req: { user: JwtPayload }, @Param('id') id: string, @Body() body: any) {
    return this.formsService.update(req.user.tenantSchema, req.user.sub, id, body);
  }

  @Delete(':id')
  @RequirePermission('forms', 'delete')
  async delete(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.formsService.delete(req.user.tenantSchema, req.user.sub, id);
  }

  @Post(':id/duplicate')
  @RequirePermission('forms', 'create')
  async duplicate(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.formsService.duplicate(req.user.tenantSchema, req.user.sub, id);
  }

  @Get(':id/analytics')
  @RequirePermission('forms', 'view')
  async getAnalytics(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.formsService.getAnalytics(req.user.tenantSchema, id);
  }

  @Get(':id/submissions')
  @RequirePermission('forms', 'view')
  async getSubmissions(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('actionStatus') actionStatus?: string,
  ) {
    return this.formsService.getSubmissions(req.user.tenantSchema, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      startDate,
      endDate,
      actionStatus,
    });
  }

  @Post(':id/submissions/:submissionId/retry-webhook')
  @RequirePermission('forms', 'edit')
  async retryWebhook(
    @Request() req: { user: JwtPayload },
    @Param('submissionId') submissionId: string,
    @Body() body: { actionIndex: number },
  ) {
    return this.formsService.retryWebhook(
      req.user.tenantSchema,
      submissionId,
      body.actionIndex ?? 0,
    );
  }
}

// ── Public Controller (no auth) ─────────────────────────────
@ApiTags('Forms Public')
@Controller('forms/public')
export class FormsPublicController {
  constructor(private readonly formsService: FormsService) {}

  @Get(':tenantSlug/:token')
  async getPublicForm(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
  ) {
    const { form } = await this.formsService.resolvePublicForm(tenantSlug, token);
    return {
      id: form.id,
      name: form.name,
      description: form.description,
      fields: form.fields,
      settings: form.settings,
      branding: form.branding,
      isLandingPage: form.isLandingPage,
      landingPageConfig: form.landingPageConfig,
    };
  }

  @Post(':tenantSlug/:token/submit')
  async submitPublicForm(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const metadata = {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
    };
    return this.formsService.processSubmission(tenantSlug, token, body, metadata);
  }

  // Get form details by access token (module-linked, no auth)
  @Get('form/:token')
  async getPublicFormByToken(
    @Param('token') token: string,
    @Query('tenant') tenantSchema: string,
  ) {
    let schema: string = tenantSchema;
    if (!schema) {
      const resolved = await this.formsService.resolveTokenTenant(token);
      if (!resolved) throw new NotFoundException('Invalid or expired form link');
      schema = resolved;
    }
    // Look up the submission + form details
    const [submission] = await this.formsService['dataSource'].query(
      `SELECT fs.id, fs.form_id, fs.status, fs.token_expires_at,
              f.name as form_name, f.description, f.fields as form_fields, f.settings, f.branding
       FROM "${schema}".form_submissions fs
       JOIN "${schema}".forms f ON f.id = fs.form_id
       WHERE fs.access_token = $1 AND fs.deleted_at IS NULL`,
      [token],
    );
    if (!submission) throw new NotFoundException('Invalid or expired form link');
    if (submission.status !== 'pending') throw new BadRequestException('This form has already been submitted');
    if (submission.token_expires_at && new Date(submission.token_expires_at) < new Date()) {
      throw new BadRequestException('This form link has expired');
    }
    return {
      formName: submission.form_name,
      description: submission.description,
      formFields: submission.form_fields,
      settings: submission.settings,
      branding: submission.branding,
    };
  }

  // Public form submission via access token (module-linked, no auth)
  @Post('submit/:token')
  async submitPublicFormByToken(
    @Param('token') token: string,
    @Query('tenant') tenantSchema: string,
    @Body() body: { data: Record<string, any>; email?: string },
  ) {
    // Resolve tenant schema from query param or by scanning tenants
    let schema: string = tenantSchema;
    if (!schema) {
      const resolved = await this.formsService.resolveTokenTenant(token);
      if (!resolved) throw new NotFoundException('Invalid or expired form link');
      schema = resolved;
    }
    return this.formsService.submitPublicFormByToken(schema, token, body.data, body.email);
  }
}
