import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailService } from '../../email/email.service';

export interface EmailPayload {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private transporterCache = new Map<string, nodemailer.Transporter>();

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
  ) {}

  // ============================================================
  // SEND EMAIL
  // Routes to the configured provider: system_default, custom_smtp, sendgrid, aws_ses
  // ============================================================
  async send(schemaName: string, payload: EmailPayload): Promise<boolean> {
    try {
      // 1. Check which email provider is selected
      const provider = await this.getEmailProvider(schemaName);

      switch (provider) {
        case 'sendgrid': {
          const config = await this.getIntegrationConfig(schemaName, 'sendgrid');
          if (!config.apiKey) {
            this.logger.warn('SendGrid selected but no API key configured, falling back to system default');
            return this.sendViaGlobalSmtp(payload);
          }
          return this.sendViaSendGrid(config, payload);
        }
        case 'aws_ses': {
          const config = await this.getIntegrationConfig(schemaName, 'aws_ses');
          if (!config.accessKeyId) {
            this.logger.warn('AWS SES selected but not configured, falling back to system default');
            return this.sendViaGlobalSmtp(payload);
          }
          return this.sendViaAwsSes(config, payload);
        }
        case 'custom_smtp': {
          const config = await this.getSmtpConfig(schemaName);
          if (!config.host) {
            this.logger.warn('Custom SMTP selected but not configured, falling back to system default');
            return this.sendViaGlobalSmtp(payload);
          }
          return this.sendViaCustomSmtp(schemaName, config, payload);
        }
        case 'system_default':
        default:
          // Legacy behavior: check tenant SMTP config first, then fall back to global
          const legacyConfig = await this.getSmtpConfig(schemaName);
          if (legacyConfig.host) {
            return this.sendViaCustomSmtp(schemaName, legacyConfig, payload);
          }
          return this.sendViaGlobalSmtp(payload);
      }
    } catch (err: any) {
      this.logger.error(`Email send failed to ${payload.to}: ${err.message}`);
      return false;
    }
  }

  // ============================================================
  // SEND BULK (for batch notifications)
  // ============================================================
  async sendBulk(schemaName: string, payloads: EmailPayload[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const payload of payloads) {
      const success = await this.send(schemaName, payload);
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  // ============================================================
  // VERIFY CONNECTION (for current provider)
  // ============================================================
  async verify(schemaName: string): Promise<{ success: boolean; error?: string; source?: string }> {
    try {
      const provider = await this.getEmailProvider(schemaName);

      switch (provider) {
        case 'sendgrid': {
          const config = await this.getIntegrationConfig(schemaName, 'sendgrid');
          if (!config.apiKey) return { success: false, error: 'SendGrid API key not configured' };
          return { success: true, source: 'sendgrid' };
        }
        case 'aws_ses': {
          const config = await this.getIntegrationConfig(schemaName, 'aws_ses');
          if (!config.accessKeyId) return { success: false, error: 'AWS SES credentials not configured' };
          // Verify by creating transporter and testing connection
          const transporter = nodemailer.createTransport({
            host: `email-smtp.${config.region || 'us-east-1'}.amazonaws.com`,
            port: 587,
            secure: false,
            auth: { user: config.accessKeyId, pass: config.secretAccessKey },
          });
          await transporter.verify();
          return { success: true, source: 'aws_ses' };
        }
        case 'custom_smtp': {
          const config = await this.getSmtpConfig(schemaName);
          if (!config.host) return { success: false, error: 'Custom SMTP not configured' };
          const transporter = await this.getTransporter(schemaName, config);
          await transporter.verify();
          return { success: true, source: 'custom_smtp' };
        }
        case 'system_default':
        default: {
          const config = await this.getSmtpConfig(schemaName);
          if (config.host) {
            const transporter = await this.getTransporter(schemaName, config);
            await transporter.verify();
            return { success: true, source: 'tenant' };
          }
          return { success: true, source: 'global' };
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ============================================================
  // SMTP TRANSPORTER (cached per schema)
  // ============================================================
  private async getTransporter(schemaName: string, config: Record<string, any>): Promise<nodemailer.Transporter> {
    if (this.transporterCache.has(schemaName)) {
      return this.transporterCache.get(schemaName)!;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port || 587,
      secure: config.secure || false,
      auth: config.user ? {
        user: config.user,
        pass: config.pass,
      } : undefined,
      tls: {
        rejectUnauthorized: false, // Allow self-signed certs in dev
      },
    });

    this.transporterCache.set(schemaName, transporter);
    return transporter;
  }

  // ============================================================
  // GET SMTP CONFIG FROM DB
  // ============================================================
  private async getSmtpConfig(schemaName: string): Promise<Record<string, any>> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'smtp_config'`,
      );
      return row?.setting_value || {};
    } catch {
      return {};
    }
  }

  // ============================================================
  // WRAP IN LAYOUT (consistent email wrapper)
  // ============================================================
  private wrapInLayout(bodyHtml: string, config: Record<string, any>): string {
    const brandName = config.fromName || 'IntelliSales CRM';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:20px 24px">
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600">${brandName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
                This is an automated notification from ${brandName}.
                <br>To manage your notification preferences, visit your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ============================================================
  // SEND VIA SENDGRID (v3 API)
  // ============================================================
  private async sendViaSendGrid(
    config: Record<string, any>,
    payload: EmailPayload,
  ): Promise<boolean> {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: {
          email: config.fromEmail || 'noreply@example.com',
          name: config.fromName || 'IntelliSales CRM',
        },
        subject: payload.subject,
        content: [
          { type: 'text/html', value: payload.html || payload.text || '' },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid error: ${err}`);
    }
    this.logger.log(`[SendGrid] Email sent to ${payload.to}`);
    return true;
  }

  // ============================================================
  // SEND VIA AWS SES (SMTP transport)
  // ============================================================
  private async sendViaAwsSes(
    config: Record<string, any>,
    payload: EmailPayload,
  ): Promise<boolean> {
    const transporter = nodemailer.createTransport({
      host: `email-smtp.${config.region || 'us-east-1'}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: { user: config.accessKeyId, pass: config.secretAccessKey },
    });
    const result = await transporter.sendMail({
      from: `"${config.fromName || 'IntelliSales CRM'}" <${config.fromEmail || 'noreply@example.com'}>`,
      to: payload.to,
      cc: payload.cc || undefined,
      bcc: payload.bcc || undefined,
      subject: payload.subject,
      html: payload.html || undefined,
      text: payload.text,
      replyTo: payload.replyTo,
    });
    this.logger.log(`[AWS SES] Email sent to ${payload.to}: ${result.messageId}`);
    return true;
  }

  // ============================================================
  // SEND VIA CUSTOM SMTP (tenant-configured)
  // ============================================================
  private async sendViaCustomSmtp(
    schemaName: string,
    config: Record<string, any>,
    payload: EmailPayload,
  ): Promise<boolean> {
    const transporter = await this.getTransporter(schemaName, config);
    const result = await transporter.sendMail({
      from: `"${config.fromName || 'IntelliSales CRM'}" <${config.from || 'noreply@hiperteam.com'}>`,
      to: payload.to,
      cc: payload.cc || undefined,
      bcc: payload.bcc || undefined,
      subject: payload.subject,
      html: payload.html ? this.wrapInLayout(payload.html, config) : undefined,
      text: payload.text,
      replyTo: payload.replyTo,
    });
    this.logger.log(`[Custom SMTP] Email sent to ${payload.to}: ${result.messageId}`);
    return true;
  }

  // ============================================================
  // SEND VIA GLOBAL SMTP (system default from .env)
  // ============================================================
  private async sendViaGlobalSmtp(payload: EmailPayload): Promise<boolean> {
    this.logger.debug('Sending via global EmailService (system default)');
    return this.emailService.sendEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html || '',
      text: payload.text,
    });
  }

  // ============================================================
  // GET EMAIL PROVIDER SELECTION
  // ============================================================
  private async getEmailProvider(schemaName: string): Promise<string> {
    try {
      const [row] = await this.dataSource.query(
        `SELECT setting_value FROM "${schemaName}".notification_settings WHERE setting_key = 'email_provider'`,
      );
      return row?.setting_value || 'system_default';
    } catch {
      return 'system_default';
    }
  }

  // ============================================================
  // GET INTEGRATION CONFIG FROM public.tenant_integrations
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

  // ============================================================
  // CLEAR TRANSPORTER CACHE (on config change)
  // ============================================================
  clearCache(schemaName?: string) {
    if (schemaName) {
      this.transporterCache.delete(schemaName);
    } else {
      this.transporterCache.clear();
    }
  }
}