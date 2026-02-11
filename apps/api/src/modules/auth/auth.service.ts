import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { TenantService } from '../tenant/tenant.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private tenantService: TenantService,
    private jwtService: JwtService,
    private dataSource: DataSource,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // REGISTER
  // ════════════════════════════════════════════════════════════

  async register(dto: RegisterDto) {
    const existingTenant = await this.tenantService.findBySlug(dto.companySlug);
    if (existingTenant) {
      throw new ConflictException('Company slug already taken');
    }

    const tenant = await this.tenantService.create(dto.companyName, dto.companySlug);

    const [adminRole] = await this.dataSource.query(
      `SELECT id FROM "${tenant.schemaName}".roles WHERE name = 'admin' LIMIT 1`,
    );

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.dataSource.query(
      `INSERT INTO "${tenant.schemaName}".users
       (email, password_hash, first_name, last_name, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [dto.email, passwordHash, dto.firstName, dto.lastName, adminRole.id],
    );

    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.department_id, u.manager_id,
              r.id as role_id, r.name as role, r.permissions,
              r.level as role_level, r.record_access, r.field_permissions
       FROM "${tenant.schemaName}".users u
       JOIN "${tenant.schemaName}".roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [dto.email],
    );

    const teamIds: string[] = [];

    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantSchema: tenant.schemaName,
      role: user.role,
      roleId: user.role_id,
      roleLevel: user.role_level ?? 0,
      permissions: user.permissions || {},
      recordAccess: user.record_access || {},
      fieldPermissions: user.field_permissions || {},
      departmentId: user.department_id || undefined,
      teamIds,
      managerId: user.manager_id || undefined,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        roleId: user.role_id,
        roleLevel: user.role_level ?? 0,
        permissions: user.permissions || {},
        recordAccess: user.record_access || {},
        fieldPermissions: user.field_permissions || {},
        departmentId: user.department_id || undefined,
        teamIds,
        managerId: user.manager_id || undefined,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...tokens,
    };
  }

  // ════════════════════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════════════════════

  async login(dto: LoginDto) {
    const tenant = await this.tenantService.findBySlug(dto.tenantSlug);
    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name,
              u.status, u.department_id, u.manager_id,
              r.id as role_id, r.name as role, r.permissions,
              r.level as role_level, r.record_access, r.field_permissions
       FROM "${tenant.schemaName}".users u
       LEFT JOIN "${tenant.schemaName}".roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [dto.email],
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is disabled');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.dataSource.query(
      `UPDATE "${tenant.schemaName}".users SET last_login_at = NOW() WHERE id = $1`,
      [user.id],
    );

    const teamIds = await this.getUserTeamIds(tenant.schemaName, user.id);

    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantSchema: tenant.schemaName,
      role: user.role || 'user',
      roleId: user.role_id || '',
      roleLevel: user.role_level ?? 0,
      permissions: user.permissions || {},
      recordAccess: user.record_access || {},
      fieldPermissions: user.field_permissions || {},
      departmentId: user.department_id || undefined,
      teamIds,
      managerId: user.manager_id || undefined,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        roleId: user.role_id,
        roleLevel: user.role_level ?? 0,
        permissions: user.permissions || {},
        recordAccess: user.record_access || {},
        fieldPermissions: user.field_permissions || {},
        departmentId: user.department_id || undefined,
        teamIds,
        managerId: user.manager_id || undefined,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      ...tokens,
    };
  }

  // ════════════════════════════════════════════════════════════
  // INVITE: VALIDATE TOKEN
  // ════════════════════════════════════════════════════════════

  async validateInviteToken(token: string) {
    const tenants = await this.dataSource.query(
      `SELECT id, name, slug, schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const t of tenants) {
      const schema = t.schema_name;

      const [tableExists] = await this.dataSource
        .query(
          `SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'user_invitations'`,
          [schema],
        )
        .catch(() => [null]);

      if (!tableExists) continue;

      const [invitation] = await this.dataSource.query(
        `SELECT i.*, r.name as role_name, d.name as department_name
         FROM "${schema}".user_invitations i
         LEFT JOIN "${schema}".roles r ON i.role_id = r.id
         LEFT JOIN "${schema}".departments d ON i.department_id = d.id
         WHERE i.token = $1 AND i.status = 'pending'`,
        [token],
      );

      if (invitation) {
        if (new Date(invitation.expires_at) < new Date()) {
          await this.dataSource.query(
            `UPDATE "${schema}".user_invitations SET status = 'expired' WHERE id = $1`,
            [invitation.id],
          );
          throw new BadRequestException(
            'This invitation has expired. Please ask your admin to send a new one.',
          );
        }

        return {
          valid: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            firstName: invitation.first_name,
            lastName: invitation.last_name,
            jobTitle: invitation.job_title,
            roleName: invitation.role_name,
            departmentName: invitation.department_name,
          },
          tenant: {
            id: t.id,
            name: t.name,
            slug: t.slug,
          },
        };
      }
    }

    throw new BadRequestException('Invalid or expired invitation link.');
  }

  // ════════════════════════════════════════════════════════════
  // INVITE: ACCEPT
  // ════════════════════════════════════════════════════════════

  async acceptInvite(token: string, password: string) {
    // Validate token — returns invitation + tenant info
    const validated = await this.validateInviteToken(token);

    const tenantRecord = await this.tenantService.findBySlug(validated.tenant.slug);
    if (!tenantRecord) {
      throw new BadRequestException('Tenant not found');
    }
    const schema = tenantRecord.schemaName;

    // Get full invitation record (need role_id, department_id, team_ids)
    const [inviteRecord] = await this.dataSource.query(
      `SELECT * FROM "${schema}".user_invitations WHERE token = $1 AND status = 'pending'`,
      [token],
    );

    if (!inviteRecord) {
      throw new BadRequestException('Invitation is no longer valid');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Check if user already exists (could be re-invite)
    const [existingUser] = await this.dataSource.query(
      `SELECT id, status FROM "${schema}".users WHERE email = $1 AND deleted_at IS NULL`,
      [inviteRecord.email],
    );

    let userId: string;

    if (existingUser) {
      await this.dataSource.query(
        `UPDATE "${schema}".users SET
          password_hash = $1,
          first_name = COALESCE(NULLIF($2, ''), first_name),
          last_name = COALESCE(NULLIF($3, ''), last_name),
          role_id = COALESCE($4, role_id),
          department_id = COALESCE($5, department_id),
          job_title = COALESCE(NULLIF($6, ''), job_title),
          status = 'active',
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $7`,
        [
          passwordHash,
          inviteRecord.first_name || '',
          inviteRecord.last_name || '',
          inviteRecord.role_id,
          inviteRecord.department_id,
          inviteRecord.job_title || '',
          existingUser.id,
        ],
      );
      userId = existingUser.id;
    } else {
      const [newUser] = await this.dataSource.query(
        `INSERT INTO "${schema}".users
          (email, password_hash, first_name, last_name, role_id, department_id, job_title, invited_by, invited_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'active')
         RETURNING id`,
        [
          inviteRecord.email,
          passwordHash,
          inviteRecord.first_name || '',
          inviteRecord.last_name || '',
          inviteRecord.role_id,
          inviteRecord.department_id,
          inviteRecord.job_title || '',
          inviteRecord.invited_by,
        ],
      );
      userId = newUser.id;
    }

    // Add to teams if specified
    if (inviteRecord.team_ids && inviteRecord.team_ids.length > 0) {
      for (const teamId of inviteRecord.team_ids) {
        await this.dataSource
          .query(
            `INSERT INTO "${schema}".user_teams (user_id, team_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (user_id, team_id) DO NOTHING`,
            [userId, teamId],
          )
          .catch(() => {}); // Ignore if team doesn't exist
      }
    }

    // Mark invitation as accepted
    await this.dataSource.query(
      `UPDATE "${schema}".user_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [inviteRecord.id],
    );

    // Get user with full role data for token generation
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.department_id, u.manager_id,
              r.id as role_id, r.name as role, r.permissions,
              r.level as role_level, r.record_access, r.field_permissions
       FROM "${schema}".users u
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    const teamIds = await this.getUserTeamIds(schema, userId);

    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      tenantId: tenantRecord.id,
      tenantSlug: tenantRecord.slug,
      tenantSchema: schema,
      role: user.role || 'user',
      roleId: user.role_id || '',
      roleLevel: user.role_level ?? 0,
      permissions: user.permissions || {},
      recordAccess: user.record_access || {},
      fieldPermissions: user.field_permissions || {},
      departmentId: user.department_id || undefined,
      teamIds,
      managerId: user.manager_id || undefined,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      tenant: {
        id: tenantRecord.id,
        name: tenantRecord.name,
        slug: tenantRecord.slug,
      },
      ...tokens,
    };
  }

  // ════════════════════════════════════════════════════════════
  // PASSWORD RESET: FORGOT
  // ════════════════════════════════════════════════════════════

  async forgotPassword(tenantSlug: string, email: string) {
    const tenant = await this.tenantService.findBySlug(tenantSlug);
    if (!tenant) {
      return { message: 'If an account exists with that email, a reset link has been sent.' };
    }

    const schema = tenant.schemaName;

    // Ensure password_reset_tokens table exists
    const [tableExists] = await this.dataSource
      .query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'password_reset_tokens'`,
        [schema],
      )
      .catch(() => [null]);

    if (!tableExists) {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "${schema}".password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_password_reset_token ON "${schema}".password_reset_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_password_reset_user ON "${schema}".password_reset_tokens(user_id);
      `);
    }

    const [user] = await this.dataSource.query(
      `SELECT id, email, first_name, last_name FROM "${schema}".users
       WHERE email = $1 AND status = 'active' AND deleted_at IS NULL`,
      [email],
    );

    if (!user) {
      return { message: 'If an account exists with that email, a reset link has been sent.' };
    }

    // Invalidate existing tokens
    await this.dataSource.query(
      `UPDATE "${schema}".password_reset_tokens SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    const token = uuidv4() + '-' + uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.dataSource.query(
      `INSERT INTO "${schema}".password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt],
    );

    const frontendUrl = this.configService.get('app.frontendUrl') || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Reset Your Password - HiperTeam CRM',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4F46E5; margin: 0;">HiperTeam CRM</h1>
            </div>
            <h2 style="color: #1F2937;">Reset Your Password</h2>
            <p style="color: #6B7280; line-height: 1.6;">
              Hi ${user.first_name || 'there'},
            </p>
            <p style="color: #6B7280; line-height: 1.6;">
              We received a request to reset your password for your ${tenant.name} account.
              Click the button below to create a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #9CA3AF; font-size: 14px;">
              This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${resetUrl}" style="color: #4F46E5;">${resetUrl}</a>
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send reset email to ${user.email}:`, err);
    }

    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  // ════════════════════════════════════════════════════════════
  // PASSWORD RESET: VALIDATE TOKEN
  // ════════════════════════════════════════════════════════════

  async validateResetToken(token: string) {
    const tenants = await this.dataSource.query(
      `SELECT id, name, slug, schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const t of tenants) {
      const schema = t.schema_name;

      const [tableExists] = await this.dataSource
        .query(
          `SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'password_reset_tokens'`,
          [schema],
        )
        .catch(() => [null]);

      if (!tableExists) continue;

      const [resetToken] = await this.dataSource.query(
        `SELECT t.*, u.email, u.first_name
         FROM "${schema}".password_reset_tokens t
         JOIN "${schema}".users u ON t.user_id = u.id
         WHERE t.token = $1 AND t.used_at IS NULL`,
        [token],
      );

      if (resetToken) {
        if (new Date(resetToken.expires_at) < new Date()) {
          throw new BadRequestException('This reset link has expired. Please request a new one.');
        }

        return {
          valid: true,
          email: resetToken.email,
          firstName: resetToken.first_name,
          tenantName: t.name,
        };
      }
    }

    throw new BadRequestException('Invalid or expired reset link.');
  }

  // ════════════════════════════════════════════════════════════
  // PASSWORD RESET: EXECUTE
  // ════════════════════════════════════════════════════════════

  async resetPassword(token: string, newPassword: string) {
    const tenants = await this.dataSource.query(
      `SELECT id, name, slug, schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const t of tenants) {
      const schema = t.schema_name;

      const [tableExists] = await this.dataSource
        .query(
          `SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'password_reset_tokens'`,
          [schema],
        )
        .catch(() => [null]);

      if (!tableExists) continue;

      const [resetToken] = await this.dataSource.query(
        `SELECT t.*, u.id as user_id, u.email
         FROM "${schema}".password_reset_tokens t
         JOIN "${schema}".users u ON t.user_id = u.id
         WHERE t.token = $1 AND t.used_at IS NULL`,
        [token],
      );

      if (resetToken) {
        if (new Date(resetToken.expires_at) < new Date()) {
          throw new BadRequestException('This reset link has expired. Please request a new one.');
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await this.dataSource.query(
          `UPDATE "${schema}".users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
          [passwordHash, resetToken.user_id],
        );

        await this.dataSource.query(
          `UPDATE "${schema}".password_reset_tokens SET used_at = NOW() WHERE id = $1`,
          [resetToken.id],
        );

        await this.dataSource.query(
          `UPDATE "${schema}".password_reset_tokens SET used_at = NOW()
           WHERE user_id = $1 AND id != $2 AND used_at IS NULL`,
          [resetToken.user_id, resetToken.id],
        );

        return { message: 'Password has been reset successfully. You can now sign in.' };
      }
    }

    throw new BadRequestException('Invalid or expired reset link.');
  }

  // ════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════

  private async getUserTeamIds(schema: string, userId: string): Promise<string[]> {
    try {
      const result = await this.dataSource.query(
        `SELECT team_id FROM "${schema}".user_teams WHERE user_id = $1`,
        [userId],
      );
      return result.map((r: { team_id: string }) => r.team_id);
    } catch {
      return [];
    }
  }

  private generateTokens(payload: JwtPayload) {
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}