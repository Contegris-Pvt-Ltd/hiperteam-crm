import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTeamDto, UpdateTeamDto, QueryTeamsDto, ManageTeamMemberDto } from './dto';
import { AuditService } from '../shared/audit.service';

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  status: string;
  roleName: string | null;
  teamRole: string;
  joinedAt: string;
}

export interface FormattedTeam {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  teamLeadId: string | null;
  teamLead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  private readonly trackedFields = [
    'name', 'description', 'departmentId', 'teamLeadId', 'isActive',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // LIST TEAMS
  // ============================================================
  async findAll(schema: string, query: QueryTeamsDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.search) {
      conditions.push(`(
        t.name ILIKE $${paramIdx} OR
        t.description ILIKE $${paramIdx}
      )`);
      params.push(`%${query.search}%`);
      paramIdx++;
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      conditions.push(`t.is_active = $${paramIdx}`);
      params.push(query.isActive === 'true');
      paramIdx++;
    }

    if (query.departmentId) {
      conditions.push(`t.department_id = $${paramIdx}`);
      params.push(query.departmentId);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap: Record<string, string> = {
      name: 't.name',
      created_at: 't.created_at',
    };
    const sortCol = sortMap[query.sortBy || 'name'] || 't.name';
    const sortDir = query.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM "${schema}".teams t ${whereClause}`,
      params,
    );

    const teams = await this.dataSource.query(
      `SELECT t.id, t.name, t.description, t.department_id, t.team_lead_id,
              t.is_active, t.created_at, t.updated_at,
              d.name as department_name,
              tl.first_name as lead_first_name, tl.last_name as lead_last_name,
              tl.email as lead_email, tl.avatar_url as lead_avatar_url,
              (SELECT COUNT(*) FROM "${schema}".user_teams ut WHERE ut.team_id = t.id) as member_count
       FROM "${schema}".teams t
       LEFT JOIN "${schema}".departments d ON t.department_id = d.id
       LEFT JOIN "${schema}".users tl ON t.team_lead_id = tl.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total);

    return {
      data: teams.map((t: Record<string, unknown>) => this.formatTeam(t)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // GET ONE TEAM
  // ============================================================
  async findOne(schema: string, id: string) {
    const [team] = await this.dataSource.query(
      `SELECT t.id, t.name, t.description, t.department_id, t.team_lead_id,
              t.is_active, t.created_at, t.updated_at,
              d.name as department_name,
              tl.first_name as lead_first_name, tl.last_name as lead_last_name,
              tl.email as lead_email, tl.avatar_url as lead_avatar_url,
              (SELECT COUNT(*) FROM "${schema}".user_teams ut WHERE ut.team_id = t.id) as member_count
       FROM "${schema}".teams t
       LEFT JOIN "${schema}".departments d ON t.department_id = d.id
       LEFT JOIN "${schema}".users tl ON t.team_lead_id = tl.id
       WHERE t.id = $1`,
      [id],
    );

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Get members
    const members = await this.dataSource.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.job_title,
              u.avatar_url, u.status,
              r.name as role_name,
              ut.role as team_role, ut.joined_at
       FROM "${schema}".user_teams ut
       JOIN "${schema}".users u ON ut.user_id = u.id
       LEFT JOIN "${schema}".roles r ON u.role_id = r.id
       WHERE ut.team_id = $1 AND u.deleted_at IS NULL
       ORDER BY ut.role DESC, u.first_name ASC`,
      [id],
    );

    const result = this.formatTeam(team);
    return {
      ...result,
      members: members.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        firstName: m.first_name as string,
        lastName: m.last_name as string,
        email: m.email as string,
        jobTitle: (m.job_title as string) || null,
        avatarUrl: (m.avatar_url as string) || null,
        status: m.status as string,
        roleName: (m.role_name as string) || null,
        teamRole: m.team_role as string,
        joinedAt: m.joined_at as string,
      })),
    };
  }

  // ============================================================
  // CREATE TEAM
  // ============================================================
  async create(schema: string, dto: CreateTeamDto, userId: string) {
    // Validate department
    if (dto.departmentId) {
      const [dept] = await this.dataSource.query(
        `SELECT id FROM "${schema}".departments WHERE id = $1`,
        [dto.departmentId],
      );
      if (!dept) {
        throw new BadRequestException('Department not found');
      }
    }

    // Validate team lead
    if (dto.teamLeadId) {
      const [lead] = await this.dataSource.query(
        `SELECT id FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`,
        [dto.teamLeadId],
      );
      if (!lead) {
        throw new BadRequestException('Team lead user not found');
      }
    }

    // Check name uniqueness within department
    const nameConditions = [`UPPER(name) = UPPER($1)`];
    const nameParams: unknown[] = [dto.name];
    let pIdx = 2;

    if (dto.departmentId) {
      nameConditions.push(`department_id = $${pIdx}`);
      nameParams.push(dto.departmentId);
      pIdx++;
    } else {
      nameConditions.push(`department_id IS NULL`);
    }

    const [dupName] = await this.dataSource.query(
      `SELECT id FROM "${schema}".teams WHERE ${nameConditions.join(' AND ')}`,
      nameParams,
    );
    if (dupName) {
      throw new ConflictException(`Team "${dto.name}" already exists in this department`);
    }

    const [created] = await this.dataSource.query(
      `INSERT INTO "${schema}".teams (name, description, department_id, team_lead_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        dto.departmentId || null,
        dto.teamLeadId || null,
        dto.isActive !== false,
      ],
    );

    // Add initial members if provided
    if (dto.memberIds && dto.memberIds.length > 0) {
      await this.syncMembers(schema, created.id, dto.memberIds, dto.teamLeadId);
    }
    // Ensure team lead is also a member
    else if (dto.teamLeadId) {
      await this.addMemberInternal(schema, created.id, dto.teamLeadId, 'lead');
    }

    const result = await this.findOne(schema, created.id);

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'teams',
      entityId: created.id,
      action: 'create',
      changes: {},
      newValues: result as unknown as Record<string, unknown>,
      performedBy: userId,
    });

    this.logger.log(`Team created: ${created.id} (${dto.name}) in ${schema}`);
    return result;
  }

