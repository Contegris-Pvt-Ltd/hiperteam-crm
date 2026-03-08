// ============================================================
// FILE: apps/api/src/modules/opportunities/xero.service.ts
//
// Xero integration service for accounting sync.
// Handles OAuth2 flow, contact sync, invoice push, and webhooks.
//
// Reads config from public.tenant_integrations (per-tenant).
// ============================================================
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { XeroClient, TokenSet } from 'xero-node';

@Injectable()
export class XeroService {
  private readonly logger = new Logger(XeroService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ============================================================
  // PRIVATE: getClient — authenticated XeroClient with auto-refresh
  // ============================================================
  private async getClient(tenantId: string): Promise<{
    xero: XeroClient;
    xeroTenantId: string;
  } | null> {
    const [row] = await this.dataSource.query(
      `SELECT config FROM public.tenant_integrations
       WHERE tenant_id = $1 AND provider = 'xero' AND is_enabled = true`,
      [tenantId],
    );
    if (!row) return null;

    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    const xero = new XeroClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUris: [],
      scopes: ['accounting.contacts', 'accounting.transactions'],
    });

    const tokenSet = new TokenSet({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expires_at: Math.floor(new Date(config.tokenExpiry).getTime() / 1000),
      token_type: 'Bearer',
    });
    await xero.setTokenSet(tokenSet);

    // Auto-refresh if token expires within 5 minutes
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
    if (new Date(config.tokenExpiry).getTime() < fiveMinFromNow) {
      try {
        const newTokenSet = await xero.refreshToken();
        const newExpiry = new Date((newTokenSet.expires_at || 0) * 1000).toISOString();

        await this.dataSource.query(
          `UPDATE public.tenant_integrations
           SET config = config || jsonb_build_object(
             'accessToken', $2::text,
             'refreshToken', $3::text,
             'tokenExpiry', $4::text
           ), updated_at = NOW()
           WHERE tenant_id = $1 AND provider = 'xero'`,
          [tenantId, newTokenSet.access_token, newTokenSet.refresh_token, newExpiry],
        );

        this.logger.log(`Xero token refreshed for tenant ${tenantId}`);
      } catch (error: any) {
        this.logger.error(`Xero token refresh failed for tenant ${tenantId}`, error?.message || error);
        return null;
      }
    }

