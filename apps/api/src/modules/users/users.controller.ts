import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, InviteUserDto, UpdateUserDto, QueryUsersDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard } from '../../common/guards/permissions.guard';
import { RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { TenantService } from '../tenant/tenant.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private tenantService: TenantService,
  ) {}

  // ============================================================
  // LIST USERS
  // ============================================================
  @Get()
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'List users with filters' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryUsersDto,
  ) {
    return this.usersService.findAll(req.user.tenantSchema, query);
  }

  // ============================================================
  // LOOKUP ENDPOINTS (for dropdowns — no permission required beyond auth)
  // ============================================================
  @Get('lookup/roles')
  @ApiOperation({ summary: 'Get all roles for dropdown' })
  async getRoles(@Request() req: { user: JwtPayload }) {
    return this.usersService.getRoles(req.user.tenantSchema);
  }

  @Get('lookup/departments')
  @ApiOperation({ summary: 'Get all departments for dropdown' })
  async getDepartments(@Request() req: { user: JwtPayload }) {
    return this.usersService.getDepartments(req.user.tenantSchema);
  }

  @Get('lookup/teams')
  @ApiOperation({ summary: 'Get all teams for dropdown' })
  async getTeams(@Request() req: { user: JwtPayload }) {
    return this.usersService.getTeams(req.user.tenantSchema);
  }

  // ============================================================
  // ORG TREE
  // ============================================================
  @Get('org-tree')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get full org tree for org chart' })
  async getOrgTree(@Request() req: { user: JwtPayload }) {
    return this.usersService.getOrgTree(req.user.tenantSchema);
  }
  
  // ============================================================
  // INVITATIONS
  // ============================================================
  @Get('invitations')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get pending invitations' })
  async getPendingInvitations(@Request() req: { user: JwtPayload }) {
    return this.usersService.getPendingInvitations(req.user.tenantSchema);
  }

  @Post('invite')
  @RequirePermission('users', 'invite')
  @ApiOperation({ summary: 'Send email invitation to a new user' })
  async invite(
    @Request() req: { user: JwtPayload },
    @Body() dto: InviteUserDto,
  ) {
    const tenant = await this.tenantService.findById(req.user.tenantId);
    return this.usersService.invite(
      req.user.tenantSchema,
      req.user.sub,
      dto,
      tenant?.name || 'Organization',
      req.user.tenantSlug,
    );
  }

  @Post('invitations/:id/resend')
  @RequirePermission('users', 'invite')
  @ApiOperation({ summary: 'Resend an invitation email' })
  async resendInvitation(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const tenant = await this.tenantService.findById(req.user.tenantId);
    return this.usersService.resendInvitation(
      req.user.tenantSchema, id,
      tenant?.name || 'Organization',
      req.user.tenantSlug,
    );
  }

  @Delete('invitations/:id')
  @RequirePermission('users', 'invite')
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  async cancelInvitation(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.cancelInvitation(req.user.tenantSchema, id);
  }

  // ============================================================
  // CREATE USER DIRECTLY
  // ============================================================
  @Post()
  @RequirePermission('users', 'create')
  @ApiOperation({ summary: 'Create a user directly with password' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateUserDto,
  ) {
    const tenant = await this.tenantService.findById(req.user.tenantId);
    return this.usersService.create(
      req.user.tenantSchema,
      req.user.sub,
      dto,
      tenant?.name || 'Organization',
      req.user.tenantSlug,
    );
  }

  // ============================================================
  // GET USER BY ID
  // ============================================================
  @Get(':id')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get user by ID with full org context' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(req.user.tenantSchema, id);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // ============================================================
  // UPDATE USER
  // ============================================================
  @Put(':id')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Update user profile, role, or org assignment' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.tenantSchema, id, dto, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  // ============================================================
  // DEACTIVATE / ACTIVATE / DELETE
  // ============================================================
  @Put(':id/deactivate')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Deactivate a user' })
  async deactivate(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.deactivate(req.user.tenantSchema, id, req.user.sub);
  }

  @Put(':id/activate')
  @RequirePermission('users', 'edit')
  @ApiOperation({ summary: 'Activate a user' })
  async activate(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.activate(req.user.tenantSchema, id, req.user.sub);
  }

  // ── CHANGED: now passes req.user.sub for audit logging ──
  @Delete(':id')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Soft-delete a user' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // DIRECT REPORTS
  // ============================================================
  @Get(':id/direct-reports')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Get direct reports for a user' })
  async getDirectReports(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.usersService.getDirectReports(req.user.tenantSchema, id);
  }
}