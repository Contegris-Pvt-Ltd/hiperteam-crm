import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as Handlebars from 'handlebars';

export interface RenderedTemplate {
  emailSubject?: string;
  emailBodyHtml?: string;
  emailBodyText?: string;
  smsBody?: string;
  whatsappTemplateId?: string;
}

export interface NotificationTemplate {
  id: string;
  eventType: string;
  name: string;
  emailSubject: string | null;
  emailBodyHtml: string | null;
  emailBodyText: string | null;
  smsBody: string | null;
  whatsappTemplateId: string | null;
  isActive: boolean;
}

@Injectable()
export class NotificationTemplateService {
  private readonly logger = new Logger(NotificationTemplateService.name);
  private templateCache = new Map<string, NotificationTemplate>();

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // RENDER TEMPLATE
  // ============================================================
  async render(schemaName: string, eventType: string, variables: Record<string, unknown>): Promise<RenderedTemplate> {
    const template = await this.getByEventType(schemaName, eventType);
    if (!template || !template.isActive) {
      this.logger.warn(`No active template for event: ${eventType}`);
      return {};
    }

    const result: RenderedTemplate = {};

    try {
      if (template.emailSubject) {
        result.emailSubject = Handlebars.compile(template.emailSubject)(variables);
      }
      if (template.emailBodyHtml) {
        result.emailBodyHtml = Handlebars.compile(template.emailBodyHtml)(variables);
      }
      if (template.emailBodyText) {
        result.emailBodyText = Handlebars.compile(template.emailBodyText)(variables);
      }
      if (template.smsBody) {
        result.smsBody = Handlebars.compile(template.smsBody)(variables);
      }
      if (template.whatsappTemplateId) {
        result.whatsappTemplateId = template.whatsappTemplateId;
      }
    } catch (err) {
      this.logger.error(`Template render error for ${eventType}: ${err.message}`);
    }

    return result;
  }

  // ============================================================
  // GET BY EVENT TYPE
  // ============================================================
  async getByEventType(schemaName: string, eventType: string): Promise<NotificationTemplate | null> {
    // Check cache
    const cacheKey = `${schemaName}:${eventType}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_templates WHERE event_type = $1`,
      [eventType],
    );

    if (!row) return null;

    const template = this.formatTemplate(row);
    this.templateCache.set(cacheKey, template);
    return template;
  }

  // ============================================================
  // LIST ALL
  // ============================================================
  async findAll(schemaName: string): Promise<NotificationTemplate[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_templates ORDER BY name ASC`,
    );
    return rows.map((r: any) => this.formatTemplate(r));
  }

  // ============================================================
  // UPDATE TEMPLATE
  // ============================================================
  async update(schemaName: string, id: string, data: Partial<{
    emailSubject: string;
    emailBodyHtml: string;
    emailBodyText: string;
    smsBody: string;
    whatsappTemplateId: string;
    isActive: boolean;
  }>): Promise<NotificationTemplate> {
    const [existing] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_templates WHERE id = $1`,
      [id],
    );
    if (!existing) throw new NotFoundException('Template not found');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      emailSubject: 'email_subject',
      emailBodyHtml: 'email_body_html',
      emailBodyText: 'email_body_text',
      smsBody: 'sms_body',
      whatsappTemplateId: 'whatsapp_template_id',
      isActive: 'is_active',
    };

    for (const [key, col] of Object.entries(fields)) {
      if ((data as any)[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push((data as any)[key]);
        idx++;
      }
    }

    if (updates.length === 0) return this.formatTemplate(existing);

    updates.push('updated_at = NOW()');
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".notification_templates SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    // Invalidate cache
    this.templateCache.delete(`${schemaName}:${existing.event_type}`);

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_templates WHERE id = $1`,
      [id],
    );
    return this.formatTemplate(updated);
  }

  // ============================================================
  // CLEAR CACHE
  // ============================================================
  clearCache(schemaName?: string) {
    if (schemaName) {
      for (const key of this.templateCache.keys()) {
        if (key.startsWith(`${schemaName}:`)) {
          this.templateCache.delete(key);
        }
      }
    } else {
      this.templateCache.clear();
    }
  }

  // ============================================================
  // FORMAT
  // ============================================================
  private formatTemplate(row: any): NotificationTemplate {
    return {
      id: row.id,
      eventType: row.event_type,
      name: row.name,
      emailSubject: row.email_subject,
      emailBodyHtml: row.email_body_html,
      emailBodyText: row.email_body_text,
      smsBody: row.sms_body,
      whatsappTemplateId: row.whatsapp_template_id,
      isActive: row.is_active,
    };
  }
}