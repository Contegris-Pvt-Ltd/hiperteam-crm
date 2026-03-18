---
sidebar_position: 32
title: "Projects Overview"
description: "Understand the Projects module — create projects from scratch or from opportunities, manage statuses, health, and templates."
---

# Projects Overview

The **Projects** module helps you plan and execute work after a deal is closed. Projects provide structured management of phases, tasks, teams, timelines, and deliverables.

## Projects Module Overview

Projects in Intellicon CRM can be:

- Created **from scratch** for internal or standalone initiatives
- Created **from an opportunity** when closing a deal (maintaining the link to the original sale)
- Created **from a template** to standardize repeatable project types

![Screenshot: Projects module showing project cards in a grid layout](../../static/img/screenshots/projects/projects-grid.png)

## Creating Projects

### From Scratch
1. Navigate to **Projects** in the sidebar.
2. Click **+ New Project**.
3. Fill in the project form:
   - **Project Name** (required)
   - **Description** — overview of the project scope
   - **Start Date** and **End Date**
   - **Status** — initial project status
   - **Health** — initial health indicator
   - **Color** — a color tag for visual identification
   - **Owner** — project manager
4. Click **Save**.

### From an Opportunity
When closing an opportunity as Won, you can toggle **Create Project**. This:
- Automatically creates a project linked to the opportunity
- Carries over the opportunity name, account, and contacts
- Links the project to the revenue record

See [Closing Opportunities](./opportunities-closing.md) for details.

## Project Fields

| Field | Description |
|---|---|
| **Project Name** | Descriptive title for the project |
| **Description** | Scope and objectives |
| **Start Date** | When work begins |
| **End Date** | Target completion date |
| **Status** | Current project status |
| **Health** | Overall project health indicator |
| **Color** | Visual color tag |
| **Owner** | The project manager |
| **Linked Opportunity** | The opportunity that generated this project |

## Project Templates

Templates allow you to pre-define project structures that can be reused:

- A template includes **phases**, **default tasks**, and **team role definitions**
- When creating a project from a template, all pre-defined phases and tasks are automatically created
- Dates are calculated relative to the project start date

:::info
Project templates are configured by administrators under **Admin > Project Settings**. If you need a new template, request it from your admin.
:::

## Project Statuses and Health Indicators

### Statuses
- **Not Started** — project created but work has not begun
- **In Progress** — project is actively underway
- **On Hold** — project is paused
- **Completed** — all deliverables done
- **Cancelled** — project was terminated

### Health Indicators

| Health | Color | Meaning |
|---|---|---|
| **On Track** | Green | Project is progressing as planned |
| **At Risk** | Yellow/Amber | Some issues that may cause delays |
| **Off Track** | Red | Significant problems — deadlines or budget at risk |

:::tip
Update project health regularly (at least weekly) to keep stakeholders informed. Health indicators appear on project cards, dashboards, and reports.
:::

For managing projects in detail, see [Managing Projects](./projects-managing.md).
