import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateDepartmentDto, UpdateDepartmentDto, QueryDepartmentsDto } from './dto';
import { AuditService } from '../shared/audit.service';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  private readonly trackedFields = [
    'name', 'code', 'description', 'parentDepartmentId', 'headId', 'isActive',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // LIST DEPARTMENTS
  // ============================================================
  async findAll(schema: string, query: QueryDepartmentsDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.search) {
      conditions.push(`(
        d.name ILIKE $${paramIdx} OR
        d.code ILIKE $${paramIdx} OR
        d.description ILIKE $${paramIdx}
      )`);
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      conditions.push(`d.is_active = $${paramIdx}`);
      params.push(query.isActive === 'true');
      paramIdx++;
    }

    if (query.parentId) {
      conditions.push(`d.parent_department_id = $${paramIdx}`);
      params.push(query.parentId);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap: Record<string, string> = {
      name: 'd.name',
      code: 'd.code',
      created_at: 'd.created_at',
    };
    const sortCol = sortMap[query.sortBy || 'name'] || 'd.name';
    const sortDir = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM "${schema}".departments d ${whereClause}`,
      params,
    );

    const departments = await this.dataSource.query(
      `SELECT d.id, d.name, d.code, d.description,
              d.parent_department_id, d.head_id, d.is_active,
              d.created_at, d.updated_at,
              pd.name as parent_department_name,
              h.first_name as head_first_name, h.last_name as head_last_name,
              h.email as head_email, h.avatar_url as head_avatar_url,
              (SELECT COUNT(*) FROM "${schema}".users u
               WHERE u.department_id = d.id AND u.deleted_at IS NULL) as member_count,
              (SELECT COUNT(*) FROM "${schema}".teams t
               WHERE t.department_id = d.id) as team_count,
              (SELECT COUNT(*) FROM "${schema}".departments cd
               WHERE cd.parent_department_id = d.id) as child_count
       FROM "${schema}".departments d
       LEFT JOIN "${schema}".departments pd ON d.parent_department_id = pd.id
       LEFT JOIN "${schema}".users h ON d.head_id = h.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total);

    return {
      data: departments.map((d: Record<string, unknown>) => this.formatDepartment(d)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // GET ONE DEPARTMENT
  // ============================================================
  async findOne(schema: string, id: string) {
    const [department] = await this.dataSource.query(
      `SELECT d.id, d.name, d.code, d.description,
              d.parent_department_id, d.head_id, d.is_active,
              d.created_at, d.updated_at,
              pd.name as parent_department_name,
              h.first_name as head_first_name, h.last_name as head_last_name,
              h.email as head_email, h.avatar_url as head_avatar_url
       FROM "${schema}".departments d
       LEFT JOIN "${schema}".departments pd ON d.parent_department_id = pd.id
       LEFT JOIN "${schema}".users h ON d.head_id = h.id
       WHERE d.id = $1`,
      [id],
    );

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Get members
    const members = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.job_title,
              u.avatar_url, u.status,
              r.name as role_name
       FROM "${schema}".users u
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       WHERE u.department_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.first_name ASC`,
      [id],
    );

    // Get teams in this department
    const teams = await this.dataSource.query(
      `SELECT t.id, t.name, t.description, t.is_active,
              tl.first_name as lead_first_name, tl.last_name as lead_last_name,
              (SELECT COUNT(*) FROM "${schema}".user_teams ut WHERE ut.team_id = t.id) as member_count
       FROM "${schema}".teams t
       LEFT JOIN "${schema}".users tl ON t.team_lead_id = tl.id
       WHERE t.department_id = $1
       ORDER BY t.name ASC`,
      [id],
    );

    // Get child departments
    const children = await this.dataSource.query(
      `SELECT d.id, d.name, d.code, d.is_active,
              (SELECT COUNT(*) FROM "${schema}".users u
               WHERE u.department_id = d.id AND u.deleted_at IS NULL) as member_count
       FROM "${schema}".departments d
       WHERE d.parent_department_id = $1
       ORDER BY d.name ASC`,
      [id],
    );

    const result = this.formatDepartment(department);
    return {
      ...result,
      members: members.map((m: Record<string, unknown>) => ({
        id: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        jobTitle: m.job_title,
        avatarUrl: m.avatar_url,
        status: m.status,
        roleName: m.role_name,
      })),
      teams: teams.map((t: Record<string, unknown>) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        isActive: t.is_active,
        leadName: t.lead_first_name
          ? `${t.lead_first_name} ${t.lead_last_name}`
          : null,
        memberCount: parseInt(String(t.member_count)),
      })),
      children: children.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        isActive: c.is_active,
        memberCount: parseInt(String(c.member_count)),
      })),
    };
  }

  // ============================================================
  // CREATE DEPARTMENT
  // ============================================================
  async create(schema: string, dto: CreateDepartmentDto, userId: string) {
    // Check code uniqueness if provided
    if (dto.code) {
      const [existing] = await this.dataSource.query(
        `SELECT id FROM "${schema}".departments WHERE UPPER(code) = UPPER($1)`,
        [dto.code],
      );
      if (existing) {
        throw new ConflictException(`Department code "${dto.code}" already exists`);
      }
    }

    // Check name uniqueness within same parent
    const nameConditions = [`UPPER(name) = UPPER($1)`];
    const nameParams: unknown[] = [dto.name];
    let pIdx = 2;

    if (dto.parentDepartmentId) {
      nameConditions.push(`parent_department_id = $${pIdx}`);
      nameParams.push(dto.parentDepartmentId);
      pIdx++;
    } else {
      nameConditions.push(`parent_department_id IS NULL`);
    }

    const [dupName] = await this.dataSource.query(
      `SELECT id FROM "${schema}".departments WHERE ${nameConditions.join(' AND ')}`,
      nameParams,
    );
    if (dupName) {
      throw new ConflictException(`Department "${dto.name}" already exists at this level`);
    }

    // Validate parent exists
    if (dto.parentDepartmentId) {
      const [parent] = await this.dataSource.query(
        `SELECT id FROM "${schema}".departments WHERE id = $1`,
        [dto.parentDepartmentId],
      );
      if (!parent) {
        throw new BadRequestException('Parent department not found');
      }
    }

    // Validate head user exists
    if (dto.headId) {
      const [head] = await this.dataSource.query(
        `SELECT id FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`,
        [dto.headId],
      );
      if (!head) {
        throw new BadRequestException('Head user not found');
      }
    }

    const [created] = await this.dataSource.query(
      `INSERT INTO "${schema}".departments (name, code, description, parent_department_id, head_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.name,
        dto.code || null,
        dto.description || null,
        dto.parentDepartmentId || null,
        dto.headId || null,
        dto.isActive !== false,
      ],
    );

    const formatted = this.formatDepartment(created);

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'departments',
      entityId: created.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    this.logger.log(`Department created: ${created.id} (${dto.name}) in ${schema}`);
    return this.findOne(schema, created.id);
  }

  // ============================================================
  // UPDATE DEPARTMENT
  // ============================================================
  async update(schema: string, id: string, dto: UpdateDepartmentDto, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schema}".departments WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    const previousValues = this.formatDepartment(existing);

    // Code uniqueness check (if changing)
    if (dto.code !== undefined && dto.code !== existing.code) {
      if (dto.code) {
        const [dupCode] = await this.dataSource.query(
          `SELECT id FROM "${schema}".departments WHERE UPPER(code) = UPPER($1) AND id != $2`,
          [dto.code, id],
        );
        if (dupCode) {
          throw new ConflictException(`Department code "${dto.code}" already exists`);
        }
      }
    }

    // Prevent circular parent reference
    if (dto.parentDepartmentId !== undefined) {
      if (dto.parentDepartmentId === id) {
        throw new BadRequestException('Department cannot be its own parent');
      }
      if (dto.parentDepartmentId) {
        const isDescendant = await this.isDescendant(schema, dto.parentDepartmentId, id);
        if (isDescendant) {
          throw new BadRequestException('Cannot set parent to a descendant department (circular reference)');
        }
        const [parent] = await this.dataSource.query(
          `SELECT id FROM "${schema}".departments WHERE id = $1`,
          [dto.parentDepartmentId],
        );
        if (!parent) {
          throw new BadRequestException('Parent department not found');
        }
      }
    }

    // Validate head user
    if (dto.headId !== undefined && dto.headId !== null) {
      const [head] = await this.dataSource.query(
        `SELECT id FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`,
        [dto.headId],
      );
      if (!head) {
        throw new BadRequestException('Head user not found');
      }
    }

    // Build dynamic update
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      description: 'description',
      parentDepartmentId: 'parent_department_id',
      headId: 'head_id',
      isActive: 'is_active',
    };

    for (const [dtoKey, colName] of Object.entries(fieldMap)) {
      if ((dto as Record<string, unknown>)[dtoKey] !== undefined) {
        setClauses.push(`${colName} = $${paramIdx}`);
        params.push((dto as Record<string, unknown>)[dtoKey]);
        paramIdx++;
      }
    }

    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schema}".departments SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    const result = await this.findOne(schema, id);

    // ── Audit Log ──
    const changes = this.auditService.calculateChanges(previousValues, result, this.trackedFields);
    if (Object.keys(changes).length > 0) {
      await this.auditService.log(schema, {
        entityType: 'departments',
        entityId: id,
        action: 'update',
        changes,
        previousValues,
        newValues: result,
        performedBy: userId,
      });
    }

    this.logger.log(`Department updated: ${id} in ${schema}`);
    return result;
  }

  // ============================================================
  // DELETE DEPARTMENT
  // ============================================================
  async remove(schema: string, id: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT id, name FROM "${schema}".departments WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    // Check for members
    const [memberCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".users
       WHERE department_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(memberCount.count) > 0) {
      throw new BadRequestException(
        `Cannot delete department "${existing.name}" — it has ${memberCount.count} member(s). Reassign them first.`,
      );
    }

    // Check for child departments
    const [childCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".departments WHERE parent_department_id = $1`,
      [id],
    );
    if (parseInt(childCount.count) > 0) {
      throw new BadRequestException(
        `Cannot delete department "${existing.name}" — it has ${childCount.count} sub-department(s). Remove or reassign them first.`,
      );
    }

    // Check for teams
    const [teamCount] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schema}".teams WHERE department_id = $1`,
      [id],
    );
    if (parseInt(teamCount.count) > 0) {
      throw new BadRequestException(
        `Cannot delete department "${existing.name}" — it has ${teamCount.count} team(s). Remove or reassign them first.`,
      );
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".departments WHERE id = $1`,
      [id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'departments',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: { name: existing.name },
      performedBy: userId,
    });

    this.logger.log(`Department deleted: ${id} (${existing.name}) in ${schema}`);
    return { message: `Department "${existing.name}" deleted` };
  }

  // ============================================================
  // GET DEPARTMENT HIERARCHY (tree view)
  // ============================================================
  async getHierarchy(schema: string) {
    const departments = await this.dataSource.query(
      `SELECT d.id, d.name, d.code, d.description,
              d.parent_department_id, d.head_id, d.is_active,
              h.first_name as head_first_name, h.last_name as head_last_name,
              (SELECT COUNT(*) FROM "${schema}".users u
               WHERE u.department_id = d.id AND u.deleted_at IS NULL) as member_count,
              (SELECT COUNT(*) FROM "${schema}".teams t
               WHERE t.department_id = d.id) as team_count
       FROM "${schema}".departments d
       LEFT JOIN "${schema}".users h ON d.head_id = h.id
       ORDER BY d.name ASC`,
    );

    // Build tree structure
    const formatted = departments.map((d: Record<string, unknown>) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      parentDepartmentId: d.parent_department_id,
      headId: d.head_id,
      headName: d.head_first_name
        ? `${d.head_first_name} ${d.head_last_name}`
        : null,
      isActive: d.is_active,
      memberCount: parseInt(String(d.member_count)),
      teamCount: parseInt(String(d.team_count)),
      children: [] as unknown[],
    }));

    type DeptNode = (typeof formatted)[0];
    const idMap = new Map<string, DeptNode>();
    formatted.forEach((d: DeptNode) => idMap.set(d.id as string, d));

    const roots: DeptNode[] = [];
    formatted.forEach((d: DeptNode) => {
      if (d.parentDepartmentId && idMap.has(d.parentDepartmentId as string)) {
        idMap.get(d.parentDepartmentId as string)!.children.push(d);
      } else {
        roots.push(d);
      }
    });

    return roots;
  }

  // ============================================================
  // LOOKUP (for dropdowns)
  // ============================================================
  async getLookup(schema: string, excludeId?: string) {
    const query = `SELECT id, name, code, parent_department_id, is_active
                 FROM "${schema}".departments
                 ORDER BY name ASC`;
    const params: unknown[] = [];

    const departments = await this.dataSource.query(query, params);

    let result = departments.map((d: Record<string, unknown>) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      parentDepartmentId: d.parent_department_id,
      isActive: d.is_active,
    }));

    // If excludeId, filter out that department and all its descendants
    if (excludeId) {
      const excludeIds = new Set<string>([excludeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const dept of result) {
          if (dept.parentDepartmentId && excludeIds.has(dept.parentDepartmentId) && !excludeIds.has(dept.id)) {
            excludeIds.add(dept.id);
            changed = true;
          }
        }
      }
      result = result.filter((d: { id: string }) => !excludeIds.has(d.id));
    }

    return result;
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async isDescendant(schema: string, potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    let currentId = potentialDescendantId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === ancestorId) return true;
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const [row] = await this.dataSource.query(
        `SELECT parent_department_id FROM "${schema}".departments WHERE id = $1`,
        [currentId],
      );
      if (!row || !row.parent_department_id) return false;
      currentId = row.parent_department_id;
    }

    return false;
  }

  private formatDepartment(d: Record<string, unknown>) {
    return {
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      parentDepartmentId: d.parent_department_id,
      parentDepartmentName: d.parent_department_name || null,
      headId: d.head_id,
      head: d.head_first_name
        ? {
            id: d.head_id,
            firstName: d.head_first_name,
            lastName: d.head_last_name,
            email: d.head_email,
            avatarUrl: d.head_avatar_url,
          }
        : null,
      isActive: d.is_active,
      memberCount: d.member_count !== undefined ? parseInt(String(d.member_count)) : undefined,
      teamCount: d.team_count !== undefined ? parseInt(String(d.team_count)) : undefined,
      childCount: d.child_count !== undefined ? parseInt(String(d.child_count)) : undefined,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }
}