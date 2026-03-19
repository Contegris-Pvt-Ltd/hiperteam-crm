---
sidebar_position: 7
title: "Dashboard Customization"
description: "Learn how to add, configure, arrange, resize, and export dashboard widgets to build your ideal workspace."
---

# Dashboard Customization

HiperTeam CRM dashboards are fully customizable. You control which widgets appear, where they sit, and how large they are — creating a workspace that matches your workflow exactly.

## Edit Mode

Dashboards have two modes:

- **View mode** (default) — widgets display data; layout is locked
- **Edit mode** — widgets can be added, moved, resized, and deleted

To toggle edit mode, click the **Edit** button in the dashboard toolbar. When you are done, click **Done** to lock the layout.

![Screenshot: Dashboard toolbar showing Edit/Done toggle button](../../static/img/screenshots/dashboard/edit-mode-toggle.png)

## Adding Widgets

1. Enter **Edit mode** by clicking **Edit**.
2. Click the **Add Widget** button.
3. A widget catalog panel opens, listing all available widget types grouped by category.
4. Click a widget type to add it to the dashboard.
5. The new widget appears on the canvas, ready to be configured and positioned.

:::tip
Browse the widget catalog to discover new visualizations. Each widget has a brief description to help you understand what data it shows.
:::

## Configuring Widget Settings

After adding a widget (or by clicking the **gear icon** on an existing widget in edit mode):

1. A **settings panel** opens for that widget.
2. Configure options such as:
   - **Title** — the display name shown on the widget header
   - **Data source** — which module or metric to pull data from
   - **Pipeline** — select a specific pipeline (for pipeline-related widgets)
   - **Chart type** — switch between bar, line, pie, etc. (where applicable)
   - **Color scheme** — customize chart colors
   - **Font size** — adjust text size for scorecards
   - **Time period** — override the dashboard-level date filter for this widget
3. Click **Save** or **Apply** to confirm your settings.

![Screenshot: Widget configuration panel with title, data source, and chart type options](../../static/img/screenshots/dashboard/widget-settings.png)

## Drag-and-Drop Positioning

In edit mode, widgets can be freely repositioned:

1. **Click and hold** the widget header (or drag handle).
2. **Drag** the widget to its new position on the grid.
3. **Release** to drop it in place.

The dashboard uses a **12-column grid system** with free-form placement. Widgets snap to grid positions for clean alignment.

:::note
Widgets will not overlap. If you drag a widget over another, the other widgets shift to make room.
:::

## Resizing Widgets

To resize a widget in edit mode:

1. Hover over the **bottom-right corner** of the widget until you see the resize cursor.
2. **Click and drag** to make the widget larger or smaller.
3. Release to set the new size.

Widgets have minimum size constraints to ensure their content remains readable.

## Duplicating Widgets

To create a copy of an existing widget (including its configuration):

1. In edit mode, click the **options menu** (three dots) on the widget header.
2. Select **Duplicate**.
3. A copy of the widget appears on the canvas with identical settings.
4. Modify the duplicate's settings as needed.

:::tip
Duplicating is useful when you want the same widget type with slightly different filters — for example, two pipeline funnels for different pipelines.
:::

## Deleting Widgets

To remove a widget:

1. In edit mode, click the **options menu** (three dots) on the widget header.
2. Select **Delete**.
3. Confirm the deletion if prompted.

:::warning
Deleting a widget removes it and its configuration permanently. If you want it back, you will need to add and configure it again from scratch.
:::

## Exporting the Dashboard

You can export your dashboard in several formats:

### JSON Export
Exports the dashboard layout and widget configuration as a JSON file. Useful for backup or sharing configurations with colleagues.

1. Click the **Export** button in the dashboard toolbar.
2. Select **JSON**.
3. The file downloads automatically.

### PNG Image Export
Captures a screenshot of your current dashboard as an image.

1. Click the **Export** button.
2. Select **PNG**.
3. The image downloads automatically.

### PDF Export
Generates a PDF document of your dashboard, suitable for printing or emailing as a report.

1. Click the **Export** button.
2. Select **PDF**.
3. The PDF downloads automatically.

![Screenshot: Export dropdown menu showing JSON, PNG, and PDF options](../../static/img/screenshots/dashboard/export-options.png)

:::info
Exported images and PDFs capture the dashboard as it currently appears, including any active filters. Adjust your filters before exporting to get the exact data snapshot you need.
:::

For details on available widget types and what data they show, see [Dashboard Widgets](./dashboard-widgets.md).
