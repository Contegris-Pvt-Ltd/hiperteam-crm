import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailAccountsService } from './email-accounts.service';
import { EmailStoreService } from './email-store.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailSendService {
  private readonly logger = new Logger(EmailSendService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailAccountsService: EmailAccountsService,
    private readonly emailStoreService: EmailStoreService,
  ) {}

  // ── Send email ──────────────────────────────────────────────
  async sendEmail(
    schemaName: string,
    accountId: string,
    userId: string,
    dto: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      inReplyTo?: string;
      threadId?: string;
      attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
    },
  ): Promise<string> {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const trackingToken = randomBytes(20).toString('hex');
    const draftMessageId = `draft-${randomBytes(16).toString('hex')}`;

    // Extract base64 inline images, upload to S3, replace with URLs
    if (dto.bodyHtml.includes('data:image/')) {
      dto.bodyHtml = await this.emailStoreService.extractAndUploadInlineImages(schemaName, dto.bodyHtml);
    }

    // Strip HTML tags to generate plain text if not provided
    const bodyText = dto.bodyText || dto.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Insert as draft first
    const [draft] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".emails
        (account_id, message_id, thread_id, direction, subject,
         body_text, body_html, snippet, from_email, from_name,
         to_emails, cc_emails, bcc_emails,
         has_attachments, is_draft, is_read, tracking_token)
       VALUES ($1,$2,$3,'outbound',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,true,$14)
       RETURNING id`,
      [
        accountId,
        draftMessageId,
        dto.threadId || null,
        dto.subject,
        bodyText,
        dto.bodyHtml,
        bodyText.substring(0, 200),
        account.email,
        account.display_name || '',
        JSON.stringify(dto.to.map((e) => ({ email: e }))),
        JSON.stringify((dto.cc || []).map((e) => ({ email: e }))),
        JSON.stringify((dto.bcc || []).map((e) => ({ email: e }))),
        !!(dto.attachments?.length),
        trackingToken,
      ],
    );

    try {
      let providerMessageId: string | null = null;

      switch (account.provider) {
        case 'gmail':
          providerMessageId = await this.sendViaGmail(schemaName, account, dto, dto.attachments);
          break;
        case 'microsoft':
          providerMessageId = await this.sendViaMicrosoft(schemaName, account, dto, dto.attachments);
          break;
        case 'imap':
          providerMessageId = await this.sendViaSmtp(account, dto, dto.attachments);
          break;
        default:
          throw new Error(`Unsupported provider: ${account.provider}`);
      }

      // Mark as sent
      await this.dataSource.query(
        `UPDATE "${schemaName}".emails
         SET is_draft = false,
             message_id = COALESCE($2, message_id),
             sent_at = NOW()
         WHERE id = $1`,
        [draft.id, providerMessageId],
      );

      // Store attachments to S3 + email_attachments table
      if (dto.attachments?.length) {
        this.emailStoreService
          .storeAttachments(schemaName, draft.id, dto.attachments)
          .catch((err) => this.logger.warn(`Attachment storage failed: ${err.message}`));
      }

      // Auto-link
      const toEmails = dto.to.map((e) => ({ email: e }));
      this.emailStoreService
        .autoLinkEmail(schemaName, draft.id, account.email, toEmails)
        .catch((err) => this.logger.warn(`Auto-link failed: ${err.message}`));

      this.logger.log(`Email sent via ${account.provider}: ${dto.subject}`);
      return draft.id;
    } catch (err: any) {
      // Delete draft on send failure
      await this.dataSource.query(
        `DELETE FROM "${schemaName}".emails WHERE id = $1`,
        [draft.id],
      );
      this.logger.error(`Send failed: ${err.message}`);
      throw err;
    }
  }

  // ── Reply ───────────────────────────────────────────────────
  async replyToEmail(
    schemaName: string,
    accountId: string,
    userId: string,
    originalEmailId: string,
    dto: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      bodyHtml: string;
      bodyText?: string;
    },
  ): Promise<string> {
    const [original] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".emails WHERE id = $1`,
      [originalEmailId],
    );
    if (!original) throw new NotFoundException('Original email not found');

    const subject = original.subject?.startsWith('Re: ')
      ? original.subject
      : `Re: ${original.subject || ''}`;

    return this.sendEmail(schemaName, accountId, userId, {
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject,
      bodyHtml: dto.bodyHtml,
      bodyText: dto.bodyText,
      inReplyTo: original.message_id,
      threadId: original.thread_id,
    });
  }

  // ── Forward ─────────────────────────────────────────────────
  async forwardEmail(
    schemaName: string,
    accountId: string,
    userId: string,
    originalEmailId: string,
    dto: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      bodyHtml?: string;
    },
  ): Promise<string> {
    const [original] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".emails WHERE id = $1`,
      [originalEmailId],
    );
    if (!original) throw new NotFoundException('Original email not found');

    const subject = original.subject?.startsWith('Fwd: ')
      ? original.subject
      : `Fwd: ${original.subject || ''}`;

    const quotedBody = `
      ${dto.bodyHtml || ''}
      <br/><br/>
      <div style="border-left:2px solid #ccc;padding-left:12px;margin-left:4px;color:#666">
        <p><strong>From:</strong> ${original.from_name || ''} &lt;${original.from_email || ''}&gt;<br/>
        <strong>Date:</strong> ${original.sent_at || original.received_at || ''}<br/>
        <strong>Subject:</strong> ${original.subject || ''}</p>
        ${original.body_html || original.body_text || ''}
      </div>
    `;

    return this.sendEmail(schemaName, accountId, userId, {
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject,
      bodyHtml: quotedBody,
      threadId: original.thread_id,
    });
  }

  // ── Provider-specific send methods ──────────────────────────

  private async sendViaGmail(
    schemaName: string,
    account: any,
    dto: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; bodyHtml: string; inReplyTo?: string },
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<string> {
    // Refresh token if needed
    let accessToken = account.access_token;
    if (account.token_expiry && new Date(account.token_expiry) <= new Date(Date.now() + 60000)) {
      accessToken = await this.refreshGmailToken(schemaName, account);
    }

    // Build RFC 2822 message
    const headers = [
      `From: ${account.display_name || ''} <${account.email}>`,
      `To: ${dto.to.join(', ')}`,
    ];
    if (dto.cc?.length) headers.push(`Cc: ${dto.cc.join(', ')}`);
    if (dto.inReplyTo) headers.push(`In-Reply-To: ${dto.inReplyTo}`);
    headers.push(`Subject: ${dto.subject}`);
    headers.push('MIME-Version: 1.0');

    let mimeBody: string;

    if (attachments?.length) {
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      const parts: string[] = [];
      // HTML body part
      parts.push(`--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${dto.bodyHtml}`);
      // Attachment parts
      for (const att of attachments) {
        const b64 = att.content.toString('base64');
        parts.push(
          `--${boundary}\r\nContent-Type: ${att.contentType}; name="${att.filename}"\r\nContent-Disposition: attachment; filename="${att.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}`,
        );
      }
      parts.push(`--${boundary}--`);
      mimeBody = headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
    } else {
      headers.push('Content-Type: text/html; charset=utf-8');
      mimeBody = headers.join('\r\n') + '\r\n\r\n' + dto.bodyHtml;
    }

    const raw = Buffer.from(mimeBody)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gmail send failed: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.id;
  }

  private async sendViaMicrosoft(
    schemaName: string,
    account: any,
    dto: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; bodyHtml: string },
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<string | null> {
    let accessToken = account.access_token;
    if (account.token_expiry && new Date(account.token_expiry) <= new Date(Date.now() + 60000)) {
      accessToken = await this.refreshMicrosoftToken(schemaName, account);
    }

    const message: any = {
      subject: dto.subject,
      body: { contentType: 'HTML', content: dto.bodyHtml },
      toRecipients: dto.to.map((e) => ({ emailAddress: { address: e } })),
    };
    if (dto.cc?.length) {
      message.ccRecipients = dto.cc.map((e) => ({ emailAddress: { address: e } }));
    }
    if (dto.bcc?.length) {
      message.bccRecipients = dto.bcc.map((e) => ({ emailAddress: { address: e } }));
    }
    if (attachments?.length) {
      message.attachments = attachments.map((att) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType,
        contentBytes: att.content.toString('base64'),
      }));
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Microsoft send failed: ${response.status} - ${err}`);
    }

    return null; // Microsoft sendMail doesn't return message ID
  }

  private async sendViaSmtp(
    account: any,
    dto: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; bodyHtml: string; bodyText?: string },
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<string | null> {
    // Dynamic import to avoid requiring nodemailer globally
    let nodemailer: any;
    try {
      nodemailer = await import('nodemailer');
    } catch {
      throw new Error('nodemailer not installed. Run: npm install nodemailer');
    }

    const password = this.emailAccountsService.decryptPassword(account.imap_password);

    const transport = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: { user: account.email, pass: password },
    });

    const mailOptions: any = {
      from: account.display_name
        ? `"${account.display_name}" <${account.email}>`
        : account.email,
      to: dto.to.join(', '),
      cc: dto.cc?.join(', '),
      bcc: dto.bcc?.join(', '),
      subject: dto.subject,
      html: dto.bodyHtml,
      text: dto.bodyText,
    };
    if (attachments?.length) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    const info = await transport.sendMail(mailOptions);

    return info.messageId || null;
  }

  // ── Token refresh helpers ───────────────────────────────────
  private async refreshGmailToken(schemaName: string, account: any): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID || '',
        client_secret: process.env.GMAIL_CLIENT_SECRET || '',
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) throw new Error('Gmail token refresh failed');
    const data = await response.json();

    await this.emailAccountsService.updateTokens(
      schemaName, account.id, data.access_token,
      new Date(Date.now() + data.expires_in * 1000),
      data.refresh_token,
    );

    return data.access_token;
  }

  private async refreshMicrosoftToken(schemaName: string, account: any): Promise<string> {
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID || '',
        client_secret: process.env.MS_CLIENT_SECRET || '',
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
        scope: 'Mail.ReadWrite Mail.Send offline_access',
      }),
    });

    if (!response.ok) throw new Error('Microsoft token refresh failed');
    const data = await response.json();

    await this.emailAccountsService.updateTokens(
      schemaName, account.id, data.access_token,
      new Date(Date.now() + data.expires_in * 1000),
      data.refresh_token,
    );

    return data.access_token;
  }
}
