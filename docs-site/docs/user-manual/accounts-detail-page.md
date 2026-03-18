---
sidebar_position: 13
title: "Account Detail Page"
description: "Explore the account detail page — tabs for activity, emails, notes, documents, linked contacts, sub-accounts, and history."
---

# Account Detail Page

The account detail page provides a comprehensive view of an organization and all its related data. It is the central hub for understanding the full scope of your relationship with a company or entity.

## Account Detail Layout

The header section displays:

- **Logo/Avatar** — the account's logo or a placeholder with initials
- **Account Name** — displayed prominently
- **Classification badge** — B2B or B2C
- **Account Type badge** — Customer, Prospect, Partner, or Other
- **Industry and Website** — key organizational details
- **Phone and Email** — quick-access contact information
- **Action buttons** — Edit, Delete, and other actions

![Screenshot: Account detail page header showing logo, name, classification badge, and type badge](../../static/img/screenshots/accounts/account-detail-header.png)

## Tabs

The account detail page organizes related data into tabs:

### Activity
A chronological timeline of all interactions with this account — emails, meetings, calls, stage changes on linked opportunities, and system events. See [Activity Timeline](./activity-timeline.md).

### Emails
All email threads associated with this account. You can view, reply to, and compose new emails from this tab.

### Notes
Free-text notes added by team members about this account. Useful for recording meeting summaries, strategic observations, and account plans. See [Notes & Documents](./notes-documents.md).

### Documents
Files attached to this account — contracts, proposals, compliance documents, presentations, etc. See [Notes & Documents](./notes-documents.md).

### Contacts
Lists all **contacts (individuals)** linked to this account. Each contact shows their **role** at the organization — Employee, Decision Maker, Technical Contact, etc.

From this tab you can:
- **Link an existing contact** — search for a contact and assign their role
- **Quick create a new contact** — add a new contact directly from this account

![Screenshot: Account detail Contacts tab showing linked contacts with roles](../../static/img/screenshots/accounts/account-contacts-tab.png)

:::tip
Maintain accurate contact roles on accounts. This helps your sales team know exactly who to reach out to for technical discussions, billing questions, or executive buy-in.
:::

### Children (Sub-Accounts)
If this account is a parent organization, the **Children** tab lists all sub-accounts (subsidiaries, divisions, regional offices). Each child account links to its own detail page.

From this tab you can:
- **View child accounts** and their types, industries, and key details
- **Navigate to any child** by clicking its row
- **Create a new child account** that is automatically linked as a subsidiary

### Tasks
Tasks related to this account — follow-ups, calls, meetings, and action items. You can create new tasks directly from this tab. See [Tasks Overview](./tasks-overview.md).

### History
A detailed audit log of every change made to the account record — field changes, old and new values, who made the change, and timestamps. Provides full traceability for compliance and review.

## Linking Contacts to Accounts

To link a contact to this account:

1. Go to the **Contacts** tab on the account detail page.
2. Click **Link Contact** (or the "+" button).
3. Search for the contact by name or email.
4. Select the contact from the results.
5. Choose the contact's **role** at this account (Employee, Decision Maker, etc.).
6. Click **Save**.

:::note
A contact can be linked to multiple accounts, and an account can have many linked contacts. This accurately models real-world scenarios where people hold positions at multiple organizations or consultancies.
:::

## Parent/Child Hierarchy

To view or manage the hierarchy:

- **Parent link** — if this account has a parent, the parent account name appears in the header as a clickable link.
- **Children tab** — shows all immediate child accounts.
- Navigate up and down the hierarchy by clicking parent or child links.

## Quick Create Contact from Account

When adding contacts from the account's Contacts tab:

1. If the person does not exist in the CRM yet, click **Create New Contact**.
2. A modal form opens with the account pre-filled.
3. Enter the contact's name, email, phone, and role.
4. Click **Save**.
5. The new contact is created and automatically linked to this account.
