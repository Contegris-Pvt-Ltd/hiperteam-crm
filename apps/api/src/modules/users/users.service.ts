import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { AuditService } from '../shared/audit.service';
import { CreateUserDto, InviteUserDto, UpdateUserDto, QueryUsersDto } from './dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private readonly trackedFields = [
    'firstName', 'lastName', 'email', 'phone', 'status', 'jobTitle',
    'departmentId', 'managerId', 'roleId', 'timezone', 'employeeId',
  ];

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // LIST USERS
  // ============================================================
  async findAll(schema: string, query: QueryUsersDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.search) {
      conditions.push(`(
        u.first_name ILIKE $${paramIdx} OR
        u.last_name ILIKE $${paramIdx} OR
        u.email ILIKE $${paramIdx} OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIdx}
      )`);
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.status) {
      conditions.push(`u.status = $${paramIdx}`);
      params.push(query.status);
      paramIdx++;
    }

    if (query.departmentId) {
      conditions.push(`u.department_id = $${paramIdx}`);
      params.push(query.departmentId);
      paramIdx++;
    }

    if (query.roleId) {
      conditions.push(`u.role_id = $${paramIdx}`);
      params.push(query.roleId);
      paramIdx++;
    }

    if (query.managerId) {
      conditions.push(`u.manager_id = $${paramIdx}`);
      params.push(query.managerId);
      paramIdx++;
    }

    if (query.teamId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM "${schema}".user_teams ut WHERE ut.user_id = u.id AND ut.team_id = $${paramIdx}
      )`);
      params.push(query.teamId);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const sortMap: Record<string, string> = {
      first_name: 'u.first_name',
      last_name: 'u.last_name',
      email: 'u.email',
      status: 'u.status',
      created_at: 'u.created_at',
      last_login_at: 'u.last_login_at',
    };
    const sortCol = sortMap[query.sortBy || 'first_name'] || 'u.first_name';
    const sortDir = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM "${schema}".users u WHERE ${whereClause}`,
      params,
    );

    const users = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
              u.job_title, u.avatar_url, u.timezone, u.employee_id,
              u.department_id, u.manager_id, u.last_login_at,
              u.created_at, u.updated_at,
              r.id as role_id, r.name as role_name, r.level as role_level,
              d.name as department_name,
              m.first_name as manager_first_name, m.last_name as manager_last_name
       FROM "${schema}".users u
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       LEFT JOIN "${schema}".departments d ON u.department_id = d.id
       LEFT JOIN "${schema}".users m ON u.manager_id = m.id
       WHERE ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total);

    return {
      data: users.map((u: Record<string, unknown>) => this.formatUser(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // GET SINGLE USER
  // ============================================================
  async findOne(schema: string, id: string) {
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
              u.job_title, u.avatar_url, u.timezone, u.employee_id,
              u.department_id, u.manager_id, u.invited_by, u.invited_at,
              u.last_login_at, u.created_at, u.updated_at,
              r.id as role_id, r.name as role_name, r.level as role_level,
              d.name as department_name, d.code as department_code,
              m.first_name as manager_first_name, m.last_name as manager_last_name, m.email as manager_email
       FROM "${schema}".users u
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       LEFT JOIN "${schema}".departments d ON u.department_id = d.id
       LEFT JOIN "${schema}".users m ON u.manager_id = m.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id],
    );
    if (!user) throw new NotFoundException('User not found');

    // Get teams
    const teams = await this.dataSource.query(
      `SELECT t.id, t.name, t.description, ut.role as team_role, ut.joined_at
       FROM "${schema}".user_teams ut
       JOIN "${schema}".teams t ON ut.team_id = t.id
       WHERE ut.user_id = $1 AND t.is_active = true`,
      [id],
    );

    // Get territories
    const territories = await this.dataSource.query(
      `SELECT t.id, t.name, t.code, t.type, utr.role as territory_role
       FROM "${schema}".user_territories utr
       JOIN "${schema}".territories t ON utr.territory_id = t.id
       WHERE utr.user_id = $1 AND t.is_active = true`,
      [id],
    );

    // Direct reports count
    const [reportsCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".users WHERE manager_id = $1 AND deleted_at IS NULL`,
      [id],
    );

    return {
      ...this.formatUser(user),
      teams: teams.map((t: Record<string, unknown>) => ({
        id: t.id, name: t.name, description: t.description,
        role: t.team_role, joinedAt: t.joined_at,
      })),
      territories: territories.map((t: Record<string, unknown>) => ({
        id: t.id, name: t.name, code: t.code, type: t.type, role: t.territory_role,
      })),
      directReportsCount: parseInt(reportsCount.count as string),
    };
  }

  // ============================================================
  // CREATE USER DIRECTLY (by Admin)
  // ============================================================
  async create(schema: string, adminUserId: string, dto: CreateUserDto, tenantName: string, tenantSlug: string) {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schema}".users WHERE email = $1 AND deleted_at IS NULL`,
      [dto.email.toLowerCase()],
    );
    if (existing) throw new ConflictException('A user with this email already exists');

    let roleId = dto.roleId;
    if (!roleId) {
      const [defaultRole] = await this.dataSource.query(
        `SELECT id FROM "${schema}".roles WHERE name = 'user' LIMIT 1`,
      );
      roleId = defaultRole?.id;
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [newUser] = await this.dataSource.query(
      `INSERT INTO "${schema}".users
       (email, password_hash, first_name, last_name, phone, role_id, department_id, manager_id,
        job_title, timezone, employee_id, status, invited_by, invited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, NOW())
       RETURNING id`,
      [
        dto.email.toLowerCase(), passwordHash, dto.firstName, dto.lastName,
        dto.phone || null, roleId, dto.departmentId || null, dto.managerId || null,
        dto.jobTitle || null, dto.timezone || 'UTC', dto.employeeId || null, adminUserId,
      ],
    );

    if (dto.teamIds?.length) {
      await this.syncTeams(schema, newUser.id, dto.teamIds);
    }

    // Send welcome email
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    await this.emailService.sendWelcomeEmail({
      to: dto.email,
      firstName: dto.firstName,
      tenantName,
      loginUrl: `${frontendUrl}/login?tenant=${tenantSlug}`,
      temporaryPassword: dto.password,
    });

    const result = await this.findOne(schema, newUser.id);

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: newUser.id,
      action: 'create',
      changes: {},
      newValues: result,
      performedBy: adminUserId,
    });

    return result;
  }

  // ============================================================
  // INVITE USER (Email Invitation)
  // ============================================================
  async invite(schema: string, inviterUserId: string, dto: InviteUserDto, tenantName: string, tenantSlug: string) {
    const email = dto.email.toLowerCase();

    const [existingUser] = await this.dataSource.query(
      `SELECT id FROM "${schema}".users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const [existingInvite] = await this.dataSource.query(
      `SELECT id FROM "${schema}".user_invitations WHERE email = $1 AND status = 'pending' AND expires_at > NOW()`,
      [email],
    );
    if (existingInvite) throw new ConflictException('A pending invitation already exists for this email');

    let roleId = dto.roleId;
    if (!roleId) {
      const [defaultRole] = await this.dataSource.query(
        `SELECT id FROM "${schema}".roles WHERE name = 'user' LIMIT 1`,
      );
      roleId = defaultRole?.id;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invitation] = await this.dataSource.query(
      `INSERT INTO "${schema}".user_invitations
       (email, first_name, last_name, role_id, department_id, team_ids, job_title, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        email, dto.firstName || null, dto.lastName || null, roleId,
        dto.departmentId || null, dto.teamIds?.length ? dto.teamIds : '{}',
        dto.jobTitle || null, inviterUserId, token, expiresAt,
      ],
    );

    // Get inviter name + role name
    const [inviter] = await this.dataSource.query(
      `SELECT first_name, last_name FROM "${schema}".users WHERE id = $1`, [inviterUserId],
    );
    const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}` : 'Admin';
    const [role] = await this.dataSource.query(
      `SELECT name FROM "${schema}".roles WHERE id = $1`, [roleId],
    );

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const inviteUrl = `${frontendUrl}/invite/accept?token=${token}&tenant=${tenantSlug}`;

    await this.emailService.sendInviteEmail({
      to: email, inviterName, tenantName, inviteUrl,
      roleName: role?.name || 'User', expiresAt,
    });

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: invitation.id,
      action: 'invite',
      changes: {},
      newValues: { email, roleId, departmentId: dto.departmentId },
      performedBy: inviterUserId,
      metadata: { inviteeEmail: email },
    });

    return {
      message: 'Invitation sent successfully',
      email,
      expiresAt,
      inviteUrl: this.configService.get('app.env') === 'development' ? inviteUrl : undefined,
    };
  }

  // ============================================================
  // ACCEPT INVITATION
  // ============================================================
  async acceptInvitation(schema: string, token: string, password: string) {
    const [invitation] = await this.dataSource.query(
      `SELECT i.*, r.name as role_name FROM "${schema}".user_invitations i
       LEFT JOIN "${schema}".roles r ON i.role_id = r.id
       WHERE i.token = $1 AND i.status = 'pending'`,
      [token],
    );
    if (!invitation) throw new NotFoundException('Invalid or expired invitation');

    if (new Date(invitation.expires_at) < new Date()) {
      await this.dataSource.query(
        `UPDATE "${schema}".user_invitations SET status = 'expired' WHERE id = $1`, [invitation.id],
      );
      throw new BadRequestException('This invitation has expired');
    }

    const [existingUser] = await this.dataSource.query(
      `SELECT id FROM "${schema}".users WHERE email = $1 AND deleted_at IS NULL`, [invitation.email],
    );
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await this.dataSource.query(
      `INSERT INTO "${schema}".users
       (email, password_hash, first_name, last_name, role_id, department_id,
        job_title, status, invited_by, invited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW())
       RETURNING id`,
      [
        invitation.email, passwordHash,
        invitation.first_name || '', invitation.last_name || '',
        invitation.role_id, invitation.department_id,
        invitation.job_title, invitation.invited_by,
      ],
    );

    if (invitation.team_ids?.length) {
      await this.syncTeams(schema, newUser.id, invitation.team_ids);
    }

    await this.dataSource.query(
      `UPDATE "${schema}".user_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invitation.id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: newUser.id,
      action: 'invite',
      changes: {},
      performedBy: newUser.id,
      metadata: { step: 'accepted', email: invitation.email },
    });

    return { message: 'Account created successfully', userId: newUser.id };
  }

  // ============================================================
  // UPDATE USER
  // ============================================================
  async update(schema: string, id: string, dto: UpdateUserDto, userId: string) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('User not found');

    const previousValues = this.formatUser(existing);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name', lastName: 'last_name', phone: 'phone',
      roleId: 'role_id', departmentId: 'department_id', managerId: 'manager_id',
      jobTitle: 'job_title', avatarUrl: 'avatar_url', timezone: 'timezone',
      employeeId: 'employee_id', status: 'status',
    };

    for (const [dtoField, dbField] of Object.entries(fieldMap)) {
      const value = (dto as Record<string, unknown>)[dtoField];
      if (value !== undefined) {
        updates.push(`${dbField} = $${paramIdx}`);
        params.push(value === '' ? null : value);
        paramIdx++;
      }
    }

    if (updates.length === 0 && !dto.teamIds) return this.findOne(schema, id);

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(id);
      await this.dataSource.query(
        `UPDATE "${schema}".users SET ${updates.join(', ')} WHERE id = $${paramIdx} AND deleted_at IS NULL`,
        params,
      );
    }

    if (dto.teamIds !== undefined) {
      await this.syncTeams(schema, id, dto.teamIds);
    }

    const result = await this.findOne(schema, id);

    // ── Audit Log ──
    const changes = this.auditService.calculateChanges(previousValues, result, this.trackedFields);
    if (Object.keys(changes).length > 0) {
      await this.auditService.log(schema, {
        entityType: 'users',
        entityId: id,
        action: 'update',
        changes,
        previousValues,
        newValues: result,
        performedBy: userId,
      });
    }

    return result;
  }

  // ============================================================
  // DEACTIVATE / DELETE
  // ============================================================
  async deactivate(schema: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('User not found');

    await this.dataSource.query(
      `UPDATE "${schema}".users SET status = 'inactive', updated_at = NOW() WHERE id = $1`, [id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: id,
      action: 'status_change',
      changes: { status: { from: 'active', to: 'inactive' } },
      performedBy: userId,
      metadata: { action: 'deactivate' },
    });

    return { message: 'User deactivated' };
  }

  async activate(schema: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('User not found');

    await this.dataSource.query(
      `UPDATE "${schema}".users SET status = 'active', updated_at = NOW() WHERE id = $1`, [id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: id,
      action: 'status_change',
      changes: { status: { from: 'inactive', to: 'active' } },
      performedBy: userId,
      metadata: { action: 'activate' },
    });

    return { message: 'User activated' };
  }

  async remove(schema: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schema, id);
    if (!existing) throw new NotFoundException('User not found');

    await this.dataSource.query(
      `UPDATE "${schema}".users SET deleted_at = NOW(), status = 'inactive' WHERE id = $1`, [id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'users',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: this.formatUser(existing),
      performedBy: userId,
    });

    return { message: 'User deleted' };
  }

  // ============================================================
  // DIRECT REPORTS
  // ============================================================
  async getDirectReports(schema: string, userId: string) {
    const reports = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
              u.job_title, u.avatar_url, u.department_id,
              r.name as role_name, r.id as role_id, r.level as role_level,
              d.name as department_name
       FROM "${schema}".users u
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       LEFT JOIN "${schema}".departments d ON u.department_id = d.id
       WHERE u.manager_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.first_name ASC`,
      [userId],
    );
    return reports.map((u: Record<string, unknown>) => this.formatUser(u));
  }

  // ============================================================
  // LOOKUP HELPERS (for dropdowns)
  // ============================================================
  async getRoles(schema: string) {
    return this.dataSource.query(
      `SELECT id, name, description, level, is_system, is_custom FROM "${schema}".roles ORDER BY level DESC`,
    );
  }

  async getDepartments(schema: string) {
    return this.dataSource.query(
      `SELECT id, name, code, description, parent_department_id, is_active
       FROM "${schema}".departments WHERE is_active = true ORDER BY name ASC`,
    );
  }

  async getTeams(schema: string) {
    return this.dataSource.query(
      `SELECT id, name, description, department_id, is_active
       FROM "${schema}".teams WHERE is_active = true ORDER BY name ASC`,
    );
  }

  // ============================================================
  // INVITATIONS MANAGEMENT
  // ============================================================
  async getPendingInvitations(schema: string) {
    return this.dataSource.query(
      `SELECT i.id, i.email, i.first_name, i.last_name, i.job_title,
              i.status, i.expires_at, i.created_at,
              r.name as role_name, d.name as department_name,
              inv.first_name as inviter_first_name, inv.last_name as inviter_last_name
       FROM "${schema}".user_invitations i
       LEFT JOIN "${schema}".roles r ON i.role_id = r.id
       LEFT JOIN "${schema}".departments d ON i.department_id = d.id
       LEFT JOIN "${schema}".users inv ON i.invited_by = inv.id
       WHERE i.status = 'pending' ORDER BY i.created_at DESC`,
    );
  }

  async cancelInvitation(schema: string, invitationId: string) {
    await this.dataSource.query(
      `UPDATE "${schema}".user_invitations SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
      [invitationId],
    );
    return { message: 'Invitation cancelled' };
  }

  async resendInvitation(schema: string, invitationId: string, tenantName: string, tenantSlug: string) {
    const [invitation] = await this.dataSource.query(
      `SELECT i.*, r.name as role_name,
              inv.first_name as inviter_first_name, inv.last_name as inviter_last_name
       FROM "${schema}".user_invitations i
       LEFT JOIN "${schema}".roles r ON i.role_id = r.id
       LEFT JOIN "${schema}".users inv ON i.invited_by = inv.id
       WHERE i.id = $1 AND i.status = 'pending'`,
      [invitationId],
    );
    if (!invitation) throw new NotFoundException('Invitation not found or already used');

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);
    await this.dataSource.query(
      `UPDATE "${schema}".user_invitations SET expires_at = $1 WHERE id = $2`, [newExpiry, invitationId],
    );

    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const inviteUrl = `${frontendUrl}/invite/accept?token=${invitation.token}&tenant=${tenantSlug}`;

    await this.emailService.sendInviteEmail({
      to: invitation.email,
      inviterName: `${invitation.inviter_first_name} ${invitation.inviter_last_name}`,
      tenantName, inviteUrl,
      roleName: invitation.role_name || 'User',
      expiresAt: newExpiry,
    });

    return { message: 'Invitation resent', expiresAt: newExpiry };
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================
  private async findOneRaw(schema: string, id: string) {
    const [user] = await this.dataSource.query(
      `SELECT * FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`, [id],
    );
    return user;
  }

  private async syncTeams(schema: string, userId: string, teamIds: string[]) {
    await this.dataSource.query(`DELETE FROM "${schema}".user_teams WHERE user_id = $1`, [userId]);
    for (const teamId of teamIds) {
      await this.dataSource.query(
        `INSERT INTO "${schema}".user_teams (user_id, team_id, role)
         VALUES ($1, $2, 'member') ON CONFLICT (user_id, team_id) DO NOTHING`,
        [userId, teamId],
      );
    }
  }

  private formatUser(u: Record<string, unknown>) {
    return {
      id: u.id, email: u.email,
      firstName: u.first_name, lastName: u.last_name,
      phone: u.phone, status: u.status,
      jobTitle: u.job_title, avatarUrl: u.avatar_url,
      timezone: u.timezone, employeeId: u.employee_id,
      departmentId: u.department_id, managerId: u.manager_id,
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at, updatedAt: u.updated_at,
      role: u.role_name ? { id: u.role_id, name: u.role_name, level: u.role_level } : null,
      department: u.department_name ? { id: u.department_id, name: u.department_name, code: u.department_code } : null,
      manager: u.manager_first_name ? { id: u.manager_id, firstName: u.manager_first_name, lastName: u.manager_last_name, email: u.manager_email } : null,
    };
  }

  // ============================================================
  // ORG TREE (full hierarchy for org chart)
  // ============================================================
  async getOrgTree(schemaName: string) {
    const users = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
              u.avatar_url, u.job_title, u.status, u.manager_id,
              u.department_id, u.created_at,
              r.name as role_name,
              d.name as department_name,
              (SELECT COUNT(*) FROM "${schemaName}".users sub
               WHERE sub.manager_id = u.id AND sub.deleted_at IS NULL) as direct_report_count
       FROM "${schemaName}".users u
       LEFT JOIN "${schemaName}".roles r ON u.role_id = r.id
       LEFT JOIN "${schemaName}".departments d ON u.department_id = d.id
       WHERE u.deleted_at IS NULL AND u.status = 'active'
       ORDER BY u.first_name ASC`,
    );

    // Format flat list
    const formatted = users.map((u: Record<string, unknown>) => ({
      id: u.id as string,
      firstName: u.first_name as string,
      lastName: u.last_name as string,
      email: u.email as string,
      phone: (u.phone as string) || null,
      avatarUrl: (u.avatar_url as string) || null,
      jobTitle: (u.job_title as string) || null,
      status: u.status as string,
      managerId: (u.manager_id as string) || null,
      departmentId: (u.department_id as string) || null,
      departmentName: (u.department_name as string) || null,
      roleName: (u.role_name as string) || null,
      directReportCount: parseInt(String(u.direct_report_count)) || 0,
    }));

    // Build tree structure
    const userMap = new Map<string, Record<string, unknown>>();
    for (const user of formatted) {
      userMap.set(user.id, { ...user, children: [] });
    }

    const roots: Record<string, unknown>[] = [];
    for (const user of userMap.values()) {
      const managerId = user.managerId as string | null;
      if (managerId && userMap.has(managerId)) {
        const manager = userMap.get(managerId)!;
        (manager.children as Record<string, unknown>[]).push(user);
      } else {
        roots.push(user);
      }
    }

    return { tree: roots, total: formatted.length };
  }
}