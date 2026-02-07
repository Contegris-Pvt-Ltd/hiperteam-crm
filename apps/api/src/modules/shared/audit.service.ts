import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { from: unknown; to: unknown }>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private dataSource: DataSource) {}

  async log(schemaName: string, entry: AuditLogEntry): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".audit_logs 
       (entity_type, entity_id, action, changes, previous_values, new_values, performed_by, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.changes,
        entry.previousValues || null,
        entry.newValues || null,
        entry.performedBy,
        entry.ipAddress || null,
        entry.userAgent || null,
      ],
    );
  }

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

    return logs.map((log: Record<string, unknown>) => ({
      id: log.id,
      action: log.action,
      changes: log.changes,
      previousValues: log.previous_values,
      newValues: log.new_values,
      performedBy: log.first_name
        ? { id: log.performed_by, firstName: log.first_name, lastName: log.last_name, email: log.email }
        : null,
      ipAddress: log.ip_address,
      createdAt: log.created_at,
    }));
  }

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
}