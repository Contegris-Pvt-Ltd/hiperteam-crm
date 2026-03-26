---
sidebar_position: 25
title: "Notification Templates"
description: "Customize notification message templates in IntelliSales CRM — use template variables, edit email/SMS/in-app templates, preview, and test delivery."
---

# Notification Templates

Notification templates control the content and formatting of messages sent through each [notification channel](./notification-settings.md). Templates use variable substitution to personalize messages with record-specific data.

Navigate to **Admin > Notification Settings > Templates** tab.

![Screenshot: Notification templates list](../../static/img/screenshots/admin/notification-templates.png)

## Template System Overview

Each event type has templates for each enabled channel:

```
Event: task_assigned
├── Email Template (subject + HTML body)
├── SMS Template (plain text, 160 char limit)
├── In-App Template (short text)
└── Browser Push Template (title + body)
```

Templates use **double-brace variables** that are replaced with actual values at send time.

## Template Variables

Variables are enclosed in `\{\{double_braces\}\}` and are replaced with real data when the notification is sent.

### Common Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `\{\{user_name\}\}` | The recipient's full name | "Jane Smith" |
| `\{\{user_first_name\}\}` | The recipient's first name | "Jane" |
| `\{\{actor_name\}\}` | The person who triggered the event | "Tom Wilson" |
| `\{\{entity_name\}\}` | The record's name/title | "Acme Corp Deal" |
| `\{\{entity_type\}\}` | The module name | "Opportunity" |
| `\{\{entity_id\}\}` | The record's unique ID | "abc-123-def" |
| `\{\{entity_url\}\}` | Direct link to the record | "https://crm.example.com/opportunities/abc-123" |
| `\{\{stage_name\}\}` | Pipeline stage name | "Negotiation" |
| `\{\{old_stage_name\}\}` | Previous stage name | "Proposal" |
| `\{\{assigned_to\}\}` | The assignee's name | "Jane Smith" |
| `\{\{due_date\}\}` | Task due date | "March 25, 2026" |
| `\{\{amount\}\}` | Deal/opportunity amount | "$50,000" |
| `\{\{company_name\}\}` | Your organization's name | "Acme Corp" |
| `\{\{current_date\}\}` | Today's date | "March 18, 2026" |

### Event-Specific Variables

| Event | Additional Variables |
|-------|---------------------|
| `deal_closed_won` | `\{\{amount\}\}`, `\{\{close_reason\}\}`, `\{\{sales_cycle_days\}\}` |
| `task_due_soon` | `\{\{due_date\}\}`, `\{\{hours_remaining\}\}` |
| `approval_requested` | `\{\{approval_type\}\}`, `\{\{requested_by\}\}`, `\{\{approval_url\}\}` |
| `target_milestone` | `\{\{target_name\}\}`, `\{\{percentage\}\}`, `\{\{current_value\}\}`, `\{\{target_value\}\}` |

## Editing Email Templates

Email templates have two parts: **subject line** and **HTML body**.

1. Click on an event's email template.
2. Edit the **Subject**:
   ```
   [\{\{company_name\}\}] Task assigned: \{\{entity_name\}\}
   ```
3. Edit the **Body** using the rich text editor or HTML mode:
   ```html
   <p>Hi \{\{user_first_name\}\},</p>
   <p>\{\{actor_name\}\} has assigned you a new task:</p>
   <ul>
     <li><strong>Task:</strong> \{\{entity_name\}\}</li>
     <li><strong>Due Date:</strong> \{\{due_date\}\}</li>
   </ul>
   <p><a href="\{\{entity_url\}\}">View Task</a></p>
   ```
4. Click **Save**.

![Screenshot: Email template editor](../../static/img/screenshots/admin/email-template-editor.png)

:::tip
Keep email subjects concise (under 60 characters) and include the most important information. The subject line determines whether the recipient opens the email.
:::

## Editing SMS Templates

SMS templates are plain text with a recommended limit of 160 characters.

1. Click on an event's SMS template.
2. Edit the message:
   ```
   \{\{actor_name\}\} assigned you a task: "\{\{entity_name\}\}" due \{\{due_date\}\}. View: \{\{entity_url\}\}
   ```
3. A character counter shows the current length.
4. Click **Save**.

:::warning
SMS messages over 160 characters are split into multiple segments, increasing cost. Keep SMS templates concise. Use abbreviations if needed, but ensure the message is still clear.
:::

## Editing In-App Notification Templates

In-app templates appear in the notification dropdown within the application.

1. Click on an event's in-app template.
2. Edit the message:
   ```
   \{\{actor_name\}\} assigned you task "\{\{entity_name\}\}"
   ```
3. In-app notifications support **bold** and **links** but not full HTML.
4. Click **Save**.

## Editing Browser Push Templates

Browser push templates have a **title** and **body**:

1. Click on an event's push template.
2. Edit the **Title**: `New Task Assigned`
3. Edit the **Body**: `\{\{entity_name\}\} - due \{\{due_date\}\}`
4. Push notifications are limited to approximately 120 characters in the body.
5. Click **Save**.

## Preview and Testing

### Preview

1. Click **Preview** on any template.
2. The preview shows the template with sample data substituted for variables.
3. Review the formatting and content.

### Send Test Notification

1. Click **Send Test**.
2. Select the **channel** to test (email, SMS, in-app, push).
3. Select a **recipient** (yourself or another admin).
4. The test notification is sent with sample data.
5. Verify delivery and formatting.

![Screenshot: Template preview with sample data](../../static/img/screenshots/admin/template-preview.png)

:::info
Always send a test notification after editing a template. This catches formatting issues, broken variables, and delivery problems before real notifications go out.
:::

## Best Practices

1. **Personalize with names** — `"Hi \{\{user_first_name\}\}"` is more engaging than a generic greeting.
2. **Include a call to action** — every notification should tell the user what to do next (e.g., "View Task", "Review Deal").
3. **Keep it concise** — users scan notifications quickly. Lead with the most important information.
4. **Test all variables** — if a variable returns empty (e.g., no due date set), ensure the template still reads naturally.
5. **Match tone to channel** — emails can be more formal; SMS and push should be brief and direct.
6. **Include the entity link** — `\{\{entity_url\}\}` lets users jump directly to the relevant record.
7. **Review templates after field changes** — if you rename fields or stages, update templates that reference them.

:::danger Common Mistakes
- Using a variable that does not exist for the event type — it will render as blank or `\{\{variable_name\}\}` literally.
- Making SMS templates too long — causes multi-segment charges.
- Forgetting to save after editing — changes are not auto-saved.
:::

---

Next: [Workflow Builder](./workflow-builder.md) — Automate business processes with visual workflows.
