// ============================================================
// FILE: apps/api/src/modules/leads/lead-settings.service.ts
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
  // LEAD STAGES
  // ============================================================
  async getStages(schemaName: string) {
    const stages = await this.dataSource.query(
      `SELECT ls.*, 
              (SELECT COUNT(*) FROM "${schemaName}".leads l WHERE l.stage_id = ls.id AND l.deleted_at IS NULL) as lead_count
       FROM "${schemaName}".lead_stages ls
       ORDER BY ls.sort_order ASC`,
    );
    return stages.map((s: any) => this.formatStage(s));
  }

  async createStage(schemaName: string, data: any, userId: string) {
    // Get max sort_order
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
       FROM "${schemaName}".lead_stages WHERE is_won = false AND is_lost = false`,
    );

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    const [stage] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_stages 
       (name, slug, color, description, sort_order, required_fields, visible_fields, auto_actions, lock_previous_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name,
        slug,
        data.color || '#3B82F6',
        data.description || null,
        data.sortOrder ?? maxOrder.next_order,
        JSON.stringify(data.requiredFields || []),
        JSON.stringify(data.visibleFields || []),
        JSON.stringify(data.autoActions || []),
        data.lockPreviousFields || false,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_stages',
      entityId: stage.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name, color: data.color, sortOrder: stage.sort_order },
      performedBy: userId,
    });

    return this.formatStage(stage);
  }

  async updateStage(schemaName: string, id: string, data: any, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_stages WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Stage not found');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      name: 'name', color: 'color', description: 'description',
      sortOrder: 'sort_order', isActive: 'is_active',
      lockPreviousFields: 'lock_previous_fields',
    };

    for (const [key, col] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    // JSONB fields
    for (const jsonField of ['requiredFields', 'visibleFields', 'autoActions']) {
      if (data[jsonField] !== undefined) {
        const col = jsonField.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
        updates.push(`${col} = $${idx}`);
        params.push(JSON.stringify(data[jsonField]));
        idx++;
      }
    }

    if (data.name && !existing.is_system) {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      updates.push(`slug = $${idx}`);
      params.push(slug);
      idx++;
    }

    if (updates.length === 0) return this.formatStage(existing);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schemaName}".lead_stages SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    // Build changes for audit
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(fields)) {
      if (data[key] !== undefined && data[key] !== existing[fields[key]]) {
        changes[key] = { from: existing[fields[key]], to: data[key] };
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.auditService.log(schemaName, {
        entityType: 'lead_stages',
        entityId: id,
        action: 'update',
        changes,
        performedBy: userId,
      });
    }

    return this.formatStage(updated);
  }

  async deleteStage(schemaName: string, id: string, userId: string) {
    const [stage] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_stages WHERE id = $1`, [id],
    );
    if (!stage) throw new NotFoundException('Stage not found');
    if (stage.is_system) throw new BadRequestException('Cannot delete system stages');

    // Check if any leads are in this stage
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".leads WHERE stage_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete stage — ${count} lead(s) are in this stage`);
    }

    await this.dataSource.query(`DELETE FROM "${schemaName}".lead_stages WHERE id = $1`, [id]);

    await this.auditService.log(schemaName, {
      entityType: 'lead_stages',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: { name: stage.name, color: stage.color },
      performedBy: userId,
    });

    return { message: 'Stage deleted successfully' };
  }

  async reorderStages(schemaName: string, orderedIds: string[], userId: string) {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".lead_stages SET sort_order = $1 WHERE id = $2`,
        [i + 1, orderedIds[i]],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'lead_stages',
      entityId: 'bulk',
      action: 'update',
      changes: { sortOrder: { from: null, to: orderedIds } },
      performedBy: userId,
      metadata: { action: 'reorder', count: orderedIds.length },
    });

    return this.getStages(schemaName);
  }

  // ============================================================
  // STAGE FIELDS
  // ============================================================
  async getStageFields(schemaName: string, stageId: string) {
    const fields = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_stage_fields WHERE stage_id = $1 ORDER BY sort_order ASC`,
      [stageId],
    );
    return fields.map((f: any) => ({
      id: f.id, stageId: f.stage_id, fieldKey: f.field_key, fieldLabel: f.field_label,
      fieldType: f.field_type, fieldOptions: f.field_options,
      isRequired: f.is_required, isVisible: f.is_visible, sortOrder: f.sort_order,
    }));
  }

  async upsertStageFields(schemaName: string, stageId: string, fields: any[], userId: string) {
    // Delete existing
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_stage_fields WHERE stage_id = $1`, [stageId],
    );

    // Insert new
    for (const f of fields) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".lead_stage_fields
         (stage_id, field_key, field_label, field_type, field_options, is_required, is_visible, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [stageId, f.fieldKey, f.fieldLabel, f.fieldType || 'text', JSON.stringify(f.fieldOptions || []),
         f.isRequired || false, f.isVisible !== false, f.sortOrder || 0],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'lead_stage_fields',
      entityId: stageId,
      action: 'update',
      changes: { fields: { from: null, to: fields.map(f => f.fieldKey) } },
      performedBy: userId,
      metadata: { action: 'upsert_stage_fields', fieldCount: fields.length },
    });

    return this.getStageFields(schemaName, stageId);
  }

  // ============================================================
  // LEAD PRIORITIES
  // ============================================================
  async getPriorities(schemaName: string) {
    const priorities = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities ORDER BY sort_order ASC`,
    );
    return priorities.map((p: any) => ({
      id: p.id, name: p.name, color: p.color, icon: p.icon,
      sortOrder: p.sort_order, isDefault: p.is_default, isSystem: p.is_system,
      isActive: p.is_active, scoreMin: p.score_min, scoreMax: p.score_max,
    }));
  }

  async createPriority(schemaName: string, data: any, userId: string) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".lead_priorities`,
    );

    const [priority] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_priorities 
       (name, color, icon, sort_order, is_default, score_min, score_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.name, data.color, data.icon || null, data.sortOrder ?? maxOrder.next,
       data.isDefault || false, data.scoreMin ?? null, data.scoreMax ?? null],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_priorities',
      entityId: priority.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name, color: data.color },
      performedBy: userId,
    });

    return priority;
  }

  async updatePriority(schemaName: string, id: string, data: any, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities WHERE id = $1`, [id],
    );

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', color: 'color', icon: 'icon',
      sortOrder: 'sort_order', isDefault: 'is_default', isActive: 'is_active',
      scoreMin: 'score_min', scoreMax: 'score_max',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (sets.length === 0) return;

    // If setting as default, unset others
    if (data.isDefault) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".lead_priorities SET is_default = false`,
      );
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schemaName}".lead_priorities SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    // Build changes
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (existing) {
      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined && data[key] !== existing[col]) {
          changes[key] = { from: existing[col], to: data[key] };
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await this.auditService.log(schemaName, {
        entityType: 'lead_priorities',
        entityId: id,
        action: 'update',
        changes,
        performedBy: userId,
      });
    }

    return updated;
  }

  async deletePriority(schemaName: string, id: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_priorities WHERE id = $1`, [id],
    );

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_priorities WHERE id = $1 AND is_system = false`, [id],
    );

    if (existing) {
      await this.auditService.log(schemaName, {
        entityType: 'lead_priorities',
        entityId: id,
        action: 'delete',
        changes: {},
        previousValues: { name: existing.name, color: existing.color },
        performedBy: userId,
      });
    }

    return { message: 'Priority deleted' };
  }

  // ============================================================
  // SCORING TEMPLATES & RULES
  // ============================================================
  async getScoringTemplates(schemaName: string) {
    const templates = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_scoring_templates ORDER BY created_at ASC`,
    );

    for (const t of templates) {
      const rules = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".lead_scoring_rules WHERE template_id = $1 ORDER BY sort_order ASC`,
        [t.id],
      );
      t.rules = rules.map((r: any) => ({
        id: r.id, name: r.name, category: r.category, type: r.type,
        fieldKey: r.field_key, operator: r.operator, value: r.value,
        scoreDelta: r.score_delta, isActive: r.is_active, sortOrder: r.sort_order,
      }));
    }

    return templates.map((t: any) => ({
      id: t.id, name: t.name, description: t.description,
      maxScore: t.max_score, isActive: t.is_active, isDefault: t.is_default,
      rules: t.rules,
    }));
  }

  async createScoringRule(schemaName: string, templateId: string, data: any, userId: string) {
    const [rule] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_scoring_rules
       (template_id, name, category, type, field_key, operator, value, score_delta, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [templateId, data.name, data.category || 'demographic', data.type || 'field_match',
       data.fieldKey, data.operator, JSON.stringify(data.value), data.scoreDelta, data.sortOrder || 0],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_scoring_rules',
      entityId: rule.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name, fieldKey: data.fieldKey, scoreDelta: data.scoreDelta },
      performedBy: userId,
    });

    return rule;
  }

  async updateScoringRule(schemaName: string, ruleId: string, data: any, userId: string) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, col] of Object.entries({
      name: 'name', category: 'category', type: 'type',
      fieldKey: 'field_key', operator: 'operator',
      scoreDelta: 'score_delta', isActive: 'is_active', sortOrder: 'sort_order',
    })) {
      if (data[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (data.value !== undefined) {
      sets.push(`value = $${idx}`);
      params.push(JSON.stringify(data.value));
      idx++;
    }

    if (sets.length === 0) return;
    sets.push(`updated_at = NOW()`);
    params.push(ruleId);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schemaName}".lead_scoring_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_scoring_rules',
      entityId: ruleId,
      action: 'update',
      changes: {},
      newValues: data,
      performedBy: userId,
    });

    return updated;
  }

  async deleteScoringRule(schemaName: string, ruleId: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".lead_scoring_rules WHERE id = $1`, [ruleId],
    );

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_scoring_rules WHERE id = $1`, [ruleId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_scoring_rules',
      entityId: ruleId,
      action: 'delete',
      changes: {},
      previousValues: { name: existing?.name },
      performedBy: userId,
    });

    return { message: 'Scoring rule deleted' };
  }

  // ============================================================
  // ROUTING RULES
  // ============================================================
  async getRoutingRules(schemaName: string) {
    const rules = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_routing_rules ORDER BY priority DESC, created_at ASC`,
    );
    return rules.map((r: any) => ({
      id: r.id, name: r.name, description: r.description, priority: r.priority,
      conditions: r.conditions, assignmentType: r.assignment_type,
      assignedTo: r.assigned_to, isActive: r.is_active,
    }));
  }

  async createRoutingRule(schemaName: string, data: any, userId: string) {
    const [rule] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_routing_rules
       (name, description, priority, conditions, assignment_type, assigned_to, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.name, data.description || null, data.priority || 0,
       JSON.stringify(data.conditions || []), data.assignmentType,
       JSON.stringify(data.assignedTo || []), data.isActive !== false],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_routing_rules',
      entityId: rule.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name, assignmentType: data.assignmentType },
      performedBy: userId,
    });

    return rule;
  }

  async updateRoutingRule(schemaName: string, ruleId: string, data: any, userId: string) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const simpleFields: Record<string, string> = {
      name: 'name', description: 'description', priority: 'priority',
      assignmentType: 'assignment_type', isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(simpleFields)) {
      if (data[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (data.conditions !== undefined) {
      sets.push(`conditions = $${idx}`);
      params.push(JSON.stringify(data.conditions));
      idx++;
    }
    if (data.assignedTo !== undefined) {
      sets.push(`assigned_to = $${idx}`);
      params.push(JSON.stringify(data.assignedTo));
      idx++;
    }

    if (sets.length === 0) return;
    sets.push(`updated_at = NOW()`);
    params.push(ruleId);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schemaName}".lead_routing_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_routing_rules',
      entityId: ruleId,
      action: 'update',
      changes: {},
      newValues: data,
      performedBy: userId,
    });

    return updated;
  }

  async deleteRoutingRule(schemaName: string, ruleId: string, userId: string) {
    const [existing] = await this.dataSource.query(
      `SELECT name FROM "${schemaName}".lead_routing_rules WHERE id = $1`, [ruleId],
    );

    await this.dataSource.query(
      `DELETE FROM "${schemaName}".lead_routing_rules WHERE id = $1`, [ruleId],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_routing_rules',
      entityId: ruleId,
      action: 'delete',
      changes: {},
      previousValues: { name: existing?.name },
      performedBy: userId,
    });

    return { message: 'Routing rule deleted' };
  }

  // ============================================================
  // QUALIFICATION FRAMEWORKS
  // ============================================================
  async getQualificationFrameworks(schemaName: string) {
    const frameworks = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".lead_qualification_frameworks ORDER BY sort_order ASC`,
    );

    for (const fw of frameworks) {
      const fields = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".lead_qualification_fields WHERE framework_id = $1 ORDER BY sort_order ASC`,
        [fw.id],
      );
      fw.fields = fields.map((f: any) => ({
        id: f.id, fieldKey: f.field_key, fieldLabel: f.field_label,
        fieldType: f.field_type, fieldOptions: f.field_options,
        description: f.description, scoreWeight: f.score_weight,
        sortOrder: f.sort_order, isRequired: f.is_required,
      }));
    }

    return frameworks.map((fw: any) => ({
      id: fw.id, name: fw.name, slug: fw.slug, description: fw.description,
      isActive: fw.is_active, isSystem: fw.is_system, sortOrder: fw.sort_order,
      fields: fw.fields,
    }));
  }

  async setActiveFramework(schemaName: string, frameworkId: string, userId: string) {
    // Deactivate all
    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_qualification_frameworks SET is_active = false`,
    );
    // Activate selected
    await this.dataSource.query(
      `UPDATE "${schemaName}".lead_qualification_frameworks SET is_active = true WHERE id = $1`,
      [frameworkId],
    );

    // Update settings
    const [fw] = await this.dataSource.query(
      `SELECT slug, name FROM "${schemaName}".lead_qualification_frameworks WHERE id = $1`, [frameworkId],
    );
    if (fw) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".lead_settings 
         SET setting_value = jsonb_set(setting_value, '{activeQualificationFramework}', $1::jsonb)
         WHERE setting_key = 'general'`,
        [JSON.stringify(fw.slug)],
      );
    }

    await this.auditService.log(schemaName, {
      entityType: 'lead_qualification_frameworks',
      entityId: frameworkId,
      action: 'update',
      changes: { isActive: { from: false, to: true } },
      performedBy: userId,
      metadata: { action: 'activate_framework', frameworkName: fw?.name },
    });

    return { message: 'Active framework updated' };
  }

  // ============================================================
  // DISQUALIFICATION REASONS
  // ============================================================
  async getDisqualificationReasons(schemaName: string) {
    return this.dataSource.query(
      `SELECT id, name, description, is_system, is_active, sort_order
       FROM "${schemaName}".lead_disqualification_reasons
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );
  }

  async createDisqualificationReason(schemaName: string, data: { name: string; description?: string }, userId: string) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".lead_disqualification_reasons`,
    );
    const [reason] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_disqualification_reasons (name, description, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.description || null, maxOrder.next],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_disqualification_reasons',
      entityId: reason.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name },
      performedBy: userId,
    });

    return reason;
  }

  // ============================================================
  // LEAD SOURCES
  // ============================================================
  async getSources(schemaName: string) {
    return this.dataSource.query(
      `SELECT id, name, description, is_system, is_active, sort_order
       FROM "${schemaName}".lead_sources
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );
  }

  async createSource(schemaName: string, data: { name: string; description?: string }, userId: string) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM "${schemaName}".lead_sources`,
    );
    const [source] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_sources (name, description, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.description || null, maxOrder.next],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_sources',
      entityId: source.id,
      action: 'create',
      changes: {},
      newValues: { name: data.name },
      performedBy: userId,
    });

    return source;
  }

  // ============================================================
  // LEAD SETTINGS (key-value config)
  // ============================================================
  async getSettings(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT setting_key, setting_value FROM "${schemaName}".lead_settings`,
    );
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
    return settings;
  }

  async updateSetting(schemaName: string, key: string, value: any, userId: string) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".lead_settings (setting_key, setting_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );

    await this.auditService.log(schemaName, {
      entityType: 'lead_settings',
      entityId: key,
      action: 'update',
      changes: { [key]: { from: null, to: value } },
      performedBy: userId,
    });

    return { message: 'Setting updated' };
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private formatStage(s: Record<string, unknown>) {
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      description: s.description,
      sortOrder: s.sort_order,
      isSystem: s.is_system,
      isActive: s.is_active,
      isWon: s.is_won,
      isLost: s.is_lost,
      requiredFields: s.required_fields,
      visibleFields: s.visible_fields,
      autoActions: s.auto_actions,
      lockPreviousFields: s.lock_previous_fields,
      leadCount: parseInt(String(s.lead_count || 0), 10),
    };
  }
}