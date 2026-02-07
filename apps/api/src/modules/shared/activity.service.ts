import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CreateActivityDto {
  entityType: string;
  entityId: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
  performedBy: string;
}

@Injectable()
export class ActivityService {
  constructor(private dataSource: DataSource) {}

  async create(schemaName: string, dto: CreateActivityDto): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".activities 
       (entity_type, entity_id, activity_type, title, description, metadata, related_type, related_id, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        dto.entityType,
        dto.entityId,
        dto.activityType,
        dto.title,
        dto.description || null,
        dto.metadata || {},
        dto.relatedType || null,
        dto.relatedId || null,
        dto.performedBy,
      ],
    );
  }

  async getTimeline(
    schemaName: string,
    entityType: string,
    entityId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Record<string, unknown>[]; total: number }> {
    const offset = (page - 1) * limit;

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".activities 
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
    );

    const activities = await this.dataSource.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM "${schemaName}".activities a
       LEFT JOIN "${schemaName}".users u ON a.performed_by = u.id
       WHERE a.entity_type = $1 AND a.entity_id = $2
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, limit, offset],
    );

    return {
      data: activities.map((a: Record<string, unknown>) => ({
        id: a.id,
        activityType: a.activity_type,
        title: a.title,
        description: a.description,
        metadata: a.metadata,
        relatedType: a.related_type,
        relatedId: a.related_id,
        performedBy: a.first_name
          ? { id: a.performed_by, firstName: a.first_name, lastName: a.last_name, email: a.email }
          : null,
        createdAt: a.created_at,
      })),
      total: parseInt(count),
    };
  }
}