---
sidebar_position: 19
title: "Opportunity Settings"
description: "Configure opportunity management in Intellicon CRM — pipelines, stage ownership, close reasons, types, sources, forecast categories, and priorities."
---

# Opportunity Settings

The Opportunity Settings page provides **8 tabs** for configuring every aspect of your opportunity management process, from pipeline structure through forecasting categories.

Navigate to **Admin > Opportunity Settings**.

![Screenshot: Opportunity Settings page with tabs](../../static/img/screenshots/admin/opportunity-settings-page.png)

## Tab Overview

| Tab | Purpose |
|-----|---------|
| **Pipelines** | Opportunity-specific pipelines |
| **Stages** | Stages within each pipeline |
| **Stage Ownership** | Owner assignment per stage |
| **Priorities** | Priority levels for opportunities |
| **Close Reasons** | Won and Lost reason management |
| **Types** | Opportunity type classification |
| **Sources** | Origin tracking for opportunities |
| **Forecast Categories** | Revenue forecasting configuration |

## Pipelines & Stages

Opportunity pipelines use the same [shared pipeline system](./pipelines-stages.md) as leads, but with `module=opportunities`. Configuration works identically — create pipelines, add stages, set order and probabilities.

:::info
Opportunity stages typically have **probability percentages** that feed into revenue forecasting. Set these thoughtfully: Discovery (10%), Qualification (20%), Proposal (40%), Negotiation (60%), Verbal Commitment (80%), Closed Won (100%), Closed Lost (0%).
:::

## Stage Ownership

The Stage Ownership tab allows you to assign responsibility for each stage to a user, team, or role. See [Stage Ownership](./stage-ownership.md) for full details.

Common opportunity stage ownership patterns:

| Stage | Owner |
|-------|-------|
| Qualification | SDR Team |
| Discovery | Account Executive (role) |
| Proposal | Solutions Engineering Team |
| Negotiation | Sales Manager (role) |
| Legal Review | Legal Team |
| Closed | Account Executive (role) |

## Close Reasons

Close reasons categorize **why** an opportunity was won or lost. They are split into two groups.

### Won Reasons

1. Switch to the **Close Reasons** tab.
2. In the **Won Reasons** section, click **Add Reason**.
3. Enter the reason (e.g., "Best Fit Solution", "Competitive Pricing", "Existing Relationship", "Superior Support").
4. Save.

### Lost Reasons

1. In the **Lost Reasons** section, click **Add Reason**.
2. Enter the reason (e.g., "Lost to Competitor", "No Budget", "No Decision", "Timing", "Product Gap", "Champion Left").
3. Save.

![Screenshot: Close reasons configuration](../../static/img/screenshots/admin/close-reasons.png)

When users close an opportunity as Won or Lost, they must select one of these reasons. This data is invaluable for win/loss analysis.

:::tip
Review lost reasons monthly in [Reports](../user-manual/reports-overview). If "Lost to Competitor" dominates, investigate which competitors and why. If "No Decision" is frequent, your qualification process may need improvement.
:::

## Opportunity Types

Types classify opportunities by their nature or deal structure.

1. Switch to the **Types** tab.
2. Click **Add Type**.
3. Enter the type name and optional description.
4. Save.

### Common Opportunity Types

| Type | Description |
|------|-------------|
| **New Business** | First-time deal with a new customer |
| **MSA (Master Service Agreement)** | Framework agreement for ongoing services |
| **Renewal** | Renewing an existing contract |
| **Expansion** | Upselling additional products/services to existing customer |
| **Cross-sell** | Selling different product lines to existing customer |
| **Professional Services** | Consulting or implementation engagement |

:::info
Types help segment your pipeline for reporting. You can filter reports and dashboards by opportunity type to analyze new business vs. renewal performance separately.
:::

## Sources

Manage where opportunities originate from.

1. Switch to the **Sources** tab.
2. Click **Add Source**.
3. Enter the source name (e.g., "Qualified Lead", "Referral", "RFP Response", "Partner", "Direct Outreach", "Event").
4. Save.

Opportunity sources are separate from lead sources, though they often overlap. When a lead is converted to an opportunity, the source can be carried over automatically.

## Forecast Categories

Forecast categories group opportunities by their likelihood of closing, providing a structured view for revenue forecasting.

### Configuring Forecast Categories

1. Switch to the **Forecast Categories** tab.
2. Review or modify the default categories.
3. Each category has:
   - **Name** — e.g., "Pipeline", "Best Case", "Commit", "Closed"
   - **Probability range** — the stage probability range that maps to this category
   - **Color** — visual identification in forecast views

### Default Forecast Categories

| Category | Probability Range | Meaning |
|----------|------------------|---------|
| **Pipeline** | 0-20% | Early stage, low confidence |
| **Best Case** | 21-60% | Active opportunity, moderate confidence |
| **Commit** | 61-90% | High confidence, expected to close |
| **Closed** | 91-100% | Won or nearly certain |

![Screenshot: Forecast categories configuration](../../static/img/screenshots/admin/forecast-categories.png)

:::warning
Forecast categories should align with your stage probabilities. If you change stage probabilities, review forecast category ranges to ensure they still make sense.
:::

## Priority Management

The Priorities tab for opportunities works identically to [lead priorities](./priorities.md). Configure icons, colors, and the default priority.

## Best Practices

1. **Align stages with your actual sales process** — observe how your team sells before codifying stages.
2. **Set realistic probabilities** — base them on historical conversion data, not optimism.
3. **Keep close reasons actionable** — "Other" is not useful for analysis. Be specific.
4. **Use types for segmentation** — distinguishing new business from renewals is critical for accurate forecasting.
5. **Review forecast categories quarterly** — adjust probability ranges based on actual win rates.
6. **Limit the number of sources** — too many sources dilute analysis. Group similar channels.

---

Next: [Task Settings](./task-settings.md) — Configure task types, statuses, and priorities.
