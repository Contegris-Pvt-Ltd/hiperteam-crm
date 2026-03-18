---
sidebar_position: 36
title: "Email Inbox"
description: "Use the integrated email inbox to read, filter, search, and manage emails connected to your CRM records."
---

# Email Inbox

The **Inbox** module provides an integrated email experience within Intellicon CRM. Read and manage emails without leaving the platform, and keep your communications linked to the right CRM records.

## Email Inbox Overview

The inbox connects to your existing email accounts (Gmail, Outlook) and displays your messages directly within Intellicon CRM. This integration ensures that all email communication is captured in context alongside your leads, contacts, and opportunities.

![Screenshot: Email inbox showing list of emails with sender, subject, and date](../../static/img/screenshots/email/inbox-overview.png)

## Connected Accounts

The inbox supports connections to:

- **Gmail** — via Google OAuth
- **Outlook / Microsoft 365** — via Microsoft OAuth

To connect an account:
1. Navigate to **Inbox** or email settings.
2. Click **Connect Account**.
3. Select your email provider (Gmail or Outlook).
4. Authorize Intellicon CRM to access your email.
5. Your inbox populates with recent messages.

:::info
You can connect multiple email accounts. Switch between them using the account selector in the inbox.
:::

## Email List

The main inbox view shows emails in a list format with:

- **Sender** name and avatar
- **Subject** line
- **Preview** text (first line of the message body)
- **Date/time** received
- **Star** indicator
- **Read/unread** status (bold = unread)
- **CRM entity link** indicator (if linked to a record)

### Filters

Filter your email list using the tabs at the top:

| Filter | Shows |
|---|---|
| **All** | All emails in your inbox |
| **Unread** | Only unread messages |
| **Starred** | Messages you have starred |
| **Sent** | Emails you have sent |

## Reading Emails

Click an email in the list to open the **thread view**:

- The full conversation thread is displayed with all replies
- Each message shows sender, recipients, date, and body
- **Attachments** appear as clickable links or thumbnails below the message
- Reply and forward buttons appear at the bottom

![Screenshot: Email thread view showing conversation with attachments](../../static/img/screenshots/email/email-thread.png)

## Searching Emails

Use the **search bar** at the top of the inbox to find emails:

- Search by **sender name or email**
- Search by **subject line**
- Search by **keywords** in the message body
- Results update as you type

:::tip
Use search to quickly find client communications when preparing for meetings or following up on discussions.
:::

For composing, replying, and linking emails to CRM records, see [Composing Emails](./email-composing.md). For automated email management, see [Email Rules](./email-rules.md).
