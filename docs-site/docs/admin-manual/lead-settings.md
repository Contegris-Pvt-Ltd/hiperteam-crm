---
sidebar_position: 18
title: "Lead Settings"
description: "Configure lead management in HiperTeam CRM — scoring templates, routing rules, qualification frameworks, sources, reasons, and team roles across 7 settings tabs."
---

# Lead Settings

The Lead Settings page is the central hub for configuring your lead management process. It contains **7 tabs** covering every aspect of lead handling from initial capture to qualification.

Navigate to **Admin > Lead Settings**.

![Screenshot: Lead Settings page with tabs](../../static/img/screenshots/admin/lead-settings-page.png)

## Tab Overview

| Tab | Purpose |
|-----|---------|
| **Pipelines** | Create and manage lead pipelines |
| **Stages** | Configure stages within pipelines |
| **Priorities** | Set priority levels for leads |
| **Scoring** | Define scoring templates and rules |
| **Routing** | Auto-assign rules for new leads |
| **Qualification** | Frameworks for qualifying leads |
| **Sources & Reasons** | Lead sources and disqualification reasons |

The Pipelines, Stages, and Priorities tabs are covered in their dedicated chapters: [Pipelines & Stages](./pipelines-stages.md) and [Priorities](./priorities.md).

## Scoring

Lead scoring assigns numeric points to leads based on their characteristics and behavior, helping sales teams focus on the most promising prospects.

### Scoring Templates

A scoring template is a collection of rules that calculate a lead's score.

1. Switch to the **Scoring** tab.
2. Click **Create Template**.
3. Enter a **template name** (e.g., "Enterprise Fit Score", "Engagement Score").
4. Save the template.

### Scoring Rules

Each template contains one or more rules that award points based on field values.

1. Open a scoring template.
2. Click **Add Rule**.
3. Configure the rule:
   - **Category** — grouping label (e.g., "Demographics", "Firmographics", "Engagement")
   - **Field** — the lead field to evaluate (e.g., "Industry", "Company Size", "Source")
   - **Operator** — comparison type (equals, contains, greater than, less than, in list)
   - **Value** — the target value (e.g., "Technology", "> 500 employees")
   - **Points** — score awarded when the rule matches (positive or negative)
4. Save the rule.

### Example Scoring Rules

| Category | Field | Operator | Value | Points |
|----------|-------|----------|-------|--------|
| Firmographics | Industry | Equals | Technology | +20 |
| Firmographics | Company Size | Greater than | 500 | +15 |
| Firmographics | Company Size | Less than | 10 | -10 |
| Demographics | Job Title | Contains | VP | +25 |
| Demographics | Job Title | Contains | Intern | -15 |
| Engagement | Source | Equals | Website Demo | +30 |
| Engagement | Source | Equals | Cold List | +5 |

:::tip
Use both positive and negative points. A lead from a target industry with a decision-maker title should score high, while a lead from a non-target segment with a junior title should score low.
:::

### Rule Sorting and Re-scoring

- **Drag rules** to change evaluation order (rules are evaluated top to bottom; all matching rules contribute points).
- **Re-score All** — click the "Re-score All Leads" button to recalculate scores for all existing leads using the current rules. Use this after modifying rules.

:::warning
Re-scoring all leads is a bulk operation that can take time for large datasets. It runs as a background job — check [Batch Jobs](./batch-jobs.md) for progress.
:::

## Routing

Lead routing automatically assigns new leads to users based on configurable rules.

1. Switch to the **Routing** tab.
2. Click **Add Routing Rule**.
3. Configure:
   - **Condition** — field + operator + value (e.g., Source = "Website", Region = "APAC")
   - **Assign to** — a specific user, team (round-robin), or role
   - **Priority** — rule evaluation order (first matching rule wins)
4. Save.

### Routing Example

| Priority | Condition | Assign To |
|----------|-----------|-----------|
| 1 | Source = "Enterprise Referral" | Enterprise Team (round-robin) |
| 2 | Region = "EMEA" | EMEA Sales Team (round-robin) |
| 3 | Company Size > 1000 | Senior Account Exec |
| 4 | Default (no conditions) | General Sales Team (round-robin) |

:::info
If no routing rules match, the lead remains unassigned. Always create a **default rule** (no conditions) as the last rule to catch everything.
:::

## Qualification

Qualification frameworks provide structured criteria for determining whether a lead is ready to become an opportunity.

### Built-in Frameworks

- **BANT** — Budget, Authority, Need, Timeline
- **Custom** — define your own criteria

### Configuring a Framework

1. Switch to the **Qualification** tab.
2. Select or create a framework.
3. Define criteria with **weights**:
   - Each criterion has a name, description, and weight (percentage)
   - Weights must sum to 100%
4. Set the **qualification threshold** — the minimum weighted score to qualify a lead.
5. **Activate** the framework.

### Example: BANT Framework

| Criterion | Weight | Scoring |
|-----------|--------|---------|
| Budget | 30% | Does the lead have budget allocated? |
| Authority | 25% | Is the contact a decision maker? |
| Need | 25% | Does the lead have a clear need for the product? |
| Timeline | 20% | Is there an active buying timeline? |

**Threshold:** 70% — leads scoring 70% or above are considered "Sales Qualified".

## Sources

Manage the list of lead sources (where leads come from).

1. Switch to the **Sources & Reasons** tab.
2. In the **Sources** section, click **Add Source**.
3. Enter the source name (e.g., "Website", "Referral", "Trade Show", "Cold Outreach", "LinkedIn").
4. Save.

Sources appear as dropdown options on the lead create/edit form and can be used in routing rules and reports.

## Disqualification Reasons

Manage reasons for disqualifying leads (marking them as not viable).

1. In the **Sources & Reasons** tab, scroll to **Disqualification Reasons**.
2. Click **Add Reason**.
3. Enter the reason (e.g., "No Budget", "Not Decision Maker", "Competitor", "Wrong Industry", "Duplicate").
4. Save.

When a user disqualifies a lead, they must select one of these configured reasons, ensuring consistent categorization for reporting.

## Team Roles

Configure the roles available when adding team members to a lead record.

1. In the **Sources & Reasons** tab, find the **Team Roles** section.
2. Add roles like "Owner", "Co-Owner", "Technical Advisor", "Executive Sponsor".
3. These roles appear in the record team assignment interface.

## Module Settings

General key-value configuration for the leads module (e.g., default assignment behavior, auto-close inactive leads after N days).

## Best Practices

1. **Start simple with scoring** — begin with 5-10 rules and refine based on conversion data.
2. **Route everything** — every lead should be assigned within minutes of creation.
3. **Use qualification consistently** — train reps to score qualification criteria objectively.
4. **Review sources regularly** — add new sources as your marketing channels evolve.
5. **Analyze disqualification reasons** — frequent "No Budget" may indicate poor targeting.

---

Next: [Opportunity Settings](./opportunity-settings.md) — Configure opportunity pipelines, types, and forecasting.
