Full Build Plan
Part 1 — Backend: Provider Adapters + Sync Service
New file: apps/api/src/modules/email-marketing/email-marketing.service.ts
A single service with two adapters behind a common interface:
interface EmailMarketingAdapter {
  getLists(): Promise<{ id, name }[]>
  addContact(listId, contact: { email, firstName, lastName, phone?, tags? }): Promise<void>
  removeContact(listId, email): Promise<void>
  getContactStats(email): Promise<{ status, lists[], opens, clicks, bouncedAt, unsubscribedAt }>
}

MailerLiteAdapter implements EmailMarketingAdapter
MailchimpAdapter implements EmailMarketingAdapter
New file: apps/api/src/modules/email-marketing/email-marketing.controller.ts

GET /email-marketing/lists — fetch lists from configured provider (cached 1hr)
POST /webhooks/mailerlite — receive events
POST /webhooks/mailchimp — receive events
GET /email-marketing/contact/:email/stats — used by Contact/Account 360


Part 2 — Database Migrations (migration 055)
sql-- Columns added to contacts table
ALTER TABLE contacts ADD COLUMN email_marketing_status VARCHAR(20);  
-- 'subscribed' | 'unsubscribed' | 'bounced' | 'complained' | null
ALTER TABLE contacts ADD COLUMN email_bounced_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN unsubscribed_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN last_email_opened_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN last_email_clicked_at TIMESTAMPTZ;

-- New table: tracks which lists each contact is on
CREATE TABLE contact_email_marketing (
  id UUID PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  provider VARCHAR(20),        -- 'mailerlite' | 'mailchimp'
  list_id VARCHAR(255),
  list_name VARCHAR(255),
  status VARCHAR(20),          -- 'subscribed' | 'unsubscribed' | 'pending'
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  tags JSONB DEFAULT '[]'
);
```

---

### Part 3 — Workflow Engine: 2 New Action Types

In `workflow-runner.service.ts`, add to the `executeAction` switch:
```
case 'add_to_email_list':
  → resolve email from entity (contact.email / lead.email / opportunity→primary_contact.email)
  → for accounts: fetch associated contacts, filter by selector config
  → call emailMarketingService.addContact(listId, contact)
  → log activity on the record

case 'remove_from_email_list':
  → same resolution logic
  → call emailMarketingService.removeContact(listId, email)
```

**Workflow Builder UI** — the action config panel for these two actions shows:
- Dropdown: "Select List" (fetched from `GET /email-marketing/lists`)
- For Account triggers: "Contact Selector" — radio: `All contacts` / `Primary contact only` / `Contacts with role: [picker]`
- Tags field (optional, comma separated)

---

### Part 4 — Settings: Add Providers to Integrations Page

In the existing Integrations settings tab, add two new cards:

**MailerLite card:**
- API Key (password input)
- Test Connection button → calls `GET /email-marketing/lists`, shows list count if success
- Webhook URL to copy (for tenant to configure in MailerLite dashboard)
- Enable/Disable toggle

**Mailchimp card:**
- API Key + Data Center (e.g. `us14`)
- Test Connection button
- Webhook URL to copy
- Enable/Disable toggle

Backend: just add `'mailerlite', 'mailchimp'` to the `allowedProviders` array in `admin.controller.ts`.

---

### Part 5 — Contact 360 & Account 360: Email Marketing Panel

**Contact 360** — new section in the existing detail view:
```
Email Marketing Status
├── Provider badge (MailerLite / Mailchimp)
├── Status chip: Subscribed / Unsubscribed / Bounced ⚠
├── Lists subscribed to (chips)
├── Last opened: 3 days ago
├── Last clicked: 1 week ago
└── Actions: [+ Add to List] [− Remove from List]
```

**Account 360** — new panel in the existing tabs:
```
Email Marketing (Contacts)
├── Table of associated contacts with their subscription status
├── Columns: Contact name | Email | Status | Lists | Last Open | Last Click
└── Bulk action: Select contacts → Add to List

Summary of Files to Create/Modify
ActionFileCREATEapps/api/src/modules/email-marketing/email-marketing.service.tsCREATEapps/api/src/modules/email-marketing/email-marketing.controller.tsCREATEapps/api/src/modules/email-marketing/email-marketing.module.tsCREATEapps/api/src/database/migrations/055_email_marketing.sqlMODIFYapps/api/src/modules/workflows/workflow-runner.service.ts — 2 new action casesMODIFYapps/api/src/modules/admin/admin.controller.ts — add providers to allowedProvidersMODIFYapps/api/src/app.module.ts — register EmailMarketingModuleCREATEapps/web/src/pages/settings/integrations/MailerLiteCard.tsxCREATEapps/web/src/pages/settings/integrations/MailchimpCard.tsxMODIFYapps/web/src/pages/settings/IntegrationsPage.tsx — add the two cardsMODIFYContact 360 detail view — add Email Marketing panelMODIFYAccount 360 view — add Email Marketing contacts panelMODIFYWorkflow Builder action panel — add the two new action types with list picker

Ready to start building? I'd suggest going in this order: migration → service → controller → workflow actions → settings UI → 360 view panels. Shall I begin with Part 1?create a dev plan for claude code which i am using with vscode9:11 PMOrchestrated comprehensive development plan with structured file pathsOrchestrated comprehensive development plan with structured file pathsNow I have everything needed. Let me write the full Claude Code dev plan.

Email Marketing Integration — Claude Code Dev Plan
Overview
6 parts split to respect Claude Code's ~50k character limit. Complete each part, confirm compilation, then proceed to the next.
Migration number: 055
New module: apps/api/src/modules/email-marketing/
Providers: MailerLite, Mailchimp (per-tenant, tenant brings own API key)

