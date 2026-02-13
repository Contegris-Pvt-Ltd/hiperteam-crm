// ============================================================
// FILE: apps/api/src/modules/leads/leads.service.ts
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateLeadDto, UpdateLeadDto, QueryLeadsDto, ConvertLeadDto, ChangeStageDto, DisqualifyLeadDto } from './dto';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { LeadScoringService } from './lead-scoring.service';
import { RecordTeamService } from '../shared/record-team.service';

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
  ) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(schemaName: string, userId: string, dto: CreateLeadDto) {
    // 1. Duplicate detection
    await this.checkDuplicates(schemaName, dto.email, dto.phone, null);

    // 2. Get default stage if not provided
    let stageId = dto.stageId;
    if (!stageId) {
      const [defaultStage] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".lead_stages 
         WHERE is_active = true AND is_won = false AND is_lost = false
         ORDER BY sort_order ASC LIMIT 1`,
      );
      stageId = defaultStage?.id;
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

    // 5. Determine owner (routing or explicit or creator)
    let ownerId = dto.ownerId || userId;
    const routedOwner = await this.runRoutingRules(schemaName, dto);
    if (routedOwner) {
      ownerId = routedOwner;
    }

    // 6. Insert lead
    const [lead] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".leads (
        first_name, last_name, email, phone, mobile,
        company, job_title, website,
        address_line1, address_line2, city, state, postal_code, country,
        emails, phones, addresses, social_profiles,
        source, source_details,
        stage_id, priority_id,
        qualification, qualification_framework_id,
        do_not_contact, do_not_email, do_not_call,
        tags, custom_fields,
        owner_id, created_by, updated_by,
        stage_entered_at, stage_history
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20,
        $21, $22,
        $23, $24,
        $25, $26, $27,
        $28, $29,
        $30, $31, $31,
        NOW(), $32
      ) RETURNING *`,
      [
        dto.firstName || null,
        dto.lastName,
        dto.email ? dto.email.toLowerCase().trim() : null,
        dto.phone || null,
        dto.mobile || null,
        dto.company || null,
        dto.jobTitle || null,
        dto.website || null,
        dto.addressLine1 || null,
        dto.addressLine2 || null,
        dto.city || null,
        dto.state || null,
        dto.postalCode || null,
        dto.country || null,
        JSON.stringify(dto.emails || []),
        JSON.stringify(dto.phones || []),
        JSON.stringify(dto.addresses || []),
        JSON.stringify(dto.socialProfiles || {}),
        dto.source || null,
        JSON.stringify(dto.sourceDetails || {}),
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
        userId,
        JSON.stringify([{ stageId, enteredAt: new Date().toISOString(), enteredBy: userId }]),
      ],
    );

    const formatted = this.formatLead(lead);

    // 7. Score the lead
    await this.scoringService.scoreLead(schemaName, lead.id);

    // 8. Re-fetch after scoring to get updated score
    const scored = await this.findOneRaw(schemaName, lead.id);

    // 9. Auto-set priority from score if enabled
    await this.autoSetPriority(schemaName, lead.id, scored.score);

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

    // 11. Return final formatted lead
    return this.findOne(schemaName, lead.id);
  }

  // ============================================================
  // FIND ALL (List + Kanban)
  // ============================================================
  async findAll(schemaName: string, query: QueryLeadsDto, userId?: string) {
    const {
      search, stageId, stageSlug, priorityId, source, ownerId, tag, company,
      scoreMin, scoreMax, convertedStatus, ownership, view,
      page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const conditions: string[] = ['l.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Search (name, email, company, phone)
    if (search) {
      conditions.push(`(
        l.first_name ILIKE $${paramIndex} OR l.last_name ILIKE $${paramIndex}
        OR l.email ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex}
        OR l.phone ILIKE $${paramIndex}
        OR CONCAT(l.first_name, ' ', l.last_name) ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (stageId) {
      conditions.push(`l.stage_id = $${paramIndex}`);
      params.push(stageId);
      paramIndex++;
    }

    if (stageSlug) {
      conditions.push(`ls.slug = $${paramIndex}`);
      params.push(stageSlug);
      paramIndex++;
    }

    if (priorityId) {
      conditions.push(`l.priority_id = $${paramIndex}`);
      params.push(priorityId);
      paramIndex++;
    }

    if (source) {
      conditions.push(`l.source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    if (ownerId) {
      conditions.push(`l.owner_id = $${paramIndex}`);
      params.push(ownerId);
      paramIndex++;
    }

    if (tag) {
      conditions.push(`$${paramIndex} = ANY(l.tags)`);
      params.push(tag);
      paramIndex++;
    }

    if (company) {
      conditions.push(`l.company ILIKE $${paramIndex}`);
      params.push(`%${company}%`);
      paramIndex++;
    }

    if (scoreMin !== undefined) {
      conditions.push(`l.score >= $${paramIndex}`);
      params.push(scoreMin);
      paramIndex++;
    }

    if (scoreMax !== undefined) {
      conditions.push(`l.score <= $${paramIndex}`);
      params.push(scoreMax);
      paramIndex++;
    }

    if (convertedStatus === 'converted') {
      conditions.push(`l.converted_at IS NOT NULL`);
    } else if (convertedStatus === 'disqualified') {
      conditions.push(`l.disqualified_at IS NOT NULL`);
    } else if (convertedStatus === 'active') {
      conditions.push(`l.converted_at IS NULL AND l.disqualified_at IS NULL`);
    }

    // Ownership filter (record access)
    if (ownership === 'my_leads' && userId) {
      conditions.push(`l.owner_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else if (ownership === 'created_by_me' && userId) {
      conditions.push(`l.created_by = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    } else if (ownership === 'my_team' && userId) {
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
       LEFT JOIN "${schemaName}".lead_stages ls ON l.stage_id = ls.id
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    // Query
    const leads = await this.dataSource.query(
      `SELECT l.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
              ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
              lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon,
              cu.first_name as created_by_first_name, cu.last_name as created_by_last_name
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".lead_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       LEFT JOIN "${schemaName}".users cu ON l.created_by = cu.id
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

  // ============================================================
  // KANBAN VIEW (grouped by stage)
  // ============================================================
  private async findAllKanban(schemaName: string, whereClause: string, params: unknown[]) {
    // Get all active stages
    const stages = await this.dataSource.query(
      `SELECT id, name, slug, color, sort_order, is_won, is_lost
       FROM "${schemaName}".lead_stages
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );

    // Get leads grouped by stage (limited per column)
    const leads = await this.dataSource.query(
      `SELECT l.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
              ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
              lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".lead_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       WHERE ${whereClause}
       ORDER BY ls.sort_order ASC, l.score DESC, l.created_at DESC`,
      params,
    );

    // Get counts per stage
    const counts = await this.dataSource.query(
      `SELECT l.stage_id, COUNT(*) as count
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".lead_stages ls ON l.stage_id = ls.id
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
         FROM "${schemaName}".lead_stage_fields sf
         WHERE sf.stage_id = $1 AND sf.is_visible = true
         ORDER BY sf.sort_order ASC`,
        [formatted.stageId],
      );
    }

    // Get all stages for journey bar
    const allStages = await this.dataSource.query(
      `SELECT id, name, slug, color, sort_order, is_won, is_lost, required_fields, lock_previous_fields
       FROM "${schemaName}".lead_stages
       WHERE is_active = true
       ORDER BY sort_order ASC`,
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
              ls.name as stage_name, ls.slug as stage_slug, ls.color as stage_color,
              ls.sort_order as stage_sort_order, ls.is_won as stage_is_won, ls.is_lost as stage_is_lost,
              ls.lock_previous_fields as stage_lock_previous,
              lp.name as priority_name, lp.color as priority_color, lp.icon as priority_icon,
              cu.first_name as created_by_first_name, cu.last_name as created_by_last_name,
              lqf.name as framework_name, lqf.slug as framework_slug,
              dr.name as disqualification_reason_name
       FROM "${schemaName}".leads l
       LEFT JOIN "${schemaName}".users u ON l.owner_id = u.id
       LEFT JOIN "${schemaName}".lead_stages ls ON l.stage_id = ls.id
       LEFT JOIN "${schemaName}".lead_priorities lp ON l.priority_id = lp.id
       LEFT JOIN "${schemaName}".users cu ON l.created_by = cu.id
       LEFT JOIN "${schemaName}".lead_qualification_frameworks lqf ON l.qualification_framework_id = lqf.id
       LEFT JOIN "${schemaName}".lead_disqualification_reasons dr ON l.disqualification_reason_id = dr.id
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
      source: 'source',
      stageId: 'stage_id',
      priorityId: 'priority_id',
      qualificationFrameworkId: 'qualification_framework_id',
      doNotContact: 'do_not_contact',
      doNotEmail: 'do_not_email',
      doNotCall: 'do_not_call',
      ownerId: 'owner_id',
    };

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramIndex}`);
        if (key === 'email') {
          params.push((value as string).toLowerCase().trim());
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

    // Re-score if relevant fields changed
    const scoringFields = ['email', 'phone', 'company', 'jobTitle', 'qualification', 'customFields', 'source'];
    if (scoringFields.some(f => (dto as any)[f] !== undefined)) {
      await this.scoringService.scoreLead(schemaName, id);
      const rescored = await this.findOneRaw(schemaName, id);
      await this.autoSetPriority(schemaName, id, rescored.score);
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
      `SELECT * FROM "${schemaName}".lead_stages WHERE id = $1 AND is_active = true`,
      [dto.stageId],
    );

    if (!targetStage) {
      throw new NotFoundException('Target stage not found');
    }

    // Get current stage
    const [currentStage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_stages WHERE id = $1`,
      [lead.stageId],
    );

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

    // Validate required fields for target stage (query lead_stage_fields table)
    const stageFieldRows = await this.dataSource.query(
      `SELECT field_key, field_label, is_required
       FROM "${schemaName}".lead_stage_fields
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
      `SELECT id FROM "${schemaName}".lead_stages WHERE is_lost = true AND is_active = true LIMIT 1`,
    );

    const stageHistory = lead.stageHistory || [];
    stageHistory.push({
      stageId: disqStage?.id,
      stageName: 'Disqualified',
      enteredAt: new Date().toISOString(),
      enteredBy: userId,
      previousStageId: lead.stageId,
    });

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
    if (dto.createOpportunity) {
      // Check if opportunities table exists
      const [tableExists] = await this.dataSource.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'opportunities'
        ) as exists`,
        [schemaName],
      );

      if (tableExists?.exists) {
        const [opp] = await this.dataSource.query(
          `INSERT INTO "${schemaName}".opportunities (
            name, account_id, primary_contact_id, owner_id, amount, close_date,
            pipeline_id, stage_id, lead_source, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            dto.opportunityName || `${lead.company || lead.lastName} - Opportunity`,
            accountId,
            contactId,
            ownerId,
            dto.amount || null,
            dto.closeDate || null,
            dto.pipelineId || null,
            dto.opportunityStageId || null,
            lead.source || null,
            userId,
          ],
        );
        opportunityId = opp?.id || null;
      } else {
        this.logger.warn('Opportunities table does not exist yet — skipping opportunity creation');
      }
    }

    // ── 4. Get converted stage ──
    const [convStage] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".lead_stages WHERE is_won = true AND is_active = true LIMIT 1`,
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

    return {
      lead: await this.findOne(schemaName, id),
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
           WHERE lower(email) = $1 AND deleted_at IS NULL ${excludeId ? 'AND id != $2' : ''}
           LIMIT 1`,
          excludeId ? [emailLower, excludeId] : [emailLower],
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
           WHERE phone = $1 AND deleted_at IS NULL ${excludeId ? 'AND id != $2' : ''}
           LIMIT 1`,
          excludeId ? [phone, excludeId] : [phone],
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
  async findDuplicates(schemaName: string, email: string | null, phone: string | null, excludeId?: string) {
    const duplicates: any[] = [];

    if (email) {
      const emailLower = email.toLowerCase().trim();

      // Leads
      const leadDups = await this.dataSource.query(
        `SELECT id, first_name, last_name, email, company, 'lead' as entity_type
         FROM "${schemaName}".leads
         WHERE lower(email) = $1 AND deleted_at IS NULL AND id != $2 LIMIT 5`,
        [emailLower, excludeId],
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
  // ROUTING RULES ENGINE
  // ============================================================
  private async runRoutingRules(schemaName: string, dto: CreateLeadDto): Promise<string | null> {
    const rules = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_routing_rules 
       WHERE is_active = true ORDER BY priority DESC`,
    );

    for (const rule of rules) {
      const conditions = rule.conditions || [];
      const match = this.evaluateConditions(dto, conditions);

      if (match) {
        if (rule.assignment_type === 'specific_user') {
          const users = rule.assigned_to || [];
          return users[0] || null;
        }

        if (rule.assignment_type === 'round_robin') {
          const users = rule.assigned_to || [];
          if (users.length === 0) continue;

          const index = (rule.round_robin_index || 0) % users.length;
          const assignedUser = users[index];

          // Update round robin index
          await this.dataSource.query(
            `UPDATE "${schemaName}".lead_routing_rules SET round_robin_index = $1 WHERE id = $2`,
            [index + 1, rule.id],
          );

          return assignedUser;
        }

        if (rule.assignment_type === 'team') {
          const teamId = rule.assigned_to?.[0];
          if (!teamId) continue;

          // Get team members and round-robin
          const members = await this.dataSource.query(
            `SELECT user_id FROM "${schemaName}".user_teams WHERE team_id = $1`,
            [teamId],
          );
          if (members.length === 0) continue;

          const index = (rule.round_robin_index || 0) % members.length;
          await this.dataSource.query(
            `UPDATE "${schemaName}".lead_routing_rules SET round_robin_index = $1 WHERE id = $2`,
            [index + 1, rule.id],
          );

          return members[index].user_id;
        }
      }
    }

    return null;
  }

  private evaluateConditions(dto: Record<string, any>, conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      const value = dto[cond.field];
      const targetValue = cond.value;

      switch (cond.operator) {
        case 'equals':
          if (String(value).toLowerCase() !== String(targetValue).toLowerCase()) return false;
          break;
        case 'contains':
          if (!String(value || '').toLowerCase().includes(String(targetValue).toLowerCase())) return false;
          break;
        case 'in':
          if (!Array.isArray(targetValue) || !targetValue.includes(value)) return false;
          break;
        case 'is_not_empty':
          if (!value || String(value).trim() === '') return false;
          break;
        default:
          break;
      }
    }

    return true;
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
      emails: typeof lead.emails === 'string' ? JSON.parse(lead.emails as string) : (lead.emails || []),
      phones: typeof lead.phones === 'string' ? JSON.parse(lead.phones as string) : (lead.phones || []),
      addresses: typeof lead.addresses === 'string' ? JSON.parse(lead.addresses as string) : (lead.addresses || []),
      socialProfiles: typeof lead.social_profiles === 'string' ? JSON.parse(lead.social_profiles as string) : (lead.social_profiles || {}),
      source: lead.source,
      sourceDetails: typeof lead.source_details === 'string' ? JSON.parse(lead.source_details as string) : (lead.source_details || {}),
      stageId: lead.stage_id,
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
      stageEnteredAt: lead.stage_entered_at,
      stageHistory: typeof lead.stage_history === 'string' ? JSON.parse(lead.stage_history as string) : (lead.stage_history || []),
      doNotContact: lead.do_not_contact,
      doNotEmail: lead.do_not_email,
      doNotCall: lead.do_not_call,
      tags: lead.tags,
      customFields: typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields as string) : (lead.custom_fields || {}),
      ownerId: lead.owner_id,
      owner: lead.owner_first_name ? {
        id: lead.owner_id,
        firstName: lead.owner_first_name,
        lastName: lead.owner_last_name,
      } : null,
      createdBy: lead.created_by,
      createdByUser: lead.created_by_first_name ? {
        id: lead.created_by,
        firstName: lead.created_by_first_name,
        lastName: lead.created_by_last_name,
      } : null,
      lastActivityAt: lead.last_activity_at,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    };
  }
}