import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailAccountsService } from './email-accounts.service';
import { EmailStoreService } from './email-store.service';

@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailAccountsService: EmailAccountsService,
    private readonly emailStoreService: EmailStoreService,
  ) {}

  // ── Register Gmail Push Notifications ───────────────────────
  async registerGmailWatch(schemaName: string, accountId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const accessToken = await this.refreshGmailTokenIfNeeded(schemaName, account);

    const topicName = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) {
      this.logger.warn('GMAIL_PUBSUB_TOPIC not configured, skipping watch registration');
      return;
    }

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX', 'SENT'],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Gmail watch registration failed: ${err}`);
      throw new Error(`Gmail watch failed: ${response.status}`);
    }

    const data = await response.json();
    const expiry = new Date(parseInt(data.expiration));

    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      webhookResourceId: data.historyId,
      webhookExpiry: expiry,
      historyId: data.historyId,
    });

    this.logger.log(`Gmail watch registered for account ${accountId}, expires ${expiry.toISOString()}`);
  }

  // ── Register Microsoft Webhook ──────────────────────────────
  async registerMicrosoftWebhook(schemaName: string, accountId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const accessToken = await this.refreshMicrosoftTokenIfNeeded(schemaName, account);

    const webhookUrl = process.env.MS_WEBHOOK_URL;
    const clientState = process.env.MS_WEBHOOK_CLIENT_STATE || 'intellicon-crm';
    if (!webhookUrl) {
      this.logger.warn('MS_WEBHOOK_URL not configured, skipping subscription');
      return;
    }

    const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl: webhookUrl,
        resource: "me/mailFolders('inbox')/messages",
        expirationDateTime,
        clientState,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Microsoft subscription failed: ${err}`);
      throw new Error(`MS subscription failed: ${response.status}`);
    }

    const sub = await response.json();

    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      msSubscriptionId: sub.id,
    });

    this.logger.log(`Microsoft webhook registered for account ${accountId}, sub ${sub.id}`);
  }

  // ── Handle Gmail Push Notification ──────────────────────────
  async handleGmailPush(schemaName: string, accountId: string, historyId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);

    // Skip if we've already processed this history
    if (account.history_id && BigInt(historyId) <= BigInt(account.history_id)) {
      return;
    }

    const accessToken = await this.refreshGmailTokenIfNeeded(schemaName, account);

    // Fetch history since last known point
    const startHistoryId = account.history_id || historyId;
    const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;

    const response = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // History expired — do a full sync of recent messages
        await this.syncGmailRecent(schemaName, accountId, accessToken);
      } else {
        this.logger.error(`Gmail history fetch failed: ${response.status}`);
      }
      return;
    }

    const data = await response.json();
    const messageIds = new Set<string>();

    for (const entry of data.history || []) {
      for (const msg of entry.messagesAdded || []) {
        messageIds.add(msg.message.id);
      }
    }

    // Fetch and store each new message
    for (const msgId of messageIds) {
      try {
        await this.fetchAndStoreGmailMessage(schemaName, accountId, accessToken, msgId);
      } catch (err: any) {
        this.logger.warn(`Failed to fetch Gmail message ${msgId}: ${err.message}`);
      }
    }

    // Update history ID
    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      historyId: data.historyId || historyId,
      lastSyncedAt: new Date(),
    });
  }

  // ── Handle Microsoft Notification ───────────────────────────
  async handleMicrosoftNotification(schemaName: string, accountId: string, messageId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const accessToken = await this.refreshMicrosoftTokenIfNeeded(schemaName, account);

    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,flag,internetMessageId`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      this.logger.error(`MS message fetch failed: ${response.status}`);
      return;
    }

    const msg = await response.json();

    const isInbox = true; // notification is for inbox
    const direction = msg.from?.emailAddress?.address?.toLowerCase() === account.email.toLowerCase()
      ? 'outbound' : 'inbound';

    const hasAttachments = msg.hasAttachments || false;
    let bodyHtml = msg.body?.contentType === 'html' ? msg.body?.content : null;

    // Resolve CID inline images before storing
    if (bodyHtml && hasAttachments && bodyHtml.includes('cid:')) {
      bodyHtml = await this.resolveMicrosoftCidImages(schemaName, accessToken, messageId, bodyHtml);
    }

    const emailId = await this.emailStoreService.storeEmail(schemaName, accountId, {
      messageId: msg.internetMessageId || msg.id,
      threadId: msg.conversationId || null,
      direction,
      subject: msg.subject || '',
      bodyText: msg.bodyPreview || '',
      bodyHtml,
      snippet: (msg.bodyPreview || '').substring(0, 200),
      fromEmail: msg.from?.emailAddress?.address || '',
      fromName: msg.from?.emailAddress?.name || '',
      toEmails: (msg.toRecipients || []).map((r: any) => ({
        email: r.emailAddress?.address,
        name: r.emailAddress?.name,
      })),
      ccEmails: (msg.ccRecipients || []).map((r: any) => ({
        email: r.emailAddress?.address,
        name: r.emailAddress?.name,
      })),
      bccEmails: (msg.bccRecipients || []).map((r: any) => ({
        email: r.emailAddress?.address,
        name: r.emailAddress?.name,
      })),
      sentAt: msg.sentDateTime ? new Date(msg.sentDateTime) : null,
      receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null,
      hasAttachments,
      labels: [],
    });

    // Fetch and store file attachments (non-inline)
    if (emailId && hasAttachments) {
      this.fetchAndStoreMicrosoftAttachments(schemaName, emailId, accessToken, messageId)
        .catch((err) => this.logger.warn(`MS attachment fetch failed: ${err.message}`));
    }

    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      lastSyncedAt: new Date(),
    });
  }

  // ── Sync IMAP account ───────────────────────────────────────
  async syncImapAccount(schemaName: string, accountId: string) {
    // Dynamic import to avoid requiring imapflow when not using IMAP
    let ImapFlow: any;
    try {
      ImapFlow = (await import('imapflow')).ImapFlow;
    } catch {
      this.logger.error('imapflow package not installed. Run: npm install imapflow');
      throw new Error('imapflow not available');
    }

    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const password = this.emailAccountsService.decryptPassword(account.imap_password);

    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_secure,
      auth: { user: account.email, pass: password },
      logger: false,
    });

    try {
      await client.connect();

      // Sync INBOX
      const lock = await client.getMailboxLock('INBOX');
      try {
        const since = account.last_synced_at
          ? new Date(account.last_synced_at)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

        for await (const message of client.fetch(
          { since },
          { envelope: true, bodyStructure: true, source: true },
        )) {
          try {
            const env = message.envelope;
            const hasAttachments = (message.bodyStructure?.childNodes?.length || 0) > 1;

            // Try to parse HTML body and resolve CID images from raw source
            let parsedBody: { html: string | null; text: string | null; attachments: any[] } = { html: null, text: null, attachments: [] };
            if (message.source) {
              parsedBody = await this.parseImapSource(schemaName, message.source);
            }

            const emailId = await this.emailStoreService.storeEmail(schemaName, accountId, {
              messageId: env.messageId || `imap-${message.uid}`,
              threadId: env.inReplyTo || null,
              direction: env.from?.[0]?.address?.toLowerCase() === account.email.toLowerCase()
                ? 'outbound' : 'inbound',
              subject: env.subject || '',
              bodyText: parsedBody.text || message.source?.toString('utf-8')?.substring(0, 50000) || '',
              bodyHtml: parsedBody.html || null,
              snippet: (parsedBody.text || env.subject || '').substring(0, 200),
              fromEmail: env.from?.[0]?.address || '',
              fromName: env.from?.[0]?.name || '',
              toEmails: (env.to || []).map((a: any) => ({ email: a.address, name: a.name })),
              ccEmails: (env.cc || []).map((a: any) => ({ email: a.address, name: a.name })),
              bccEmails: [],
              sentAt: env.date ? new Date(env.date) : null,
              receivedAt: env.date ? new Date(env.date) : null,
              hasAttachments,
              labels: [],
            });

            // Store file attachments (already parsed above)
            if (emailId && parsedBody.attachments.length > 0) {
              for (const att of parsedBody.attachments) {
                this.emailStoreService.storeAttachments(schemaName, emailId, [{
                  filename: att.filename || 'unnamed',
                  content: att.content,
                  contentType: att.contentType || 'application/octet-stream',
                }]).catch((err) => this.logger.warn(`IMAP attachment store error: ${err.message}`));
              }
            }
          } catch (err: any) {
            this.logger.warn(`IMAP message parse error: ${err.message}`);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      this.logger.error(`IMAP sync failed for ${account.email}: ${err.message}`);
      throw err;
    }

    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      lastSyncedAt: new Date(),
    });
  }

  // ── Manual sync: Gmail ─────────────────────────────────────
  async syncGmailAccount(schemaName: string, accountId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const accessToken = await this.refreshGmailTokenIfNeeded(schemaName, account);
    await this.syncGmailRecent(schemaName, accountId, accessToken);
    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      lastSyncedAt: new Date(),
    });
    this.logger.log(`Gmail manual sync completed for account ${accountId}`);
  }

  // ── Manual sync: Microsoft ───────────────────────────────────
  async syncMicrosoftAccount(schemaName: string, accountId: string) {
    const account = await this.emailAccountsService.getAccountById(schemaName, accountId);
    const accessToken = await this.refreshMicrosoftTokenIfNeeded(schemaName, account);

    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,hasAttachments,internetMessageId`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      this.logger.error(`Microsoft manual sync failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    for (const msg of data.value || []) {
      try {
        const direction = msg.from?.emailAddress?.address?.toLowerCase() === account.email.toLowerCase()
          ? 'outbound' : 'inbound';
        const hasAttachments = msg.hasAttachments || false;
        let bodyHtml = msg.body?.contentType === 'html' ? msg.body?.content : null;

        // Resolve CID inline images before storing
        if (bodyHtml && hasAttachments && bodyHtml.includes('cid:')) {
          bodyHtml = await this.resolveMicrosoftCidImages(schemaName, accessToken, msg.id, bodyHtml);
        }

        const emailId = await this.emailStoreService.storeEmail(schemaName, accountId, {
          messageId: msg.internetMessageId || msg.id,
          threadId: msg.conversationId || null,
          direction,
          subject: msg.subject || '',
          bodyText: msg.bodyPreview || '',
          bodyHtml,
          snippet: (msg.bodyPreview || '').substring(0, 200),
          fromEmail: msg.from?.emailAddress?.address || '',
          fromName: msg.from?.emailAddress?.name || '',
          toEmails: (msg.toRecipients || []).map((r: any) => ({
            email: r.emailAddress?.address,
            name: r.emailAddress?.name,
          })),
          ccEmails: (msg.ccRecipients || []).map((r: any) => ({
            email: r.emailAddress?.address,
            name: r.emailAddress?.name,
          })),
          bccEmails: (msg.bccRecipients || []).map((r: any) => ({
            email: r.emailAddress?.address,
            name: r.emailAddress?.name,
          })),
          sentAt: msg.sentDateTime ? new Date(msg.sentDateTime) : null,
          receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : null,
          hasAttachments,
          labels: [],
        });

        // Fetch and store file attachments (non-inline)
        if (emailId && hasAttachments) {
          await this.fetchAndStoreMicrosoftAttachments(schemaName, emailId, accessToken, msg.id);
        }
      } catch (err: any) {
        this.logger.warn(`MS sync message error: ${err.message}`);
      }
    }

    await this.emailAccountsService.updateWebhookState(schemaName, accountId, {
      lastSyncedAt: new Date(),
    });
    this.logger.log(`Microsoft manual sync completed for account ${accountId}`);
  }

  // ── Gmail: Fetch recent messages (fallback) ─────────────────
  private async syncGmailRecent(schemaName: string, accountId: string, accessToken: string) {
    const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&labelIds=INBOX';
    const response = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return;
    const data = await response.json();

    for (const item of data.messages || []) {
      try {
        await this.fetchAndStoreGmailMessage(schemaName, accountId, accessToken, item.id);
      } catch (err: any) {
        this.logger.warn(`Gmail recent sync error: ${err.message}`);
      }
    }
  }

  // ── Gmail: Fetch + store single message ─────────────────────
  private async fetchAndStoreGmailMessage(
    schemaName: string, accountId: string, accessToken: string, gmailMsgId: string,
  ) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}?format=full`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`Gmail message fetch failed: ${response.status}`);
    const msg = await response.json();

    const headers = (msg.payload?.headers || []).reduce((acc: any, h: any) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {} as Record<string, string>);

    const parseAddresses = (header: string) => {
      if (!header) return [];
      return header.split(',').map((s: string) => {
        const trimmed = s.trim();
        const angleMatch = trimmed.match(/<([^>]+@[^>]+)>/);
        if (angleMatch) {
          const emailAddr = angleMatch[1].trim();
          const namePart = trimmed.substring(0, trimmed.indexOf('<')).trim().replace(/^["']|["']$/g, '');
          return { email: emailAddr, name: namePart };
        }
        const plainMatch = trimmed.match(/([^\s<>"]+@[^\s<>"]+)/);
        if (plainMatch) {
          return { email: plainMatch[1], name: '' };
        }
        return { email: trimmed, name: '' };
      }).filter((a) => a.email.includes('@'));
    };

    // Extract body from payload parts
    let { bodyHtml, bodyText } = this.extractGmailBody(msg.payload);

    const fromParts = parseAddresses(headers.from);
    const labelIds = msg.labelIds || [];

    const hasAttachments = (msg.payload?.parts || []).some((p: any) => p.filename);

    // Resolve CID inline images before storing
    if (bodyHtml && bodyHtml.includes('cid:')) {
      bodyHtml = await this.resolveGmailCidImages(schemaName, accessToken, msg, bodyHtml);
    }

    const emailId = await this.emailStoreService.storeEmail(schemaName, accountId, {
      messageId: msg.id,
      threadId: msg.threadId || null,
      direction: labelIds.includes('SENT') ? 'outbound' : 'inbound',
      subject: headers.subject || '',
      bodyText: bodyText || msg.snippet || '',
      bodyHtml: bodyHtml || null,
      snippet: (msg.snippet || '').substring(0, 200),
      fromEmail: fromParts[0]?.email || '',
      fromName: fromParts[0]?.name || '',
      toEmails: parseAddresses(headers.to),
      ccEmails: parseAddresses(headers.cc),
      bccEmails: [],
      sentAt: headers.date ? new Date(headers.date) : null,
      receivedAt: headers.date ? new Date(headers.date) : null,
      hasAttachments,
      labels: labelIds,
    });

    // Fetch and store file attachments (non-inline) from Gmail
    if (emailId && hasAttachments) {
      this.fetchAndStoreGmailAttachments(schemaName, emailId, accessToken, msg)
        .catch((err) => this.logger.warn(`Gmail attachment fetch failed: ${err.message}`));
    }
  }

  // ── Gmail: Resolve cid: inline images → S3 URLs ──────────
  private async resolveGmailCidImages(
    schemaName: string,
    accessToken: string,
    msg: any,
    bodyHtml: string,
  ): Promise<string> {
    // Collect inline parts that have Content-ID headers
    const inlineParts = this.collectInlineParts(msg.payload);
    if (!inlineParts.length) return bodyHtml;

    let result = bodyHtml;

    for (const part of inlineParts) {
      try {
        // Get Content-ID (strip angle brackets)
        const cidHeader = (part.headers || []).find((h: any) => h.name.toLowerCase() === 'content-id');
        if (!cidHeader) continue;
        const cid = cidHeader.value.replace(/^<|>$/g, '');

        // Check if this CID is actually referenced in the HTML
        if (!result.includes(`cid:${cid}`)) continue;

        // Fetch attachment data
        let data = part.body?.data;
        if (!data && part.body?.attachmentId) {
          const attUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`;
          const attRes = await fetch(attUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!attRes.ok) continue;
          const attData = await attRes.json();
          data = attData.data;
        }
        if (!data) continue;

        const buffer = Buffer.from(data, 'base64url');
        const url = await this.emailStoreService.uploadInlineImage(
          schemaName,
          part.filename || `inline-${cid}`,
          buffer,
          part.mimeType || 'image/png',
        );

        // Replace all cid: references with the S3 URL
        result = result.split(`cid:${cid}`).join(url);
      } catch (err: any) {
        this.logger.warn(`Gmail CID resolve error: ${err.message}`);
      }
    }

    return result;
  }

  // ── Gmail: Collect inline image parts (with Content-ID) ──
  private collectInlineParts(payload: any): any[] {
    const parts: any[] = [];
    if (!payload?.parts) return parts;

    for (const part of payload.parts) {
      const cidHeader = (part.headers || []).find((h: any) => h.name.toLowerCase() === 'content-id');
      if (cidHeader && part.mimeType?.startsWith('image/')) {
        parts.push(part);
      }
      if (part.parts) {
        parts.push(...this.collectInlineParts(part));
      }
    }
    return parts;
  }

  // ── Gmail: Fetch attachment content and store ─────────────
  private async fetchAndStoreGmailAttachments(
    schemaName: string,
    emailId: string,
    accessToken: string,
    msg: any,
  ) {
    const parts = this.collectAttachmentParts(msg.payload);

    for (const part of parts) {
      try {
        let data = part.body?.data;

        // If data is not inline, fetch via attachments API
        if (!data && part.body?.attachmentId) {
          const attUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/attachments/${part.body.attachmentId}`;
          const attRes = await fetch(attUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!attRes.ok) {
            this.logger.warn(`Gmail attachment fetch failed: ${attRes.status}`);
            continue;
          }
          const attData = await attRes.json();
          data = attData.data;
        }

        if (!data) continue;

        // Gmail uses URL-safe base64
        const buffer = Buffer.from(data, 'base64url');
        await this.emailStoreService.storeAttachments(schemaName, emailId, [{
          filename: part.filename || 'unnamed',
          content: buffer,
          contentType: part.mimeType || 'application/octet-stream',
        }]);
      } catch (err: any) {
        this.logger.warn(`Gmail attachment storage error: ${err.message}`);
      }
    }
  }

  // ── Gmail: Collect attachment parts recursively ───────────
  private collectAttachmentParts(payload: any): any[] {
    const parts: any[] = [];
    if (!payload) return parts;

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.filename.length > 0) {
          parts.push(part);
        } else if (part.parts) {
          parts.push(...this.collectAttachmentParts(part));
        }
      }
    }
    return parts;
  }

  // ── Gmail: Extract body from payload parts ─────────────────
  private extractGmailBody(payload: any): { bodyHtml: string | null; bodyText: string | null } {
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;

    if (!payload) return { bodyHtml, bodyText };

    const decodeBase64Url = (data: string) => {
      try {
        return Buffer.from(data, 'base64url').toString('utf-8');
      } catch {
        return Buffer.from(data, 'base64').toString('utf-8');
      }
    };

    // Simple message (no parts, body is directly on payload)
    if (payload.body?.data) {
      const decoded = decodeBase64Url(payload.body.data);
      if (payload.mimeType === 'text/html') {
        bodyHtml = decoded;
      } else {
        bodyText = decoded;
      }
    }

    // Multipart message — recurse through parts
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data && !bodyHtml) {
          bodyHtml = decodeBase64Url(part.body.data);
        } else if (part.mimeType === 'text/plain' && part.body?.data && !bodyText) {
          bodyText = decodeBase64Url(part.body.data);
        } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
          // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
          const nested = this.extractGmailBody(part);
          if (!bodyHtml && nested.bodyHtml) bodyHtml = nested.bodyHtml;
          if (!bodyText && nested.bodyText) bodyText = nested.bodyText;
        }
      }
    }

    return { bodyHtml, bodyText };
  }

  // ── IMAP: Parse raw source → HTML body, text, attachments, resolve CID images ──
  private async parseImapSource(
    schemaName: string,
    source: Buffer,
  ): Promise<{ html: string | null; text: string | null; attachments: any[] }> {
    let simpleParser: any;
    try {
      const mod = await Function('return import("mailparser")')();
      simpleParser = mod.simpleParser;
    } catch {
      return { html: null, text: null, attachments: [] };
    }

    const parsed = await simpleParser(source);
    let html = parsed.html || null;
    const text = parsed.text || null;
    const fileAttachments: any[] = [];

    if (parsed.attachments?.length) {
      for (const att of parsed.attachments) {
        // Inline image with CID — resolve to S3 URL
        if (att.cid && att.contentType?.startsWith('image/') && html?.includes(`cid:${att.cid}`)) {
          try {
            const url = await this.emailStoreService.uploadInlineImage(
              schemaName,
              att.filename || `inline-${att.cid}`,
              att.content,
              att.contentType,
            );
            html = html!.split(`cid:${att.cid}`).join(url);
          } catch (err: any) {
            this.logger.warn(`IMAP CID resolve error: ${err.message}`);
          }
        } else if (!att.cid || att.contentDisposition === 'attachment') {
          // Regular file attachment
          fileAttachments.push(att);
        }
      }
    }

    return { html, text, attachments: fileAttachments };
  }

  // ── Microsoft: Resolve cid: inline images → S3 URLs ────
  private async resolveMicrosoftCidImages(
    schemaName: string,
    accessToken: string,
    msMessageId: string,
    bodyHtml: string,
  ): Promise<string> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${msMessageId}/attachments`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return bodyHtml;

    const data = await response.json();
    let result = bodyHtml;

    for (const att of data.value || []) {
      try {
        if (!att.isInline || !att.contentId || !att.contentBytes) continue;
        if (!att.contentType?.startsWith('image/')) continue;

        // Check if this CID is referenced
        const cid = att.contentId;
        if (!result.includes(`cid:${cid}`)) continue;

        const buffer = Buffer.from(att.contentBytes, 'base64');
        const s3Url = await this.emailStoreService.uploadInlineImage(
          schemaName,
          att.name || `inline-${cid}`,
          buffer,
          att.contentType,
        );

        result = result.split(`cid:${cid}`).join(s3Url);
      } catch (err: any) {
        this.logger.warn(`MS CID resolve error: ${err.message}`);
      }
    }

    return result;
  }

  // ── Microsoft: Fetch attachment content and store ──────
  private async fetchAndStoreMicrosoftAttachments(
    schemaName: string,
    emailId: string,
    accessToken: string,
    msMessageId: string,
  ) {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${msMessageId}/attachments`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      this.logger.warn(`MS attachment list failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    for (const att of data.value || []) {
      try {
        // Only handle file attachments (skip inline, itemAttachment, referenceAttachment)
        if (att['@odata.type'] !== '#microsoft.graph.fileAttachment') continue;
        if (!att.contentBytes) continue;
        if (att.isInline) continue; // already handled by resolveMicrosoftCidImages

        const buffer = Buffer.from(att.contentBytes, 'base64');
        await this.emailStoreService.storeAttachments(schemaName, emailId, [{
          filename: att.name || 'unnamed',
          content: buffer,
          contentType: att.contentType || 'application/octet-stream',
        }]);
      } catch (err: any) {
        this.logger.warn(`MS attachment storage error: ${err.message}`);
      }
    }
  }

  // ── Token refresh helpers ───────────────────────────────────
  private async refreshGmailTokenIfNeeded(schemaName: string, account: any): Promise<string> {
    if (account.token_expiry && new Date(account.token_expiry) > new Date(Date.now() + 60000)) {
      return account.access_token;
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret || !account.refresh_token) {
      this.logger.warn('Cannot refresh Gmail token: missing credentials');
      return account.access_token;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      this.logger.error(`Gmail token refresh failed: ${response.status}`);
      return account.access_token;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    await this.emailAccountsService.updateTokens(
      schemaName, account.id, data.access_token, newExpiry, data.refresh_token,
    );

    return data.access_token;
  }

  private async refreshMicrosoftTokenIfNeeded(schemaName: string, account: any): Promise<string> {
    if (account.token_expiry && new Date(account.token_expiry) > new Date(Date.now() + 60000)) {
      return account.access_token;
    }

    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;

    if (!clientId || !clientSecret || !account.refresh_token) {
      this.logger.warn('Cannot refresh Microsoft token: missing credentials');
      return account.access_token;
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
        scope: 'Mail.ReadWrite Mail.Send offline_access',
      }),
    });

    if (!response.ok) {
      this.logger.error(`Microsoft token refresh failed: ${response.status}`);
      return account.access_token;
    }

    const data = await response.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);

    await this.emailAccountsService.updateTokens(
      schemaName, account.id, data.access_token, newExpiry, data.refresh_token,
    );

    return data.access_token;
  }
}