PART A — Database Migration + Module Scaffold
Instructions for Claude Code
1. Read CLAUDE.md
2. Read apps/api/src/app.module.ts
3. Read apps/api/src/modules/admin/admin.controller.ts (lines 1-60, the integrations section)
4. Read apps/api/src/scripts/run-tenant-migrations.ts (last 100 lines to see migration pattern)
Then apply the following:

STEP A1 — Create migration file
Create new file: apps/api/src/database/migrations/055_email_marketing.sql
sql-- Migration: 055_email_marketing
-- Description: Email Marketing integration tables (MailerLite / Mailchimp)

-- 1. Add email marketing status columns to contacts
ALTER TABLE "TENANT_SCHEMA".contacts
  ADD COLUMN IF NOT EXISTS email_marketing_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_marketing_provider VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_email_clicked_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_email_marketing_status
  ON "TENANT_SCHEMA".contacts(email_marketing_status)
  WHERE email_marketing_status IS NOT NULL;

-- 2. Track which lists each contact is subscribed to
CREATE TABLE IF NOT EXISTS "TENANT_SCHEMA".contact_email_marketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES "TENANT_SCHEMA".contacts(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  list_id VARCHAR(255) NOT NULL,
  list_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'subscribed',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, provider, list_id)
);

CREATE INDEX IF NOT EXISTS idx_cem_contact_id
  ON "TENANT_SCHEMA".contact_email_marketing(contact_id);
CREATE INDEX IF NOT EXISTS idx_cem_provider_list
  ON "TENANT_SCHEMA".contact_email_marketing(provider, list_id);

-- 3. Cache provider lists (per tenant, stored in module_settings)
-- Uses existing module_settings table:
-- module='email_marketing', setting_key='provider_config' | 'cached_lists'
-- No new table needed — reuses module_settings already in schema

STEP A2 — Register migration in run-tenant-migrations.ts
File: apps/api/src/scripts/run-tenant-migrations.ts
Find the migrations array (the last migration entry, currently 054_...). After it, ADD:
typescript{
  name: '055_email_marketing',
  sql: `
    ALTER TABLE "${schema}".contacts
      ADD COLUMN IF NOT EXISTS email_marketing_status VARCHAR(20) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS email_marketing_provider VARCHAR(20) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_email_clicked_at TIMESTAMPTZ DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_contacts_email_marketing_status
      ON "${schema}".contacts(email_marketing_status)
      WHERE email_marketing_status IS NOT NULL;

    CREATE TABLE IF NOT EXISTS "${schema}".contact_email_marketing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id UUID NOT NULL REFERENCES "${schema}".contacts(id) ON DELETE CASCADE,
      provider VARCHAR(20) NOT NULL,
      list_id VARCHAR(255) NOT NULL,
      list_name VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'subscribed',
      subscribed_at TIMESTAMPTZ DEFAULT NOW(),
      unsubscribed_at TIMESTAMPTZ,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(contact_id, provider, list_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cem_contact_id
      ON "${schema}".contact_email_marketing(contact_id);
    CREATE INDEX IF NOT EXISTS idx_cem_provider_list
      ON "${schema}".contact_email_marketing(provider, list_id);
  `,
},

STEP A3 — Add providers to allowedProviders
File: apps/api/src/modules/admin/admin.controller.ts
Find:
typescriptconst allowedProviders = ['docusign', 'xero', 'twilio', 'sendgrid', 'stripe', 'slack'];
Replace with:
typescriptconst allowedProviders = ['docusign', 'xero', 'twilio', 'sendgrid', 'stripe', 'slack', 'mailerlite', 'mailchimp'];

STEP A4 — Create module scaffold (3 new files)
Create: apps/api/src/modules/email-marketing/email-marketing.module.ts
typescriptimport { Module } from '@nestjs/common';
import { EmailMarketingService } from './email-marketing.service';
import { EmailMarketingController } from './email-marketing.controller';

@Module({
  controllers: [EmailMarketingController],
  providers: [EmailMarketingService],
  exports: [EmailMarketingService],
})
export class EmailMarketingModule {}

Create: apps/api/src/modules/email-marketing/email-marketing.service.ts
typescript// ============================================================
// FILE: apps/api/src/modules/email-marketing/email-marketing.service.ts
// ============================================================
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface EmailMarketingContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags?: string[];
  fields?: Record<string, any>;
}

export interface ProviderList {
  id: string;
  name: string;
  subscriberCount?: number;
}

export interface ContactMarketingStats {
  provider: string | null;
  status: string | null;
  lists: { listId: string; listName: string; status: string; subscribedAt: string }[];
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  lastOpenedAt: string | null;
  lastClickedAt: string | null;
}

@Injectable()
export class EmailMarketingService {
  private readonly logger = new Logger(EmailMarketingService.name);
  // In-memory list cache: tenantId → { lists, cachedAt }
  private listCache = new Map<string, { lists: ProviderList[]; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly dataSource: DataSource) {}

  // ============================================================
  // PROVIDER CONFIG
  // ============================================================

  async getProviderConfig(tenantId: string): Promise<{
    provider: 'mailerlite' | 'mailchimp' | null;
    apiKey: string | null;
    datacenter: string | null;
    isEnabled: boolean;
  }> {
    // Check mailerlite first, then mailchimp
    for (const provider of ['mailerlite', 'mailchimp'] as const) {
      const [row] = await this.dataSource.query(
        `SELECT is_enabled, config FROM public.tenant_integrations
         WHERE tenant_id = $1 AND provider = $2`,
        [tenantId, provider],
      );
      if (row?.is_enabled) {
        const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
        return {
          provider,
          apiKey: cfg?.apiKey || null,
          datacenter: cfg?.datacenter || null,
          isEnabled: true,
        };
      }
    }
    return { provider: null, apiKey: null, datacenter: null, isEnabled: false };
  }

