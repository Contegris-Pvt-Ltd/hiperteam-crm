import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationGateway } from './notification.gateway';
import { EmailChannel } from './channels/email.channel';
import { BrowserPushChannel } from './channels/browser-push.channel';
import { SmsWhatsAppChannel } from './channels/sms-whatsapp.channel';

// ============================================================
// TYPES
// ============================================================
export interface NotifyPayload {
  userId: string;
  eventType: string;
  title: string;
  body?: string;
  icon?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  // Template variables for email/sms rendering
  variables?: Record<string, unknown>;
  // Override: force specific channels regardless of preferences
  forceChannels?: ('in_app' | 'email' | 'browser_push' | 'sms' | 'whatsapp')[];
  // User contact info for external channels
  userEmail?: string;
  userPhone?: string;
  // Override recipient email (for test emails)
  testEmail?: string;
}

export interface NotifyBulkPayload {
  userIds: string[];
  eventType: string;
  title: string;
  body?: string;
  icon?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  variables?: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  channels: string[];
  isRead: boolean;
  readAt: string | null;
  isDismissed: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private dataSource: DataSource,
    private preferencesService: NotificationPreferencesService,
    private templateService: NotificationTemplateService,
    private gateway: NotificationGateway,
    private emailChannel: EmailChannel,
    private browserPushChannel: BrowserPushChannel,
    private smsWhatsAppChannel: SmsWhatsAppChannel,
  ) {}

  // ============================================================
  // NOTIFY (single user — primary API)
  // ============================================================
  async notify(schemaName: string, payload: NotifyPayload): Promise<string | null> {
    try {
      const { userId, eventType, title, body, icon, actionUrl, entityType, entityId, metadata, variables, forceChannels } = payload;

      // 1. Determine which channels to use
      let channelsUsed: string[] = [];

      if (forceChannels && forceChannels.length > 0) {
        channelsUsed = [...forceChannels];
      } else {
        const prefs = await this.preferencesService.getChannelsForEvent(schemaName, userId, eventType);
        if (prefs.inApp) channelsUsed.push('in_app');
        if (prefs.email) channelsUsed.push('email');
        if (prefs.browserPush) channelsUsed.push('browser_push');
        if (prefs.sms) channelsUsed.push('sms');
        if (prefs.whatsapp) channelsUsed.push('whatsapp');
      }

      if (channelsUsed.length === 0) {
        this.logger.debug(`All channels disabled for user ${userId}, event ${eventType}`);
        return null;
      }

      // 2. Create in-app notification record
      const [notification] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".notifications
         (user_id, type, title, body, icon, action_url, entity_type, entity_id, metadata, channels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [userId, eventType, title, body || null, icon || null, actionUrl || null,
         entityType || null, entityId || null, metadata || {}, channelsUsed],
      );

      const notificationId = notification.id;

      // 3. Dispatch to channels (async, non-blocking)
      this.dispatchToChannels(schemaName, payload, channelsUsed, notificationId).catch(err => {
        this.logger.error(`Channel dispatch failed: ${err.message}`);
      });

      return notificationId;
    } catch (err: any) {
      this.logger.error(`Notify failed for user ${payload.userId}: ${err.message}`);
      return null;
    }
  }

  // ============================================================
  // NOTIFY BULK (multiple users, same event)
  // ============================================================
  async notifyBulk(schemaName: string, payload: NotifyBulkPayload): Promise<number> {
    let count = 0;
    for (const userId of payload.userIds) {
      const result = await this.notify(schemaName, {
        userId,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        actionUrl: payload.actionUrl,
        entityType: payload.entityType,
        entityId: payload.entityId,
        metadata: payload.metadata,
        variables: payload.variables,
      });
      if (result) count++;
    }
    return count;
  }

  // ============================================================
  // DISPATCH TO CHANNELS
  // ============================================================
  private async dispatchToChannels(
    schemaName: string,
    payload: NotifyPayload,
    channels: string[],
    notificationId: string,
  ): Promise<void> {
    const { userId, eventType, title, body, icon, actionUrl, variables } = payload;

    // Render template for external channels
    const templateVars = {
      ...variables,
      actionUrl: actionUrl || '',
      title,
      body: body || '',
    };
    const rendered = await this.templateService.render(schemaName, eventType, templateVars);

    // --- In-App (WebSocket) ---
    if (channels.includes('in_app')) {
      try {
        this.gateway.pushToUser(userId, {
          id: notificationId,
          type: eventType,
          title,
          body,
          icon,
          actionUrl,
          createdAt: new Date().toISOString(),
        });

        // Update unread count
        const [{ count }] = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${schemaName}".notifications WHERE user_id = $1 AND is_read = false AND is_dismissed = false`,
          [userId],
        );
        this.gateway.pushUnreadCount(userId, parseInt(count, 10));
      } catch (err: any) {
        this.logger.error(`WebSocket push failed: ${err.message}`);
      }
    }

    // --- Email ---
    if (channels.includes('email')) {
      try {
        // testEmail overrides recipient; otherwise look up user's email
        const recipientEmail = payload.testEmail
          || payload.userEmail
          || await this.getUserEmail(schemaName, userId);

        if (recipientEmail && rendered.emailSubject) {
          await this.emailChannel.send(schemaName, {
            to: recipientEmail,
            subject: rendered.emailSubject,
            html: rendered.emailBodyHtml || undefined,
            text: rendered.emailBodyText || undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Email dispatch failed: ${err.message}`);
      }
    }

    // --- Browser Push ---
    if (channels.includes('browser_push')) {
      try {
        await this.browserPushChannel.send(schemaName, userId, {
          title,
          body: body || '',
          icon,
          actionUrl,
          tag: eventType,
        });
      } catch (err: any) {
        this.logger.error(`Browser push dispatch failed: ${err.message}`);
      }
    }

    // --- SMS ---
    if (channels.includes('sms')) {
      try {
        const userPhone = payload.userPhone || await this.getUserPhone(schemaName, userId);
        if (userPhone && rendered.smsBody) {
          await this.smsWhatsAppChannel.sendSms(schemaName, userPhone, rendered.smsBody);
        }
      } catch (err: any) {
        this.logger.error(`SMS dispatch failed: ${err.message}`);
      }
    }

    // --- WhatsApp ---
    if (channels.includes('whatsapp')) {
      try {
        const userPhone = payload.userPhone || await this.getUserPhone(schemaName, userId);
        if (userPhone && rendered.smsBody) {
          await this.smsWhatsAppChannel.sendWhatsApp(
            schemaName, userPhone, rendered.smsBody, rendered.whatsappTemplateId,
          );
        }
      } catch (err: any) {
        this.logger.error(`WhatsApp dispatch failed: ${err.message}`);
      }
    }
  }

  // ============================================================
  // READ OPERATIONS
  // ============================================================

  async findByUser(schemaName: string, userId: string, options?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }): Promise<{ data: NotificationRecord[]; total: number; unreadCount: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 50);
    const offset = (page - 1) * limit;

    let where = 'user_id = $1 AND is_dismissed = false';
    const params: unknown[] = [userId];
    let idx = 2;

    if (options?.unreadOnly) {
      where += ' AND is_read = false';
    }
    if (options?.type) {
      where += ` AND type = $${idx}`;
      params.push(options.type);
      idx++;
    }

    const [{ count: total }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".notifications WHERE ${where}`,
      params,
    );

    const [{ count: unreadCount }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".notifications WHERE user_id = $1 AND is_read = false AND is_dismissed = false`,
      [userId],
    );

    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notifications WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((r: any) => this.formatNotification(r)),
      total: parseInt(total, 10),
      unreadCount: parseInt(unreadCount, 10),
    };
  }

  // ============================================================
  // MARK READ / DISMISS
  // ============================================================

  async markRead(schemaName: string, userId: string, notificationId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${schemaName}".notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
  }

  async markAllRead(schemaName: string, userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false RETURNING id`,
      [userId],
    );
    return result.length;
  }

  async dismiss(schemaName: string, userId: string, notificationId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${schemaName}".notifications SET is_dismissed = true WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
  }

  async getUnreadCount(schemaName: string, userId: string): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".notifications WHERE user_id = $1 AND is_read = false AND is_dismissed = false`,
      [userId],
    );
    return parseInt(count, 10);
  }

  // ============================================================
  // CLEANUP (admin: delete old notifications)
  // ============================================================
  async cleanupOld(schemaName: string, daysOld: number = 90): Promise<number> {
    const result = await this.dataSource.query(
      `DELETE FROM "${schemaName}".notifications WHERE created_at < NOW() - INTERVAL '${daysOld} days' RETURNING id`,
    );
    return result.length;
  }

  // ============================================================
  // SETTINGS CRUD
  // ============================================================

  async getSettings(schemaName: string): Promise<Record<string, any>> {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_settings ORDER BY setting_key`,
    );
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.setting_key] = row.setting_value;
    }
    return settings;
  }

  async updateSetting(schemaName: string, key: string, value: any): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".notification_settings (setting_key, setting_value)
       VALUES ($1, $2)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );

    // Clear channel caches when config changes
    if (key === 'smtp_config') this.emailChannel.clearCache(schemaName);
    if (key === 'twilio_config') this.smsWhatsAppChannel.clearCache(schemaName);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getUserEmail(schemaName: string, userId: string): Promise<string | null> {
    const [user] = await this.dataSource.query(
      `SELECT email FROM "${schemaName}".users WHERE id = $1`,
      [userId],
    );
    return user?.email || null;
  }

  private async getUserPhone(schemaName: string, userId: string): Promise<string | null> {
    const [user] = await this.dataSource.query(
      `SELECT phone, mobile FROM "${schemaName}".users WHERE id = $1`,
      [userId],
    );
    return user?.mobile || user?.phone || null;
  }

  private formatNotification(row: any): NotificationRecord {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      icon: row.icon,
      actionUrl: row.action_url,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata || {},
      channels: row.channels || [],
      isRead: row.is_read,
      readAt: row.read_at,
      isDismissed: row.is_dismissed,
      createdAt: row.created_at,
    };
  }
}