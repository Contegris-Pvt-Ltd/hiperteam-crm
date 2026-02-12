import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { CreateRoleDto, UpdateRoleDto, QueryRolesDto } from './dto';

// ============================================================
// MODULE / ACTION DEFINITIONS (source of truth)
// ============================================================
export const MODULE_DEFINITIONS: Record<string, { label: string; actions: string[] }> = {
  contacts: { label: 'Contacts', actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  accounts: { label: 'Accounts', actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  products: { label: 'Products', actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  leads:    { label: 'Leads',    actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  deals:    { label: 'Deals',    actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  tasks:    { label: 'Tasks',    actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  reports:  { label: 'Reports',  actions: ['view', 'create', 'edit', 'delete', 'export', 'import'] },
  users:    { label: 'Users',    actions: ['view', 'create', 'edit', 'delete', 'invite'] },
  roles:    { label: 'Roles',    actions: ['view', 'create', 'edit', 'delete'] },
  settings: { label: 'Settings', actions: ['view', 'edit'] },
  admin:    { label: 'Admin',    actions: ['view', 'edit'] },
};

export const RECORD_ACCESS_MODULES = ['contacts', 'accounts', 'products', 'leads', 'deals', 'tasks', 'reports'];
export const RECORD_ACCESS_LEVELS = ['own', 'team', 'department', 'reporting_line', 'all'];

export interface FormattedRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, Record<string, boolean>>;
  recordAccess: Record<string, string>;
  fieldPermissions: Record<string, unknown>;
  isSystem: boolean;
  isCustom: boolean;
  level: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  private readonly trackedFields = [
    'name', 'description', 'permissions', 'recordAccess', 'fieldPermissions', 'level',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // LIST ROLES
  // ============================================================
  async findAll(schema: string, query: QueryRolesDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.search) {
      conditions.push(`(r.name ILIKE $${paramIdx} OR r.description ILIKE $${paramIdx})`);
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.type === 'system') {
      conditions.push(`r.is_system = true`);
    } else if (query.type === 'custom') {
      conditions.push(`r.is_custom = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap: Record<string, string> = {
      name: 'r.name',
      level: 'r.level',
      created_at: 'r.created_at',
    };
    const sortCol = sortMap[query.sortBy || 'level'] || 'r.level';
    const sortDir = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM "${schema}".roles r ${whereClause}`,
      params,
    );

    const roles = await this.dataSource.query(
      `SELECT r.id, r.name, r.description, r.permissions, r.record_access,
              r.field_permissions, r.is_system, r.is_custom, r.level,
              r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM "${schema}".users u
               WHERE u.role_id = r.id AND u.deleted_at IS NULL) as user_count
       FROM "${schema}".roles r
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total);

    return {
      data: roles.map((r: Record<string, unknown>) => this.formatRole(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // GET ONE ROLE
  // ============================================================
  async findOne(schema: string, id: string) {
    const [role] = await this.dataSource.query(
      `SELECT r.id, r.name, r.description, r.permissions, r.record_access,
              r.field_permissions, r.is_system, r.is_custom, r.level,
              r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM "${schema}".users u
               WHERE u.role_id = r.id AND u.deleted_at IS NULL) as user_count
       FROM "${schema}".roles r
       WHERE r.id = $1`,
      [id],
    );

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const users = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.avatar_url
       FROM "${schema}".users u
       WHERE u.role_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.first_name ASC
       LIMIT 50`,
      [id],
    );

    const result = this.formatRole(role);
    return {
      ...result,
      users: users.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        firstName: u.first_name as string,
        lastName: u.last_name as string,
        email: u.email as string,
        status: u.status as string,
        avatarUrl: (u.avatar_url as string) || null,
      })),
    };
  }

  // ============================================================
  // CREATE ROLE
  // ============================================================
  async create(schema: string, dto: CreateRoleDto, userId?: string) {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schema}".roles WHERE UPPER(name) = UPPER($1)`,
      [dto.name],
    );
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    this.validatePermissions(dto.permissions);

    if (dto.recordAccess) {
      this.validateRecordAccess(dto.recordAccess);
    }

    const permissions = JSON.stringify(this.normalizePermissions(dto.permissions));
    const recordAccess = JSON.stringify(dto.recordAccess || this.getDefaultRecordAccess());
    const fieldPermissions = JSON.stringify(dto.fieldPermissions || {});

    const [created] = await this.dataSource.query(
      `INSERT INTO "${schema}".roles (name, description, permissions, record_access, field_permissions, is_system, is_custom, level)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, false, true, $6)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        permissions,
        recordAccess,
        fieldPermissions,
        dto.level || 20,
      ],
    );

    this.logger.log(`Role created: ${created.id} (${dto.name}) in ${schema}`);

    const result = await this.findOne(schema, created.id);

    // ── Audit Log ──
    if (userId) {
      await this.auditService.log(schema, {
        entityType: 'roles',
        entityId: created.id,
        action: 'create',
        changes: {},
        newValues: result as unknown as Record<string, unknown>,
        performedBy: userId,
      });
    }

    return result;
  }

  // ============================================================
  // UPDATE ROLE
  // ============================================================
  async update(schema: string, id: string, dto: UpdateRoleDto, userId?: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schema}".roles WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const previousValues = this.formatRole(existing);

    if (existing.is_system && existing.name === 'admin') {
      if (dto.name && dto.name !== 'admin') {
        throw new ForbiddenException('Cannot rename the system admin role');
      }
      if (dto.level !== undefined && dto.level !== 100) {
        throw new ForbiddenException('Cannot change the admin role level');
      }
    }

    if (dto.name && dto.name !== existing.name) {
      const [dup] = await this.dataSource.query(
        `SELECT id FROM "${schema}".roles WHERE UPPER(name) = UPPER($1) AND id != $2`,
        [dto.name, id],
      );
      if (dup) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
    }

    if (dto.permissions) {
      this.validatePermissions(dto.permissions);
    }

    if (dto.recordAccess) {
      this.validateRecordAccess(dto.recordAccess);
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (dto.name !== undefined) {
      setClauses.push(`name = $${paramIdx}`);
      params.push(dto.name);
      paramIdx++;
    }

    if (dto.description !== undefined) {
      setClauses.push(`description = $${paramIdx}`);
      params.push(dto.description);
      paramIdx++;
    }

    if (dto.permissions !== undefined) {
      setClauses.push(`permissions = $${paramIdx}::jsonb`);
      params.push(JSON.stringify(this.normalizePermissions(dto.permissions)));
      paramIdx++;
    }

    if (dto.recordAccess !== undefined) {
      setClauses.push(`record_access = $${paramIdx}::jsonb`);
      params.push(JSON.stringify(dto.recordAccess));
      paramIdx++;
    }

    if (dto.fieldPermissions !== undefined) {
      setClauses.push(`field_permissions = $${paramIdx}::jsonb`);
      params.push(JSON.stringify(dto.fieldPermissions));
      paramIdx++;
    }

    if (dto.level !== undefined && !existing.is_system) {
      setClauses.push(`level = $${paramIdx}`);
      params.push(dto.level);
      paramIdx++;
    }

    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schema}".roles SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    this.logger.log(`Role updated: ${id} in ${schema}`);

    const result = await this.findOne(schema, id);

    // ── Audit Log ──
    if (userId) {
      const changes = this.auditService.calculateChanges(
        previousValues as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        this.trackedFields,
      );
      if (Object.keys(changes).length > 0) {
        await this.auditService.log(schema, {
          entityType: 'roles',
          entityId: id,
          action: 'update',
          changes,
          previousValues: previousValues as unknown as Record<string, unknown>,
          newValues: result as unknown as Record<string, unknown>,
          performedBy: userId,
        });
      }
    }

    return result;
  }

  // ============================================================
  // DELETE ROLE
  // ============================================================
  async remove(schema: string, id: string, userId?: string) {
    const [existing] = await this.dataSource.query(
      `SELECT id, name, is_system FROM "${schema}".roles WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.is_system) {
      throw new ForbiddenException(`Cannot delete system role "${existing.name}"`);
    }

    const [userCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".users
       WHERE role_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(userCount.count) > 0) {
      throw new BadRequestException(
        `Cannot delete role "${existing.name}" — it has ${userCount.count} assigned user(s). Reassign them first.`,
      );
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".roles WHERE id = $1`,
      [id],
    );

    this.logger.log(`Role deleted: ${id} (${existing.name}) in ${schema}`);

    // ── Audit Log ──
    if (userId) {
      await this.auditService.log(schema, {
        entityType: 'roles',
        entityId: id,
        action: 'delete',
        changes: {},
        previousValues: { name: existing.name },
        performedBy: userId,
      });
    }

    return { message: `Role "${existing.name}" deleted` };
  }

  // ============================================================
  // CLONE ROLE
  // ============================================================
  async clone(schema: string, id: string, newName: string, userId?: string) {
    const [source] = await this.dataSource.query(
      `SELECT * FROM "${schema}".roles WHERE id = $1`,
      [id],
    );
    if (!source) {
      throw new NotFoundException('Source role not found');
    }

    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schema}".roles WHERE UPPER(name) = UPPER($1)`,
      [newName],
    );
    if (existing) {
      throw new ConflictException(`Role "${newName}" already exists`);
    }

    const [created] = await this.dataSource.query(
      `INSERT INTO "${schema}".roles (name, description, permissions, record_access, field_permissions, is_system, is_custom, level)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, false, true, $6)
       RETURNING *`,
      [
        newName,
        source.description ? `Clone of ${source.name}: ${source.description}` : `Clone of ${source.name}`,
        JSON.stringify(source.permissions),
        JSON.stringify(source.record_access),
        JSON.stringify(source.field_permissions),
        Math.min(source.level, 99),
      ],
    );

    this.logger.log(`Role cloned: ${source.name} → ${newName} (${created.id}) in ${schema}`);

    const result = await this.findOne(schema, created.id);

    // ── Audit Log ──
    if (userId) {
      await this.auditService.log(schema, {
        entityType: 'roles',
        entityId: created.id,
        action: 'create',
        changes: {},
        newValues: result as unknown as Record<string, unknown>,
        performedBy: userId,
        metadata: { clonedFrom: id, clonedFromName: source.name },
      });
    }

    return result;
  }

  // ============================================================
  // GET MODULE DEFINITIONS (for frontend grid builder)
  // ============================================================
  getModuleDefinitions() {
    return {
      modules: MODULE_DEFINITIONS,
      recordAccessModules: RECORD_ACCESS_MODULES,
      recordAccessLevels: RECORD_ACCESS_LEVELS,
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private validatePermissions(permissions: Record<string, Record<string, boolean>>) {
    for (const [module, actions] of Object.entries(permissions)) {
      if (!MODULE_DEFINITIONS[module]) {
        throw new BadRequestException(`Unknown module: "${module}"`);
      }
      const validActions = MODULE_DEFINITIONS[module].actions;
      for (const action of Object.keys(actions)) {
        if (!validActions.includes(action)) {
          throw new BadRequestException(`Unknown action "${action}" for module "${module}"`);
        }
      }
    }
  }

  private validateRecordAccess(recordAccess: Record<string, string>) {
    for (const [module, level] of Object.entries(recordAccess)) {
      if (!RECORD_ACCESS_MODULES.includes(module)) {
        throw new BadRequestException(`Module "${module}" does not support record access`);
      }
      if (!RECORD_ACCESS_LEVELS.includes(level)) {
        throw new BadRequestException(`Invalid record access level "${level}" for module "${module}". Must be: ${RECORD_ACCESS_LEVELS.join(', ')}`);
      }
    }
  }

  private normalizePermissions(permissions: Record<string, Record<string, boolean>>): Record<string, Record<string, boolean>> {
    const normalized: Record<string, Record<string, boolean>> = {};
    for (const [module, def] of Object.entries(MODULE_DEFINITIONS)) {
      normalized[module] = {};
      for (const action of def.actions) {
        normalized[module][action] = permissions[module]?.[action] === true;
      }
    }
    return normalized;
  }

  private getDefaultRecordAccess(): Record<string, string> {
    const access: Record<string, string> = {};
    for (const module of RECORD_ACCESS_MODULES) {
      access[module] = 'own';
    }
    return access;
  }

  private formatRole(r: Record<string, unknown>): FormattedRole {
    const permissions = typeof r.permissions === 'string'
      ? JSON.parse(r.permissions as string)
      : (r.permissions || {});
    const recordAccess = typeof r.record_access === 'string'
      ? JSON.parse(r.record_access as string)
      : (r.record_access || {});
    const fieldPermissions = typeof r.field_permissions === 'string'
      ? JSON.parse(r.field_permissions as string)
      : (r.field_permissions || {});

    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) || null,
      permissions,
      recordAccess,
      fieldPermissions,
      isSystem: r.is_system as boolean,
      isCustom: r.is_custom as boolean,
      level: r.level as number,
      userCount: r.user_count !== undefined ? parseInt(String(r.user_count)) : 0,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    };
  }
}