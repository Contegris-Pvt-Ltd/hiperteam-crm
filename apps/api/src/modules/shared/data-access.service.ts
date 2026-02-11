/**
 * DATA ACCESS SERVICE
 * 
 * Resolves record-level access control into SQL WHERE clauses.
 * Used by module services (contacts, accounts, leads, etc.) to filter
 * records based on the requesting user's role record_access settings.
 *
 * Access Levels (hierarchy order):
 *   own             → only records owned by the user
 *   team            → records owned by anyone in the user's team(s)
 *   department      → records owned by anyone in the user's department(s)
 *   reporting_line  → records owned by the user + all subordinates (manager_id chain)
 *   all             → no filtering
 *
 * Location: apps/api/src/modules/shared/data-access.service.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type AccessLevel = 'own' | 'team' | 'department' | 'reporting_line' | 'all';

export interface DataAccessContext {
  userId: string;
  tenantSchema: string;
  module: string;
  /** The role's record_access value for this module */
  accessLevel: AccessLevel;
}

export interface AccessFilter {
  /** SQL WHERE clause fragment, e.g. "owner_id IN ($3, $4, $5)" */
  whereClause: string;
  /** Parameter values to bind (appended to the caller's existing params) */
  params: unknown[];
  /** The user IDs that the filter resolves to (for debugging / audit) */
  resolvedUserIds: string[];
}

