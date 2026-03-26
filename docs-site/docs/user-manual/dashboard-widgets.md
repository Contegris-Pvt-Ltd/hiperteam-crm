---
sidebar_position: 6
title: "Dashboard Widgets"
description: "Explore all available dashboard widget types including scorecards, charts, funnels, leaderboards, and more."
---

# Dashboard Widgets

Widgets are the building blocks of your dashboard. Each widget visualizes a specific metric or dataset, and you can combine them freely to create dashboards tailored to your needs.

## Widget Types

IntelliSales CRM offers four categories of widgets:

| Category | Description |
|---|---|
| **Scorecards** | Single number KPIs with trend indicators (e.g., "Total Leads: 247 (+12%)") |
| **Charts** | Visual data representations — bar, line, pie, funnel, scatter |
| **Tables** | Tabular data views (e.g., top deals, recent activity) |
| **Metrics** | Compound metrics with sparklines and comparisons |

## Available Data Widgets

### Summary KPIs
Displays key performance indicators as large numbers with period-over-period comparison. Typical KPIs include total leads, total revenue, conversion rate, and average deal size.

![Screenshot: Summary KPI scorecard widgets showing leads, revenue, and conversion rate](../../static/img/screenshots/dashboard/widget-kpis.png)

### Pipeline Funnel
A funnel chart showing how records flow through pipeline stages. Each stage shows the count and value of records, with the funnel narrowing to illustrate drop-off at each stage.

### Lead Funnel
Similar to the pipeline funnel but focused specifically on lead qualification stages, from new leads through to converted or disqualified.

### Pipeline Velocity
Tracks how fast records move through your pipeline. Shows average time spent in each stage and overall cycle time from entry to close.

### Forecast
Displays your weighted pipeline forecast — the sum of opportunity amounts multiplied by their win probability. Breaks down by forecast category (Committed, Best Case, Pipeline, Omitted).

### Win/Loss Analysis
A chart comparing won vs lost opportunities over time. Includes win rate percentage and trends.

### Leaderboard
Ranks team members by a selected metric — leads converted, deals closed, revenue generated, or tasks completed. Displays as a ranked list with avatar, name, and score.

![Screenshot: Team leaderboard widget showing ranked sales reps with deal counts](../../static/img/screenshots/dashboard/widget-leaderboard.png)

### Team Activity
A timeline or bar chart showing recent activity volume across your team — emails sent, calls made, tasks completed, and notes added.

### Lead Aging
Shows how long leads have been sitting in each stage without advancing. Highlights stale leads that need attention. Color-coded by age bracket (green = fresh, yellow = aging, red = stale).

### Lead Sources
A pie or bar chart breaking down where your leads come from — web form, referral, advertisement, cold call, partner, etc.

### Upcoming Tasks
A table listing your upcoming tasks sorted by due date, with type, priority, and linked entity.

### Deals Closing
Shows opportunities expected to close within a selected timeframe. Includes deal name, amount, probability, and expected close date.

### Effort vs Result
Compares activity effort (calls, emails, meetings) against outcomes (conversions, revenue) to identify high-performing strategies and team members.

### Conversion Funnel
Tracks overall conversion rates from lead to opportunity to deal, showing where the biggest drop-offs occur.

### Recent Activity
A live feed of the most recent actions across your CRM — new records created, stage changes, emails sent, tasks completed.

### Stuck Deals
Highlights opportunities that have not progressed in a configurable number of days. Helps managers identify deals needing intervention.

### Account Forecast
Forecasts revenue by account, showing expected incoming revenue from active opportunities grouped by account.

### Target Leaderboard
Compares team members' progress against their assigned targets. Displays as progress bars or a ranked table with percentage-to-target.

![Screenshot: Target leaderboard widget showing progress bars for each team member](../../static/img/screenshots/dashboard/widget-target-leaderboard.png)

## Understanding Widget Data

Each widget pulls data based on:

- **Your permissions** — you only see data you have access to
- **Dashboard scope filter** — My Data, My Team, or All Data
- **Dashboard date filter** — the selected time period
- **Widget-specific configuration** — individual settings like pipeline selection or metric type

:::info
Widgets update in real time as data changes in the CRM. There is no need to manually refresh.
:::

## Widget Drill-Down

Many chart widgets support **drill-down interaction**:

- **Click a bar** in a bar chart to filter and see the underlying records.
- **Click a slice** in a pie chart to drill into that segment.
- **Click a funnel stage** to view the records at that stage.

Drill-down opens a filtered view of the relevant module, so you can take immediate action on the data you see.

:::tip
Use drill-down to quickly move from high-level metrics to actionable record lists. For example, click the "Stale Leads" segment in Lead Aging to see exactly which leads need follow-up.
:::

For instructions on adding, arranging, and configuring widgets, see [Dashboard Customization](./dashboard-customization.md).
