import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private fromName: string;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('email.host');
    const port = this.configService.get<number>('email.port');
    const secure = this.configService.get<boolean>('email.secure');
    const user = this.configService.get<string>('email.user');
    const password = this.configService.get<string>('email.password');

    this.fromName = this.configService.get<string>('email.fromName') || 'Intellicon CRM';
    this.fromEmail = this.configService.get<string>('email.fromEmail') || 'noreply@intellicon.io';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      name: 'hiperteam-crm.local',
      auth: user && password ? { user, pass: password } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection on startup
    this.transporter.verify().then(() => {
      this.logger.log('SMTP connection established');
    }).catch((err: Error) => {
      this.logger.warn(`SMTP connection failed: ${err.message}. Emails will be logged only.`);
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const result = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.log(`Email sent to ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      // Log the email content for debugging in dev
      if (this.configService.get('app.env') === 'development') {
        this.logger.debug(`Email content: ${options.subject} → ${options.to}`);
        this.logger.debug(options.html);
      }
      return false;
    }
  }

  /**
   * Send user invitation email
   */
  async sendInviteEmail(params: {
    to: string;
    inviterName: string;
    tenantName: string;
    inviteUrl: string;
    roleName: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const { to, inviterName, tenantName, inviteUrl, roleName, expiresAt } = params;
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Intellicon CRM</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;">You've been invited!</h2>
                    <p style="color:#4a4a68;line-height:1.6;margin:0 0 24px;">
                      <strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on Intellicon CRM as a <strong>${roleName}</strong>.
                    </p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:8px;padding:14px 32px;">
                          <a href="${inviteUrl}" style="color:#fff;text-decoration:none;font-weight:600;font-size:16px;">Accept Invitation</a>
                        </td>
                      </tr>
                    </table>
                    <p style="color:#8a8aab;font-size:13px;line-height:1.5;margin:0 0 8px;">
                      This invitation expires on ${expiryDate}.
                    </p>
                    <p style="color:#8a8aab;font-size:13px;line-height:1.5;margin:0;">
                      If the button doesn't work, copy and paste this link:<br>
                      <a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fb;padding:20px 40px;text-align:center;">
                    <p style="color:#8a8aab;font-size:12px;margin:0;">
                      &copy; ${new Date().getFullYear()} Intellicon CRM. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `${inviterName} invited you to join ${tenantName} on Intellicon CRM`,
      html,
    });
  }

  /**
   * Send welcome email after user accepts invite or is created directly
   */
  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
    tenantName: string;
    loginUrl: string;
    temporaryPassword?: string;
  }): Promise<boolean> {
    const { to, firstName, tenantName, loginUrl, temporaryPassword } = params;

    const passwordSection = temporaryPassword
      ? `<p style="color:#4a4a68;line-height:1.6;margin:0 0 8px;">Your temporary password is:</p>
         <div style="background:#f0f4ff;border:1px solid #dbe4ff;border-radius:8px;padding:12px 16px;margin:0 0 16px;font-family:monospace;font-size:16px;color:#2563eb;letter-spacing:1px;">
           ${temporaryPassword}
         </div>
         <p style="color:#e74c3c;font-size:13px;margin:0 0 24px;">Please change your password after first login.</p>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <tr>
                  <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Intellicon CRM</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;">Welcome, ${firstName}!</h2>
                    <p style="color:#4a4a68;line-height:1.6;margin:0 0 24px;">
                      Your account on <strong>${tenantName}</strong> has been created. You can now log in and start using Intellicon CRM.
                    </p>
                    ${passwordSection}
                    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);border-radius:8px;padding:14px 32px;">
                          <a href="${loginUrl}" style="color:#fff;text-decoration:none;font-weight:600;font-size:16px;">Go to Login</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f9fb;padding:20px 40px;text-align:center;">
                    <p style="color:#8a8aab;font-size:12px;margin:0;">
                      &copy; ${new Date().getFullYear()} Intellicon CRM. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `Welcome to ${tenantName} on Intellicon CRM`,
      html,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}