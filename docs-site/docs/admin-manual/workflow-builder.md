---
sidebar_position: 26
title: "Workflow Builder"
description: "Create automated workflows in IntelliSales CRM — configure triggers, conditions, and actions to automate email, task creation, field changes, and more."
---

# Workflow Builder

The Workflow Builder allows you to automate repetitive business processes without writing code. Workflows follow a trigger-condition-action pattern: when something happens (trigger), if certain criteria are met (conditions), then perform specific actions automatically.

Navigate to **Admin > Workflows**.

![Screenshot: Workflow builder overview](../../static/img/screenshots/admin/workflow-builder.png)

## Workflow Automation Overview

A workflow consists of three components:

```
TRIGGER (When...)  →  CONDITIONS (If...)  →  ACTIONS (Then...)
```

**Example:** When a lead is created (trigger), if the source is "Website Demo" and company size > 100 (conditions), then assign to Enterprise Team and send a welcome email (actions).

## Creating a Workflow

1. Click **Create Workflow**.
2. Enter a **name** — e.g., "Auto-assign Enterprise Leads", "Deal Close Follow-up".
3. Add an optional **description**.
4. The visual builder opens with three sections: Trigger, Conditions, Actions.

![Screenshot: Workflow visual builder](../../static/img/screenshots/admin/workflow-visual-builder.png)

## Trigger Selection

Triggers define **when** the workflow fires.

### Module Selection

Select the module that triggers the workflow:

- Leads
- Contacts
- Accounts
- Opportunities
- Tasks
- Projects

### Event Selection

| Event | Fires When |
|-------|------------|
| **Created** | A new record is created in the module |
| **Updated** | An existing record is modified |
| **Stage Changed** | A record moves to a different pipeline stage |
| **Deleted** | A record is soft-deleted |

### Trigger Configuration

You can further narrow the trigger:

- **Stage Changed to** — specify which stage(s) trigger the workflow (e.g., only "Closed Won")
- **Field Changed** — trigger only when a specific field is modified
- **Created by** — trigger only for records created by specific roles or users

:::info
A workflow can have only **one trigger**. If you need multiple triggers, create separate workflows for each.
:::

## Condition Builder

Conditions filter which records the workflow applies to. Only records matching **all** conditions will trigger the actions.

### Adding Conditions

1. Click **Add Condition** in the Conditions section.
2. Configure:
   - **Field** — select any field from the trigger module
   - **Operator** — equals, not equals, contains, greater than, less than, is empty, is not empty, in list
   - **Value** — the comparison value
3. Add multiple conditions — they are combined with **AND** logic by default.

### Condition Groups

For complex logic, create condition groups with **OR** between groups:

```
(Source = "Website" AND Company Size > 100)
OR
(Source = "Referral" AND Priority = "High")
```

### Example Conditions

| Field | Operator | Value | Purpose |
|-------|----------|-------|---------|
| Source | Equals | "Website Demo" | Only website demo leads |
| Amount | Greater than | 50000 | High-value opportunities only |
| Priority | In list | "High, Critical" | Urgent items only |
| Owner | Is empty | — | Unassigned records only |

## Action Configuration

Actions define **what happens** when the trigger fires and conditions are met. Multiple actions can be chained in sequence.

### Send Email

Send an automated email using a template.

- **Template** — select from existing [notification templates](./notification-templates.md) or create inline
- **Recipients** — record owner, assigned user, specific email address, or role-based
- **Delay** — optional delay before sending (e.g., "Send 1 hour after trigger")

### Create Task

Automatically create a follow-up task.

- **Task Name** — e.g., "Follow up with \{\{entity_name\}\}"
- **Type** — select from configured [task types](./task-settings.md)
- **Assignee** — record owner, specific user, or role-based
- **Due Date** — relative to trigger date (e.g., "+3 days")
- **Priority** — set the task priority
- **Description** — task details with template variables

### Change Field Value

Automatically update a field on the record.

- **Field** — select the field to change
- **Value** — the new value (static or formula-based)

**Examples:**
- Set "Status" to "Qualified" when score exceeds threshold
- Set "Follow-up Date" to "today + 7 days"
- Set "Priority" to "High" when amount > $100K

### Move to Stage

Advance the record to a specific pipeline stage.

- **Target Stage** — the stage to move to
- **Validate stage fields** — whether to enforce stage field requirements

### Assign Owner

Change the record's owner.

- **Assignment type** — specific user, round-robin within team, role-based
- **Team** — for round-robin assignment
- **Notify new owner** — send assignment notification

### Send Notification

Send an in-app notification or push notification.

- **Recipients** — record owner, team members, managers, specific users
- **Message** — notification text with template variables
- **Channel** — in-app, push, or both

### Call Webhook

Make an HTTP request to an external service.

- **URL** — the endpoint to call
- **Method** — GET, POST, PUT, DELETE
- **Headers** — custom headers (e.g., Authorization)
- **Payload** — JSON body with template variables

![Screenshot: Webhook action configuration](../../static/img/screenshots/admin/workflow-webhook.png)

:::tip
Use webhooks to integrate with external systems that do not have native integrations. For example, post a message to Slack when a deal closes, or update an external ERP system when a project starts.
:::

## Testing Workflows

### Preview / Dry Run

1. Click **Test Workflow**.
2. Select an existing record to test against.
3. The system evaluates the trigger and conditions without executing actions.
4. Review the test results: which conditions matched, which actions would fire.

:::warning
Test workflows thoroughly before activating. A misconfigured workflow can send unintended emails, create duplicate tasks, or modify records incorrectly.
:::

## Activating and Pausing

- **Active** — the workflow fires on matching events in real time.
- **Paused** — the workflow exists but does not fire. Useful for maintenance or troubleshooting.
- **Draft** — the workflow is being built and has never been activated.

Toggle the status using the **Active/Pause** switch on the workflow list or detail page.

## Workflow Runs Monitoring

Track workflow execution history:

1. Open a workflow.
2. Switch to the **Runs** tab.
3. View execution history with:
   - **Status** — Success, Failed, Pending
   - **Triggered by** — the record and event that triggered the run
   - **Timestamp** — when the workflow ran
   - **Duration** — how long execution took
   - **Actions executed** — which actions completed
   - **Error details** — for failed runs, the error message and stack trace

### Retrying Failed Runs

1. Find a failed run in the list.
2. Click **Retry**.
3. The workflow re-executes the actions against the same record.

![Screenshot: Workflow runs monitoring](../../static/img/screenshots/admin/workflow-runs.png)

## Best Practices

1. **Start simple** — build workflows with one trigger, one condition, and one action. Add complexity gradually.
2. **Name descriptively** — "Auto-assign high-value leads to enterprise team" is better than "Workflow 1".
3. **Test before activating** — always dry-run with real records.
4. **Monitor regularly** — check the Runs tab weekly for failures.
5. **Avoid loops** — do not create workflows that trigger each other (e.g., Workflow A updates a field, which triggers Workflow B, which updates the same field, triggering Workflow A again).
6. **Document your workflows** — maintain a list of active workflows with their purpose and owner.
7. **Use delays wisely** — a 1-hour delay on a follow-up email feels natural. An instant automated response can feel robotic.

:::danger Common Mistakes
- Creating workflows that fire on every update — this can cause thousands of unnecessary executions. Use specific field-change triggers.
- Not testing webhook URLs — a wrong URL silently fails.
- Assigning tasks to deactivated users — the task is created but no one sees it.
:::

---

Next: [Approval Rules](./approval-rules.md) — Set up approval chains for deals and discounts.
