// ============================================================
// FILE: apps/api/src/modules/shared/record-team.service.ts
// ============================================================
import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface AddMemberParams {
  entityType: string;
  entityId: string;
  userId: string;
  roleId?: string | null;
  roleName?: string;
  accessLevel?: 'read' | 'write';
  addedBy: string;
}

@Injectable()
export class RecordTeamService {
  private readonly logger = new Logger(RecordTeamService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get all team members for a record
   */
  async getMembers(schemaName: string, entityType: string, entityId: string) {
    const members = await this.dataSource.query(
      `SELECT rtm.id, rtm.user_id, rtm.role_id, rtm.role_name, rtm.access_level, rtm.created_at,
              u.first_name, u.last_name, u.email, u.avatar_url, u.job_title,
              rtr.name as role_def_name, rtr.description as role_description
       FROM "${schemaName}".record_team_members rtm
       LEFT JOIN "${schemaName}".users u ON rtm.user_id = u.id
       LEFT JOIN "${schemaName}".record_team_roles rtr ON rtm.role_id = rtr.id
       WHERE rtm.entity_type = $1 AND rtm.entity_id = $2
       ORDER BY rtm.created_at ASC`,
      [entityType, entityId],
    );

    return members.map((m: Record<string, unknown>) => ({
      id: m.id,
      userId: m.user_id,
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      avatarUrl: m.avatar_url,
      jobTitle: m.job_title,
      roleId: m.role_id,
      roleName: m.role_name || m.role_def_name,
      roleDescription: m.role_description,
      accessLevel: m.access_level,
      addedAt: m.created_at,
    }));
  }

  /**
   * Add a member to a record's team
   */
  async addMember(schemaName: string, params: AddMemberParams) {
    const { entityType, entityId, userId, roleId, roleName, accessLevel, addedBy } = params;

    try {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".record_team_members 
         (entity_type, entity_id, user_id, role_id, role_name, access_level, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (entity_type, entity_id, user_id)
         DO UPDATE SET role_id = $4, role_name = $5, access_level = $6`,
        [entityType, entityId, userId, roleId || null, roleName || null, accessLevel || 'read', addedBy],
      );

      return { message: 'Team member added successfully' };
    } catch (error) {
      this.logger.error(`Failed to add team member: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a member from a record's team
   */
  async removeMember(schemaName: string, entityType: string, entityId: string, userId: string) {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".record_team_members
       WHERE entity_type = $1 AND entity_id = $2 AND user_id = $3`,
      [entityType, entityId, userId],
    );

    if (result[1] === 0) {
      throw new NotFoundException('Team member not found');
    }

    return { message: 'Team member removed successfully' };
  }

  /**
   * Update a member's role or access level
   */
  async updateMember(
    schemaName: string,
    entityType: string,
    entityId: string,
    userId: string,
    updates: { roleId?: string; roleName?: string; accessLevel?: string },
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.roleId !== undefined) {
      sets.push(`role_id = $${idx}`);
      params.push(updates.roleId);
      idx++;
    }
    if (updates.roleName !== undefined) {
      sets.push(`role_name = $${idx}`);
      params.push(updates.roleName);
      idx++;
    }
    if (updates.accessLevel !== undefined) {
      sets.push(`access_level = $${idx}`);
      params.push(updates.accessLevel);
      idx++;
    }

    if (sets.length === 0) return;

    params.push(entityType, entityId, userId);
    await this.dataSource.query(
      `UPDATE "${schemaName}".record_team_members
       SET ${sets.join(', ')}
       WHERE entity_type = $${idx} AND entity_id = $${idx + 1} AND user_id = $${idx + 2}`,
      params,
    );

    return { message: 'Team member updated successfully' };
  }

  /**
   * Check if a user is a team member of a record
   */
  async isMember(schemaName: string, entityType: string, entityId: string, userId: string): Promise<boolean> {
    const [result] = await this.dataSource.query(
      `SELECT EXISTS(
        SELECT 1 FROM "${schemaName}".record_team_members
        WHERE entity_type = $1 AND entity_id = $2 AND user_id = $3
      ) as exists`,
      [entityType, entityId, userId],
    );
    return result?.exists || false;
  }

  /**
   * Get all available record team roles
   */
  async getRoles(schemaName: string) {
    const roles = await this.dataSource.query(
      `SELECT id, name, description, is_system, sort_order
       FROM "${schemaName}".record_team_roles
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );

    return roles.map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      sortOrder: r.sort_order,
    }));
  }
}
