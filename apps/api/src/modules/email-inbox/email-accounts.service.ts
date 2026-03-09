import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EmailAccountsService {
  private readonly logger = new Logger(EmailAccountsService.name);
  private readonly algorithm = 'aes-256-cbc';

  constructor(private readonly dataSource: DataSource) {}

  // ── List accounts visible to user (own + shared) ────────────
  async getAccounts(schemaName: string, userId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_accounts
       WHERE (user_id = $1 OR is_shared = true)
       ORDER BY is_shared DESC, created_at ASC`,
      [userId],
    );
    return rows.map((r: any) => this.formatAccount(r));
  }

  // ── Get single account ──────────────────────────────────────
  async getAccountById(schemaName: string, id: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_accounts WHERE id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('Email account not found');
    return row;
  }

  // ── Create IMAP/SMTP account ────────────────────────────────
  async createImapAccount(
    schemaName: string,
    userId: string,
    dto: {
      email: string;
      displayName?: string;
      imapHost: string;
      imapPort: number;
      imapSecure: boolean;
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      password: string;
      isShared: boolean;
    },
  ) {
    const encryptedPassword = this.encryptPassword(dto.password);

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_accounts
        (user_id, is_shared, provider, email, display_name,
         imap_host, imap_port, imap_secure,
         smtp_host, smtp_port, smtp_secure, imap_password)
       VALUES ($1, $2, 'imap', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        dto.isShared,
        dto.email,
        dto.displayName || null,
        dto.imapHost,
        dto.imapPort,
        dto.imapSecure,
        dto.smtpHost,
        dto.smtpPort,
        dto.smtpSecure,
        encryptedPassword,
      ],
    );

    this.logger.log(`IMAP account created: ${dto.email} for user ${userId}`);
    return this.formatAccount(row);
  }

  // ── Save Gmail OAuth account (upsert) ───────────────────────
  async saveGmailAccount(
    schemaName: string,
    userId: string,
    dto: {
      email: string;
      displayName?: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiry: Date;
      historyId?: string;
      isShared: boolean;
    },
  ) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_accounts
        (user_id, is_shared, provider, email, display_name,
         access_token, refresh_token, token_expiry, history_id)
       VALUES ($1, $2, 'gmail', $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email, user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry = EXCLUDED.token_expiry,
         history_id = COALESCE(EXCLUDED.history_id, "${schemaName}".email_accounts.history_id),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        dto.isShared,
        dto.email,
        dto.displayName || null,
        dto.accessToken,
        dto.refreshToken,
        dto.tokenExpiry,
        dto.historyId || null,
      ],
    );

    this.logger.log(`Gmail account saved: ${dto.email}`);
    return this.formatAccount(row);
  }

  // ── Save Microsoft OAuth account (upsert) ───────────────────
  async saveMicrosoftAccount(
    schemaName: string,
    userId: string,
    dto: {
      email: string;
      displayName?: string;
      accessToken: string;
      refreshToken: string;
      tokenExpiry: Date;
      msSubscriptionId?: string;
      isShared: boolean;
    },
  ) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".email_accounts
        (user_id, is_shared, provider, email, display_name,
         access_token, refresh_token, token_expiry, ms_subscription_id)
       VALUES ($1, $2, 'microsoft', $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email, user_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry = EXCLUDED.token_expiry,
         ms_subscription_id = COALESCE(EXCLUDED.ms_subscription_id, "${schemaName}".email_accounts.ms_subscription_id),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        dto.isShared,
        dto.email,
        dto.displayName || null,
        dto.accessToken,
        dto.refreshToken,
        dto.tokenExpiry,
        dto.msSubscriptionId || null,
      ],
    );

    this.logger.log(`Microsoft account saved: ${dto.email}`);
    return this.formatAccount(row);
  }

  // ── Update webhook / sync state ─────────────────────────────
  async updateWebhookState(
    schemaName: string,
    accountId: string,
    dto: {
      webhookResourceId?: string;
      webhookExpiry?: Date;
      msSubscriptionId?: string;
      historyId?: string;
      lastSyncedAt?: Date;
    },
  ) {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (dto.webhookResourceId !== undefined) {
      setClauses.push(`webhook_resource_id = $${idx}`);
      params.push(dto.webhookResourceId);
      idx++;
    }
    if (dto.webhookExpiry !== undefined) {
      setClauses.push(`webhook_expiry = $${idx}`);
      params.push(dto.webhookExpiry);
      idx++;
    }
    if (dto.msSubscriptionId !== undefined) {
      setClauses.push(`ms_subscription_id = $${idx}`);
      params.push(dto.msSubscriptionId);
      idx++;
    }
    if (dto.historyId !== undefined) {
      setClauses.push(`history_id = $${idx}`);
      params.push(dto.historyId);
      idx++;
    }
    if (dto.lastSyncedAt !== undefined) {
      setClauses.push(`last_synced_at = $${idx}`);
      params.push(dto.lastSyncedAt);
      idx++;
    }

    params.push(accountId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".email_accounts SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );
  }

  // ── Update tokens after refresh ─────────────────────────────
  async updateTokens(
    schemaName: string,
    accountId: string,
    accessToken: string,
    tokenExpiry: Date,
    refreshToken?: string,
  ) {
    const setClauses = [
      'access_token = $1',
      'token_expiry = $2',
      'updated_at = NOW()',
    ];
    const params: any[] = [accessToken, tokenExpiry];
    let idx = 3;

    if (refreshToken) {
      setClauses.push(`refresh_token = $${idx}`);
      params.push(refreshToken);
      idx++;
    }

    params.push(accountId);
    await this.dataSource.query(
      `UPDATE "${schemaName}".email_accounts SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params,
    );
  }

  // ── Get account by email address (within a schema) ─────────
  async getAccountByEmail(schemaName: string, email: string) {
    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".email_accounts WHERE email = $1 LIMIT 1`,
      [email],
    );
    return row ? this.formatAccount(row) : null;
  }

  // ── Delete account ──────────────────────────────────────────
  async deleteAccount(schemaName: string, id: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".email_accounts WHERE id = $1`,
      [id],
    );
  }

  // ── Encryption helpers ──────────────────────────────────────
  encryptPassword(plain: string): string {
    const key = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(plain, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptPassword(encrypted: string): string {
    const key = Buffer.from(process.env.EMAIL_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
    const [ivHex, encHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(this.algorithm, key, iv);
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ── Format helper ───────────────────────────────────────────
  private formatAccount(r: any) {
    return {
      id: r.id,
      userId: r.user_id,
      isShared: r.is_shared,
      provider: r.provider,
      email: r.email,
      displayName: r.display_name,
      syncEnabled: r.sync_enabled,
      lastSyncedAt: r.last_synced_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
