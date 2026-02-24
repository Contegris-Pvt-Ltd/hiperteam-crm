import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface NotificationPreference {
  id: string;
  userId: string;
  eventType: string;
  inApp: boolean;
  email: boolean;
  browserPush: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface ChannelFlags {
  inApp: boolean;
  email: boolean;
  browserPush: boolean;
  sms: boolean;
  whatsapp: boolean;
}

// All supported event types
export const NOTIFICATION_EVENT_TYPES = [
  'task_assigned',
  'task_due_reminder',
  'task_overdue',
  'task_completed',
  'meeting_reminder',
  'meeting_booked',
  'meeting_cancelled',
  'meeting_rescheduled',
  'lead_assigned',
  'mention',
] as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[number];

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // GET USER PREFERENCES (all event types)
  // ============================================================
  async getUserPreferences(schemaName: string, userId: string): Promise<NotificationPreference[]> {
    const existing = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_preferences WHERE user_id = $1 ORDER BY event_type ASC`,
      [userId],
    );

    const existingMap = new Map(existing.map((r: any) => [r.event_type, r]));

    // Get default preferences from tenant settings
    const defaults = await this.getDefaultPreferences(schemaName);

    // Ensure all event types have a row — create missing ones from defaults
    const result: NotificationPreference[] = [];

    for (const eventType of NOTIFICATION_EVENT_TYPES) {
      if (existingMap.has(eventType)) {
        result.push(this.formatPreference(existingMap.get(eventType)));
      } else {
        const defaultPref = defaults[eventType] || {
          in_app: true, email: true, browser_push: false, sms: false, whatsapp: false,
        };

        // Insert default row for this user+event
        const [created] = await this.dataSource.query(
          `INSERT INTO "${schemaName}".notification_preferences
           (user_id, event_type, in_app, email, browser_push, sms, whatsapp)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, event_type) DO NOTHING
           RETURNING *`,
          [userId, eventType, defaultPref.in_app, defaultPref.email,
           defaultPref.browser_push, defaultPref.sms, defaultPref.whatsapp],
        );

        if (created) {
          result.push(this.formatPreference(created));
        } else {
          // Race condition: was inserted between SELECT and INSERT
          const [row] = await this.dataSource.query(
            `SELECT * FROM "${schemaName}".notification_preferences WHERE user_id = $1 AND event_type = $2`,
            [userId, eventType],
          );
          if (row) result.push(this.formatPreference(row));
        }
      }
    }

    return result;
  }

  // ============================================================
  // GET CHANNELS FOR SPECIFIC EVENT (used by dispatch engine)
  // ============================================================
  async getChannelsForEvent(schemaName: string, userId: string, eventType: string): Promise<ChannelFlags> {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_preferences WHERE user_id = $1 AND event_type = $2`,
      [userId, eventType],
    );

    if (row) {
      return {
        inApp: row.in_app,
        email: row.email,
        browserPush: row.browser_push,
        sms: row.sms,
        whatsapp: row.whatsapp,
      };
    }

    // Fall back to tenant defaults
    const defaults = await this.getDefaultPreferences(schemaName);
    const d = defaults[eventType];
    if (d) {
      return {
        inApp: d.in_app ?? true,
        email: d.email ?? true,
        browserPush: d.browser_push ?? false,
        sms: d.sms ?? false,
        whatsapp: d.whatsapp ?? false,
      };
    }

    return { inApp: true, email: false, browserPush: false, sms: false, whatsapp: false };
  }

  // ============================================================
  // UPDATE USER PREFERENCE
  // ============================================================
  async updatePreference(schemaName: string, userId: string, eventType: string, data: Partial<ChannelFlags>): Promise<NotificationPreference> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: Record<string, string> = {
      inApp: 'in_app',
      email: 'email',
      browserPush: 'browser_push',
      sms: 'sms',
      whatsapp: 'whatsapp',
    };

    for (const [key, col] of Object.entries(fields)) {
      if ((data as any)[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push((data as any)[key]);
        idx++;
      }
    }

    if (updates.length === 0) {
      const prefs = await this.getUserPreferences(schemaName, userId);
      return prefs.find(p => p.eventType === eventType)!;
    }

    updates.push('updated_at = NOW()');
    params.push(userId, eventType);

    // Upsert
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".notification_preferences WHERE user_id = $1 AND event_type = $2`,
      [userId, eventType],
    );

    if (existing) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".notification_preferences SET ${updates.join(', ')} WHERE user_id = $${idx} AND event_type = $${idx + 1}`,
        params,
      );
    } else {
      // Insert with defaults then update
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".notification_preferences (user_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, eventType],
      );
      await this.dataSource.query(
        `UPDATE "${schemaName}".notification_preferences SET ${updates.join(', ')} WHERE user_id = $${idx} AND event_type = $${idx + 1}`,
        params,
      );
    }

    const [updated] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".notification_preferences WHERE user_id = $1 AND event_type = $2`,
      [userId, eventType],
    );
    return this.formatPreference(updated);
  }

  // ============================================================
  // BULK UPDATE (for the preferences matrix UI)
  // ============================================================
  async bulkUpdate(schemaName: string, userId: string, preferences: Array<{ eventType: string } & Partial<ChannelFlags>>): Promise<NotificationPreference[]> {
    for (const pref of preferences) {
      const { eventType, ...channels } = pref;
      await this.updatePreference(schemaName, userId, eventType, channels);
    }
    return this.getUserPreferences(schemaName, userId);
  }

  // ============================================================
  // GET TENANT DEFAULT PREFERENCES
  // ============================================================
  private async getDefaultPreferences(schemaName: string): Promise<Record<string, any>> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'default_preferences'`,
      );
      return row?.setting_value || {};
    } catch {
      return {};
    }
  }

  // ============================================================
  // FORMAT
  // ============================================================
  private formatPreference(row: any): NotificationPreference {
    return {
      id: row.id,
      userId: row.user_id,
      eventType: row.event_type,
      inApp: row.in_app,
      email: row.email,
      browserPush: row.browser_push,
      sms: row.sms,
      whatsapp: row.whatsapp,
    };
  }
}