@Injectable()
export class DataAccessService {
  private readonly logger = new Logger(DataAccessService.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // MAIN ENTRY POINT
  // ============================================================

  /**
   * Build a SQL filter based on the user's access level for a module.
   *
   * @param ctx         - userId, tenantSchema, module, accessLevel
   * @param ownerColumn - the column to filter on (default: 'owner_id')
   * @param paramOffset - the starting $N index for parameter binding
   * @returns AccessFilter with whereClause, params, and resolvedUserIds
   *
   * Usage in a service:
   *   const filter = await this.dataAccessService.buildAccessFilter({
   *     userId: req.user.sub,
   *     tenantSchema: req.user.tenantSchema,
   *     module: 'contacts',
   *     accessLevel: recordAccess.contacts, // e.g. 'team'
   *   }, 'c.owner_id', paramIndex);
   *
   *   whereClause += ` AND ${filter.whereClause}`;
   *   params.push(...filter.params);
   *   paramIndex += filter.params.length;
   */
  async buildAccessFilter(
    ctx: DataAccessContext,
    ownerColumn = 'owner_id',
    paramOffset = 1,
  ): Promise<AccessFilter> {
    const { accessLevel } = ctx;

    switch (accessLevel) {
      case 'all':
        return { whereClause: '1=1', params: [], resolvedUserIds: [] };

      case 'own':
        return {
          whereClause: `${ownerColumn} = $${paramOffset}`,
          params: [ctx.userId],
          resolvedUserIds: [ctx.userId],
        };

      case 'team':
        return this.buildTeamFilter(ctx, ownerColumn, paramOffset);

      case 'department':
        return this.buildDepartmentFilter(ctx, ownerColumn, paramOffset);

      case 'reporting_line':
        return this.buildReportingLineFilter(ctx, ownerColumn, paramOffset);

      default:
        // Unknown level → fall back to 'own' for safety
        this.logger.warn(
          `Unknown access level "${accessLevel}" for user ${ctx.userId} on module ${ctx.module}. Falling back to "own".`,
        );
        return {
          whereClause: `${ownerColumn} = $${paramOffset}`,
          params: [ctx.userId],
          resolvedUserIds: [ctx.userId],
        };
    }
  }

  // ============================================================
  // RESOLVE ACCESS LEVEL FROM USER'S JWT / ROLE
  // ============================================================

  /**
   * Get the effective access level for a user on a module.
   * Reads the user's role → record_access JSONB.
   * Falls back to 'own' if not configured.
   */
  async getAccessLevel(
    tenantSchema: string,
    userId: string,
    module: string,
  ): Promise<AccessLevel> {
    const [row] = await this.dataSource.query(
      `SELECT r.record_access
       FROM "${tenantSchema}".users u
       JOIN "${tenantSchema}".roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    );

    if (!row) return 'own';

    const recordAccess = typeof row.record_access === 'string'
      ? JSON.parse(row.record_access)
      : (row.record_access || {});

    const level = recordAccess[module];
    if (level && ['own', 'team', 'department', 'reporting_line', 'all'].includes(level)) {
      return level as AccessLevel;
    }

    return 'own';
  }

  /**
   * Check if user has 'all' access (admin wildcard check).
   * Returns true if permissions = {"*": {"*": "all"}} OR record_access[module] = 'all'.
   */
  async hasFullAccess(
    tenantSchema: string,
    userId: string,
    module: string,
  ): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT r.permissions, r.record_access
       FROM "${tenantSchema}".users u
       JOIN "${tenantSchema}".roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId],
    );

    if (!row) return false;

    const permissions = typeof row.permissions === 'string'
      ? JSON.parse(row.permissions)
      : (row.permissions || {});

    // Admin wildcard
    if (permissions['*']?.['*'] === 'all') return true;

    const recordAccess = typeof row.record_access === 'string'
      ? JSON.parse(row.record_access)
      : (row.record_access || {});

    return recordAccess[module] === 'all';
  }

  // ============================================================
  // TEAM-LEVEL FILTER
  // ============================================================

  /**
   * Get all user IDs that share a team with the requesting user.
   * Includes the requesting user themselves.
   */
  private async buildTeamFilter(
    ctx: DataAccessContext,
    ownerColumn: string,
    paramOffset: number,
  ): Promise<AccessFilter> {
    const userIds = await this.getTeamUserIds(ctx.tenantSchema, ctx.userId);
    return this.buildInFilter(userIds, ownerColumn, paramOffset);
  }

  async getTeamUserIds(tenantSchema: string, userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT tm2.user_id
       FROM "${tenantSchema}".team_members tm1
       JOIN "${tenantSchema}".team_members tm2 ON tm1.team_id = tm2.team_id
       JOIN "${tenantSchema}".users u ON tm2.user_id = u.id AND u.deleted_at IS NULL
       WHERE tm1.user_id = $1`,
      [userId],
    );

    const userIds = rows.map((r: Record<string, unknown>) => r.user_id as string);

    // Always include the requesting user
    if (!userIds.includes(userId)) {
      userIds.push(userId);
    }

    return userIds;
  }

  // ============================================================
  // DEPARTMENT-LEVEL FILTER
  // ============================================================

  /**
   * Get all user IDs in the same department(s) as the requesting user.
   * This includes:
   *   - Users directly assigned to the same department (via users.department_id)
   *   - Users in teams that belong to the same department
   * Includes the requesting user themselves.
   */
  private async buildDepartmentFilter(
    ctx: DataAccessContext,
    ownerColumn: string,
    paramOffset: number,
  ): Promise<AccessFilter> {
    const userIds = await this.getDepartmentUserIds(ctx.tenantSchema, ctx.userId);
    return this.buildInFilter(userIds, ownerColumn, paramOffset);
  }

  async getDepartmentUserIds(tenantSchema: string, userId: string): Promise<string[]> {
    // Step 1: Get the requesting user's department(s)
    // Users can be in a department via users.department_id
    // or via team membership (teams belong to departments)
    const deptRows = await this.dataSource.query(
      `SELECT DISTINCT dept_id FROM (
         -- Direct department assignment
         SELECT department_id as dept_id
         FROM "${tenantSchema}".users
         WHERE id = $1 AND department_id IS NOT NULL AND deleted_at IS NULL
         UNION
         -- Department via team membership
         SELECT t.department_id as dept_id
         FROM "${tenantSchema}".team_members tm
         JOIN "${tenantSchema}".teams t ON tm.team_id = t.id
         WHERE tm.user_id = $1 AND t.department_id IS NOT NULL
       ) depts`,
      [userId],
    );

    if (deptRows.length === 0) {
      // User not in any department → fall back to own
      return [userId];
    }

    const deptIds = deptRows.map((r: Record<string, unknown>) => r.dept_id as string);

    // Step 2: Get all users in those departments
    // Including sub-departments (recursive)
    const placeholders = deptIds.map((_: string, i: number) => `$${i + 1}`).join(', ');

    const userRows = await this.dataSource.query(
      `SELECT DISTINCT user_id FROM (
         -- Users directly in the department (or sub-departments)
         SELECT u.id as user_id
         FROM "${tenantSchema}".users u
         WHERE u.department_id IN (
           WITH RECURSIVE dept_tree AS (
             SELECT id FROM "${tenantSchema}".departments WHERE id IN (${placeholders})
             UNION ALL
             SELECT d.id FROM "${tenantSchema}".departments d
             JOIN dept_tree dt ON d.parent_department_id = dt.id
           )
           SELECT id FROM dept_tree
         ) AND u.deleted_at IS NULL
         UNION
         -- Users in teams belonging to the department (or sub-departments)
         SELECT tm.user_id
         FROM "${tenantSchema}".team_members tm
         JOIN "${tenantSchema}".teams t ON tm.team_id = t.id
         JOIN "${tenantSchema}".users u ON tm.user_id = u.id AND u.deleted_at IS NULL
         WHERE t.department_id IN (
           WITH RECURSIVE dept_tree AS (
             SELECT id FROM "${tenantSchema}".departments WHERE id IN (${placeholders})
             UNION ALL
             SELECT d.id FROM "${tenantSchema}".departments d
             JOIN dept_tree dt ON d.parent_department_id = dt.id
           )
           SELECT id FROM dept_tree
         )
       ) dept_users`,
      [...deptIds, ...deptIds],
    );

    const userIds = userRows.map((r: Record<string, unknown>) => r.user_id as string);

    if (!userIds.includes(userId)) {
      userIds.push(userId);
    }

    return userIds;
  }

  // ============================================================
  // REPORTING LINE FILTER
  // ============================================================

  /**
   * Get the requesting user + all their subordinates (direct and indirect)
   * by traversing the manager_id chain recursively.
   */
  private async buildReportingLineFilter(
    ctx: DataAccessContext,
    ownerColumn: string,
    paramOffset: number,
  ): Promise<AccessFilter> {
    const userIds = await this.getSubordinateUserIds(ctx.tenantSchema, ctx.userId);
    return this.buildInFilter(userIds, ownerColumn, paramOffset);
  }

  async getSubordinateUserIds(tenantSchema: string, managerId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `WITH RECURSIVE subordinates AS (
         -- Base: the manager themselves
         SELECT id FROM "${tenantSchema}".users WHERE id = $1 AND deleted_at IS NULL
         UNION ALL
         -- Recursive: all users whose manager_id points to someone in the chain
         SELECT u.id
         FROM "${tenantSchema}".users u
         JOIN subordinates s ON u.manager_id = s.id
         WHERE u.deleted_at IS NULL
       )
       SELECT id FROM subordinates`,
      [managerId],
    );

    return rows.map((r: Record<string, unknown>) => r.id as string);
  }

  // ============================================================
  // HELPER: Build IN (...) clause
  // ============================================================

  private buildInFilter(
    userIds: string[],
    ownerColumn: string,
    paramOffset: number,
  ): AccessFilter {
    if (userIds.length === 0) {
      // Should not happen, but safety: deny all
      return { whereClause: '1=0', params: [], resolvedUserIds: [] };
    }

    if (userIds.length === 1) {
      return {
        whereClause: `${ownerColumn} = $${paramOffset}`,
        params: [userIds[0]],
        resolvedUserIds: userIds,
      };
    }

    const placeholders = userIds.map((_: string, i: number) => `$${paramOffset + i}`).join(', ');
    return {
      whereClause: `${ownerColumn} IN (${placeholders})`,
      params: userIds,
      resolvedUserIds: userIds,
    };
  }
}