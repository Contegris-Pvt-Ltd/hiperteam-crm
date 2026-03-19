---
sidebar_position: 12
title: "Managing Accounts"
description: "Create, search, filter, edit, and delete accounts in HiperTeam CRM."
---

# Managing Accounts

This chapter covers everyday operations for working with accounts — browsing the list, filtering by classification, creating new accounts, and maintaining existing records.

## Accounts List View

Navigate to **Accounts** in the sidebar to see the accounts list. The data table displays accounts with configurable columns including:

- Account Name
- Classification (B2B/B2C badge)
- Account Type
- Industry
- Phone
- Website
- Owner
- Created Date

![Screenshot: Accounts list view with classification badges and type indicators](../../static/img/screenshots/accounts/accounts-list-view.png)

## Classification Filter

At the top of the accounts list, you will find classification filter tabs:

- **All** — shows all accounts regardless of classification
- **B2B** — shows only business-to-business accounts
- **B2C** — shows only business-to-consumer accounts

Click a tab to instantly filter the list. The active tab is highlighted.

## Searching, Sorting, and Filtering

### Searching
Use the **search bar** above the data table to search accounts by name, email, phone, or website. Results filter as you type.

### Sorting
Click any **column header** to sort by that column. Click again to reverse the sort order.

### Filtering
Use filter controls to narrow down the list:
- **Account Type** — Customer, Prospect, Partner, Other
- **Industry** — filter by business sector
- **Owner** — filter by assigned owner
- **Date range** — filter by creation or modification date

## Creating Accounts

1. Click the **+ New Account** button at the top of the accounts list.
2. Fill in the account creation form:
   - **Account Name** (required) — the organization's name
   - **Classification** — select B2B or B2C
   - **Account Type** — Customer, Prospect, Partner, or Other
   - **Industry** — select the business sector
   - **Website, Phone, Email** — contact information
   - **Addresses** — billing and shipping addresses
   - **Parent Account** — optionally select a parent for hierarchy
   - **Custom Fields** — any admin-configured fields
3. Click **Save** to create the account.

![Screenshot: New account creation form with classification selector](../../static/img/screenshots/accounts/create-account.png)

:::warning
Required fields are marked with a red asterisk (*). The form will not submit until all required fields are completed. Check for validation messages below any incomplete fields.
:::

## Editing Accounts

1. Click an account in the list to open its detail page.
2. Click the **Edit** button.
3. Modify the desired fields.
4. Click **Save** to apply changes.

Alternatively, use the **actions menu** (three dots) on the account's row in the list view and select **Edit**.

## Deleting Accounts

1. Open the account or find it in the list view.
2. Click the **actions menu** (three dots).
3. Select **Delete**.
4. Confirm the deletion in the dialog.

:::info
Accounts are **soft-deleted** — they are hidden from normal views but retained in the database for data integrity. Linked contacts, opportunities, and other records remain intact. Contact your administrator to recover a deleted account if needed.
:::

## Account Type Badges

Throughout the platform, accounts display colored **type badges** for quick identification:

- **Customer** — green badge
- **Prospect** — blue badge
- **Partner** — purple badge
- **Other** — gray badge

These badges appear in the list view, detail page header, and anywhere an account is referenced (such as on a linked opportunity or contact).

:::tip
Keep account types up to date as relationships evolve. When a Prospect makes their first purchase, change their type to Customer to keep your data accurate and your reports meaningful.
:::
