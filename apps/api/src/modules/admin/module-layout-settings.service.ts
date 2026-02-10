/**
 * MODULE LAYOUT SETTINGS SERVICE
 * 
 * Uses raw SQL queries with tenant schema, matching project patterns.
 */

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PageLayout, PageLayoutConfig } from './page-layout.service';

export interface ModuleLayoutSetting {
  id: string;
  tenantId: string;
  module: string;
  layoutType: string;
  useCustomLayout: boolean;
  layoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ModuleLayoutSettingsService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get setting for a specific module/view
   */
  async getSetting(
    schemaName: string,
    module: string,
    layoutType: string,
  ): Promise<ModuleLayoutSetting | null> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".module_layout_settings
       WHERE module = $1 AND layout_type = $2
       LIMIT 1`,
      [module, layoutType],
    );

    return result.length ? this.formatSetting(result[0]) : null;
  }

  /**
   * Get all settings for a tenant
   */
  async getAllSettings(schemaName: string): Promise<ModuleLayoutSetting[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".module_layout_settings
       ORDER BY module ASC, layout_type ASC`,
    );

    return result.map((row: Record<string, unknown>) => this.formatSetting(row));
  }

  /**
   * Update or create setting
   */
  async updateSetting(
    schemaName: string,
    module: string,
    layoutType: string,
    useCustomLayout: boolean,
    layoutId: string | null,
  ): Promise<ModuleLayoutSetting> {
    // Check if setting exists
    const existing = await this.getSetting(schemaName, module, layoutType);

    if (existing) {
      // Update
      const result = await this.dataSource.query(
        `UPDATE "${schemaName}".module_layout_settings SET
          use_custom_layout = $3,
          layout_id = $4,
          updated_at = NOW()
         WHERE module = $1 AND layout_type = $2
         RETURNING *`,
        [module, layoutType, useCustomLayout, useCustomLayout ? layoutId : null],
      );
      return this.formatSetting(result[0]);
    } else {
      // Insert
      const result = await this.dataSource.query(
        `INSERT INTO "${schemaName}".module_layout_settings
         (module, layout_type, use_custom_layout, layout_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [module, layoutType, useCustomLayout, useCustomLayout ? layoutId : null],
      );
      return this.formatSetting(result[0]);
    }
  }

  /**
   * Get the active layout config for a module/view
   * Returns null if using default view
   */
  async getActiveLayoutConfig(
    schemaName: string,
    module: string,
    layoutType: string,
  ): Promise<{ useCustomLayout: boolean; config: PageLayoutConfig | null }> {
    const setting = await this.getSetting(schemaName, module, layoutType);

    // If no setting or useCustomLayout is false, use default
    if (!setting || !setting.useCustomLayout) {
      return { useCustomLayout: false, config: null };
    }

    // If useCustomLayout but no layoutId, use default
    if (!setting.layoutId) {
      return { useCustomLayout: false, config: null };
    }

    // Get the layout config
    const result = await this.dataSource.query(
      `SELECT config FROM "${schemaName}".page_layouts WHERE id = $1`,
      [setting.layoutId],
    );

    if (!result.length) {
      return { useCustomLayout: false, config: null };
    }

    return { useCustomLayout: true, config: result[0].config as PageLayoutConfig };
  }

  /**
   * Get available layouts for a module/view (for dropdown selection)
   */
  async getAvailableLayouts(
    schemaName: string,
    module: string,
    layoutType: string,
  ): Promise<PageLayout[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".page_layouts
       WHERE module = $1 AND layout_type = $2 AND is_active = true
       ORDER BY name ASC`,
      [module, layoutType],
    );

    return result.map((row: Record<string, unknown>) => this.formatLayout(row));
  }

  /**
   * Format database row to ModuleLayoutSetting object
   */
  private formatSetting(row: Record<string, unknown>): ModuleLayoutSetting {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      module: row.module as string,
      layoutType: row.layout_type as string,
      useCustomLayout: row.use_custom_layout as boolean,
      layoutId: row.layout_id as string | null,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
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