/**
 * PAGE LAYOUT SERVICE
 * 
 * Uses raw SQL queries with tenant schema, matching project patterns.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Types
export type WidgetType =
  | 'fields-section'
  | 'custom-tab'
  | 'field-group'
  | 'profile-completion'
  | 'related-records'
  | 'activity-timeline'
  | 'files-attachments'
  | 'notes'
  | 'tasks'
  | 'custom-html'
  | 'spacer'
  | 'divider';

export type LayoutTemplate =
  | 'single-column'
  | 'two-column-equal'
  | 'two-column-wide-left'
  | 'two-column-wide-right'
  | 'three-column'
  | 'sidebar-left'
  | 'sidebar-right';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  collapsed?: boolean;
  section?: string;
  tabId?: string;
  groupId?: string;
  relatedModule?: string;
  maxItems?: number;
  showAddButton?: boolean;
  customContent?: string;
  height?: number;
}

export interface RegionConfig {
  id: string;
  widgets: WidgetConfig[];
}

export interface PageLayoutConfig {
  template: LayoutTemplate;
  regions: Record<string, RegionConfig>;
  settings?: {
    showHeader?: boolean;
    headerStyle?: 'default' | 'compact' | 'hero';
    showBreadcrumb?: boolean;
    stickyHeader?: boolean;
  };
}

export interface PageLayout {
  id: string;
  tenantId: string;
  module: string;
  layoutType: 'detail' | 'edit' | 'create';
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  config: PageLayoutConfig;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePageLayoutDto {
  module: string;
  layoutType: 'detail' | 'edit' | 'create';
  name: string;
  description?: string;
  isDefault?: boolean;
  config: PageLayoutConfig;
}

export interface UpdatePageLayoutDto {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
  config?: PageLayoutConfig;
}

@Injectable()
export class PageLayoutService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get all layouts for a module and type
   */
  async getLayouts(
    schemaName: string,
    module: string,
    layoutType?: string,
  ): Promise<PageLayout[]> {
    let query = `
      SELECT * FROM "${schemaName}".page_layouts
      WHERE module = $1
    `;
    const params: any[] = [module];

    if (layoutType) {
      query += ` AND layout_type = $2`;
      params.push(layoutType);
    }

    query += ` ORDER BY is_default DESC, name ASC`;

    const result = await this.dataSource.query(query, params);
    return result.map((row: Record<string, unknown>) => this.formatLayout(row));
  }

  /**
   * Get a single layout by ID
   */
  async getLayout(schemaName: string, id: string): Promise<PageLayout> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".page_layouts WHERE id = $1`,
      [id],
    );

    if (!result.length) {
      throw new NotFoundException('Layout not found');
    }

    return this.formatLayout(result[0]);
  }

  /**
   * Get the active/default layout for a module and type
   */
  async getActiveLayout(
    schemaName: string,
    module: string,
    layoutType: string,
  ): Promise<PageLayout | null> {
    // First try to get the default layout
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".page_layouts
       WHERE module = $1 AND layout_type = $2 AND is_default = true AND is_active = true
       LIMIT 1`,
      [module, layoutType],
    );

    if (result.length) {
      return this.formatLayout(result[0]);
    }

    // If no default, get any active layout
    const fallback = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".page_layouts
       WHERE module = $1 AND layout_type = $2 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [module, layoutType],
    );

    return fallback.length ? this.formatLayout(fallback[0]) : null;
  }

  /**
   * Create a new layout
   */
  async createLayout(
    schemaName: string,
    dto: CreatePageLayoutDto,
    userId?: string,
  ): Promise<PageLayout> {
    // If this is set as default, unset other defaults
    if (dto.isDefault) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".page_layouts
         SET is_default = false, updated_at = NOW()
         WHERE module = $1 AND layout_type = $2`,
        [dto.module, dto.layoutType],
      );
    }

    const result = await this.dataSource.query(
      `INSERT INTO "${schemaName}".page_layouts
       (module, layout_type, name, description, is_default, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dto.module,
        dto.layoutType,
        dto.name,
        dto.description || null,
        dto.isDefault || false,
        JSON.stringify(dto.config),
        userId || null,
      ],
    );

    return this.formatLayout(result[0]);
  }

  /**
   * Update a layout
   */
  async updateLayout(
    schemaName: string,
    id: string,
    dto: UpdatePageLayoutDto,
    userId?: string,
  ): Promise<PageLayout> {
    // Get existing layout first
    const existing = await this.getLayout(schemaName, id);

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".page_layouts
         SET is_default = false, updated_at = NOW()
         WHERE module = $1 AND layout_type = $2 AND id != $3`,
        [existing.module, existing.layoutType, id],
      );
    }

    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".page_layouts SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_default = COALESCE($4, is_default),
        is_active = COALESCE($5, is_active),
        config = COALESCE($6, config),
        updated_by = $7,
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        dto.name,
        dto.description,
        dto.isDefault,
        dto.isActive,
        dto.config ? JSON.stringify(dto.config) : null,
        userId || null,
      ],
    );

    if (!result.length) {
      throw new NotFoundException('Layout not found');
    }

    return this.formatLayout(result[0]);
  }

  /**
   * Delete a layout
   */
  async deleteLayout(schemaName: string, id: string): Promise<void> {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".page_layouts WHERE id = $1 RETURNING id`,
      [id],
    );

    if (!result.length) {
      throw new NotFoundException('Layout not found');
    }
  }

  /**
   * Set a layout as the default
   */
  async setAsDefault(schemaName: string, id: string): Promise<PageLayout> {
    const layout = await this.getLayout(schemaName, id);

    // Unset other defaults
    await this.dataSource.query(
      `UPDATE "${schemaName}".page_layouts
       SET is_default = false, updated_at = NOW()
       WHERE module = $1 AND layout_type = $2`,
      [layout.module, layout.layoutType],
    );

    // Set this one as default
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".page_layouts
       SET is_default = true, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    return this.formatLayout(result[0]);
  }

  /**
   * Duplicate a layout
   */
  async duplicateLayout(
    schemaName: string,
    id: string,
    newName: string,
    userId?: string,
  ): Promise<PageLayout> {
    const source = await this.getLayout(schemaName, id);

    const result = await this.dataSource.query(
      `INSERT INTO "${schemaName}".page_layouts
       (module, layout_type, name, description, is_default, config, created_by)
       VALUES ($1, $2, $3, $4, false, $5, $6)
       RETURNING *`,
      [
        source.module,
        source.layoutType,
        newName,
        source.description,
        JSON.stringify(source.config),
        userId || null,
      ],
    );

    return this.formatLayout(result[0]);
  }

  /**
   * Format database row to PageLayout object
   */
  private formatLayout(row: Record<string, unknown>): PageLayout {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      module: row.module as string,
      layoutType: row.layout_type as 'detail' | 'edit' | 'create',
      name: row.name as string,
      description: row.description as string | null,
      isDefault: row.is_default as boolean,
      isActive: row.is_active as boolean,
      config: row.config as PageLayoutConfig,
      createdBy: row.created_by as string | null,
      updatedBy: row.updated_by as string | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}