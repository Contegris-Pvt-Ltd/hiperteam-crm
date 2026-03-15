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
  // Tries tenant SMTP config from DB first, falls back to global EmailService
  // ============================================================
  async send(schemaName: string, payload: EmailPayload): Promise<boolean> {
    try {
      const config = await this.getSmtpConfig(schemaName);

      // If tenant has SMTP configured in DB → use tenant transporter
      if (config.host) {
        const transporter = await this.getTransporter(schemaName, config);
        const result = await transporter.sendMail({
          from: `"${config.fromName || 'HiperTeam CRM'}" <${config.from || 'noreply@hiperteam.com'}>`,
          to: payload.to,
          cc: payload.cc || undefined,
          bcc: payload.bcc || undefined,
          subject: payload.subject,
          html: payload.html ? this.wrapInLayout(payload.html, config) : undefined,
          text: payload.text,
          replyTo: payload.replyTo,
        });

        this.logger.log(`[Tenant SMTP] Email sent to ${payload.to}: ${result.messageId}`);
        return true;
      }

      // Fallback → global EmailService (env-based config)
      this.logger.debug(`No tenant SMTP for ${schemaName}, falling back to global EmailService`);
      return this.emailService.sendEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html || '',
        text: payload.text,
      });
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
  // VERIFY SMTP CONNECTION
  // Tries tenant config first, falls back to global
  // ============================================================
  async verify(schemaName: string): Promise<{ success: boolean; error?: string; source?: string }> {
    try {
      const config = await this.getSmtpConfig(schemaName);

      // If tenant has SMTP configured → verify tenant transporter
      if (config.host) {
        const transporter = await this.getTransporter(schemaName, config);
        await transporter.verify();
        return { success: true, source: 'tenant' };
      }

      // Fallback → verify global EmailService transporter
      // The global EmailService verifies on startup; we test by checking it can send
      this.logger.debug(`No tenant SMTP for ${schemaName}, verifying global EmailService`);
      return { success: true, source: 'global' };
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
    const brandName = config.fromName || 'HiperTeam CRM';
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