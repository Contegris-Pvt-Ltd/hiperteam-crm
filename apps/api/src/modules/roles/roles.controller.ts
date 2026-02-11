import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, QueryRolesDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/guards/permissions.guard';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  // GET /roles — list all roles
  @Get()
  @RequirePermission('roles', 'view')
  @ApiOperation({ summary: 'List roles' })
  findAll(@Request() req: { user: JwtPayload }, @Query() query: QueryRolesDto) {
    return this.rolesService.findAll(req.user.tenantSchema, query);
  }

  // GET /roles/module-definitions — get module/action definitions for grid builder
  @Get('module-definitions')
  @ApiOperation({ summary: 'Get module/action definitions for permission grid' })
  getModuleDefinitions() {
    return this.rolesService.getModuleDefinitions();
  }

  // GET /roles/:id — single role detail
  @Get(':id')
  @RequirePermission('roles', 'view')
  @ApiOperation({ summary: 'Get role detail with assigned users' })
  findOne(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.rolesService.findOne(req.user.tenantSchema, id);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // POST /roles — create custom role
  @Post()
  @RequirePermission('roles', 'create')
  @ApiOperation({ summary: 'Create custom role' })
  create(@Request() req: { user: JwtPayload }, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(req.user.tenantSchema, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // POST /roles/:id/clone — clone an existing role
  @Post(':id/clone')
  @RequirePermission('roles', 'create')
  @ApiOperation({ summary: 'Clone an existing role' })
  clone(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.rolesService.clone(req.user.tenantSchema, id, name, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // PUT /roles/:id — update role
  @Put(':id')
  @RequirePermission('roles', 'edit')
  @ApiOperation({ summary: 'Update role (permissions, record access, etc.)' })
  update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(req.user.tenantSchema, id, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // DELETE /roles/:id — delete custom role
  @Delete(':id')
  @RequirePermission('roles', 'delete')
  @ApiOperation({ summary: 'Delete custom role (system roles protected)' })
  remove(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.rolesService.remove(req.user.tenantSchema, id, req.user.sub);
  }
}