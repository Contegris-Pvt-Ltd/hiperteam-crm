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

  @Get(':id/submissions')
  @RequirePermission('forms', 'view')
  async getSubmissions(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.formsService.getSubmissions(req.user.tenantSchema, id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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
}
