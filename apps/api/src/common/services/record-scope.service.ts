import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { RecordScope, getRecordScope } from '../types/permissions.types';

/**
 * RecordScopeService
 * 
 * Builds SQL WHERE clauses based on the user's record_access permissions.
 * This service is the enforcement layer for Level 2 RBAC (record-level access).
 *
 * Usage in any service:
 *   const scopeClause = await this.recordScope.buildWhereClause(user, 'contacts', schema, 'c.owner_id');
 *   const query = `SELECT * FROM "${schema}".contacts c WHERE ${scopeClause} AND c.deleted_at IS NULL`;
 *
 * Scopes:
 *   "own"        → owner_id = current user
 *   "team"       → owner_id IN (users who share a team with current user)
 *   "department" → owner_id IN (users in the same department)
 *   "all"        → no restriction (returns 'TRUE')
 */
@Injectable()
export class RecordScopeService {
  private readonly logger = new Logger(RecordScopeService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Build a SQL WHERE clause fragment for record-level access control.
   *
   * @param user       - The authenticated user (JwtPayload)
   * @param module     - The CRM module (contacts, accounts, etc.)
   * @param schema     - The tenant schema name
   * @param ownerCol   - The column name for the record owner (e.g., 'c.owner_id')
   * @returns SQL fragment like: `c.owner_id = 'uuid'` or `c.owner_id IN (...)` or `TRUE`
   */
  async buildWhereClause(
    user: JwtPayload,
    module: string,
    schema: string,
    ownerCol: string = 'owner_id',
  ): Promise<string> {
    const scope = getRecordScope(user.recordAccess || {}, module);

    switch (scope) {
      case 'all':
        return 'TRUE';

      case 'own':
        return `${ownerCol} = '${user.sub}'`;

      case 'team':
        return this.buildTeamScope(user, schema, ownerCol);

      case 'department':
        return this.buildDepartmentScope(user, schema, ownerCol);

      default:
        // Fallback to own
        this.logger.warn(`Unknown scope "${scope}" for module "${module}", falling back to "own"`);
        return `${ownerCol} = '${user.sub}'`;
    }
  }

  /**
   * Get list of user IDs visible to the current user based on scope.
   * Useful for non-SQL filtering scenarios.
   */
  async getVisibleUserIds(
    user: JwtPayload,
    module: string,
    schema: string,
  ): Promise<string[] | null> {
    const scope = getRecordScope(user.recordAccess || {}, module);

    switch (scope) {
      case 'all':
        return null; // null = no filtering needed

      case 'own':
        return [user.sub];

      case 'team':
        return this.getTeamUserIds(user, schema);

      case 'department':
        return this.getDepartmentUserIds(user, schema);

      default:
        return [user.sub];
    }
  }

  /**
   * Build WHERE clause for team scope:
   * User can see records owned by anyone in their team(s), including themselves.
   */
  private async buildTeamScope(
    user: JwtPayload,
    schema: string,
    ownerCol: string,
  ): Promise<string> {
    const teamUserIds = await this.getTeamUserIds(user, schema);

    if (teamUserIds.length === 0) {
      // No team → fall back to own
      return `${ownerCol} = '${user.sub}'`;
    }

    const idList = teamUserIds.map(id => `'${id}'`).join(',');
    return `${ownerCol} IN (${idList})`;
  }

  /**
   * Build WHERE clause for department scope:
   * User can see records owned by anyone in their department, including themselves.
   */
  private async buildDepartmentScope(
    user: JwtPayload,
    schema: string,
    ownerCol: string,
  ): Promise<string> {
    const deptUserIds = await this.getDepartmentUserIds(user, schema);

    if (deptUserIds.length === 0) {
      return `${ownerCol} = '${user.sub}'`;
    }

    const idList = deptUserIds.map(id => `'${id}'`).join(',');
    return `${ownerCol} IN (${idList})`;
  }

  /**
   * Get all user IDs in the same team(s) as the current user.
   */
  private async getTeamUserIds(user: JwtPayload, schema: string): Promise<string[]> {
    try {
      const result = await this.dataSource.query(`
        SELECT DISTINCT ut2.user_id
        FROM "${schema}".user_teams ut1
        JOIN "${schema}".user_teams ut2 ON ut1.team_id = ut2.team_id
        WHERE ut1.user_id = $1
      `, [user.sub]);

      const ids = result.map((r: { user_id: string }) => r.user_id);

      // Always include the user themselves
      if (!ids.includes(user.sub)) {
        ids.push(user.sub);
      }

      return ids;
    } catch (err) {
      this.logger.error('Failed to get team user IDs', err);
      return [user.sub];
    }
  }

  /**
   * Get all user IDs in the same department as the current user.
   */
  private async getDepartmentUserIds(user: JwtPayload, schema: string): Promise<string[]> {
    if (!user.departmentId) {
      return [user.sub];
    }

    try {
      const result = await this.dataSource.query(`
        SELECT id as user_id
        FROM "${schema}".users
        WHERE department_id = $1
          AND deleted_at IS NULL
          AND status = 'active'
      `, [user.departmentId]);

      const ids = result.map((r: { user_id: string }) => r.user_id);

      if (!ids.includes(user.sub)) {
        ids.push(user.sub);
      }

      return ids;
    } catch (err) {
      this.logger.error('Failed to get department user IDs', err);
      return [user.sub];
    }
  }

  /**
   * Get the effective scope for a user + module combination.
   * Utility for frontend to know what scope to display.
   */
  getEffectiveScope(user: JwtPayload, module: string): RecordScope {
    return getRecordScope(user.recordAccess || {}, module);
  }
}