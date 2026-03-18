---
sidebar_position: 15
title: "Pipelines & Stages"
description: "Create and manage sales pipelines and stages in Intellicon CRM — configure stage ordering, required fields, and shared pipeline architecture."
---

# Pipelines & Stages

Pipelines are the backbone of your sales process in Intellicon CRM. They define the journey a record takes from initial contact to close. The pipeline system is **shared** between Leads, Opportunities, and other pipeline-enabled modules.

## Pipeline System Overview

A **pipeline** is a sequence of **stages** that represent the steps in a process:

```
New Lead → Contacted → Qualified → Proposal → Negotiation → Closed Won / Closed Lost
```

Key concepts:

- **Pipelines** are containers for stages. You can have multiple pipelines (e.g., "Inbound Sales", "Enterprise Sales", "Partner Channel").
- **Stages** are the individual steps within a pipeline.
- **Stage fields** are fields that must be filled before a record can advance to the next stage.
- The system is **shared** — the same pipeline tables support Leads, Opportunities, Deals, and Projects through a `module` column.

:::info
The pipeline system uses a `module` parameter to distinguish between pipeline types. When you configure pipelines for Leads, the API calls use `module=leads`. For Opportunities, it uses `module=opportunities`. The underlying architecture is the same.
:::

## Creating Pipelines

1. Navigate to the relevant settings page:
   - **Admin > Lead Settings > Pipelines tab** for lead pipelines
   - **Admin > Opportunity Settings > Pipelines tab** for opportunity pipelines
2. Click **Create Pipeline**.
3. Enter the pipeline **name** (e.g., "Standard Sales Process", "Enterprise Deal Flow").
4. Optionally, set it as the **default pipeline** for the module.
5. Click **Save**.

![Screenshot: Create pipeline dialog](../../static/img/screenshots/admin/create-pipeline.png)

## Setting the Default Pipeline

One pipeline per module can be marked as the **default**. When users create a new record, the default pipeline is pre-selected.

1. Open the pipeline you want to set as default.
2. Toggle the **Default** switch on.
3. The previous default is automatically unset.

:::tip
Keep one pipeline as default for the common sales flow. Create additional pipelines only for distinct processes (e.g., a separate pipeline for partner-sourced deals with different stages).
:::

## Managing Stages

### Creating a Stage

1. Open a pipeline.
2. Click **Add Stage**.
3. Configure the stage:
   - **Name** (required) — e.g., "Discovery", "Proposal Sent", "Negotiation"
   - **Color** — visual indicator on kanban boards and pipeline views
   - **Order** — position in the pipeline sequence
   - **Probability** (optional) — win probability percentage (used for forecasting)
   - **Description** (optional) — guidance for sales reps on what happens at this stage
4. Click **Save**.

### Reordering Stages

Drag and drop stages to change their order. The order determines the left-to-right (or top-to-bottom) display on kanban boards and pipeline views.

![Screenshot: Stage reordering with drag and drop](../../static/img/screenshots/admin/stage-reorder.png)

### Editing a Stage

Click on a stage name to open its settings. You can modify the name, color, probability, and description.

### Deleting a Stage

1. Click the **Delete** button on a stage.
2. If records exist at this stage, you will be prompted to select a **destination stage** to move them to.
3. Confirm the deletion.

:::danger
Deleting a stage with active records requires you to reassign those records. Ensure the destination stage makes sense for the records being moved. This action is logged in the [audit trail](./audit-logs.md).
:::

## Stage Fields (Required Before Advancing)

Stage fields enforce that specific information is collected before a record can move to the next stage. This ensures data quality throughout the pipeline.

### Configuring Stage Fields

1. Open a stage's settings.
2. Switch to the **Required Fields** tab.
3. Click **Add Required Field**.
4. Select fields from the module's field list (standard and custom).
5. For each field, optionally set:
   - **Required** — the field must have a value
   - **Validation rule** — additional validation specific to this stage
6. Save.

### Example: Stage Field Requirements

| Stage | Required Fields |
|-------|----------------|
| Discovery | Contact name, Company, Phone or Email |
| Qualification | Budget, Timeline, Decision Maker |
| Proposal | Proposal document (file upload), Amount |
| Negotiation | Discount %, Contract terms |
| Closed Won | Signed contract, Close date, Final amount |

:::warning
If a user tries to move a record to a stage with required fields that are not filled, the system will block the move and display a form to collect the missing information.
:::

## Pipeline Best Practices

1. **Keep pipelines to 5-8 stages** — too many stages slow down the process; too few do not capture the nuance.
2. **Define clear entry criteria** — use stage fields to enforce what information is needed at each step.
3. **Use probability for forecasting** — set realistic probabilities (e.g., Discovery: 10%, Proposal: 40%, Negotiation: 70%, Closed Won: 100%).
4. **Create separate pipelines for distinct processes** — do not force-fit different sales motions into one pipeline.
5. **Review pipeline metrics monthly** — look for bottleneck stages where deals stall.
6. **Train your team** — ensure everyone understands what each stage means and when to advance.

:::note
Pipeline changes (adding/removing stages, changing order) affect all existing records in that pipeline. Communicate changes to your team before implementing them.
:::

---

Next: [Stage Ownership](./stage-ownership.md) — Assign ownership and field visibility per stage.
