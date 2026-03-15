import {
  Controller, Get, Post, Put, Delete, Body, Param, Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, AdminOnly } from '../../common/guards/permissions.guard';
import { ApiKeysService } from './api-keys.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  tenantSchema: string;
  roleLevel: number;
}

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @AdminOnly()
  async findAll(@Request() req: { user: JwtPayload }) {
    return this.apiKeysService.findAll(req.user.tenantSchema);
  }

  @Get(':id')
  @AdminOnly()
  async findOne(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.apiKeysService.findOne(req.user.tenantSchema, id);
  }

  @Post()
  @AdminOnly()
  async create(
    @Request() req: { user: JwtPayload },
    @Body() body: { label: string; description?: string; roleId: string; expiresIn?: '30d' | '90d' | '1y' | 'never' },
  ) {
    return this.apiKeysService.create(
      req.user.tenantSchema,
      req.user.sub,
      body,
      req.user.tenantId,
      req.user.tenantSlug,
    );
  }

  @Post(':id/regenerate')
  @AdminOnly()
  async regenerate(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.apiKeysService.regenerate(
      req.user.tenantSchema,
      id,
      req.user.sub,
      req.user.tenantId,
      req.user.tenantSlug,
    );
  }

  @Put(':id/status')
  @AdminOnly()
  async updateStatus(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'inactive' },
  ) {
    return this.apiKeysService.updateStatus(req.user.tenantSchema, id, req.user.sub, body.status);
  }

  @Delete(':id')
  @AdminOnly()
  async remove(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.apiKeysService.remove(req.user.tenantSchema, id, req.user.sub);
  }
}
