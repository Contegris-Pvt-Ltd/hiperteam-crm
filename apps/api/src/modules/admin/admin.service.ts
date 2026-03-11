import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
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
      updatedAt:      r.updated_at,
    };
  }

  // ── Industries ───────────────────────────────────────────────────

  async getIndustries(schemaName: string) {
    return this.dataSource.query(
      `SELECT id, name, is_active AS "isActive", is_system AS "isSystem", sort_order AS "sortOrder"
       FROM "${schemaName}".industries
       ORDER BY sort_order ASC, name ASC`,
    );
  }

  async createIndustry(schemaName: string, name: string) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".industries (name)
       VALUES ($1)
       RETURNING id, name, is_active AS "isActive", is_system AS "isSystem", sort_order AS "sortOrder"`,
      [name.trim()],
    );
    return row;
  }

  async updateIndustry(
    schemaName: string,
    id: string,
    body: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (body.name      !== undefined) { setClauses.push(`name = $${idx++}`);       values.push(body.name.trim()); }
    if (body.isActive  !== undefined) { setClauses.push(`is_active = $${idx++}`);  values.push(body.isActive); }
    if (body.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(body.sortOrder); }
    if (!setClauses.length) throw new Error('Nothing to update');
    values.push(id);
    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".industries
       SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, is_active AS "isActive", is_system AS "isSystem", sort_order AS "sortOrder"`,
      values,
    );
    return row;
  }

  async deleteIndustry(schemaName: string, id: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".industries WHERE id = $1 AND is_system = false`,
      [id],
    );
    return { success: true };
  }
}
