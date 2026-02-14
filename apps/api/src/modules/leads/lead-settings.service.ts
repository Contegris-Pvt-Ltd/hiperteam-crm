// ============================================================
// FILE: apps/api/src/modules/leads/services/lead-settings.service.ts
//
// REPLACES the existing lead-settings.service.ts
//
// CHANGES:
//   ✅ NEW: getPipelines, createPipeline, updatePipeline, deletePipeline, setDefaultPipeline
//   ✅ MODIFIED: getStages now accepts pipelineId + module params
//   ✅ MODIFIED: createStage now requires pipelineId + module
//   ✅ MODIFIED: All stage queries use pipeline_stages instead of lead_stages
//   ✅ MODIFIED: All stage field queries use pipeline_stage_fields instead of lead_stage_fields
//   ✅ PRESERVED: All priority, scoring, routing, qualification, sources, settings methods unchanged
// ============================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';

@Injectable()
export class LeadSettingsService {
  private readonly logger = new Logger(LeadSettingsService.name);

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
  ) {}

  // ============================================================
  // PIPELINES (shared — leads + opportunities)
  // ============================================================
  async getPipelines(schemaName: string) {
    const pipelines = await this.dataSource.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM "${schemaName}".pipeline_stages ps
               WHERE ps.pipeline_id = p.id AND ps.module = 'leads' AND ps.is_active = true) as lead_stage_count,
              (SELECT COUNT(*) FROM "${schemaName}".pipeline_stages ps
               WHERE ps.pipeline_id = p.id AND ps.module = 'opportunities' AND ps.is_active = true) as opp_stage_count,
              (SELECT COUNT(*) FROM "${schemaName}".leads l
               WHERE l.pipeline_id = p.id AND l.deleted_at IS NULL) as lead_count
       FROM "${schemaName}".pipelines p
       ORDER BY p.sort_order ASC, p.created_at ASC`,
    );
    return pipelines.map((p: any) => this.formatPipeline(p));
  }

  async getPipeline(schemaName: string, id: string) {
    const [pipeline] = await this.dataSource.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM "${schemaName}".pipeline_stages ps
               WHERE ps.pipeline_id = p.id AND ps.module = 'leads' AND ps.is_active = true) as lead_stage_count,
              (SELECT COUNT(*) FROM "${schemaName}".pipeline_stages ps
               WHERE ps.pipeline_id = p.id AND ps.module = 'opportunities' AND ps.is_active = true) as opp_stage_count
       FROM "${schemaName}".pipelines p WHERE p.id = $1`,
      [id],
    );
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return this.formatPipeline(pipeline);
  }

  async createPipeline(schemaName: string, data: any, userId: string) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".pipelines`,
    );

    const [pipeline] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".pipelines (name, description, is_default, is_active, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.isDefault || false,
        data.isActive ?? true,
        data.sortOrder ?? maxOrder.next_order,
        userId,
      ],
    );

    // If this is set as default, unset others
    if (data.isDefault) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".pipelines SET is_default = false WHERE id != $1`,
        [pipeline.id],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'pipelines',
      entityId: pipeline.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name },
      performedBy: userId,
    });

    return this.formatPipeline(pipeline);
  }

  async updatePipeline(schemaName: string, id: string, data: any, userId: string) {
    const existing = await this.getPipeline(schemaName, id);

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', description: 'description',
      isActive: 'is_active', sortOrder: 'sort_order',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (data.isDefault === true) {
      // Unset all others first
      await this.dataSource.query(
        `UPDATE "${schemaName}".pipelines SET is_default = false WHERE id != $1`,
        [id],
      );
      updates.push(`is_default = $${idx}`);
      params.push(true);
      idx++;
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".pipelines SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.auditService.log(schemaName, {
      entityType: 'pipelines',
      entityId: id,
      action: 'update',
      changes: {},
      newValues: data,
      performedBy: userId,
    });

    return this.getPipeline(schemaName, id);
  }

  async deletePipeline(schemaName: string, id: string) {
    const pipeline = await this.getPipeline(schemaName, id);
    if (pipeline.isDefault) {
      throw new BadRequestException('Cannot delete the default pipeline. Set another pipeline as default first.');
    }

    // Check for leads using this pipeline
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".leads WHERE pipeline_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(usage.count, 10) > 0) {
      throw new BadRequestException(`Cannot delete pipeline — ${usage.count} lead(s) are still assigned to it.`);
    }

    // CASCADE will delete pipeline_stages + pipeline_stage_fields
    await this.dataSource.query(`DELETE FROM "${schemaName}".pipelines WHERE id = $1`, [id]);
    return { success: true };
  }

  async setDefaultPipeline(schemaName: string, id: string, userId: string) {
    await this.getPipeline(schemaName, id); // existence check
    await this.dataSource.query(`UPDATE "${schemaName}".pipelines SET is_default = false`, []);
    await this.dataSource.query(`UPDATE "${schemaName}".pipelines SET is_default = true WHERE id = $1`, [id]);

    await this.auditService.log(schemaName, {
      entityType: 'pipelines',
      entityId: id,
      action: 'update',
      changes: {},
      newValues: { isDefault: true },
      performedBy: userId,
    });

    return this.getPipeline(schemaName, id);
  }

  // ============================================================
  // PIPELINE STAGES (replaces lead_stages)
  // ============================================================
  async getStages(schemaName: string, pipelineId?: string, module: string = 'leads') {
    let whereClause = `WHERE ps.module = $1`;
    const params: unknown[] = [module];

    if (pipelineId) {
      whereClause += ` AND ps.pipeline_id = $2`;
      params.push(pipelineId);
    } else {
      // Default: use default pipeline
      whereClause += ` AND ps.pipeline_id = (SELECT id FROM "${schemaName}".pipelines WHERE is_default = true LIMIT 1)`;
    }

    const stages = await this.dataSource.query(
      `SELECT ps.*,
              p.name as pipeline_name,
              (SELECT COUNT(*) FROM "${schemaName}".leads l
               WHERE l.stage_id = ps.id AND l.deleted_at IS NULL) as lead_count
       FROM "${schemaName}".pipeline_stages ps
       LEFT JOIN "${schemaName}".pipelines p ON p.id = ps.pipeline_id
       ${whereClause}
       ORDER BY ps.sort_order ASC`,
      params,
    );
    return stages.map((s: any) => this.formatStage(s));
  }

  async createStage(schemaName: string, data: any, userId: string) {
    // Determine pipeline (use provided or default)
    let pipelineId = data.pipelineId;
    if (!pipelineId) {
      const [defaultPipeline] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".pipelines WHERE is_default = true LIMIT 1`,
      );
      if (!defaultPipeline) throw new BadRequestException('No default pipeline found');
      pipelineId = defaultPipeline.id;
    }

    const module = data.module || 'leads';

    // Get max sort_order for non-terminal stages in this pipeline+module
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
       FROM "${schemaName}".pipeline_stages
       WHERE pipeline_id = $1 AND module = $2 AND is_won = false AND is_lost = false`,
      [pipelineId, module],
    );

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const [stage] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".pipeline_stages
       (pipeline_id, module, name, slug, color, description, probability,
        sort_order, required_fields, visible_fields, auto_actions, exit_criteria, lock_previous_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        pipelineId,
        module,
        data.name,
        slug,
        data.color || '#3B82F6',
        data.description || null,
        data.probability ?? 0,
        data.sortOrder ?? maxOrder.next_order,
        JSON.stringify(data.requiredFields || []),
        JSON.stringify(data.visibleFields || []),
        JSON.stringify(data.autoActions || []),
        JSON.stringify(data.exitCriteria || []),
        data.lockPreviousFields || false,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'pipeline_stages',
      entityId: stage.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name, pipeline: pipelineId, module },
      performedBy: userId,
    });

    return this.formatStage(stage);
  }

  async updateStage(schemaName: string, id: string, data: any, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Stage not found');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', color: 'color', description: 'description',
      probability: 'probability', sortOrder: 'sort_order',
      isActive: 'is_active', lockPreviousFields: 'lock_previous_fields',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    // JSONB fields
    for (const jsonField of ['requiredFields', 'visibleFields', 'autoActions', 'exitCriteria']) {
      if (data[jsonField] !== undefined) {
        const col = jsonField.replace(/[A-Z]/g, (l: string) => `_${l.toLowerCase()}`);
        updates.push(`${col} = $${idx}`);
        params.push(JSON.stringify(data[jsonField]));
        idx++;
      }
    }

    if (updates.length === 0) return this.formatStage(existing);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".pipeline_stages SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    await this.auditService.log(schemaName, {
      entityType: 'pipeline_stages',
      entityId: id,
      action: 'update',
      changes: {},
      newValues: data,
      performedBy: userId,
    });

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1`, [id],
    );
    return this.formatStage(updated);
  }

  async deleteStage(schemaName: string, id: string) {
    const [stage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".pipeline_stages WHERE id = $1`, [id],
    );
    if (!stage) throw new NotFoundException('Stage not found');

    // Check for leads in this stage
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".leads WHERE stage_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(usage.count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${usage.count} lead(s) are in this stage. Move them first.`);
    }

    // CASCADE deletes pipeline_stage_fields
    await this.dataSource.query(`DELETE FROM "${schemaName}".pipeline_stages WHERE id = $1`, [id]);
    return { success: true };
  }

  async reorderStages(schemaName: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".pipeline_stages SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [i + 1, orderedIds[i]],
      );
    }
    // Return stages for the pipeline of the first stage
    if (orderedIds.length > 0) {
      const [first] = await this.dataSource.query(
        `SELECT pipeline_id, module FROM "${schemaName}".pipeline_stages WHERE id = $1`,
        [orderedIds[0]],
      );
      if (first) return this.getStages(schemaName, first.pipeline_id, first.module);
    }
    return [];
  }

  // ============================================================
  // STAGE FIELDS (now pipeline_stage_fields)
  // ============================================================
  async getStageFields(schemaName: string, stageId: string) {
    const fields = await this.dataSource.query(
      `SELECT sf.*
       FROM "${schemaName}".pipeline_stage_fields sf
       WHERE sf.stage_id = $1
       ORDER BY sf.sort_order ASC`,
      [stageId],
    );
    return fields.map((f: any) => ({
      id: f.id,
      stageId: f.stage_id,
      fieldKey: f.field_key,
      fieldLabel: f.field_label,
      fieldType: f.field_type,
      fieldOptions: f.field_options || [],
      isRequired: f.is_required,
      isVisible: f.is_visible,
      sortOrder: f.sort_order,
    }));
  }

  async upsertStageFields(schemaName: string, stageId: string, fields: any[], _userId?: string) {
    // Validate stage exists
    const [stage] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".pipeline_stages WHERE id = $1`, [stageId],
    );
    if (!stage) throw new NotFoundException('Stage not found');

    // Delete existing fields for this stage
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".pipeline_stage_fields WHERE stage_id = $1`,
      [stageId],
    );

    // Insert new fields
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".pipeline_stage_fields
         (stage_id, field_key, field_label, field_type, field_options, is_required, is_visible, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          stageId, f.fieldKey, f.fieldLabel, f.fieldType || 'text',
          JSON.stringify(f.fieldOptions || []),
          f.isRequired ?? false, f.isVisible ?? true, i,
        ],
      );
    }

    return this.getStageFields(schemaName, stageId);
  }

  // ============================================================
  // LEAD PRIORITIES (unchanged — still in lead_priorities table)
  // ============================================================
  async getPriorities(schemaName: string) {
    const priorities = await this.dataSource.query(
      `SELECT lp.*,
              (SELECT COUNT(*) FROM "${schemaName}".leads l WHERE l.priority_id = lp.id AND l.deleted_at IS NULL) as lead_count
       FROM "${schemaName}".lead_priorities lp
       ORDER BY lp.sort_order ASC`,
    );
    return priorities.map((p: any) => this.formatPriority(p));
  }

  async createPriority(schemaName: string, data: any) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".lead_priorities`,
    );

    const [priority] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_priorities (name, color, icon, sort_order, score_min, score_max)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.color || '#9CA3AF', data.icon || null, data.sortOrder ?? maxOrder.next_order, data.scoreMin ?? null, data.scoreMax ?? null],
    );
    return this.formatPriority(priority);
  }

  async updatePriority(schemaName: string, id: string, data: any) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Priority not found');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', color: 'color', icon: 'icon',
      sortOrder: 'sort_order', isActive: 'is_active',
      isDefault: 'is_default', scoreMin: 'score_min', scoreMax: 'score_max',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (updates.length === 0) return this.formatPriority(existing);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_priorities SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".lead_priorities SET is_default = false WHERE id != $1`, [id],
      );
    }

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities WHERE id = $1`, [id],
    );
    return this.formatPriority(updated);
  }

  async deletePriority(schemaName: string, id: string) {
    const [priority] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities WHERE id = $1`, [id],
    );
    if (!priority) throw new NotFoundException('Priority not found');
    await this.dataSource.query(`DELETE FROM "${schemaName}".lead_priorities WHERE id = $1`, [id]);
    return { success: true };
  }

  // ============================================================
  // SCORING TEMPLATES & RULES (unchanged)
  // ============================================================
  async getScoringTemplates(schemaName: string) {
    const templates = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_scoring_templates ORDER BY created_at ASC`,
    );

    const result = [];
    for (const t of templates) {
      const rules = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".lead_scoring_rules WHERE template_id = $1 ORDER BY sort_order ASC`,
        [t.id],
      );
      result.push({
        id: t.id, name: t.name, description: t.description,
        maxScore: t.max_score, isActive: t.is_active, isDefault: t.is_default,
        rules: rules.map((r: any) => ({
          id: r.id, name: r.name, category: r.category, type: r.type,
          fieldKey: r.field_key, operator: r.operator, value: r.value,
          scoreDelta: r.score_delta, isActive: r.is_active, sortOrder: r.sort_order,
        })),
      });
    }
    return result;
  }

  async createScoringRule(schemaName: string, templateId: string, data: any) {
    const [rule] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_scoring_rules
       (template_id, name, category, type, field_key, operator, value, score_delta, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [templateId, data.name, data.category, data.type, data.fieldKey, data.operator, JSON.stringify(data.value), data.scoreDelta, data.sortOrder || 0],
    );
    return rule;
  }

  async updateScoringRule(schemaName: string, ruleId: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', category: 'category', type: 'type',
      fieldKey: 'field_key', operator: 'operator', scoreDelta: 'score_delta',
      isActive: 'is_active', sortOrder: 'sort_order',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (data.value !== undefined) {
      updates.push(`value = $${idx}`);
      params.push(JSON.stringify(data.value));
      idx++;
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    params.push(ruleId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_scoring_rules SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_scoring_rules WHERE id = $1`, [ruleId],
    );
    return updated;
  }

  async deleteScoringRule(schemaName: string, ruleId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_scoring_rules WHERE id = $1`, [ruleId],
    );
    return { success: true };
  }

  // ============================================================
  // ROUTING RULES (unchanged)
  // ============================================================
  async getRoutingRules(schemaName: string) {
    const rules = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_routing_rules ORDER BY priority ASC`,
    );
    return rules.map((r: any) => ({
      id: r.id, name: r.name, description: r.description,
      priority: r.priority, conditions: r.conditions,
      assignmentType: r.assignment_type, assignedTo: r.assigned_to,
      roundRobinIndex: r.round_robin_index, isActive: r.is_active,
    }));
  }

  async createRoutingRule(schemaName: string, data: any) {
    const [rule] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_routing_rules
       (name, description, priority, conditions, assignment_type, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.description, data.priority || 0, JSON.stringify(data.conditions || []), data.assignmentType, JSON.stringify(data.assignedTo || [])],
    );
    return rule;
  }

  async updateRoutingRule(schemaName: string, ruleId: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', description: 'description', priority: 'priority',
      assignmentType: 'assignment_type', isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    for (const jsonField of ['conditions', 'assignedTo']) {
      if (data[jsonField] !== undefined) {
        const col = jsonField === 'assignedTo' ? 'assigned_to' : jsonField;
        updates.push(`${col} = $${idx}`);
        params.push(JSON.stringify(data[jsonField]));
        idx++;
      }
    }

    if (updates.length === 0) return;

    updates.push(`updated_at = NOW()`);
    params.push(ruleId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_routing_rules SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_routing_rules WHERE id = $1`, [ruleId],
    );
    return updated;
  }

  async deleteRoutingRule(schemaName: string, ruleId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_routing_rules WHERE id = $1`, [ruleId],
    );
    return { success: true };
  }

  // ============================================================
  // QUALIFICATION FRAMEWORKS (unchanged)
  // ============================================================
  async getQualificationFrameworks(schemaName: string) {
    const frameworks = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_qualification_frameworks ORDER BY sort_order ASC`,
    );
    const result = [];
    for (const f of frameworks) {
      const fields = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".lead_qualification_fields WHERE framework_id = $1 ORDER BY sort_order ASC`,
        [f.id],
      );
      result.push({
        id: f.id, name: f.name, slug: f.slug, description: f.description,
        isActive: f.is_active, isSystem: f.is_system,
        fields: fields.map((fld: any) => ({
          id: fld.id, fieldKey: fld.field_key, fieldLabel: fld.field_label,
          fieldType: fld.field_type, fieldOptions: fld.field_options,
          description: fld.description, scoreWeight: fld.score_weight,
          sortOrder: fld.sort_order, isRequired: fld.is_required,
        })),
      });
    }
    return result;
  }

  async setActiveFramework(schemaName: string, frameworkId: string) {
    // Deactivate all
    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_qualification_frameworks SET is_active = false`,
    );
    // Activate selected
    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_qualification_frameworks SET is_active = true WHERE id = $1`,
      [frameworkId],
    );
    // Update setting
    const [framework] = await this.dataSource.query(
      `SELECT slug FROM "${schemaName}".lead_qualification_frameworks WHERE id = $1`,
      [frameworkId],
    );
    if (framework) {
      await this.updateSetting(schemaName, 'general', {
        activeQualificationFramework: framework.slug,
      });
    }
    return this.getQualificationFrameworks(schemaName);
  }

  // ============================================================
  // DISQUALIFICATION REASONS (unchanged)
  // ============================================================
  async getDisqualificationReasons(schemaName: string) {
    const reasons = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_disqualification_reasons WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return reasons.map((r: any) => ({
      id: r.id, name: r.name, description: r.description,
      isSystem: r.is_system, sortOrder: r.sort_order,
    }));
  }

  async createDisqualificationReason(schemaName: string, data: { name: string; description?: string }) {
    const [reason] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_disqualification_reasons (name, description) VALUES ($1, $2) RETURNING *`,
      [data.name, data.description || null],
    );
    return reason;
  }

  // ============================================================
  // SOURCES (unchanged)
  // ============================================================
  async getSources(schemaName: string) {
    const sources = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_sources WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return sources.map((s: any) => ({
      id: s.id, name: s.name, description: s.description,
      isSystem: s.is_system, sortOrder: s.sort_order,
    }));
  }

  async createSource(schemaName: string, data: { name: string; description?: string }) {
    const [source] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_sources (name, description) VALUES ($1, $2) RETURNING *`,
      [data.name, data.description || null],
    );
    return source;
  }

  // ============================================================
  // SETTINGS (unchanged)
  // ============================================================
  async getSettings(schemaName: string) {
    const settings = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_settings ORDER BY setting_key ASC`,
    );
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.setting_key] = s.setting_value;
    }
    return result;
  }

  async updateSetting(schemaName: string, key: string, value: any) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_settings (setting_key, setting_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = "${schemaName}".lead_settings.setting_value || $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
    return this.getSettings(schemaName);
  }

  // ============================================================
  // FORMATTERS
  // ============================================================
  private formatPipeline(p: any) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.is_default,
      isActive: p.is_active,
      sortOrder: p.sort_order,
      leadStageCount: parseInt(p.lead_stage_count || '0', 10),
      oppStageCount: parseInt(p.opp_stage_count || '0', 10),
      leadCount: parseInt(p.lead_count || '0', 10),
      createdBy: p.created_by,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  private formatStage(s: any) {
    return {
      id: s.id,
      pipelineId: s.pipeline_id,
      pipelineName: s.pipeline_name || null,
      module: s.module,
      name: s.name,
      slug: s.slug,
      color: s.color,
      description: s.description,
      probability: s.probability || 0,
      sortOrder: s.sort_order,
      isSystem: s.is_system,
      isActive: s.is_active,
      isWon: s.is_won,
      isLost: s.is_lost,
      requiredFields: s.required_fields || [],
      visibleFields: s.visible_fields || [],
      autoActions: s.auto_actions || [],
      exitCriteria: s.exit_criteria || [],
      lockPreviousFields: s.lock_previous_fields,
      leadCount: parseInt(s.lead_count || '0', 10),
    };
  }

  private formatPriority(p: any) {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      sortOrder: p.sort_order,
      isDefault: p.is_default,
      isSystem: p.is_system,
      isActive: p.is_active,
      scoreMin: p.score_min,
      scoreMax: p.score_max,
      leadCount: parseInt(p.lead_count || '0', 10),
    };
  }
}