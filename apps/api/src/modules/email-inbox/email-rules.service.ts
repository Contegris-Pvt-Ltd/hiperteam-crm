import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'has_attachments' | 'header';
  operator: 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex';
  value: string;
}

export interface RuleAction {
  type:
    | 'mark_read'
    | 'star'
    | 'label'
    | 'link_contact'
    | 'link_lead'
    | 'link_opportunity'
    | 'link_account'
    | 'forward'
    | 'auto_reply'
    | 'delete';
  config?: Record<string, any>;
}

@Injectable()
export class EmailRulesService {
  private readonly logger = new Logger(EmailRulesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────

  async getRules(schemaName: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_inbox_rules
       WHERE deleted_at IS NULL
       ORDER BY priority ASC, created_at ASC`,
    );
    return rows.map((r: any) => this.formatRule(r));
  }

  async getRuleById(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_inbox_rules
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('Rule not found');
    return this.formatRule(row);
  }

  async createRule(schemaName: string, userId: string, dto: {
    name: string;
    applyTo?: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    stopProcessing?: boolean;
    priority?: number;
  }) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_inbox_rules
        (name, apply_to, conditions, actions, stop_processing, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dto.name,
        dto.applyTo || 'inbound',
        JSON.stringify(dto.conditions),
        JSON.stringify(dto.actions),
        dto.stopProcessing ?? false,
        dto.priority ?? 0,
        userId,
      ],
    );

    await this.auditService.log(schemaName, {
      entityType: 'email_inbox_rules',
      entityId: row.id,
      action: 'create',
      changes: {},
      newValues: row,
      performedBy: userId,
    });

    return this.formatRule(row);
  }

  async updateRule(schemaName: string, userId: string, id: string, dto: {
    name?: string;
    isActive?: boolean;
    applyTo?: string;
    conditions?: RuleCondition[];
    actions?: RuleAction[];
    stopProcessing?: boolean;
    priority?: number;
  }) {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      setClauses.push(`name = $${idx}`);
      params.push(dto.name);
      idx++;
    }
    if (dto.isActive !== undefined) {
      setClauses.push(`is_active = $${idx}`);
      params.push(dto.isActive);
      idx++;
    }
    if (dto.applyTo !== undefined) {
      setClauses.push(`apply_to = $${idx}`);
      params.push(dto.applyTo);
      idx++;
    }
    if (dto.conditions !== undefined) {
      setClauses.push(`conditions = $${idx}`);
      params.push(JSON.stringify(dto.conditions));
      idx++;
    }
    if (dto.actions !== undefined) {
      setClauses.push(`actions = $${idx}`);
      params.push(JSON.stringify(dto.actions));
      idx++;
    }
    if (dto.stopProcessing !== undefined) {
      setClauses.push(`stop_processing = $${idx}`);
      params.push(dto.stopProcessing);
      idx++;
    }
    if (dto.priority !== undefined) {
      setClauses.push(`priority = $${idx}`);
      params.push(dto.priority);
      idx++;
    }

    params.push(id);
    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".email_inbox_rules
       SET ${setClauses.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );

    if (!row) throw new NotFoundException('Rule not found');

    await this.auditService.log(schemaName, {
      entityType: 'email_inbox_rules',
      entityId: id,
      action: 'update',
      changes: {},
      newValues: row,
      performedBy: userId,
    });

    return this.formatRule(row);
  }

  async deleteRule(schemaName: string, userId: string, id: string) {
    const existing = await this.getRuleById(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".email_inbox_rules
       SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );

    await this.auditService.log(schemaName, {
      entityType: 'email_inbox_rules',
      entityId: id,
      action: 'delete',
      changes: {},
      newValues: existing,
      performedBy: userId,
    });
  }

  // ── Rule Processing Engine ──────────────────────────────────

  async processInboundEmail(
    schemaName: string,
    emailId: string,
    emailData: {
      fromEmail: string;
      toEmails: { email: string; name?: string }[];
      subject: string;
      bodyText: string;
      hasAttachments: boolean;
      direction: string;
    },
  ) {
    const rules = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_inbox_rules
       WHERE is_active = true AND deleted_at IS NULL
         AND (apply_to = $1 OR apply_to = 'all')
       ORDER BY priority ASC, created_at ASC`,
      [emailData.direction],
    );

    for (const rule of rules) {
      const conditions: RuleCondition[] =
        typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
      const actions: RuleAction[] =
        typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;

      if (this.matchesRule(conditions, emailData)) {
        this.logger.debug(`Rule "${rule.name}" matched for email ${emailId}`);
        await this.executeActions(schemaName, emailId, actions, emailData);

        if (rule.stop_processing) {
          this.logger.debug(`Stop processing after rule "${rule.name}"`);
          break;
        }
      }
    }
  }

  private matchesRule(
    conditions: RuleCondition[],
    email: {
      fromEmail: string;
      toEmails: { email: string; name?: string }[];
      subject: string;
      bodyText: string;
      hasAttachments: boolean;
    },
  ): boolean {
    if (conditions.length === 0) return false;

    // AND logic: all conditions must match
    return conditions.every((c) => {
      const fieldValue = this.getFieldValue(c.field, email);
      return this.matchOperator(c.operator, fieldValue, c.value);
    });
  }

