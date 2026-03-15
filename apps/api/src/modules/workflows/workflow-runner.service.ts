import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoutingAlgorithmsService } from './routing-algorithms.service';
import { EmailChannel } from '../notifications/channels/email.channel';
import { SmsWhatsAppChannel } from '../notifications/channels/sms-whatsapp.channel';

// ── Condition group evaluator types ─────────────────────────
interface Condition {
  type: 'condition';
  field: string;
  fieldType: 'system' | 'custom' | 'meta';
  operator: string;
  value: any;
}

interface ConditionGroup {
  match: 'all' | 'any';
  items: (Condition | ConditionGroup)[];
}

@Injectable()
export class WorkflowRunnerService {
  private readonly logger = new Logger(WorkflowRunnerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly routing: RoutingAlgorithmsService,
    private readonly emailChannel: EmailChannel,
    private readonly smsChannel: SmsWhatsAppChannel,
  ) {}

  // ============================================================
  // PUBLIC: trigger a workflow check for an entity event
  // ============================================================
  async trigger(
    schema: string,
    module: string,
    triggerType: string,
    entityId: string,
    entity: Record<string, any>,
    previousValues?: Record<string, any>,
    meta?: Record<string, any>,
  ): Promise<void> {
    // Find all active workflows matching this trigger
    const workflows = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflows
       WHERE trigger_module = $1
         AND trigger_type   = $2
         AND is_active      = true`,
      [module, triggerType],
    );

    if (!workflows.length) return;

    // Fetch custom fields for entity
    const customFields = entity.custom_fields ?? {};

    const payload = {
      triggerModule: module,
      triggerType,
      entityId,
      entity,
      customFields,
      previousValues: previousValues ?? {},
      meta: meta ?? {},
    };

    for (const workflow of workflows) {
      // Evaluate trigger_filters
      const filters: ConditionGroup = workflow.trigger_filters ?? { match: 'all', items: [] };
      if (!this.evaluateGroup(filters, payload)) continue;

      // Create a run record
      const [run] = await this.dataSource.query(
        `INSERT INTO "${schema}".workflow_runs
           (workflow_id, trigger_module, trigger_type, trigger_entity_id, trigger_payload, status)
         VALUES ($1,$2,$3,$4,$5,'running') RETURNING id`,
        [workflow.id, module, triggerType, entityId, JSON.stringify(payload)],
      );

      // Execute asynchronously — don't block the calling service
      this.executeRun(schema, run.id, workflow.id, payload).catch(err => {
        this.logger.error(`Workflow run ${run.id} failed: ${err.message}`, err.stack);
      });
    }
  }

  // ============================================================
  // EXECUTE a single run
  // ============================================================
  private async executeRun(
    schema: string,
    runId: string,
    workflowId: string,
    payload: any,
  ): Promise<void> {
    try {
      // Load top-level actions in order
      const actions = await this.dataSource.query(
        `SELECT * FROM "${schema}".workflow_actions
         WHERE workflow_id = $1 AND parent_action_id IS NULL
         ORDER BY sort_order ASC`,
        [workflowId],
      );

      await this.executeActions(schema, runId, actions, payload);

      await this.dataSource.query(
        `UPDATE "${schema}".workflow_runs
         SET status = 'completed', finished_at = NOW() WHERE id = $1`,
        [runId],
      );
    } catch (err: any) {
      await this.dataSource.query(
        `UPDATE "${schema}".workflow_runs
         SET status = 'failed', error = $1, finished_at = NOW() WHERE id = $2`,
        [err.message, runId],
      );
    }
  }

  // ============================================================
  // EXECUTE an ordered list of actions
  // ============================================================
  private async executeActions(
    schema: string,
    runId: string,
    actions: any[],
    payload: any,
  ): Promise<void> {
    for (const action of actions) {
      const [step] = await this.dataSource.query(
        `INSERT INTO "${schema}".workflow_run_steps
           (run_id, action_id, action_type, status, started_at)
         VALUES ($1,$2,$3,'running',NOW()) RETURNING id`,
        [runId, action.id, action.action_type],
      );

      try {
        const result = await this.executeAction(schema, action, payload, runId);

        await this.dataSource.query(
          `UPDATE "${schema}".workflow_run_steps
           SET status = 'completed', result = $1, finished_at = NOW() WHERE id = $2`,
          [JSON.stringify(result ?? {}), step.id],
        );

        // Merge any updated payload fields (e.g. after assign_owner updates entity)
        if (result?.payloadMerge) {
          payload = { ...payload, entity: { ...payload.entity, ...result.payloadMerge } };
        }
      } catch (err: any) {
        await this.dataSource.query(
          `UPDATE "${schema}".workflow_run_steps
           SET status = 'failed', error = $1, finished_at = NOW() WHERE id = $2`,
          [err.message, step.id],
        );
        throw err; // bubble up to mark run as failed
      }
    }
  }

  // ============================================================
  // DISPATCH a single action
  // ============================================================
  private async executeAction(
    schema: string,
    action: any,
    payload: any,
    runId: string,
  ): Promise<any> {
    const config = action.config ?? {};

    switch (action.action_type) {
      case 'assign_owner':      return this.actionAssignOwner(schema, action, config, payload);
      case 'create_task':       return this.actionCreateTask(schema, config, payload);
      case 'update_field':      return this.actionUpdateField(schema, config, payload);
      case 'add_tag':           return this.actionAddTag(schema, config, payload);
      case 'send_notification': return this.actionSendNotification(schema, config, payload);
      case 'webhook':           return this.actionWebhook(config, payload);
      case 'wait':              return this.actionWait(config);
      case 'branch':            return this.actionBranch(schema, action, config, payload, runId);
      case 'create_opportunity': return this.actionCreateOpportunity(schema, config, payload);
      case 'create_project':    return this.actionCreateProject(schema, config, payload);
      case 'send_email':        return this.actionSendEmail(schema, config, payload);
      case 'send_whatsapp':     return this.actionSendWhatsApp(schema, config, payload);
      case 'send_sms':          return this.actionSendSms(schema, config, payload);
      default:
        this.logger.warn(`Unknown action type: ${action.action_type}`);
        return { skipped: true };
    }
  }

  // ── ASSIGN OWNER ─────────────────────────────────────────────
  private async actionAssignOwner(schema: string, action: any, config: any, payload: any) {
    const userId = await this.routing.resolve(
      schema, action.workflow_id, action.id, config, payload,
    );
    if (!userId) return { skipped: true, reason: 'No user resolved' };

    const table = this.tableForModule(payload.triggerModule);
    await this.dataSource.query(
      `UPDATE "${schema}".${table} SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
      [userId, payload.entityId],
    );

