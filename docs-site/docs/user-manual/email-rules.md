---
sidebar_position: 38
title: "Email Rules"
description: "Create and manage inbox rules to automatically organize, tag, and route incoming emails."
---

# Email Rules

Email rules let you automate the handling of incoming emails. Rules evaluate conditions on each incoming message and perform actions automatically — such as moving emails to folders, marking them as read, or assigning them to CRM entities.

## Creating Inbox Rules

To create a new email rule:

1. Navigate to **Inbox > Settings** or **Inbox > Rules**.
2. Click **+ New Rule**.
3. Configure the rule with conditions and actions (see below).
4. Give the rule a **name** (e.g., "Auto-assign partner emails").
5. Click **Save**.

![Screenshot: Email rule creation form with condition and action fields](../../static/img/screenshots/email/create-email-rule.png)

## Rule Conditions

Conditions determine which emails the rule applies to. You can combine multiple conditions:

| Condition Type | Examples |
|---|---|
| **From** | Email is from a specific address or domain (e.g., `*@acme.com`) |
| **To** | Email was sent to a specific address |
| **Subject contains** | Subject line includes specific keywords |
| **Body contains** | Message body includes specific keywords |
| **Has attachments** | Email has file attachments |
| **Importance** | Email marked as high importance |

### Combining Conditions
- **All conditions** (AND) — the rule fires only when every condition matches
- **Any condition** (OR) — the rule fires when at least one condition matches

:::tip
Start with simple rules (one or two conditions) and refine them over time as you see how they perform. Overly complex rules can be hard to debug.
:::

## Rule Actions

Actions define what happens when the conditions are met:

| Action | Description |
|---|---|
| **Move to folder** | Move the email to a specific folder |
| **Mark as read** | Automatically mark the email as read |
| **Archive** | Move the email to the archive |
| **Star / Flag** | Star or flag the email for follow-up |
| **Assign to entity** | Link the email to a specific CRM record (lead, contact, opportunity) |
| **Add label** | Apply a label or tag to the email |

### Assign to Entity
This is a powerful action for CRM users:
- When an email arrives from a known contact, automatically link it to their lead or opportunity
- This ensures no customer communication gets lost
- The email appears on the entity's timeline

## Managing Rules

### Viewing Rules
Navigate to **Inbox > Rules** to see all your rules listed with:
- Rule name
- Conditions summary
- Actions summary
- Enabled/disabled status

### Enabling and Disabling
- Use the **toggle switch** next to each rule to enable or disable it
- Disabled rules are kept but not evaluated on incoming emails

### Reordering
- Rules are evaluated in order from top to bottom
- **Drag rules** to change their priority order
- The first matching rule's actions are applied

:::note
If multiple rules match the same email, all matching rules' actions are applied (unless a rule is configured to "stop processing more rules").
:::

### Editing Rules
1. Click a rule to open its settings.
2. Modify conditions or actions.
3. Click **Save**.

### Deleting Rules
1. Click the **delete icon** next to the rule.
2. Confirm the deletion.

![Screenshot: Email rules list showing enabled and disabled rules with drag handles for reordering](../../static/img/screenshots/email/email-rules-list.png)

:::warning
Be careful with rules that automatically move or archive emails. Important messages could be moved out of your primary inbox before you see them. Test new rules with non-critical emails first.
:::
