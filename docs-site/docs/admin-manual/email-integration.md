---
sidebar_position: 31
title: "Email Integration"
description: "Configure email integration in Intellicon CRM — connect Gmail and Outlook, set up SMTP for outbound, configure signatures, sync settings, and auto-link rules."
---

# Email Integration

Email integration connects your team's email accounts to Intellicon CRM, enabling email tracking, automatic association with CRM records, and centralized communication history.

Navigate to **Admin > Integrations > Email**.

![Screenshot: Email integration settings](../../static/img/screenshots/admin/email-integration.png)

## Email Account Connections

### Gmail (OAuth)

1. Click **Connect Gmail**.
2. Redirect to Google's consent screen.
3. Sign in and grant the following permissions:
   - Read email messages
   - Send email on behalf of the user
   - Manage labels
4. Click **Allow**.
5. The Gmail account appears as connected.

### Outlook (OAuth)

1. Click **Connect Outlook**.
2. Redirect to Microsoft's consent screen.
3. Sign in with your Microsoft 365 account.
4. Grant the following permissions:
   - Read and send mail
   - Access mailbox settings
5. Click **Accept**.
6. The Outlook account appears as connected.

:::info
Email connections are per-user. Each user connects their own email account from their personal settings. The admin page configures the **OAuth app credentials** (Client ID, Client Secret) and organization-level settings.
:::

### Admin Configuration

1. **Gmail OAuth App**: Enter the Google OAuth Client ID and Client Secret from your Google Cloud Console.
2. **Outlook OAuth App**: Enter the Microsoft Azure AD Application ID and Secret.
3. Set the **Redirect URI** for each provider.
4. Save.

## SMTP Configuration for Outbound

For organizations that prefer SMTP over OAuth for outbound email:

1. Select the **SMTP** tab.
2. Configure:
   - **Host** — SMTP server address
   - **Port** — 587 (TLS) or 465 (SSL)
   - **Username** and **Password**
   - **Encryption** — TLS or SSL
   - **From Address** — default sender address
   - **From Name** — default sender name
3. Click **Test Connection**.
4. Save.

:::tip
Use a dedicated sending domain (e.g., `notifications@crm.yourcompany.com`) rather than individual user accounts for system-generated emails. This prevents deliverability issues when users leave.
:::

## Default Email Signature

Configure an organization-wide email signature that is appended to all outbound emails sent from within the CRM.

1. Select the **Signature** tab.
2. Use the rich text editor to design the signature.
3. Available variables:
   - `\{\{user_name\}\}` — sender's full name
   - `\{\{user_title\}\}` — sender's job title
   - `\{\{user_phone\}\}` — sender's phone number
   - `\{\{user_email\}\}` — sender's email address
   - `\{\{company_name\}\}` — organization name
   - `\{\{company_logo\}\}` — organization logo URL
4. Preview the signature.
5. Save.

:::info
Users can override the organization signature with their own in personal settings, if allowed by the admin. Toggle the **Allow User Override** setting to control this.
:::

## Sync Frequency Settings

Configure how often emails are fetched and synchronized:

| Setting | Options | Recommended |
|---------|---------|-------------|
| **Inbound Sync** | Real-time, 5 min, 15 min, hourly | 5 minutes |
| **Outbound Tracking** | Real-time, 5 min | Real-time |
| **Historical Import** | Last 30/60/90 days, None | Last 30 days |

Historical import pulls existing emails into the CRM when a user first connects their account. This provides context on prior communications.

## Auto-Link Rules

Auto-link rules automatically associate incoming and outgoing emails with the correct CRM records (contacts, leads, accounts, opportunities).

### How Auto-Linking Works

The system matches emails to CRM records using:

1. **Email address** — matches the sender/recipient email to a contact's email field.
2. **Domain** — matches the email domain to an account's domain.
3. **Email thread** — if a reply is in a thread already linked to a record, the new email is linked to the same record.

### Configuring Auto-Link Rules

1. Select the **Auto-Link** tab.
2. Configure:
   - **Link to Contacts** — match by email address (enabled by default)
   - **Link to Accounts** — match by domain (enabled by default)
   - **Link to Leads** — match by email address
   - **Link to Opportunities** — link via associated contact or account
   - **Create Contact if not found** — automatically create a contact for unknown senders
3. Save.

![Screenshot: Auto-link rules configuration](../../static/img/screenshots/admin/email-auto-link.png)

:::warning
The "Create Contact if not found" option can generate many contact records from spam or irrelevant emails. Consider enabling it only after configuring domain exclusion rules.
:::

### Domain Exclusion Rules

Exclude certain domains from auto-linking and auto-contact creation:

1. In the Auto-Link settings, find **Excluded Domains**.
2. Add domains to exclude: `gmail.com`, `yahoo.com`, `hotmail.com`, `outlook.com` (personal email providers).
3. Add your own company domain (to avoid linking internal emails).
4. Save.

## Inbox Rules Administration

Set organization-level rules for email processing:

- **Archive after linking** — automatically archive emails in the user's inbox after they are linked to a CRM record.
- **Label/tag applied emails** — add a label (Gmail) or category (Outlook) to emails that have been processed.
- **Ignore automated emails** — skip emails from no-reply addresses, newsletters, and auto-responders.

## Best Practices

1. **Use OAuth over SMTP** — OAuth is more secure and supports two-way sync.
2. **Configure auto-link early** — link rules are most effective when configured before users connect their accounts.
3. **Exclude personal domains** — prevent irrelevant contacts from being created.
4. **Set reasonable sync intervals** — 5-minute sync provides near-real-time visibility without excessive API usage.
5. **Standardize signatures** — a consistent email signature strengthens your brand in every outgoing email.
6. **Train users on email tracking** — explain that emails sent from the CRM are tracked and linked to records.

---

Next: [Import/Export](./import-export.md) — Bulk import and export data.
