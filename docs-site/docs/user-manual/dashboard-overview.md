---
sidebar_position: 5
title: "Dashboard Overview"
description: "Understand the Intellicon CRM dashboard, manage tabs, apply filters, and share dashboards with your team."
---

# Dashboard Overview

The Dashboard is your home screen in Intellicon CRM. It provides a real-time, at-a-glance view of your key metrics, pipeline health, team performance, and upcoming activities — all in customizable, widget-based layouts.

## What is the Dashboard

The dashboard is a configurable workspace where you arrange **widgets** — scorecards, charts, tables, and metrics — to monitor the data that matters most to your role. Sales reps might focus on lead conversion and upcoming tasks, while managers may track pipeline value and team leaderboards.

![Screenshot: Dashboard with multiple widgets showing KPIs, charts, and activity feeds](../../static/img/screenshots/dashboard/dashboard-main.png)

## Dashboard Tabs (Multi-Dashboard Support)

Intellicon CRM supports **multiple dashboard tabs**, allowing you to create separate dashboards for different purposes.

- Each tab is an independent dashboard with its own set of widgets.
- Tabs appear as a horizontal tab bar at the top of the dashboard area.
- Click any tab name to switch between dashboards.

**Example use cases:**
- **Sales Overview** — pipeline funnel, win/loss ratio, forecast
- **My Day** — upcoming tasks, recent leads, activity feed
- **Team Performance** — leaderboard, targets, effort vs result

## Creating a New Dashboard Tab

1. Click the **"+"** button at the end of the tab bar.
2. Enter a **name** for the new dashboard.
3. Click **Create**.
4. The new tab opens with an empty canvas ready for widgets.

## Renaming and Deleting Tabs

- **Rename:** Right-click (or click the tab options menu) on a tab name, select **Rename**, type the new name, and press Enter.
- **Delete:** Click the tab options menu, select **Delete**, and confirm. This permanently removes the tab and all its widgets.

:::warning
Deleting a dashboard tab cannot be undone. All widgets on that tab will be permanently removed.
:::

## Tab-Level Filters

Each dashboard tab has global filters that affect all widgets on that tab:

### Date Range
Select a time period to filter data across all widgets:
- **Today**, **This Week**, **This Month**, **This Quarter**, **This Year**
- **Custom Range** — pick specific start and end dates

### Data Scope
Control whose data appears in the widgets:
- **My Data** — only records assigned to you
- **My Team** — records assigned to you and your team members
- **All Data** — all records you have permission to view

:::tip
Use "My Data" for personal productivity dashboards and "All Data" for management overview dashboards.
:::

![Screenshot: Dashboard filter bar showing date range picker and data scope selector](../../static/img/screenshots/dashboard/dashboard-filters.png)

## Importing and Exporting Dashboards

### Exporting
To save a dashboard configuration for backup or sharing:

1. Click the **Export** button on the dashboard toolbar.
2. Select **Export as JSON**.
3. A `.json` file will download containing all widget configurations for the current tab.

### Importing
To load a previously exported dashboard:

1. Click the **Import** button on the dashboard toolbar.
2. Select a `.json` dashboard file from your computer.
3. The widgets from the file will be loaded into the current tab.

:::note
Importing a dashboard replaces the current tab's widgets. Create a new tab first if you want to preserve your existing layout.
:::

## Sharing Dashboards

Dashboards can be shared with your team:

1. Click the **Share** button on the dashboard toolbar.
2. A **public URL** is generated for the dashboard.
3. Share this URL with team members or stakeholders.

Shared dashboards display in read-only mode and update in real time.

![Screenshot: Share dashboard modal showing the public URL and copy button](../../static/img/screenshots/dashboard/dashboard-share.png)

For information on adding and configuring individual widgets, see [Dashboard Widgets](./dashboard-widgets.md) and [Dashboard Customization](./dashboard-customization.md).