  private getFieldValue(
    field: string,
    email: {
      fromEmail: string;
      toEmails: { email: string; name?: string }[];
      subject: string;
      bodyText: string;
      hasAttachments: boolean;
    },
  ): string {
    switch (field) {
      case 'from':
        return email.fromEmail || '';
      case 'to':
        return email.toEmails.map((e) => e.email).join(', ');
      case 'subject':
        return email.subject || '';
      case 'body':
        return email.bodyText || '';
      case 'has_attachments':
        return email.hasAttachments ? 'true' : 'false';
      default:
        return '';
    }
  }

  private matchOperator(operator: string, fieldValue: string, ruleValue: string): boolean {
    const fv = fieldValue.toLowerCase();
    const rv = ruleValue.toLowerCase();

    switch (operator) {
      case 'contains':
        return fv.includes(rv);
      case 'not_contains':
        return !fv.includes(rv);
      case 'equals':
        return fv === rv;
      case 'starts_with':
        return fv.startsWith(rv);
      case 'ends_with':
        return fv.endsWith(rv);
      case 'regex':
        try {
          return new RegExp(ruleValue, 'i').test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private async executeActions(
    schemaName: string,
    emailId: string,
    actions: RuleAction[],
    emailData: {
      fromEmail: string;
      toEmails: { email: string; name?: string }[];
      subject: string;
      bodyText: string;
      hasAttachments: boolean;
    },
  ) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'mark_read':
            await this.dataSource.query(
              `UPDATE "${schemaName}".emails SET is_read = true WHERE id = $1`,
              [emailId],
            );
            break;

          case 'star':
            await this.dataSource.query(
              `UPDATE "${schemaName}".emails SET is_starred = true WHERE id = $1`,
              [emailId],
            );
            break;

          case 'label':
            if (action.config?.label) {
              await this.dataSource.query(
                `UPDATE "${schemaName}".emails
                 SET labels = labels || $2::jsonb
                 WHERE id = $1`,
                [emailId, JSON.stringify([action.config.label])],
              );
            }
            break;

          case 'link_contact':
            await this.linkByEmail(schemaName, emailId, 'contact', emailData.fromEmail);
            break;

          case 'link_lead':
            await this.linkByEmail(schemaName, emailId, 'lead', emailData.fromEmail);
            break;

          case 'link_opportunity':
            await this.linkByEmail(schemaName, emailId, 'opportunity', emailData.fromEmail);
            break;

          case 'link_account':
            await this.linkByEmail(schemaName, emailId, 'account', emailData.fromEmail);
            break;

          case 'forward':
            if (action.config?.to) {
              this.logger.log(`Forward action for email ${emailId} to ${action.config.to} — not yet implemented`);
            }
            break;

          case 'auto_reply':
            if (action.config?.template) {
              this.logger.log(`Auto-reply action for email ${emailId} — not yet implemented`);
            }
            break;

          case 'delete':
            await this.dataSource.query(
              `UPDATE "${schemaName}".emails SET labels = labels || '"TRASH"'::jsonb WHERE id = $1`,
              [emailId],
            );
            break;

          default:
            this.logger.warn(`Unknown rule action type: ${action.type}`);
        }
      } catch (err: any) {
        this.logger.warn(`Rule action "${action.type}" failed for email ${emailId}: ${err.message}`);
      }
    }
  }

  private async linkByEmail(schemaName: string, emailId: string, entityType: string, email: string) {
    let query: string;
    const params = [email];

    switch (entityType) {
      case 'contact':
        query = `SELECT id FROM "${schemaName}".contacts WHERE email = $1 AND deleted_at IS NULL LIMIT 1`;
        break;
      case 'lead':
        query = `SELECT id FROM "${schemaName}".leads WHERE email = $1 AND deleted_at IS NULL LIMIT 1`;
        break;
      case 'opportunity':
        query = `SELECT o.id FROM "${schemaName}".opportunities o
                 JOIN "${schemaName}".contacts c ON c.id = o.primary_contact_id
                 WHERE c.email = $1 AND c.deleted_at IS NULL AND o.deleted_at IS NULL LIMIT 1`;
        break;
      case 'account': {
        params[0] = JSON.stringify([{ email }]);
        query = `SELECT id FROM "${schemaName}".accounts
                 WHERE emails @> $1::jsonb AND deleted_at IS NULL LIMIT 1`;
        break;
      }
      default:
        return;
    }

    const rows = await this.dataSource.query(query, params);
    if (rows[0]) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".email_links (email_id, entity_type, entity_id, auto_linked)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (email_id, entity_type, entity_id) DO NOTHING`,
        [emailId, entityType, rows[0].id],
      );
    }
  }

  // ── Format helper ──────────────────────────────────────────

  private formatRule(r: any) {
    return {
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      applyTo: r.apply_to,
      conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
      actions: typeof r.actions === 'string' ? JSON.parse(r.actions) : r.actions,
      stopProcessing: r.stop_processing,
      priority: r.priority,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
