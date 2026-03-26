---
sidebar_position: 15
title: "Subscriptions & Renewals"
description: "Manage product subscriptions, track renewals, monitor MRR/ARR, and configure usage data sources."
---

# Subscriptions & Renewals

The **Subscriptions** system links products to accounts, tracks billing and renewal dates, calculates MRR/ARR, and monitors product usage through external data sources.

## How Subscriptions Work

A subscription represents a product or service that an account is currently paying for (or has paid for). Each subscription tracks:

| Field | Description |
|---|---|
| **Product** | The product from your product catalog |
| **Status** | Active, Trial, Expired, Cancelled |
| **Billing Frequency** | Monthly, Quarterly, Annually |
| **Quantity** | Number of seats or units |
| **Unit Price** | Price per unit per billing period |
| **Discount %** | Applied discount percentage |
| **MRR** | Auto-calculated Monthly Recurring Revenue |
| **Start Date** | When the subscription began |
| **End Date** | When the subscription expires |
| **Renewal Date** | When renewal conversation should start |
| **Auto-Renew** | Whether the subscription auto-renews |

![Screenshot: Subscriptions tab showing active products with MRR and renewal dates](../../static/img/screenshots/accounts/subscriptions-tab.png)

## Auto-Creation from Won Opportunities

When an opportunity is **closed as won**, the system automatically creates subscriptions for all line items (products) on that opportunity. The subscription inherits:

- Product, quantity, and unit price from the opportunity line items
- Start date = opportunity close date
- Status = Active

:::tip
This means your sales team doesn't need to manually set up subscriptions after closing a deal. The handoff from sales to customer success happens automatically.
:::

## Adding Subscriptions Manually

For existing accounts that you're onboarding into the CRM:

1. Navigate to the account's **Subscriptions** tab.
2. Click **Add Subscription**.
3. Search and select a product.
4. Set the billing details: frequency, quantity, unit price, discount.
5. Set dates: start date, end date, renewal date.
6. Toggle auto-renew if applicable.
7. Click **Save**.

## Renewal Tracking

Renewal dates are color-coded for urgency:

| Color | Meaning |
|---|---|
| **Red** | Overdue — renewal date has passed |
| **Amber** | Urgent — renewal within 30 days |
| **Yellow** | Upcoming — renewal within 90 days |
| **Green** | OK — renewal is more than 90 days away |

:::warning
Expired or overdue subscriptions contribute to the account's **churn risk score**. Keep renewal dates up to date to ensure accurate health scoring.
:::

### Upcoming Renewals Dashboard

Your admin can view all upcoming renewals across all accounts from **Admin > Customer Success > Upcoming Renewals**. This table is filterable by 30, 60, 90, or 180 days.

## MRR & ARR Calculations

- **MRR** (Monthly Recurring Revenue) = `quantity x unit_price x (1 - discount/100)`, normalized to monthly
- **ARR** (Annual Recurring Revenue) = `MRR x 12`
- These are calculated per subscription and summed at the account level
- Only **Active** subscriptions count toward MRR/ARR

## Usage Tracking

Each subscription can optionally track product usage from external systems. There are three data source types:

### Pull API
The system periodically fetches usage data from an external API endpoint:
- **URL** — the API endpoint to call
- **Method** — GET or POST
- **Headers** — authentication tokens, API keys
- **Poll Interval** — how often to fetch (hourly, daily, weekly)
- **Metric Mappings** — map JSON response paths to metric names (e.g., `$.data.activeUsers` → "Active Users")

### Push Webhook
The external system sends usage data to IntelliSales CRM:
- A unique webhook URL is generated per account+product
- The external system POSTs usage data to this URL
- Data is ingested automatically

### Manual Entry
For products without API access:
- Usage metrics are entered manually by team members
- Useful during onboarding or for products without APIs

![Screenshot: Usage source configuration modal showing Pull API settings](../../static/img/screenshots/accounts/usage-source-config.png)

### Usage Insights

Once configured, usage data appears in the **Overview** tab as sparkline trends:

| Metric | Current | Previous | Trend |
|---|---|---|---|
| Active Users | 34 | 28 | +21% |
| API Calls | 15,252 | 12,400 | +23% |
| Storage Used | 2.4 GB | 2.1 GB | +14% |

Usage trends feed into the health score (Product Usage factor) and upsell suggestions.

## What's Next

- [Customer 360 View](./customer-360-overview.md) — health scores, churn risk, and the full 360 overview
- [Account Detail Page](./accounts-detail-page.md) — all tabs including Subscriptions
- [Products Overview](./products-overview.md) — managing your product catalog