  // ============================================================
  // UPDATE TEAM
  // ============================================================
  async update(schema: string, id: string, dto: UpdateTeamDto, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schema}".teams WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Team not found');
    }

    const previousValues = this.formatTeam(existing);

    // Validate department
    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      const [dept] = await this.dataSource.query(
        `SELECT id FROM "${schema}".departments WHERE id = $1`,
        [dto.departmentId],
      );
      if (!dept) {
        throw new BadRequestException('Department not found');
      }
    }

    // Validate team lead
    if (dto.teamLeadId !== undefined && dto.teamLeadId !== null) {
      const [lead] = await this.dataSource.query(
        `SELECT id FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`,
        [dto.teamLeadId],
      );
      if (!lead) {
        throw new BadRequestException('Team lead user not found');
      }
    }

    // Name uniqueness within department (if changing)
    if (dto.name !== undefined && dto.name !== existing.name) {
      const deptId = dto.departmentId !== undefined ? dto.departmentId : existing.department_id;
      const nameConditions = [`UPPER(name) = UPPER($1)`, `id != $2`];
      const nameParams: unknown[] = [dto.name, id];
      let pIdx = 3;

      if (deptId) {
        nameConditions.push(`department_id = $${pIdx}`);
        nameParams.push(deptId);
      } else {
        nameConditions.push(`department_id IS NULL`);
      }

      const [dupName] = await this.dataSource.query(
        `SELECT id FROM "${schema}".teams WHERE ${nameConditions.join(' AND ')}`,
        nameParams,
      );
      if (dupName) {
        throw new ConflictException(`Team "${dto.name}" already exists in this department`);
      }
    }

    // Build dynamic update
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      departmentId: 'department_id',
      teamLeadId: 'team_lead_id',
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
      `UPDATE "${schema}".teams SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    // If team lead changed, update user_teams role
    if (dto.teamLeadId !== undefined) {
      // Demote old lead to member
      if (existing.team_lead_id && existing.team_lead_id !== dto.teamLeadId) {
        await this.dataSource.query(
          `UPDATE "${schema}".user_teams SET role = 'member' WHERE team_id = $1 AND user_id = $2`,
          [id, existing.team_lead_id],
        );
      }
      // Promote new lead (add if not member)
      if (dto.teamLeadId) {
        const [existingMembership] = await this.dataSource.query(
          `SELECT id FROM "${schema}".user_teams WHERE team_id = $1 AND user_id = $2`,
          [id, dto.teamLeadId],
        );
        if (existingMembership) {
          await this.dataSource.query(
            `UPDATE "${schema}".user_teams SET role = 'lead' WHERE team_id = $1 AND user_id = $2`,
            [id, dto.teamLeadId],
          );
        } else {
          await this.addMemberInternal(schema, id, dto.teamLeadId, 'lead');
        }
      }
    }

    const result = await this.findOne(schema, id);

    // ── Audit Log ──
    const changes = this.auditService.calculateChanges(
      previousValues as unknown as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      this.trackedFields,
    );
    if (Object.keys(changes).length > 0) {
      await this.auditService.log(schema, {
        entityType: 'teams',
        entityId: id,
        action: 'update',
        changes,
        previousValues: previousValues as unknown as Record<string, unknown>,
        newValues: result as unknown as Record<string, unknown>,
        performedBy: userId,
      });
    }

    this.logger.log(`Team updated: ${id} in ${schema}`);
    return result;
  }

  // ============================================================
  // DELETE TEAM
  // ============================================================
  async remove(schema: string, id: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT id, name FROM "${schema}".teams WHERE id = $1`,
      [id],
    );
    if (!existing) {
      throw new NotFoundException('Team not found');
    }

    // Delete team memberships first
    await this.dataSource.query(
      `DELETE FROM "${schema}".user_teams WHERE team_id = $1`,
      [id],
    );

    await this.dataSource.query(
      `DELETE FROM "${schema}".teams WHERE id = $1`,
      [id],
    );

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'teams',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: { name: existing.name },
      performedBy: userId,
    });

    this.logger.log(`Team deleted: ${id} (${existing.name}) in ${schema}`);
    return { message: `Team "${existing.name}" deleted` };
  }

  // ============================================================
  // ADD MEMBER
  // ============================================================
  async addMember(schema: string, teamId: string, dto: ManageTeamMemberDto, userId: string) {
    const [team] = await this.dataSource.query(
      `SELECT id, name FROM "${schema}".teams WHERE id = $1`,
      [teamId],
    );
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const [user] = await this.dataSource.query(
      `SELECT id, first_name, last_name FROM "${schema}".users WHERE id = $1 AND deleted_at IS NULL`,
      [dto.userId],
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check not already member
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schema}".user_teams WHERE team_id = $1 AND user_id = $2`,
      [teamId, dto.userId],
    );
    if (existing) {
      if (dto.role) {
        await this.dataSource.query(
          `UPDATE "${schema}".user_teams SET role = $1 WHERE team_id = $2 AND user_id = $3`,
          [dto.role, teamId, dto.userId],
        );
      }
      return this.findOne(schema, teamId);
    }

    await this.addMemberInternal(schema, teamId, dto.userId, dto.role || 'member');

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'teams',
      entityId: teamId,
      action: 'member_add',
      changes: {},
      performedBy: userId,
      metadata: {
        memberId: dto.userId,
        memberName: `${user.first_name} ${user.last_name}`,
        teamName: team.name,
        role: dto.role || 'member',
      },
    });

    this.logger.log(`Member ${dto.userId} added to team ${teamId} in ${schema}`);
    return this.findOne(schema, teamId);
  }

  // ============================================================
  // REMOVE MEMBER
  // ============================================================
  async removeMember(schema: string, teamId: string, memberId: string, userId: string) {
    const [team] = await this.dataSource.query(
      `SELECT id, name, team_lead_id FROM "${schema}".teams WHERE id = $1`,
      [teamId],
    );
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Get member name for audit
    const [member] = await this.dataSource.query(
      `SELECT first_name, last_name FROM "${schema}".users WHERE id = $1`,
      [memberId],
    );

    await this.dataSource.query(
      `DELETE FROM "${schema}".user_teams WHERE team_id = $1 AND user_id = $2`,
      [teamId, memberId],
    );

    // If removed member was team lead, clear team_lead_id
    if (team.team_lead_id === memberId) {
      await this.dataSource.query(
        `UPDATE "${schema}".teams SET team_lead_id = NULL, updated_at = NOW() WHERE id = $1`,
        [teamId],
      );
    }

    // ── Audit Log ──
    await this.auditService.log(schema, {
      entityType: 'teams',
      entityId: teamId,
      action: 'member_remove',
      changes: {},
      performedBy: userId,
      metadata: {
        memberId,
        memberName: member ? `${member.first_name} ${member.last_name}` : memberId,
        teamName: team.name,
      },
    });

    this.logger.log(`Member ${memberId} removed from team ${teamId} in ${schema}`);
    return this.findOne(schema, teamId);
  }

  // ============================================================
  // LOOKUP (for dropdowns)
  // ============================================================
  async getLookup(schema: string, departmentId?: string) {
    let query = `SELECT t.id, t.name, t.department_id, t.is_active,
                        d.name as department_name
                 FROM "${schema}".teams t
                 LEFT JOIN "${schema}".departments d ON t.department_id = d.id
                 WHERE t.is_active = true`;
    const params: unknown[] = [];

    if (departmentId) {
      query += ` AND t.department_id = $1`;
      params.push(departmentId);
    }

    query += ` ORDER BY t.name ASC`;

    const teams = await this.dataSource.query(query, params);

    return teams.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      departmentId: (t.department_id as string) || null,
      departmentName: (t.department_name as string) || null,
      isActive: t.is_active as boolean,
    }));
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async addMemberInternal(schema: string, teamId: string, userId: string, role: string) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".user_teams (user_id, team_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, team_id) DO UPDATE SET role = $3`,
      [userId, teamId, role],
    );
  }

  private async syncMembers(schema: string, teamId: string, memberIds: string[], teamLeadId?: string) {
    await this.dataSource.query(
      `DELETE FROM "${schema}".user_teams WHERE team_id = $1`,
      [teamId],
    );

    for (const userId of memberIds) {
      const role = userId === teamLeadId ? 'lead' : 'member';
      await this.addMemberInternal(schema, teamId, userId, role);
    }

    if (teamLeadId && !memberIds.includes(teamLeadId)) {
      await this.addMemberInternal(schema, teamId, teamLeadId, 'lead');
    }
  }

  private formatTeam(t: Record<string, unknown>): FormattedTeam {
    return {
      id: t.id as string,
      name: t.name as string,
      description: (t.description as string) || null,
      departmentId: (t.department_id as string) || null,
      departmentName: (t.department_name as string) || null,
      teamLeadId: (t.team_lead_id as string) || null,
      teamLead: t.lead_first_name
        ? {
            id: t.team_lead_id as string,
            firstName: t.lead_first_name as string,
            lastName: t.lead_last_name as string,
            email: t.lead_email as string,
            avatarUrl: (t.lead_avatar_url as string) || null,
          }
        : null,
      isActive: t.is_active as boolean,
      memberCount: t.member_count !== undefined ? parseInt(String(t.member_count)) : 0,
      createdAt: t.created_at as string,
      updatedAt: t.updated_at as string,
    };
  }
}