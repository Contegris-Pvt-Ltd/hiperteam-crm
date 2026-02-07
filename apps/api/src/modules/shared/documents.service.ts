import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CreateDocumentDto {
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  storageUrl?: string;
  entityType: string;
  entityId: string;
  description?: string;
  tags?: string[];
  uploadedBy: string;
}

@Injectable()
export class DocumentsService {
  constructor(private dataSource: DataSource) {}

  async create(schemaName: string, dto: CreateDocumentDto): Promise<Record<string, unknown>> {
    const [doc] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".documents 
       (name, original_name, mime_type, size_bytes, storage_path, storage_url, entity_type, entity_id, description, tags, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        dto.name,
        dto.originalName,
        dto.mimeType,
        dto.sizeBytes,
        dto.storagePath,
        dto.storageUrl || null,
        dto.entityType,
        dto.entityId,
        dto.description || null,
        dto.tags || [],
        dto.uploadedBy,
      ],
    );

    return this.formatDocument(doc);
  }

  async findByEntity(
    schemaName: string,
    entityType: string,
    entityId: string,
  ): Promise<Record<string, unknown>[]> {
    const docs = await this.dataSource.query(
      `SELECT d.*, u.first_name, u.last_name
       FROM "${schemaName}".documents d
       LEFT JOIN "${schemaName}".users u ON d.uploaded_by = u.id
       WHERE d.entity_type = $1 AND d.entity_id = $2 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [entityType, entityId],
    );

    return docs.map((d: Record<string, unknown>) => this.formatDocument(d));
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const [doc] = await this.dataSource.query(
      `UPDATE "${schemaName}".documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );

    if (!doc) {
      throw new NotFoundException('Document not found');
    }
  }

  private formatDocument(doc: Record<string, unknown>): Record<string, unknown> {
    return {
      id: doc.id,
      name: doc.name,
      originalName: doc.original_name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      storagePath: doc.storage_path,
      storageUrl: doc.storage_url,
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      description: doc.description,
      tags: doc.tags,
      uploadedBy: doc.first_name
        ? { id: doc.uploaded_by, firstName: doc.first_name, lastName: doc.last_name }
        : { id: doc.uploaded_by },
      createdAt: doc.created_at,
    };
  }
}