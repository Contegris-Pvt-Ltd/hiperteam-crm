// ============================================================
// FILE: apps/api/src/modules/shared/table-preferences.service.ts
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TablePreferences {
  id?: string;
  module: string;
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  pageSize: number;
  defaultSortColumn: string;
  defaultSortOrder: 'ASC' | 'DESC';
}

@Injectable()
export class TablePreferencesService {
  private readonly logger = new Logger(TablePreferencesService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get user's table preferences for a module.
   * Returns null if no custom preferences saved (frontend uses defaults).
   */
  async get(schemaName: string, userId: string, module: string): Promise<TablePreferences | null> {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".user_table_preferences
       WHERE user_id = $1 AND module = $2`,
      [userId, module],
    );

    if (!row) return null;

    return {
      id: row.id,
      module: row.module,
      visibleColumns: row.visible_columns || [],
      columnWidths: row.column_widths || {},
      pageSize: row.page_size || 25,
      defaultSortColumn: row.default_sort_column || 'created_at',
      defaultSortOrder: row.default_sort_order || 'DESC',
    };
  }

  /**
   * Save (upsert) user's table preferences for a module.
   */
  async save(
    schemaName: string,
    userId: string,
    module: string,
    prefs: Partial<TablePreferences>,
  ): Promise<TablePreferences> {
    const [result] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".user_table_preferences
         (user_id, module, visible_columns, column_widths, page_size, default_sort_column, default_sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, module) DO UPDATE SET
         visible_columns = COALESCE($3, user_table_preferences.visible_columns),
         column_widths = COALESCE($4, user_table_preferences.column_widths),
         page_size = COALESCE($5, user_table_preferences.page_size),
         default_sort_column = COALESCE($6, user_table_preferences.default_sort_column),
         default_sort_order = COALESCE($7, user_table_preferences.default_sort_order),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        module,
        prefs.visibleColumns ? JSON.stringify(prefs.visibleColumns) : null,
        prefs.columnWidths ? JSON.stringify(prefs.columnWidths) : null,
        prefs.pageSize || null,
        prefs.defaultSortColumn || null,
        prefs.defaultSortOrder || null,
      ],
    );

    return {
      id: result.id,
      module: result.module,
      visibleColumns: result.visible_columns || [],
      columnWidths: result.column_widths || {},
      pageSize: result.page_size || 25,
      defaultSortColumn: result.default_sort_column || 'created_at',
      defaultSortOrder: result.default_sort_order || 'DESC',
    };
  }

  /**
   * Reset preferences for a module (delete row, frontend reverts to defaults).
   */
  async reset(schemaName: string, userId: string, module: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".user_table_preferences
       WHERE user_id = $1 AND module = $2`,
      [userId, module],
    );
  }
}