    return { assignedUserId: userId, payloadMerge: { owner_id: userId } };
  }

  // ── CREATE TASK ───────────────────────────────────────────────
  private async actionCreateTask(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    const dueDate = config.dueOffsetDays
      ? new Date(Date.now() + config.dueOffsetDays * 86400000).toISOString()
      : null;
    const startDate = config.startOffsetDays
      ? new Date(Date.now() + config.startOffsetDays * 86400000).toISOString()
      : null;

    // Resolve assignee
    let assignedTo: string | null = null;
    if (config.assignedTo === 'owner') {
      assignedTo = entity.owner_id ?? entity.ownerId ?? null;
    } else if (config.assignedTo === 'trigger_user') {
      assignedTo = payload.userId ?? entity.created_by ?? null;
    } else if (config.assignedTo === 'specific') {
      assignedTo = config.specificUserId ?? null;
    }

    // Resolve task type — use config or fall back to default
    let taskTypeId = config.taskTypeId || null;
    if (!taskTypeId) {
      const [type] = await this.dataSource.query(
        `SELECT id FROM "${schema}".task_types WHERE is_default = true LIMIT 1`,
      );
      taskTypeId = type?.id ?? null;
    }

    // Resolve status — use config or fall back to default open
    let statusId = config.statusId || null;
    if (!statusId) {
      const [status] = await this.dataSource.query(
        `SELECT id FROM "${schema}".task_statuses WHERE is_open = true AND is_active = true ORDER BY sort_order ASC LIMIT 1`,
      );
      statusId = status?.id ?? null;
    }

    // Resolve priority
    let priorityId = config.priorityId || null;
    if (!priorityId) {
      const [priority] = await this.dataSource.query(
        `SELECT id FROM "${schema}".task_priorities WHERE is_default = true LIMIT 1`,
      );
      priorityId = priority?.id ?? null;
    }

    // Parse tags
    const tags = config.tags
      ? (typeof config.tags === 'string' ? config.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : config.tags)
      : null;

    const title = this.interpolate(config.title ?? 'Follow up', payload);
    const description = config.description ? this.interpolate(config.description, payload) : null;

    await this.dataSource.query(
      `INSERT INTO "${schema}".tasks
         (title, description, task_type_id, status_id, priority_id,
          related_entity_type, related_entity_id,
          assigned_to, owner_id, due_date, start_date,
          estimated_minutes, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        title,
        description,
        taskTypeId,
        statusId,
        priorityId,
        payload.triggerModule,
        payload.entityId,
        assignedTo,
        assignedTo, // owner = same as assignee for workflow-created tasks
        dueDate,
        startDate,
        config.estimatedMinutes || null,
        tags ? JSON.stringify(tags) : null,
        null,
      ],
    );

    return { created: true, title, assignedTo };
  }

  // ── UPDATE FIELD ──────────────────────────────────────────────
  private async actionUpdateField(schema: string, config: any, payload: any) {
    const { entity: targetEntity = payload.triggerModule, fieldKey, value } = config;
    const resolvedValue = typeof value === 'string'
      ? this.interpolate(value, payload)
      : value;

    const table = this.tableForModule(targetEntity);
    const col = this.camelToSnake(fieldKey);

    await this.dataSource.query(
      `UPDATE "${schema}".${table} SET ${col} = $1, updated_at = NOW() WHERE id = $2`,
      [resolvedValue, payload.entityId],
    );

    return { updated: { [fieldKey]: resolvedValue } };
  }

  // ── ADD TAG ───────────────────────────────────────────────────
  private async actionAddTag(schema: string, config: any, payload: any) {
    const tag: string = config.tag;
    if (!tag) return { skipped: true };
    const table = this.tableForModule(payload.triggerModule);
    await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET tags = array_append(tags, $1), updated_at = NOW()
       WHERE id = $2 AND NOT ($1 = ANY(COALESCE(tags, '{}'::text[])))`,
      [tag, payload.entityId],
    );
    return { tag };
  }

  // ── SEND NOTIFICATION ─────────────────────────────────────────
  private async actionSendNotification(schema: string, config: any, payload: any) {
    const recipientId = config.to === 'owner'
      ? (payload.entity.owner_id ?? null)
      : (config.specificUserId ?? null);

    if (!recipientId) return { skipped: true, reason: 'No recipient' };

    const message = this.interpolate(config.message ?? 'Workflow notification', payload);

    await this.dataSource.query(
      `INSERT INTO "${schema}".notifications
         (user_id, type, title, message, entity_type, entity_id, is_read)
       VALUES ($1,'workflow',$2,$3,$4,$5,false)`,
      [
        recipientId,
        config.title ?? 'Workflow Alert',
        message,
        payload.triggerModule,
        payload.entityId,
      ],
    );

    return { sentTo: recipientId };
  }

  // ── WEBHOOK ───────────────────────────────────────────────────
  private async actionWebhook(config: any, payload: any) {
    const { method = 'POST', bodyType = 'json', verifySsl, timeoutSeconds = 30 } = config;
    let url: string = config.url;
    if (!url) return { skipped: true };

    // Append query params
    const params: { key: string; value: string; enabled?: boolean }[] = config.params ?? [];
    const enabledParams = params.filter(p => p.enabled !== false && p.key);
    if (enabledParams.length) {
      const sep = url.includes('?') ? '&' : '?';
      const qs = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(this.interpolate(p.value, payload))}`).join('&');
      url = `${url}${sep}${qs}`;
    }

    // Build headers from key-value list
    const headerList: { key: string; value: string; enabled?: boolean }[] = config.headers ?? [];
    const resolvedHeaders: Record<string, string> = {};
    for (const h of headerList) {
      if (h.enabled !== false && h.key) {
        resolvedHeaders[h.key] = this.interpolate(h.value, payload);
      }
    }

    // Build body based on type
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      if (bodyType === 'json') {
        const jsonStr = config.bodyJson ?? JSON.stringify(payload);
        body = this.interpolate(jsonStr, payload);
        if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
          resolvedHeaders['Content-Type'] = 'application/json';
        }
      } else if (bodyType === 'form-data') {
        const formData: { key: string; value: string; enabled?: boolean }[] = config.formData ?? [];
        const parts = formData
          .filter(f => f.enabled !== false && f.key)
          .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(this.interpolate(f.value, payload))}`);
        body = parts.join('&');
        if (!resolvedHeaders['Content-Type'] && !resolvedHeaders['content-type']) {
          resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      } else if (bodyType === 'raw') {
        body = this.interpolate(config.bodyRaw ?? '', payload);
      }
      // bodyType === 'none' → no body
    }

    // SSL verification — Node.js fetch honors NODE_TLS_REJECT_UNAUTHORIZED
    // For per-request control we use the agent option if available
    const fetchOptions: any = {
      method,
      headers: resolvedHeaders,
      body,
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    };

    if (verifySsl === false) {
      // Use Node.js https agent to skip SSL verification
      try {
        const https = await import('https');
        fetchOptions.agent = new https.Agent({ rejectUnauthorized: false });
      } catch { /* browser env or unavailable — ignore */ }
    }

    const res = await fetch(url, fetchOptions);

    let responseBody: string | null = null;
    try { responseBody = await res.text(); } catch { /* ignore */ }

    return { statusCode: res.status, ok: res.ok, responseBody: responseBody?.slice(0, 500) };
  }

  // ── WAIT ──────────────────────────────────────────────────────
  private async actionWait(config: any) {
    // Synchronous wait for small values (test/demo); production would use Bull queue
    const ms = (config.hours ?? 0) * 3600000 + (config.minutes ?? 0) * 60000;
    if (ms > 0 && ms <= 5000) {
      await new Promise(r => setTimeout(r, ms));
    }
    return { waited: true };
  }

  // ── BRANCH ────────────────────────────────────────────────────
  private async actionBranch(
    schema: string, action: any, config: any, payload: any, runId: string,
  ) {
    const conditionMet = this.evaluateGroup(
      config.condition ?? { match: 'all', items: [] },
      payload,
    );
    const branch = conditionMet ? 'yes' : 'no';

    // Load branch children
    const children = await this.dataSource.query(
      `SELECT * FROM "${schema}".workflow_actions
       WHERE parent_action_id = $1 AND branch = $2
       ORDER BY sort_order ASC`,
      [action.id, branch],
    );

    if (children.length) {
      await this.executeActions(schema, runId, children, payload);
    }

    return { branch, conditionMet };
  }

  // ── CREATE OPPORTUNITY (from lead) ───────────────────────────
  private async actionCreateOpportunity(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    await this.dataSource.query(
      `INSERT INTO "${schema}".opportunities
         (name, account_id, owner_id, created_by)
       VALUES ($1,$2,$3,$4)`,
      [
        config.name ?? `${entity.first_name ?? ''} ${entity.last_name ?? ''} Opportunity`.trim(),
        entity.account_id ?? null,
        entity.owner_id ?? null,
        null,
      ],
    );
    return { created: true };
  }

  // ── CREATE PROJECT (from opportunity won) ────────────────────
  private async actionCreateProject(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    const name = this.interpolate(config.name || `${entity.name ?? 'New'} Project`, payload);
    const description = config.description ? this.interpolate(config.description, payload) : null;
    const templateId = config.templateId || null;

    // Get default project status
    const [defaultStatus] = await this.dataSource.query(
      `SELECT id FROM "${schema}".project_statuses WHERE is_default = true LIMIT 1`,
    );
    const statusId = defaultStatus?.id || null;

    const ownerId = entity.owner_id ?? null;

    const [project] = await this.dataSource.query(
      `INSERT INTO "${schema}".projects
         (name, description, template_id, owner_id, status_id,
          account_id, opportunity_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        name,
        description,
        templateId,
        ownerId,
        statusId,
        entity.account_id ?? null,
        payload.triggerModule === 'opportunities' ? payload.entityId : null,
        null,
      ],
    );

    // Apply template phases/tasks if template selected
    if (templateId) {
      await this.applyProjectTemplate(schema, project.id, templateId);
    }

    return { created: true, projectId: project.id, name };
  }

  /** Copy template phases + tasks into the project */
  private async applyProjectTemplate(schema: string, projectId: string, templateId: string) {
    // Get phases
    const phases = await this.dataSource.query(
      `SELECT * FROM "${schema}".project_template_phases
       WHERE template_id = $1 ORDER BY sort_order ASC`,
      [templateId],
    );

    for (const phase of phases) {
      const [newPhase] = await this.dataSource.query(
        `INSERT INTO "${schema}".project_phases
           (project_id, name, description, color, sort_order, status)
         VALUES ($1,$2,$3,$4,$5,'not_started') RETURNING id`,
        [projectId, phase.name, phase.description, phase.color, phase.sort_order],
      );

      // Get root tasks for this phase (no parent)
      const tasks = await this.dataSource.query(
        `SELECT * FROM "${schema}".project_template_tasks
         WHERE phase_id = $1 AND parent_task_id IS NULL ORDER BY sort_order ASC`,
        [phase.id],
      );

      for (const task of tasks) {
        const [newTask] = await this.dataSource.query(
          `INSERT INTO "${schema}".project_tasks
             (project_id, phase_id, title, description, priority, sort_order,
              estimated_hours, due_days_from_start, assignee_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            projectId, newPhase.id, task.title, task.description,
            task.priority, task.sort_order, task.estimated_hours,
            task.due_days_from_start, task.assignee_role,
          ],
        );

        // Get and insert subtasks for this task
        const subtasks = await this.dataSource.query(
          `SELECT * FROM "${schema}".project_template_tasks
           WHERE parent_task_id = $1 ORDER BY sort_order ASC`,
          [task.id],
        );

        for (const subtask of subtasks) {
          await this.dataSource.query(
            `INSERT INTO "${schema}".project_tasks
               (project_id, phase_id, parent_task_id, title, description, priority,
                sort_order, estimated_hours, due_days_from_start, assignee_role)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              projectId, newPhase.id, newTask.id,
              subtask.title, subtask.description,
              subtask.priority, subtask.sort_order,
              subtask.estimated_hours, subtask.due_days_from_start,
              subtask.assignee_role,
            ],
          );
        }
      }
    }
  }

  // ── SEND EMAIL ──────────────────────────────────────────────
  private async actionSendEmail(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    const toField = config.to ?? 'record_email';
    let toAddress: string | null = null;
    if (toField === 'record_email') {
      toAddress = entity.email ?? null;
    } else if (toField === 'owner_email') {
      const ownerId = entity.ownerId ?? entity.owner_id;
      if (ownerId) {
        const [u] = await this.dataSource.query(
          `SELECT email FROM "${schema}".users WHERE id = $1`, [ownerId],
        );
        toAddress = u?.email ?? null;
      }
    } else {
      toAddress = this.interpolate(config.toEmail ?? '', entity);
    }
    if (!toAddress) return { skipped: true, reason: 'no email address resolved' };
    const subject = this.interpolate(config.subject ?? 'Notification from workflow', entity);
    const html = this.interpolate(config.body ?? '', entity);
    const cc = config.cc ? this.interpolate(config.cc, entity) : undefined;
    const bcc = config.bcc ? this.interpolate(config.bcc, entity) : undefined;
    const sent = await this.emailChannel.send(schema, { to: toAddress, cc, bcc, subject, html });
    return { sent, to: toAddress };
  }

  // ── SEND WHATSAPP ───────────────────────────────────────────
  private async actionSendWhatsApp(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    const toField = config.to ?? 'record_phone';
    let toPhone: string | null = null;
    if (toField === 'record_phone') {
      toPhone = entity.mobile ?? entity.phone ?? null;
    } else if (toField === 'owner_phone') {
      const ownerId = entity.ownerId ?? entity.owner_id;
      if (ownerId) {
        const [u] = await this.dataSource.query(
          `SELECT phone, mobile FROM "${schema}".users WHERE id = $1`, [ownerId],
        );
        toPhone = u?.mobile ?? u?.phone ?? null;
      }
    } else {
      toPhone = this.interpolate(config.toPhone ?? '', entity);
    }
    if (!toPhone) return { skipped: true, reason: 'no phone resolved' };
    const message = this.interpolate(config.message ?? '', entity);
    const sent = await this.smsChannel.sendWhatsApp(schema, toPhone, message);
    return { sent, to: toPhone };
  }

  // ── SEND SMS ────────────────────────────────────────────────
  private async actionSendSms(schema: string, config: any, payload: any) {
    const entity = payload.entity ?? {};
    const toField = config.to ?? 'record_phone';
    let toPhone: string | null = null;
    if (toField === 'record_phone') {
      toPhone = entity.mobile ?? entity.phone ?? null;
    } else if (toField === 'owner_phone') {
      const ownerId = entity.ownerId ?? entity.owner_id;
      if (ownerId) {
        const [u] = await this.dataSource.query(
          `SELECT phone, mobile FROM "${schema}".users WHERE id = $1`, [ownerId],
        );
        toPhone = u?.mobile ?? u?.phone ?? null;
      }
    } else {
      toPhone = this.interpolate(config.toPhone ?? '', entity);
    }
    if (!toPhone) return { skipped: true, reason: 'no phone resolved' };
    const message = this.interpolate(config.message ?? '', entity);
    const sent = await this.smsChannel.sendSms(schema, toPhone, message);
    return { sent, to: toPhone };
  }

  // ============================================================
  // CONDITION EVALUATOR
  // ============================================================
  evaluateGroup(group: ConditionGroup, payload: any): boolean {
    if (!group.items?.length) return true;

    const results = group.items.map(item => {
      if ('match' in item) return this.evaluateGroup(item as ConditionGroup, payload);
      return this.evaluateCondition(item as Condition, payload);
    });

    return group.match === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  private evaluateCondition(cond: Condition, payload: any): boolean {
    const raw = this.resolveFieldValue(cond.field, cond.fieldType, payload);
    const val = cond.value;

    switch (cond.operator) {
      case 'equals':           return String(raw ?? '').toLowerCase() === String(val ?? '').toLowerCase();
      case 'not_equals':       return String(raw ?? '').toLowerCase() !== String(val ?? '').toLowerCase();
      case 'contains':         return String(raw ?? '').toLowerCase().includes(String(val ?? '').toLowerCase());
      case 'not_contains':     return !String(raw ?? '').toLowerCase().includes(String(val ?? '').toLowerCase());
      case 'starts_with':      return String(raw ?? '').toLowerCase().startsWith(String(val ?? '').toLowerCase());
      case 'is_empty':         return !raw || String(raw).trim() === '';
      case 'is_not_empty':     return !!(raw && String(raw).trim() !== '');
      case 'greater_than':     return parseFloat(raw) > parseFloat(val);
      case 'less_than':        return parseFloat(raw) < parseFloat(val);
      case 'greater_or_equal': return parseFloat(raw) >= parseFloat(val);
      case 'less_or_equal':    return parseFloat(raw) <= parseFloat(val);
      case 'in':               return Array.isArray(val) && val.includes(raw);
      case 'not_in':           return Array.isArray(val) && !val.includes(raw);
      case 'changed_to':       return String(raw ?? '') === String(val ?? '') &&
                                      String(payload.previousValues?.[cond.field] ?? '') !== String(val ?? '');
      case 'changed_from':     return String(payload.previousValues?.[cond.field] ?? '').toLowerCase() === String(val ?? '').toLowerCase();
      case 'any_change':       return raw !== payload.previousValues?.[cond.field];
      default:                 return true;
    }
  }

  private resolveFieldValue(field: string, fieldType: string, payload: any): any {
    if (fieldType === 'custom') return payload.customFields?.[field];
    if (fieldType === 'meta')   return payload.meta?.[field];
    // system field — convert camelCase to snake_case for entity lookup
    const snakeField = this.camelToSnake(field);
    return payload.entity?.[snakeField] ?? payload.entity?.[field];
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private tableForModule(module: string): string {
    const map: Record<string, string> = {
      leads: 'leads', contacts: 'contacts', accounts: 'accounts',
      opportunities: 'opportunities', tasks: 'tasks', projects: 'projects',
    };
    return map[module] ?? module;
  }

  private camelToSnake(s: string): string {
    return s.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /** Replace {{trigger.fieldName}} placeholders with live values */
  private interpolate(template: string, payload: any): string {
    return template.replace(/\{\{trigger\.([^}]+)\}\}/g, (_, key) => {
      const snakeKey = this.camelToSnake(key);
      return String(payload.entity?.[snakeKey] ?? payload.entity?.[key] ?? '');
    });
  }
}
