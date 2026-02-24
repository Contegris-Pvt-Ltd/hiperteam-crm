import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Web Push will be dynamically imported to handle optional dependency
let webPush: any = null;

@Injectable()
export class BrowserPushChannel {
  private readonly logger = new Logger(BrowserPushChannel.name);
  private initialized = new Map<string, boolean>();

  constructor(private dataSource: DataSource) {
    this.loadWebPush();
  }

  private async loadWebPush() {
    try {
      webPush = await import('web-push');
      this.logger.log('web-push module loaded');
    } catch {
      this.logger.warn('web-push module not available — browser push notifications disabled');
    }
  }

  // ============================================================
  // SEND PUSH NOTIFICATION
  // ============================================================
  async send(schemaName: string, userId: string, payload: {
    title: string;
    body: string;
    icon?: string;
    actionUrl?: string;
    tag?: string;
  }): Promise<{ sent: number; failed: number; removed: number }> {
    if (!webPush) {
      this.logger.warn('web-push not available');
      return { sent: 0, failed: 0, removed: 0 };
    }

    await this.ensureInitialized(schemaName);

    // Get all push subscriptions for this user
    const subscriptions = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".push_subscriptions WHERE user_id = $1`,
      [userId],
    );

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, removed: 0 };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        url: payload.actionUrl || '/',
      },
      tag: payload.tag || 'notification',
      requireInteraction: false,
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
          { TTL: 86400 }, // 24 hours
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or unsubscribed — clean up
          await this.dataSource.query(
            `DELETE FROM "${schemaName}".push_subscriptions WHERE id = $1`,
            [sub.id],
          );
          removed++;
        } else {
          this.logger.error(`Push failed for subscription ${sub.id}: ${err.message}`);
          failed++;
        }
      }
    }

    this.logger.log(`Push results for user ${userId}: sent=${sent}, failed=${failed}, removed=${removed}`);
    return { sent, failed, removed };
  }

  // ============================================================
  // SUBSCRIBE (register push subscription)
  // ============================================================
  async subscribe(schemaName: string, userId: string, subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
  }): Promise<{ id: string }> {
    const [existing] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, subscription.endpoint],
    );

    if (existing) {
      // Update keys in case they changed
      await this.dataSource.query(
        `UPDATE "${schemaName}".push_subscriptions SET p256dh = $1, auth = $2, user_agent = $3 WHERE id = $4`,
        [subscription.keys.p256dh, subscription.keys.auth, subscription.userAgent || null, existing.id],
      );
      return { id: existing.id };
    }

    const [created] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.userAgent || null],
    );

    return { id: created.id };
  }

  // ============================================================
  // UNSUBSCRIBE
  // ============================================================
  async unsubscribe(schemaName: string, userId: string, endpoint: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
  }

  // ============================================================
  // GET VAPID PUBLIC KEY (for frontend registration)
  // ============================================================
  async getPublicKey(schemaName: string): Promise<string | null> {
    const config = await this.getPushConfig(schemaName);
    return config.publicKey || null;
  }

  // ============================================================
  // GENERATE VAPID KEYS (admin utility)
  // ============================================================
  async generateVapidKeys(schemaName: string): Promise<{ publicKey: string; privateKey: string }> {
    if (!webPush) throw new Error('web-push module not available');

    const keys = webPush.generateVAPIDKeys();

    await this.dataSource.query(
      `UPDATE "${schemaName}".notification_settings
       SET setting_value = setting_value || $1::jsonb, updated_at = NOW()
       WHERE setting_key = 'push_config'`,
      [JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey })],
    );

    this.initialized.delete(schemaName);
    return keys;
  }

  // ============================================================
  // INITIALIZE VAPID (per tenant)
  // ============================================================
  private async ensureInitialized(schemaName: string): Promise<void> {
    if (this.initialized.get(schemaName)) return;
    if (!webPush) return;

    const config = await this.getPushConfig(schemaName);
    if (config.publicKey && config.privateKey) {
      webPush.setVapidDetails(
        config.contact || 'mailto:admin@hiperteam.com',
        config.publicKey,
        config.privateKey,
      );
      this.initialized.set(schemaName, true);
    }
  }

  // ============================================================
  // GET PUSH CONFIG
  // ============================================================
  private async getPushConfig(schemaName: string): Promise<Record<string, any>> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'push_config'`,
      );
      return row?.setting_value || {};
    } catch {
      return {};
    }
  }
}