import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class WorkflowsService {
  constructor(private readonly dataSource: DataSource) {}

  // ── LIST ─────────────────────────────────────────────────────
  async list(schema: string, module?: string) {
    const where = module ? `WHERE trigger_module = $1` : '';
    const params = module ? [module] : [];
    const rows = await this.dataSource.query(
      `SELECT w.*,
              (SELECT COUNT(*) FROM "${schema}".workflow_actions wa WHERE wa.workflow_id = w.id) AS action_count
       FROM "${schema}".workflows w
       ${where}
       ORDER BY w.updated_at DESC`,
      params,
    );
    return rows.map(this.mapWorkflow);
  }

  // ── GET ONE ──────────────────────────────────────────────────
  async getOne(schema: string, id: string) {
    const [wf] = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflows WHERE id = $1`, [id],
    );
    if (!wf) throw new NotFoundException('Workflow not found');

    const actions = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflow_actions
       WHERE workflow_id = $1 ORDER BY sort_order ASC`,
      [id],
    );

    return { ...this.mapWorkflow(wf), actions: actions.map(this.mapAction) };
  }

  // ── CREATE ───────────────────────────────────────────────────
  async create(schema: string, data: any, userId: string) {
    const [wf] = await this.dataSource.query(
      `INSERT INTO "${schema}".workflows
         (name, description, trigger_module, trigger_type, trigger_filters, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.triggerModule,
        data.triggerType,
        JSON.stringify(data.triggerFilters ?? { match: 'all', items: [] }),
        data.isActive ?? true,
        userId,
      ],
    );

    if (data.actions?.length) {
      await this.replaceActions(schema, wf.id, data.actions);
    }

    return this.getOne(schema, wf.id);
  }

  // ── UPDATE ───────────────────────────────────────────────────
  async update(schema: string, id: string, data: any) {
    const [exists] = await this.dataSource.query(
      `SELECT id FROM "${schema}".workflows WHERE id = $1`, [id],
    );
    if (!exists) throw new NotFoundException('Workflow not found');

    const sets: string[] = ['updated_at = NOW()', 'version = version + 1'];
    const params: unknown[] = [];
    let i = 1;

    const map: Record<string, string> = {
      name: 'name', description: 'description',
      triggerModule: 'trigger_module', triggerType: 'trigger_type',
      isActive: 'is_active',
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { sets.push(`${col} = $${i++}`); params.push(data[k]); }
    }
    if (data.triggerFilters !== undefined) {
      sets.push(`trigger_filters = $${i++}`);
      params.push(JSON.stringify(data.triggerFilters));
    }

    params.push(id);
    await this.dataSource.query(
      `UPDATE "${schema}".workflows SET ${sets.join(', ')} WHERE id = $${i}`,
      params,
    );

    if (data.actions !== undefined) {
      await this.replaceActions(schema, id, data.actions);
    }

    return this.getOne(schema, id);
  }

  // ── DELETE ───────────────────────────────────────────────────
  async delete(schema: string, id: string) {
    const [exists] = await this.dataSource.query(
      `SELECT id FROM "${schema}".workflows WHERE id = $1`, [id],
    );
    if (!exists) throw new NotFoundException('Workflow not found');
    await this.dataSource.query(
      `DELETE FROM "${schema}".workflows WHERE id = $1`, [id],
    );
    return { success: true };
  }

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────
  async toggleActive(schema: string, id: string, isActive: boolean) {
    await this.dataSource.query(
      `UPDATE "${schema}".workflows SET is_active = $1, updated_at = NOW() WHERE id = $2`,
      [isActive, id],
    );
    return this.getOne(schema, id);
  }

  // ── RUN HISTORY ───────────────────────────────────────────────
  async getRuns(schema: string, workflowId: string, page = 1, limit = 25) {
    const offset = (page - 1) * limit;
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM "${schema}".workflow_runs WHERE workflow_id = $1`,
      [workflowId],
    );
    const runs = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflow_runs
       WHERE workflow_id = $1
       ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
      [workflowId, limit, offset],
    );
    return { data: runs.map(this.mapRun), total: parseInt(total), page, limit };
  }

  async getRunDetail(schema: string, runId: string) {
    const [run] = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflow_runs WHERE id = $1`, [runId],
    );
    if (!run) throw new NotFoundException('Run not found');
    const steps = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflow_run_steps
       WHERE run_id = $1 ORDER BY started_at ASC`,
      [runId],
    );
    return {
      ...this.mapRun(run),
      steps: steps.map((s: any) => ({
        id: s.id,
        runId: s.run_id,
        actionId: s.action_id,
        actionType: s.action_type,
        status: s.status,
        result: typeof s.result === 'string' ? JSON.parse(s.result) : (s.result || null),
        error: s.error,
        startedAt: s.started_at,
        finishedAt: s.finished_at,
      })),
    };
  }

  // ── INTERNAL: replace action list atomically ──────────────────
  async replaceActions(schema: string, workflowId: string, actions: any[]) {
    await this.dataSource.query(
      `DELETE FROM "${schema}".workflow_actions WHERE workflow_id = $1`, [workflowId],
    );
    // Insert top-level actions first, then branch children
    const topLevel = actions.filter(a => !a.parentActionId);
    const idMap = new Map<string, string>(); // tempId → real DB id

    for (const action of topLevel) {
      const [row] = await this.dataSource.query(
        `INSERT INTO "${schema}".workflow_actions
           (workflow_id, action_type, config, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [workflowId, action.actionType, JSON.stringify(action.config ?? {}), action.sortOrder ?? 0],
      );
      if (action.tempId) idMap.set(action.tempId, row.id);
    }

    // Branch children
    const children = actions.filter(a => a.parentActionId);
    for (const action of children) {
      const realParentId = idMap.get(action.parentActionId) ?? action.parentActionId;
      await this.dataSource.query(
        `INSERT INTO "${schema}".workflow_actions
           (workflow_id, action_type, config, sort_order, parent_action_id, branch)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          workflowId, action.actionType,
          JSON.stringify(action.config ?? {}),
          action.sortOrder ?? 0,
          realParentId,
          action.branch ?? null,
        ],
      );
    }
  }

  // ── Mappers ──────────────────────────────────────────────────
  private mapWorkflow(r: any) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      triggerModule: r.trigger_module,
      triggerType: r.trigger_type,
      triggerFilters: r.trigger_filters,
      isActive: r.is_active,
      version: r.version,
      actionCount: r.action_count !== undefined ? parseInt(r.action_count) : undefined,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapAction(r: any) {
    return {
      id: r.id,
      workflowId: r.workflow_id,
      actionType: r.action_type,
      config: r.config,
      sortOrder: r.sort_order,
      parentActionId: r.parent_action_id,
      branch: r.branch,
    };
  }

  private mapRun(r: any) {
    return {
      id: r.id,
      workflowId: r.workflow_id,
      triggerModule: r.trigger_module,
      triggerType: r.trigger_type,
      triggerEntityId: r.trigger_entity_id,
      status: r.status,
      error: r.error,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
    };
  }
}
