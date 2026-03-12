import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class GeneralSettingsService {
  constructor(private readonly dataSource: DataSource) {}

  // ── Company Settings ─────────────────────────────────────────────

  async getCompanySettings(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".company_settings LIMIT 1`,
    );
    if (!rows.length) {
      const [row] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".company_settings (company_name) VALUES (NULL) RETURNING *`,
      );
      return this.formatCompanySettings(row);
    }
    return this.formatCompanySettings(rows[0]);
  }

  async updateCompanySettings(schemaName: string, body: Record<string, any>) {
    const fields = [
      'company_name', 'tagline', 'email', 'phone', 'website', 'logo_url',
      'address_line1', 'address_line2', 'city', 'state', 'country',
      'postal_code', 'tax_id', 'registration_no', 'currency',
      'base_country', 'base_city', 'default_currency', 'timezone',
    ];
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of fields) {
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (body[camel] !== undefined || body[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        values.push(body[camel] ?? body[field]);
      }
    }
    if (!setClauses.length) return this.getCompanySettings(schemaName);

    setClauses.push(`updated_at = NOW()`);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".company_settings
       SET ${setClauses.join(', ')}
       WHERE id = (SELECT id FROM "${schemaName}".company_settings LIMIT 1)
       RETURNING *`,
      values,
    );
    return this.formatCompanySettings(row);
  }

  private formatCompanySettings(r: any) {
    if (!r) return null;
    return {
      companyName:    r.company_name,
      tagline:        r.tagline,
      email:          r.email,
      phone:          r.phone,
      website:        r.website,
      logoUrl:        r.logo_url,
      addressLine1:   r.address_line1,
      addressLine2:   r.address_line2,
      city:           r.city,
      state:          r.state,
      country:        r.country,
      postalCode:     r.postal_code,
      taxId:          r.tax_id,
      registrationNo: r.registration_no,
      currency:       r.currency,
      baseCountry:    r.base_country     ?? null,
      baseCity:       r.base_city        ?? null,
      defaultCurrency: r.default_currency ?? 'USD',
      timezone:       r.timezone         ?? 'UTC',
      updatedAt:      r.updated_at,
    };
  }

  // ── CURRENCIES ────────────────────────────────────────────────

  async getCurrencies(schema: string) {
    return this.dataSource.query(
      `SELECT id, code, name, symbol, decimal_places, is_active, is_default, sort_order
       FROM "${schema}".currencies ORDER BY sort_order ASC, code ASC`,
    );
  }

  async getActiveCurrencies(schema: string) {
    return this.dataSource.query(
      `SELECT id, code, name, symbol, decimal_places, is_default
       FROM "${schema}".currencies WHERE is_active = true ORDER BY sort_order ASC, code ASC`,
    );
  }

  async createCurrency(schema: string, data: any) {
    const code = String(data.code).toUpperCase().trim();
    const [exists] = await this.dataSource.query(
      `SELECT id FROM "${schema}".currencies WHERE code = $1`, [code],
    );
    if (exists) throw new ConflictException(`Currency ${code} already exists`);

    const [{ next }] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM "${schema}".currencies`,
    );
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schema}".currencies (code, name, symbol, decimal_places, is_active, is_default, sort_order)
       VALUES ($1,$2,$3,$4,$5,false,$6) RETURNING *`,
      [code, data.name, data.symbol, data.decimalPlaces ?? 2, data.isActive ?? true, next],
    );
    return row;
  }

  async updateCurrency(schema: string, id: string, data: any) {
    const map: Record<string, string> = {
      name: 'name', symbol: 'symbol',
      decimalPlaces: 'decimal_places',
      isActive: 'is_active', sortOrder: 'sort_order',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${i++}`); params.push(data[k]); }
    }
    if (!sets.length) return;
    sets.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schema}".currencies SET ${sets.join(', ')} WHERE id = $${i}`, params,
    );
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schema}".currencies WHERE id = $1`, [id],
    );
    return row;
  }

  async setDefaultCurrency(schema: string, id: string) {
    await this.dataSource.query(
      `UPDATE "${schema}".currencies SET is_default = false`,
    );
    await this.dataSource.query(
      `UPDATE "${schema}".currencies SET is_default = true WHERE id = $1`, [id],
    );
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schema}".currencies WHERE id = $1`, [id],
    );
    await this.dataSource.query(
      `UPDATE "${schema}".company_settings SET default_currency = $1`, [row.code],
    );
    return row;
  }

  async deleteCurrency(schema: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT is_default FROM "${schema}".currencies WHERE id = $1`, [id],
    );
    if (!row) throw new NotFoundException('Currency not found');
    if (row.is_default) throw new BadRequestException('Cannot delete the default currency');
    await this.dataSource.query(`DELETE FROM "${schema}".currencies WHERE id = $1`, [id]);
    return { success: true };
  }
}
