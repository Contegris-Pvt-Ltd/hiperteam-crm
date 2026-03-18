---
sidebar_position: 40
title: "Report Builder"
description: "Create custom reports by selecting data sources, fields, filters, groupings, chart types, and configurations."
---

# Report Builder

The Report Builder is a visual tool for creating custom reports. You select a data source, choose fields, apply filters, set groupings, and pick a chart type — all without writing any code.

## Creating a New Report

1. Navigate to **Reports**.
2. Click **+ New Report**.
3. The Report Builder opens with a step-by-step workflow.

![Screenshot: Report Builder interface showing data source, fields, filters, and chart preview](../../static/img/screenshots/reports/report-builder.png)

## Selecting Data Source

Choose the primary data source for your report:

| Data Source | Contains |
|---|---|
| **Leads** | All lead records with fields, stages, scores |
| **Opportunities** | All opportunity records with amounts, stages, probabilities |
| **Contacts** | Contact records with demographics and activity |
| **Accounts** | Organization records with types, industries, revenue |
| **Activities** | Activity log entries — calls, emails, meetings |
| **Tasks** | Task records with types, statuses, durations |
| **Products** | Product catalog data |
| **Invoices** | Invoice records with amounts and payment status |

:::info
The data source determines which fields are available for selection, filtering, and grouping. Choose the source that contains the primary data you want to analyze.
:::

## Selecting Fields

After choosing a data source, select which fields to include in your report:

1. Browse available fields in the **field selector panel**.
2. Click a field to add it to the report.
3. Rearrange fields by dragging them in the selected fields list.
4. Remove fields by clicking the "x" next to them.

Fields include both standard and custom fields for the selected data source.

## Building Filters

Filters narrow down the data included in the report:

1. Click **Add Filter**.
2. Select a **field** to filter on.
3. Choose an **operator** (equals, contains, greater than, less than, between, is empty, etc.).
4. Enter the **value** to filter by.
5. Add more filters as needed.

### Combining Filters
- **AND** — all filters must match
- **OR** — at least one filter must match
- You can nest filter groups for complex logic

**Example filters:**
- Stage equals "Negotiation"
- Amount greater than $10,000
- Created date in the last 30 days
- Owner equals "Jane Smith"

![Screenshot: Filter builder showing multiple conditions with AND/OR logic](../../static/img/screenshots/reports/report-filters.png)

## Grouping Data

Grouping aggregates records by a field:

1. Click **Add Grouping**.
2. Select the field to group by (e.g., Stage, Owner, Source, Month).
3. The report data will be aggregated by the selected grouping.
4. You can add **multiple grouping levels** for nested breakdowns.

**Example:** Group by "Stage" then by "Owner" to see how many deals each person has at each stage.

## Sorting

Configure how the report data is sorted:

1. Select the **sort field** (any field in the report).
2. Choose **ascending** or **descending** order.
3. Add secondary sort fields as needed.

## Chart Type Selection

Choose how to visualize your data:

| Chart Type | Best For |
|---|---|
| **Bar** | Comparing categories (leads by source, deals by stage) |
| **Line** | Showing trends over time (monthly revenue, weekly leads) |
| **Pie** | Showing proportions (lead source distribution) |
| **Table** | Detailed data rows with columns |
| **Funnel** | Conversion stages (lead-to-opportunity funnel) |
| **Scatter** | Correlations between two metrics |
| **Gauge** | Single metric against a target |

:::tip
Choose a chart type that matches the story you want to tell. Use bar charts for comparisons, line charts for trends, pie charts for breakdowns, and tables for detailed data export.
:::

## Chart Configuration

Customize the chart appearance:

- **Colors** — pick custom colors for chart segments, bars, or lines
- **Labels** — toggle data labels on/off, configure format
- **Axes** — customize axis labels, scales, and formatting
- **Legend** — show/hide legend, position it
- **Title** — set the chart title displayed on the report

## Preview and Save

1. Click **Preview** to see the report with current data.
2. Review the visualization and data accuracy.
3. Adjust settings if needed.
4. Enter a **report name** and optionally a description.
5. Select a **folder** to save the report in.
6. Click **Save**.

Your report is now available in your **My Reports** section and can be shared, exported, or scheduled.

![Screenshot: Report preview showing a bar chart with data labels and legend](../../static/img/screenshots/reports/report-preview.png)
