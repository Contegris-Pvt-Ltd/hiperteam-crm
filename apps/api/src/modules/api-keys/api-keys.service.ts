import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../shared/audit.service';

interface CreateApiKeyDto {
  label: string;
  description?: string;
  roleId: string;
  expiresIn?: '30d' | '90d' | '1y' | 'never';
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT u.id, u.email, u.status, u.api_key_label, u.api_key_description,
              u.api_token_expires_at, u.api_last_used_at, u.created_at,
              r.id as role_id, r.name as role_name, r.level as role_level
       FROM "${schemaName}".users u
       LEFT JOIN "${schemaName}".roles r ON u.role_id = r.id
       WHERE u.is_api_user = true AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
    );
    return rows.map((r: any) => this.formatRow(r));
  }

  async findOne(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT u.id, u.email, u.status, u.api_key_label, u.api_key_description,
              u.api_token_expires_at, u.api_last_used_at, u.created_at,
              r.id as role_id, r.name as role_name, r.level as role_level
       FROM "${schemaName}".users u
       LEFT JOIN "${schemaName}".roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_api_user = true AND u.deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('API key not found');
    return this.formatRow(row);
  }

  async create(schemaName: string, adminUserId: string, dto: CreateApiKeyDto, tenantId: string, tenantSlug: string) {
    // Generate a unique service-account email
    const slug = dto.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const suffix = crypto.randomBytes(4).toString('hex');
    const email = `api-${slug}-${suffix}@service.local`;

    // Check label uniqueness
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".users
       WHERE api_key_label = $1 AND is_api_user = true AND deleted_at IS NULL`,
      [dto.label],
    );
    if (existing) throw new ConflictException('An API key with this label already exists');

    // Random password (never used for login)
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    // Calculate expiry
    let expiresAt: Date | null = null;
    if (dto.expiresIn && dto.expiresIn !== 'never') {
      expiresAt = new Date();
      if (dto.expiresIn === '30d') expiresAt.setDate(expiresAt.getDate() + 30);
      else if (dto.expiresIn === '90d') expiresAt.setDate(expiresAt.getDate() + 90);
      else if (dto.expiresIn === '1y') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Insert API user
    const [newUser] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".users
       (email, password_hash, first_name, last_name, role_id, status,
        is_api_user, api_key_label, api_key_description, api_token_expires_at, invited_by, invited_at)
       VALUES ($1, $2, $3, $4, $5, 'active', true, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [
        email, passwordHash, dto.label, 'API Key', dto.roleId,
        dto.label, dto.description || null, expiresAt, adminUserId,
      ],
    );

    // Generate JWT token
    const token = await this.generateApiToken(schemaName, newUser.id, tenantId, tenantSlug, expiresAt);

    // Audit
    await this.auditService.log(schemaName, {
      entityType: 'api_keys',
      entityId: newUser.id,
      action: 'create',
      changes: {},
      newValues: { label: dto.label, roleId: dto.roleId, expiresIn: dto.expiresIn },
      performedBy: adminUserId,
    });

    return {
      id: newUser.id,
      label: dto.label,
      token,
      expiresAt: expiresAt?.toISOString() || null,
    };
  }

  async regenerate(schemaName: string, id: string, adminUserId: string, tenantId: string, tenantSlug: string) {
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.api_token_expires_at
       FROM "${schemaName}".users u
       WHERE u.id = $1 AND u.is_api_user = true AND u.deleted_at IS NULL`,
      [id],
    );
    if (!user) throw new NotFoundException('API key not found');

    const expiresAt = user.api_token_expires_at ? new Date(user.api_token_expires_at) : null;
    const token = await this.generateApiToken(schemaName, id, tenantId, tenantSlug, expiresAt);

    await this.auditService.log(schemaName, {
      entityType: 'api_keys',
      entityId: id,
      action: 'update',
      changes: { token: { from: 'old', to: 'regenerated' } },
      newValues: {},
      performedBy: adminUserId,
    });

    return { token };
  }

  async updateStatus(schemaName: string, id: string, adminUserId: string, status: 'active' | 'inactive') {
    const [user] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".users WHERE id = $1 AND is_api_user = true AND deleted_at IS NULL`,
      [id],
    );
    if (!user) throw new NotFoundException('API key not found');

    await this.dataSource.query(
      `UPDATE "${schemaName}".users SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'api_keys',
      entityId: id,
      action: 'update',
      changes: { status: { from: null, to: status } },
      newValues: { status },
      performedBy: adminUserId,
    });

    return { success: true };
  }

  async remove(schemaName: string, id: string, adminUserId: string) {
    const [user] = await this.dataSource.query(
      `SELECT id, api_key_label FROM "${schemaName}".users WHERE id = $1 AND is_api_user = true AND deleted_at IS NULL`,
      [id],
    );
    if (!user) throw new NotFoundException('API key not found');

    await this.dataSource.query(
      `UPDATE "${schemaName}".users SET deleted_at = NOW(), status = 'inactive' WHERE id = $1`,
      [id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'api_keys',
      entityId: id,
      action: 'delete',
      changes: {},
      newValues: { label: user.api_key_label },
      performedBy: adminUserId,
    });

    return { success: true };
  }

  async updateLastUsed(schemaName: string, userId: string) {
    try {
      await this.dataSource.query(
        `UPDATE "${schemaName}".users SET api_last_used_at = NOW() WHERE id = $1 AND is_api_user = true`,
        [userId],
      );
    } catch { /* non-critical */ }
  }

  private async generateApiToken(
    schemaName: string, userId: string,
    tenantId: string, tenantSlug: string,
    expiresAt: Date | null,
  ): Promise<string> {
    // Fetch user + role data (same as auth service login)
    const [user] = await this.dataSource.query(
      `SELECT u.id, u.email, u.department_id, u.manager_id,
              r.id as role_id, r.name as role, r.permissions,
              r.level as role_level, r.record_access, r.field_permissions
       FROM "${schemaName}".users u
       JOIN "${schemaName}".roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    // Get team IDs
    let teamIds: string[] = [];
    try {
      const teams = await this.dataSource.query(
        `SELECT team_id FROM "${schemaName}".user_teams WHERE user_id = $1`,
        [userId],
      );
      teamIds = teams.map((t: any) => t.team_id);
    } catch { /* no user_teams table yet */ }

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId,
      tenantSlug,
      tenantSchema: schemaName,
      role: user.role || 'user',
      roleId: user.role_id || '',
      roleLevel: user.role_level ?? 0,
      permissions: user.permissions || {},
      recordAccess: user.record_access || {},
      fieldPermissions: user.field_permissions || {},
      departmentId: user.department_id || undefined,
      teamIds,
      managerId: user.manager_id || undefined,
    };

    // Sign with custom expiry or no expiry
    if (expiresAt) {
      const nowMs = Date.now();
      const expMs = expiresAt.getTime();
      const diffSeconds = Math.max(Math.floor((expMs - nowMs) / 1000), 60);
      return this.jwtService.sign(payload, { expiresIn: diffSeconds });
    }

    // No expiry — sign with 100 years
    return this.jwtService.sign(payload, { expiresIn: '36500d' });
  }

  private formatRow(r: any) {
    return {
      id: r.id,
      email: r.email,
      label: r.api_key_label,
      description: r.api_key_description,
      status: r.status,
      roleId: r.role_id,
      roleName: r.role_name,
      roleLevel: r.role_level,
      expiresAt: r.api_token_expires_at,
      lastUsedAt: r.api_last_used_at,
      createdAt: r.created_at,
    };
  }
}
