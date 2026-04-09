import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { WorkflowRunnerService } from '../workflows/workflow-runner.service';
import { LeadScoringService } from '../leads/lead-scoring.service';
import { EmailService } from '../email/email.service';
import { randomBytes } from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function formatPhoneE164(raw: string | null | undefined, defaultCountry?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, '');
  try {
    // 1. Try parsing as-is (works for numbers with + prefix)
    let parsed = parsePhoneNumberFromString(cleaned);
    if (parsed?.isValid()) return parsed.format('E.164');

    // 2. Try with explicit country if provided
    if (defaultCountry) {
      parsed = parsePhoneNumberFromString(cleaned, defaultCountry.toUpperCase() as any);
      if (parsed?.isValid()) return parsed.format('E.164');
    }

    // 3. Try adding + prefix in case it's a full international number without +
    if (/^\d{10,15}$/.test(cleaned) && !cleaned.startsWith('0')) {
      parsed = parsePhoneNumberFromString(`+${cleaned}`);
      if (parsed?.isValid()) return parsed.format('E.164');
    }

    return raw;
  } catch {
    return raw;
  }
}

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly activityService: ActivityService,
    private readonly workflowRunner: WorkflowRunnerService,
    private readonly scoringService: LeadScoringService,
    private readonly emailService: EmailService,
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
        (name, description, slug, status, fields, settings, submit_actions, branding,
         token, tenant_slug, is_landing_page, landing_page_config,
         type, meeting_config, available_modules, allow_multiple_submissions,
         created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
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
        data.isLandingPage ?? false,
        JSON.stringify(data.landingPageConfig || {}),
        data.type || 'standard',
        JSON.stringify(data.meetingConfig || {}),
        data.availableModules || [],
        data.allowMultipleSubmissions ?? true,
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
        is_landing_page = COALESCE($10, is_landing_page),
        landing_page_config = COALESCE($11, landing_page_config),
        type = COALESCE($12, type),
        meeting_config = COALESCE($13, meeting_config),
        available_modules = COALESCE($14, available_modules),
        allow_multiple_submissions = COALESCE($15, allow_multiple_submissions),
        updated_by = $16,
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
        data.isLandingPage ?? null,
        data.landingPageConfig ? JSON.stringify(data.landingPageConfig) : null,
        data.type ?? null,
        data.meetingConfig ? JSON.stringify(data.meetingConfig) : null,
        data.availableModules !== undefined ? data.availableModules : null,
        data.allowMultipleSubmissions ?? null,
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
    query: { page?: number; limit?: number; startDate?: string; endDate?: string; actionStatus?: string },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;

    await this.findById(schemaName, formId);

    const conditions: string[] = ['form_id = $1'];
    const params: any[] = [formId];
    let idx = 2;

    if (query.startDate) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(query.startDate);
    }
    if (query.endDate) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(query.endDate);
    }
    if (query.actionStatus === 'success') {
      conditions.push(`NOT EXISTS (SELECT 1 FROM jsonb_array_elements(action_results::jsonb) ar WHERE ar->>'status' = 'error')`);
    } else if (query.actionStatus === 'error') {
      conditions.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(action_results::jsonb) ar WHERE ar->>'status' = 'error')`);
    }

    const where = conditions.join(' AND ');

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) FROM "${schemaName}".form_submissions WHERE ${where}`,
      params,
    );
    const total = parseInt(countResult.count, 10);

    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".form_submissions
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatSubmission(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Get analytics ───────────────────────────────────────────
  async getAnalytics(schemaName: string, formId: string) {
    const form = await this.findById(schemaName, formId);

    const [totals] = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last30
       FROM "${schemaName}".form_submissions
       WHERE form_id = $1`,
      [formId],
    );

    const daily = await this.dataSource.query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*)::int    AS count
       FROM "${schemaName}".form_submissions
       WHERE form_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [formId],
    );

    const actionRows = await this.dataSource.query(
      `SELECT
         elem->>'type'   AS action_type,
         elem->>'status' AS status,
         COUNT(*)::int   AS count
       FROM "${schemaName}".form_submissions,
            jsonb_array_elements(action_results::jsonb) AS elem
       WHERE form_id = $1
       GROUP BY elem->>'type', elem->>'status'`,
      [formId],
    );

    // Per-field distributions
    const structuralTypes = ['heading', 'paragraph', 'divider'];
    const choiceTypes = ['select', 'radio', 'checkbox'];
    const numberTypes = ['number'];
    const textTypes = ['text', 'email', 'phone', 'textarea', 'date'];

    const fields = (form.fields as any[]).filter(
      (f) => !structuralTypes.includes(f.type),
    );

    const fieldStats = await Promise.all(
      fields.map(async (field) => {
        const name = field.name;

        if (choiceTypes.includes(field.type)) {
          const rows = await this.dataSource.query(
            `SELECT data->$2 AS value, COUNT(*)::int AS count
             FROM "${schemaName}".form_submissions
             WHERE form_id = $1 AND data->$2 IS NOT NULL AND data->$2 != 'null'::jsonb
             GROUP BY data->$2
             ORDER BY count DESC`,
            [formId, name],
          );
          return {
            name,
            label: field.label,
            type: field.type,
            responseCount: rows.reduce((s: number, r: any) => s + r.count, 0),
            distribution: rows.map((r: any) => ({
              value: r.value?.replace(/^"|"$/g, '') ?? '',
              count: r.count,
            })),
          };
        }

        if (numberTypes.includes(field.type)) {
          const [stats] = await this.dataSource.query(
            `SELECT
               COUNT(*)::int AS response_count,
               AVG((data->$2)::text::numeric)::numeric(10,2) AS avg,
               MIN((data->$2)::text::numeric) AS min,
               MAX((data->$2)::text::numeric) AS max
             FROM "${schemaName}".form_submissions
             WHERE form_id = $1
               AND data->$2 IS NOT NULL
               AND data->$2 != 'null'::jsonb
               AND (data->$2)::text ~ '^-?[0-9]+(\\.[0-9]+)?$'`,
            [formId, name],
          );
          return {
            name,
            label: field.label,
            type: field.type,
            responseCount: stats.response_count,
            stats: {
              avg: stats.avg ? parseFloat(stats.avg) : null,
              min: stats.min ? parseFloat(stats.min) : null,
              max: stats.max ? parseFloat(stats.max) : null,
            },
          };
        }

        if (textTypes.includes(field.type)) {
          const [{ response_count }] = await this.dataSource.query(
            `SELECT COUNT(*)::int AS response_count
             FROM "${schemaName}".form_submissions
             WHERE form_id = $1
               AND data->$2 IS NOT NULL
               AND data->$2 != 'null'::jsonb
               AND data->$2 != '""'::jsonb`,
            [formId, name],
          );
          const samples = await this.dataSource.query(
            `SELECT (data->$2)::text AS value
             FROM "${schemaName}".form_submissions
             WHERE form_id = $1
               AND data->$2 IS NOT NULL
               AND data->$2 != 'null'::jsonb
               AND data->$2 != '""'::jsonb
             ORDER BY created_at DESC
             LIMIT 5`,
            [formId, name],
          );
          return {
            name,
            label: field.label,
            type: field.type,
            responseCount: response_count,
            samples: samples.map((r: any) =>
              r.value?.replace(/^"|"$/g, '') ?? '',
            ),
          };
        }

        return { name, label: field.label, type: field.type, responseCount: 0 };
      }),
    );

    return {
      total: totals.total,
      last7Days: totals.last7,
      last30Days: totals.last30,
      dailyTrend: daily,
      actionBreakdown: actionRows,
      fieldStats,
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

    // ── reCAPTCHA v3 verification ──────────────────────────
    if (form.settings?.requireCaptcha) {
      const captchaToken = submissionData.__recaptchaToken;
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (!captchaToken || !secretKey) {
        throw new BadRequestException('CAPTCHA verification required');
      }
      const verifyRes = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`,
        { method: 'POST' },
      );
      const verifyData: any = await verifyRes.json();
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
        throw new BadRequestException('CAPTCHA verification failed');
      }
      delete submissionData.__recaptchaToken;
    }

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
      case 'send_email':
        return this.sendEmailToSubmitter(action, data, form);
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
    // Build custom_fields from cf_ prefixed mappings and linked entity references
    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('cf_') && value !== undefined && value !== null && value !== '') {
        customFields[key.substring(3)] = value;
      }
    }
    if (context.contactId) customFields.source_contact_id = context.contactId;
    if (context.accountId) customFields.source_account_id = context.accountId;

    // Resolve default pipeline and stage
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    const [defaultPl] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".pipelines WHERE is_default = true AND is_active = true LIMIT 1`,
    );
    pipelineId = defaultPl?.id || null;
    if (pipelineId) {
      const [defaultStage] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".pipeline_stages
         WHERE pipeline_id = $1 AND module = 'leads'
           AND is_active = true AND is_won = false AND is_lost = false
         ORDER BY sort_order ASC LIMIT 1`,
        [pipelineId],
      );
      stageId = defaultStage?.id || null;
    }

    // Resolve default qualification framework
    let qualFrameworkId: string | null = null;
    const [generalSettings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'general'`,
    );
    const generalConfig = generalSettings?.setting_value || {};
    if (generalConfig.activeQualificationFramework) {
      const [fw] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".lead_qualification_frameworks
         WHERE slug = $1 AND is_active = true LIMIT 1`,
        [generalConfig.activeQualificationFramework],
      );
      qualFrameworkId = fw?.id || null;
    }

    // Resolve tenant base country for phone formatting
    let baseCountry: string | undefined;
    const [companySettings] = await this.dataSource.query(
      `SELECT base_country FROM "${schemaName}".company_settings LIMIT 1`,
    ).catch(() => [undefined]);
    baseCountry = companySettings?.base_country || undefined;

    // Resolve default priority
    let priorityId: string | null = null;
    const [defaultPriority] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".lead_priorities
       WHERE is_default = true AND is_active = true LIMIT 1`,
    );
    priorityId = defaultPriority?.id || null;

    // Parse tags if provided as comma-separated string
    let tags: string[] = [];
    if (data.tags) {
      tags = Array.isArray(data.tags)
        ? data.tags
        : String(data.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".leads
        (first_name, last_name, email, phone, mobile,
         company, job_title, website, industry,
         source, source_details,
         address_line1, address_line2, city, state, postal_code, country,
         country_code, phone_country_code, mobile_country_code,
         tags, custom_fields,
         pipeline_id, stage_id, stage_entered_at,
         qualification_framework_id, priority_id)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8, $9,
               $10, $11,
               $12, $13, $14, $15, $16, $17,
               $18, $19, $20,
               $21, $22,
               $23, $24, NOW(),
               $25, $26)
       RETURNING *`,
      [
        data.first_name || data.firstName || '',
        data.last_name || data.lastName || '',
        data.email ? String(data.email).toLowerCase().trim() : null,
        formatPhoneE164(data.phone, data.country_code || data.countryCode || baseCountry),
        formatPhoneE164(data.mobile, data.country_code || data.countryCode || baseCountry),
        data.company || null,
        data.job_title || data.jobTitle || null,
        data.website || null,
        data.industry || null,
        data.source || 'web_form',
        data.source_details ? JSON.stringify(data.source_details) : null,
        data.address_line1 || data.address || null,
        data.address_line2 || null,
        data.city || null,
        data.state || null,
        data.postal_code || data.postalCode || null,
        data.country || null,
        data.country_code || data.countryCode || null,
        data.phone_country_code || data.phoneCountryCode || null,
        data.mobile_country_code || data.mobileCountryCode || null,
        tags.length > 0 ? JSON.stringify(tags) : null,
        Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : null,
        pipelineId,
        stageId,
        qualFrameworkId,
        priorityId,
      ],
    );

    // Score the lead (profile completion, demographic, qualification rules)
    await this.scoringService.scoreLead(schemaName, row.id);

    // Fire workflow trigger for lead creation (fire-and-forget)
    this.workflowRunner
      .trigger(schemaName, 'leads', 'lead_created', row.id, row)
      .catch((err) => this.logger.error(`Workflow trigger failed for lead ${row.id}: ${err.message}`));

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
       RETURNING *`,
      [
        data.first_name || data.firstName || '',
        data.last_name || data.lastName || '',
        data.email || null,
        data.phone || null,
        data.company || null,
        accountId,
      ],
    );

    // Fire workflow trigger for contact creation (fire-and-forget)
    this.workflowRunner
      .trigger(schemaName, 'contacts', 'contact_created', row.id, row)
      .catch((err) => this.logger.error(`Workflow trigger failed for contact ${row.id}: ${err.message}`));

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
       RETURNING *`,
      [
        data.name || data.company || '',
        data.email || null,
        data.phone || null,
        data.website || null,
      ],
    );

    // Fire workflow trigger for account creation (fire-and-forget)
    this.workflowRunner
      .trigger(schemaName, 'accounts', 'account_created', row.id, row)
      .catch((err) => this.logger.error(`Workflow trigger failed for account ${row.id}: ${err.message}`));

    return { entityType: 'account', entityId: row.id };
  }

  private async sendWebhook(url: string, data: any, form: any): Promise<any> {
    const startedAt = Date.now();
    let responseBody = '';
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
      const statusCode = response.status;
      try { responseBody = await response.text(); } catch { /* ignore */ }
      const durationMs = Date.now() - startedAt;
      if (!response.ok) {
        throw new Error(`HTTP ${statusCode}: ${responseBody.substring(0, 200)}`);
      }
      return { statusCode, responseBody: responseBody.substring(0, 500), durationMs, url };
    } catch (err: any) {
      throw new Error(`Webhook failed: ${err.message}`);
    }
  }

  private async sendEmailToSubmitter(action: any, data: any, form: any): Promise<any> {
    const toEmail = data[action.emailFieldName || 'email'] || data.email;
    if (!toEmail) throw new Error('No email address found in submission data');

    const interpolate = (template: string) =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');

    const subject = interpolate(action.subject || `Thank you for submitting ${form.name}`);
    const body = interpolate(
      action.body || `<p>Thank you for your submission. We will be in touch soon.</p>`,
    );

    await this.emailService.sendEmail({ to: toEmail, subject, html: body });
    return { to: toEmail, subject };
  }

  async retryWebhook(schemaName: string, submissionId: string, actionIndex: number) {
    const [row] = await this.dataSource.query(
      `SELECT fs.*, f.name as form_name, f.id as form_id_ref
       FROM "${schemaName}".form_submissions fs
       JOIN "${schemaName}".forms f ON f.id = fs.form_id
       WHERE fs.id = $1`,
      [submissionId],
    );
    if (!row) throw new NotFoundException('Submission not found');

    const submission = this.formatSubmission(row);
    const form = { id: row.form_id_ref, name: row.form_name };
    const actionResults: any[] = submission.actionResults || [];
    const targetAction = actionResults[actionIndex];

    if (!targetAction || targetAction.type !== 'webhook') {
      throw new BadRequestException('Action is not a webhook or index invalid');
    }

    const [formRow] = await this.dataSource.query(
      `SELECT submit_actions FROM "${schemaName}".forms WHERE id = $1`,
      [row.form_id],
    );
    const submitActions = typeof formRow.submit_actions === 'string'
      ? JSON.parse(formRow.submit_actions) : formRow.submit_actions;
    const webhookActions = submitActions.filter((a: any) => a.type === 'webhook');
    const webhookActionDef = webhookActions[0];

    if (!webhookActionDef?.webhookUrl) {
      throw new BadRequestException('Webhook URL not found on form definition');
    }

    try {
      const result = await this.sendWebhook(webhookActionDef.webhookUrl, submission.data, form);
      actionResults[actionIndex] = { ...targetAction, status: 'success', result, retriedAt: new Date().toISOString() };
    } catch (err: any) {
      actionResults[actionIndex] = { ...targetAction, status: 'error', error: err.message, retriedAt: new Date().toISOString() };
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".form_submissions SET action_results = $1 WHERE id = $2`,
      [JSON.stringify(actionResults), submissionId],
    );

    return this.formatSubmission({ ...row, action_results: actionResults });
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
      type: r.type || 'standard',
      meetingConfig: typeof r.meeting_config === 'string'
        ? JSON.parse(r.meeting_config) : (r.meeting_config || {}),
      isLandingPage: r.is_landing_page ?? false,
      landingPageConfig: typeof r.landing_page_config === 'string'
        ? JSON.parse(r.landing_page_config) : (r.landing_page_config ?? {}),
      availableModules: r.available_modules || [],
      allowMultipleSubmissions: r.allow_multiple_submissions ?? true,
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
      entityType: r.entity_type || null,
      entityId: r.entity_id || null,
      status: r.status || null,
      createdAt: r.created_at,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // MODULE-LINKED FORMS
  // ══════════════════════════════════════════════════════════════

  // Get forms available for a specific module (e.g., 'accounts')
  async getFormsForModule(schemaName: string, moduleName: string) {
    const rows = await this.dataSource.query(
      `SELECT id, name, description, fields, settings, allow_multiple_submissions, status
       FROM "${schemaName}".forms
       WHERE $1 = ANY(available_modules) AND status = 'active' AND deleted_at IS NULL
       ORDER BY name ASC`,
      [moduleName],
    );
    return rows.map((r: any) => this.formatForm(r));
  }

  // Get submissions for a specific entity (e.g., account with id X)
  async getEntitySubmissions(
    schemaName: string,
    entityType: string,
    entityId: string,
    formId?: string,
  ) {
    let query = `
      SELECT fs.*, f.name as form_name, f.fields as form_fields,
             u.first_name as submitter_first_name, u.last_name as submitter_last_name
      FROM "${schemaName}".form_submissions fs
      JOIN "${schemaName}".forms f ON f.id = fs.form_id
      LEFT JOIN "${schemaName}".users u ON u.id = fs.submitted_by
      WHERE fs.entity_type = $1 AND fs.entity_id = $2 AND fs.deleted_at IS NULL
        AND fs.status != 'pending'
    `;
    const params: any[] = [entityType, entityId];
    if (formId) {
      query += ` AND fs.form_id = $3`;
      params.push(formId);
    }
    query += ` ORDER BY fs.created_at DESC`;

    const rows = await this.dataSource.query(query, params);
    return rows.map((r: any) => ({
      id: r.id,
      formId: r.form_id,
      formName: r.form_name,
      formFields: typeof r.form_fields === 'string' ? JSON.parse(r.form_fields) : r.form_fields,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      entityType: r.entity_type,
      entityId: r.entity_id,
      submittedBy: r.submitted_by,
      submitterName: r.submitter_first_name
        ? `${r.submitter_first_name} ${r.submitter_last_name || ''}`.trim()
        : null,
      filledByEmail: r.filled_by_email,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // Submit a form linked to an entity
  async submitEntityForm(
    schemaName: string,
    userId: string,
    dto: {
      formId: string;
      entityType: string;
      entityId: string;
      data: Record<string, any>;
    },
  ) {
    // Check if form exists and is available for this module
    const [form] = await this.dataSource.query(
      `SELECT id, name, allow_multiple_submissions, fields
       FROM "${schemaName}".forms
       WHERE id = $1 AND $2 = ANY(available_modules) AND status = 'active' AND deleted_at IS NULL`,
      [dto.formId, dto.entityType],
    );
    if (!form) throw new NotFoundException('Form not found or not available for this module');

    // Check allow_multiple
    if (!form.allow_multiple_submissions) {
      const [existing] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".form_submissions
         WHERE form_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL LIMIT 1`,
        [dto.formId, dto.entityType, dto.entityId],
      );
      if (existing) throw new BadRequestException('This form has already been submitted for this record');
    }

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".form_submissions
       (form_id, entity_type, entity_id, data, submitted_by, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'submitted')
       RETURNING *`,
      [dto.formId, dto.entityType, dto.entityId, JSON.stringify(dto.data), userId],
    );

    // Update submission count
    await this.dataSource.query(
      `UPDATE "${schemaName}".forms SET submission_count = submission_count + 1 WHERE id = $1`,
      [dto.formId],
    );

    // Audit log
    await this.auditService.log(schemaName, {
      entityType: 'form_submissions',
      entityId: row.id,
      action: 'create',
      changes: {},
      newValues: row,
      performedBy: userId,
    });

    return { id: row.id, formId: row.form_id, status: row.status, createdAt: row.created_at };
  }

  // Generate a public access token for external form filling
  async generateFormLink(
    schemaName: string,
    userId: string,
    dto: {
      formId: string;
      entityType: string;
      entityId: string;
      expiresInHours?: number;
    },
  ) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (dto.expiresInHours || 168)); // 7 days default

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".form_submissions
       (form_id, entity_type, entity_id, data, status, access_token, token_expires_at)
       VALUES ($1, $2, $3, '{}'::jsonb, 'pending', $4, $5)
       RETURNING id, access_token`,
      [dto.formId, dto.entityType, dto.entityId, token, expiresAt.toISOString()],
    );

    return {
      submissionId: row.id,
      accessToken: row.access_token,
      expiresAt,
    };
  }

  // Submit form via public token (no auth required)
  async submitPublicFormByToken(
    tenantSchema: string,
    token: string,
    data: Record<string, any>,
    email?: string,
  ) {
    const [submission] = await this.dataSource.query(
      `SELECT fs.id, fs.form_id, fs.entity_type, fs.entity_id, fs.status, fs.token_expires_at,
              f.name as form_name, f.fields as form_fields
       FROM "${tenantSchema}".form_submissions fs
       JOIN "${tenantSchema}".forms f ON f.id = fs.form_id
       WHERE fs.access_token = $1 AND fs.deleted_at IS NULL`,
      [token],
    );

    if (!submission) throw new NotFoundException('Invalid or expired form link');
    if (submission.status !== 'pending') throw new BadRequestException('This form has already been submitted');
    if (submission.token_expires_at && new Date(submission.token_expires_at) < new Date()) {
      throw new BadRequestException('This form link has expired');
    }

    await this.dataSource.query(
      `UPDATE "${tenantSchema}".form_submissions
       SET data = $1::jsonb, status = 'submitted', filled_by_email = $2,
           access_token = NULL, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(data), email || null, submission.id],
    );

    // Update submission count
    await this.dataSource.query(
      `UPDATE "${tenantSchema}".forms SET submission_count = submission_count + 1 WHERE id = $1`,
      [submission.form_id],
    );

    return { success: true, submissionId: submission.id };
  }

  // Resolve tenant schema from a public form token
  async resolveTokenTenant(token: string): Promise<string | null> {
    // Get all tenant schemas
    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE is_active = true`,
    );
    for (const t of tenants) {
      const [row] = await this.dataSource.query(
        `SELECT id FROM "${t.schema_name}".form_submissions
         WHERE access_token = $1 AND deleted_at IS NULL LIMIT 1`,
        [token],
      ).catch(() => []);
      if (row) return t.schema_name;
    }
    return null;
  }

  // Send form via email
  async sendFormEmail(
    schemaName: string,
    userId: string,
    dto: {
      formId: string;
      entityType: string;
      entityId: string;
      recipients: string[];
      subject: string;
      body: string;
      expiresInHours?: number;
    },
  ) {
    // Generate link for each recipient
    const results = [];
    for (const email of dto.recipients) {
      const link = await this.generateFormLink(schemaName, userId, {
        formId: dto.formId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        expiresInHours: dto.expiresInHours,
      });

      // Get the tenant's frontend URL from config
      const frontendUrl = process.env.FRONTEND_URL || 'https://hiperteam.intellicon.io';
      const formUrl = `${frontendUrl}/public/form/${link.accessToken}?tenant=${schemaName}`;

      // Replace {form_link} in body with actual URL
      const emailBody = dto.body.replace(/\{form_link\}/g, formUrl);

      // Send email via email service
      try {
        await this.emailService.sendEmail({
          to: email,
          subject: dto.subject,
          html: emailBody,
        });
        results.push({ email, status: 'sent', token: link.accessToken });
      } catch (err: any) {
        results.push({ email, status: 'failed', error: err.message });
      }
    }

    // Log activity
    await this.activityService.create(schemaName, {
      entityType: dto.entityType,
      entityId: dto.entityId,
      activityType: 'form_sent',
      title: `Form sent to ${dto.recipients.length} recipient(s)`,
      performedBy: userId,
    });

    return results;
  }

  // Delete a submission (soft delete)
  async deleteEntitySubmission(schemaName: string, userId: string, submissionId: string) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".form_submissions SET deleted_at = NOW() WHERE id = $1`,
      [submissionId],
    );
    await this.auditService.log(schemaName, {
      entityType: 'form_submissions',
      entityId: submissionId,
      action: 'delete',
      changes: {},
      newValues: {},
      performedBy: userId,
    });
    return { success: true };
  }

  // Lightweight formatter for module-linked form listing
  private formatForm(r: any) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      fields: typeof r.fields === 'string' ? JSON.parse(r.fields) : r.fields,
      settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings,
      allowMultipleSubmissions: r.allow_multiple_submissions ?? true,
      status: r.status,
    };
  }
}
