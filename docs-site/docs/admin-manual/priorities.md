---
sidebar_position: 17
title: "Priorities"
description: "Manage priority levels in IntelliSales CRM — configure icons, colors, and default priorities for leads and opportunities."
---

# Priority Management

Priorities help users quickly identify the urgency of leads, opportunities, and other records. Each priority level has a name, icon, and color that provide visual cues across list views, kanban boards, and detail pages.

## Priority Management Overview

Priorities are configured in the relevant module settings:

- **Admin > Lead Settings > Priorities tab**
- **Admin > Opportunity Settings > Priorities tab**

![Screenshot: Priority management page](../../static/img/screenshots/admin/priorities-page.png)

## Creating Priorities

1. Navigate to the module's settings and select the **Priorities** tab.
2. Click **Add Priority**.
3. Configure the priority:
   - **Name** (required) — e.g., "Urgent", "High", "Medium", "Low", "None"
   - **Icon** — select from the available icon set
   - **Color** — select a color for visual identification
   - **Order** — position in the priority list (1 = highest)
4. Click **Save**.

## Available Icons

| Icon | Name | Typical Use |
|------|------|-------------|
| 🔥 Flame | `flame` | Urgent / Critical — needs immediate attention |
| 🌡️ Thermometer | `thermometer` | High — important, act soon |
| ☀️ Sun | `sun` | Medium — standard priority |
| ❄️ Snowflake | `snowflake` | Low — handle when possible |
| ➖ Minus | `minus` | None — no priority assigned |

:::tip
Use the standard icon set consistently across modules. Users quickly learn to associate "flame = urgent" and "snowflake = low priority" without reading the text.
:::

## Setting the Default Priority

One priority can be set as the **default**. When users create a new record without explicitly selecting a priority, the default is applied.

1. Open the priority you want to set as default.
2. Toggle the **Default** switch on.
3. Save.

:::info
A sensible default is "Medium" or "None". Setting "Urgent" as the default defeats the purpose of prioritization — everything would start as urgent.
:::

## Editing Priorities

1. Click on a priority in the list.
2. Modify the name, icon, color, or order.
3. Click **Save**.

:::warning
Renaming a priority (e.g., "High" to "Critical") will update the display name everywhere. Existing records retain the updated name. Ensure the new name is communicated to your team.
:::

## Deleting Priorities

1. Click the **Delete** button on a priority.
2. If records use this priority, you will be prompted to select a **replacement priority**.
3. Confirm the deletion.

:::danger
Deleting a priority reassigns all records using it to the replacement priority you choose. This change is permanent and logged in the [audit trail](./audit-logs.md).
:::

## Impact on List Views and Cards

Priorities appear in several places across the UI:

| Surface | Display |
|---------|---------|
| **List views** | Priority column shows the icon and color |
| **Kanban boards** | Cards display the priority icon in the corner |
| **Detail pages** | Priority badge near the record title |
| **Filters** | Filter by priority in any list view |
| **Reports** | Group by or filter by priority |

![Screenshot: Priority icons in a list view](../../static/img/screenshots/admin/priorities-in-list.png)

## Best Practices

1. **Keep it simple** — 4-5 priority levels is optimal. More than that creates decision fatigue.
2. **Use distinct colors** — red for urgent, orange for high, yellow for medium, blue for low, gray for none.
3. **Train your team** — define what each priority means in concrete terms (e.g., "Urgent = respond within 1 hour").
4. **Set a neutral default** — "Medium" or "None" prevents priority inflation.
5. **Review priority distribution** — if 80% of records are "Urgent", the priority system is not being used correctly.

---

Next: [Lead Settings](./lead-settings.md) — Configure lead scoring, routing, qualification, and more.
