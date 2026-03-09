import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { randomBytes } from 'crypto';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  // ── List all forms ──────────────────────────────────────────
  async findAll(
    schemaName: string,
    query: { status?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;
    const params: any[] = [];
    const conditions = ['f.deleted_at IS NULL'];

    if (query.status) {
      params.push(query.status);
      conditions.push(`f.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(f.name ILIKE $${params.length} OR f.description ILIKE $${params.length})`,
      );
    }

    const where = conditions.join(' AND ');

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".forms f WHERE ${where}`,
      params,
    );
    const total = parseInt(countResult.count, 10);

    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `SELECT f.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM "${schemaName}".forms f
       LEFT JOIN "${schemaName}".users u ON u.id = f.created_by
       WHERE ${where}
       ORDER BY f.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: rows.map((r: any) => this.formatRow(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Get single form ─────────────────────────────────────────
  async findById(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT f.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM "${schemaName}".forms f
       LEFT JOIN "${schemaName}".users u ON u.id = f.created_by
       WHERE f.id = $1 AND f.deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('Form not found');
    return this.formatRow(row);
  }

  // ── Create form ─────────────────────────────────────────────
  async create(schemaName: string, userId: string, data: any) {
    const token = randomBytes(24).toString('hex');

    // Get tenant slug
    const [tenant] = await this.dataSource.query(
      `SELECT slug FROM master.tenants WHERE schema_name = $1 LIMIT 1`,
      [schemaName],
    );
    const tenantSlug = tenant?.slug || '';

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".forms
        (name, description, slug, status, fields, settings, submit_actions, branding, token, tenant_slug, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.slug || null,
        data.status || 'draft',
        JSON.stringify(data.fields || []),
        JSON.stringify(data.settings || {}),
        JSON.stringify(data.submitActions || []),
        JSON.stringify(data.branding || {}),
        token,
        tenantSlug,
        userId,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'forms',
      entityId: row.id,
      action: 'create',
      changes: {},
      newValues: { id: row.id, name: row.name, status: row.status },
      performedBy: userId,
    });

    return this.formatRow(row);
  }

  // ── Update form ─────────────────────────────────────────────
  async update(schemaName: string, userId: string, id: string, data: any) {
    await this.findById(schemaName, id);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".forms SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        slug = COALESCE($4, slug),
        status = COALESCE($5, status),
        fields = COALESCE($6, fields),
        settings = COALESCE($7, settings),
        submit_actions = COALESCE($8, submit_actions),
        branding = COALESCE($9, branding),
        updated_by = $10,
        updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        data.name ?? null,
        data.description ?? null,
        data.slug ?? null,
        data.status ?? null,
        data.fields ? JSON.stringify(data.fields) : null,
        data.settings ? JSON.stringify(data.settings) : null,
        data.submitActions ? JSON.stringify(data.submitActions) : null,
        data.branding ? JSON.stringify(data.branding) : null,
        userId,
      ],
    );

    if (!row) throw new NotFoundException('Form not found');

    await this.auditService.log(schemaName, {
      entityType: 'forms',
      entityId: id,
      action: 'update',
      changes: {},
      newValues: { id: row.id, name: row.name, status: row.status },
      performedBy: userId,
    });

    return this.formatRow(row);
  }

  // ── Delete form (soft) ──────────────────────────────────────
  async delete(schemaName: string, userId: string, id: string) {
    const existing = await this.findById(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".forms SET deleted_at = NOW(), updated_by = $2 WHERE id = $1`,
      [id, userId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'forms',
      entityId: id,
      action: 'delete',
      changes: {},
      newValues: { id: existing.id, name: existing.name },
      performedBy: userId,
    });
  }

  // ── Duplicate form ──────────────────────────────────────────
  async duplicate(schemaName: string, userId: string, id: string) {
    const original = await this.findById(schemaName, id);
    return this.create(schemaName, userId, {
      name: `${original.name} (Copy)`,
      description: original.description,
      fields: original.fields,
      settings: original.settings,
      submitActions: original.submitActions,
      branding: original.branding,
      status: 'draft',
    });
  }

  // ── Get submissions ─────────────────────────────────────────
  async getSubmissions(
    schemaName: string,
    formId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;

    // Verify form exists
    await this.findById(schemaName, formId);

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".form_submissions WHERE form_id = $1`,
      [formId],
    );
    const total = parseInt(countResult.count, 10);

    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".form_submissions
       WHERE form_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [formId, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatSubmission(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Resolve public form by tenantSlug + token ───────────────
  async resolvePublicForm(tenantSlug: string, token: string) {
    // Find tenant schema from slug
    const [tenant] = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE slug = $1 LIMIT 1`,
      [tenantSlug],
    );
    if (!tenant) throw new NotFoundException('Form not found');

    const schemaName = tenant.schema_name;

    const [form] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".forms
       WHERE token = $1 AND status = 'active' AND deleted_at IS NULL`,
      [token],
    );
    if (!form) throw new NotFoundException('Form not found or inactive');

    return { schemaName, form: this.formatRow(form) };
  }

  // ── Process submission (public) ─────────────────────────────
  async processSubmission(
    tenantSlug: string,
    token: string,
    submissionData: any,
    metadata: any,
  ) {
    const { schemaName, form } = await this.resolvePublicForm(
      tenantSlug,
      token,
    );

    const actionResults: any[] = [];
    // Context accumulates entity IDs from earlier actions so later actions can reference them
    // e.g. create_contact → contactId, then create_lead uses contactId
    const context: Record<string, string> = {};

    // Execute submit_actions in order (chained)
    for (const action of form.submitActions || []) {
      if (action.enabled === false) continue;
      try {
        const result = await this.executeAction(
          schemaName,
          action,
          submissionData,
          form,
          context,
        );
        actionResults.push({ type: action.type, status: 'success', result });
        // Store created entity ID in context for downstream actions
        if (result?.entityId) {
          context[`${result.entityType}Id`] = result.entityId; // e.g. contactId, accountId, leadId
        }
      } catch (err: any) {
        this.logger.warn(`Form action ${action.type} failed: ${err.message}`);
        actionResults.push({
          type: action.type,
          status: 'error',
          error: err.message,
        });
      }
    }

    // Save submission
    const [submission] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".form_submissions
        (form_id, data, metadata, action_results, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        form.id,
        JSON.stringify(submissionData),
        JSON.stringify(metadata || {}),
        JSON.stringify(actionResults),
        metadata?.ipAddress || null,
        metadata?.userAgent || null,
      ],
    );

    // Increment submission count
    await this.dataSource.query(
      `UPDATE "${schemaName}".forms SET submission_count = submission_count + 1 WHERE id = $1`,
      [form.id],
    );

    return this.formatSubmission(submission);
  }

  // ── Execute a single submit action ──────────────────────────
  private async executeAction(
    schemaName: string,
    action: any,
    data: any,
    form: any,
    context: Record<string, string>,
  ): Promise<any> {
    const mappedData = this.applyFieldMapping(action.fieldMapping || {}, data);

    switch (action.type) {
      case 'create_lead':
        return this.createLeadFromSubmission(schemaName, mappedData, context);
      case 'create_contact':
        return this.createContactFromSubmission(
          schemaName,
          mappedData,
          context,
        );
      case 'create_account':
        return this.createAccountFromSubmission(schemaName, mappedData);
      case 'webhook':
        return this.sendWebhook(action.webhookUrl, data, form);
      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
        return null;
    }
  }

  private applyFieldMapping(
    mapping: Record<string, string>,
    data: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [crmField, formField] of Object.entries(mapping)) {
      if (data[formField] !== undefined) {
        result[crmField] = data[formField];
      }
    }
    return result;
  }

  private async createLeadFromSubmission(
    schemaName: string,
    data: Record<string, any>,
    context: Record<string, string>,
  ) {
    // Build custom_fields with linked entity references from earlier actions
    const customFields: Record<string, string> = {};
    if (context.contactId) customFields.source_contact_id = context.contactId;
    if (context.accountId) customFields.source_account_id = context.accountId;

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".leads
        (first_name, last_name, email, phone, company, source, status, custom_fields)
       VALUES ($1, $2, $3, $4, $5, 'web_form', 'new', $6)
       RETURNING id`,
      [
        data.first_name || data.firstName || '',
        data.last_name || data.lastName || '',
        data.email || null,
        data.phone || null,
        data.company || null,
        Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : null,
      ],
    );
    return { entityType: 'lead', entityId: row.id };
  }

  private async createContactFromSubmission(
    schemaName: string,
    data: Record<string, any>,
    context: Record<string, string>,
  ) {
    // If an account was created earlier, link the contact to it
    const accountId = context.accountId || null;

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".contacts
        (first_name, last_name, email, phone, company, account_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        data.first_name || data.firstName || '',
        data.last_name || data.lastName || '',
        data.email || null,
        data.phone || null,
        data.company || null,
        accountId,
      ],
    );
    return { entityType: 'contact', entityId: row.id };
  }

  private async createAccountFromSubmission(
    schemaName: string,
    data: Record<string, any>,
  ) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".accounts
        (name, email, phone, website, type)
       VALUES ($1, $2, $3, $4, 'prospect')
       RETURNING id`,
      [
        data.name || data.company || '',
        data.email || null,
        data.phone || null,
        data.website || null,
      ],
    );
    return { entityType: 'account', entityId: row.id };
  }

  private async sendWebhook(url: string, data: any, form: any): Promise<any> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          formName: form.name,
          data,
          submittedAt: new Date().toISOString(),
        }),
      });
      return { statusCode: response.status };
    } catch (err: any) {
      throw new Error(`Webhook failed: ${err.message}`);
    }
  }

  // ── Formatters ──────────────────────────────────────────────
  private formatRow(r: any) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      slug: r.slug,
      status: r.status,
      fields: typeof r.fields === 'string' ? JSON.parse(r.fields) : r.fields,
      settings:
        typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings,
      submitActions:
        typeof r.submit_actions === 'string'
          ? JSON.parse(r.submit_actions)
          : r.submit_actions,
      branding:
        typeof r.branding === 'string' ? JSON.parse(r.branding) : r.branding,
      token: r.token,
      tenantSlug: r.tenant_slug,
      submissionCount: r.submission_count,
      createdBy: r.created_by,
      createdByName: r.created_by_name || null,
      updatedBy: r.updated_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private formatSubmission(r: any) {
    return {
      id: r.id,
      formId: r.form_id,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
      metadata:
        typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      actionResults:
        typeof r.action_results === 'string'
          ? JSON.parse(r.action_results)
          : r.action_results,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      createdAt: r.created_at,
    };
  }
}
