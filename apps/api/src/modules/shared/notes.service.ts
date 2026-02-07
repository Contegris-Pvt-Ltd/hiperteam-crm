import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NotesService {
  constructor(private dataSource: DataSource) {}

  async create(
    schemaName: string,
    entityType: string,
    entityId: string,
    content: string,
    createdBy: string,
  ): Promise<Record<string, unknown>> {
    const [note] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".notes (entity_type, entity_id, content, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entityType, entityId, content, createdBy],
    );

    return this.formatNote(note);
  }

  async findByEntity(
    schemaName: string,
    entityType: string,
    entityId: string,
  ): Promise<Record<string, unknown>[]> {
    const notes = await this.dataSource.query(
      `SELECT n.*, u.first_name, u.last_name
       FROM "${schemaName}".notes n
       LEFT JOIN "${schemaName}".users u ON n.created_by = u.id
       WHERE n.entity_type = $1 AND n.entity_id = $2 AND n.deleted_at IS NULL
       ORDER BY n.is_pinned DESC, n.created_at DESC`,
      [entityType, entityId],
    );

    return notes.map((n: Record<string, unknown>) => this.formatNote(n));
  }

  async update(schemaName: string, id: string, content: string): Promise<Record<string, unknown>> {
    const [note] = await this.dataSource.query(
      `UPDATE "${schemaName}".notes SET content = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [content, id],
    );

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return this.formatNote(note);
  }

  async togglePin(schemaName: string, id: string): Promise<Record<string, unknown>> {
    const [note] = await this.dataSource.query(
      `UPDATE "${schemaName}".notes SET is_pinned = NOT is_pinned, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id],
    );

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return this.formatNote(note);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    const [note] = await this.dataSource.query(
      `UPDATE "${schemaName}".notes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id],
    );

    if (!note) {
      throw new NotFoundException('Note not found');
    }
  }

  private formatNote(note: Record<string, unknown>): Record<string, unknown> {
    return {
      id: note.id,
      content: note.content,
      isPinned: note.is_pinned,
      createdBy: note.first_name
        ? { id: note.created_by, firstName: note.first_name, lastName: note.last_name }
        : { id: note.created_by },
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
  }
}