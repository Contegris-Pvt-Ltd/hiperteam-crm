---
sidebar_position: 20
title: Email Setup & Integration
---

# Email Setup & Integration

Intellicon CRM supports three email providers for bidirectional email sync. Configure these from **Settings → Integrations** or from the **Email Settings** page within the Inbox.

## Supported Providers

### Gmail (OAuth 2.0)
1. Click **Connect Gmail**
2. Sign in with your Google account
3. Grant calendar and email permissions
4. Connection is established automatically

Supports both personal and shared mailboxes.

### Microsoft 365 (OAuth 2.0)
1. Click **Connect Microsoft**
2. Sign in with your Microsoft account
3. Grant the required permissions
4. Connection is established automatically

Supports both personal and shared mailboxes.

### IMAP/SMTP (Manual Configuration)

For other email providers (Yahoo, custom domains, etc.):

| Setting | Description | Example |
|---|---|---|
| **Email** | Your email address | user@company.com |
| **Display Name** | Name shown on outgoing emails | John Smith |
| **IMAP Host** | Incoming mail server | imap.company.com |
| **IMAP Port** | Incoming port | 993 |
| **IMAP SSL** | Enable SSL encryption | Yes |
| **SMTP Host** | Outgoing mail server | smtp.company.com |
| **SMTP Port** | Outgoing port | 587 |
| **SMTP STARTTLS** | Enable STARTTLS | Yes |
| **Password** | Account password or app password | ********* |
| **Shared Account** | Shared mailbox toggle | No |

:::tip
Click **Test Connection** before saving to verify your IMAP/SMTP settings are correct.
:::

## Email Signatures

Each user can configure their own email signature:
1. Go to **Email Settings** (from the Inbox page)
2. Scroll to **Email Signature**
3. Use the rich text editor to format your signature
4. Supports: bold, italic, underline, links, images, colors, font sizes

Signatures are automatically appended to all outgoing emails.

## Sync Behavior

- **Inbound emails** are synced automatically on a schedule
- **Outbound emails** sent from the CRM are tracked
- **Manual sync** can be triggered by clicking the sync button on the account
- **Last synced** timestamp is shown per account

## Managing Accounts

From Email Settings:
- View all connected accounts
- **Sync** — Trigger manual sync
- **Disconnect** — Remove email account (emails already synced are retained)

:::warning
Disconnecting an email account does not delete previously synced emails. They remain accessible in the CRM.
:::
