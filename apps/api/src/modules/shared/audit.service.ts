import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

// ============================================================
// TYPES
// ============================================================

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'invite' | 'password_reset' | 'status_change' | 'member_add' | 'member_remove';
  changes: Record<string, { from: unknown; to: unknown }>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>; // extra context (e.g. login method, invite email)
}

export interface AuditQueryOptions {
  entityType?: string;
  entityId?: string;
  action?: string;
  performedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // LOG AN AUDIT EVENT
  // ============================================================
  async log(schemaName: string, entry: AuditLogEntry): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".audit_logs 
         (entity_type, entity_id, action, changes, previous_values, new_values, performed_by, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          entry.entityType,
          entry.entityId,
          entry.action,
          entry.changes || {},
          entry.previousValues || null,
          entry.newValues || null,
          entry.performedBy,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.metadata || null,
        ],
      );
    } catch (error) {
      // Audit logging should never break the main flow
      this.logger.error(`Audit log failed for ${entry.entityType}/${entry.entityId}: ${error}`);
    }
  }

  // ============================================================
  // GET HISTORY FOR A SPECIFIC ENTITY
  // ============================================================
  async getHistory(
    schemaName: string,
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<Record<string, unknown>[]> {
    const logs = await this.dataSource.query(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM "${schemaName}".audit_logs al
       LEFT JOIN "${schemaName}".users u ON al.performed_by = u.id
       WHERE al.entity_type = $1 AND al.entity_id = $2
       ORDER BY al.created_at DESC
       LIMIT $3`,
      [entityType, entityId, limit],
    );

    return logs.map((log: Record<string, unknown>) => this.formatLog(log));
  }

  // ============================================================
  // GLOBAL AUDIT LOG QUERY (Admin → Activity Feed)
  // ============================================================
  async query(
    schemaName: string,
    options: AuditQueryOptions,
  ): Promise<{ data: Record<string, unknown>[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.entityType) {
      conditions.push(`al.entity_type = $${paramIdx}`);
      params.push(options.entityType);
      paramIdx++;
    }

    if (options.entityId) {
      conditions.push(`al.entity_id = $${paramIdx}`);
      params.push(options.entityId);
      paramIdx++;
    }

    if (options.action) {
      conditions.push(`al.action = $${paramIdx}`);
      params.push(options.action);
      paramIdx++;
    }

    if (options.performedBy) {
      conditions.push(`al.performed_by = $${paramIdx}`);
      params.push(options.performedBy);
      paramIdx++;
    }

    if (options.startDate) {
      conditions.push(`al.created_at >= $${paramIdx}`);
      params.push(options.startDate);
      paramIdx++;
    }

    if (options.endDate) {
      conditions.push(`al.created_at <= $${paramIdx}`);
      params.push(options.endDate);
      paramIdx++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM "${schemaName}".audit_logs al ${whereClause}`,
      params,
    );

    const logs = await this.dataSource.query(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM "${schemaName}".audit_logs al
       LEFT JOIN "${schemaName}".users u ON al.performed_by = u.id
       ${whereClause}
       ORDER BY al.created_at ${sortOrder}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    const total = parseInt(countResult.total);

    return {
      data: logs.map((log: Record<string, unknown>) => this.formatLog(log)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // CALCULATE CHANGES BETWEEN TWO STATES
  // ============================================================
  calculateChanges(
    previous: Record<string, unknown>,
    current: Record<string, unknown>,
    fieldsToTrack: string[],
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of fieldsToTrack) {
      const prevValue = previous[field];
      const currValue = current[field];

      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes[field] = { from: prevValue, to: currValue };
      }
    }

    return changes;
  }

  // ============================================================
  // HELPER: format a raw audit_logs row
  // ============================================================
  private formatLog(log: Record<string, unknown>): Record<string, unknown> {
    return {
      id: log.id,
      entityType: log.entity_type,
      entityId: log.entity_id,
      action: log.action,
      changes: log.changes,
      previousValues: log.previous_values,
      newValues: log.new_values,
      metadata: log.metadata || null,
      performedBy: log.first_name
        ? { id: log.performed_by, firstName: log.first_name, lastName: log.last_name, email: log.email }
        : { id: log.performed_by },
      ipAddress: log.ip_address,
      createdAt: log.created_at,
    };
  }
}