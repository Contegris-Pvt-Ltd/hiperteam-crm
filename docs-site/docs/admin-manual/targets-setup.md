---
sidebar_position: 22
title: "Targets & Quotas"
description: "Configure performance targets in Intellicon CRM — create targets, assign to individuals and teams, cascade goals, and track progress in real time."
---

# Targets & Quotas

The Targets system enables you to set measurable performance goals and track progress across your organization. Targets can be assigned to individuals, teams, or departments and cascade from organizational goals down to individual quotas.

Navigate to **Admin > Targets**.

![Screenshot: Targets setup page](../../static/img/screenshots/admin/targets-setup.png)

## Targets Overview

A **target** defines:
- **What** to measure (metric)
- **How much** to achieve (target value)
- **Over what period** (monthly, quarterly, annual)
- **By whom** (individual, team, department, or organization)

## Metrics Registry

Metrics are the measurable values that targets track. Available metrics vary by module:

| Metric | Module | Description |
|--------|--------|-------------|
| Revenue | Opportunities/Deals | Total closed-won revenue |
| Deal Count | Opportunities/Deals | Number of deals closed |
| Pipeline Value | Opportunities | Total value in active pipeline |
| Leads Generated | Leads | Number of new leads created |
| Leads Qualified | Leads | Number of leads moved to qualified stage |
| Tasks Completed | Tasks | Number of tasks marked complete |
| Calls Made | Tasks | Number of call-type tasks completed |
| Meetings Held | Tasks | Number of meeting-type tasks completed |

:::info
Metrics are computed in real time from actual CRM data. When a deal closes, the revenue target progress updates automatically.
:::

## Creating Targets

1. Click **Create Target**.
2. Configure:
   - **Name** (required) — e.g., "Q1 Revenue Target", "Monthly Deals Quota"
   - **Metric** (required) — select from the metrics registry
   - **Target Value** (required) — the goal to achieve (e.g., $500,000 or 25 deals)
   - **Period** — Monthly, Quarterly, or Annual
   - **Start Date** — when the target period begins
   - **Description** (optional) — context about the target
3. Click **Save**.

![Screenshot: Create target form](../../static/img/screenshots/admin/create-target.png)

## Target Assignments

Targets are assigned at different levels of the organization, creating a hierarchy:

```
Organization Target: $2M revenue (Annual)
├── Sales Department: $1.5M
│   ├── Enterprise Team: $1M
│   │   ├── Rep A: $400K
│   │   ├── Rep B: $350K
│   │   └── Rep C: $250K
│   └── SMB Team: $500K
│       ├── Rep D: $250K
│       └── Rep E: $250K
└── Partnerships Department: $500K
    └── Partner Manager: $500K
```

### Assigning to Individuals

1. Open a target.
2. Click **Add Assignment**.
3. Select **Individual** and choose the user.
4. Enter the individual target value.
5. Save.

### Assigning to Teams

1. Select **Team** and choose the team.
2. Enter the team target value.
3. Save.

### Assigning to Departments

1. Select **Department** and choose the department.
2. Enter the department target value.
3. Save.

## Cascading Targets

Cascading automatically distributes a parent target down to its children (departments, teams, or individuals).

1. Open a target with assignments.
2. Click **Cascade**.
3. Choose the distribution method:
   - **Equal** — divide evenly among assignees
   - **Weighted** — distribute based on historical performance or custom weights
   - **Manual** — set each child target individually
4. Confirm the cascade.

:::tip
Start with the organizational target and cascade down. Adjust individual targets after cascading to account for experience levels, territories, and ramp-up periods for new hires.
:::

## Generating Period Assignments

For recurring targets (monthly quotas), use the **Generate Periods** feature:

1. Open an annual or quarterly target.
2. Click **Generate Periods**.
3. Select how to distribute across months/quarters:
   - **Equal** — same amount each period
   - **Custom** — adjust per period (e.g., lower targets in December, higher in Q4)
4. Confirm.

This creates individual period assignments that can be tracked independently.

## Progress Tracking

Target progress is computed in **real time** by querying actual CRM data:

- **Current value** — the actual metric value achieved so far
- **Target value** — the goal
- **Percentage** — current / target
- **Pace** — whether the assignee is ahead or behind schedule (based on time elapsed in the period)

![Screenshot: Target progress dashboard](../../static/img/screenshots/admin/target-progress.png)

:::info
Progress is calculated automatically. There is no manual entry — the system counts closed deals, pipeline value, tasks completed, etc., directly from the CRM data.
:::

## Target Leaderboard Configuration

The leaderboard ranks users by their target achievement:

1. Navigate to the **Leaderboard** tab.
2. Configure:
   - **Metric to rank** — which target metric to display
   - **Period** — current month, quarter, or year
   - **Scope** — all users, by department, or by team
   - **Display count** — top 5, 10, or 20

The leaderboard is visible on the dashboard and can be configured per team or department.

## Best Practices

1. **Set achievable targets** — targets that are too aggressive demotivate. Aim for 70-80% of reps hitting quota.
2. **Use cascading wisely** — top-down cascading ensures alignment, but allow managers to adjust individual targets.
3. **Review monthly** — compare progress against targets and adjust if market conditions change.
4. **Combine with [gamification](./gamification-badges.md)** — badges for hitting milestones (50%, 100%, 150% of target) add motivation.
5. **Consider ramp-up** — new hires should have reduced targets for their first 1-2 quarters.
6. **Track leading indicators** — activity targets (calls, meetings) are leading indicators; revenue is lagging. Track both.

---

Next: [Gamification & Badges](./gamification-badges.md) — Motivate your team with achievements and leaderboards.
