import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';

@Injectable()
export class GeneralSettingsService {
  private readonly logger = new Logger(GeneralSettingsService.name);
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

  // ── Account Status Settings ──────────────────────────────────

  async getAccountStatuses(schemaName: string) {
    const defaults = [
      { value: 'active', label: 'Active', color: '#22c55e', isDefault: true },
      { value: 'prospect', label: 'Prospect', color: '#8b5cf6', isDefault: false },
      { value: 'customer', label: 'Customer', color: '#3b82f6', isDefault: false },
      { value: 'partner', label: 'Partner', color: '#06b6d4', isDefault: false },
      { value: 'on_hold', label: 'On Hold', color: '#f59e0b', isDefault: false },
      { value: 'churned', label: 'Churned', color: '#ef4444', isDefault: false },
      { value: 'inactive', label: 'Inactive', color: '#6b7280', isDefault: false },
    ];
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".module_settings
       WHERE module = 'accounts' AND setting_key = 'account_statuses'`,
    );
    return row?.setting_value || defaults;
  }

  async updateAccountStatuses(schemaName: string, statuses: any[]) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".module_settings (module, setting_key, setting_value, updated_at)
       VALUES ('accounts', 'account_statuses', $1::jsonb, NOW())
       ON CONFLICT (module, setting_key)
       DO UPDATE SET setting_value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(statuses)],
    );
    return statuses;
  }

  // ── Contact Type Settings (phone, email, address types) ──────

  async getContactTypeSettings(schemaName: string) {
    const defaults = {
      phoneTypes: [
        { value: 'work', label: 'Work' },
        { value: 'mobile', label: 'Mobile' },
        { value: 'home', label: 'Home' },
        { value: 'sales', label: 'Sales' },
        { value: 'support', label: 'Support' },
        { value: 'billing', label: 'Billing' },
        { value: 'other', label: 'Other' },
      ],
      emailTypes: [
        { value: 'work', label: 'Work' },
        { value: 'personal', label: 'Personal' },
        { value: 'sales', label: 'Sales' },
        { value: 'support', label: 'Support' },
        { value: 'billing', label: 'Billing' },
        { value: 'other', label: 'Other' },
      ],
      addressTypes: [
        { value: 'headquarters', label: 'Headquarters' },
        { value: 'billing', label: 'Billing' },
        { value: 'shipping', label: 'Shipping' },
        { value: 'office', label: 'Office' },
        { value: 'branch', label: 'Branch' },
        { value: 'warehouse', label: 'Warehouse' },
        { value: 'other', label: 'Other' },
      ],
    };
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".module_settings
       WHERE module = 'contacts' AND setting_key = 'contact_type_settings'`,
    );
    return row?.setting_value || defaults;
  }

  async updateContactTypeSettings(schemaName: string, settings: any) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".module_settings (module, setting_key, setting_value, updated_at)
       VALUES ('contacts', 'contact_type_settings', $1::jsonb, NOW())
       ON CONFLICT (module, setting_key)
       DO UPDATE SET setting_value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(settings)],
    );
    return settings;
  }

  // ── Embedded Apps Settings ──────────────────────────────────

  async getEmbeddedApps(schemaName: string) {
    const [row] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".module_settings
       WHERE module = 'integrations' AND setting_key = 'embedded_apps'`,
    );
    return row?.setting_value || [];
  }

  async saveEmbeddedApps(schemaName: string, apps: any[]) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".module_settings (module, setting_key, setting_value, updated_at)
       VALUES ('integrations', 'embedded_apps', $1::jsonb, NOW())
       ON CONFLICT (module, setting_key)
       DO UPDATE SET setting_value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(apps)],
    );
    return apps;
  }

  // Get embedded apps for a specific module (used by detail pages)
  async getEmbeddedAppsForModule(schemaName: string, moduleName: string) {
    const apps = await this.getEmbeddedApps(schemaName);
    return apps.filter((app: any) => app.isActive && app.modules?.includes(moduleName));
  }

  // Get available variables for a module (field names from table columns + custom fields)
  async getModuleVariables(schemaName: string, moduleName: string) {
    // System fields per module
    const systemFields: Record<string, Array<{ key: string; label: string }>> = {
      accounts: [
        { key: 'id', label: 'Account ID' },
        { key: 'name', label: 'Account Name' },
        { key: 'account_type', label: 'Account Type' },
        { key: 'industry', label: 'Industry' },
        { key: 'website', label: 'Website' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'country', label: 'Country' },
        { key: 'postal_code', label: 'Postal Code' },
        { key: 'status', label: 'Status' },
        { key: 'annual_revenue', label: 'Annual Revenue' },
        { key: 'employee_count', label: 'Employee Count' },
        { key: 'owner_id', label: 'Owner ID' },
      ],
      contacts: [
        { key: 'id', label: 'Contact ID' },
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'company', label: 'Company' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'country', label: 'Country' },
        { key: 'account_id', label: 'Account ID' },
        { key: 'status', label: 'Status' },
        { key: 'owner_id', label: 'Owner ID' },
      ],
      leads: [
        { key: 'id', label: 'Lead ID' },
        { key: 'first_name', label: 'First Name' },
        { key: 'last_name', label: 'Last Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'company', label: 'Company' },
        { key: 'source', label: 'Source' },
        { key: 'stage_id', label: 'Stage ID' },
        { key: 'pipeline_id', label: 'Pipeline ID' },
        { key: 'owner_id', label: 'Owner ID' },
        { key: 'account_id', label: 'Account ID' },
      ],
      opportunities: [
        { key: 'id', label: 'Opportunity ID' },
        { key: 'name', label: 'Name' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'probability', label: 'Probability' },
        { key: 'stage_id', label: 'Stage ID' },
        { key: 'pipeline_id', label: 'Pipeline ID' },
        { key: 'account_id', label: 'Account ID' },
        { key: 'owner_id', label: 'Owner ID' },
      ],
    };

    const fields = systemFields[moduleName] || [];

    // Also load custom fields for this module
    try {
      const customFields = await this.dataSource.query(
        `SELECT field_key, field_label FROM "${schemaName}".custom_field_definitions
         WHERE module = $1 AND is_active = true ORDER BY display_order`,
        [moduleName],
      );
      for (const cf of customFields) {
        fields.push({ key: `custom_fields.${cf.field_key}`, label: `${cf.field_label} (Custom)` });
      }
    } catch {
      /* table may not exist */
    }

    // Add auth token as a special variable
    fields.push({ key: 'auth_token', label: 'Auth Token (from app config)' });

    return fields;
  }

  // ══════════════════════════════════════════════════════════════
  // DATA EXPORT — Download all system data as XLSX
  // ══════════════════════════════════════════════════════════════

  async exportAllData(schemaName: string): Promise<{ buffer: Buffer; fileName: string }> {
    const wb = XLSX.utils.book_new();

    const sheets: { name: string; table: string; headers: Record<string, string> }[] = [
      {
        name: 'Accounts',
        table: 'accounts',
        headers: {
          id: 'ID', name: 'Name', type: 'Type', industry: 'Industry',
          email: 'Email', phone: 'Phone', website: 'Website',
          city: 'City', state: 'State', country: 'Country',
          annual_revenue: 'Annual Revenue', employee_count: 'Employee Count',
          status: 'Status', created_at: 'Created At',
        },
      },
      {
        name: 'Contacts',
        table: 'contacts',
        headers: {
          id: 'ID', first_name: 'First Name', last_name: 'Last Name',
          email: 'Email', phone: 'Phone', mobile: 'Mobile',
          job_title: 'Job Title', department: 'Department',
          city: 'City', state: 'State', country: 'Country',
          account_id: 'Account ID', status: 'Status', created_at: 'Created At',
        },
      },
      {
        name: 'Leads',
        table: 'leads',
        headers: {
          id: 'ID', first_name: 'First Name', last_name: 'Last Name',
          email: 'Email', phone: 'Phone', company: 'Company',
          source: 'Source', stage_id: 'Stage ID', pipeline_id: 'Pipeline ID',
          score: 'Score', expected_revenue: 'Expected Revenue',
          status: 'Status', created_at: 'Created At',
        },
      },
      {
        name: 'Opportunities',
        table: 'opportunities',
        headers: {
          id: 'ID', name: 'Name', account_id: 'Account ID',
          stage_id: 'Stage ID', pipeline_id: 'Pipeline ID',
          amount: 'Amount', currency: 'Currency',
          probability: 'Probability', expected_close_date: 'Expected Close Date',
          status: 'Status', created_at: 'Created At',
        },
      },
      {
        name: 'Products',
        table: 'products',
        headers: {
          id: 'ID', name: 'Name', code: 'Code', category: 'Category',
          unit_price: 'Unit Price', currency: 'Currency',
          is_active: 'Active', created_at: 'Created At',
        },
      },
      {
        name: 'Tasks',
        table: 'tasks',
        headers: {
          id: 'ID', title: 'Title', description: 'Description',
          status: 'Status', priority: 'Priority', task_type: 'Task Type',
          due_date: 'Due Date', assigned_to: 'Assigned To',
          entity_type: 'Entity Type', entity_id: 'Entity ID',
          created_at: 'Created At',
        },
      },
      {
        name: 'Invoices',
        table: 'invoices',
        headers: {
          id: 'ID', invoice_number: 'Invoice Number', status: 'Status',
          subtotal: 'Subtotal', tax_amount: 'Tax Amount', total: 'Total',
          currency: 'Currency', issue_date: 'Issue Date', due_date: 'Due Date',
          opportunity_id: 'Opportunity ID', account_id: 'Account ID',
          created_at: 'Created At',
        },
      },
      {
        name: 'Projects',
        table: 'projects',
        headers: {
          id: 'ID', name: 'Name', status: 'Status',
          start_date: 'Start Date', end_date: 'End Date',
          budget: 'Budget', account_id: 'Account ID',
          created_at: 'Created At',
        },
      },
      {
        name: 'Account Subscriptions',
        table: 'account_subscriptions',
        headers: {
          id: 'ID', account_id: 'Account ID', product_id: 'Product ID',
          plan_name: 'Plan Name', status: 'Status',
          mrr: 'MRR', arr: 'ARR', currency: 'Currency',
          start_date: 'Start Date', end_date: 'End Date',
          created_at: 'Created At',
        },
      },
    ];

    for (const sheet of sheets) {
      try {
        const rows = await this.dataSource.query(
          `SELECT * FROM "${schemaName}"."${sheet.table}" WHERE deleted_at IS NULL ORDER BY created_at DESC`,
        );
        if (rows.length > 0) {
          // Map columns that actually exist in the data to friendly headers
          const availableCols = Object.keys(rows[0]);
          const cols = Object.keys(sheet.headers).filter(c => availableCols.includes(c));
          const data = rows.map((r: any) => {
            const row: Record<string, any> = {};
            for (const col of cols) {
              const val = r[col];
              row[sheet.headers[col] || col] = val == null ? '' : typeof val === 'object' ? JSON.stringify(val) : val;
            }
            return row;
          });
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        } else {
          const headerNames = Object.values(sheet.headers);
          const ws = XLSX.utils.json_to_sheet([
            headerNames.reduce((acc: Record<string, string>, h) => { acc[h] = ''; return acc; }, {}),
          ]);
          XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        }
      } catch (err: any) {
        // Table may not exist — create empty sheet with note
        this.logger.warn(`Export: table "${sheet.table}" error: ${err.message}`);
        const ws = XLSX.utils.json_to_sheet([{ Note: `Table "${sheet.table}" not found or error` }]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      }
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().slice(0, 10);
    return { buffer: Buffer.from(buf), fileName: `crm-data-export-${dateStr}.xlsx` };
  }

  // ══════════════════════════════════════════════════════════════
  // DATA PURGE — Delete all data except users and roles
  // ══════════════════════════════════════════════════════════════

  async purgeAllData(
    schemaName: string,
    userId: string,
    confirmationPhrase: string,
  ): Promise<{ success: boolean; deleted: Record<string, number> }> {
    if (confirmationPhrase !== 'DELETE ALL DATA') {
      throw new BadRequestException('Invalid confirmation phrase');
    }

    const tablesToPurge = [
      // Activities, notes, documents, audit logs first
      'activities',
      'notes',
      'documents',
      'audit_logs',
      'notifications',

      // Import jobs
      'import_jobs',
      'import_mapping_templates',

      // Customer 360
      'product_usage_logs',
      'account_usage_sources',
      'product_usage_metrics',
      'account_subscriptions',
      'customer_scores',
      'product_recommendations',

      // Email marketing
      'contact_email_marketing',

      // Record teams
      'record_team_members',
      'record_stage_assignments',

      // Tasks
      'task_comments',
      'task_checklist_items',
      'tasks',

      // Opportunities children
      'proposal_line_items',
      'proposals',
      'invoice_items',
      'invoice_payments',
      'invoices',
      'contracts',
      'opportunity_products',
      'opportunities',

      // Leads children
      'lead_products',
      'lead_qualification_answers',
      'leads',

      // Projects children
      'project_time_entries',
      'project_tasks',
      'project_phases',
      'project_milestones',
      'project_members',
      'projects',

      // Contacts & Accounts
      'contacts',
      'accounts',
    ];

    const deleted: Record<string, number> = {};

    for (const table of tablesToPurge) {
      try {
        const result = await this.dataSource.query(
          `DELETE FROM "${schemaName}"."${table}" RETURNING id`,
        );
        deleted[table] = result.length;
      } catch {
        // Table might not exist — skip
        deleted[table] = -1;
      }
    }

    // Log the purge action
    try {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".audit_logs (entity_type, entity_id, action, new_values, performed_by, created_at)
         VALUES ('system', gen_random_uuid(), 'data_purge', $1::jsonb, $2, NOW())`,
        [JSON.stringify({ deleted, timestamp: new Date().toISOString() }), userId],
      );
    } catch {
      // audit_logs might have been purged — ignore
    }

    return { success: true, deleted };
  }
}
