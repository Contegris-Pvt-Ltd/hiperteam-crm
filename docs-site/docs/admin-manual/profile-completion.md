---
sidebar_position: 5
title: Profile Completion
---

# Profile Completion

Configure how profile completion percentages are calculated for records across your CRM. This helps your team ensure data quality by showing which records need more information.

Access it from **Settings → Profile Completion**.

![Screenshot: Profile Completion settings](../../static/img/screenshots/admin/profile-completion-page.png)

## Selecting a Module

Configure completion weights independently for:
- **Contacts**
- **Accounts**
- **Leads**
- **Opportunities**

## Enable / Disable

Toggle **Enable Profile Completion** per module. When enabled, a completion percentage bar appears on record detail pages.

## How Completion is Calculated

```
Completion % = (Sum of filled field weights / Total weight of all fields) × 100
```

Each field has a configurable **weight** (0–20 points). Fields with higher weights contribute more to the overall percentage.

**Example:**
- First Name (weight 10): Filled -- 10 points
- Email (weight 15): Filled -- 15 points
- Phone (weight 10): Empty -- 0 points
- Company (weight 5): Filled -- 5 points
- **Total: 30 / 40 = 75%**

## Configuring Field Weights

Fields are grouped by category:

| Category | Example Fields |
|---|---|
| **Basic Information** | First Name, Last Name, Email, Phone |
| **Contact Details** | Mobile, Fax, Website |
| **Location** | Country, City, Address |
| **Social Profiles** | LinkedIn, Twitter, Facebook |
| **Other** | Description, Tags, Source |
| **Custom Fields** | Any custom fields you've created |

For each field:
- Adjust the **weight slider** (0–20)
- Set to **0** to exclude from calculation

### Custom Fields

Custom fields can be included in the completion calculation:
- Toggle **Include in Completion** for each custom field
- Set a weight (0–20)
- Field type is displayed for reference

## Minimum Percentage

Set a **Minimum Required** percentage (0–100%). This is informational — records below the threshold will show a warning indicator but won't be blocked from saving.

## Summary Stats

The page shows:
- **Total Weight** — Sum of all field weights
- **Custom Fields** — Number of custom fields included in calculation
- **Minimum Required** — The threshold percentage

:::tip
Focus higher weights on business-critical fields. For leads, email and phone should have high weights since they're essential for outreach. For accounts, company name and industry matter more.
:::

:::note
Changes take effect immediately. Existing records will show updated completion percentages on their next page load.
:::
