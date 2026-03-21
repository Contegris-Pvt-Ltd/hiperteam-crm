import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { ActivityService } from '../shared/activity.service';

interface ProviderConfig {
  provider: string | null;
  apiKey: string | null;
  datacenter: string | null;
  isEnabled: boolean;
}

export interface MailingList {
  id: string;
  name: string;
  memberCount: number;
}

interface CacheEntry {
  lists: MailingList[];
  fetchedAt: number;
}

@Injectable()
export class EmailMarketingService {
  private readonly logger = new Logger(EmailMarketingService.name);
  private readonly listCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly dataSource: DataSource,
    private readonly activityService: ActivityService,
  ) {}

  // ============================================================
  // PUBLIC METHODS
  // ============================================================

  async getProviderConfig(tenantId: string): Promise<ProviderConfig> {
    const rows = await this.dataSource.query(
      `SELECT provider, is_enabled, config
       FROM public.tenant_integrations
       WHERE tenant_id = $1
         AND provider IN ('mailerlite', 'mailchimp')
         AND is_enabled = true
       LIMIT 1`,
      [tenantId],
    );

    if (!rows.length) {
      return { provider: null, apiKey: null, datacenter: null, isEnabled: false };
    }

    const row = rows[0];
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;

    return {
      provider: row.provider,
      apiKey: config.apiKey || null,
      datacenter: config.datacenter || null,
      isEnabled: row.is_enabled,
    };
  }

  async getLists(tenantId: string): Promise<MailingList[]> {
    const cached = this.listCache.get(tenantId);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.lists;
    }

    const providerConfig = await this.getProviderConfig(tenantId);
    if (!providerConfig.isEnabled || !providerConfig.apiKey) {
      return [];
    }

    let lists: MailingList[] = [];
    if (providerConfig.provider === 'mailerlite') {
      lists = await this.fetchMailerLiteLists(providerConfig.apiKey);
    } else if (providerConfig.provider === 'mailchimp') {
      lists = await this.fetchMailchimpLists(providerConfig.apiKey, providerConfig.datacenter!);
    }

    this.listCache.set(tenantId, { lists, fetchedAt: Date.now() });
    return lists;
  }

  async refreshListCache(tenantId: string): Promise<MailingList[]> {
    this.listCache.delete(tenantId);
    return this.getLists(tenantId);
  }

  async testConnection(tenantId: string): Promise<{ success: boolean; listCount: number; error?: string }> {
    try {
      const lists = await this.refreshListCache(tenantId);
      return { success: true, listCount: lists.length };
    } catch (err: any) {
      this.logger.error(`Test connection failed for tenant ${tenantId}: ${err.message}`);
      return { success: false, listCount: 0, error: err.message };
    }
  }

  async addContactToList(
    tenantId: string,
    schemaName: string,
    listId: string,
    listName: string,
    contact: { email: string; firstName?: string; lastName?: string },
    contactId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const providerConfig = await this.getProviderConfig(tenantId);
    if (!providerConfig.isEnabled || !providerConfig.apiKey) {
      return { success: false, error: 'Email marketing provider not configured' };
    }

    try {
      if (providerConfig.provider === 'mailerlite') {
        await this.mailerliteAddContact(providerConfig.apiKey, listId, contact);
      } else if (providerConfig.provider === 'mailchimp') {
        await this.mailchimpAddContact(
          providerConfig.apiKey,
          providerConfig.datacenter!,
          listId,
          contact,
        );
      }

      // Record in DB
      if (contactId) {
        await this.dataSource.query(
          `INSERT INTO "${schemaName}".contact_email_marketing
             (contact_id, provider, list_id, list_name, status, subscribed_at)
           VALUES ($1, $2, $3, $4, 'subscribed', NOW())
           ON CONFLICT (contact_id, provider, list_id)
           DO UPDATE SET status = 'subscribed', list_name = $4, unsubscribed_at = NULL, updated_at = NOW()`,
          [contactId, providerConfig.provider, listId, listName],
        );

        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'subscribed',
               email_marketing_provider = $2,
               unsubscribed_at = NULL
           WHERE id = $1`,
          [contactId, providerConfig.provider],
        );
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`addContactToList failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async removeContactFromList(
    tenantId: string,
    schemaName: string,
    listId: string,
    email: string,
    contactId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const providerConfig = await this.getProviderConfig(tenantId);
    if (!providerConfig.isEnabled || !providerConfig.apiKey) {
      return { success: false, error: 'Email marketing provider not configured' };
    }

    try {
      if (providerConfig.provider === 'mailerlite') {
        await this.mailerliteRemoveContact(providerConfig.apiKey, listId, email);
      } else if (providerConfig.provider === 'mailchimp') {
        await this.mailchimpRemoveContact(
          providerConfig.apiKey,
          providerConfig.datacenter!,
          listId,
          email,
        );
      }

      if (contactId) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".contact_email_marketing
           SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW()
           WHERE contact_id = $1 AND provider = $2 AND list_id = $3`,
          [contactId, providerConfig.provider, listId],
        );

        // Check if still subscribed to any list
        const remaining = await this.dataSource.query(
          `SELECT 1 FROM "${schemaName}".contact_email_marketing
           WHERE contact_id = $1 AND status = 'subscribed' LIMIT 1`,
          [contactId],
        );

        if (!remaining.length) {
          await this.dataSource.query(
            `UPDATE "${schemaName}".contacts
             SET email_marketing_status = 'unsubscribed', unsubscribed_at = NOW()
             WHERE id = $1`,
            [contactId],
          );
        }
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`removeContactFromList failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async getContactStats(
    schemaName: string,
    contactId: string,
  ): Promise<any> {
    const [contact] = await this.dataSource.query(
      `SELECT email_marketing_status, email_marketing_provider,
              email_bounced_at, unsubscribed_at,
              last_email_opened_at, last_email_clicked_at
       FROM "${schemaName}".contacts
       WHERE id = $1 AND deleted_at IS NULL`,
      [contactId],
    );

    if (!contact) {
      return null;
    }

    const lists = await this.dataSource.query(
      `SELECT id, provider, list_id, list_name, status,
              subscribed_at, unsubscribed_at, tags
       FROM "${schemaName}".contact_email_marketing
       WHERE contact_id = $1
       ORDER BY created_at DESC`,
      [contactId],
    );

    return {
      marketingStatus: contact.email_marketing_status,
      provider: contact.email_marketing_provider,
      bouncedAt: contact.email_bounced_at,
      unsubscribedAt: contact.unsubscribed_at,
      lastEmailOpenedAt: contact.last_email_opened_at,
      lastEmailClickedAt: contact.last_email_clicked_at,
      lists: lists.map((l: any) => ({
        id: l.id,
        provider: l.provider,
        listId: l.list_id,
        listName: l.list_name,
        status: l.status,
        subscribedAt: l.subscribed_at,
        unsubscribedAt: l.unsubscribed_at,
        tags: l.tags,
      })),
    };
  }

  async getAccountContactsStats(
    schemaName: string,
    accountId: string,
  ): Promise<any[]> {
    const rows = await this.dataSource.query(
      `SELECT c.id, c.first_name, c.last_name, c.email,
              c.email_marketing_status, c.email_marketing_provider,
              c.email_bounced_at, c.unsubscribed_at,
              c.last_email_opened_at, c.last_email_clicked_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'listId', cem.list_id,
                    'listName', cem.list_name,
                    'provider', cem.provider,
                    'status', cem.status
                  )
                ) FILTER (WHERE cem.id IS NOT NULL),
                '[]'
              ) AS lists
       FROM "${schemaName}".contacts c
       LEFT JOIN "${schemaName}".contact_email_marketing cem
         ON cem.contact_id = c.id
       WHERE c.account_id = $1 AND c.deleted_at IS NULL
       GROUP BY c.id, c.first_name, c.last_name, c.email,
                c.email_marketing_status, c.email_marketing_provider,
                c.email_bounced_at, c.unsubscribed_at,
                c.last_email_opened_at, c.last_email_clicked_at
       ORDER BY c.first_name, c.last_name`,
      [accountId],
    );

    return rows.map((r: any) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      marketingStatus: r.email_marketing_status,
      provider: r.email_marketing_provider,
      bouncedAt: r.email_bounced_at,
      unsubscribedAt: r.unsubscribed_at,
      lastEmailOpenedAt: r.last_email_opened_at,
      lastEmailClickedAt: r.last_email_clicked_at,
      lists: typeof r.lists === 'string' ? JSON.parse(r.lists) : r.lists,
    }));
  }

  async processWebhookEvent(
    schemaName: string,
    provider: string,
    event: { type: string; email: string; listId?: string; timestamp?: string },
  ): Promise<void> {
    const { type, email, listId, timestamp } = event;

    // Look up contact by email
    const contacts = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".contacts
       WHERE email = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );

    if (!contacts.length) {
      this.logger.warn(`Webhook ${type}: no contact found for ${email} in ${schemaName}`);
      return;
    }

    const contactId = contacts[0].id;

    switch (type) {
      case 'subscribe':
        if (listId) {
          await this.dataSource.query(
            `INSERT INTO "${schemaName}".contact_email_marketing
               (contact_id, provider, list_id, status, subscribed_at)
             VALUES ($1, $2, $3, 'subscribed', NOW())
             ON CONFLICT (contact_id, provider, list_id)
             DO UPDATE SET status = 'subscribed', unsubscribed_at = NULL, updated_at = NOW()`,
            [contactId, provider, listId],
          );
        }
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'subscribed',
               email_marketing_provider = $2,
               unsubscribed_at = NULL
           WHERE id = $1`,
          [contactId, provider],
        );
        break;

      case 'unsubscribe':
        if (listId) {
          await this.dataSource.query(
            `UPDATE "${schemaName}".contact_email_marketing
             SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW()
             WHERE contact_id = $1 AND provider = $2 AND list_id = $3`,
            [contactId, provider, listId],
          );
        }
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'unsubscribed', unsubscribed_at = NOW()
           WHERE id = $1`,
          [contactId],
        );
        break;

      case 'bounce':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'bounced', email_bounced_at = NOW()
           WHERE id = $1`,
          [contactId],
        );
        if (listId) {
          await this.dataSource.query(
            `UPDATE "${schemaName}".contact_email_marketing
             SET status = 'bounced', updated_at = NOW()
             WHERE contact_id = $1 AND provider = $2 AND list_id = $3`,
            [contactId, provider, listId],
          );
        }
        break;

      case 'spam':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'spam', unsubscribed_at = NOW()
           WHERE id = $1`,
          [contactId],
        );
        break;

      case 'open':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET last_email_opened_at = NOW()
           WHERE id = $1`,
          [contactId],
        );
        break;

      case 'click':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET last_email_clicked_at = NOW()
           WHERE id = $1`,
          [contactId],
        );
        break;

      default:
        this.logger.warn(`Unknown webhook event type: ${type}`);
        return;
    }

    // Log activity for all events
    await this.activityService.create(schemaName, {
      entityType: 'contact',
      entityId: contactId,
      activityType: `email_marketing_${type}`,
      title: `Email marketing: ${type}`,
      description: `Provider: ${provider}, email: ${email}${listId ? `, list: ${listId}` : ''}`,
      performedBy: 'system',
    });
  }

  async resolveEmailsFromEntity(
    schemaName: string,
    triggerModule: string,
    entityId: string,
    contactSelector: 'primary' | 'all' | 'owner',
  ): Promise<Array<{ email: string; firstName?: string; lastName?: string; contactId?: string }>> {
    const results: Array<{ email: string; firstName?: string; lastName?: string; contactId?: string }> = [];

    if (triggerModule === 'contacts') {
      const rows = await this.dataSource.query(
        `SELECT id, email, first_name, last_name
         FROM "${schemaName}".contacts
         WHERE id = $1 AND deleted_at IS NULL AND email IS NOT NULL`,
        [entityId],
      );
      for (const r of rows) {
        results.push({ email: r.email, firstName: r.first_name, lastName: r.last_name, contactId: r.id });
      }
    } else if (triggerModule === 'leads') {
      const rows = await this.dataSource.query(
        `SELECT id, email, first_name, last_name
         FROM "${schemaName}".leads
         WHERE id = $1 AND deleted_at IS NULL AND email IS NOT NULL`,
        [entityId],
      );
      for (const r of rows) {
        results.push({ email: r.email, firstName: r.first_name, lastName: r.last_name });
      }
    } else if (triggerModule === 'opportunities') {
      // Get contacts linked to the opportunity
      const rows = await this.dataSource.query(
        `SELECT c.id, c.email, c.first_name, c.last_name
         FROM "${schemaName}".contacts c
         JOIN "${schemaName}".opportunity_contacts oc ON oc.contact_id = c.id
         WHERE oc.opportunity_id = $1 AND c.deleted_at IS NULL AND c.email IS NOT NULL
         ${contactSelector === 'primary' ? 'AND oc.is_primary = true' : ''}
         ORDER BY oc.is_primary DESC`,
        [entityId],
      );
      for (const r of rows) {
        results.push({ email: r.email, firstName: r.first_name, lastName: r.last_name, contactId: r.id });
      }
    } else if (triggerModule === 'accounts') {
      const rows = await this.dataSource.query(
        `SELECT id, email, first_name, last_name
         FROM "${schemaName}".contacts
         WHERE account_id = $1 AND deleted_at IS NULL AND email IS NOT NULL
         ${contactSelector === 'primary' ? 'AND is_primary = true' : ''}
         ORDER BY is_primary DESC`,
        [entityId],
      );
      for (const r of rows) {
        results.push({ email: r.email, firstName: r.first_name, lastName: r.last_name, contactId: r.id });
      }
    }

    return results;
  }

  // ============================================================
  // PRIVATE — MailerLite Adapter
  // ============================================================

  private async fetchMailerLiteLists(apiKey: string): Promise<MailingList[]> {
    const res = await fetch('https://connect.mailerlite.com/api/groups?limit=100', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`MailerLite API error: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    const groups = body.data || [];

    return groups.map((g: any) => ({
      id: String(g.id),
      name: g.name,
      memberCount: g.active_count || g.subscriber_count || 0,
    }));
  }

  private async mailerliteAddContact(
    apiKey: string,
    groupId: string,
    contact: { email: string; firstName?: string; lastName?: string },
  ): Promise<void> {
    // Create/update subscriber
    const subscriberRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: contact.email,
        fields: {
          name: contact.firstName || '',
          last_name: contact.lastName || '',
        },
        groups: [groupId],
      }),
    });

    if (!subscriberRes.ok) {
      const errBody = await subscriberRes.text();
      throw new Error(`MailerLite add contact failed: ${subscriberRes.status} ${errBody}`);
    }
  }

  private async mailerliteRemoveContact(
    apiKey: string,
    groupId: string,
    email: string,
  ): Promise<void> {
    // First, find subscriber by email
    const searchRes = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      },
    );

    if (!searchRes.ok) {
      throw new Error(`MailerLite subscriber lookup failed: ${searchRes.status}`);
    }

    const subscriber = await searchRes.json();
    const subscriberId = subscriber.data?.id;

    if (!subscriberId) {
      throw new Error('MailerLite subscriber not found');
    }

    // Remove from group
    const removeRes = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${subscriberId}/groups/${groupId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      },
    );

    if (!removeRes.ok) {
      const errBody = await removeRes.text();
      throw new Error(`MailerLite remove from group failed: ${removeRes.status} ${errBody}`);
    }
  }

  // ============================================================
  // PRIVATE — Mailchimp Adapter
  // ============================================================

  private mailchimpAuth(apiKey: string): string {
    return 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');
  }

  private mailchimpSubscriberHash(email: string): string {
    return createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  private async fetchMailchimpLists(apiKey: string, datacenter: string): Promise<MailingList[]> {
    const res = await fetch(`https://${datacenter}.api.mailchimp.com/3.0/lists?count=100`, {
      method: 'GET',
      headers: {
        'Authorization': this.mailchimpAuth(apiKey),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Mailchimp API error: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    const lists = body.lists || [];

    return lists.map((l: any) => ({
      id: l.id,
      name: l.name,
      memberCount: l.stats?.member_count || 0,
    }));
  }

  private async mailchimpAddContact(
    apiKey: string,
    datacenter: string,
    listId: string,
    contact: { email: string; firstName?: string; lastName?: string },
  ): Promise<void> {
    const hash = this.mailchimpSubscriberHash(contact.email);

    const res = await fetch(
      `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': this.mailchimpAuth(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: contact.email,
          status_if_new: 'subscribed',
          status: 'subscribed',
          merge_fields: {
            FNAME: contact.firstName || '',
            LNAME: contact.lastName || '',
          },
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Mailchimp add contact failed: ${res.status} ${errBody}`);
    }
  }

  private async mailchimpRemoveContact(
    apiKey: string,
    datacenter: string,
    listId: string,
    email: string,
  ): Promise<void> {
    const hash = this.mailchimpSubscriberHash(email);

    const res = await fetch(
      `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': this.mailchimpAuth(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'unsubscribed',
        }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Mailchimp remove contact failed: ${res.status} ${errBody}`);
    }
  }
}
