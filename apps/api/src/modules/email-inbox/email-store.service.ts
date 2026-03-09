import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { EmailRulesService } from './email-rules.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class EmailStoreService {
  private readonly logger = new Logger(EmailStoreService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => EmailRulesService))
    private readonly emailRulesService: EmailRulesService,
    private readonly uploadService: UploadService,
  ) {}

  // ── Store a single email (idempotent) ───────────────────────
  async storeEmail(
    schemaName: string,
    accountId: string,
    raw: {
      messageId: string;
      threadId: string | null;
      direction: string;
      subject: string;
      bodyText: string;
      bodyHtml: string | null;
      snippet: string;
      fromEmail: string;
      fromName: string;
      toEmails: { email: string; name?: string }[];
      ccEmails: { email: string; name?: string }[];
      bccEmails: { email: string; name?: string }[];
      sentAt: Date | null;
      receivedAt: Date | null;
      hasAttachments: boolean;
      labels: string[];
    },
  ): Promise<string | null> {
    const trackingToken = randomBytes(20).toString('hex');

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".emails
        (account_id, message_id, thread_id, direction,
         subject, body_text, body_html, snippet,
         from_email, from_name, to_emails, cc_emails, bcc_emails,
         sent_at, received_at, has_attachments, labels,
         tracking_token, is_read)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (account_id, message_id) DO UPDATE SET
         body_text = CASE WHEN "${schemaName}".emails.body_html IS NULL THEN EXCLUDED.body_text ELSE "${schemaName}".emails.body_text END,
         body_html = CASE WHEN "${schemaName}".emails.body_html IS NULL THEN EXCLUDED.body_html ELSE "${schemaName}".emails.body_html END
       RETURNING id, (xmax = 0) AS is_new`,
      [
        accountId,
        raw.messageId,
        raw.threadId,
        raw.direction,
        raw.subject,
        raw.bodyText,
        raw.bodyHtml,
        raw.snippet,
        raw.fromEmail,
        raw.fromName,
        JSON.stringify(raw.toEmails),
        JSON.stringify(raw.ccEmails),
        JSON.stringify(raw.bccEmails),
        raw.sentAt,
        raw.receivedAt,
        raw.hasAttachments,
        JSON.stringify(raw.labels),
        trackingToken,
        raw.direction === 'outbound',
      ],
    );

    if (!row) return null;

    // Only run auto-link and rules for newly inserted emails (not body-updates)
    if (row.is_new) {
      // Auto-link to CRM records (fire-and-forget)
      this.autoLinkEmail(schemaName, row.id, raw.fromEmail, raw.toEmails).catch((err) =>
        this.logger.warn(`Auto-link failed for email ${row.id}: ${err.message}`),
      );

      // Process inbox rules (fire-and-forget — inbound only by default)
      this.emailRulesService
        .processInboundEmail(schemaName, row.id, {
          fromEmail: raw.fromEmail,
          toEmails: raw.toEmails,
          subject: raw.subject,
          bodyText: raw.bodyText,
          hasAttachments: raw.hasAttachments,
          direction: raw.direction,
        })
        .catch((err) =>
          this.logger.warn(`Rules processing failed for email ${row.id}: ${err.message}`),
        );
    }

    return row.id;
  }

  // ── Auto-link email to CRM entities ─────────────────────────
  async autoLinkEmail(
    schemaName: string,
    emailId: string,
    fromEmail: string,
    toEmails: { email: string; name?: string }[],
  ) {
    const allAddresses = [fromEmail, ...toEmails.map((e) => e.email)].filter(Boolean);

    for (const addr of allAddresses) {
      // Link to contacts
      const contacts = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".contacts
         WHERE (email = $1 OR emails @> $2::jsonb)
           AND deleted_at IS NULL
         LIMIT 1`,
        [addr, JSON.stringify([{ email: addr }])],
      );
      if (contacts[0]) {
        await this.insertLink(schemaName, emailId, 'contact', contacts[0].id);
      }

      // Link to leads
      const leads = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".leads
         WHERE email = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [addr],
      );
      if (leads[0]) {
        await this.insertLink(schemaName, emailId, 'lead', leads[0].id);
      }

      // Link to accounts
      const accounts = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".accounts
         WHERE emails @> $1::jsonb
           AND deleted_at IS NULL
         LIMIT 1`,
        [JSON.stringify([{ email: addr }])],
      );
      if (accounts[0]) {
        await this.insertLink(schemaName, emailId, 'account', accounts[0].id);
      }

      // Link to opportunities (via primary_contact email)
      const opportunities = await this.dataSource.query(
        `SELECT o.id FROM "${schemaName}".opportunities o
         JOIN "${schemaName}".contacts c ON c.id = o.primary_contact_id
         WHERE c.email = $1 AND c.deleted_at IS NULL AND o.deleted_at IS NULL
         LIMIT 1`,
        [addr],
      );
      if (opportunities[0]) {
        await this.insertLink(schemaName, emailId, 'opportunity', opportunities[0].id);
      }
    }
  }

  private async insertLink(schemaName: string, emailId: string, entityType: string, entityId: string) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_links (email_id, entity_type, entity_id, auto_linked)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email_id, entity_type, entity_id) DO NOTHING`,
      [emailId, entityType, entityId],
    );
  }

  // ── Get emails (filtered list) ──────────────────────────────
  async getEmails(
    schemaName: string,
    query: {
      accountId?: string;
      userId: string;
      direction?: string;
      isRead?: boolean;
      isStarred?: boolean;
      search?: string;
      entityType?: string;
      entityId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;
    const params: any[] = [query.userId];
    let idx = 2;
    const conditions = [
      `(ea.user_id = $1 OR ea.is_shared = true)`,
      `e.deleted_at IS NULL`,
    ];

    if (query.accountId) {
      conditions.push(`e.account_id = $${idx}`);
      params.push(query.accountId);
      idx++;
    }
    if (query.direction) {
      conditions.push(`e.direction = $${idx}`);
      params.push(query.direction);
      idx++;
    }
    if (query.isRead !== undefined) {
      conditions.push(`e.is_read = $${idx}`);
      params.push(query.isRead);
      idx++;
    }
    if (query.isStarred !== undefined) {
      conditions.push(`e.is_starred = $${idx}`);
      params.push(query.isStarred);
      idx++;
    }
    if (query.search) {
      conditions.push(`(e.subject ILIKE $${idx} OR e.from_email ILIKE $${idx} OR e.from_name ILIKE $${idx} OR e.snippet ILIKE $${idx})`);
      params.push(`%${query.search}%`);
      idx++;
    }

    let joinLinks = '';
    if (query.entityType && query.entityId) {
      joinLinks = `JOIN "${schemaName}".email_links el ON el.email_id = e.id`;
      conditions.push(`el.entity_type = $${idx}`);
      params.push(query.entityType);
      idx++;
      conditions.push(`el.entity_id = $${idx}`);
      params.push(query.entityId);
      idx++;
    }

    const where = conditions.join(' AND ');

    // Thread-grouped: use COALESCE(thread_id, id::text) so emails without thread_id are their own "thread"
    const threadKey = `COALESCE(e.thread_id, e.id::text)`;

    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT ${threadKey}) as total
       FROM "${schemaName}".emails e
       JOIN "${schemaName}".email_accounts ea ON ea.id = e.account_id
       ${joinLinks}
       WHERE ${where}`,
      params,
    );

    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `WITH ranked AS (
         SELECT e.*,
                ea.email as account_email,
                ea.provider as account_provider,
                COALESCE(e.sent_at, e.received_at, e.created_at) as sort_date,
                ${threadKey} as thread_key,
                ROW_NUMBER() OVER (
                  PARTITION BY ${threadKey}
                  ORDER BY COALESCE(e.sent_at, e.received_at, e.created_at) DESC
                ) as rn
         FROM "${schemaName}".emails e
         JOIN "${schemaName}".email_accounts ea ON ea.id = e.account_id
         ${joinLinks}
         WHERE ${where}
       ),
       thread_stats AS (
         SELECT thread_key,
                COUNT(*) as thread_count,
                SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as unread_count,
                BOOL_OR(has_attachments) as thread_has_attachments,
                BOOL_OR(is_starred) as thread_has_star
         FROM ranked
         GROUP BY thread_key
       )
       SELECT r.*, ts.thread_count, ts.unread_count,
              ts.thread_has_attachments, ts.thread_has_star
       FROM ranked r
       JOIN thread_stats ts ON ts.thread_key = r.thread_key
       WHERE r.rn = 1
       ORDER BY r.sort_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );

    return {
      data: rows.map((r: any) => this.formatEmail(r, false, true)),
      meta: {
        total: parseInt(countResult.total, 10),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.total, 10) / limit),
      },
    };
  }

  // ── Get all emails in a thread ────────────────────────────
  async getThreadEmails(schemaName: string, threadId: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT e.*, ea.email as account_email, ea.provider as account_provider
       FROM "${schemaName}".emails e
       JOIN "${schemaName}".email_accounts ea ON ea.id = e.account_id
         AND (ea.user_id = $2 OR ea.is_shared = true)
       WHERE e.thread_id = $1 AND e.deleted_at IS NULL
       ORDER BY COALESCE(e.sent_at, e.received_at, e.created_at) ASC`,
      [threadId, userId],
    );

    // Fetch attachments for all emails in the thread
    const emailIds = rows.map((r: any) => r.id);
    const attachmentMap: Record<string, any[]> = {};
    if (emailIds.length > 0) {
      const placeholders = emailIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      const attachments = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".email_attachments WHERE email_id IN (${placeholders}) ORDER BY created_at`,
        emailIds,
      );
      for (const a of attachments) {
        if (!attachmentMap[a.email_id]) attachmentMap[a.email_id] = [];
        attachmentMap[a.email_id].push({
          id: a.id,
          filename: a.filename,
          mimeType: a.mime_type,
          sizeBytes: a.size_bytes,
          storageUrl: a.storage_url,
        });
      }
    }

    return rows.map((r: any) => ({
      ...this.formatEmail(r, true),
      attachments: attachmentMap[r.id] || [],
    }));
  }

  // ── Get single email with attachments and links ─────────────
  async getEmailById(schemaName: string, id: string, userId: string) {
    const [row] = await this.dataSource.query(
      `SELECT e.*, ea.email as account_email, ea.provider as account_provider
       FROM "${schemaName}".emails e
       JOIN "${schemaName}".email_accounts ea ON ea.id = e.account_id
         AND (ea.user_id = $2 OR ea.is_shared = true)
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Email not found');

    const attachments = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_attachments WHERE email_id = $1 ORDER BY created_at`,
      [id],
    );

    const links = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_links WHERE email_id = $1 ORDER BY created_at`,
      [id],
    );

    return {
      ...this.formatEmail(row, true),
      attachments: attachments.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
        storageUrl: a.storage_url,
      })),
      links: links.map((l: any) => ({
        id: l.id,
        entityType: l.entity_type,
        entityId: l.entity_id,
        autoLinked: l.auto_linked,
      })),
    };
  }

  // ── Get emails linked to a CRM entity ───────────────────────
  async getEntityEmails(schemaName: string, entityType: string, entityId: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT e.*, ea.email as account_email, ea.provider as account_provider
       FROM "${schemaName}".emails e
       JOIN "${schemaName}".email_links el ON el.email_id = e.id
       JOIN "${schemaName}".email_accounts ea ON ea.id = e.account_id
         AND (ea.user_id = $3 OR ea.is_shared = true)
       WHERE el.entity_type = $1 AND el.entity_id = $2 AND e.deleted_at IS NULL
       ORDER BY COALESCE(e.sent_at, e.received_at, e.created_at) DESC`,
      [entityType, entityId, userId],
    );
    return rows.map((r: any) => this.formatEmail(r));
  }

  // ── Mark read/unread ────────────────────────────────────────
  async markRead(schemaName: string, id: string, isRead: boolean) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET is_read = $2 WHERE id = $1`,
      [id, isRead],
    );
  }

  // ── Toggle star ─────────────────────────────────────────────
  async toggleStar(schemaName: string, id: string) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET is_starred = NOT is_starred WHERE id = $1`,
      [id],
    );
  }

  // ── Link email to CRM entity (manual) ──────────────────────
  async linkEmail(schemaName: string, emailId: string, entityType: string, entityId: string, userId: string) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_links (email_id, entity_type, entity_id, linked_by, auto_linked)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (email_id, entity_type, entity_id) DO NOTHING`,
      [emailId, entityType, entityId, userId],
    );
  }

  // ── Unlink email from CRM entity ───────────────────────────
  async unlinkEmail(schemaName: string, emailId: string, entityType: string, entityId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".email_links
       WHERE email_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [emailId, entityType, entityId],
    );
  }

  // ── Track open (public pixel) ───────────────────────────────
  async trackOpen(schemaName: string, token: string, ip?: string, userAgent?: string): Promise<boolean> {
    // Find the email by tracking token across all tenant schemas
    const [email] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".emails WHERE tracking_token = $1`,
      [token],
    );
    if (!email) return false;

    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET opens_count = opens_count + 1 WHERE id = $1`,
      [email.id],
    );

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_tracking_events (email_id, type, ip, user_agent)
       VALUES ($1, 'open', $2, $3)`,
      [email.id, ip || null, userAgent || null],
    );

    return true;
  }

  // ── Find email account by email address (cross-tenant for webhooks) ──
  async findAccountByEmail(email: string): Promise<{ schemaName: string; accountId: string } | null> {
    const tenants = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE status = 'active'`,
    );

    for (const tenant of tenants) {
      const schema = tenant.schema_name;
      try {
        const [account] = await this.dataSource.query(
          `SELECT id FROM "${schema}".email_accounts WHERE email = $1 LIMIT 1`,
          [email],
        );
        if (account) {
          return { schemaName: schema, accountId: account.id };
        }
      } catch {
        // Schema may not have the table yet
      }
    }
    return null;
  }

  // ── Extract base64 inline images from HTML, upload to S3, return cleaned HTML ──
  async extractAndUploadInlineImages(
    schemaName: string,
    bodyHtml: string,
  ): Promise<string> {
    const tenantSlug = schemaName.replace(/^tenant_/, '');
    // Match data:image/xxx;base64,... in src attributes
    const regex = /src=["'](data:(image\/[^;]+);base64,([^"']+))["']/gi;
    let match: RegExpExecArray | null;
    const replacements: Array<{ original: string; url: string }> = [];

    while ((match = regex.exec(bodyHtml)) !== null) {
      try {
        const contentType = match[2];
        const base64Data = match[3];
        const ext = contentType.split('/')[1]?.replace('+xml', '') || 'png';
        const buffer = Buffer.from(base64Data, 'base64');

        const multerFile = {
          buffer,
          originalname: `inline-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
          mimetype: contentType,
          size: buffer.length,
        } as Express.Multer.File;

        const { url } = await this.uploadService.uploadFile(
          multerFile,
          'email-inline-images',
          tenantSlug,
        );

        replacements.push({ original: match[1], url });
      } catch (err: any) {
        this.logger.warn(`Failed to upload inline image: ${err.message}`);
      }
    }

    let result = bodyHtml;
    for (const r of replacements) {
      result = result.replace(r.original, r.url);
    }
    return result;
  }

  // ── Upload a CID inline image to S3 and return its URL ──
  async uploadInlineImage(
    schemaName: string,
    filename: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    const tenantSlug = schemaName.replace(/^tenant_/, '');
    const multerFile = {
      buffer: content,
      originalname: filename,
      mimetype: contentType,
      size: content.length,
    } as Express.Multer.File;

    const { url } = await this.uploadService.uploadFile(
      multerFile,
      'email-inline-images',
      tenantSlug,
    );
    return url;
  }

  // ── Update email body HTML (e.g. after CID replacement) ──
  async updateEmailBodyHtml(schemaName: string, emailId: string, bodyHtml: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET body_html = $2 WHERE id = $1`,
      [emailId, bodyHtml],
    );
  }

  // ── Store attachments to S3 + email_attachments table ──
  async storeAttachments(
    schemaName: string,
    emailId: string,
    attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>,
  ): Promise<void> {
    const tenantSlug = schemaName.replace(/^tenant_/, '');

    for (const att of attachments) {
      try {
        // Create a Multer-like file object for UploadService
        const multerFile = {
          buffer: att.content,
          originalname: att.filename,
          mimetype: att.contentType,
          size: att.content.length,
        } as Express.Multer.File;

        const { url } = await this.uploadService.uploadFile(
          multerFile,
          'email-attachments',
          tenantSlug,
        );

        await this.dataSource.query(
          `INSERT INTO "${schemaName}".email_attachments
            (email_id, filename, mime_type, size_bytes, storage_url)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [emailId, att.filename, att.contentType, att.content.length, url],
        );
      } catch (err: any) {
        this.logger.warn(`Failed to store attachment "${att.filename}" for email ${emailId}: ${err.message}`);
      }
    }
  }

  // ── Format helpers ──────────────────────────────────────────
  private formatEmail(r: any, includeBody = false, includeThreadStats = false) {
    const result: any = {
      id: r.id,
      accountId: r.account_id,
      accountEmail: r.account_email || null,
      accountProvider: r.account_provider || null,
      messageId: r.message_id,
      threadId: r.thread_id,
      direction: r.direction,
      subject: r.subject,
      snippet: r.snippet,
      fromEmail: r.from_email,
      fromName: r.from_name,
      toEmails: typeof r.to_emails === 'string' ? JSON.parse(r.to_emails) : r.to_emails,
      ccEmails: typeof r.cc_emails === 'string' ? JSON.parse(r.cc_emails) : r.cc_emails,
      sentAt: r.sent_at,
      receivedAt: r.received_at,
      isRead: r.is_read,
      isStarred: r.is_starred,
      isDraft: r.is_draft,
      hasAttachments: r.has_attachments,
      labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
      opensCount: r.opens_count,
      clicksCount: r.clicks_count,
      createdAt: r.created_at,
    };

    if (includeBody) {
      result.bodyHtml = r.body_html;
      result.bodyText = r.body_text;
    }

    if (includeThreadStats) {
      result.threadCount = parseInt(r.thread_count, 10) || 1;
      result.threadUnreadCount = parseInt(r.unread_count, 10) || 0;
      result.threadHasAttachments = r.thread_has_attachments || false;
      result.threadHasStar = r.thread_has_star || false;
    }

    return result;
  }

  // ── Delete emails (soft delete) ──────────────────────────────

  async deleteEmail(schemaName: string, id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async bulkDeleteEmails(schemaName: string, ids: string[]): Promise<{ deleted: number }> {
    if (!ids.length) return { deleted: 0 };
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET deleted_at = NOW() WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids,
    );
    return { deleted: result[1] || ids.length };
  }

  async bulkMarkRead(schemaName: string, ids: string[], isRead: boolean): Promise<void> {
    if (!ids.length) return;
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await this.dataSource.query(
      `UPDATE "${schemaName}".emails SET is_read = $1 WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [isRead, ...ids],
    );
  }
}
