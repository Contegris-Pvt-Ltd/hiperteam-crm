---
sidebar_position: 13
title: "Page Designer"
description: "Use the Page Designer in Intellicon CRM to control field layout, section grouping, and form structure on record detail pages with drag-and-drop."
---

# Page Designer

The Page Designer gives administrators full control over how record detail pages look for each module. You can rearrange fields, group them into sections, toggle visibility, and configure collapse states — all through a visual drag-and-drop interface.

## Page Designer Overview

Navigate to **Admin > Page Designer**.

![Screenshot: Page Designer interface](../../static/img/screenshots/admin/page-designer.png)

The Page Designer has three main areas:

1. **Module selector** — choose which module's layout to edit
2. **Layout canvas** — the drag-and-drop area showing the current layout
3. **Field palette** — available fields that can be added to the layout

## Selecting a Module

Use the dropdown at the top to select the module you want to design. Each module has its own independent layout configuration.

Available modules: Contacts, Accounts, Leads, Opportunities, Deals, Tasks, Projects.

## Drag-and-Drop Field Ordering

To reorder fields within a section:

1. Hover over a field in the layout canvas.
2. Grab the **drag handle** (grip icon) on the left side.
3. Drag the field to its new position.
4. Release to drop it in place.
5. The layout auto-saves or click **Save Layout** to persist.

Fields can be arranged in a **single column** or **two-column grid** layout depending on the section configuration.

![Screenshot: Dragging a field to reorder](../../static/img/screenshots/admin/page-designer-drag.png)

## Creating Sections

Sections group related fields together with a header and optional collapse behavior.

1. Click **Add Section** on the layout canvas.
2. Enter the section **name** (e.g., "Contact Information", "Financial Details", "Custom Data").
3. Choose the **column layout**: 1-column or 2-column.
4. Drag fields from other sections or the field palette into the new section.
5. Save.

:::tip
Use sections to organize fields logically. Common patterns:
- **Basic Information** — name, email, phone, company
- **Address** — street, city, state, postal code, country
- **Financial** — revenue, budget, currency
- **Custom Fields** — all custom fields in one section
:::

## Configuring Section Collapse State

Each section can be configured as:

| State | Behavior |
|-------|----------|
| **Expanded** (default) | Section is open when the page loads |
| **Collapsed** | Section is closed by default; users click to expand |
| **Always Expanded** | Section cannot be collapsed |

To configure:
1. Click the **gear icon** on the section header.
2. Select the collapse behavior.
3. Save.

:::info
Collapsible sections improve the user experience on records with many fields. Keep the most important fields in expanded sections and secondary data in collapsed ones.
:::

## Field Visibility Toggle

Each field on the layout canvas has a **visibility toggle** (eye icon):

- **Visible** (eye open) — the field appears on the detail page
- **Hidden** (eye closed) — the field is removed from the layout

Hidden fields are moved to the field palette so they can be re-added later.

:::warning
Hiding a field in the Page Designer is different from [field permissions](./field-permissions.md). Page Designer hiding applies to **all users** regardless of role. Field permissions hide fields **per role**. Use Page Designer for fields you want to remove from the layout entirely.
:::

## Required Field Marking

Fields marked as required (via [Field Validation](./field-validation.md)) display a red asterisk (*) in the layout. The Page Designer shows this indicator so you can see at a glance which fields are mandatory.

You cannot change the required status from the Page Designer — manage that in [Field Validation](./field-validation.md).

## Layout Preview

Click **Preview** to see how the layout will appear to end users:

- The preview renders the actual form layout with sample data.
- Switch between **Create Form**, **Edit Form**, and **Detail View** modes.
- Test the layout at different screen sizes (desktop, tablet, mobile).

![Screenshot: Page designer preview mode](../../static/img/screenshots/admin/page-designer-preview.png)

## Impact on Detail Pages

The Page Designer layout affects:

- **Detail pages** — the main record view uses the designed layout
- **Create forms** — new record forms follow the same section and field order
- **Edit forms** — editing an existing record uses the same layout
- **Quick view** — popup previews use a condensed version of the layout

## Best Practices

1. **Put critical fields first** — the most important fields should be at the top, in the first section.
2. **Use 2-column layout for short fields** — name and email side by side. Use 1-column for long fields like description and rich text.
3. **Collapse secondary sections** — financial details, custom fields, and audit information can be collapsed by default.
4. **Group logically** — keep related fields together (all address fields in one section, all financial fields in another).
5. **Test the layout** — use preview mode and also log in as a regular user to verify the experience.
6. **Keep it clean** — hide fields that are rarely used. Users can always ask an admin to show them if needed.

---

Next: [Custom Tabs & Groups](./custom-tabs-groups.md) — Add custom tabs and field groupings to detail pages.
