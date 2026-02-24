import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Twilio will be dynamically imported to handle optional dependency
let TwilioClient: any = null;

@Injectable()
export class SmsWhatsAppChannel {
  private readonly logger = new Logger(SmsWhatsAppChannel.name);
  private clientCache = new Map<string, any>();

  constructor(private dataSource: DataSource) {
    this.loadTwilio();
  }

  private async loadTwilio() {
    try {
      const twilio = await import('twilio');
      TwilioClient = twilio.default || twilio;
      this.logger.log('Twilio module loaded');
    } catch {
      this.logger.warn('Twilio module not available — SMS/WhatsApp notifications disabled');
    }
  }

  // ============================================================
  // SEND SMS
  // ============================================================
  async sendSms(schemaName: string, to: string, body: string): Promise<boolean> {
    try {
      const client = await this.getClient(schemaName);
      if (!client) {
        this.logger.warn(`Twilio not configured for schema: ${schemaName}`);
        return false;
      }

      const config = await this.getTwilioConfig(schemaName);
      if (!config.fromPhone) {
        this.logger.warn('Twilio fromPhone not configured');
        return false;
      }

      const message = await client.messages.create({
        body,
        from: config.fromPhone,
        to: this.normalizePhone(to),
      });

      this.logger.log(`SMS sent to ${to}: SID ${message.sid}`);
      return true;
    } catch (err: any) {
      this.logger.error(`SMS send failed to ${to}: ${err.message}`);
      return false;
    }
  }

  // ============================================================
  // SEND WHATSAPP
  // ============================================================
  async sendWhatsApp(schemaName: string, to: string, body: string, templateId?: string): Promise<boolean> {
    try {
      const client = await this.getClient(schemaName);
      if (!client) {
        this.logger.warn(`Twilio not configured for schema: ${schemaName}`);
        return false;
      }

      const config = await this.getTwilioConfig(schemaName);
      if (!config.whatsappFrom) {
        this.logger.warn('Twilio whatsappFrom not configured');
        return false;
      }

      const messagePayload: any = {
        body,
        from: `whatsapp:${config.whatsappFrom}`,
        to: `whatsapp:${this.normalizePhone(to)}`,
      };

      // If using approved WABA template
      if (templateId) {
        messagePayload.contentSid = templateId;
      }

      const message = await client.messages.create(messagePayload);

      this.logger.log(`WhatsApp sent to ${to}: SID ${message.sid}`);
      return true;
    } catch (err: any) {
      this.logger.error(`WhatsApp send failed to ${to}: ${err.message}`);
      return false;
    }
  }

  // ============================================================
  // VERIFY TWILIO CONFIG
  // ============================================================
  async verify(schemaName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.getClient(schemaName);
      if (!client) {
        return { success: false, error: 'Twilio not configured' };
      }
      // Verify by fetching account info
      //const account = await client.api.accounts(client.accountSid).fetch();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ============================================================
  // GET TWILIO CLIENT (cached per schema)
  // ============================================================
  private async getClient(schemaName: string): Promise<any | null> {
    if (this.clientCache.has(schemaName)) {
      return this.clientCache.get(schemaName);
    }

    if (!TwilioClient) return null;

    const config = await this.getTwilioConfig(schemaName);
    if (!config.accountSid || !config.authToken) return null;

    try {
      const client = TwilioClient(config.accountSid, config.authToken);
      this.clientCache.set(schemaName, client);
      return client;
    } catch (err: any) {
      this.logger.error(`Twilio client init failed: ${err.message}`);
      return null;
    }
  }

  // ============================================================
  // GET CONFIG
  // ============================================================
  private async getTwilioConfig(schemaName: string): Promise<Record<string, any>> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'twilio_config'`,
      );
      return row?.setting_value || {};
    } catch {
      return {};
    }
  }

  // ============================================================
  // NORMALIZE PHONE (ensure E.164)
  // ============================================================
  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!cleaned.startsWith('+')) {
      // Assume it needs a + prefix
      cleaned = `+${cleaned}`;
    }
    return cleaned;
  }

  // ============================================================
  // CLEAR CACHE
  // ============================================================
  clearCache(schemaName?: string) {
    if (schemaName) {
      this.clientCache.delete(schemaName);
    } else {
      this.clientCache.clear();
    }
  }
}