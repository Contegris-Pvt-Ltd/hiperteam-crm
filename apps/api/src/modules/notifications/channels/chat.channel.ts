import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ChatChannel {
  private readonly logger = new Logger(ChatChannel.name);

  constructor(private dataSource: DataSource) {}

  // ============================================================
  // SEND CHAT NOTIFICATION
  // Routes to the configured provider (Slack or Mattermost)
  // ============================================================
  async send(
    schemaName: string,
    payload: { title: string; body: string; actionUrl?: string },
  ): Promise<boolean> {
    try {
      const [setting] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'chat_provider'`,
      );
      const provider = setting?.setting_value;
      if (!provider || provider === 'none') return false;

      const config = await this.getIntegrationConfig(schemaName, provider);
      if (!config?.webhookUrl) {
        this.logger.warn(`No webhook URL configured for chat provider: ${provider}`);
        return false;
      }

      if (provider === 'slack') {
        await this.sendViaSlack(config.webhookUrl, payload);
      } else if (provider === 'mattermost') {
        await this.sendViaMattermost(config.webhookUrl, payload);
      } else {
        this.logger.warn(`Unknown chat provider: ${provider}`);
        return false;
      }

      this.logger.log(`Chat notification sent via ${provider}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Chat notification failed: ${err.message}`);
      return false;
    }
  }

  // ============================================================
  // VERIFY (send a test message)
  // ============================================================
  async verify(
    schemaName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [setting] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'chat_provider'`,
      );
      const provider = setting?.setting_value;
      if (!provider || provider === 'none') {
        return { success: false, error: 'No chat provider configured' };
      }

      const config = await this.getIntegrationConfig(schemaName, provider);
      if (!config?.webhookUrl) {
        return { success: false, error: `No webhook URL configured for ${provider}` };
      }

      await this.send(schemaName, {
        title: 'Test Notification',
        body: 'This is a test message from IntelliSales CRM.',
        actionUrl: undefined,
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ============================================================
  // SLACK ADAPTER
  // ============================================================
  private async sendViaSlack(
    webhookUrl: string,
    payload: { title: string; body: string; actionUrl?: string },
  ): Promise<void> {
    const blocks: any[] = [
      { type: 'header', text: { type: 'plain_text', text: payload.title } },
      { type: 'section', text: { type: 'mrkdwn', text: payload.body } },
    ];
    if (payload.actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in CRM' },
            url: payload.actionUrl,
          },
        ],
      });
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
  }

  // ============================================================
  // MATTERMOST ADAPTER
  // ============================================================
  private async sendViaMattermost(
    webhookUrl: string,
    payload: { title: string; body: string; actionUrl?: string },
  ): Promise<void> {
    const text = `**${payload.title}**\n${payload.body}${
      payload.actionUrl ? `\n[View in CRM](${payload.actionUrl})` : ''
    }`;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Mattermost webhook failed: ${res.status}`);
  }

  // ============================================================
  // GET INTEGRATION CONFIG
  // ============================================================
  private async getIntegrationConfig(
    schemaName: string,
    provider: string,
  ): Promise<Record<string, any>> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT config FROM public.tenant_integrations WHERE tenant_schema = $1 AND provider = $2 AND is_enabled = true`,
        [schemaName, provider],
      );
      return row?.config || {};
    } catch {
      return {};
    }
  }
}
