// ============================================================
// FILE: apps/api/src/modules/opportunities/opportunity-settings.service.ts
//
// Admin CRUD for opportunity configuration:
//   - Priorities
//   - Close Reasons (won/lost)
//   - Types (new_business, renewal, etc.)
//   - Forecast Categories (pipeline, best_case, commit, etc.)
//
// Follows lead-settings.service.ts patterns
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class OpportunitySettingsService {
  private readonly logger = new Logger(OpportunitySettingsService.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // PRIORITIES
  // ============================================================
  async getPriorities(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities ORDER BY sort_order ASC, created_at ASC`,
    );
    return rows.map((r: any) => this.formatPriority(r));
  }

  async createPriority(schemaName: string, data: any) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".opportunity_priorities`,
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_priorities (name, color, icon, sort_order, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.color || '#9CA3AF', data.icon || 'minus', data.sortOrder ?? maxOrder.next_order, data.isDefault || false],
    );
    return this.formatPriority(row);
  }

  async updatePriority(schemaName: string, id: string, data: any) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Priority not found');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const fields: Record<string, string> = {
      name: 'name', color: 'color', icon: 'icon',
      sortOrder: 'sort_order', isActive: 'is_active', isDefault: 'is_default',
    };
    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) { updates.push(`${col} = $${idx}`); params.push(data[key]); idx++; }
    }
    if (updates.length === 0) return this.formatPriority(existing);
    updates.push('updated_at = NOW()');
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_priorities SET ${updates.join(', ')} WHERE id = $${idx}`, params,
    );
    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunity_priorities SET is_default = false WHERE id != $1`, [id],
      );
    }
    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    return this.formatPriority(updated);
  }

  async deletePriority(schemaName: string, id: string) {
    const [p] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    if (!p) throw new NotFoundException('Priority not found');
    if (p.is_system) throw new BadRequestException('Cannot delete system priority');
    await this.dataSource.query(`DELETE FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id]);
    return { success: true };
  }

  private formatPriority(r: any) {
    return {
      id: r.id, name: r.name, color: r.color, icon: r.icon,
      sortOrder: r.sort_order, isDefault: r.is_default,
      isSystem: r.is_system, isActive: r.is_active,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // ============================================================
  // CLOSE REASONS (won / lost)
  // ============================================================
  async getCloseReasons(schemaName: string, type?: string) {
    let query = `SELECT * FROM "${schemaName}".opportunity_close_reasons`;
    const params: unknown[] = [];
    if (type) {
      query += ` WHERE type = $1`;
      params.push(type);
    }
    query += ` ORDER BY sort_order ASC, created_at ASC`;
    const rows = await this.dataSource.query(query, params);
    return rows.map((r: any) => this.formatCloseReason(r));
  }

  async createCloseReason(schemaName: string, data: any) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".opportunity_close_reasons WHERE type = $1`,
      [data.type],
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_close_reasons (name, type, description, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.type, data.description || null, data.sortOrder ?? maxOrder.next_order],
    );
    return this.formatCloseReason(row);
  }

  async updateCloseReason(schemaName: string, id: string, data: any) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Close reason not found');
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({ name: 'name', description: 'description', sortOrder: 'sort_order', isActive: 'is_active' } as Record<string, string>)) {
      if (data[key] !== undefined) { updates.push(`${col} = $${idx}`); params.push(data[key]); idx++; }
    }
    if (updates.length === 0) return this.formatCloseReason(existing);
    updates.push('updated_at = NOW()');
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_close_reasons SET ${updates.join(', ')} WHERE id = $${idx}`, params,
    );
    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    return this.formatCloseReason(updated);
  }

  async deleteCloseReason(schemaName: string, id: string) {
    const [r] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    if (!r) throw new NotFoundException('Close reason not found');
    if (r.is_system) throw new BadRequestException('Cannot delete system close reason');
    await this.dataSource.query(`DELETE FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id]);
    return { success: true };
  }

  private formatCloseReason(r: any) {
    return {
      id: r.id, name: r.name, type: r.type, description: r.description,
      sortOrder: r.sort_order, isSystem: r.is_system, isActive: r.is_active,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // ============================================================
  // OPPORTUNITY TYPES
  // ============================================================
  async getTypes(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE is_active = true ORDER BY sort_order ASC, created_at ASC`,
    );
    return rows.map((r: any) => this.formatType(r));
  }

  async getAllTypes(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types ORDER BY sort_order ASC, created_at ASC`,
    );
    return rows.map((r: any) => this.formatType(r));
  }

  async createType(schemaName: string, data: any) {
    const slug = (data.slug || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".opportunity_types`,
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_types (name, slug, description, color, sort_order, is_default)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, slug, data.description || null, data.color || '#6B7280', data.sortOrder ?? maxOrder.next_order, data.isDefault || false],
    );
    return this.formatType(row);
  }

  async updateType(schemaName: string, id: string, data: any) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Opportunity type not found');
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({ name: 'name', description: 'description', color: 'color', sortOrder: 'sort_order', isActive: 'is_active', isDefault: 'is_default' } as Record<string, string>)) {
      if (data[key] !== undefined) { updates.push(`${col} = $${idx}`); params.push(data[key]); idx++; }
    }
    // If name changed, update slug too
    if (data.name) {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      updates.push(`slug = $${idx}`); params.push(slug); idx++;
    }
    if (updates.length === 0) return this.formatType(existing);
    updates.push('updated_at = NOW()');
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_types SET ${updates.join(', ')} WHERE id = $${idx}`, params,
    );
    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunity_types SET is_default = false WHERE id != $1`, [id],
      );
    }
    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    return this.formatType(updated);
  }

  async deleteType(schemaName: string, id: string) {
    const [t] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    if (!t) throw new NotFoundException('Opportunity type not found');
    if (t.is_system) throw new BadRequestException('Cannot delete system type');
    // Check usage
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities WHERE type = $1 AND deleted_at IS NULL`,
      [t.slug],
    );
    if (parseInt(usage.count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${usage.count} opportunity(ies) still use this type`);
    }
    await this.dataSource.query(`DELETE FROM "${schemaName}".opportunity_types WHERE id = $1`, [id]);
    return { success: true };
  }

  private formatType(r: any) {
    return {
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      color: r.color, sortOrder: r.sort_order, isDefault: r.is_default,
      isSystem: r.is_system, isActive: r.is_active,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // ============================================================
  // FORECAST CATEGORIES
  // ============================================================
  async getForecastCategories(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return rows.map((r: any) => this.formatForecastCategory(r));
  }

  async getAllForecastCategories(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories ORDER BY sort_order ASC`,
    );
    return rows.map((r: any) => this.formatForecastCategory(r));
  }

  async createForecastCategory(schemaName: string, data: any) {
    const slug = (data.slug || data.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".opportunity_forecast_categories`,
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_forecast_categories (name, slug, description, color, probability_min, probability_max, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.name, slug, data.description || null, data.color || '#6B7280',
       data.probabilityMin ?? 0, data.probabilityMax ?? 100, data.sortOrder ?? maxOrder.next_order],
    );
    return this.formatForecastCategory(row);
  }

  async updateForecastCategory(schemaName: string, id: string, data: any) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Forecast category not found');
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({
      name: 'name', description: 'description', color: 'color',
      probabilityMin: 'probability_min', probabilityMax: 'probability_max',
      sortOrder: 'sort_order', isActive: 'is_active',
    } as Record<string, string>)) {
      if (data[key] !== undefined) { updates.push(`${col} = $${idx}`); params.push(data[key]); idx++; }
    }
    if (data.name) {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      updates.push(`slug = $${idx}`); params.push(slug); idx++;
    }
    if (updates.length === 0) return this.formatForecastCategory(existing);
    updates.push('updated_at = NOW()');
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_forecast_categories SET ${updates.join(', ')} WHERE id = $${idx}`, params,
    );
    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    return this.formatForecastCategory(updated);
  }

  async deleteForecastCategory(schemaName: string, id: string) {
    const [fc] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    if (!fc) throw new NotFoundException('Forecast category not found');
    if (fc.is_system) throw new BadRequestException('Cannot delete system forecast category');
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities WHERE forecast_category = $1 AND deleted_at IS NULL`,
      [fc.slug],
    );
    if (parseInt(usage.count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${usage.count} opportunity(ies) still use this category`);
    }
    await this.dataSource.query(`DELETE FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id]);
    return { success: true };
  }

  private formatForecastCategory(r: any) {
    return {
      id: r.id, name: r.name, slug: r.slug, description: r.description,
      color: r.color, probabilityMin: r.probability_min, probabilityMax: r.probability_max,
      sortOrder: r.sort_order, isSystem: r.is_system, isActive: r.is_active,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}