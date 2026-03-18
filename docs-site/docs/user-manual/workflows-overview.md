---
sidebar_position: 42
title: "Workflows"
description: "Automate your business processes with trigger-based workflows — conditions, actions, execution history, and troubleshooting."
---

# Workflows

The **Workflows** module allows you to automate repetitive actions with trigger-based rules. When specific events occur in the CRM, workflows can automatically send emails, create tasks, update fields, reassign records, and more.

## What are Workflows?

A workflow is an automation rule consisting of:

1. **Trigger** — the event that starts the workflow (e.g., "Lead created" or "Opportunity stage changed")
2. **Conditions** — optional filters that determine whether the workflow should proceed (e.g., "only if lead source is 'Web Form'")
3. **Actions** — what happens when the trigger fires and conditions are met (e.g., "send welcome email and create follow-up task")

![Screenshot: Workflow list showing workflows with status, trigger type, and run count](../../static/img/screenshots/workflows/workflow-list.png)

## Workflow List

Navigate to **Workflows** in the sidebar to see all workflows displayed as a grid with:

- **Workflow name** — descriptive title
- **Status** — Active or Paused
- **Trigger** — the event that fires the workflow
- **Module** — which CRM module the workflow applies to
- **Run Count** — how many times the workflow has executed
- **Last Run** — when it last executed

## Workflow Builder

Click **+ New Workflow** or edit an existing one to open the visual workflow builder:

![Screenshot: Workflow builder with trigger, condition, and action nodes connected visually](../../static/img/screenshots/workflows/workflow-builder.png)

### Step 1: Define the Trigger

Select the module and event that starts the workflow:

| Module | Events |
|---|---|
| **Leads** | Created, Updated, Stage Changed, Converted, Disqualified |
| **Opportunities** | Created, Updated, Stage Changed, Closed Won, Closed Lost |
| **Contacts** | Created, Updated |
| **Accounts** | Created, Updated |
| **Tasks** | Created, Completed |
| **Invoices** | Created, Sent, Paid, Overdue |

### Step 2: Add Conditions (Optional)

Add if-then logic to filter when the workflow should run:

- **Field conditions** — "if Priority equals Urgent"
- **Value conditions** — "if Amount greater than $50,000"
- **Status conditions** — "if Source equals 'Web Form'"
- **AND/OR logic** — combine multiple conditions

:::tip
Use conditions to make workflows targeted. A workflow without conditions runs for every record that matches the trigger — which may not be what you want.
:::

### Step 3: Define Actions

Add one or more actions to execute when the trigger fires and conditions pass:

| Action | Description |
|---|---|
| **Send Email** | Send a templated email to specified recipients |
| **Create Task** | Automatically create a follow-up task |
| **Change Field** | Update a field value on the record |
| **Move Stage** | Advance or change the pipeline stage |
| **Assign Owner** | Reassign the record to a different user |
| **Send Notification** | Send an in-app notification to specified users |
| **Webhook** | Send an HTTP request to an external system |

Actions execute in sequence. You can add multiple actions to a single workflow.

## Activating and Pausing Workflows

- **Active** — the workflow is running and evaluates triggers in real time
- **Paused** — the workflow is saved but does not execute

Toggle between states using the **Active/Pause** switch on the workflow list or within the builder.

:::warning
Pause a workflow before making changes to it. Editing an active workflow could cause unexpected behavior during the brief editing period.
:::

## Workflow Runs (Execution History)

Every workflow execution is logged. To view the history:

1. Open a workflow.
2. Click the **Runs** or **History** tab.
3. See a list of every execution with:
   - **Timestamp** — when it ran
   - **Trigger record** — which record triggered it
   - **Status** — Success, Failed, or Skipped (conditions not met)
   - **Actions executed** — which actions ran
   - **Error details** — if the run failed, what went wrong

### Retry Failed Runs
If a workflow run failed (e.g., due to a temporary email delivery issue):
1. Open the failed run.
2. Review the error details.
3. Click **Retry** to re-execute the workflow for that record.

![Screenshot: Workflow execution history showing successful and failed runs with error details](../../static/img/screenshots/workflows/workflow-runs.png)

:::info
Workflow runs are retained for auditing and troubleshooting. Use the execution history to verify that automations are working correctly and to diagnose issues.
:::

### Best Practices

1. **Name workflows clearly** — use descriptive names like "Send welcome email on new web lead" instead of "Workflow 1"
2. **Use conditions** — avoid workflows that fire too broadly
3. **Test before activating** — create a test record to verify the workflow behaves as expected
4. **Monitor runs** — check execution history regularly, especially after creating new workflows
5. **Document complex workflows** — add descriptions explaining the business logic
