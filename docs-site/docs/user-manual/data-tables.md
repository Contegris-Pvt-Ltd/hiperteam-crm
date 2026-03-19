---
sidebar_position: 50
title: "Data Tables"
description: "Learn how to use data tables across HiperTeam CRM — sorting, filtering, column customization, pagination, and more."
---

# Data Tables

Data tables are the primary way you interact with lists of records across HiperTeam CRM. Whether you're viewing contacts, leads, opportunities, or tasks, the table experience is consistent and powerful.

![Screenshot: Data table showing leads with column headers, sorting, and pagination](../../static/img/screenshots/shared/data-table-overview.png)

## Column Configuration

### Showing and Hiding Columns

Every data table allows you to choose which columns are visible:

1. Click the **Columns** button (grid icon) above the table
2. A modal appears listing all available columns
3. Toggle columns on or off using the checkboxes
4. Click **Apply** to save your selection

![Screenshot: Column configuration modal with toggles](../../static/img/screenshots/shared/column-config-modal.png)

:::tip
Your column preferences are saved per module — so your Leads table configuration won't affect your Contacts table.
:::

### Resizing Columns

To adjust column width:

1. Hover over the right edge of any column header
2. Your cursor changes to a resize handle
3. Click and drag left or right to resize
4. Release to set the new width

Column widths are automatically saved to your preferences.

## Sorting

Click any column header to sort by that column:

- **First click**: Sort ascending (A→Z, 0→9, oldest→newest)
- **Second click**: Sort descending (Z→A, 9→0, newest→oldest)
- **Third click**: Clear sort

A small arrow icon indicates the active sort column and direction.

:::note
Only one column can be sorted at a time. Clicking a different column header replaces the current sort.
:::

## Pagination

Tables display records in pages to keep things fast and manageable.

### Page Navigation

- Use the **Previous** and **Next** buttons at the bottom of the table
- The current page number and total pages are displayed between the buttons
- Total record count is shown (e.g., "Showing 1–20 of 347 results")

### Page Size

Change how many records appear per page:

1. Look for the page size selector at the bottom of the table
2. Choose from available options (typically 10, 20, 50, or 100)
3. The table refreshes immediately with the new page size

:::tip
Use a smaller page size (10–20) for quick scanning. Use larger sizes (50–100) when you need to review many records at once or before exporting.
:::

## Row Actions

Each row has an actions menu on the right side:

1. Hover over a row to reveal the **actions button** (three dots or icons)
2. Click to see available actions (View, Edit, Delete, etc.)
3. Available actions depend on your permissions

![Screenshot: Row actions menu showing View, Edit, Delete options](../../static/img/screenshots/shared/row-actions-menu.png)

## Row Selection

Many tables support selecting multiple rows for [bulk operations](./bulk-operations):

1. Click the **checkbox** on the left side of any row to select it
2. Click the **header checkbox** to select all rows on the current page
3. Selected row count appears above the table
4. Bulk action buttons appear when rows are selected

## Search and Filtering

### Quick Search

Most tables have a **search bar** above the table:

- Type to search across key fields (name, email, phone, etc.)
- Results update as you type (with a small debounce delay)
- Clear the search field to show all records again

### Column Filters

Some tables support per-column filtering:

1. Look for a **filter icon** on column headers
2. Click to open a column-specific filter
3. Enter filter criteria (text match, date range, select options)
4. Active filters are indicated with a highlighted icon

## Loading and Empty States

- **Loading**: While data is being fetched, skeleton rows animate to indicate progress
- **Empty**: When no records match your filters (or the module has no data), a helpful empty state message appears with guidance on how to create your first record

## Column Width Persistence

Your table preferences (visible columns, column widths, sort order, page size) are automatically saved per module. When you return to the same table later, your preferences are restored.

:::info
Preferences are stored per user per module. Other users won't be affected by your column customizations.
:::

## Best Practices

- **Customize columns early** — hide columns you don't need to reduce visual clutter
- **Use sorting** to quickly find records (e.g., sort by "Created Date" descending to see newest first)
- **Combine search + sort** for fast lookups
- **Adjust page size** based on your workflow — fewer rows for quick scanning, more for bulk review
