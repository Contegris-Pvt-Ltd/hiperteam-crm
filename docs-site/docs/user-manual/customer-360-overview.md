---
sidebar_position: 14
title: "Customer 360 View"
description: "Understand the Customer 360 view — health scores, churn risk, CLTV, upsell suggestions, customer journey, and usage tracking."
---

# Customer 360 View

The **Customer 360** view gives you a complete picture of every account in one place — financial health, product subscriptions, customer journey, churn risk, and upsell opportunities. It is built directly into the [Account Detail Page](./accounts-detail-page.md).

## What is Customer 360?

Instead of clicking through multiple modules to piece together an account's story, the 360 view aggregates data from leads, opportunities, invoices, projects, emails, tasks, and subscriptions into a single command center.

![Screenshot: Customer 360 overview tab showing journey map, score cards, and health breakdown](../../static/img/screenshots/accounts/customer-360-overview.png)

## Key Metrics

Four score cards are always visible in the account sidebar:

| Metric | What It Tells You |
|---|---|
| **Health Score** | 0–100 score based on 6 weighted factors (payment, engagement, usage, support, relationship, contract) |
| **MRR / ARR** | Monthly and annual recurring revenue from active subscriptions |
| **Churn Risk** | LOW / MEDIUM / HIGH — auto-calculated from signals like overdue invoices, declining usage, or expired subscriptions |
| **CLTV** | Customer Lifetime Value — projected total revenue based on current MRR and account tenure |

:::tip
Health scores are recalculated hourly by the system. The weighting of each factor is configurable by your admin under **Admin > Customer Success**.
:::

## Customer Journey Map

The **Overview** tab displays a horizontal timeline showing the account's complete lifecycle:

1. **Lead** — when the first lead was created for this account
2. **Opportunity** — when the first sales opportunity was opened
3. **Deal Won** — when the first opportunity was closed as won
4. **Project** — when the first project was started
5. **Revenue** — when the first invoice was paid
6. **Renewal** — the next upcoming subscription renewal date

Future milestones (like an upcoming renewal) appear as outlined nodes so you can see what's coming.

![Screenshot: Customer journey map showing Lead to Opportunity to Deal Won to Project to Renewal](../../static/img/screenshots/accounts/customer-journey-map.png)

## Health Score Breakdown

The health score is composed of 6 factors, each with a configurable weight:

| Factor | What It Measures |
|---|---|
| **Payment Health** | Invoice payment speed, overdue count |
| **Engagement** | Email recency, meeting frequency, login activity |
| **Product Usage** | Active users trend, feature adoption, API volume |
| **Support Health** | Open tickets, resolution time, escalations |
| **Relationship** | Contact depth, champion identified, QBR completed |
| **Contract Status** | Renewal proximity, auto-renew status, expansion history |

Each factor shows a progress bar and individual score, making it easy to see exactly where an account is strong or needs attention.

:::note
The weights for each factor are configured by your admin. For example, if payment health is weighted at 25% and scores 90/100, it contributes 22.5 points to the overall score.
:::

## Upsell Suggestions

The system automatically identifies products the account doesn't have but is likely to benefit from. Each suggestion includes:

- **Product name** and description
- **Score** (0–100) — how strong the recommendation is
- **Why** — human-readable explanation (e.g., "3 support tickets about reporting this month", "Team grew 30%", "Renewal in 45 days")
- **Create Opportunity** button — one click to act on the suggestion

![Screenshot: Upsell suggestions panel showing product recommendations with scores and reasons](../../static/img/screenshots/accounts/upsell-suggestions.png)

## Churn Signals

When the system detects risk factors, they appear as actionable alerts:

- Overdue invoices with amount and days overdue
- Expired subscriptions with lost MRR
- No email communication in X days
- Declining usage trends
- Open support escalations

Each signal includes a suggested action like "Reach out to renew" or "Schedule check-in".

## Revenue Trend

A bar chart on the Overview tab shows monthly revenue over the last 12 months, calculated from paid invoices plus MRR from active subscriptions. This gives you an instant visual of whether the account is growing, flat, or declining.

## The Unified 14-Tab Account Page

The Customer 360 view is not a separate page — it is built directly into the [Account Detail Page](./accounts-detail-page.md), which organizes all account information across **14 tabs**:

1. **Overview** — journey map, score cards, health breakdown, upsell suggestions, revenue trend
2. **Subscriptions** — product subscriptions, MRR/ARR, renewal dates, usage tracking
3. **Leads** — all leads associated with this account
4. **Opportunities** — sales pipeline for this account
5. **Projects** — active and completed projects
6. **Financials** — invoices, revenue trend chart, payment summary
7. **Contacts** — people linked to this account with roles
8. **Email Marketing** — email marketing status and list membership (when [MailerLite/Mailchimp](../admin-manual/email-marketing.md) is connected)
9. **Emails** — communication history
10. **Tasks** — follow-ups and action items
11. **Notes** — team observations and meeting summaries
12. **Documents** — attached files and contracts
13. **Timeline** — unified chronological feed across all modules
14. **Activity / History** — audit trail of record changes

The left sidebar with health score, MRR/ARR, churn risk, and CLTV remains visible regardless of which tab is selected, giving you constant context about the account's health.

## What's Next

- [Subscriptions](./subscriptions-overview.md) — learn about product subscriptions, renewal tracking, and usage monitoring
- [Account Detail Page](./accounts-detail-page.md) — full reference for all 14 tabs
- [Managing Accounts](./accounts-managing.md) — creating, editing, and organizing accounts
- [Account Import](./account-import.md) — bulk import accounts, contacts, and subscriptions from Excel
