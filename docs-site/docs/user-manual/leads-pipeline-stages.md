---
sidebar_position: 17
title: "Leads Pipeline & Stages"
description: "Understand pipelines, stages, stage movement, field requirements, stage ownership, and field visibility."
---

# Leads Pipeline & Stages

Pipelines and stages are the backbone of lead management in Intellicon CRM. They define the path a lead follows from initial entry to conversion or disqualification.

## Understanding Pipelines

A **pipeline** represents a distinct sales process. Your organization can have **multiple pipelines** to handle different types of leads — for example:

- **Inbound Sales Pipeline** — for web form and marketing leads
- **Outbound Sales Pipeline** — for cold outreach leads
- **Enterprise Pipeline** — for large, complex deals
- **Partner Pipeline** — for partner-referred leads

Each pipeline has its own set of ordered stages. You select the pipeline when creating a lead, and you can switch between pipelines using the pipeline selector on the list and Kanban views.

![Screenshot: Pipeline selector dropdown showing multiple pipeline options](../../static/img/screenshots/leads/pipeline-selector.png)

## Pipeline Stages

Stages are **ordered steps** within a pipeline that represent the progression of a lead. For example:

1. **New** — lead just entered the pipeline
2. **Contacted** — initial outreach made
3. **Discovery** — needs assessment in progress
4. **Proposal** — solution proposed to prospect
5. **Negotiation** — terms being discussed
6. **Qualified** — ready for conversion

:::info
Stage names and order are configured by your administrator under **Admin > Lead Settings**. The stages you see depend on your organization's sales methodology.
:::

## Moving Leads Between Stages

There are two ways to move a lead to a different stage:

### Drag-and-Drop (Kanban)
On the Kanban board, drag a lead card from one stage column to another. See [Leads List & Kanban](./leads-list-and-kanban.md).

### Manual Stage Change (Detail Page)
1. Open the lead detail page.
2. Click the target stage on the **Stage Journey Bar**, or use the stage dropdown.
3. If the target stage has required fields, a modal appears for you to fill them in.
4. Complete any required fields and confirm.

## Stage Field Requirements

Administrators can configure **required fields** for each stage. These are fields that must be filled in before a lead can enter or remain in that stage.

When you attempt to move a lead to a stage with required fields:

1. A **modal dialog** appears listing the required fields.
2. Fields that are already filled show a green checkmark.
3. Empty required fields are highlighted and editable in the modal.
4. Fill in all required fields and click **Save** to complete the move.

:::warning
If you close the modal without completing the required fields, the stage change is cancelled and the lead remains in its current stage.
:::

**Example:** Your "Qualified" stage might require:
- Budget amount
- Decision-maker identified (yes/no)
- Expected timeline
- Qualification notes

This ensures leads are not advanced prematurely and data quality remains high.

## Stage Ownership

Each pipeline stage can have a designated **stage owner** — a user, team, or role responsible for leads in that stage. Stage ownership determines:

- **Default assignment** — when a lead enters a stage, it can be automatically assigned to the stage owner
- **Visibility** — stage owners have guaranteed visibility of leads in their stage
- **Accountability** — managers can track who is responsible for each pipeline phase

Stage ownership types:
- **User** — a specific individual
- **Team** — all members of a team
- **Role** — all users with a specific role

:::note
Stage ownership is configured by administrators under **Admin > Lead Settings > Stage Ownership**. It works alongside regular lead ownership — the lead's primary owner may differ from the stage owner.
:::

## Field Visibility Per Stage

Administrators can configure **field visibility** on a per-stage basis. This controls which fields are visible, hidden, or read-only when a lead is in a particular stage.

Benefits:
- **Reduce clutter** — hide irrelevant fields in early stages
- **Guide the process** — show only the fields needed at each step
- **Protect data** — make fields read-only in later stages to prevent accidental changes

For example:
- In the "New" stage, show only basic contact information
- In the "Discovery" stage, reveal budget and requirements fields
- In the "Qualified" stage, show everything including scoring and conversion options

![Screenshot: Pipeline stages configuration showing stage order, owners, and field requirements](../../static/img/screenshots/leads/pipeline-stages-config.png)
