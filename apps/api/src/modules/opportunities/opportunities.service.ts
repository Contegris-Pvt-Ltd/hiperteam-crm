// ============================================================
// FILE: apps/api/src/modules/opportunities/opportunities.service.ts
//
// Full CRUD + stage management + close won/lost + reopen +
// kanban + forecast + contact roles + stage history + line items
//
// Follows leads.service.ts patterns exactly:
//   - Raw SQL with parameterized queries
//   - Audit + Activity logging on all mutations
//   - RBAC via ownership filtering
//   - formatOpportunity() for consistent camelCase output
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  QueryOpportunitiesDto,
  ChangeOpportunityStageDto,
  CloseWonDto,
  CloseLostDto,
  ReopenOpportunityDto,
} from './dto';

@Injectable()
export class OpportunitiesService {
  private readonly logger = new Logger(OpportunitiesService.name);

  private readonly trackedFields = [
    'name', 'pipeline_id', 'stage_id', 'amount', 'currency', 'close_date',
    'probability', 'forecast_category', 'owner_id', 'account_id',
    'primary_contact_id', 'priority_id', 'type', 'source', 'next_step',
    'description', 'tags', 'competitor',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(schemaName: string, userId: string, dto: CreateOpportunityDto) {
    // 1. Validate pipeline exists
    const [pipeline] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".pipelines WHERE id = $1 AND is_active = true`,
      [dto.pipelineId],
    );
    if (!pipeline) throw new BadRequestException('Pipeline not found or inactive');

    // 2. Determine stage
    let stageId = dto.stageId;
    let stageProbability = 0;
    if (stageId) {
      const [stage] = await this.dataSource.query(
        `SELECT id, probability FROM "${schemaName}".pipeline_stages
         WHERE id = $1 AND pipeline_id = $2 AND module = 'opportunities' AND is_active = true`,
        [stageId, dto.pipelineId],
      );
      if (!stage) throw new BadRequestException('Stage not found in this pipeline');
      stageProbability = stage.probability || 0;
    } else {
      // Default to first stage
      const [firstStage] = await this.dataSource.query(
        `SELECT id, probability FROM "${schemaName}".pipeline_stages
         WHERE pipeline_id = $1 AND module = 'opportunities' AND is_active = true
           AND is_won = false AND is_lost = false
         ORDER BY sort_order ASC LIMIT 1`,
        [dto.pipelineId],
      );
      if (!firstStage) throw new BadRequestException('No active stages in this pipeline for opportunities');
      stageId = firstStage.id;
      stageProbability = firstStage.probability || 0;
    }

    // 3. Determine probability (user-provided or auto from stage)
    const probability = dto.probability !== undefined ? dto.probability : stageProbability;

    // 4. Auto-set forecast category from probability if not provided
    const forecastCategory = dto.forecastCategory || this.probabilityToForecast(probability);

    // 5. Owner
    const ownerId = dto.ownerId || userId;

    // 6. Insert
    const [opp] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunities
       (name, pipeline_id, stage_id, amount, currency, close_date, probability,
        forecast_category, owner_id, account_id, primary_contact_id, priority_id,
        type, source, lead_id, next_step, description, tags, custom_fields,
        stage_entered_at, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), $20, $20)
       RETURNING *`,
      [
        dto.name,
        dto.pipelineId,
        stageId,
        dto.amount ?? null,
        dto.currency || 'USD',
        dto.closeDate || null,
        probability,
        forecastCategory,
        ownerId,
        dto.accountId || null,
        dto.primaryContactId || null,
        dto.priorityId || null,
        dto.type || null,
        dto.source || null,
        dto.leadId || null,
        dto.nextStep || null,
        dto.description || null,
        dto.tags || [],
        JSON.stringify(dto.customFields || {}),
        userId,
      ],
    );

    // 7. Record initial stage history
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_stage_history
       (opportunity_id, to_stage_id, changed_by, note)
       VALUES ($1, $2, $3, 'Opportunity created')`,
      [opp.id, stageId, userId],
    );

    // 8. Activity + Audit
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opp.id,
      activityType: 'created',
      title: 'Opportunity created',
      description: `Opportunity "${dto.name}" was created`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: opp.id,
      action: 'create',
      changes: {},
      newValues: this.formatOpportunity(opp),
      performedBy: userId,
    });

    return this.findOne(schemaName, opp.id);
  }

  // ============================================================
  // FIND ALL (List + Kanban)
  // ============================================================
  async findAll(schemaName: string, query: QueryOpportunitiesDto, userId?: string) {
    const {
      search, pipelineId, stageId, ownerId, accountId, priorityId,
      type, source, forecastCategory, minAmount, maxAmount,
      closeDateFrom, closeDateTo, tag, isOpen, ownership,
      page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'DESC', view,
    } = query;

    let whereClause = 'o.deleted_at IS NULL';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (o.name ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (pipelineId) {
      whereClause += ` AND o.pipeline_id = $${paramIndex}`;
      params.push(pipelineId);
      paramIndex++;
    }

    if (stageId) {
      whereClause += ` AND o.stage_id = $${paramIndex}`;
      params.push(stageId);
      paramIndex++;
    }

    if (ownerId) {
      whereClause += ` AND o.owner_id = $${paramIndex}`;
      params.push(ownerId);
      paramIndex++;
    }

    if (accountId) {
      whereClause += ` AND o.account_id = $${paramIndex}`;
      params.push(accountId);
      paramIndex++;
    }

    if (priorityId) {
      whereClause += ` AND o.priority_id = $${paramIndex}`;
      params.push(priorityId);
      paramIndex++;
    }

    if (type) {
      whereClause += ` AND o.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (source) {
      whereClause += ` AND o.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (forecastCategory) {
      whereClause += ` AND o.forecast_category = $${paramIndex}`;
      params.push(forecastCategory);
      paramIndex++;
    }

    if (minAmount !== undefined) {
      whereClause += ` AND o.amount >= $${paramIndex}`;
      params.push(minAmount);
      paramIndex++;
    }

    if (maxAmount !== undefined) {
      whereClause += ` AND o.amount <= $${paramIndex}`;
      params.push(maxAmount);
      paramIndex++;
    }

    if (closeDateFrom) {
      whereClause += ` AND o.close_date >= $${paramIndex}`;
      params.push(closeDateFrom);
      paramIndex++;
    }

    if (closeDateTo) {
      whereClause += ` AND o.close_date <= $${paramIndex}`;
      params.push(closeDateTo);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND $${paramIndex} = ANY(o.tags)`;
      params.push(tag);
      paramIndex++;
    }

    if (isOpen === true) {
      whereClause += ` AND o.won_at IS NULL AND o.lost_at IS NULL`;
    }

    // RBAC ownership filtering
    if (ownership === 'my_deals') {
      whereClause += ` AND o.owner_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (ownership === 'created_by_me') {
      whereClause += ` AND o.created_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    // Sort
    const sortMap: Record<string, string> = {
      name: 'o.name',
      amount: 'o.amount',
      close_date: 'o.close_date',
      probability: 'o.probability',
      weighted_amount: 'o.weighted_amount',
      created_at: 'o.created_at',
      updated_at: 'o.updated_at',
      stage: 'ps.sort_order',
      account: 'a.name',
      owner: 'u.first_name',
    };
    const orderColumn = sortMap[sortBy] || 'o.created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Kanban view
    if (view === 'kanban') {
      return this.findAllKanban(schemaName, whereClause, params, pipelineId);
    }

    // Count
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schemaName}".opportunities o
       LEFT JOIN "${schemaName}".accounts a ON o.account_id = a.id
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    // Query
    const opps = await this.dataSource.query(
      `SELECT o.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name, u.avatar_url as owner_avatar,
              ps.name as stage_name, ps.slug as stage_slug, ps.color as stage_color,
              ps.sort_order as stage_sort_order, ps.is_won as stage_is_won, ps.is_lost as stage_is_lost,
              ps.probability as stage_probability,
              pl.name as pipeline_name,
              op.name as priority_name, op.color as priority_color, op.icon as priority_icon,
              a.name as account_name, a.logo_url as account_logo,
              c.first_name as contact_first_name, c.last_name as contact_last_name,
              cr.name as close_reason_name,
              cu.first_name as created_by_first_name, cu.last_name as created_by_last_name
       FROM "${schemaName}".opportunities o
       LEFT JOIN "${schemaName}".users u ON o.owner_id = u.id
       LEFT JOIN "${schemaName}".pipeline_stages ps ON o.stage_id = ps.id
       LEFT JOIN "${schemaName}".pipelines pl ON o.pipeline_id = pl.id
       LEFT JOIN "${schemaName}".opportunity_priorities op ON o.priority_id = op.id
       LEFT JOIN "${schemaName}".accounts a ON o.account_id = a.id
       LEFT JOIN "${schemaName}".contacts c ON o.primary_contact_id = c.id
       LEFT JOIN "${schemaName}".opportunity_close_reasons cr ON o.close_reason_id = cr.id
       LEFT JOIN "${schemaName}".users cu ON o.created_by = cu.id
       WHERE ${whereClause}
       ORDER BY ${orderColumn} ${order}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: opps.map((o: Record<string, unknown>) => this.formatOpportunity(o)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // KANBAN VIEW
  // ============================================================
  private async findAllKanban(
    schemaName: string, whereClause: string, params: unknown[], pipelineId?: string,
  ) {
    // Get pipeline stages for opportunities
    let stageQuery = `
      SELECT ps.id, ps.name, ps.slug, ps.color, ps.sort_order, ps.is_won, ps.is_lost, ps.probability
      FROM "${schemaName}".pipeline_stages ps
      JOIN "${schemaName}".pipelines p ON p.id = ps.pipeline_id
      WHERE ps.is_active = true AND ps.module = 'opportunities'`;

    const stageParams: unknown[] = [];
    if (pipelineId) {
      stageQuery += ` AND ps.pipeline_id = $1`;
      stageParams.push(pipelineId);
    } else {
      stageQuery += ` AND p.is_default = true`;
    }
    stageQuery += ` ORDER BY ps.sort_order ASC`;

    const stages = await this.dataSource.query(stageQuery, stageParams);

    // Get opportunities grouped by stage
    const result = [];
    for (const stage of stages) {
      const stageWhereClause = `${whereClause} AND o.stage_id = '${stage.id}'`;

      const opps = await this.dataSource.query(
        `SELECT o.*,
                u.first_name as owner_first_name, u.last_name as owner_last_name, u.avatar_url as owner_avatar,
                ps.name as stage_name, ps.slug as stage_slug, ps.color as stage_color,
                ps.sort_order as stage_sort_order, ps.is_won as stage_is_won, ps.is_lost as stage_is_lost,
                op.name as priority_name, op.color as priority_color, op.icon as priority_icon,
                a.name as account_name, a.logo_url as account_logo,
                c.first_name as contact_first_name, c.last_name as contact_last_name
         FROM "${schemaName}".opportunities o
         LEFT JOIN "${schemaName}".users u ON o.owner_id = u.id
         LEFT JOIN "${schemaName}".pipeline_stages ps ON o.stage_id = ps.id
         LEFT JOIN "${schemaName}".opportunity_priorities op ON o.priority_id = op.id
         LEFT JOIN "${schemaName}".accounts a ON o.account_id = a.id
         LEFT JOIN "${schemaName}".contacts c ON o.primary_contact_id = c.id
         WHERE ${stageWhereClause}
         ORDER BY o.amount DESC NULLS LAST, o.close_date ASC NULLS LAST
         LIMIT 50`,
        params,
      );

      // Stage totals
      const [totals] = await this.dataSource.query(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(o.amount), 0) as total_amount,
                COALESCE(SUM(o.weighted_amount), 0) as weighted_amount
         FROM "${schemaName}".opportunities o
         LEFT JOIN "${schemaName}".accounts a ON o.account_id = a.id
         WHERE ${stageWhereClause}`,
        params,
      );

      result.push({
        id: stage.id,
        name: stage.name,
        slug: stage.slug,
        color: stage.color,
        sortOrder: stage.sort_order,
        isWon: stage.is_won,
        isLost: stage.is_lost,
        probability: stage.probability,
        count: parseInt(totals.count, 10),
        totalAmount: parseFloat(totals.total_amount) || 0,
        weightedAmount: parseFloat(totals.weighted_amount) || 0,
        opportunities: opps.map((o: Record<string, unknown>) => this.formatOpportunity(o)),
      });
    }

    return { stages: result };
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, id: string) {
    const raw = await this.findOneRaw(schemaName, id);

    // Enrich with related data
    const [teamMembers, stageHistory, contactRoles, allStages] = await Promise.all([
      this.dataSource.query(
        `SELECT rtm.*, u.first_name, u.last_name, u.email, u.avatar_url,
                rtr.name as role_name_display
         FROM "${schemaName}".record_team_members rtm
         LEFT JOIN "${schemaName}".users u ON u.id = rtm.user_id
         LEFT JOIN "${schemaName}".record_team_roles rtr ON rtr.id = rtm.role_id
         WHERE rtm.entity_type = 'opportunities' AND rtm.entity_id = $1`,
        [id],
      ),
      this.getStageHistory(schemaName, id),
      this.getContactRoles(schemaName, id),
      raw.pipelineId ? this.dataSource.query(
        `SELECT id, name, slug, color, sort_order, probability, is_won, is_lost
         FROM "${schemaName}".pipeline_stages
         WHERE pipeline_id = $1 AND module = 'opportunities' AND is_active = true
         ORDER BY sort_order ASC`,
        [raw.pipelineId],
      ) : [],
    ]);

    return {
      ...raw,
      teamMembers: teamMembers.map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        firstName: m.first_name,
        lastName: m.last_name,
        email: m.email,
        avatarUrl: m.avatar_url,
        roleName: m.role_name_display || m.role_name,
        accessLevel: m.access_level,
      })),
      stageHistory,
      contactRoles,
      allStages: (allStages || []).map((s: any) => ({
        id: s.id, name: s.name, slug: s.slug, color: s.color,
        sortOrder: s.sort_order, probability: s.probability,
        isWon: s.is_won, isLost: s.is_lost,
      })),
    };
  }

  private async findOneRaw(schemaName: string, id: string) {
    const [opp] = await this.dataSource.query(
      `SELECT o.*,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              u.email as owner_email, u.avatar_url as owner_avatar,
              ps.name as stage_name, ps.slug as stage_slug, ps.color as stage_color,
              ps.sort_order as stage_sort_order, ps.is_won as stage_is_won, ps.is_lost as stage_is_lost,
              ps.probability as stage_probability,
              pl.name as pipeline_name,
              op.name as priority_name, op.color as priority_color, op.icon as priority_icon,
              a.name as account_name, a.logo_url as account_logo,
              c.first_name as contact_first_name, c.last_name as contact_last_name, c.email as contact_email,
              cr.name as close_reason_name, cr.type as close_reason_type,
              cu.first_name as created_by_first_name, cu.last_name as created_by_last_name
       FROM "${schemaName}".opportunities o
       LEFT JOIN "${schemaName}".users u ON o.owner_id = u.id
       LEFT JOIN "${schemaName}".pipeline_stages ps ON o.stage_id = ps.id
       LEFT JOIN "${schemaName}".pipelines pl ON o.pipeline_id = pl.id
       LEFT JOIN "${schemaName}".opportunity_priorities op ON o.priority_id = op.id
       LEFT JOIN "${schemaName}".accounts a ON o.account_id = a.id
       LEFT JOIN "${schemaName}".contacts c ON o.primary_contact_id = c.id
       LEFT JOIN "${schemaName}".opportunity_close_reasons cr ON o.close_reason_id = cr.id
       LEFT JOIN "${schemaName}".users cu ON o.created_by = cu.id
       WHERE o.id = $1 AND o.deleted_at IS NULL`,
      [id],
    );

    if (!opp) throw new NotFoundException('Opportunity not found');
    return this.formatOpportunity(opp);
  }

  // ============================================================
  // UPDATE
  // ============================================================
  async update(schemaName: string, id: string, userId: string, dto: UpdateOpportunityDto) {
    const existing = await this.findOneRaw(schemaName, id);

    const fieldMap: Record<string, string> = {
      name: 'name',
      pipelineId: 'pipeline_id',
      stageId: 'stage_id',
      amount: 'amount',
      currency: 'currency',
      closeDate: 'close_date',
      probability: 'probability',
      forecastCategory: 'forecast_category',
      ownerId: 'owner_id',
      accountId: 'account_id',
      primaryContactId: 'primary_contact_id',
      priorityId: 'priority_id',
      type: 'type',
      source: 'source',
      nextStep: 'next_step',
      description: 'description',
      tags: 'tags',
      customFields: 'custom_fields',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        let value = (dto as any)[dtoKey];
        if (dbCol === 'custom_fields') value = JSON.stringify(value);
        updates.push(`${dbCol} = $${idx}`);
        params.push(value);
        idx++;
      }
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_by = $${idx}`, `updated_at = NOW()`);
    params.push(userId);
    idx++;

    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    const updated = await this.findOneRaw(schemaName, id);

    // Audit
    const changes = this.auditService.calculateChanges(existing, updated, this.trackedFields);
    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'opportunities',
        entityId: id,
        activityType: 'updated',
        title: 'Opportunity updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'opportunities',
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
  // CHANGE STAGE
  // ============================================================
  async changeStage(schemaName: string, id: string, userId: string, dto: ChangeOpportunityStageDto) {
    const opp = await this.findOneRaw(schemaName, id);

    if (opp.wonAt || opp.lostAt) {
      throw new BadRequestException('Cannot change stage of a closed opportunity. Reopen it first.');
    }

    // Get target stage
    const [targetStage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1 AND is_active = true`,
      [dto.stageId],
    );
    if (!targetStage) throw new NotFoundException('Target stage not found');

    // Won/Lost stages should use closeWon/closeLost instead
    if (targetStage.is_won) throw new BadRequestException('Use the Close Won endpoint instead');
    if (targetStage.is_lost) throw new BadRequestException('Use the Close Lost endpoint instead');

    // Validate required fields
    const requiredFields = targetStage.required_fields || [];
    if (requiredFields.length > 0) {
      const missing = this.validateStageRequirements(opp, requiredFields, dto.fieldValues);
      if (missing.length > 0) {
        throw new BadRequestException({
          message: 'Missing required fields for this stage',
          missingFields: missing,
        });
      }
    }

    // Apply any field values provided
    if (dto.fieldValues && Object.keys(dto.fieldValues).length > 0) {
      const fieldUpdates: string[] = [];
      const fieldParams: unknown[] = [];
      let fIdx = 1;
      for (const [key, val] of Object.entries(dto.fieldValues)) {
        if (key === 'amount') { fieldUpdates.push(`amount = $${fIdx}`); fieldParams.push(val); fIdx++; }
        else if (key === 'closeDate') { fieldUpdates.push(`close_date = $${fIdx}`); fieldParams.push(val); fIdx++; }
        else if (key === 'nextStep') { fieldUpdates.push(`next_step = $${fIdx}`); fieldParams.push(val); fIdx++; }
        // Custom fields go into custom_fields JSONB
        else {
          fieldUpdates.push(`custom_fields = custom_fields || $${fIdx}::jsonb`);
          fieldParams.push(JSON.stringify({ [key]: val }));
          fIdx++;
        }
      }
      if (fieldUpdates.length > 0) {
        fieldParams.push(id);
        await this.dataSource.query(
          `UPDATE "${schemaName}".opportunities SET ${fieldUpdates.join(', ')} WHERE id = $${fIdx}`,
          fieldParams,
        );
      }
    }

    // Calculate time in previous stage
    // TODO: This is not perfectly accurate since stageEnteredAt is only updated on stage changes, but it's a reasonable approximation without needing to query the stage history table for the last entry.
    /*const timeInStage = opp.stageEnteredAt
      ? `NOW() - '${opp.stageEnteredAt}'::timestamptz`
      : 'NULL';*/

    // Record stage history
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_stage_history
       (opportunity_id, from_stage_id, to_stage_id, changed_by, time_in_stage, note)
       VALUES ($1, $2, $3, $4, ${opp.stageEnteredAt ? `NOW() - $5::timestamptz` : 'NULL'}, $${opp.stageEnteredAt ? '6' : '5'})`,
      opp.stageEnteredAt
        ? [id, opp.stageId, dto.stageId, userId, opp.stageEnteredAt, dto.note || null]
        : [id, opp.stageId, dto.stageId, userId, dto.note || null],
    );

    // Auto-set probability from stage (unless user has explicitly overridden)
    const newProbability = targetStage.probability || 0;

    // Update opportunity
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities
       SET stage_id = $1, probability = $2,
           forecast_category = $3,
           stage_entered_at = NOW(), updated_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [dto.stageId, newProbability, this.probabilityToForecast(newProbability), userId, id],
    );

    // Activity
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'stage_changed',
      title: 'Stage changed',
      description: `Stage changed from "${opp.stage?.name || 'unknown'}" to "${targetStage.name}"`,
      metadata: {
        fromStageId: opp.stageId,
        toStageId: dto.stageId,
        fromStageName: opp.stage?.name,
        toStageName: targetStage.name,
        note: dto.note,
      },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      action: 'update',
      changes: { stageId: { from: opp.stageId, to: dto.stageId } },
      newValues: { stageId: dto.stageId, stageName: targetStage.name },
      performedBy: userId,
    });

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // CLOSE WON
  // ============================================================
  async closeWon(schemaName: string, id: string, userId: string, dto: CloseWonDto) {
    const opp = await this.findOneRaw(schemaName, id);

    if (opp.wonAt) throw new BadRequestException('Opportunity is already closed as Won');
    if (opp.lostAt) throw new BadRequestException('Opportunity is closed as Lost. Reopen it first.');

    // Get the Won stage
    const [wonStage] = await this.dataSource.query(
      `SELECT id, name FROM "${schemaName}".pipeline_stages
       WHERE pipeline_id = $1 AND module = 'opportunities' AND is_won = true LIMIT 1`,
      [opp.pipelineId],
    );
    if (!wonStage) throw new BadRequestException('No "Won" stage configured in this pipeline');

    const closeDate = dto.closeDate || new Date().toISOString().split('T')[0];
    const finalAmount = dto.finalAmount !== undefined ? dto.finalAmount : opp.amount;

    // Record stage history
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_stage_history
       (opportunity_id, from_stage_id, to_stage_id, changed_by,
        time_in_stage, note)
       VALUES ($1, $2, $3, $4,
        ${opp.stageEnteredAt ? `NOW() - $5::timestamptz` : 'NULL'},
        $${opp.stageEnteredAt ? '6' : '5'})`,
      opp.stageEnteredAt
        ? [id, opp.stageId, wonStage.id, userId, opp.stageEnteredAt, 'Closed Won']
        : [id, opp.stageId, wonStage.id, userId, 'Closed Won'],
    );

    // Update opportunity
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities
       SET stage_id = $1, probability = 100, forecast_category = 'closed',
           amount = $2, close_date = $3, won_at = NOW(),
           close_reason_id = $4, close_notes = $5, competitor = $6,
           stage_entered_at = NOW(), updated_by = $7, updated_at = NOW()
       WHERE id = $8`,
      [wonStage.id, finalAmount, closeDate, dto.closeReasonId, dto.closeNotes || null,
       dto.competitor || null, userId, id],
    );

    // Activity
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'opportunity_won',
      title: 'Opportunity Won! 🎉',
      description: `"${opp.name}" closed won for ${finalAmount ? `$${finalAmount}` : 'N/A'}`,
      metadata: { finalAmount, closeDate, reasonId: dto.closeReasonId, competitor: dto.competitor },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      action: 'update',
      changes: { stage: { from: opp.stage?.name, to: 'Closed Won' }, wonAt: { from: null, to: 'now' } },
      newValues: { wonAt: new Date().toISOString(), amount: finalAmount },
      performedBy: userId,
    });

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // CLOSE LOST
  // ============================================================
  async closeLost(schemaName: string, id: string, userId: string, dto: CloseLostDto) {
    const opp = await this.findOneRaw(schemaName, id);

    if (opp.lostAt) throw new BadRequestException('Opportunity is already closed as Lost');
    if (opp.wonAt) throw new BadRequestException('Opportunity is closed as Won. Reopen it first.');

    const [lostStage] = await this.dataSource.query(
      `SELECT id, name FROM "${schemaName}".pipeline_stages
       WHERE pipeline_id = $1 AND module = 'opportunities' AND is_lost = true LIMIT 1`,
      [opp.pipelineId],
    );
    if (!lostStage) throw new BadRequestException('No "Lost" stage configured in this pipeline');

    const closeDate = dto.closeDate || new Date().toISOString().split('T')[0];

    // Record stage history
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_stage_history
       (opportunity_id, from_stage_id, to_stage_id, changed_by,
        time_in_stage, note)
       VALUES ($1, $2, $3, $4,
        ${opp.stageEnteredAt ? `NOW() - $5::timestamptz` : 'NULL'},
        $${opp.stageEnteredAt ? '6' : '5'})`,
      opp.stageEnteredAt
        ? [id, opp.stageId, lostStage.id, userId, opp.stageEnteredAt, 'Closed Lost']
        : [id, opp.stageId, lostStage.id, userId, 'Closed Lost'],
    );

    // Update
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities
       SET stage_id = $1, probability = 0, forecast_category = 'omitted',
           close_date = $2, lost_at = NOW(),
           close_reason_id = $3, close_notes = $4, competitor = $5,
           stage_entered_at = NOW(), updated_by = $6, updated_at = NOW()
       WHERE id = $7`,
      [lostStage.id, closeDate, dto.closeReasonId, dto.closeNotes || null,
       dto.competitor || null, userId, id],
    );

    // Activity
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'opportunity_lost',
      title: 'Opportunity Lost',
      description: `"${opp.name}" was lost`,
      metadata: { closeDate, reasonId: dto.closeReasonId, competitor: dto.competitor },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      action: 'update',
      changes: { stage: { from: opp.stage?.name, to: 'Closed Lost' }, lostAt: { from: null, to: 'now' } },
      newValues: { lostAt: new Date().toISOString() },
      performedBy: userId,
    });

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // REOPEN (Admin only)
  // ============================================================
  async reopen(schemaName: string, id: string, userId: string, dto: ReopenOpportunityDto) {
    const opp = await this.findOneRaw(schemaName, id);

    if (!opp.wonAt && !opp.lostAt) {
      throw new BadRequestException('Opportunity is not closed — nothing to reopen');
    }

    // Validate target stage
    const [targetStage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages
       WHERE id = $1 AND is_active = true AND is_won = false AND is_lost = false`,
      [dto.stageId],
    );
    if (!targetStage) throw new BadRequestException('Target stage must be an open (non-terminal) stage');

    const probability = dto.probability !== undefined ? dto.probability : (targetStage.probability || 0);

    // Record stage history
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_stage_history
       (opportunity_id, from_stage_id, to_stage_id, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, opp.stageId, dto.stageId, userId, `Reopened: ${dto.reason}`],
    );

    // Update
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities
       SET stage_id = $1, probability = $2, forecast_category = $3,
           won_at = NULL, lost_at = NULL, close_reason_id = NULL, close_notes = NULL,
           stage_entered_at = NOW(), updated_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [dto.stageId, probability, this.probabilityToForecast(probability), userId, id],
    );

    // Activity
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'opportunity_reopened',
      title: 'Opportunity Reopened',
      description: `"${opp.name}" was reopened. Reason: ${dto.reason}`,
      metadata: { reason: dto.reason, newStageId: dto.stageId },
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      action: 'update',
      changes: {
        wonAt: { from: opp.wonAt, to: null },
        lostAt: { from: opp.lostAt, to: null },
        stageId: { from: opp.stageId, to: dto.stageId },
      },
      newValues: { reopenReason: dto.reason },
      performedBy: userId,
    });

    return this.findOne(schemaName, id);
  }

  // ============================================================
  // DELETE (soft)
  // ============================================================
  async remove(schemaName: string, id: string, userId: string) {
    const opp = await this.findOneRaw(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities SET deleted_at = NOW(), updated_by = $1 WHERE id = $2`,
      [userId, id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      activityType: 'deleted',
      title: 'Opportunity deleted',
      description: `"${opp.name}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'opportunities',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: opp,
      performedBy: userId,
    });

    return { success: true };
  }

  // ============================================================
  // STAGE HISTORY
  // ============================================================
  async getStageHistory(schemaName: string, id: string) {
    const history = await this.dataSource.query(
      `SELECT h.*,
              fs.name as from_stage_name, fs.color as from_stage_color,
              ts.name as to_stage_name, ts.color as to_stage_color,
              u.first_name as changed_by_first_name, u.last_name as changed_by_last_name
       FROM "${schemaName}".opportunity_stage_history h
       LEFT JOIN "${schemaName}".pipeline_stages fs ON h.from_stage_id = fs.id
       LEFT JOIN "${schemaName}".pipeline_stages ts ON h.to_stage_id = ts.id
       LEFT JOIN "${schemaName}".users u ON h.changed_by = u.id
       WHERE h.opportunity_id = $1
       ORDER BY h.created_at DESC`,
      [id],
    );

    return history.map((h: any) => ({
      id: h.id,
      opportunityId: h.opportunity_id,
      fromStage: h.from_stage_id ? { id: h.from_stage_id, name: h.from_stage_name, color: h.from_stage_color } : null,
      toStage: { id: h.to_stage_id, name: h.to_stage_name, color: h.to_stage_color },
      changedBy: h.changed_by ? {
        id: h.changed_by,
        firstName: h.changed_by_first_name,
        lastName: h.changed_by_last_name,
      } : null,
      timeInStage: h.time_in_stage,
      note: h.note,
      createdAt: h.created_at,
    }));
  }

  // ============================================================
  // CONTACT ROLES
  // ============================================================
  async getContactRoles(schemaName: string, opportunityId: string) {
    const roles = await this.dataSource.query(
      `SELECT oc.*, c.first_name, c.last_name, c.email, c.phone, c.avatar_url,
              c.company, c.job_title
       FROM "${schemaName}".opportunity_contacts oc
       LEFT JOIN "${schemaName}".contacts c ON c.id = oc.contact_id
       WHERE oc.opportunity_id = $1
       ORDER BY oc.is_primary DESC, oc.created_at ASC`,
      [opportunityId],
    );

    return roles.map((r: any) => ({
      id: r.id,
      opportunityId: r.opportunity_id,
      contactId: r.contact_id,
      role: r.role,
      isPrimary: r.is_primary,
      notes: r.notes,
      contact: {
        id: r.contact_id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
        avatarUrl: r.avatar_url,
        company: r.company,
        jobTitle: r.job_title,
      },
      createdAt: r.created_at,
    }));
  }

  async addContactRole(schemaName: string, opportunityId: string, contactId: string, role: string, isPrimary: boolean, notes: string | null, userId: string) {
    // Validate opportunity exists
    await this.findOneRaw(schemaName, opportunityId);

    // If setting as primary, unset other primaries
    if (isPrimary) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunity_contacts SET is_primary = false WHERE opportunity_id = $1`,
        [opportunityId],
      );
    }

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_contacts
       (opportunity_id, contact_id, role, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (opportunity_id, contact_id) DO UPDATE
       SET role = EXCLUDED.role, is_primary = EXCLUDED.is_primary, notes = EXCLUDED.notes
       RETURNING *`,
      [opportunityId, contactId, role, isPrimary, notes],
    );

    // Also update primary_contact_id on opportunity if this is primary
    if (isPrimary) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunities SET primary_contact_id = $1 WHERE id = $2`,
        [contactId, opportunityId],
      );
    }

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'contact_added',
      title: 'Contact role added',
      metadata: { contactId, role, isPrimary },
      performedBy: userId,
    });

    return this.getContactRoles(schemaName, opportunityId);
  }

  async removeContactRole(schemaName: string, opportunityId: string, contactId: string, userId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_contacts WHERE opportunity_id = $1 AND contact_id = $2`,
      [opportunityId, contactId],
    );

    // If this was the primary contact, clear it on the opportunity
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunities
       SET primary_contact_id = NULL
       WHERE id = $1 AND primary_contact_id = $2`,
      [opportunityId, contactId],
    );

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'contact_removed',
      title: 'Contact role removed',
      metadata: { contactId },
      performedBy: userId,
    });

    return this.getContactRoles(schemaName, opportunityId);
  }

  // ============================================================
  // LINE ITEMS
  // ============================================================
  async getLineItems(schemaName: string, opportunityId: string) {
    const items = await this.dataSource.query(
      `SELECT oli.*,
              p.name as product_name, p.code as product_code, p.type as product_type
      FROM "${schemaName}".opportunity_line_items oli
      LEFT JOIN "${schemaName}".products p ON p.id = oli.product_id
      WHERE oli.opportunity_id = $1
      ORDER BY oli.sort_order ASC`,
      [opportunityId],
    );

    return items.map((i: any) => {
      const discountPercent = parseFloat(i.discount_percent) || 0;
      const discountAmount = parseFloat(i.discount_amount) || 0;
      const discountType = discountAmount > 0 ? 'fixed' : 'percentage';
      const discount = discountType === 'fixed' ? discountAmount : discountPercent;

      return {
        id: i.id,
        opportunityId: i.opportunity_id,
        productId: i.product_id,
        productName: i.product_name,
        productCode: i.product_code,
        productType: i.product_type,
        priceBookEntryId: i.price_book_entry_id,
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        unitPrice: parseFloat(i.unit_price) || 0,
        discount,
        discountType,
        totalPrice: parseFloat(i.total_price) || 0,
        billingFrequency: i.billing_frequency,
        sortOrder: i.sort_order,
        // ── NEW bundle fields ──
        parentLineItemId: i.parent_line_item_id || null,
        lineItemType: i.line_item_type || 'standard',
        isOptional: i.is_optional || false,
        // ──────────────────────
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      };
    });
  }

  async addLineItem(schemaName: string, opportunityId: string, data: any, userId: string) {
    await this.findOneRaw(schemaName, opportunityId);

    // Fetch product info (for bundle detection + billing frequency)
    let product: any = null;
    if (data.productId) {
      const [p] = await this.dataSource.query(
        `SELECT id, type, name, base_price, unit FROM "${schemaName}".products WHERE id = $1 AND deleted_at IS NULL`,
        [data.productId],
      );
      product = p || null;
      if (product && product.type === 'bundle') {
        return this.addBundleAsLineItems(schemaName, opportunityId, product, userId);
      }
    }

    // ── Standard (non-bundle) product ──
    const quantity = data.quantity || 1;
    const unitPrice = data.unitPrice || 0;
    const { discountPercent, discountAmount } = this.mapDiscount(data);
    const subtotal = quantity * unitPrice;
    const totalPrice = subtotal - discountAmount - (subtotal * discountPercent / 100);
    const billingFrequency = data.billingFrequency || this.detectBillingFrequency(product);

    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
      [opportunityId],
    );

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_line_items
       (opportunity_id, product_id, price_book_entry_id, description,
        quantity, unit_price, discount_percent, discount_amount, total_price,
        billing_frequency, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        opportunityId, data.productId || null, data.priceBookEntryId || null,
        data.description || null, quantity, unitPrice, discountPercent, discountAmount,
        totalPrice, billingFrequency, maxOrder.next,
      ],
    );

    await this.recalculateAmount(schemaName, opportunityId);

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'line_item_added',
      title: 'Product added',
      metadata: { productId: data.productId, quantity, unitPrice, totalPrice, billingFrequency },
      performedBy: userId,
    });

    return this.getLineItems(schemaName, opportunityId);
  }

  async updateLineItem(schemaName: string, opportunityId: string, itemId: string, data: any) {
    // Fetch existing item to merge values
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_line_items WHERE id = $1 AND opportunity_id = $2`,
      [itemId, opportunityId],
    );
    if (!existing) throw new NotFoundException('Line item not found');

    const quantity = data.quantity ?? parseFloat(existing.quantity) ?? 1;
    const unitPrice = data.unitPrice ?? parseFloat(existing.unit_price) ?? 0;

    // Map frontend discount + discountType → DB discount_percent + discount_amount
    // If frontend sends discount/discountType, use those; otherwise keep existing DB values
    let discountPercent: number;
    let discountAmount: number;
    if (data.discount !== undefined || data.discountType !== undefined) {
      const mapped = this.mapDiscount(data);
      discountPercent = mapped.discountPercent;
      discountAmount = mapped.discountAmount;
    } else if (data.discountPercent !== undefined || data.discountAmount !== undefined) {
      // Also accept raw discountPercent/discountAmount for backwards compat
      discountPercent = data.discountPercent ?? parseFloat(existing.discount_percent) ?? 0;
      discountAmount = data.discountAmount ?? parseFloat(existing.discount_amount) ?? 0;
    } else {
      discountPercent = parseFloat(existing.discount_percent) || 0;
      discountAmount = parseFloat(existing.discount_amount) || 0;
    }

    const subtotal = quantity * unitPrice;
    const totalPrice = subtotal - discountAmount - (subtotal * discountPercent / 100);

    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_line_items
      SET quantity = $1, unit_price = $2, discount_percent = $3, discount_amount = $4,
          total_price = $5, description = $6, billing_frequency = $7, updated_at = NOW()
      WHERE id = $8 AND opportunity_id = $9`,
      [quantity, unitPrice, discountPercent, discountAmount, totalPrice,
      data.description ?? existing.description, data.billingFrequency ?? existing.billing_frequency,
      itemId, opportunityId],
    );

    await this.recalculateAmount(schemaName, opportunityId);

    return this.getLineItems(schemaName, opportunityId);
  }

  // ─────────────────────────────────────────────────────────────
  // NEW HELPER: mapDiscount  (add to HELPERS section ~line 1438)
  // Maps frontend { discount, discountType } → { discountPercent, discountAmount }
  // ─────────────────────────────────────────────────────────────
  private mapDiscount(data: any): { discountPercent: number; discountAmount: number } {
    if (data.discount !== undefined && data.discountType) {
      if (data.discountType === 'fixed') {
        return { discountPercent: 0, discountAmount: data.discount };
      }
      return { discountPercent: data.discount, discountAmount: 0 };
    }
    return {
      discountPercent: data.discountPercent || 0,
      discountAmount: data.discountAmount || 0,
    };
  }

  async removeLineItem(schemaName: string, opportunityId: string, itemId: string, userId: string) {
    // Check what we're deleting (for logging)
    const [item] = await this.dataSource.query(
      `SELECT line_item_type, product_id, parent_line_item_id
      FROM "${schemaName}".opportunity_line_items
      WHERE id = $1 AND opportunity_id = $2`,
      [itemId, opportunityId],
    );

    if (!item) {
      return this.getLineItems(schemaName, opportunityId);
    }

    // If deleting a bundle_child or bundle_discount, just delete that single row
    // If deleting a bundle_parent, FK CASCADE will remove children + discount too
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_line_items WHERE id = $1 AND opportunity_id = $2`,
      [itemId, opportunityId],
    );

    await this.recalculateAmount(schemaName, opportunityId);

    const activityType = item.line_item_type === 'bundle_parent'
      ? 'bundle_removed'
      : 'line_item_removed';

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType,
      title: item.line_item_type === 'bundle_parent' ? 'Bundle removed' : 'Product removed',
      metadata: { itemId, lineItemType: item.line_item_type, productId: item.product_id },
      performedBy: userId,
    });

    return this.getLineItems(schemaName, opportunityId);
  }


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANGE 4: ADD this new private method after recalculateAmount (~line 1197)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Insert a bundle product as: parent row + child rows + discount row.
   * Called by addLineItem when product.type === 'bundle'.
   */
  private async addBundleLineItems(
    schemaName: string,
    opportunityId: string,
    product: any,
    data: any,
    userId: string,
  ) {
    // 1. Fetch bundle configuration + child items
    const [bundleConfig] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".product_bundles WHERE product_id = $1`,
      [product.id],
    );

    const bundleItems = bundleConfig
      ? await this.dataSource.query(
          `SELECT bi.*, p.name as product_name, p.code as product_code, p.base_price
          FROM "${schemaName}".bundle_items bi
          JOIN "${schemaName}".products p ON bi.product_id = p.id AND p.deleted_at IS NULL
          WHERE bi.bundle_id = $1
          ORDER BY bi.display_order ASC`,
          [bundleConfig.id],
        )
      : [];

    // 2. Get next sort_order
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) as max_order
      FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
      [opportunityId],
    );
    let sortOrder = (maxOrder.max_order || 0) + 1;

    // 3. Insert PARENT row (bundle_parent) — quantity 1, price = 0 (children carry the prices)
    const [parentRow] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_line_items
      (opportunity_id, product_id, description, quantity, unit_price,
        discount_percent, discount_amount, total_price,
        billing_frequency, sort_order, line_item_type, is_optional, parent_line_item_id)
      VALUES ($1, $2, $3, 1, 0, 0, 0, 0, 'one_time', $4, 'bundle_parent', false, NULL)
      RETURNING *`,
      [
        opportunityId,
        product.id,
        data.description || `Bundle: ${product.name}`,
        sortOrder,
      ],
    );
    sortOrder++;

    // 4. Insert CHILD rows (bundle_child)
    let childrenTotal = 0;
    for (const bi of bundleItems) {
      const qty = bi.quantity || 1;
      const price = bi.override_price
        ? parseFloat(bi.override_price)
        : parseFloat(bi.base_price) || 0;
      const lineTotal = qty * price;
      childrenTotal += lineTotal;

      await this.dataSource.query(
        `INSERT INTO "${schemaName}".opportunity_line_items
        (opportunity_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, total_price,
          billing_frequency, sort_order, line_item_type, is_optional, parent_line_item_id)
        VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'one_time', $7, 'bundle_child', $8, $9)
        RETURNING *`,
        [
          opportunityId,
          bi.product_id,
          null,
          qty,
          price,
          lineTotal,
          sortOrder,
          bi.is_optional || false,
          parentRow.id,
        ],
      );
      sortOrder++;
    }

    // 5. Insert DISCOUNT row if bundle has a discount configured
    if (bundleConfig && parseFloat(bundleConfig.discount_value) > 0) {
      const discountValue = parseFloat(bundleConfig.discount_value);
      let discountTotal = 0;

      if (bundleConfig.discount_type === 'percentage') {
        discountTotal = -(childrenTotal * discountValue / 100);
      } else {
        // fixed amount
        discountTotal = -discountValue;
      }

      // Round to 2 decimal places
      discountTotal = Math.round(discountTotal * 100) / 100;

      const discountLabel = bundleConfig.discount_type === 'percentage'
        ? `Bundle Discount (${discountValue}%)`
        : `Bundle Discount`;

      await this.dataSource.query(
        `INSERT INTO "${schemaName}".opportunity_line_items
        (opportunity_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, total_price,
          billing_frequency, sort_order, line_item_type, is_optional, parent_line_item_id)
        VALUES ($1, NULL, $2, 1, 0, 0, 0, $3, 'one_time', $4, 'bundle_discount', false, $5)
        RETURNING *`,
        [
          opportunityId,
          discountLabel,
          discountTotal,
          sortOrder,
          parentRow.id,
        ],
      );
    }

    // 6. Recalculate opportunity total
    await this.recalculateAmount(schemaName, opportunityId);

    // 7. Activity log
    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'bundle_added',
      title: `Bundle added: ${product.name}`,
      metadata: {
        productId: product.id,
        bundleName: product.name,
        childCount: bundleItems.length,
        childrenTotal,
      },
      performedBy: userId,
    });

    return this.getLineItems(schemaName, opportunityId);
  }

  private async recalculateAmount(schemaName: string, opportunityId: string) {
    const [sum] = await this.dataSource.query(
      `SELECT COALESCE(SUM(total_price), 0) as total
       FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
      [opportunityId],
    );
    const total = parseFloat(sum.total) || 0;

    // Only update if there are line items (don't zero out manual amounts)
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
      [opportunityId],
    );

    if (parseInt(count, 10) > 0) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunities SET amount = $1, updated_at = NOW() WHERE id = $2`,
        [total, opportunityId],
      );
    }
  }

  /**
   * Expand a bundle product into individual line item rows.
   * Each bundle child becomes its own independent row with full price/qty.
   * If the bundle has a discount, a separate discount row is added.
   */
  private async addBundleAsLineItems(
    schemaName: string,
    opportunityId: string,
    product: any,
    userId: string,
  ) {
    // Fetch bundle config
    const [bundleConfig] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".product_bundles WHERE product_id = $1`,
      [product.id],
    );

    // Fetch child products
    const bundleItems = bundleConfig
      ? await this.dataSource.query(
          `SELECT bi.*, p.name as product_name, p.code as product_code, p.base_price, p.unit as product_unit, p.type as product_type
           FROM "${schemaName}".bundle_items bi
           JOIN "${schemaName}".products p ON bi.product_id = p.id AND p.deleted_at IS NULL
           WHERE bi.bundle_id = $1
           ORDER BY bi.display_order ASC`,
          [bundleConfig.id],
        )
      : [];

    // Insert the parent bundle product as the first row
    const parentPrice = parseFloat(product.base_price) || 0;

    // Get starting sort_order
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) as max_order
       FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
      [opportunityId],
    );

    let sortOrder = (maxOrder.max_order || 0) + 1;
    if (bundleItems.length === 0) {
      // No children configured — fall back to adding the bundle product itself
      const unitPrice = parseFloat(product.base_price) || 0;
      const [maxOrder] = await this.dataSource.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_line_items WHERE opportunity_id = $1`,
        [opportunityId],
      );
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".opportunity_line_items
         (opportunity_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, total_price, billing_frequency, sort_order)
         VALUES ($1, $2, $3, 1, $4, 0, 0, $4, $5, $6)`,
        [opportunityId, product.id, null, parentPrice, this.detectBillingFrequency(product), sortOrder],
      );
      await this.recalculateAmount(schemaName, opportunityId);
      return this.getLineItems(schemaName, opportunityId);
    }

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_line_items
       (opportunity_id, product_id, description, quantity, unit_price,
        discount_percent, discount_amount, total_price, billing_frequency, sort_order)
       VALUES ($1, $2, $3, 1, $4, 0, 0, $4, 'one_time', $5)`,
      [opportunityId, product.id, null, parentPrice, sortOrder],
    );
    sortOrder++;

    // Insert each child product as its own independent row
    let childrenTotal = 0;
    for (const bi of bundleItems) {
      const qty = bi.quantity || 1;
      const price = bi.override_price
        ? parseFloat(bi.override_price)
        : parseFloat(bi.base_price) || 0;
      const lineTotal = qty * price;
      childrenTotal += lineTotal;

      await this.dataSource.query(
        `INSERT INTO "${schemaName}".opportunity_line_items
         (opportunity_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, total_price, billing_frequency, sort_order)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, $8)`,
        [opportunityId, bi.product_id, null, qty, price, lineTotal, this.detectBillingFrequency(bi), sortOrder],
      );
      sortOrder++;
    }

    // Insert bundle discount row if configured
    if (bundleConfig && parseFloat(bundleConfig.discount_value) > 0) {
      const discountValue = parseFloat(bundleConfig.discount_value);
      let discountTotal = 0;

      if (bundleConfig.discount_type === 'percentage') {
        discountTotal = Math.round(childrenTotal * discountValue * -1) / 100;
      } else {
        discountTotal = -discountValue;
      }
      discountTotal = Math.round(discountTotal * 100) / 100;

      const discountLabel = bundleConfig.discount_type === 'percentage'
        ? `Bundle Discount — ${product.name} (${discountValue}%)`
        : `Bundle Discount — ${product.name}`;

      await this.dataSource.query(
        `INSERT INTO "${schemaName}".opportunity_line_items
         (opportunity_id, product_id, description, quantity, unit_price,
          discount_percent, discount_amount, total_price, billing_frequency, sort_order)
         VALUES ($1, NULL, $2, 1, 0, 0, 0, $3, 'one_time', $4)`,
        [opportunityId, discountLabel, discountTotal, sortOrder],
      );
    }

    await this.recalculateAmount(schemaName, opportunityId);

    await this.activityService.create(schemaName, {
      entityType: 'opportunities',
      entityId: opportunityId,
      activityType: 'bundle_added',
      title: `Bundle added: ${product.name}`,
      metadata: { productId: product.id, childCount: bundleItems.length, childrenTotal },
      performedBy: userId,
    });

    return this.getLineItems(schemaName, opportunityId);
  }

  private detectBillingFrequency(product: any): string {
    if (!product) return 'one_time';

    const unit = (product.unit || product.product_unit || '').toLowerCase();
    const type = (product.type || product.product_type || '').toLowerCase();

    // Direct unit mapping
    if (unit === 'month') return 'monthly';
    if (unit === 'year') return 'annually';

    // If product type is subscription, default to monthly for user/license units
    if (type === 'subscription') return 'monthly';

    return 'one_time';
  }

  /**
   * Check for duplicate opportunities by name similarity and/or account match.
   * Uses trigram similarity (pg_trgm) with fallback to ILIKE for environments
   * without the extension.
   */
  async checkDuplicates(
    schemaName: string,
    name?: string,
    accountId?: string,
    excludeId?: string,
  ): Promise<any[]> {
    if (!name && !accountId) return [];

    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: any[] = [];
    let paramIdx = 1;

    if (excludeId) {
      conditions.push(`o.id != $${paramIdx}`);
      params.push(excludeId);
      paramIdx++;
    }

    // Build similarity conditions
    const orClauses: string[] = [];

    if (name && name.trim().length >= 3) {
      // Fuzzy match on name using ILIKE with wildcard
      // This catches "Acme Corp - Renewal" matching "Acme Corp - Upsell"
      const nameWords = name.trim().split(/\s+/).filter(w => w.length >= 3).slice(0, 3);
      if (nameWords.length > 0) {
        const nameLikeClauses = nameWords.map(word => {
          orClauses.push(`o.name ILIKE $${paramIdx}`);
          params.push(`%${word}%`);
          paramIdx++;
          return null;
        });
      }
    }

    if (accountId) {
      // Same account = possible duplicate
      orClauses.push(`o.account_id = $${paramIdx}`);
      params.push(accountId);
      paramIdx++;
    }

    if (orClauses.length === 0) return [];

    conditions.push(`(${orClauses.join(' OR ')})`);

    // Only return open opportunities (not deleted, not closed)
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM "${schemaName}".pipeline_stages ps
      WHERE ps.id = o.stage_id AND (ps.is_won = true OR ps.is_lost = true)
    )`);

    const query = `
      SELECT o.id, o.name, o.amount,
             a.name as account_name,
             ps.name as stage_name,
             u.first_name || ' ' || u.last_name as owner_name
      FROM "${schemaName}".opportunities o
      LEFT JOIN "${schemaName}".accounts a ON a.id = o.account_id
      LEFT JOIN "${schemaName}".pipeline_stages ps ON ps.id = o.stage_id
      LEFT JOIN "${schemaName}".users u ON u.id = o.owner_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    const results = await this.dataSource.query(query, params);

    return results.map((r: any) => ({
      id: r.id,
      name: r.name,
      accountName: r.account_name,
      stageName: r.stage_name,
      amount: r.amount ? parseFloat(r.amount) : null,
      ownerName: r.owner_name,
    }));
  }
  
  // ─────────────────────────────────────────────────────────────
  // NEW: OPPORTUNITY TYPES CRUD
  // Add after deletePriority (~line 1436)
  // ─────────────────────────────────────────────────────────────

  async getTypes(schemaName: string, activeOnly = true) {
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const types = await this.dataSource.query(
      `SELECT ot.*,
              (SELECT COUNT(*) FROM "${schemaName}".opportunities o
              WHERE o.type = ot.slug AND o.deleted_at IS NULL) as opp_count
      FROM "${schemaName}".opportunity_types ot
      ${whereClause}
      ORDER BY ot.sort_order ASC`,
    );
    return types.map((t: any) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      color: t.color,
      sortOrder: t.sort_order,
      isDefault: t.is_default,
      isSystem: t.is_system,
      isActive: t.is_active,
      oppCount: parseInt(t.opp_count || '0', 10),
    }));
  }

  async createType(schemaName: string, data: any) {
    const slug = (data.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_types`,
    );

    const [typeRow] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_types (name, slug, description, color, sort_order)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, slug, data.description || null, data.color || '#6B7280', data.sortOrder ?? maxOrder.next],
    );

    return {
      id: typeRow.id,
      name: typeRow.name,
      slug: typeRow.slug,
      description: typeRow.description,
      color: typeRow.color,
      sortOrder: typeRow.sort_order,
      isDefault: typeRow.is_default,
      isSystem: typeRow.is_system,
      isActive: typeRow.is_active,
    };
  }

  async updateType(schemaName: string, id: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries({
      name: 'name', description: 'description', color: 'color',
      sortOrder: 'sort_order', isActive: 'is_active', isDefault: 'is_default',
    })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }
    if (updates.length === 0) return;

    // Auto-update slug if name changes
    if (data.name) {
      const newSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      updates.push(`slug = $${idx}`);
      params.push(newSlug);
      idx++;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_types SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunity_types SET is_default = false WHERE id != $1`, [id],
      );
    }

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      color: updated.color,
      sortOrder: updated.sort_order,
      isDefault: updated.is_default,
      isSystem: updated.is_system,
      isActive: updated.is_active,
    };
  }

  async deleteType(schemaName: string, id: string) {
    const [typeRow] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    if (!typeRow) throw new NotFoundException('Type not found');
    if (typeRow.is_system) throw new BadRequestException('Cannot delete system types');

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities
      WHERE type = $1 AND deleted_at IS NULL`,
      [typeRow.slug],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} opportunity(ies) use this type`);
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_types WHERE id = $1`, [id],
    );
    return { success: true };
  }

  // ============================================================
  // FORECAST
  // ============================================================
  // ─────────────────────────────────────────────────────────────
  // NEW: FORECAST CATEGORIES CRUD
  // Add after deleteType
  // ─────────────────────────────────────────────────────────────

  async getForecastCategories(schemaName: string, activeOnly = true) {
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const categories = await this.dataSource.query(
      `SELECT fc.*,
              (SELECT COUNT(*) FROM "${schemaName}".opportunities o
              WHERE o.forecast_category = fc.slug AND o.deleted_at IS NULL) as opp_count
      FROM "${schemaName}".opportunity_forecast_categories fc
      ${whereClause}
      ORDER BY fc.sort_order ASC`,
    );
    return categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      color: c.color,
      probabilityMin: c.probability_min,
      probabilityMax: c.probability_max,
      sortOrder: c.sort_order,
      isSystem: c.is_system,
      isActive: c.is_active,
      oppCount: parseInt(c.opp_count || '0', 10),
    }));
  }

  async createForecastCategory(schemaName: string, data: any) {
    const slug = (data.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_forecast_categories`,
    );

    const [cat] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_forecast_categories
      (name, slug, description, color, probability_min, probability_max, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.name, slug, data.description || null,
        data.color || '#6B7280',
        data.probabilityMin ?? 0, data.probabilityMax ?? 100,
        data.sortOrder ?? maxOrder.next,
      ],
    );

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      color: cat.color,
      probabilityMin: cat.probability_min,
      probabilityMax: cat.probability_max,
      sortOrder: cat.sort_order,
      isSystem: cat.is_system,
      isActive: cat.is_active,
    };
  }

  async updateForecastCategory(schemaName: string, id: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries({
      name: 'name', description: 'description', color: 'color',
      probabilityMin: 'probability_min', probabilityMax: 'probability_max',
      sortOrder: 'sort_order', isActive: 'is_active',
    })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }
    if (updates.length === 0) return;

    if (data.name) {
      const newSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      updates.push(`slug = $${idx}`);
      params.push(newSlug);
      idx++;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_forecast_categories SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      color: updated.color,
      probabilityMin: updated.probability_min,
      probabilityMax: updated.probability_max,
      sortOrder: updated.sort_order,
      isSystem: updated.is_system,
      isActive: updated.is_active,
    };
  }

  async deleteForecastCategory(schemaName: string, id: string) {
    const [cat] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    if (!cat) throw new NotFoundException('Forecast category not found');
    if (cat.is_system) throw new BadRequestException('Cannot delete system forecast categories');

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities
      WHERE forecast_category = $1 AND deleted_at IS NULL`,
      [cat.slug],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} opportunity(ies) use this category`);
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_forecast_categories WHERE id = $1`, [id],
    );
    return { success: true };
  }

  async getForecast(schemaName: string, pipelineId?: string) {
    let pipelineFilter = '';
    const params: unknown[] = [];

    if (pipelineId) {
      pipelineFilter = `AND o.pipeline_id = $1`;
      params.push(pipelineId);
    }

    const rows = await this.dataSource.query(
      `SELECT
         o.forecast_category,
         DATE_TRUNC('month', o.close_date) as month,
         COUNT(*) as count,
         COALESCE(SUM(o.amount), 0) as total_amount,
         COALESCE(SUM(o.weighted_amount), 0) as weighted_amount
       FROM "${schemaName}".opportunities o
       WHERE o.deleted_at IS NULL
         AND o.close_date IS NOT NULL
         AND o.won_at IS NULL AND o.lost_at IS NULL
         ${pipelineFilter}
       GROUP BY o.forecast_category, DATE_TRUNC('month', o.close_date)
       ORDER BY month ASC, o.forecast_category`,
      params,
    );

    // Also get summary
    const [summary] = await this.dataSource.query(
      `SELECT
         COUNT(*) as total_deals,
         COALESCE(SUM(o.amount), 0) as total_amount,
         COALESCE(SUM(o.weighted_amount), 0) as total_weighted,
         COALESCE(AVG(o.probability), 0) as avg_probability,
         COUNT(CASE WHEN o.won_at IS NOT NULL THEN 1 END) as won_count,
         COUNT(CASE WHEN o.lost_at IS NOT NULL THEN 1 END) as lost_count
       FROM "${schemaName}".opportunities o
       WHERE o.deleted_at IS NULL ${pipelineFilter}`,
      params,
    );

    return {
      forecast: rows.map((r: any) => ({
        forecastCategory: r.forecast_category,
        month: r.month,
        count: parseInt(r.count, 10),
        totalAmount: parseFloat(r.total_amount) || 0,
        weightedAmount: parseFloat(r.weighted_amount) || 0,
      })),
      summary: {
        totalDeals: parseInt(summary.total_deals, 10),
        totalAmount: parseFloat(summary.total_amount) || 0,
        totalWeighted: parseFloat(summary.total_weighted) || 0,
        avgProbability: Math.round(parseFloat(summary.avg_probability) || 0),
        wonCount: parseInt(summary.won_count, 10),
        lostCount: parseInt(summary.lost_count, 10),
      },
    };
  }

  // ============================================================
  // CLOSE REASONS (admin-configurable)
  // ============================================================
  async getCloseReasons(schemaName: string, type?: string) {
    let query = `SELECT * FROM "${schemaName}".opportunity_close_reasons`;
    const params: unknown[] = [];
    if (type) {
      query += ` WHERE type = $1`;
      params.push(type);
    }
    query += ` ORDER BY sort_order ASC`;
    const reasons = await this.dataSource.query(query, params);
    return reasons.map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.description,
      sortOrder: r.sort_order,
      isActive: r.is_active,
      isSystem: r.is_system,
    }));
  }

  async createCloseReason(schemaName: string, data: any) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_close_reasons WHERE type = $1`,
      [data.type],
    );
    const [reason] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_close_reasons (type, name, description, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.type, data.name, data.description || null, data.sortOrder ?? maxOrder.next],
    );
    return reason;
  }

  async updateCloseReason(schemaName: string, id: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries({ name: 'name', description: 'description', sortOrder: 'sort_order', isActive: 'is_active' })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }
    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_close_reasons SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    return updated;
  }

  async deleteCloseReason(schemaName: string, id: string) {
    const [reason] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    if (!reason) throw new NotFoundException('Close reason not found');
    if (reason.is_system) throw new BadRequestException('Cannot delete system close reasons');

    // Check usage
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities WHERE close_reason_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} opportunity(ies) use this reason`);
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_close_reasons WHERE id = $1`, [id],
    );
    return { success: true };
  }

  // ============================================================
  // PRIORITIES
  // ============================================================
  async getPriorities(schemaName: string) {
    const priorities = await this.dataSource.query(
      `SELECT op.*,
              (SELECT COUNT(*) FROM "${schemaName}".opportunities o
               WHERE o.priority_id = op.id AND o.deleted_at IS NULL) as opp_count
       FROM "${schemaName}".opportunity_priorities op
       ORDER BY op.sort_order ASC`,
    );
    return priorities.map((p: any) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      sortOrder: p.sort_order,
      isDefault: p.is_default,
      isSystem: p.is_system,
      isActive: p.is_active,
      oppCount: parseInt(p.opp_count || '0', 10),
    }));
  }

  async createPriority(schemaName: string, data: any) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".opportunity_priorities`,
    );
    const [priority] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".opportunity_priorities (name, color, icon, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.color || '#9CA3AF', data.icon || null, data.sortOrder ?? maxOrder.next],
    );
    return priority;
  }

  async updatePriority(schemaName: string, id: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries({
      name: 'name', color: 'color', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active', isDefault: 'is_default',
    })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }
    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schemaName}".opportunity_priorities SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".opportunity_priorities SET is_default = false WHERE id != $1`, [id],
      );
    }

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    return updated;
  }

  async deletePriority(schemaName: string, id: string) {
    const [priority] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    if (!priority) throw new NotFoundException('Priority not found');
    if (priority.is_system) throw new BadRequestException('Cannot delete system priorities');

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".opportunities WHERE priority_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} opportunity(ies) use this priority`);
    }

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".opportunity_priorities WHERE id = $1`, [id],
    );
    return { success: true };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private probabilityToForecast(probability: number): string {
    if (probability >= 100) return 'closed';
    if (probability >= 75) return 'commit';
    if (probability >= 50) return 'best_case';
    return 'pipeline';
  }

  private validateStageRequirements(
    opp: Record<string, any>,
    requiredFields: string[],
    providedFields?: Record<string, unknown>,
  ): string[] {
    const missing: string[] = [];

    for (const req of requiredFields) {
      if (req.includes('||')) {
        const alternatives = req.split('||');
        const hasAny = alternatives.some(f => {
          const val = opp[f] || opp.customFields?.[f] || providedFields?.[f];
          return val !== null && val !== undefined && String(val).trim() !== '';
        });
        if (!hasAny) missing.push(req);
      } else {
        let value = opp[req] || opp.customFields?.[req] || providedFields?.[req];
        if (value === null || value === undefined || String(value).trim() === '') {
          missing.push(req);
        }
      }
    }

    return missing;
  }

  private formatOpportunity(o: Record<string, any>) {
    return {
      id: o.id,
      name: o.name,
      pipelineId: o.pipeline_id,
      pipeline: o.pipeline_name ? { id: o.pipeline_id, name: o.pipeline_name } : null,
      stageId: o.stage_id,
      stage: o.stage_name ? {
        id: o.stage_id,
        name: o.stage_name,
        slug: o.stage_slug,
        color: o.stage_color,
        sortOrder: o.stage_sort_order,
        isWon: o.stage_is_won,
        isLost: o.stage_is_lost,
        probability: o.stage_probability,
      } : null,
      amount: o.amount ? parseFloat(o.amount) : null,
      currency: o.currency || 'USD',
      closeDate: o.close_date,
      probability: o.probability,
      weightedAmount: o.weighted_amount ? parseFloat(o.weighted_amount) : null,
      forecastCategory: o.forecast_category,
      ownerId: o.owner_id,
      owner: o.owner_first_name ? {
        id: o.owner_id,
        firstName: o.owner_first_name,
        lastName: o.owner_last_name,
        avatarUrl: o.owner_avatar,
      } : null,
      accountId: o.account_id,
      account: o.account_name ? {
        id: o.account_id,
        name: o.account_name,
        logoUrl: o.account_logo,
      } : null,
      primaryContactId: o.primary_contact_id,
      primaryContact: o.contact_first_name ? {
        id: o.primary_contact_id,
        firstName: o.contact_first_name,
        lastName: o.contact_last_name,
        email: o.contact_email,
      } : null,
      priorityId: o.priority_id,
      priority: o.priority_name ? {
        id: o.priority_id,
        name: o.priority_name,
        color: o.priority_color,
        icon: o.priority_icon,
      } : null,
      type: o.type,
      source: o.source,
      leadId: o.lead_id,
      closeReasonId: o.close_reason_id,
      closeReason: o.close_reason_name ? {
        id: o.close_reason_id,
        name: o.close_reason_name,
        type: o.close_reason_type,
      } : null,
      closeNotes: o.close_notes,
      competitor: o.competitor,
      nextStep: o.next_step,
      description: o.description,
      tags: o.tags || [],
      customFields: o.custom_fields || {},
      stageEnteredAt: o.stage_entered_at,
      lastActivityAt: o.last_activity_at,
      wonAt: o.won_at,
      lostAt: o.lost_at,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      createdBy: o.created_by,
      createdByUser: o.created_by_first_name ? {
        id: o.created_by,
        firstName: o.created_by_first_name,
        lastName: o.created_by_last_name,
      } : null,
    };
  }
}