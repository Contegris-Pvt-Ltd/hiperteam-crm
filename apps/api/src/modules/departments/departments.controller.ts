import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, QueryDepartmentsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/guards/permissions.guard';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'List departments with filters' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryDepartmentsDto,
  ) {
    return this.departmentsService.findAll(req.user.tenantSchema, query);
  }

  @Get('hierarchy')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get department hierarchy tree' })
  async getHierarchy(@Request() req: { user: JwtPayload }) {
    return this.departmentsService.getHierarchy(req.user.tenantSchema);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Get departments for dropdown (any authenticated user)' })
  async getLookup(
    @Request() req: { user: JwtPayload },
    @Query('excludeId') excludeId?: string,
  ) {
    return this.departmentsService.getLookup(req.user.tenantSchema, excludeId);
  }

  @Get(':id')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get department detail with members, teams, children' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.departmentsService.findOne(req.user.tenantSchema, id);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Post()
  @RequirePermission('users', 'create')
  @ApiOperation({ summary: 'Create department' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(req.user.tenantSchema, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Put(':id')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Update department' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(req.user.tenantSchema, id, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Delete(':id')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Delete department (must have no members, teams, or children)' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.departmentsService.remove(req.user.tenantSchema, id, req.user.sub);
  }
}