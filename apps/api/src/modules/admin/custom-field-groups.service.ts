import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CustomFieldGroup {
  id: string;
  name: string;
  module: string;
  tabId: string | null;
  section: string | null;
  icon: string | null;
  description: string | null;
  displayOrder: number;
  collapsedByDefault: boolean;
  columns: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  tab?: { id: string; name: string };
  fieldCount?: number;
}

export interface CreateCustomFieldGroupDto {
  name: string;
  module: string;
  tabId?: string;
  section?: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
  collapsedByDefault?: boolean;
  columns?: number;
}

export interface UpdateCustomFieldGroupDto {
  name?: string;
  tabId?: string | null;
  section?: string | null;
  icon?: string;
  description?: string;
  displayOrder?: number;
  collapsedByDefault?: boolean;
  columns?: number;
  isActive?: boolean;
}

@Injectable()
export class CustomFieldGroupsService {
  constructor(private dataSource: DataSource) {}

  private toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
    return result;
  }

  private formatGroup(row: Record<string, unknown>): CustomFieldGroup {
    const formatted = this.toCamelCase(row);
    return {
      id: formatted.id as string,
      name: formatted.name as string,
      module: formatted.module as string,
      tabId: formatted.tabId as string | null,
      section: formatted.section as string | null,
      icon: formatted.icon as string | null,
      description: formatted.description as string | null,
      displayOrder: formatted.displayOrder as number,
      collapsedByDefault: formatted.collapsedByDefault as boolean,
      columns: (formatted.columns as number) || 2,
      isActive: formatted.isActive as boolean,
      createdAt: formatted.createdAt as Date,
      updatedAt: formatted.updatedAt as Date,
      tab: formatted.tabName ? { id: formatted.tabId as string, name: formatted.tabName as string } : undefined,
      fieldCount: formatted.fieldCount as number | undefined,
    };
  }

  async findByModule(schemaName: string, module: string): Promise<CustomFieldGroup[]> {
    const result = await this.dataSource.query(
      `SELECT g.*, t.name as tab_name,
        (SELECT COUNT(*) FROM "${schemaName}".custom_field_definitions WHERE group_id = g.id) as field_count
       FROM "${schemaName}".custom_field_groups g
       LEFT JOIN "${schemaName}".custom_tabs t ON g.tab_id = t.id
       WHERE g.module = $1 
       ORDER BY g.display_order ASC, g.name ASC`,
      [module]
    );
    return result.map((row: Record<string, unknown>) => this.formatGroup(row));
  }

  async findBySection(schemaName: string, module: string, section: string): Promise<CustomFieldGroup[]> {
    const result = await this.dataSource.query(
      `SELECT g.*, t.name as tab_name,
        (SELECT COUNT(*) FROM "${schemaName}".custom_field_definitions WHERE group_id = g.id) as field_count
       FROM "${schemaName}".custom_field_groups g
       LEFT JOIN "${schemaName}".custom_tabs t ON g.tab_id = t.id
       WHERE g.module = $1 AND g.section = $2
       ORDER BY g.display_order ASC, g.name ASC`,
      [module, section]
    );
    return result.map((row: Record<string, unknown>) => this.formatGroup(row));
  }

  async findByTab(schemaName: string, tabId: string): Promise<CustomFieldGroup[]> {
    const result = await this.dataSource.query(
      `SELECT g.*, t.name as tab_name,
        (SELECT COUNT(*) FROM "${schemaName}".custom_field_definitions WHERE group_id = g.id) as field_count
       FROM "${schemaName}".custom_field_groups g
       LEFT JOIN "${schemaName}".custom_tabs t ON g.tab_id = t.id
       WHERE g.tab_id = $1
       ORDER BY g.display_order ASC, g.name ASC`,
      [tabId]
    );
    return result.map((row: Record<string, unknown>) => this.formatGroup(row));
  }

  async findAll(schemaName: string): Promise<CustomFieldGroup[]> {
    const result = await this.dataSource.query(
      `SELECT g.*, t.name as tab_name,
        (SELECT COUNT(*) FROM "${schemaName}".custom_field_definitions WHERE group_id = g.id) as field_count
       FROM "${schemaName}".custom_field_groups g
       LEFT JOIN "${schemaName}".custom_tabs t ON g.tab_id = t.id
       ORDER BY g.module ASC, g.display_order ASC, g.name ASC`
    );
    return result.map((row: Record<string, unknown>) => this.formatGroup(row));
  }

  async findOne(schemaName: string, id: string): Promise<CustomFieldGroup> {
    const result = await this.dataSource.query(
      `SELECT g.*, t.name as tab_name,
        (SELECT COUNT(*) FROM "${schemaName}".custom_field_definitions WHERE group_id = g.id) as field_count
       FROM "${schemaName}".custom_field_groups g
       LEFT JOIN "${schemaName}".custom_tabs t ON g.tab_id = t.id
       WHERE g.id = $1`,
      [id]
    );
    if (!result.length) {
      throw new NotFoundException('Custom field group not found');
    }
    return this.formatGroup(result[0]);
  }

  async create(schemaName: string, dto: CreateCustomFieldGroupDto): Promise<CustomFieldGroup> {
    // Get max display order
    const maxOrderResult = await this.dataSource.query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
       FROM "${schemaName}".custom_field_groups WHERE module = $1`,
      [dto.module]
    );
    const displayOrder = dto.displayOrder ?? maxOrderResult[0].next_order;

    const result = await this.dataSource.query(
      `INSERT INTO "${schemaName}".custom_field_groups 
       (name, module, tab_id, section, icon, description, display_order, collapsed_by_default, columns)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dto.name,
        dto.module,
        dto.tabId || null,
        dto.section || null,
        dto.icon || null,
        dto.description || null,
        displayOrder,
        dto.collapsedByDefault || false,
        dto.columns || 2,
      ]
    );
    return this.findOne(schemaName, result[0].id);
  }

  async update(schemaName: string, id: string, dto: UpdateCustomFieldGroupDto): Promise<CustomFieldGroup> {
    const existing = await this.findOne(schemaName, id);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.tabId !== undefined) {
      updates.push(`tab_id = $${paramIndex++}`);
      values.push(dto.tabId);
    }
    if (dto.section !== undefined) {
      updates.push(`section = $${paramIndex++}`);
      values.push(dto.section);
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
    if (dto.collapsedByDefault !== undefined) {
      updates.push(`collapsed_by_default = $${paramIndex++}`);
      values.push(dto.collapsedByDefault);
    }
    if (dto.columns !== undefined) {
      updates.push(`columns = $${paramIndex++}`);
      values.push(dto.columns);
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

    await this.dataSource.query(
      `UPDATE "${schemaName}".custom_field_groups 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );
    return this.findOne(schemaName, id);
  }

  async delete(schemaName: string, id: string): Promise<void> {
    await this.findOne(schemaName, id);
    // Remove group reference from fields
    await this.dataSource.query(
      `UPDATE "${schemaName}".custom_field_definitions SET group_id = NULL WHERE group_id = $1`,
      [id]
    );
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".custom_field_groups WHERE id = $1`,
      [id]
    );
  }

  async reorder(schemaName: string, module: string, groupIds: string[]): Promise<CustomFieldGroup[]> {
    for (let i = 0; i < groupIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".custom_field_groups 
         SET display_order = $1, updated_at = NOW()
         WHERE id = $2 AND module = $3`,
        [i, groupIds[i], module]
      );
    }
    return this.findByModule(schemaName, module);
  }
}