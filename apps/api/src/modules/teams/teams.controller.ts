import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, QueryTeamsDto, ManageTeamMemberDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/guards/permissions.guard';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'List teams with filters' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryTeamsDto,
  ) {
    return this.teamsService.findAll(req.user.tenantSchema, query);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Get teams for dropdown (any authenticated user)' })
  async getLookup(
    @Request() req: { user: JwtPayload },
    @Query('departmentId') departmentId?: string,
  ) {
    return this.teamsService.getLookup(req.user.tenantSchema, departmentId);
  }

  @Get(':id')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get team detail with members' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.teamsService.findOne(req.user.tenantSchema, id);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Post()
  @RequirePermission('users', 'create')
  @ApiOperation({ summary: 'Create team' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.create(req.user.tenantSchema, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Put(':id')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Update team' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(req.user.tenantSchema, id, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Delete(':id')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Delete team and remove all memberships' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.teamsService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Post(':id/members')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Add member to team or update their role' })
  async addMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ManageTeamMemberDto,
  ) {
    return this.teamsService.addMember(req.user.tenantSchema, id, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Delete(':id/members/:userId')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Remove member from team' })
  async removeMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeMember(req.user.tenantSchema, id, userId, req.user.sub);
  }
}