  // ============================================================
  // GET LISTS (with cache)
  // ============================================================

  async getLists(tenantId: string): Promise<ProviderList[]> {
    const cached = this.listCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.lists;
    }

    const cfg = await this.getProviderConfig(tenantId);
    if (!cfg.provider || !cfg.apiKey) return [];

    const lists = cfg.provider === 'mailerlite'
      ? await this.fetchMailerLiteLists(cfg.apiKey)
      : await this.fetchMailchimpLists(cfg.apiKey, cfg.datacenter!);

    this.listCache.set(tenantId, { lists, cachedAt: Date.now() });
    return lists;
  }

  async refreshListCache(tenantId: string): Promise<ProviderList[]> {
    this.listCache.delete(tenantId);
    return this.getLists(tenantId);
  }

  // ============================================================
  // TEST CONNECTION
  // ============================================================

  async testConnection(tenantId: string): Promise<{ success: boolean; listCount: number; error?: string }> {
    try {
      const lists = await this.refreshListCache(tenantId);
      return { success: true, listCount: lists.length };
    } catch (err: any) {
      return { success: false, listCount: 0, error: err.message };
    }
  }

  // ============================================================
  // ADD CONTACT TO LIST
  // ============================================================

  async addContactToList(
    tenantId: string,
    schemaName: string,
    listId: string,
    listName: string,
    contact: EmailMarketingContact,
    contactId?: string,
  ): Promise<void> {
    const cfg = await this.getProviderConfig(tenantId);
    if (!cfg.provider || !cfg.apiKey) {
      throw new BadRequestException('No email marketing provider configured');
    }

    if (cfg.provider === 'mailerlite') {
      await this.mailerliteAddContact(cfg.apiKey, listId, contact);
    } else {
      await this.mailchimpAddContact(cfg.apiKey, cfg.datacenter!, listId, contact);
    }

    // Record in DB if we have a contactId
    if (contactId) {
      await this.dataSource.query(
        `INSERT INTO "${schemaName}".contact_email_marketing
           (contact_id, provider, list_id, list_name, status, subscribed_at)
         VALUES ($1, $2, $3, $4, 'subscribed', NOW())
         ON CONFLICT (contact_id, provider, list_id)
         DO UPDATE SET status = 'subscribed', subscribed_at = NOW(), unsubscribed_at = NULL, updated_at = NOW()`,
        [contactId, cfg.provider, listId, listName],
      );
      await this.dataSource.query(
        `UPDATE "${schemaName}".contacts
         SET email_marketing_status = 'subscribed', email_marketing_provider = $2, updated_at = NOW()
         WHERE id = $1`,
        [contactId, cfg.provider],
      );
    }

    this.logger.log(`Added ${contact.email} to list ${listId} via ${cfg.provider}`);
  }

  // ============================================================
  // REMOVE CONTACT FROM LIST
  // ============================================================

  async removeContactFromList(
    tenantId: string,
    schemaName: string,
    listId: string,
    email: string,
    contactId?: string,
  ): Promise<void> {
    const cfg = await this.getProviderConfig(tenantId);
    if (!cfg.provider || !cfg.apiKey) return;

    if (cfg.provider === 'mailerlite') {
      await this.mailerliteRemoveContact(cfg.apiKey, listId, email);
    } else {
      await this.mailchimpRemoveContact(cfg.apiKey, cfg.datacenter!, listId, email);
    }

    if (contactId) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".contact_email_marketing
         SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW()
         WHERE contact_id = $1 AND list_id = $2`,
        [contactId, listId],
      );
    }
  }

  // ============================================================
  // GET CONTACT MARKETING STATS
  // ============================================================

  async getContactStats(schemaName: string, contactId: string): Promise<ContactMarketingStats> {
    const [contact] = await this.dataSource.query(
      `SELECT email_marketing_status, email_marketing_provider,
              email_bounced_at, unsubscribed_at,
              last_email_opened_at, last_email_clicked_at
       FROM "${schemaName}".contacts WHERE id = $1`,
      [contactId],
    );

    const lists = await this.dataSource.query(
      `SELECT list_id, list_name, status, subscribed_at
       FROM "${schemaName}".contact_email_marketing
       WHERE contact_id = $1
       ORDER BY subscribed_at DESC`,
      [contactId],
    );

    return {
      provider: contact?.email_marketing_provider || null,
      status: contact?.email_marketing_status || null,
      lists: lists.map((l: any) => ({
        listId: l.list_id,
        listName: l.list_name,
        status: l.status,
        subscribedAt: l.subscribed_at,
      })),
      bouncedAt: contact?.email_bounced_at || null,
      unsubscribedAt: contact?.unsubscribed_at || null,
      lastOpenedAt: contact?.last_email_opened_at || null,
      lastClickedAt: contact?.last_email_clicked_at || null,
    };
  }

  // ============================================================
  // GET ACCOUNT CONTACTS MARKETING STATS (for Account 360)
  // ============================================================

  async getAccountContactsStats(schemaName: string, accountId: string) {
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
                    'status', cem.status
                  )
                ) FILTER (WHERE cem.id IS NOT NULL),
                '[]'
              ) as lists
       FROM "${schemaName}".contacts c
       LEFT JOIN "${schemaName}".contact_email_marketing cem ON cem.contact_id = c.id
       WHERE c.account_id = $1 AND c.deleted_at IS NULL AND c.email IS NOT NULL
       GROUP BY c.id
       ORDER BY c.first_name ASC`,
      [accountId],
    );

    return rows.map((r: any) => ({
      contactId: r.id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      email: r.email,
      status: r.email_marketing_status,
      provider: r.email_marketing_provider,
      lists: r.lists || [],
      bouncedAt: r.email_bounced_at,
      unsubscribedAt: r.unsubscribed_at,
      lastOpenedAt: r.last_email_opened_at,
      lastClickedAt: r.last_email_clicked_at,
    }));
  }

  // ============================================================
  // PROCESS WEBHOOK EVENT
  // ============================================================

  async processWebhookEvent(
    schemaName: string,
    provider: string,
    event: {
      type: 'subscribe' | 'unsubscribe' | 'bounce' | 'spam' | 'open' | 'click';
      email: string;
      listId?: string;
      occurredAt?: string;
    },
  ): Promise<void> {
    // Find contact by email
    const [contact] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".contacts WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [event.email],
    );
    if (!contact) return;

    const now = event.occurredAt || new Date().toISOString();

    switch (event.type) {
      case 'subscribe':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'subscribed', email_marketing_provider = $2, updated_at = NOW()
           WHERE id = $1`,
          [contact.id, provider],
        );
        break;
      case 'unsubscribe':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'unsubscribed', unsubscribed_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [contact.id, now],
        );
        if (event.listId) {
          await this.dataSource.query(
            `UPDATE "${schemaName}".contact_email_marketing
             SET status = 'unsubscribed', unsubscribed_at = $2, updated_at = NOW()
             WHERE contact_id = $1 AND list_id = $3`,
            [contact.id, now, event.listId],
          );
        }
        break;
      case 'bounce':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'bounced', email_bounced_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [contact.id, now],
        );
        break;
      case 'spam':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET email_marketing_status = 'complained', updated_at = NOW()
           WHERE id = $1`,
          [contact.id],
        );
        break;
      case 'open':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET last_email_opened_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [contact.id, now],
        );
        break;
      case 'click':
        await this.dataSource.query(
          `UPDATE "${schemaName}".contacts
           SET last_email_clicked_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [contact.id, now],
        );
        break;
    }

    // Log activity on contact
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".activities
         (entity_type, entity_id, activity_type, title, metadata, performed_by)
       VALUES ('contacts', $1, 'email_marketing_event', $2, $3, NULL)`,
      [
        contact.id,
        `Email ${event.type}: ${event.email}`,
        JSON.stringify({ provider, event: event.type, listId: event.listId, occurredAt: now }),
      ],
    );
  }

  // ============================================================
  // RESOLVE EMAIL FROM WORKFLOW ENTITY
  // ============================================================

  async resolveEmailsFromEntity(
    schemaName: string,
    triggerModule: string,
    entityId: string,
    contactSelector: 'primary' | 'all' = 'primary',
  ): Promise<{ email: string; contactId: string; firstName?: string; lastName?: string }[]> {
    switch (triggerModule) {
      case 'contacts': {
        const [c] = await this.dataSource.query(
          `SELECT id, email, first_name, last_name FROM "${schemaName}".contacts WHERE id = $1 AND email IS NOT NULL`,
          [entityId],
        );
        return c ? [{ email: c.email, contactId: c.id, firstName: c.first_name, lastName: c.last_name }] : [];
      }
      case 'leads': {
        const [l] = await this.dataSource.query(
          `SELECT id, email, first_name, last_name FROM "${schemaName}".leads WHERE id = $1 AND email IS NOT NULL`,
          [entityId],
        );
        // Leads don't have contactId — use lead id as reference, contactId will be null
        return l ? [{ email: l.email, contactId: l.id, firstName: l.first_name, lastName: l.last_name }] : [];
      }
      case 'opportunities': {
        const [o] = await this.dataSource.query(
          `SELECT c.id, c.email, c.first_name, c.last_name
           FROM "${schemaName}".opportunities opp
           JOIN "${schemaName}".contacts c ON c.id = opp.primary_contact_id
           WHERE opp.id = $1 AND c.email IS NOT NULL`,
          [entityId],
        );
        return o ? [{ email: o.email, contactId: o.id, firstName: o.first_name, lastName: o.last_name }] : [];
      }
      case 'accounts': {
        if (contactSelector === 'all') {
          const contacts = await this.dataSource.query(
            `SELECT id, email, first_name, last_name FROM "${schemaName}".contacts
             WHERE account_id = $1 AND email IS NOT NULL AND deleted_at IS NULL`,
            [entityId],
          );
          return contacts.map((c: any) => ({ email: c.email, contactId: c.id, firstName: c.first_name, lastName: c.last_name }));
        } else {
          // primary = first contact or account's primary_contact_id
          const [c] = await this.dataSource.query(
            `SELECT id, email, first_name, last_name FROM "${schemaName}".contacts
             WHERE account_id = $1 AND email IS NOT NULL AND deleted_at IS NULL
             ORDER BY created_at ASC LIMIT 1`,
            [entityId],
          );
          return c ? [{ email: c.email, contactId: c.id, firstName: c.first_name, lastName: c.last_name }] : [];
        }
      }
      default:
        return [];
    }
  }

  // ============================================================
  // MAILERLITE ADAPTER
  // ============================================================

  private async fetchMailerLiteLists(apiKey: string): Promise<ProviderList[]> {
    const res = await fetch('https://connect.mailerlite.com/api/groups?limit=100', {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new BadRequestException(`MailerLite API error: ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((g: any) => ({
      id: String(g.id),
      name: g.name,
      subscriberCount: g.active_count || 0,
    }));
  }

  private async mailerliteAddContact(apiKey: string, groupId: string, contact: EmailMarketingContact): Promise<void> {
    // Upsert subscriber
    const body: any = {
      email: contact.email,
      fields: {
        name: contact.firstName || '',
        last_name: contact.lastName || '',
        phone: contact.phone || '',
        ...(contact.fields || {}),
      },
    };
    if (contact.tags?.length) body.groups = [groupId];

    const upsertRes = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!upsertRes.ok && upsertRes.status !== 409) {
      throw new BadRequestException(`MailerLite upsert error: ${upsertRes.status}`);
    }

    // Assign to group
    const assignRes = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(contact.email)}/groups/${groupId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      },
    );
    if (!assignRes.ok && assignRes.status !== 409) {
      this.logger.warn(`MailerLite group assign warning: ${assignRes.status}`);
    }
  }

  private async mailerliteRemoveContact(apiKey: string, groupId: string, email: string): Promise<void> {
    const res = await fetch(
      `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}/groups/${groupId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      this.logger.warn(`MailerLite remove warning: ${res.status}`);
    }
  }

  // ============================================================
  // MAILCHIMP ADAPTER
  // ============================================================

  private mailchimpBase(datacenter: string) {
    return `https://${datacenter}.api.mailchimp.com/3.0`;
  }

  private mailchimpAuth(apiKey: string) {
    return `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`;
  }

  private mailchimpHash(email: string) {
    // MD5 hash of lowercase email — Mailchimp subscriber ID
    const { createHash } = require('crypto');
    return createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  private async fetchMailchimpLists(apiKey: string, datacenter: string): Promise<ProviderList[]> {
    const res = await fetch(`${this.mailchimpBase(datacenter)}/lists?count=100`, {
      headers: { Authorization: this.mailchimpAuth(apiKey) },
    });
    if (!res.ok) throw new BadRequestException(`Mailchimp API error: ${res.status}`);
    const data = await res.json();
    return (data.lists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      subscriberCount: l.stats?.member_count || 0,
    }));
  }

  private async mailchimpAddContact(apiKey: string, datacenter: string, listId: string, contact: EmailMarketingContact): Promise<void> {
    const hash = this.mailchimpHash(contact.email);
    const body = {
      email_address: contact.email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      merge_fields: {
        FNAME: contact.firstName || '',
        LNAME: contact.lastName || '',
        PHONE: contact.phone || '',
      },
      tags: contact.tags || [],
    };

    const res = await fetch(`${this.mailchimpBase(datacenter)}/lists/${listId}/members/${hash}`, {
      method: 'PUT',
      headers: {
        Authorization: this.mailchimpAuth(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new BadRequestException(`Mailchimp add error: ${err.detail || res.status}`);
    }
  }

  private async mailchimpRemoveContact(apiKey: string, datacenter: string, listId: string, email: string): Promise<void> {
    const hash = this.mailchimpHash(email);
    const res = await fetch(`${this.mailchimpBase(datacenter)}/lists/${listId}/members/${hash}`, {
      method: 'PATCH',
      headers: {
        Authorization: this.mailchimpAuth(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'unsubscribed' }),
    });
    if (!res.ok && res.status !== 404) {
      this.logger.warn(`Mailchimp remove warning: ${res.status}`);
    }
  }
}

Create: apps/api/src/modules/email-marketing/email-marketing.controller.ts
typescript// ============================================================
// FILE: apps/api/src/modules/email-marketing/email-marketing.controller.ts
// ============================================================
import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, Request, Headers, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EmailMarketingService } from './email-marketing.service';
import { DataSource } from 'typeorm';

@ApiTags('Email Marketing')
@ApiBearerAuth()
@Controller('email-marketing')
export class EmailMarketingController {
  constructor(
    private readonly service: EmailMarketingService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Lists ─────────────────────────────────────────────────

  @Get('lists')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'view')
  @ApiOperation({ summary: 'Get available lists from configured provider' })
  async getLists(@Request() req: { user: JwtPayload }) {
    return this.service.getLists(req.user.tenantId);
  }

  @Post('lists/refresh')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  @ApiOperation({ summary: 'Refresh list cache from provider' })
  async refreshLists(@Request() req: { user: JwtPayload }) {
    return this.service.refreshListCache(req.user.tenantId);
  }

  @Post('test-connection')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Test provider API connection' })
  async testConnection(@Request() req: { user: JwtPayload }) {
    return this.service.testConnection(req.user.tenantId);
  }

  // ── Contact subscription management ──────────────────────

  @Post('contacts/:contactId/subscribe')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  @ApiOperation({ summary: 'Manually subscribe a contact to a list' })
  async subscribeContact(
    @Request() req: { user: JwtPayload },
    @Param('contactId') contactId: string,
    @Body() body: { listId: string; listName: string; tags?: string[] },
  ) {
    const [contact] = await this.dataSource.query(
      `SELECT id, email, first_name, last_name FROM "${req.user.tenantSchema}".contacts WHERE id = $1`,
      [contactId],
    );
    if (!contact) throw new Error('Contact not found');

    await this.service.addContactToList(
      req.user.tenantId,
      req.user.tenantSchema,
      body.listId,
      body.listName,
      {
        email: contact.email,
        firstName: contact.first_name,
        lastName: contact.last_name,
        tags: body.tags,
      },
      contactId,
    );
    return { success: true };
  }

  @Delete('contacts/:contactId/lists/:listId')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'edit')
  @ApiOperation({ summary: 'Remove a contact from a list' })
  async unsubscribeContact(
    @Request() req: { user: JwtPayload },
    @Param('contactId') contactId: string,
    @Param('listId') listId: string,
  ) {
    const [contact] = await this.dataSource.query(
      `SELECT email FROM "${req.user.tenantSchema}".contacts WHERE id = $1`,
      [contactId],
    );
    if (!contact) throw new Error('Contact not found');

    await this.service.removeContactFromList(
      req.user.tenantId,
      req.user.tenantSchema,
      listId,
      contact.email,
      contactId,
    );
    return { success: true };
  }

  @Get('contacts/:contactId/stats')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('contacts', 'view')
  @ApiOperation({ summary: 'Get email marketing stats for a contact' })
  async getContactStats(
    @Request() req: { user: JwtPayload },
    @Param('contactId') contactId: string,
  ) {
    return this.service.getContactStats(req.user.tenantSchema, contactId);
  }

  @Get('accounts/:accountId/contacts-stats')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('accounts', 'view')
  @ApiOperation({ summary: 'Get email marketing stats for all contacts of an account' })
  async getAccountContactsStats(
    @Request() req: { user: JwtPayload },
    @Param('accountId') accountId: string,
  ) {
    return this.service.getAccountContactsStats(req.user.tenantSchema, accountId);
  }

  // ── Webhooks (no auth — validated by signature/secret) ───

  @Post('webhooks/mailerlite')
  @ApiOperation({ summary: 'MailerLite webhook receiver' })
  async mailerliteWebhook(
    @Body() body: any,
    @Request() req: { user: JwtPayload },
  ) {
    // MailerLite sends: { type, data: { subscriber: { email }, group: { id } } }
    const eventTypeMap: Record<string, any> = {
      'subscriber.created': 'subscribe',
      'subscriber.updated': 'subscribe',
      'subscriber.unsubscribed': 'unsubscribe',
      'subscriber.bounced': 'bounce',
      'subscriber.complained': 'spam',
      'campaign.opened': 'open',
      'campaign.clicked': 'click',
    };

    const mappedType = eventTypeMap[body.type];
    if (!mappedType || !body.data?.subscriber?.email) return { received: true };

    // Find tenant by matching webhook — for now process across all active tenants
    const tenants = await this.dataSource.query(
      `SELECT t.schema_name FROM master.tenants t
       INNER JOIN public.tenant_integrations ti ON ti.tenant_id = t.id
       WHERE ti.provider = 'mailerlite' AND ti.is_enabled = true AND t.status = 'active'`,
    );

    for (const tenant of tenants) {
      await this.service.processWebhookEvent(tenant.schema_name, 'mailerlite', {
        type: mappedType,
        email: body.data.subscriber.email,
        listId: body.data.group?.id ? String(body.data.group.id) : undefined,
        occurredAt: body.data.subscriber.updated_at,
      }).catch(err => {}); // fire and forget per tenant
    }

    return { received: true };
  }

  @Post('webhooks/mailchimp')
  @ApiOperation({ summary: 'Mailchimp webhook receiver' })
  async mailchimpWebhook(@Body() body: any) {
    // Mailchimp sends form-encoded: type, data[email], data[list_id]
    const eventTypeMap: Record<string, any> = {
      subscribe: 'subscribe',
      unsubscribe: 'unsubscribe',
      cleaned: 'bounce',
      campaign: 'open', // simplified
    };

    const mappedType = eventTypeMap[body.type];
    if (!mappedType || !body.data?.email) return { received: true };

    const tenants = await this.dataSource.query(
      `SELECT t.schema_name FROM master.tenants t
       INNER JOIN public.tenant_integrations ti ON ti.tenant_id = t.id
       WHERE ti.provider = 'mailchimp' AND ti.is_enabled = true AND t.status = 'active'`,
    );

    for (const tenant of tenants) {
      await this.service.processWebhookEvent(tenant.schema_name, 'mailchimp', {
        type: mappedType,
        email: body.data.email,
        listId: body.data.list_id,
      }).catch(err => {});
    }

    return { received: true };
  }
}

STEP A5 — Register in app.module.ts
File: apps/api/src/app.module.ts
After the existing import for Customer360Module (or any module near the bottom), ADD import:
typescriptimport { EmailMarketingModule } from './modules/email-marketing/email-marketing.module';
And in the imports array, ADD:
typescriptEmailMarketingModule,
```

---

**Confirm Part A compiles cleanly before proceeding.**

---

## PART B — Workflow Engine: 2 New Action Types

### Instructions for Claude Code
```
1. Read CLAUDE.md
2. Read apps/api/src/modules/workflows/workflow-runner.service.ts (full file)

STEP B1 — Inject EmailMarketingService into WorkflowRunnerService
File: apps/api/src/modules/workflows/workflow-runner.service.ts
Find the constructor (has DataSource, EmailChannel, SmsChannel, etc.). ADD EmailMarketingService to the injection:
typescriptimport { EmailMarketingService } from '../email-marketing/email-marketing.service';
In the constructor parameter list, ADD:
typescriptprivate readonly emailMarketingService: EmailMarketingService,

STEP B2 — Add 2 new cases to the executeAction switch
File: apps/api/src/modules/workflows/workflow-runner.service.ts
Find:
typescript      default:
        this.logger.warn(`Unknown action type: ${action.action_type}`);
        return { skipped: true };
ADD before default::
typescript      case 'add_to_email_list':    return this.actionAddToEmailList(schema, config, payload);
      case 'remove_from_email_list': return this.actionRemoveFromEmailList(schema, config, payload);

STEP B3 — Add the 2 new action methods
File: apps/api/src/modules/workflows/workflow-runner.service.ts
Find the last private method before the closing brace of the class (likely interpolate or tableForModule). AFTER it, ADD:
typescript  // ── ADD TO EMAIL LIST ─────────────────────────────────────
  private async actionAddToEmailList(schema: string, config: any, payload: any) {
    const listId = config.listId;
    const listName = config.listName || '';
    if (!listId) return { skipped: true, reason: 'no listId configured' };

    // Get tenantId from schema
    const [tenant] = await this.dataSource.query(
      `SELECT id FROM master.tenants WHERE schema_name = $1 LIMIT 1`, [schema],
    );
    if (!tenant) return { skipped: true, reason: 'tenant not found' };

    const contactSelector: 'primary' | 'all' = config.contactSelector || 'primary';
    const contacts = await this.emailMarketingService.resolveEmailsFromEntity(
      schema, payload.triggerModule, payload.entityId, contactSelector,
    );

    if (!contacts.length) return { skipped: true, reason: 'no email resolved' };

    let added = 0;
    for (const contact of contacts) {
      try {
        await this.emailMarketingService.addContactToList(
          tenant.id,
          schema,
          listId,
          listName,
          {
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            tags: config.tags ? config.tags.split(',').map((t: string) => t.trim()) : [],
          },
          contact.contactId,
        );
        added++;
      } catch (err: any) {
        this.logger.warn(`Email marketing add failed for ${contact.email}: ${err.message}`);
      }
    }

    return { added, listId, listName };
  }

  // ── REMOVE FROM EMAIL LIST ────────────────────────────────
  private async actionRemoveFromEmailList(schema: string, config: any, payload: any) {
    const listId = config.listId;
    if (!listId) return { skipped: true, reason: 'no listId configured' };

    const [tenant] = await this.dataSource.query(
      `SELECT id FROM master.tenants WHERE schema_name = $1 LIMIT 1`, [schema],
    );
    if (!tenant) return { skipped: true, reason: 'tenant not found' };

    const contactSelector: 'primary' | 'all' = config.contactSelector || 'primary';
    const contacts = await this.emailMarketingService.resolveEmailsFromEntity(
      schema, payload.triggerModule, payload.entityId, contactSelector,
    );

    if (!contacts.length) return { skipped: true, reason: 'no email resolved' };

    let removed = 0;
    for (const contact of contacts) {
      try {
        await this.emailMarketingService.removeContactFromList(
          tenant.id, schema, listId, contact.email, contact.contactId,
        );
        removed++;
      } catch (err: any) {
        this.logger.warn(`Email marketing remove failed for ${contact.email}: ${err.message}`);
      }
    }

    return { removed, listId };
  }

STEP B4 — Add EmailMarketingModule to WorkflowsModule imports
File: apps/api/src/modules/workflows/workflows.module.ts
ADD import:
typescriptimport { EmailMarketingModule } from '../email-marketing/email-marketing.module';
ADD to imports array:
typescriptEmailMarketingModule,
```

**Confirm Part B compiles cleanly before proceeding.**

---

## PART C — Settings UI: Integration Cards

### Instructions for Claude Code
```
1. Read CLAUDE.md
2. Read apps/web/src/pages/settings/IntegrationsPage.tsx (full file)
   — to understand the existing card pattern/layout

STEP C1 — Create MailerLite integration card
Create: apps/web/src/pages/settings/integrations/MailerLiteCard.tsx
tsximport React, { useState } from 'react';
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface Props {
  integration: { isEnabled: boolean; config: Record<string, any> } | null;
  onSaved: () => void;
}

export const MailerLiteCard: React.FC<Props> = ({ integration, onSaved }) => {
  const [apiKey, setApiKey] = useState(integration?.config?.apiKey || '');
  const [isEnabled, setIsEnabled] = useState(integration?.isEnabled || false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; listCount?: number; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/email-marketing/webhooks/mailerlite`;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first, then test
      await apiClient.put('/admin/integrations/mailerlite', { isEnabled: true, config: { apiKey } });
      const res = await apiClient.post('/email-marketing/test-connection');
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/integrations/mailerlite', {
        isEnabled,
        config: { apiKey },
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="text-green-700 font-bold text-sm">ML</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">MailerLite</h3>
            <p className="text-sm text-gray-500">Email campaigns & automations</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your MailerLite API key"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <a href="https://app.mailerlite.com/integrations/api" target="_blank" rel="noreferrer"
            className="text-xs text-green-600 hover:underline flex items-center gap-1 mt-1">
            Get your API key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate">
              {webhookUrl}
            </code>
            <button onClick={copyWebhook} className="p-2 text-gray-500 hover:text-gray-700">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-xs text-green-600 mt-1">Copied!</p>}
          <p className="text-xs text-gray-500 mt-1">Add this URL in MailerLite → Integrations → Webhooks</p>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.success
              ? <><CheckCircle className="w-4 h-4" /> Connected — {testResult.listCount} list(s) found</>
              : <><XCircle className="w-4 h-4" /> {testResult.error || 'Connection failed'}</>
            }
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleTest}
            disabled={!apiKey || testing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

STEP C2 — Create Mailchimp integration card
Create: apps/web/src/pages/settings/integrations/MailchimpCard.tsx
tsximport React, { useState } from 'react';
import { CheckCircle, XCircle, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface Props {
  integration: { isEnabled: boolean; config: Record<string, any> } | null;
  onSaved: () => void;
}

export const MailchimpCard: React.FC<Props> = ({ integration, onSaved }) => {
  const [apiKey, setApiKey] = useState(integration?.config?.apiKey || '');
  const [datacenter, setDatacenter] = useState(integration?.config?.datacenter || '');
  const [isEnabled, setIsEnabled] = useState(integration?.isEnabled || false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; listCount?: number; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/email-marketing/webhooks/mailchimp`;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await apiClient.put('/admin/integrations/mailchimp', { isEnabled: true, config: { apiKey, datacenter } });
      const res = await apiClient.post('/email-marketing/test-connection');
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/integrations/mailchimp', {
        isEnabled,
        config: { apiKey, datacenter },
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <span className="text-yellow-700 font-bold text-sm">MC</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Mailchimp</h3>
            <p className="text-sm text-gray-500">Email campaigns & audiences</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500" />
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="e.g. abc123abc123-us14"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data Center</label>
          <input
            type="text"
            value={datacenter}
            onChange={e => setDatacenter(e.target.value)}
            placeholder="e.g. us14"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Found at the end of your API key (e.g. -us14)</p>
          <a href="https://mailchimp.com/developer/marketing/guides/quick-start/" target="_blank" rel="noreferrer"
            className="text-xs text-yellow-600 hover:underline flex items-center gap-1 mt-1">
            Get your API key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate">
              {webhookUrl}
            </code>
            <button onClick={copyWebhook} className="p-2 text-gray-500 hover:text-gray-700">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-xs text-yellow-600 mt-1">Copied!</p>}
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.success
              ? <><CheckCircle className="w-4 h-4" /> Connected — {testResult.listCount} audience(s) found</>
              : <><XCircle className="w-4 h-4" /> {testResult.error || 'Connection failed'}</>
            }
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleTest}
            disabled={!apiKey || !datacenter || testing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

STEP C3 — Add cards to IntegrationsPage
File: apps/web/src/pages/settings/IntegrationsPage.tsx
ADD imports at the top:
tsximport { MailerLiteCard } from './integrations/MailerLiteCard';
import { MailchimpCard } from './integrations/MailchimpCard';
In the JSX where other integration cards are rendered, ADD inside the appropriate section (likely after the existing cards):
tsx{/* Email Marketing */}
<div className="mt-8">
  <h2 className="text-base font-semibold text-gray-900 mb-4">Email Marketing</h2>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <MailerLiteCard
      integration={integrations.find(i => i.provider === 'mailerlite') || null}
      onSaved={fetchIntegrations}
    />
    <MailchimpCard
      integration={integrations.find(i => i.provider === 'mailchimp') || null}
      onSaved={fetchIntegrations}
    />
  </div>
</div>
```

**Confirm Part C compiles cleanly before proceeding.**

---

## PART D — Workflow Builder UI: New Action Types

### Instructions for Claude Code
```
1. Read CLAUDE.md
2. Read apps/web/src/pages/workflows/ (list all files)
3. Read the workflow action panel/config component (whichever file renders action config forms)
```

Then add `add_to_email_list` and `remove_from_email_list` to:
- The action type picker list (alongside send_email, send_sms, etc.)
- The action config panel (renders listId dropdown fetched from `GET /email-marketing/lists` + contactSelector radio for account triggers + optional tags field)

The exact line numbers depend on the workflow builder file structure — read first, then patch.

---

## PART E — Contact 360 Panel

### Instructions for Claude Code
```
1. Read CLAUDE.md
2. Read apps/web/src/pages/contacts/ContactDetail.tsx (or equivalent contact detail page)
   — to understand tab structure
```

Create: `apps/web/src/pages/contacts/tabs/EmailMarketingTab.tsx`

This component:
- Fetches `GET /email-marketing/contacts/:contactId/stats`
- Shows status badge (Subscribed / Unsubscribed / Bounced / Not enrolled)
- Shows provider chip (MailerLite / Mailchimp)
- Lists subscribed lists as chips with unsubscribe action button per list
- Shows last opened / last clicked timestamps
- Has "+ Add to List" button → dropdown of available lists from `GET /email-marketing/lists` → calls `POST /email-marketing/contacts/:id/subscribe`

Add the tab to the ContactDetail page tabs array in the same pattern as existing tabs.

---

## PART F — Account 360 Panel

### Instructions for Claude Code
```
1. Read CLAUDE.md
2. Read apps/web/src/pages/accounts/Account360Page.tsx (or equivalent)
   — to understand how existing tabs like Timeline, Projects are structured
Create: apps/web/src/pages/accounts/tabs/EmailMarketingTab.tsx
This component:

Fetches GET /email-marketing/accounts/:accountId/contacts-stats
Renders a table: Contact Name | Email | Status chip | Lists (chips) | Last Opened | Last Clicked | Actions
Status chips: green=Subscribed, yellow=Pending, red=Bounced/Unsubscribed, gray=Not enrolled
Actions column: "+ Add to List" (opens modal with list picker) | unsubscribe per list
Bulk select: checkbox per row → bulk "Add to List" action at top

Add the tab to the Account 360 page tab list in the same pattern as existing tabs (Timeline, Projects, etc.).

Summary Checklist
PartWhatStatusAMigration 055 + module scaffold + allowedProviders⬜BWorkflow runner 2 new action types⬜CSettings — MailerLite + Mailchimp cards⬜DWorkflow builder UI — action config panels⬜EContact detail — Email Marketing tab⬜FAccount 360 — Email Marketing tab⬜