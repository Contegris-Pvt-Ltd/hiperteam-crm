import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CustomTab {
  id: string;
  name: string;
  module: string;
  icon: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomTabDto {
  name: string;
  module: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateCustomTabDto {
  name?: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

@Injectable()
export class CustomTabsService {
  constructor(private dataSource: DataSource) {}

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
    return result;
  }

  private formatTab(row: Record<string, unknown>): CustomTab {
    const formatted = this.toCamelCase(row);
    return {
      id: formatted.id as string,
      name: formatted.name as string,
      module: formatted.module as string,
      icon: (formatted.icon as string) || 'folder',
      description: formatted.description as string | null,
      displayOrder: formatted.displayOrder as number,
      isActive: formatted.isActive as boolean,
      createdAt: formatted.createdAt as Date,
      updatedAt: formatted.updatedAt as Date,
    };
  }

  async findByModule(schemaName: string, module: string): Promise<CustomTab[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".custom_tabs 
       WHERE module = $1 
       ORDER BY display_order ASC, name ASC`,
      [module]
    );
    return result.map((row: Record<string, unknown>) => this.formatTab(row));
  }

  async findAll(schemaName: string): Promise<CustomTab[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".custom_tabs 
       ORDER BY module ASC, display_order ASC, name ASC`
    );
    return result.map((row: Record<string, unknown>) => this.formatTab(row));
  }

  async findOne(schemaName: string, id: string): Promise<CustomTab> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".custom_tabs WHERE id = $1`,
      [id]
    );
    if (!result.length) {
      throw new NotFoundException('Custom tab not found');
    }
    return this.formatTab(result[0]);
  }

  async create(schemaName: string, dto: CreateCustomTabDto): Promise<CustomTab> {
    // Get max display order
    const maxOrderResult = await this.dataSource.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
       FROM "${schemaName}".custom_tabs WHERE module = $1`,
      [dto.module]
    );
    const displayOrder = dto.displayOrder ?? maxOrderResult[0].next_order;

    const result = await this.dataSource.query(
      `INSERT INTO "${schemaName}".custom_tabs 
       (name, module, icon, description, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dto.name,
        dto.module,
        dto.icon || 'folder',
        dto.description || null,
        displayOrder,
      ]
    );
    return this.formatTab(result[0]);
  }

  async update(schemaName: string, id: string, dto: UpdateCustomTabDto): Promise<CustomTab> {
    const existing = await this.findOne(schemaName, id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(dto.icon);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.displayOrder !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(dto.displayOrder);
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(dto.isActive);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".custom_tabs 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return this.formatTab(result[0]);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    await this.findOne(schemaName, id);
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".custom_tabs WHERE id = $1`,
      [id]
    );
  }

  async reorder(schemaName: string, module: string, tabIds: string[]): Promise<CustomTab[]> {
    for (let i = 0; i < tabIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".custom_tabs 
         SET display_order = $1, updated_at = NOW()
         WHERE id = $2 AND module = $3`,
        [i, tabIds[i], module]
      );
    }
    return this.findByModule(schemaName, module);
  }
}