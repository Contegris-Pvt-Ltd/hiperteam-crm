// ============================================================
// FILE: apps/api/src/modules/leads/leads.service.ts
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateLeadDto, UpdateLeadDto, QueryLeadsDto, ConvertLeadDto, ChangeStageDto, DisqualifyLeadDto } from './dto';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { formatPhoneE164 } from '../../common/utils/phone.util';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { LeadScoringService } from './lead-scoring.service';
import { RecordTeamService } from '../shared/record-team.service';
import { FieldValidationService } from '../shared/field-validation.service';
import { SlaService } from './sla.service';
import { WorkflowRunnerService } from '../workflows/workflow-runner.service';
import { XLSX } from '../../common/utils/xlsx-compat';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  // Fields tracked for audit
  private readonly trackedFields = [
    'firstName', 'lastName', 'email', 'phone', 'mobile', 'company', 'jobTitle',
    'website', 'source', 'stageId', 'priorityId', 'score', 'qualification',
    'ownerId', 'tags', 'doNotContact', 'doNotEmail', 'doNotCall',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
    private scoringService: LeadScoringService,
    private recordTeamService: RecordTeamService,
    private fieldValidationService: FieldValidationService,
    private slaService: SlaService,
    private workflowRunner: WorkflowRunnerService,
    private notificationService: NotificationService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(schemaName: string, userId: string, dto: CreateLeadDto) {
    // ── Field validation (tenant-configurable rules) ──
    await this.fieldValidationService.validate(schemaName, 'leads', {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      mobile: dto.mobile,
      company: dto.company,
      jobTitle: dto.jobTitle,
      website: dto.website,
      source: dto.source,
    }, dto.customFields as Record<string, any>);

    // 1. Phone validation
    const country = dto.country || 'PK';
    if (dto.phone && !formatPhoneE164(dto.phone, country)) {
      throw new BadRequestException('Invalid phone number');
    }
    if (dto.mobile && !formatPhoneE164(dto.mobile, country)) {
      throw new BadRequestException('Invalid mobile number');
    }

    // 2. Duplicate detection
    await this.checkDuplicates(schemaName, dto.email, dto.phone, null);

    // 3. Get default stage if not provided
    let stageId = dto.stageId;
    let pipelineId = dto.pipelineId;
    if (!stageId) {
      // Resolve pipeline first, then get its first open stage
      if (!pipelineId) {
        const [defaultPl] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".pipelines WHERE is_default = true AND is_active = true LIMIT 1`,
        );
        pipelineId = defaultPl?.id;
      }
      if (pipelineId) {
        const [defaultStage] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".pipeline_stages
           WHERE pipeline_id = $1 AND module = 'leads'
             AND is_active = true AND is_won = false AND is_lost = false
           ORDER BY sort_order ASC LIMIT 1`,
          [pipelineId],
        );
        stageId = defaultStage?.id;
      }
    }

    // 3. Get default priority if not provided
    let priorityId = dto.priorityId;
    if (!priorityId) {
      const [defaultPriority] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".lead_priorities 
         WHERE is_default = true AND is_active = true LIMIT 1`,
      );
      priorityId = defaultPriority?.id;
    }

    // 4. Get default qualification framework
    let qualFrameworkId = dto.qualificationFrameworkId;
    if (!qualFrameworkId) {
      const [settings] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'general'`,
      );
      const generalSettings = settings?.setting_value || {};
      if (generalSettings.activeQualificationFramework) {
        const [fw] = await this.dataSource.query(
          `SELECT id FROM "${schemaName}".lead_qualification_frameworks 
           WHERE slug = $1 AND is_active = true LIMIT 1`,
          [generalSettings.activeQualificationFramework],
        );
        qualFrameworkId = fw?.id;
      }
    }

    // 5. Determine owner and team
    // '__auto_assign__' means leave owner null so workflow routing can assign
    const ownerId = dto.ownerId === '__auto_assign__' ? null : (dto.ownerId || userId);
    const teamId = dto.teamId || null;

    // 6. Insert lead
    const [lead] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".leads (
        first_name, last_name, email, phone, mobile,
        company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        country_code, phone_country_code, mobile_country_code,
        emails, phones, addresses, social_profiles,
        source, source_details,
        pipeline_id, stage_id, priority_id,
        qualification, qualification_framework_id,
        do_not_contact, do_not_email, do_not_call,
        tags, custom_fields,
        owner_id, team_id, created_by, updated_by,
        stage_entered_at, stage_history,
        industry,
        contact_id, account_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23,
        $24, $25, $26,
        $27, $28,
        $29, $30, $31,
        $32, $33,
        $34, $35, $36, $36,
        NOW(), $37,
        $38,
        $39, $40
      ) RETURNING *`,
      [
        dto.firstName || null,
        dto.lastName,
        dto.email ? dto.email.toLowerCase().trim() : null,
        dto.phone ? formatPhoneE164(dto.phone, country) : null,
        dto.mobile ? formatPhoneE164(dto.mobile, country) : null,
        dto.company || null,
        dto.jobTitle || null,
        dto.website || null,
        dto.addressLine1 || null,
        dto.addressLine2 || null,
        dto.city || null,
        dto.state || null,
        dto.postalCode || null,
        dto.country || null,
        dto.countryCode || null,
        dto.phoneCountryCode || null,
        dto.mobileCountryCode || null,
        JSON.stringify(dto.emails || []),
        JSON.stringify((dto.phones || []).map(p => ({ ...p, number: formatPhoneE164(p.number, country) || p.number }))),
        JSON.stringify(dto.addresses || []),
        JSON.stringify(dto.socialProfiles || {}),
        dto.source || null,
        JSON.stringify(dto.sourceDetails || {}),
        pipelineId || null,
        stageId || null,
        priorityId || null,
        JSON.stringify(dto.qualification || {}),
        qualFrameworkId || null,
        dto.doNotContact || false,
        dto.doNotEmail || false,
        dto.doNotCall || false,
        dto.tags || [],
        JSON.stringify(dto.customFields || {}),
        ownerId,
        teamId,
        userId,
        JSON.stringify([{ stageId, enteredAt: new Date().toISOString(), enteredBy: userId }]),
        (dto as any).industry || null,
        (dto as any).contactId || null,
        (dto as any).accountId || null,
      ],
    );

    const formatted = this.formatLead(lead);

    // 7. Score the lead
    await this.scoringService.scoreLead(schemaName, lead.id);

    // 8. Re-fetch after scoring to get updated score
    const scored = await this.findOneRaw(schemaName, lead.id);

    // 9. Auto-set priority from score if enabled (only if user did NOT explicitly pick one)
    if (!dto.priorityId) {
      await this.autoSetPriority(schemaName, lead.id, scored.score);
    }

    // 10. Activity + Audit
    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: lead.id,
      activityType: 'created',
      title: 'Lead created',
      description: `Lead "${dto.firstName || ''} ${dto.lastName}" was created`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: lead.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    try {
      await this.slaService.setSlaDueDate(schemaName, lead.id, new Date(lead.created_at));
    } catch (slaErr) {
      this.logger.warn(`Failed to set SLA for lead ${lead.id}: ${slaErr}`);
    }

    if (dto.productIds?.length) {
      for (const productId of dto.productIds) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".lead_products (lead_id, product_id, created_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (lead_id, product_id) DO NOTHING`,
          [lead.id, productId, userId],
        );
      }
    }

    // 11. Return final formatted lead
    const created = await this.findOne(schemaName, lead.id);
    this.workflowRunner.trigger(schemaName, 'leads', 'lead_created', lead.id, created).catch(() => {});
    return created;
  }

  // ============================================================
  // FIND ALL (List + Kanban)
  // ============================================================
  private buildFilterConditions(
    schemaName: string,
    query: { search?: string; stageId?: string; stageSlug?: string; priorityId?: string; source?: string; ownerId?: string; teamId?: string; tag?: string; company?: string; productIds?: string; scoreMin?: number; scoreMax?: number; convertedStatus?: string; ownership?: string; pipelineId?: string; columnSearch?: Record<string, string> },
    userId?: string,
    startParamIndex = 1,
  ): { conditions: string[]; params: unknown[]; paramIndex: number } {
    const conditions: string[] = ['l.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = startParamIndex;

    if (query.search) {
      conditions.push(`(
        l.first_name ILIKE $${paramIndex} OR l.last_name ILIKE $${paramIndex}
        OR l.email ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex}
        OR l.phone ILIKE $${paramIndex}
        OR CONCAT(l.first_name, ' ', l.last_name) ILIKE $${paramIndex}
      )`);
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    if (query.pipelineId) {
      conditions.push(`l.pipeline_id = $${paramIndex}`);
      params.push(query.pipelineId);
      paramIndex++;
    }

    if (query.stageId) {
      conditions.push(`l.stage_id = $${paramIndex}`);
      params.push(query.stageId);
      paramIndex++;
    }

    if (query.stageSlug) {
      conditions.push(`ls.slug = $${paramIndex}`);
      params.push(query.stageSlug);
      paramIndex++;
    }

    if (query.priorityId) {
      conditions.push(`l.priority_id = $${paramIndex}`);
      params.push(query.priorityId);
      paramIndex++;
    }

    if (query.source) {
      conditions.push(`l.source = $${paramIndex}`);
      params.push(query.source);
      paramIndex++;
    }

    if (query.ownerId) {
      conditions.push(`l.owner_id = $${paramIndex}`);
      params.push(query.ownerId);
      paramIndex++;
    }

    if (query.teamId) {
      conditions.push(`l.team_id = $${paramIndex}`);
      params.push(query.teamId);
      paramIndex++;
    }

    if (query.tag) {
      conditions.push(`$${paramIndex} = ANY(l.tags)`);
      params.push(query.tag);
      paramIndex++;
    }

    if (query.company) {
      conditions.push(`l.company ILIKE $${paramIndex}`);
      params.push(`%${query.company}%`);
      paramIndex++;
    }

    if (query.productIds) {
      const productIdList = query.productIds.split(',').map(id => id.trim()).filter(Boolean);
      if (productIdList.length > 0) {
        const placeholders = productIdList.map((_, i) => `$${paramIndex + i}`).join(',');
        conditions.push(`l.id IN (
          SELECT lp.lead_id FROM "${schemaName}".lead_products lp
          WHERE lp.product_id IN (${placeholders})
        )`);
        params.push(...productIdList);
        paramIndex += productIdList.length;
      }
    }

    if (query.scoreMin !== undefined) {
      conditions.push(`l.score >= $${paramIndex}`);
      params.push(query.scoreMin);
      paramIndex++;
    }

    if (query.scoreMax !== undefined) {
      conditions.push(`l.score <= $${paramIndex}`);
      params.push(query.scoreMax);
      paramIndex++;
    }

    if (query.convertedStatus === 'converted') {
      conditions.push(`l.converted_at IS NOT NULL`);
    } else if (query.convertedStatus === 'disqualified') {
      conditions.push(`l.disqualified_at IS NOT NULL`);
    } else if (query.convertedStatus === 'active') {
      conditions.push(`l.converted_at IS NULL AND l.disqualified_at IS NULL`);
    }

    if (query.ownership === 'my_leads' && userId) {
      conditions.push(`l.owner_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else if (query.ownership === 'created_by_me' && userId) {
      conditions.push(`l.created_by = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else if (query.ownership === 'my_team' && userId) {
      conditions.push(`(
        l.owner_id = $${paramIndex}
        OR l.created_by = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM "${schemaName}".record_team_members rtm
          WHERE rtm.entity_type = 'leads' AND rtm.entity_id = l.id AND rtm.user_id = $${paramIndex}
        )
      )`);
      params.push(userId);
      paramIndex++;
    }

    if (query.columnSearch && Object.keys(query.columnSearch).length > 0) {
      const COLUMN_DB_MAP: Record<string, string> = {
        name:         `CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))`,
        email:        'l.email',
        phone:        'l.phone',
        mobile:       'l.mobile',
        company:      'l.company',
        jobTitle:     'l.job_title',
        source:       'l.source',
        website:      'l.website',
        city:         'l.city',
        state:        'l.state',
        country:      'l.country',
        stageName:    'ls.name',
        priorityName: 'lp.name',
        ownerName:    `CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))`,
      };
      for (const [colKey, searchVal] of Object.entries(query.columnSearch)) {
        const dbCol = COLUMN_DB_MAP[colKey];
        if (dbCol && searchVal.trim()) {
          conditions.push(`${dbCol} ILIKE $${paramIndex}`);
          params.push(`%${searchVal.trim()}%`);
          paramIndex++;
        }
      }
    }

    return { conditions, params, paramIndex };
  }

  async findAll(schemaName: string, query: QueryLeadsDto & { columnSearch?: Record<string, string> }, userId?: string) {
    const {
      view,
      page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const { conditions, params, paramIndex } = this.buildFilterConditions(schemaName, query, userId);
    const whereClause = conditions.join(' AND ');

    // Sort mapping
    const sortMap: Record<string, string> = {
      created_at: 'l.created_at',
      updated_at: 'l.updated_at',
      name: 'l.last_name',
      company: 'l.company',
      score: 'l.score',
      source: 'l.source',
      last_activity_at: 'l.last_activity_at',
      stage: 'ls.sort_order',
    };
    const orderColumn = sortMap[sortBy] || 'l.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // For kanban view, return grouped by stage
    if (view === 'kanban') {
      return this.findAllKanban(schemaName, whereClause, params);
    }

    // Count
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    // Query
    const leads = await this.dataSource.query(
      `SELECT l.*,
        u.first_name as owner_first_name, u.last_name as owner_last_name,
        t.name as team_name,
        ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
        ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
        lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon,
        cu.first_name as created_by_first_name, cu.last_name as created_by_last_name,
        (SELECT COUNT(*) FROM "${schemaName}".lead_products lprod WHERE lprod.lead_id = l.id) as products_count,
        lc.first_name as linked_contact_first_name, lc.last_name as linked_contact_last_name, lc.email as linked_contact_email,
        la.name as linked_account_name, la.emails as linked_account_emails
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".teams t ON l.team_id = t.id
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       LEFT JOIN "${schemaName}".users cu ON l.created_by = cu.id
       LEFT JOIN "${schemaName}".contacts lc ON l.contact_id = lc.id
       LEFT JOIN "${schemaName}".accounts la ON l.account_id = la.id
       WHERE ${whereClause}
       ORDER BY ${orderColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: leads.map((l: Record<string, unknown>) => this.formatLead(l)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Called when a user creates an activity (call, email, meeting, note) on a lead.
   * Marks the SLA as met if it hasn't been met yet.
   */
  async checkAndMarkSlaMet(schemaName: string, leadId: string, userId: string): Promise<void> {
    try {
      await this.slaService.markSlaMet(schemaName, leadId, userId);
    } catch (err) {
      this.logger.warn(`Failed to mark SLA met for lead ${leadId}: ${err}`);
    }
  }

  /**
   * Get SLA status for a specific lead
   */
  async getSlaStatus(schemaName: string, leadId: string) {
    return this.slaService.getSlaStatus(schemaName, leadId);
  }

  /**
   * Get SLA summary for dashboard/reporting
   */
  async getSlaSummary(schemaName: string, filters?: {
    ownerId?: string;
    pipelineId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return this.slaService.getSlaSummary(schemaName, filters);
  }

  /**
   * Run breach detection (called by cron or manual trigger)
   */
  async checkSlaBreaches(schemaName: string) {
    return this.slaService.checkBreaches(schemaName);
  }
  
  // ============================================================
  // KANBAN VIEW (grouped by stage)
  // ============================================================
  private async findAllKanban(schemaName: string, whereClause: string, params: unknown[]) {
    // Get all active stages
    const stages = await this.dataSource.query(
      `SELECT id, name, slug, color, sort_order, is_won, is_lost
       FROM "${schemaName}".pipeline_stages
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );

    // Get leads grouped by stage (limited per column)
    const leads = await this.dataSource.query(
      `SELECT l.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              t.name as team_name,
              ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
              ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
              lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".teams t ON l.team_id = t.id
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       WHERE ${whereClause}
       ORDER BY ls.sort_order ASC, l.score DESC, l.created_at DESC`,
      params,
    );

    // Get counts per stage
    const counts = await this.dataSource.query(
      `SELECT l.stage_id, COUNT(*) as count
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       WHERE ${whereClause}
       GROUP BY l.stage_id`,
      params,
    );

    const countMap = new Map(counts.map((c: any) => [c.stage_id, parseInt(c.count, 10)]));

    // Group leads by stage
    const formattedLeads = leads.map((l: Record<string, unknown>) => this.formatLead(l));
    const grouped = new Map<string, any[]>();
    for (const lead of formattedLeads) {
      const sid = lead.stageId || 'unassigned';
      if (!grouped.has(sid)) grouped.set(sid, []);
      grouped.get(sid)!.push(lead);
    }

    return {
      stages: stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        color: s.color,
        sortOrder: s.sort_order,
        isWon: s.is_won,
        isLost: s.is_lost,
        count: countMap.get(s.id) || 0,
        leads: grouped.get(s.id) || [],
      })),
    };
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, id: string) {
    const formatted = await this.findOneRaw(schemaName, id);

    // Get record team members
    const teamMembers = await this.recordTeamService.getMembers(schemaName, 'leads', id);

    // Get qualification framework fields if framework is set
    let qualificationFields: any[] = [];
    if (formatted.qualificationFrameworkId) {
      qualificationFields = await this.dataSource.query(
        `SELECT qf.field_key, qf.field_label, qf.field_type, qf.field_options,
                qf.score_weight, qf.sort_order, qf.is_required
         FROM "${schemaName}".lead_qualification_fields qf
         WHERE qf.framework_id = $1
         ORDER BY qf.sort_order ASC`,
        [formatted.qualificationFrameworkId],
      );
    }

    // Get current stage fields
    let stageFields: any[] = [];
    if (formatted.stageId) {
      stageFields = await this.dataSource.query(
        `SELECT sf.field_key, sf.field_label, sf.field_type, sf.field_options,
                sf.is_required, sf.is_visible, sf.sort_order
         FROM "${schemaName}".pipeline_stage_fields sf
         WHERE sf.stage_id = $1 AND sf.is_visible = true
         ORDER BY sf.sort_order ASC`,
        [formatted.stageId],
      );
    }

    // Get all stages for journey bar
    // Resolve pipeline: lead's pipeline (only if it has leads stages) → stage's pipeline → default pipeline → any pipeline with leads stages
    const pipelineIdForStages = formatted.pipelineId;
    let allStages = await this.dataSource.query(
      `SELECT id, name, slug, color, sort_order, is_won, is_lost, required_fields, lock_previous_fields
       FROM "${schemaName}".pipeline_stages
       WHERE is_active = true AND module = 'leads'
         AND pipeline_id = COALESCE(
           (SELECT $1::uuid WHERE EXISTS (SELECT 1 FROM "${schemaName}".pipeline_stages WHERE pipeline_id = $1::uuid AND module = 'leads' AND is_active = true)),
           (SELECT pipeline_id FROM "${schemaName}".pipeline_stages WHERE id = $2 AND module = 'leads' LIMIT 1),
           (SELECT id FROM "${schemaName}".pipelines WHERE is_default = true LIMIT 1),
           (SELECT DISTINCT pipeline_id FROM "${schemaName}".pipeline_stages WHERE module = 'leads' AND is_active = true LIMIT 1)
         )
       ORDER BY sort_order ASC`,
      [pipelineIdForStages || null, formatted.stageId || null],
    );

    // Get stage settings
    const [stageSettings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'stages'`,
    );

    // Check duplicates for sidebar panel
    const duplicates = await this.findDuplicates(schemaName, formatted.email, formatted.phone, id);

    return {
      ...formatted,
      teamMembers,
      qualificationFields: qualificationFields.map((f: any) => ({
        fieldKey: f.field_key,
        fieldLabel: f.field_label,
        fieldType: f.field_type,
        fieldOptions: f.field_options,
        scoreWeight: f.score_weight,
        sortOrder: f.sort_order,
        isRequired: f.is_required,
      })),
      stageFields: stageFields.map((f: any) => ({
        fieldKey: f.field_key,
        fieldLabel: f.field_label,
        fieldType: f.field_type,
        fieldOptions: f.field_options,
        isRequired: f.is_required,
        isVisible: f.is_visible,
        sortOrder: f.sort_order,
      })),
      allStages: allStages.map((s: any) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        color: s.color,
        sortOrder: s.sort_order,
        isWon: s.is_won,
        isLost: s.is_lost,
        requiredFields: s.required_fields,
        lockPreviousFields: s.lock_previous_fields,
      })),
      stageSettings: stageSettings?.setting_value || {},
      duplicates,
    };
  }

  // Raw find (no enrichment — used internally)
  async findOneRaw(schemaName: string, id: string) {
    const [lead] = await this.dataSource.query(
      `SELECT l.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              t.name as team_name,
              ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
              ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
              ls.lock_previous_fields as stage_lock_previous,
              lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon,
              pl.name as pipeline_name, pl.stage_movement,
              cu.first_name as created_by_first_name, cu.last_name as created_by_last_name,
              lqf.name as framework_name, lqf.slug as framework_slug,
              dr.name as disqualification_reason_name,
              lc.first_name as linked_contact_first_name, lc.last_name as linked_contact_last_name, lc.email as linked_contact_email,
              la.name as linked_account_name, la.emails as linked_account_emails
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".teams t ON l.team_id = t.id
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       LEFT JOIN "${schemaName}".pipelines pl ON l.pipeline_id = pl.id
       LEFT JOIN "${schemaName}".users cu ON l.created_by = cu.id
       LEFT JOIN "${schemaName}".lead_qualification_frameworks lqf ON l.qualification_framework_id = lqf.id
       LEFT JOIN "${schemaName}".lead_disqualification_reasons dr ON l.disqualification_reason_id = dr.id
       LEFT JOIN "${schemaName}".contacts lc ON l.contact_id = lc.id
       LEFT JOIN "${schemaName}".accounts la ON l.account_id = la.id
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [id],
    );

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.formatLead(lead);
  }

  // ============================================================
  // UPDATE
  // ============================================================
  async update(schemaName: string, id: string, userId: string, dto: UpdateLeadDto) {
    const existing = await this.findOneRaw(schemaName, id);
    const prevOwnerId = existing.ownerId;
    const prevStageId = existing.stageId;
    const prevScore = existing.score;

    // Check if converted (read-only check)
    if (existing.convertedAt) {
      const [convSettings] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'conversion'`,
      );
      const convConfig = convSettings?.setting_value || {};
      if (convConfig.makeReadOnly && !convConfig.allowFieldEdit) {
        throw new BadRequestException('This lead has been converted and is read-only');
      }
    }

    // Duplicate detection on email/phone change
    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      await this.checkDuplicates(schemaName, dto.email, null, id);
    }
    if (dto.phone && dto.phone !== existing.phone) {
      await this.checkDuplicates(schemaName, null, dto.phone, id);
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      mobile: 'mobile',
      company: 'company',
      jobTitle: 'job_title',
      website: 'website',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      countryCode: 'country_code',
      phoneCountryCode: 'phone_country_code',
      mobileCountryCode: 'mobile_country_code',
      industry: 'industry',
      source: 'source',
      pipelineId: 'pipeline_id',
      stageId: 'stage_id',
      priorityId: 'priority_id',
      qualificationFrameworkId: 'qualification_framework_id',
      doNotContact: 'do_not_contact',
      doNotEmail: 'do_not_email',
      doNotCall: 'do_not_call',
      ownerId: 'owner_id',
      teamId: 'team_id',
      contactId: 'contact_id',
      accountId: 'account_id',
    };

    // Fields that accept null when empty string is sent (to allow clearing)
    const nullableFields = ['ownerId', 'teamId', 'contactId', 'accountId'];

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramIndex}`);
        if (key === 'email') {
          params.push((value as string).toLowerCase().trim());
        } else if (nullableFields.includes(key) && value === '') {
          params.push(null);
        } else {
          params.push(value);
        }
        paramIndex++;
      }
    }

    // JSONB fields
    if (dto.emails !== undefined) {
      updates.push(`emails = $${paramIndex}`);
      params.push(JSON.stringify(dto.emails));
      paramIndex++;
    }
    if (dto.phones !== undefined) {
      updates.push(`phones = $${paramIndex}`);
      params.push(JSON.stringify(dto.phones));
      paramIndex++;
    }
    if (dto.addresses !== undefined) {
      updates.push(`addresses = $${paramIndex}`);
      params.push(JSON.stringify(dto.addresses));
      paramIndex++;
    }
    if (dto.socialProfiles !== undefined) {
      updates.push(`social_profiles = $${paramIndex}`);
      params.push(JSON.stringify(dto.socialProfiles));
      paramIndex++;
    }
    if (dto.sourceDetails !== undefined) {
      updates.push(`source_details = $${paramIndex}`);
      params.push(JSON.stringify(dto.sourceDetails));
      paramIndex++;
    }
    if (dto.qualification !== undefined) {
      updates.push(`qualification = $${paramIndex}`);
      params.push(JSON.stringify(dto.qualification));
      paramIndex++;
    }
    if (dto.tags !== undefined) {
      updates.push(`tags = $${paramIndex}`);
      params.push(dto.tags);
      paramIndex++;
    }
    if (dto.customFields !== undefined) {
      updates.push(`custom_fields = $${paramIndex}`);
      params.push(JSON.stringify(dto.customFields));
      paramIndex++;
    }

    if (updates.length === 0) {
      return existing;
    }

    // Handle ownership change → add previous owner to record team
    if (dto.ownerId && dto.ownerId !== existing.ownerId) {
      await this.handleOwnershipChange(schemaName, id, existing.ownerId, dto.ownerId, userId);
    }

    updates.push(`updated_by = $${paramIndex}`);
    params.push(userId);
    paramIndex++;

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      params,
    );

    // Re-score only if relevant fields actually CHANGED (not just present in dto)
    const scoringFields = ['email', 'phone', 'company', 'jobTitle', 'qualification', 'customFields', 'source'];
    const scoringFieldsChanged = scoringFields.some(f => {
      const newVal = (dto as any)[f];
      if (newVal === undefined) return false;
      const oldVal = (existing as any)[f];
      // Deep compare for objects (qualification, customFields, sourceDetails)
      if (typeof newVal === 'object' && typeof oldVal === 'object') {
        return JSON.stringify(newVal) !== JSON.stringify(oldVal);
      }
      return String(newVal ?? '') !== String(oldVal ?? '');
    });

    if (scoringFieldsChanged) {
      await this.scoringService.scoreLead(schemaName, id);
      // Only auto-set priority if user did NOT explicitly change it
      if (dto.priorityId === undefined) {
        const rescored = await this.findOneRaw(schemaName, id);
        await this.autoSetPriority(schemaName, id, rescored.score);
      }
    }

    const updated = await this.findOneRaw(schemaName, id);

    // Audit
    const changes = this.auditService.calculateChanges(existing, updated, this.trackedFields);
    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'leads',
        entityId: id,
        activityType: 'updated',
        title: 'Lead updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'leads',
        entityId: id,
        action: 'update',
        changes,
        previousValues: existing,
        newValues: updated,
        performedBy: userId,
      });
    }

    this.workflowRunner.trigger(schemaName, 'leads', 'lead_updated', id, updated).catch(() => {});
    if (updated.ownerId && updated.ownerId !== prevOwnerId) {
      this.workflowRunner.trigger(schemaName, 'leads', 'lead_assigned', id, updated).catch(() => {});
    }
    if (updated.stageId && updated.stageId !== prevStageId) {
      this.workflowRunner.trigger(schemaName, 'leads', 'lead_stage_changed', id, updated).catch(() => {});
    }
    if (updated.score !== undefined && updated.score !== prevScore) {
      this.workflowRunner.trigger(schemaName, 'leads', 'lead_score_changed', id, updated).catch(() => {});
    }
    return updated;
  }

  // ============================================================
  // CHANGE STAGE (journey bar click)
  // ============================================================
  async changeStage(schemaName: string, id: string, userId: string, dto: ChangeStageDto) {
    const lead = await this.findOneRaw(schemaName, id);

    if (lead.convertedAt) {
      throw new BadRequestException('Cannot change stage of a converted lead');
    }

    // Get target stage
    const [targetStage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1 AND is_active = true`,
      [dto.stageId],
    );

    if (!targetStage) {
      throw new NotFoundException('Target stage not found');
    }

    // Get current stage
    const [currentStage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1`,
      [lead.stageId],
    );

    // Enforce sequential stage movement if pipeline requires it
    if (currentStage) {
      const [pipeline] = await this.dataSource.query(
        `SELECT stage_movement FROM "${schemaName}".pipelines WHERE id = $1`,
        [targetStage.pipeline_id],
      );
      if (pipeline?.stage_movement === 'sequential') {
        const diff = Math.abs(targetStage.sort_order - currentStage.sort_order);
        if (diff > 1) {
          throw new BadRequestException('This pipeline requires sequential stage progression. You cannot skip stages.');
        }
      }
    }

    // Check if moving backward and lock_previous_fields is enabled
    if (currentStage && targetStage.sort_order < currentStage.sort_order) {
      const [stageSettings] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'stages'`,
      );
      const config = stageSettings?.setting_value || {};
      if (config.lockPreviousStages && !dto.unlockReason) {
        throw new BadRequestException('Moving backward requires an unlock reason. Previous stages are locked.');
      }
    }

    // Validate required fields for target stage (query pipeline_stage_fields table)
    const stageFieldRows = await this.dataSource.query(
      `SELECT field_key, field_label, is_required
       FROM "${schemaName}".pipeline_stage_fields
       WHERE stage_id = $1 AND is_required = true`,
      [dto.stageId],
    );

    if (stageFieldRows.length > 0) {
      const requiredKeys: string[] = stageFieldRows.map((f: any) => f.field_key);
      const missingFields = this.validateStageRequirements(lead, requiredKeys, dto.stageFields);
      if (missingFields.length > 0) {
        throw new BadRequestException({
          message: 'Required fields missing for this stage',
          missingFields: missingFields.map(key => {
            const row = stageFieldRows.find((f: any) => f.field_key === key);
            return { fieldKey: key, fieldLabel: row?.field_label || key };
          }),
        });
      }
    }

    // Update stage history
    const stageHistory = lead.stageHistory || [];
    stageHistory.push({
      stageId: dto.stageId,
      stageName: targetStage.name,
      enteredAt: new Date().toISOString(),
      enteredBy: userId,
      previousStageId: lead.stageId,
      unlockReason: dto.unlockReason || null,
    });

    // Apply stage fields if provided — route to correct columns
    if (dto.stageFields && Object.keys(dto.stageFields).length > 0) {
      // Map of camelCase field keys → snake_case column names for system fields
      const systemFieldMap: Record<string, string> = {
        firstName: 'first_name', lastName: 'last_name',
        email: 'email', phone: 'phone', mobile: 'mobile',
        company: 'company', jobTitle: 'job_title', website: 'website',
        addressLine1: 'address_line1', addressLine2: 'address_line2',
        city: 'city', state: 'state', postalCode: 'postal_code', country: 'country',
        source: 'source',
      };

      const systemUpdates: string[] = [];
      const systemValues: any[] = [];
      const qualificationUpdates: Record<string, any> = {};
      const customUpdates: Record<string, any> = {};
      let paramIdx = 1;

      for (const [key, value] of Object.entries(dto.stageFields)) {
        if (key.startsWith('qualification.')) {
          // e.g. "qualification.budget" → store in qualification JSONB
          const qKey = key.replace('qualification.', '');
          qualificationUpdates[qKey] = value;
        } else if (systemFieldMap[key]) {
          // System column (email, phone, company, etc.)
          systemUpdates.push(`${systemFieldMap[key]} = $${paramIdx}`);
          systemValues.push(value);
          paramIdx++;
        } else {
          // Everything else → custom_fields JSONB
          const cleanKey = key.startsWith('custom.') ? key.replace('custom.', '') : key;
          customUpdates[cleanKey] = value;
        }
      }

      // Update system columns
      if (systemUpdates.length > 0) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".leads SET ${systemUpdates.join(', ')} WHERE id = $${paramIdx}`,
          [...systemValues, id],
        );
      }

      // Merge into qualification JSONB
      if (Object.keys(qualificationUpdates).length > 0) {
        const qualification = lead.qualification || {};
        Object.assign(qualification, qualificationUpdates);
        await this.dataSource.query(
          `UPDATE "${schemaName}".leads SET qualification = $1 WHERE id = $2`,
          [JSON.stringify(qualification), id],
        );
      }

      // Merge into custom_fields JSONB
      if (Object.keys(customUpdates).length > 0) {
        const customFields = lead.customFields || {};
        Object.assign(customFields, customUpdates);
        await this.dataSource.query(
          `UPDATE "${schemaName}".leads SET custom_fields = $1 WHERE id = $2`,
          [JSON.stringify(customFields), id],
        );
      }
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads 
       SET stage_id = $1, stage_entered_at = NOW(), stage_history = $2, 
           updated_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [dto.stageId, JSON.stringify(stageHistory), userId, id],
    );

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads 
       SET stage_id = $1, stage_entered_at = NOW(), stage_history = $2, 
           updated_by = $3, updated_at = NOW()
       WHERE id = $4`,
      [dto.stageId, JSON.stringify(stageHistory), userId, id],
    );

    // ── Record lead stage history (for dashboard analytics) ──
    try {
      const timeInStage = lead.stageEnteredAt
        ? `NOW() - '${new Date(lead.stageEnteredAt).toISOString()}'::timestamptz`
        : 'NULL';
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".lead_stage_history
         (lead_id, from_stage_id, to_stage_id, changed_by, time_in_stage, note)
         VALUES ($1, $2, $3, $4, ${timeInStage}, $5)`,
        [
          id,
          lead.stageId || null,
          dto.stageId,
          userId,
          dto.unlockReason || `Stage changed to ${targetStage.name}`,
        ],
      );
    } catch (err) {
      this.logger.warn(`Failed to record lead stage history: ${err}`);
    }

    // Activity log
    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: id,
      activityType: 'stage_changed',
      title: 'Stage changed',
      description: `Stage changed from "${currentStage?.name || 'None'}" to "${targetStage.name}"`,
      metadata: { fromStage: currentStage?.name, toStage: targetStage.name },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: id,
      action: 'update',
      changes: { stage: { from: currentStage?.name, to: targetStage.name } },
      performedBy: userId,
    });

    // Record stage assignment for stage ownership tracking
    try {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".record_stage_assignments
           (entity_type, entity_id, stage_id, assigned_to, assigned_by)
         VALUES ($1, $2, $3, $4, $5)`,
        ['leads', id, dto.stageId, lead.ownerId || null, userId],
      );
    } catch (err) {
      this.logger.warn(`Failed to record stage assignment: ${err}`);
    }

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // DISQUALIFY LEAD
  // ============================================================
  async disqualify(schemaName: string, id: string, userId: string, dto: DisqualifyLeadDto) {
    const lead = await this.findOneRaw(schemaName, id);

    if (lead.convertedAt) {
      throw new BadRequestException('Cannot disqualify a converted lead');
    }

    // Get disqualified stage
    const [disqStage] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".pipeline_stages WHERE is_lost = true AND is_active = true LIMIT 1`,
    );

    const stageHistory = lead.stageHistory || [];
    stageHistory.push({
      stageId: disqStage?.id,
      stageName: 'Disqualified',
      enteredAt: new Date().toISOString(),
      enteredBy: userId,
      previousStageId: lead.stageId,
    });

    // Record stage history for disqualification
    try {
      const timeInStage = lead.stageEnteredAt
        ? `NOW() - '${new Date(lead.stageEnteredAt).toISOString()}'::timestamptz`
        : 'NULL';
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".lead_stage_history
         (lead_id, from_stage_id, to_stage_id, changed_by, time_in_stage, note)
         VALUES ($1, $2, $3, $4, ${timeInStage}, $5)`,
        [id, lead.stageId || null, disqStage?.id, userId, dto.notes || 'Lead disqualified'],
      );
    } catch (err) {
      this.logger.warn(`Failed to record lead stage history: ${err}`);
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET stage_id = $1, disqualified_at = NOW(), disqualified_by = $2,
           disqualification_reason_id = $3, disqualification_notes = $4,
           stage_history = $5, updated_by = $2, updated_at = NOW()
       WHERE id = $6`,
      [disqStage?.id, userId, dto.reasonId, dto.notes || null, JSON.stringify(stageHistory), id],
    );

    // Get reason name for activity
    const [reason] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".lead_disqualification_reasons WHERE id = $1`,
      [dto.reasonId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: id,
      activityType: 'disqualified',
      title: 'Lead disqualified',
      description: `Disqualified: ${reason?.name || 'Unknown reason'}`,
      metadata: { reason: reason?.name, notes: dto.notes },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: id,
      action: 'update',
      changes: { status: { from: 'active', to: 'disqualified' } },
      performedBy: userId,
    });

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // CONVERSION DUPLICATE CHECK
  // ============================================================
  async checkConversionDuplicates(schemaName: string, id: string) {
    const lead = await this.findOneRaw(schemaName, id);

    const matchingContacts: any[] = [];
    const matchingAccounts: any[] = [];
    const relationships: Record<string, string[]> = {}; // contactId -> accountId[]

    // ── 1. Find matching contacts by email, phone, mobile ──
    if (lead.email) {
      const emailLower = lead.email.toLowerCase().trim();
      const rows = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, mobile, company, job_title, avatar_url
         FROM "${schemaName}".contacts
         WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 10`,
        [emailLower],
      );
      for (const c of rows) {
        if (!matchingContacts.find(mc => mc.id === c.id)) {
          matchingContacts.push({
            id: c.id, firstName: c.first_name, lastName: c.last_name,
            email: c.email, phone: c.phone, mobile: c.mobile,
            company: c.company, jobTitle: c.job_title, avatarUrl: c.avatar_url,
            matchType: 'email',
          });
        }
      }
    }

    if (lead.phone) {
      const rows = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, mobile, company, job_title, avatar_url
         FROM "${schemaName}".contacts
         WHERE (phone = $1 OR mobile = $1) AND deleted_at IS NULL LIMIT 10`,
        [lead.phone],
      );
      for (const c of rows) {
        const existing = matchingContacts.find(mc => mc.id === c.id);
        if (existing) { if (!existing.matchType.includes('phone')) existing.matchType += ',phone'; }
        else {
          matchingContacts.push({
            id: c.id, firstName: c.first_name, lastName: c.last_name,
            email: c.email, phone: c.phone, mobile: c.mobile,
            company: c.company, jobTitle: c.job_title, avatarUrl: c.avatar_url,
            matchType: 'phone',
          });
        }
      }
    }

    if (lead.mobile && lead.mobile !== lead.phone) {
      const rows = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, mobile, company, job_title, avatar_url
         FROM "${schemaName}".contacts
         WHERE (phone = $1 OR mobile = $1) AND deleted_at IS NULL LIMIT 10`,
        [lead.mobile],
      );
      for (const c of rows) {
        const existing = matchingContacts.find(mc => mc.id === c.id);
        if (existing) { if (!existing.matchType.includes('mobile')) existing.matchType += ',mobile'; }
        else {
          matchingContacts.push({
            id: c.id, firstName: c.first_name, lastName: c.last_name,
            email: c.email, phone: c.phone, mobile: c.mobile,
            company: c.company, jobTitle: c.job_title, avatarUrl: c.avatar_url,
            matchType: 'mobile',
          });
        }
      }
    }

    // ── 2. Find matching accounts by company name, website, email domain ──
    if (lead.company) {
      const rows = await this.dataSource.query(
        `SELECT id, name, website, industry, logo_url, account_type
         FROM "${schemaName}".accounts
         WHERE lower(name) = lower($1) AND deleted_at IS NULL LIMIT 10`,
        [lead.company],
      );
      for (const a of rows) {
        if (!matchingAccounts.find(ma => ma.id === a.id)) {
          matchingAccounts.push({
            id: a.id, name: a.name, website: a.website,
            industry: a.industry, logoUrl: a.logo_url, accountType: a.account_type,
            matchType: 'name',
          });
        }
      }
    }

    if (lead.website) {
      const rows = await this.dataSource.query(
        `SELECT id, name, website, industry, logo_url, account_type
         FROM "${schemaName}".accounts
         WHERE lower(website) = lower($1) AND deleted_at IS NULL LIMIT 10`,
        [lead.website],
      );
      for (const a of rows) {
        const existing = matchingAccounts.find(ma => ma.id === a.id);
        if (existing) { if (!existing.matchType.includes('website')) existing.matchType += ',website'; }
        else {
          matchingAccounts.push({
            id: a.id, name: a.name, website: a.website,
            industry: a.industry, logoUrl: a.logo_url, accountType: a.account_type,
            matchType: 'website',
          });
        }
      }
    }

    if (lead.email) {
      const domain = lead.email.split('@')[1];
      const freeProviders = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','aol.com','icloud.com','mail.com'];
      if (domain && !freeProviders.includes(domain.toLowerCase())) {
        const rows = await this.dataSource.query(
          `SELECT id, name, website, industry, logo_url, account_type
           FROM "${schemaName}".accounts
           WHERE website ILIKE $1 AND deleted_at IS NULL LIMIT 5`,
          [`%${domain}%`],
        );
        for (const a of rows) {
          const existing = matchingAccounts.find(ma => ma.id === a.id);
          if (existing) { if (!existing.matchType.includes('domain')) existing.matchType += ',domain'; }
          else {
            matchingAccounts.push({
              id: a.id, name: a.name, website: a.website,
              industry: a.industry, logoUrl: a.logo_url, accountType: a.account_type,
              matchType: 'domain',
            });
          }
        }
      }
    }

    // ── 3. Find relationships between matched contacts and accounts ──
    const contactIds = matchingContacts.map(c => c.id);

    if (contactIds.length > 0) {
      // Get all account links for these contacts
      const rels = await this.dataSource.query(
        `SELECT ca.contact_id, ca.account_id, ca.role, ca.is_primary,
                a.name as account_name, a.website as account_website, a.industry as account_industry,
                a.logo_url as account_logo_url, a.account_type
         FROM "${schemaName}".contact_accounts ca
         JOIN "${schemaName}".accounts a ON a.id = ca.account_id AND a.deleted_at IS NULL
         WHERE ca.contact_id = ANY($1)`,
        [contactIds],
      );
      for (const r of rels) {
        if (!relationships[r.contact_id]) relationships[r.contact_id] = [];
        relationships[r.contact_id].push(r.account_id);

        // Add linked account to matchingAccounts if not already there
        if (!matchingAccounts.find(ma => ma.id === r.account_id)) {
          matchingAccounts.push({
            id: r.account_id, name: r.account_name, website: r.account_website,
            industry: r.account_industry, logoUrl: r.account_logo_url,
            accountType: r.account_type, matchType: 'linked',
          });
        }
      }
    }

    return {
      lead: {
        firstName: lead.firstName, lastName: lead.lastName,
        email: lead.email, phone: lead.phone, mobile: lead.mobile,
        company: lead.company, website: lead.website,
      },
      matchingContacts,
      matchingAccounts,
      relationships,
      hasMatches: matchingContacts.length > 0 || matchingAccounts.length > 0,
    };
  }

  // ============================================================
  // CONVERT LEAD
  // ============================================================
  async convert(schemaName: string, id: string, userId: string, dto: ConvertLeadDto) {
    const lead = await this.findOneRaw(schemaName, id);

    if (lead.convertedAt) {
      throw new BadRequestException('Lead has already been converted');
    }
    if (lead.disqualifiedAt) {
      throw new BadRequestException('Cannot convert a disqualified lead');
    }

    const ownerId = dto.newOwnerId || lead.ownerId || userId;
    const teamId = dto.teamId || lead.teamId || null;
    let contactId: string | null = null;
    let accountId: string | null = null;
    let opportunityId: string | null = null;

    // ── 1. Create or Merge Contact ──
    if (dto.contactAction === 'create_new') {
      const [contact] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".contacts (
          first_name, last_name, email, phone, mobile, company, job_title, website,
          address_line1, address_line2, city, state, postal_code, country,
          emails, phones, addresses, social_profiles,
          source, tags, custom_fields, owner_id, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        RETURNING id`,
        [
          lead.firstName, lead.lastName, lead.email, lead.phone, lead.mobile,
          lead.company, lead.jobTitle, lead.website,
          lead.addressLine1, lead.addressLine2, lead.city, lead.state, lead.postalCode, lead.country,
          JSON.stringify(lead.emails || []),
          JSON.stringify(lead.phones || []),
          JSON.stringify(lead.addresses || []),
          JSON.stringify(lead.socialProfiles || {}),
          lead.source,
          lead.tags || [],
          JSON.stringify(lead.customFields || {}),
          ownerId,
          userId,
        ],
      );
      contactId = contact.id;
    } else if (dto.contactAction === 'merge_existing' && dto.existingContactId) {
      contactId = dto.existingContactId;
    }

    // ── 2. Create or Link Account ──
    if (dto.accountAction === 'create_new') {
      const accountName = dto.accountName || lead.company || `${lead.firstName || ''} ${lead.lastName}`.trim();
      const [account] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".accounts (name, website, owner_id, created_at)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [accountName, lead.website || null, ownerId],
      );
      accountId = account.id;
    } else if (dto.accountAction === 'link_existing' && dto.existingAccountId) {
      accountId = dto.existingAccountId;
    }

    // Link contact to account
    if (contactId && accountId) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".contact_accounts (contact_id, account_id, role, is_primary)
         VALUES ($1, $2, 'Primary Contact', true)
         ON CONFLICT (contact_id, account_id) DO NOTHING`,
        [contactId, accountId],
      );
    }

    // ── 3. Create Opportunity (placeholder — will integrate when opportunities module is built) ──
    // ── 3. Create Opportunity ──
    if (dto.createOpportunity) {
      const [tableExists] = await this.dataSource.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'opportunities'
        ) as exists`,
        [schemaName],
      );

      if (tableExists?.exists) {
        // Resolve pipeline: use provided, or find default
        let oppPipelineId = dto.pipelineId || null;
        let oppStageId = dto.opportunityStageId || null;

        if (!oppPipelineId) {
          const [defaultPipeline] = await this.dataSource.query(
            `SELECT id FROM "${schemaName}".pipelines WHERE is_default = true AND is_active = true LIMIT 1`,
          );
          oppPipelineId = defaultPipeline?.id || null;
        }

        // Resolve stage: use provided, or get first opportunity stage in the pipeline
        if (!oppStageId && oppPipelineId) {
          const [firstStage] = await this.dataSource.query(
            `SELECT id, probability FROM "${schemaName}".pipeline_stages 
             WHERE pipeline_id = $1 AND module = 'opportunities' 
               AND is_won = false AND is_lost = false AND is_active = true
             ORDER BY sort_order ASC LIMIT 1`,
            [oppPipelineId],
          );
          oppStageId = firstStage?.id || null;
        }

        // Get stage probability for the resolved stage
        let stageProbability = null;
        if (oppStageId) {
          const [stageInfo] = await this.dataSource.query(
            `SELECT probability FROM "${schemaName}".pipeline_stages WHERE id = $1`,
            [oppStageId],
          );
          stageProbability = stageInfo?.probability ?? null;
        }

        const [opp] = await this.dataSource.query(
          `INSERT INTO "${schemaName}".opportunities (
            name, account_id, primary_contact_id, owner_id, team_id, amount, close_date,
            pipeline_id, stage_id, probability, forecast_category,
            type, source, industry, lead_id, created_by, stage_entered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          RETURNING id`,
          [
            dto.opportunityName || `${lead.company || lead.lastName} - Opportunity`,
            accountId,
            contactId,
            ownerId,
            teamId,
            dto.amount || null,
            dto.closeDate || null,
            oppPipelineId,
            oppStageId,
            stageProbability,
            'Pipeline',                       // default forecast category
            'New Business',                   // default type for converted leads
            lead.source || null,              // carry over lead source
            lead.industry || null,            // carry over lead industry
            id,                               // lead_id — links back to original lead
            userId,
          ],
        );
        opportunityId = opp?.id || null;

        // Copy lead products → opportunity line items
        if (opportunityId) {
          const leadProducts = await this.dataSource.query(
            `SELECT lp.product_id, lp.notes,
                    p.name, p.base_price, p.currency, p.short_description
             FROM "${schemaName}".lead_products lp
             JOIN "${schemaName}".products p ON lp.product_id = p.id AND p.deleted_at IS NULL
             WHERE lp.lead_id = $1
             ORDER BY lp.created_at ASC`,
            [id],
          );

          for (let i = 0; i < leadProducts.length; i++) {
            const lp = leadProducts[i];
            const unitPrice = parseFloat(lp.base_price) || 0;
            await this.dataSource.query(
              `INSERT INTO "${schemaName}".opportunity_line_items (
                opportunity_id, product_id, description, quantity,
                unit_price, total_price, sort_order, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
              [
                opportunityId,
                lp.product_id,
                lp.notes || lp.short_description || null,
                1,           // default quantity = 1
                unitPrice,
                unitPrice,   // total = unit_price × 1
                i + 1,       // sort_order
              ],
            );
          }

          // Update opportunity amount to sum of line items if not explicitly set
          if (!dto.amount && leadProducts.length > 0) {
            await this.dataSource.query(
              `UPDATE "${schemaName}".opportunities
               SET amount = (
                 SELECT COALESCE(SUM(total_price), 0)
                 FROM "${schemaName}".opportunity_line_items
                 WHERE opportunity_id = $1
               )
               WHERE id = $1`,
              [opportunityId],
            );
          }
        }
        
        // Log activity on the new opportunity
        if (opportunityId) {
          await this.activityService.create(schemaName, {
            entityType: 'opportunities',
            entityId: opportunityId,
            activityType: 'created',
            title: 'Opportunity created from lead conversion',
            metadata: { leadId: id, leadName: `${lead.firstName} ${lead.lastName}` },
            performedBy: userId,
          });
        }
      } else {
        this.logger.warn('Opportunities table does not exist yet — skipping opportunity creation');
      }
    }

    // ── 4. Get converted stage ──
    const [convStage] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".pipeline_stages WHERE is_won = true AND is_active = true LIMIT 1`,
    );

    // ── 5. Update lead as converted ──
    const stageHistory = lead.stageHistory || [];
    stageHistory.push({
      stageId: convStage?.id,
      stageName: 'Converted',
      enteredAt: new Date().toISOString(),
      enteredBy: userId,
      previousStageId: lead.stageId,
    });

    // Record stage history for conversion
    try {
      const timeInStage = lead.stageEnteredAt
        ? `NOW() - '${new Date(lead.stageEnteredAt).toISOString()}'::timestamptz`
        : 'NULL';
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".lead_stage_history
         (lead_id, from_stage_id, to_stage_id, changed_by, time_in_stage, note)
         VALUES ($1, $2, $3, $4, ${timeInStage}, $5)`,
        [id, lead.stageId || null, convStage?.id, userId, 'Lead converted'],
      );
    } catch (err) {
      this.logger.warn(`Failed to record lead stage history: ${err}`);
    }

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET converted_at = NOW(), converted_by = $1,
           converted_contact_id = $2, converted_account_id = $3, converted_opportunity_id = $4,
           conversion_notes = $5,
           stage_id = $6, stage_history = $7,
           updated_by = $1, updated_at = NOW()
       WHERE id = $8`,
      [
        userId, contactId, accountId, opportunityId,
        dto.notes || null,
        convStage?.id, JSON.stringify(stageHistory), id,
      ],
    );

    // ── 6. Copy activities, notes, documents if configured ──
    const [convSettings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'conversion'`,
    );
    const convConfig = convSettings?.setting_value || {};

    if (contactId) {
      if (convConfig.copyActivities !== false) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".activities (entity_type, entity_id, activity_type, title, description, metadata, performed_by, created_at)
           SELECT 'contacts', $2, activity_type, title, description, metadata, performed_by, created_at
           FROM "${schemaName}".activities
           WHERE entity_type = 'leads' AND entity_id = $1`,
          [id, contactId],
        );
      }

      if (convConfig.copyNotes !== false) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".notes (entity_type, entity_id, content, created_by, created_at)
           SELECT 'contacts', $2, content, created_by, created_at
           FROM "${schemaName}".notes
           WHERE entity_type = 'leads' AND entity_id = $1`,
          [id, contactId],
        );
      }

      if (convConfig.copyDocuments !== false) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".documents (entity_type, entity_id, name, original_name, mime_type, size_bytes, storage_path, storage_url, uploaded_by, created_at)
           SELECT 'contacts', $2, name, original_name, mime_type, size_bytes, storage_path, storage_url, uploaded_by, created_at
           FROM "${schemaName}".documents
           WHERE entity_type = 'leads' AND entity_id = $1`,
          [id, contactId],
        );
      }
    }

    // ── 7. Activity log ──
    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: id,
      activityType: 'converted',
      title: 'Lead converted',
      description: `Converted to contact${accountId ? ' + account' : ''}${opportunityId ? ' + opportunity' : ''}`,
      metadata: { contactId, accountId, opportunityId },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: id,
      action: 'update',
      changes: { status: { from: 'active', to: 'converted' } },
      performedBy: userId,
    });

    const convertedLead = await this.findOne(schemaName, id);
    this.workflowRunner.trigger(schemaName, 'leads', 'lead_converted', id, { ...convertedLead, contactId, accountId, opportunityId }).catch(() => {});
    return {
      lead: convertedLead,
      contactId,
      accountId,
      opportunityId,
    };
  }

  // ============================================================
  // DELETE (soft)
  // ============================================================
  async remove(schemaName: string, id: string, userId: string) {
    const existing = await this.findOneRaw(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".leads SET deleted_at = NOW(), updated_by = $1 WHERE id = $2`,
      [userId, id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: id,
      activityType: 'deleted',
      title: 'Lead deleted',
      description: `Lead "${existing.firstName || ''} ${existing.lastName}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: existing,
      performedBy: userId,
    });

    return { message: 'Lead deleted successfully' };
  }

  // ============================================================
  // DUPLICATE DETECTION
  // ============================================================
  async checkDuplicates(
    schemaName: string,
    email: string | null | undefined,
    phone: string | null | undefined,
    excludeId: string | null,
  ) {
    const safeExcludeId = excludeId && excludeId.trim() ? excludeId : null;
    // Get duplicate detection settings
    const [dupSettings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'duplicateDetection'`,
    );
    const config = dupSettings?.setting_value || {};
    if (!config.enabled) return;

    if (email) {
      const emailLower = email.toLowerCase().trim();

      // Check leads
      if (config.checkLeads) {
        const [dup] = await this.dataSource.query(
          `SELECT id, first_name, last_name FROM "${schemaName}".leads 
           WHERE lower(email) = $1 AND deleted_at IS NULL ${safeExcludeId ? 'AND id != $2' : ''}
           LIMIT 1`,
          safeExcludeId ? [emailLower, safeExcludeId] : [emailLower],
        );
        if (dup && config.exactEmailMatch === 'block') {
          throw new ConflictException({
            message: `A lead with email "${email}" already exists: ${dup.first_name} ${dup.last_name}`,
            duplicateType: 'lead',
            duplicateId: dup.id,
          });
        }
      }

      // Check contacts
      if (config.checkContacts) {
        const [dup] = await this.dataSource.query(
          `SELECT id, first_name, last_name FROM "${schemaName}".contacts 
           WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
          [emailLower],
        );
        if (dup && config.exactEmailMatch === 'block') {
          throw new ConflictException({
            message: `A contact with email "${email}" already exists: ${dup.first_name} ${dup.last_name}`,
            duplicateType: 'contact',
            duplicateId: dup.id,
          });
        }
      }
    }

    if (phone) {
      // Check leads
      if (config.checkLeads) {
        const [dup] = await this.dataSource.query(
          `SELECT id, first_name, last_name FROM "${schemaName}".leads 
           WHERE phone = $1 AND deleted_at IS NULL ${safeExcludeId ? 'AND id != $2' : ''}
           LIMIT 1`,
          safeExcludeId ? [phone, safeExcludeId] : [phone],
        );
        if (dup && config.exactPhoneMatch === 'block') {
          throw new ConflictException({
            message: `A lead with phone "${phone}" already exists: ${dup.first_name} ${dup.last_name}`,
            duplicateType: 'lead',
            duplicateId: dup.id,
          });
        }
      }

      // Check contacts
      if (config.checkContacts) {
        const [dup] = await this.dataSource.query(
          `SELECT id, first_name, last_name FROM "${schemaName}".contacts 
           WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
          [phone],
        );
        if (dup && config.exactPhoneMatch === 'block') {
          throw new ConflictException({
            message: `A contact with phone "${phone}" already exists: ${dup.first_name} ${dup.last_name}`,
            duplicateType: 'contact',
            duplicateId: dup.id,
          });
        }
      }
    }
  }

  // Find duplicates for sidebar display
  async findDuplicates(schemaName: string, email: string | null, phone: string | null, excludeId: string | null) {
    const safeExcludeId = excludeId && excludeId.trim() ? excludeId : null;
    const duplicates: any[] = [];

    if (email) {
      const emailLower = email.toLowerCase().trim();

      // Leads
      const leadDups = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, company, 'lead' as entity_type
         FROM "${schemaName}".leads
         WHERE phone = $1 AND deleted_at IS NULL ${safeExcludeId ? 'AND id != $2' : ''} LIMIT 5`,
        safeExcludeId ? [phone, safeExcludeId] : [phone],
      );
      duplicates.push(...leadDups.map((d: any) => ({
        id: d.id, firstName: d.first_name, lastName: d.last_name,
        email: d.email, company: d.company, entityType: d.entity_type,
        matchType: 'email',
      })));

      // Contacts
      const contactDups = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, company, 'contact' as entity_type
         FROM "${schemaName}".contacts
         WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 5`,
        [emailLower],
      );
      duplicates.push(...contactDups.map((d: any) => ({
        id: d.id, firstName: d.first_name, lastName: d.last_name,
        email: d.email, company: d.company, entityType: d.entity_type,
        matchType: 'email',
      })));
    }

    if (phone) {
      // Leads
      const leadPhoneDups = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, company, 'lead' as entity_type
         FROM "${schemaName}".leads
         WHERE phone = $1 AND deleted_at IS NULL AND id != $2 LIMIT 5`,
        [phone, excludeId],
      );
      for (const d of leadPhoneDups) {
        if (!duplicates.find(x => x.id === d.id)) {
          duplicates.push({
            id: d.id, firstName: d.first_name, lastName: d.last_name,
            email: d.email, company: d.company, entityType: 'lead',
            matchType: 'phone',
          });
        }
      }

      // Contacts
      const contactPhoneDups = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, phone, company, 'contact' as entity_type
         FROM "${schemaName}".contacts
         WHERE phone = $1 AND deleted_at IS NULL LIMIT 5`,
        [phone],
      );
      for (const d of contactPhoneDups) {
        if (!duplicates.find(x => x.id === d.id)) {
          duplicates.push({
            id: d.id, firstName: d.first_name, lastName: d.last_name,
            email: d.email, company: d.company, entityType: 'contact',
            matchType: 'phone',
          });
        }
      }
    }

    // Check accounts by company name
    if (email) {
      const domain = email.split('@')[1];
      if (domain) {
        const accountDups = await this.dataSource.query(
          `SELECT id, name, website, industry, 'account' as entity_type
           FROM "${schemaName}".accounts
           WHERE (website ILIKE $1 OR lower(name) ILIKE $2) AND deleted_at IS NULL LIMIT 3`,
          [`%${domain}%`, `%${domain.split('.')[0]}%`],
        );
        duplicates.push(...accountDups.map((d: any) => ({
          id: d.id, name: d.name, website: d.website, industry: d.industry,
          entityType: 'account', matchType: 'domain',
        })));
      }
    }

    return duplicates;
  }

  // ============================================================
  // OWNERSHIP CHANGE
  // ============================================================
  private async handleOwnershipChange(
    schemaName: string,
    leadId: string,
    previousOwnerId: string | null,
    newOwnerId: string,
    changedBy: string,
  ) {
    if (!previousOwnerId || previousOwnerId === newOwnerId) return;

    const [ownershipSettings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'ownership'`,
    );
    const config = ownershipSettings?.setting_value || {};

    if (config.addPreviousOwnerToTeam) {
      // Get role ID by name
      const roleName = config.previousOwnerRole || 'Lead Generator';
      const [role] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".record_team_roles WHERE name = $1 LIMIT 1`,
        [roleName],
      );

      await this.recordTeamService.addMember(schemaName, {
        entityType: 'leads',
        entityId: leadId,
        userId: previousOwnerId,
        roleId: role?.id || null,
        roleName,
        accessLevel: config.previousOwnerAccess || 'read',
        addedBy: changedBy,
      });
    }

    // Log ownership change activity
    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: leadId,
      activityType: 'owner_changed',
      title: 'Owner changed',
      metadata: { previousOwnerId, newOwnerId },
      performedBy: changedBy,
    });

    // Notify new owner
    this.notificationService.notify(schemaName, {
      userId: newOwnerId,
      eventType: 'lead_assigned',
      title: 'Lead assigned to you',
      body: 'A lead has been assigned to you.',
      icon: 'user-plus',
      actionUrl: `/leads/${leadId}`,
      entityType: 'leads',
      entityId: leadId,
    }).catch(err => this.logger.error(`Failed to notify lead assignment: ${err.message}`));
  }

  // ============================================================
  // AUTO SET PRIORITY FROM SCORE
  // ============================================================
  private async autoSetPriority(schemaName: string, leadId: string, score: number) {
    const [settings] = await this.dataSource.query(
      `SELECT setting_value FROM "${schemaName}".lead_settings WHERE setting_key = 'general'`,
    );
    const config = settings?.setting_value || {};
    if (!config.autoPriorityFromScore) return;

    const [matchedPriority] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".lead_priorities
       WHERE is_active = true AND score_min IS NOT NULL AND score_max IS NOT NULL
       AND $1 >= score_min AND $1 <= score_max
       ORDER BY sort_order ASC LIMIT 1`,
      [score],
    );

    if (matchedPriority) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".leads SET priority_id = $1 WHERE id = $2`,
        [matchedPriority.id, leadId],
      );
    }
  }

  // ============================================================
  // VALIDATE STAGE REQUIREMENTS
  // ============================================================
  private validateStageRequirements(
    lead: Record<string, any>,
    requiredFields: string[],
    providedFields?: Record<string, unknown>,
  ): string[] {
    const missing: string[] = [];

    for (const req of requiredFields) {
      // OR conditions: "email||phone" means email OR phone must be filled
      if (req.includes('||')) {
        const alternatives = req.split('||');
        const hasAny = alternatives.some(f => {
          const val = lead[f] || providedFields?.[f];
          return val !== null && val !== undefined && String(val).trim() !== '';
        });
        if (!hasAny) missing.push(req);
      } else {
        // Check lead field or qualification or custom fields
        let value = lead[req] || lead.qualification?.[req] || lead.customFields?.[req] || providedFields?.[req];
        if (value === null || value === undefined || String(value).trim() === '') {
          missing.push(req);
        }
      }
    }

    return missing;
  }

  // ============================================================
  // FORMAT LEAD
  // ============================================================
  private formatLead(lead: Record<string, unknown>): any {
    return {
      id: lead.id,
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      mobile: lead.mobile,
      company: lead.company,
      jobTitle: lead.job_title,
      website: lead.website,
      addressLine1: lead.address_line1,
      addressLine2: lead.address_line2,
      city: lead.city,
      state: lead.state,
      postalCode: lead.postal_code,
      country: lead.country,
      countryCode: lead.country_code || null,
      phoneCountryCode: lead.phone_country_code || null,
      mobileCountryCode: lead.mobile_country_code || null,
      emails: typeof lead.emails === 'string' ? JSON.parse(lead.emails as string) : (lead.emails || []),
      phones: typeof lead.phones === 'string' ? JSON.parse(lead.phones as string) : (lead.phones || []),
      addresses: typeof lead.addresses === 'string' ? JSON.parse(lead.addresses as string) : (lead.addresses || []),
      socialProfiles: typeof lead.social_profiles === 'string' ? JSON.parse(lead.social_profiles as string) : (lead.social_profiles || {}),
      industry: lead.industry,
      source: lead.source,
      sourceDetails: typeof lead.source_details === 'string' ? JSON.parse(lead.source_details as string) : (lead.source_details || {}),
      pipelineId: lead.pipeline_id,
      pipeline: lead.pipeline_name ? {
        id: lead.pipeline_id,
        name: lead.pipeline_name,
        stageMovement: lead.stage_movement || 'free',
      } : null,
      stageId: lead.stage_id,
      stageName: (lead.stage_name as string) || null,
      stage: lead.stage_name ? {
        id: lead.stage_id,
        name: lead.stage_name,
        slug: lead.stage_slug,
        color: lead.stage_color,
        sortOrder: lead.stage_sort_order,
        isWon: lead.stage_is_won,
        isLost: lead.stage_is_lost,
      } : null,
      priorityId: lead.priority_id,
      priorityName: (lead.priority_name as string) || null,
      priority: lead.priority_name ? {
        id: lead.priority_id,
        name: lead.priority_name,
        color: lead.priority_color,
        icon: lead.priority_icon,
      } : null,
      score: lead.score || 0,
      scoreBreakdown: typeof lead.score_breakdown === 'string' ? JSON.parse(lead.score_breakdown as string) : (lead.score_breakdown || {}),
      qualification: typeof lead.qualification === 'string' ? JSON.parse(lead.qualification as string) : (lead.qualification || {}),
      qualificationFrameworkId: lead.qualification_framework_id,
      qualificationFramework: lead.framework_name ? {
        id: lead.qualification_framework_id,
        name: lead.framework_name,
        slug: lead.framework_slug,
      } : null,
      convertedAt: lead.converted_at,
      convertedBy: lead.converted_by,
      convertedContactId: lead.converted_contact_id,
      convertedAccountId: lead.converted_account_id,
      convertedOpportunityId: lead.converted_opportunity_id,
      conversionNotes: lead.conversion_notes,
      disqualifiedAt: lead.disqualified_at,
      disqualifiedBy: lead.disqualified_by,
      disqualificationReasonId: lead.disqualification_reason_id,
      disqualificationReasonName: lead.disqualification_reason_name,
      disqualificationNotes: lead.disqualification_notes,
      // SLA
      slaFirstContactDueAt: lead.sla_first_contact_due_at || null,
      slaFirstContactMetAt: lead.sla_first_contact_met_at || null,
      slaBreached: lead.sla_breached || false,
      slaBreachedAt: lead.sla_breached_at || null,
      slaEscalated: lead.sla_escalated || false,
      slaEscalatedAt: lead.sla_escalated_at || null,
      stageEnteredAt: lead.stage_entered_at,
      stageHistory: typeof lead.stage_history === 'string' ? JSON.parse(lead.stage_history as string) : (lead.stage_history || []),
      doNotContact: lead.do_not_contact,
      doNotEmail: lead.do_not_email,
      doNotCall: lead.do_not_call,
      tags: lead.tags,
      customFields: typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields as string) : (lead.custom_fields || {}),
      ownerId: lead.owner_id,
      ownerName: lead.owner_first_name ? `${lead.owner_first_name} ${lead.owner_last_name || ''}`.trim() : null,
      owner: lead.owner_first_name ? {
        id: lead.owner_id,
        firstName: lead.owner_first_name,
        lastName: lead.owner_last_name,
      } : null,
      teamId: lead.team_id || null,
      team: lead.team_name ? {
        id: lead.team_id,
        name: lead.team_name,
      } : null,
      createdBy: lead.created_by,
      createdByUser: lead.created_by_first_name ? {
        id: lead.created_by,
        firstName: lead.created_by_first_name,
        lastName: lead.created_by_last_name,
      } : null,
      contactId: lead.contact_id || null,
      contact: lead.linked_contact_first_name ? {
        id: lead.contact_id,
        firstName: lead.linked_contact_first_name,
        lastName: lead.linked_contact_last_name,
        email: lead.linked_contact_email || null,
      } : null,
      accountId: lead.account_id || null,
      account: lead.linked_account_name ? {
        id: lead.account_id,
        name: lead.linked_account_name,
        email: Array.isArray(lead.linked_account_emails) && lead.linked_account_emails.length > 0
          ? lead.linked_account_emails[0]
          : null,
      } : null,
      lastActivityAt: lead.last_activity_at,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      productsCount: parseInt(String(lead.products_count || '0')),
    };
  }

  // ============================================================
  // LEAD PRODUCTS
  // ============================================================

  async getLeadProducts(schemaName: string, leadId: string) {
    // Verify lead exists
    await this.findOneRaw(schemaName, leadId);

    const products = await this.dataSource.query(
      `SELECT lp.id as link_id, lp.notes, lp.created_at as linked_at,
              p.id, p.name, p.code, p.short_description, p.type, p.base_price, 
              p.currency, p.status, p.image_url,
              pc.name as category_name,
              u.first_name as linked_by_first, u.last_name as linked_by_last
       FROM "${schemaName}".lead_products lp
       JOIN "${schemaName}".products p ON lp.product_id = p.id
       LEFT JOIN "${schemaName}".product_categories pc ON p.category_id = pc.id
       LEFT JOIN "${schemaName}".users u ON lp.created_by = u.id
       WHERE lp.lead_id = $1 AND p.deleted_at IS NULL
       ORDER BY lp.created_at DESC`,
      [leadId],
    );

    return products.map((row: Record<string, unknown>) => ({
      linkId: row.link_id,
      notes: row.notes,
      linkedAt: row.linked_at,
      linkedBy: row.linked_by_first ? `${row.linked_by_first} ${row.linked_by_last}` : null,
      product: {
        id: row.id,
        name: row.name,
        code: row.code,
        shortDescription: row.short_description,
        type: row.type,
        basePrice: parseFloat(String(row.base_price || '0')),
        currency: row.currency,
        status: row.status,
        imageUrl: row.image_url,
        categoryName: row.category_name,
      },
    }));
  }

  async linkProduct(
    schemaName: string,
    leadId: string,
    productId: string,
    userId: string,
    notes?: string,
  ) {
    // Verify lead and product exist
    await this.findOneRaw(schemaName, leadId);

    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".products WHERE id = $1 AND deleted_at IS NULL`,
      [productId],
    );
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_products (lead_id, product_id, notes, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lead_id, product_id) DO UPDATE SET notes = $3`,
      [leadId, productId, notes || null, userId],
    );

    // Get product name for activity log
    const [product] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".products WHERE id = $1`,
      [productId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: leadId,
      activityType: 'product_linked',
      title: 'Product linked',
      description: `Product "${product?.name}" was linked to this lead`,
      relatedType: 'products',
      relatedId: productId,
      performedBy: userId,
    });

    return { message: 'Product linked successfully' };
  }

  async unlinkProduct(schemaName: string, leadId: string, productId: string, userId: string) {
    // Get product name before unlinking
    const [product] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".products WHERE id = $1`,
      [productId],
    );

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_products WHERE lead_id = $1 AND product_id = $2`,
      [leadId, productId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: leadId,
      activityType: 'product_unlinked',
      title: 'Product unlinked',
      description: `Product "${product?.name}" was removed from this lead`,
      relatedType: 'products',
      relatedId: productId,
      performedBy: userId,
    });

    return { message: 'Product unlinked successfully' };
  }

  async updateProductNotes(
    schemaName: string,
    leadId: string,
    productId: string,
    notes: string,
  ) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_products SET notes = $3
       WHERE lead_id = $1 AND product_id = $2`,
      [leadId, productId, notes],
    );

    return { message: 'Notes updated successfully' };
  }

  // ============================================================
  // EXPORT
  // ============================================================
  async exportData(schemaName: string, userId: string, query: any): Promise<{ buffer: Buffer; fileName: string }> {
    const { columns, sortBy = 'created_at', sortOrder = 'DESC' } = query;

    const { conditions, params, paramIndex } = this.buildFilterConditions(schemaName, query, userId);
    const whereClause = conditions.join(' AND ');

    const sortMap: Record<string, string> = {
      created_at: 'l.created_at',
      updated_at: 'l.updated_at',
      name: 'l.last_name',
      company: 'l.company',
      score: 'l.score',
      source: 'l.source',
      last_activity_at: 'l.last_activity_at',
      stage: 'ls.sort_order',
    };
    const orderColumn = sortMap[sortBy] || 'l.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT l.*,
        u.first_name as owner_first_name, u.last_name as owner_last_name,
        t.name as team_name,
        ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
        ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
        lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".teams t ON l.team_id = t.id
       LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       WHERE ${whereClause}
       ORDER BY ${orderColumn} ${order}
       LIMIT 10000`;

    const leads = await this.dataSource.query(dataQuery, params);

    const HEADER_MAP: Record<string, string> = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      mobile: 'Mobile',
      company: 'Company',
      jobTitle: 'Job Title',
      website: 'Website',
      city: 'City',
      state: 'State',
      country: 'Country',
      source: 'Source',
      industry: 'Industry',
      score: 'Score',
      stageName: 'Stage',
      priorityName: 'Priority',
      ownerName: 'Owner',
      teamName: 'Team',
      tags: 'Tags',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
    };

    const requestedColumns = columns ? columns.split(',').map((c: string) => c.trim()) : Object.keys(HEADER_MAP);
    const headers = requestedColumns.filter((c: string) => HEADER_MAP[c]).map((c: string) => HEADER_MAP[c]);

    const rows = leads.map((l: Record<string, unknown>) => {
      const formatted = this.formatLead(l);
      const row: Record<string, unknown> = {};
      for (const col of requestedColumns) {
        if (!HEADER_MAP[col]) continue;
        if (col === 'ownerName') {
          row[HEADER_MAP[col]] = formatted.owner ? `${formatted.owner.firstName} ${formatted.owner.lastName}` : '';
        } else if (col === 'teamName') {
          row[HEADER_MAP[col]] = formatted.team ? formatted.team.name : '';
        } else if (col === 'stageName') {
          row[HEADER_MAP[col]] = formatted.stage ? formatted.stage.name : '';
        } else if (col === 'priorityName') {
          row[HEADER_MAP[col]] = formatted.priority ? formatted.priority.name : '';
        } else if (col === 'tags') {
          row[HEADER_MAP[col]] = Array.isArray(formatted.tags) ? formatted.tags.join(', ') : '';
        } else {
          row[HEADER_MAP[col]] = formatted[col] ?? '';
        }
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    const buffer = await XLSX.writeAsync(wb);

    const date = new Date().toISOString().split('T')[0];
    return { buffer, fileName: `leads-export-${date}.xlsx` };
  }

  // ============================================================
  // BULK UPDATE
  // ============================================================
  async bulkUpdate(schemaName: string, userId: string, dto: BulkUpdateDto) {
    // 1. Determine target leads
    let idSubquery: string;
    let filterParams: unknown[];

    if (dto.selectAll && dto.filters) {
      const { conditions, params } = this.buildFilterConditions(schemaName, dto.filters, userId);
      const whereClause = conditions.join(' AND ');
      // Build subquery that selects IDs matching filters
      idSubquery = `SELECT l.id FROM "${schemaName}".leads l
        LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
        WHERE ${whereClause}`;
      filterParams = params;
    } else if (dto.leadIds?.length) {
      idSubquery = `SELECT unnest($1::uuid[])`;
      filterParams = [dto.leadIds];
    } else {
      throw new BadRequestException('No leads selected');
    }

    // 2. Build SET clause
    const updates: string[] = [];
    const setParams: unknown[] = [];
    // Start param index after filter params
    let paramIndex = filterParams.length + 1;

    const fieldMap: Record<string, string> = {
      ownerId: 'owner_id',
      teamId: 'team_id',
      stageId: 'stage_id',
      pipelineId: 'pipeline_id',
      priorityId: 'priority_id',
      source: 'source',
      company: 'company',
      jobTitle: 'job_title',
      website: 'website',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      doNotContact: 'do_not_contact',
      doNotEmail: 'do_not_email',
      doNotCall: 'do_not_call',
    };

    const u = dto.updates;
    for (const [key, col] of Object.entries(fieldMap)) {
      const val = (u as Record<string, any>)[key];
      if (val !== undefined) {
        updates.push(`${col} = $${paramIndex}`);
        setParams.push(val);
        paramIndex++;
      }
    }

    // Tags handling
    if (u.tags !== undefined && u.tags.length > 0) {
      if (u.tagMode === 'add') {
        // Append tags (deduplicate with ARRAY(SELECT DISTINCT ...))
        updates.push(`tags = ARRAY(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || $${paramIndex}::text[]))`);
      } else {
        updates.push(`tags = $${paramIndex}`);
      }
      setParams.push(u.tags);
      paramIndex++;
    }

    // Qualification (JSONB merge — merges into existing qualification object)
    if (u.qualification !== undefined && Object.keys(u.qualification).length > 0) {
      updates.push(`qualification = COALESCE(qualification, '{}'::jsonb) || $${paramIndex}::jsonb`);
      setParams.push(JSON.stringify(u.qualification));
      paramIndex++;
    }

    // Custom fields (JSONB merge — merges into existing custom_fields object)
    if (u.customFields !== undefined && Object.keys(u.customFields).length > 0) {
      updates.push(`custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $${paramIndex}::jsonb`);
      setParams.push(JSON.stringify(u.customFields));
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    // Add updated_by and updated_at
    updates.push(`updated_by = $${paramIndex}`);
    setParams.push(userId);
    paramIndex++;
    updates.push(`updated_at = NOW()`);

    // 3. Execute single UPDATE
    const allParams = [...filterParams, ...setParams];
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET ${updates.join(', ')}
       WHERE id IN (${idSubquery}) AND deleted_at IS NULL`,
      allParams,
    );

    const updatedCount = result[1] || 0;

    // 4. Audit
    const updatedFields = Object.entries(dto.updates)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);

    const nilUuid = '00000000-0000-0000-0000-000000000000';

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: nilUuid,
      action: 'bulk_update',
      changes: {},
      newValues: { updatedFields, updatedCount, selectAll: dto.selectAll || false },
      performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: nilUuid,
      activityType: 'bulk_updated',
      title: 'Bulk lead update',
      description: `Updated ${updatedCount} leads: ${updatedFields.join(', ')}`,
      metadata: { updatedFields, updatedCount },
      performedBy: userId,
    });

    return { updatedCount };
  }

  // ============================================================
  // BULK DELETE (soft)
  // ============================================================
  async bulkDelete(schemaName: string, userId: string, dto: { leadIds?: string[]; selectAll?: boolean; filters?: any }) {
    // 1. Determine target leads
    let idSubquery: string;
    let filterParams: unknown[];

    if (dto.selectAll && dto.filters) {
      const { conditions, params } = this.buildFilterConditions(schemaName, dto.filters, userId);
      const whereClause = conditions.join(' AND ');
      idSubquery = `SELECT l.id FROM "${schemaName}".leads l
        LEFT JOIN "${schemaName}".pipeline_stages ls ON l.stage_id = ls.id
        WHERE ${whereClause}`;
      filterParams = params;
    } else if (dto.leadIds?.length) {
      idSubquery = `SELECT unnest($1::uuid[])`;
      filterParams = [dto.leadIds];
    } else {
      throw new BadRequestException('No leads selected');
    }

    // 2. Soft delete
    let paramIndex = filterParams.length + 1;
    const allParams = [...filterParams, userId];
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".leads
       SET deleted_at = NOW(), updated_by = $${paramIndex}
       WHERE id IN (${idSubquery}) AND deleted_at IS NULL`,
      allParams,
    );

    const deletedCount = result[1] || 0;

    // 3. Audit + activity
    const nilUuid = '00000000-0000-0000-0000-000000000000';

    await this.auditService.log(schemaName, {
      entityType: 'leads',
      entityId: nilUuid,
      action: 'delete',
      changes: {},
      newValues: { deletedCount, selectAll: dto.selectAll || false },
      performedBy: userId,
    });

    await this.activityService.create(schemaName, {
      entityType: 'leads',
      entityId: nilUuid,
      activityType: 'deleted',
      title: 'Bulk lead delete',
      description: `Deleted ${deletedCount} leads`,
      metadata: { deletedCount },
      performedBy: userId,
    });

    return { deletedCount };
  }
}