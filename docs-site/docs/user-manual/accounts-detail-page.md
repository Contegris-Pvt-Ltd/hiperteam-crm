---
sidebar_position: 13
title: "Account Detail Page"
description: "The unified account detail page — 360° view with sidebar scores, customer journey, subscriptions, leads, opportunities, projects, financials, and timeline."
---

# Account Detail Page

The account detail page is a **unified 360° command center** for every account. It combines company details, health metrics, product subscriptions, associated records, financials, and a unified timeline — all in one place.

## Page Layout

The page is split into two areas:

### Left Sidebar (Always Visible)

The sidebar stays visible regardless of which tab is selected, giving you constant context:

- **Logo/Avatar** — the account's logo or initials
- **Account Name** — with industry, classification (B2B/B2C), and type badges
- **Health Score** — gauge showing 0–100 with color indicator
- **MRR / ARR** — monthly and annual recurring revenue
- **Churn Risk** — LOW / MEDIUM / HIGH indicator
- **CLTV** — Customer Lifetime Value
- **Profile Completion** — progress bar showing data completeness
- **Quick Info** — email, phone, website, address
- **Owner** — the assigned account owner
- **Record Info** — created date, last updated

![Screenshot: Account detail page with sidebar showing health score, MRR, and churn risk](../../static/img/screenshots/accounts/account-detail-360.png)

### Right Content Area (Tab-Based)

The content area contains **14 tabs** organized by function:

## Tabs

### Overview

The default tab — a dashboard summarizing everything about the account:

- **Customer Journey Map** — horizontal timeline showing milestones from first lead through renewal. See [Customer 360 View](./customer-360-overview.md).
- **Score Cards** — Health, MRR/ARR, Churn Risk, CLTV
- **Health Score Breakdown** — 6 weighted factors with progress bars
- **Upsell Suggestions** — recommended products with scores, reasons, and "Create Opportunity" buttons
- **Active Subscriptions** — compact summary with a "View All" link to the Subscriptions tab
- **Revenue Trend** — bar chart showing monthly revenue over 12 months
- **Churn Signals** — actionable alerts when risk factors are detected

![Screenshot: Overview tab showing journey map, score cards, health breakdown, and upsell suggestions](../../static/img/screenshots/accounts/account-overview-tab.png)

### Subscriptions

Manage product subscriptions linked to this account:

- **Summary bar** — total active, trial, and expired subscriptions with MRR/ARR totals
- **Subscription table** — product, status, billing frequency, MRR, renewal date, auto-renew
- **Add Subscription** — button opens a modal to manually add a subscription
- **Configure Usage** — per-subscription link to set up usage data sources (Pull API, Push Webhook, Manual)

See [Subscriptions & Renewals](./subscriptions-overview.md) for full details.

### Leads

All leads associated with this account:

- Table with Name, Email, Stage (colored badge), Owner, Created Date
- Click any row to navigate to the lead detail page
- Pagination for accounts with many leads

### Opportunities

All sales opportunities for this account:

- Table with Name, Amount, Stage (colored badge), Probability %, Close Date, Owner
- Won opportunities show a green checkmark, lost show a red X
- Click any row to navigate to the opportunity detail page

### Projects

Projects linked to this account:

- Table with Name, Status (colored badge), Health (colored dot), Progress (task completion bar), Budget, Owner, Due Date
- Task count and completed count shown as a visual progress bar

### Financials

Revenue and invoice data for this account:

- **Revenue Trend Chart** — full-width bar chart showing monthly revenue
- **Summary Cards** — Total Invoiced, Total Paid, Outstanding, Overdue
- **Invoice Table** — Invoice #, Title, Status, Total Amount, Paid, Due, Issue Date, Due Date

![Screenshot: Financials tab showing revenue trend chart and invoice table](../../static/img/screenshots/accounts/account-financials-tab.png)

### Contacts

All contacts linked to this account with their roles:

- Link existing contacts or quick-create new ones
- Each contact shows role (Decision Maker, Technical Contact, etc.)
- Click to navigate to the contact detail page

:::tip
Maintain accurate contact roles. This helps your sales team know exactly who to reach for technical discussions, billing, or executive buy-in.
:::

### Emails

Email communication history with this account. View, reply, and compose new emails directly from this tab.

### Tasks

Tasks related to this account — follow-ups, calls, meetings, action items. Create new tasks directly from this tab.

### Notes

Free-text notes added by team members. Useful for recording meeting summaries, strategic observations, and account plans.

### Documents

Files attached to this account — contracts, proposals, compliance documents, presentations.

### Timeline

A **unified chronological feed** combining activities from all modules:

- Leads created/converted
- Opportunities opened/won/lost
- Invoices sent/paid
- Projects started/completed
- Emails sent/received
- Tasks completed

Each entry is color-coded by type and shows an icon, title, description, and relative date. Filter buttons at the top let you focus on specific modules.

![Screenshot: Timeline tab showing unified feed with type filters](../../static/img/screenshots/accounts/account-timeline-tab.png)

### Activity

Activity log specific to the account record itself — field changes, status updates, and system events.

### History

Detailed audit log of every change to the account — old/new values, who made the change, and timestamps. Full traceability for compliance.

## Parent-Child Hierarchy

- **Parent link** — if this account has a parent, the parent name appears as a clickable link
- **Children** — sub-accounts are accessible from the account record
- Navigate up and down the hierarchy by clicking parent or child links

## Linking Contacts

To link a contact to this account:

1. Go to the **Contacts** tab.
2. Click **Link Contact**.
3. Search for the contact by name or email.
4. Select the contact and choose their **role** at this account.
5. Click **Save**.

:::note
A contact can be linked to multiple accounts, and an account can have many contacts. This models real-world scenarios where people hold positions at multiple organizations.
:::

## What's Next

- [Customer 360 View](./customer-360-overview.md) — deep dive into health scores, churn risk, and upsell logic
- [Subscriptions & Renewals](./subscriptions-overview.md) — managing product subscriptions and usage tracking
- [Managing Accounts](./accounts-managing.md) — creating, editing, and organizing accounts