    return { xero, xeroTenantId: config.xeroTenantId };
  }

  // ============================================================
  // METHOD 1: getAuthUrl — build OAuth2 consent URL
  // ============================================================
  async getAuthUrl(
    tenantId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const xero = new XeroClient({
      clientId,
      clientSecret,
      redirectUris: [`${process.env.APP_URL || 'http://localhost:5173'}/admin/xero/callback`],
      scopes: [
        'accounting.contacts',
        'accounting.transactions',
        'accounting.settings',
        'offline_access',
      ],
    });

    const url = await xero.buildConsentUrl();

    // Store clientId + clientSecret so callback can retrieve them
    await this.dataSource.query(
      `INSERT INTO public.tenant_integrations (tenant_id, provider, is_enabled, config)
       VALUES ($1, 'xero', false,
         jsonb_build_object('clientId', $2::text, 'clientSecret', $3::text))
       ON CONFLICT (tenant_id, provider)
       DO UPDATE SET
         config = tenant_integrations.config ||
           jsonb_build_object('clientId', $2::text, 'clientSecret', $3::text),
         updated_at = NOW()`,
      [tenantId, clientId, clientSecret],
    );

    return url;
  }

  // ============================================================
  // METHOD 2: handleCallback — exchange auth code for tokens
  // ============================================================
  async handleCallback(tenantId: string, url: string): Promise<void> {
    // 1. Get stored clientId + clientSecret
    const [row] = await this.dataSource.query(
      `SELECT config FROM public.tenant_integrations
       WHERE tenant_id = $1 AND provider = 'xero'`,
      [tenantId],
    );
    if (!row) throw new BadRequestException('Xero integration not found');

    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    // 2. Create XeroClient with same config
    const xero = new XeroClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUris: [`${process.env.APP_URL || 'http://localhost:5173'}/admin/xero/callback`],
      scopes: [
        'accounting.contacts',
        'accounting.transactions',
        'accounting.settings',
        'offline_access',
      ],
    });

    // 3. Exchange code for tokens
    const tokenSet = await xero.apiCallback(url);

    // 4. Get Xero tenant ID
    await xero.updateTenants();
    const xeroTenantId = xero.tenants[0]?.tenantId;

    if (!xeroTenantId) {
      throw new BadRequestException('No Xero organisation found. Please connect a Xero organisation.');
    }

    // 5. Save everything to tenant_integrations
    await this.dataSource.query(
      `UPDATE public.tenant_integrations
       SET is_enabled = true,
           config = jsonb_build_object(
             'clientId', $2::text,
             'clientSecret', $3::text,
             'xeroTenantId', $4::text,
             'accessToken', $5::text,
             'refreshToken', $6::text,
             'tokenExpiry', $7::text
           ),
           updated_at = NOW()
       WHERE tenant_id = $1 AND provider = 'xero'`,
      [
        tenantId,
        config.clientId,
        config.clientSecret,
        xeroTenantId,
        tokenSet.access_token,
        tokenSet.refresh_token,
        new Date((tokenSet.expires_at || 0) * 1000).toISOString(),
      ],
    );

    this.logger.log(`Xero connected for tenant ${tenantId}, org=${xeroTenantId}`);
  }

  // ============================================================
  // METHOD 3: syncContacts — match CRM accounts/contacts to Xero
  // ============================================================
  async syncContacts(
    tenantId: string,
    schemaName: string,
  ): Promise<{
    matched: number;
    created: number;
    unmatched: number;
    suggestions: Array<{
      crmType: 'account' | 'contact';
      crmId: string;
      crmName: string;
      crmEmail: string | null;
      xeroContactId: string;
      xeroName: string;
      xeroEmail: string | null;
      matchScore: number;
    }>;
  }> {
    const client = await this.getClient(tenantId);
    if (!client) throw new BadRequestException('Xero not configured');

    let matched = 0;
    let unmatched = 0;
    const suggestions: Array<{
      crmType: 'account' | 'contact';
      crmId: string;
      crmName: string;
      crmEmail: string | null;
      xeroContactId: string;
      xeroName: string;
      xeroEmail: string | null;
      matchScore: number;
    }> = [];

    try {
      // 1. Fetch all Xero contacts
      const response = await client.xero.accountingApi.getContacts(client.xeroTenantId);
      const xeroContacts = response.body.contacts || [];

      // 2. Fetch CRM accounts and contacts
      const accounts = await this.dataSource.query(
        `SELECT id, name, email, xero_contact_id
         FROM "${schemaName}".accounts WHERE deleted_at IS NULL`,
      );
      const contacts = await this.dataSource.query(
        `SELECT id, first_name || ' ' || last_name AS name,
                email, xero_contact_id
         FROM "${schemaName}".contacts WHERE deleted_at IS NULL`,
      );

      // Build lookup maps by email (lowercase)
      const accountsByEmail = new Map<string, any>();
      for (const a of accounts) {
        if (a.email && !a.xero_contact_id) {
          accountsByEmail.set(a.email.toLowerCase(), a);
        }
      }
      const contactsByEmail = new Map<string, any>();
      for (const c of contacts) {
        if (c.email && !c.xero_contact_id) {
          contactsByEmail.set(c.email.toLowerCase(), c);
        }
      }

      // 3. Match each Xero contact
      for (const xc of xeroContacts) {
        if (!xc.contactID) continue;
        const xeroEmail = xc.emailAddress?.toLowerCase() || null;
        const xeroName = xc.name || '';
        const xeroContactId = xc.contactID;

        // a. Try exact email match
        if (xeroEmail) {
          const acct = accountsByEmail.get(xeroEmail);
          if (acct) {
            await this.dataSource.query(
              `UPDATE "${schemaName}".accounts SET xero_contact_id = $1 WHERE id = $2`,
              [xeroContactId, acct.id],
            );
            accountsByEmail.delete(xeroEmail);
            matched++;
            continue;
          }

          const cont = contactsByEmail.get(xeroEmail);
          if (cont) {
            await this.dataSource.query(
              `UPDATE "${schemaName}".contacts SET xero_contact_id = $1 WHERE id = $2`,
              [xeroContactId, cont.id],
            );
            contactsByEmail.delete(xeroEmail);
            matched++;
            continue;
          }
        }

        // b. Try name similarity
        let bestMatch: { crmType: 'account' | 'contact'; record: any; score: number } | null = null;
        const xeroNameLower = xeroName.toLowerCase();
        const xeroFirstWord = xeroNameLower.split(/\s+/)[0];

        for (const a of accounts) {
          if (a.xero_contact_id) continue;
          const crmNameLower = (a.name || '').toLowerCase();
          if (crmNameLower.includes(xeroNameLower) || xeroNameLower.includes(crmNameLower)) {
            if (!bestMatch || 80 > bestMatch.score) {
              bestMatch = { crmType: 'account', record: a, score: 80 };
            }
          } else if (crmNameLower.split(/\s+/)[0] === xeroFirstWord && xeroFirstWord.length > 2) {
            if (!bestMatch || 60 > bestMatch.score) {
              bestMatch = { crmType: 'account', record: a, score: 60 };
            }
          }
        }

        for (const c of contacts) {
          if (c.xero_contact_id) continue;
          const crmNameLower = (c.name || '').toLowerCase();
          if (crmNameLower.includes(xeroNameLower) || xeroNameLower.includes(crmNameLower)) {
            if (!bestMatch || 80 > bestMatch.score) {
              bestMatch = { crmType: 'contact', record: c, score: 80 };
            }
          } else if (crmNameLower.split(/\s+/)[0] === xeroFirstWord && xeroFirstWord.length > 2) {
            if (!bestMatch || 60 > bestMatch.score) {
              bestMatch = { crmType: 'contact', record: c, score: 60 };
            }
          }
        }

        if (bestMatch) {
          suggestions.push({
            crmType: bestMatch.crmType,
            crmId: bestMatch.record.id,
            crmName: bestMatch.record.name,
            crmEmail: bestMatch.record.email || null,
            xeroContactId,
            xeroName,
            xeroEmail: xc.emailAddress || null,
            matchScore: bestMatch.score,
          });
        } else {
          unmatched++;
        }
      }
    } catch (error: any) {
      this.logger.error('Xero syncContacts failed', error?.message || error);
      throw new BadRequestException('Failed to sync contacts with Xero');
    }

    return { matched, created: 0, unmatched, suggestions };
  }

  // ============================================================
  // METHOD 4: linkContact — manually link CRM record to Xero
  // ============================================================
  async linkContact(
    schemaName: string,
    crmType: 'account' | 'contact',
    crmId: string,
    xeroContactId: string,
  ): Promise<void> {
    const table = crmType === 'account' ? 'accounts' : 'contacts';
    await this.dataSource.query(
      `UPDATE "${schemaName}".${table} SET xero_contact_id = $1 WHERE id = $2`,
      [xeroContactId, crmId],
    );
  }

  // ============================================================
  // METHOD 5: getOrCreateXeroContact — ensure Xero contact exists
  // ============================================================
  async getOrCreateXeroContact(
    tenantId: string,
    schemaName: string,
    crmType: 'account' | 'contact',
    crmId: string,
  ): Promise<string> {
    // 1. Get CRM record
    let record: any;
    if (crmType === 'account') {
      const [row] = await this.dataSource.query(
        `SELECT id, name, email, xero_contact_id
         FROM "${schemaName}".accounts WHERE id = $1 AND deleted_at IS NULL`,
        [crmId],
      );
      record = row;
    } else {
      const [row] = await this.dataSource.query(
        `SELECT id, first_name || ' ' || last_name AS name,
                email, xero_contact_id
         FROM "${schemaName}".contacts WHERE id = $1 AND deleted_at IS NULL`,
        [crmId],
      );
      record = row;
    }

    if (!record) throw new BadRequestException(`${crmType} not found`);

    // 2. If already linked, return immediately
    if (record.xero_contact_id) return record.xero_contact_id;

    // 3. Get Xero client
    const client = await this.getClient(tenantId);
    if (!client) throw new BadRequestException('Xero not configured');

    try {
      // 4. Search Xero by email
      if (record.email) {
        const existing = await client.xero.accountingApi.getContacts(
          client.xeroTenantId,
          undefined, // ifModifiedSince
          `EmailAddress="${record.email}"`, // where
        );
        const found = existing.body.contacts?.[0];
        if (found?.contactID) {
          await this.saveCrmXeroLink(schemaName, crmType, crmId, found.contactID);
          return found.contactID;
        }
      }

      // 5. Create in Xero
      const contact: any = { name: record.name };
      if (record.email) contact.emailAddress = record.email;

      const result = await client.xero.accountingApi.createContacts(
        client.xeroTenantId,
        { contacts: [contact] },
      );
      const xeroContactId = result.body.contacts?.[0]?.contactID;

      if (!xeroContactId) {
        throw new BadRequestException('Failed to create contact in Xero');
      }

      // 6. Save link
      await this.saveCrmXeroLink(schemaName, crmType, crmId, xeroContactId);

      return xeroContactId;
    } catch (error: any) {
      this.logger.error('Xero getOrCreateXeroContact failed', error?.message || error);
      throw new BadRequestException('Failed to create or find contact in Xero');
    }
  }

  // ============================================================
  // METHOD 6: pushInvoice — push invoice to Xero
  // ============================================================
  async pushInvoice(
    tenantId: string,
    schemaName: string,
    invoiceId: string,
  ): Promise<string | null> {
    // 1. Get Xero client
    const client = await this.getClient(tenantId);
    if (!client) return null;

    try {
      // 2. Get invoice with account/contact xero IDs
      const [invoice] = await this.dataSource.query(
        `SELECT i.*,
                a.id AS account_id_val, a.xero_contact_id AS acct_xero_id,
                c.id AS contact_id_val, c.xero_contact_id AS cont_xero_id
         FROM "${schemaName}".invoices i
         LEFT JOIN "${schemaName}".accounts a ON a.id = i.account_id
         LEFT JOIN "${schemaName}".contacts c ON c.id = i.contact_id
         WHERE i.id = $1 AND i.deleted_at IS NULL`,
        [invoiceId],
      );

      if (!invoice) {
        this.logger.warn(`pushInvoice: invoice ${invoiceId} not found`);
        return null;
      }

      // 3. Determine CRM entity for Xero contact
      let crmType: 'account' | 'contact';
      let crmId: string;
      if (invoice.account_id) {
        crmType = 'account';
        crmId = invoice.account_id;
      } else if (invoice.contact_id) {
        crmType = 'contact';
        crmId = invoice.contact_id;
      } else {
        this.logger.warn(`pushInvoice: invoice ${invoiceId} has no account or contact`);
        return null;
      }

      // 4. Ensure Xero contact exists
      const xeroContactId = await this.getOrCreateXeroContact(tenantId, schemaName, crmType, crmId);

      // 5. Fetch line items
      const lineItems = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".invoice_line_items
         WHERE invoice_id = $1 ORDER BY sort_order`,
        [invoiceId],
      );

      // 6. Build Xero invoice
      const xeroInvoice: any = {
        type: 'ACCREC',
        contact: { contactID: xeroContactId },
        lineItems: lineItems.map((li: any) => ({
          description: li.description,
          quantity: parseFloat(li.quantity) || 1,
          unitAmount: parseFloat(li.unit_price) || 0,
          discountRate: li.discount_type === 'percentage' ? (parseFloat(li.discount) || 0) : 0,
          taxType: (parseFloat(li.tax_rate) || 0) > 0 ? 'OUTPUT' : 'NONE',
          accountCode: '200',
        })),
        date: invoice.issue_date
          ? new Date(invoice.issue_date).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        dueDate: invoice.due_date
          ? new Date(invoice.due_date).toISOString().slice(0, 10)
          : undefined,
        invoiceNumber: invoice.invoice_number,
        currencyCode: invoice.currency || 'USD',
        status: 'AUTHORISED',
      };

      // 7. Push to Xero
      const result = await client.xero.accountingApi.createInvoices(
        client.xeroTenantId,
        { invoices: [xeroInvoice] },
      );
      const xeroInvoiceId = result.body.invoices?.[0]?.invoiceID;

      if (!xeroInvoiceId) {
        this.logger.error('pushInvoice: Xero did not return an invoiceID');
        return null;
      }

      // 8. Save to CRM
      await this.dataSource.query(
        `UPDATE "${schemaName}".invoices
         SET xero_invoice_id = $2, xero_status = 'AUTHORISED', updated_at = NOW()
         WHERE id = $1`,
        [invoiceId, xeroInvoiceId],
      );

      this.logger.log(`Invoice ${invoiceId} pushed to Xero as ${xeroInvoiceId}`);
      return xeroInvoiceId;
    } catch (error: any) {
      this.logger.error(`pushInvoice failed for ${invoiceId}`, error?.message || error);
      return null;
    }
  }

  // ============================================================
  // METHOD 7: handleWebhook — process Xero webhook events
  // ============================================================
  async handleWebhook(
    schemaName: string,
    events: any[],
  ): Promise<void> {
    for (const event of events) {
      try {
        if (event.eventCategory === 'INVOICE' && event.eventType === 'UPDATE') {
          const xeroInvoiceId = event.resourceId;

          const [invoice] = await this.dataSource.query(
            `SELECT id, status, total_amount FROM "${schemaName}".invoices
             WHERE xero_invoice_id = $1 AND deleted_at IS NULL`,
            [xeroInvoiceId],
          );

          if (!invoice) {
            this.logger.warn(`Xero webhook: no CRM invoice for Xero ID ${xeroInvoiceId}`);
            continue;
          }

          // Map Xero status to CRM status
          const statusMap: Record<string, string> = {
            PAID: 'paid',
            VOIDED: 'void',
            DELETED: 'cancelled',
          };

          const xeroStatus = event.eventData?.status || event.resourceData?.status;
          const mappedStatus = statusMap[xeroStatus];

          if (!mappedStatus) {
            this.logger.log(`Xero webhook: unhandled status "${xeroStatus}" for ${xeroInvoiceId}`);
            continue;
          }

          if (mappedStatus === 'paid') {
            await this.dataSource.query(
              `UPDATE "${schemaName}".invoices
               SET status = 'paid', paid_at = NOW(), amount_due = 0,
                   amount_paid = total_amount, xero_status = $2, updated_at = NOW()
               WHERE id = $1`,
              [invoice.id, xeroStatus],
            );
          } else {
            await this.dataSource.query(
              `UPDATE "${schemaName}".invoices
               SET status = $2, xero_status = $3, updated_at = NOW()
               WHERE id = $1`,
              [invoice.id, mappedStatus, xeroStatus],
            );
          }

          this.logger.log(`Xero webhook: invoice ${xeroInvoiceId} → ${mappedStatus}`);
        }
      } catch (error: any) {
        this.logger.error(`Xero webhook event processing failed`, error?.message || error);
      }
    }
  }

  // ============================================================
  // PRIVATE HELPER: save xero_contact_id link
  // ============================================================
  private async saveCrmXeroLink(
    schemaName: string,
    crmType: 'account' | 'contact',
    crmId: string,
    xeroContactId: string,
  ): Promise<void> {
    const table = crmType === 'account' ? 'accounts' : 'contacts';
    await this.dataSource.query(
      `UPDATE "${schemaName}".${table} SET xero_contact_id = $1 WHERE id = $2`,
      [xeroContactId, crmId],
    );
  }
}
