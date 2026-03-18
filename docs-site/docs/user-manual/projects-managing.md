---
sidebar_position: 33
title: "Managing Projects"
description: "Navigate project views, manage phases and tasks, use the Gantt chart, manage teams, and track linked opportunities."
---

# Managing Projects

This chapter covers the detailed management of projects including views, phases, tasks, Gantt charts, team management, and linked data.

## Grid/List View Toggle

The Projects module offers two layout options for browsing projects:

- **Grid View** — projects displayed as visual cards in a grid layout, showing status, health color, team avatars, and date range
- **List View** — projects displayed in a data table with sortable columns

Toggle between views using the **view switcher** buttons at the top of the page.

![Screenshot: Projects grid view showing project cards with status, health, and team indicators](../../static/img/screenshots/projects/projects-grid-list.png)

## Project Cards

In grid view, each project card displays:
- **Project name** and color tag
- **Status badge** (Not Started, In Progress, On Hold, etc.)
- **Health indicator** (On Track, At Risk, Off Track)
- **Team member avatars** (first few members)
- **Start and end dates**
- **Progress percentage** (based on completed tasks/phases)

## Project Detail Page

Click a project to open its detail page, which contains the following tabs:

### Overview
A summary panel showing:
- Project description and objectives
- Key dates (start, end, duration)
- Status and health
- Progress bar
- Key metrics (total tasks, completed tasks, overdue tasks)

### Phases/Tasks
The structured breakdown of the project into **phases** and **tasks**:

**Phases** are major milestones or stages of the project (e.g., "Planning," "Development," "Testing," "Launch").

Each phase contains:
- Phase name and description
- Start and end dates
- Status
- Tasks assigned to that phase

**Tasks** within phases:
- Can be created, edited, and completed inline
- Support assignees, due dates, and priorities
- Are the same task entities used throughout the CRM

To add a phase:
1. Click **Add Phase**.
2. Enter the phase name, dates, and description.
3. Click **Save**.

To add a task to a phase:
1. Click **Add Task** within the phase.
2. Fill in task details.
3. Click **Save**.

![Screenshot: Project phases and tasks view showing collapsible phases with nested tasks](../../static/img/screenshots/projects/phases-tasks.png)

### Gantt Chart
A visual timeline showing phases and tasks as horizontal bars on a time axis:

- **Phases** appear as summary bars spanning their date range
- **Tasks** appear as bars within their phase
- **Dependencies** are shown as connecting lines between tasks
- **Today marker** — a vertical line indicating the current date
- **Drag to adjust** — resize bars to change dates

:::tip
Use the Gantt chart during project planning and status meetings. It provides the best visual representation of timelines, overlaps, and dependencies.
:::

![Screenshot: Gantt chart view showing phases as summary bars with tasks and dependency lines](../../static/img/screenshots/projects/gantt-chart.png)

### Team
Manage the project team:

- **View team members** — see all assigned users with their roles
- **Add members** — search and add CRM users to the project
- **Set roles** — assign project roles (Project Manager, Developer, Designer, etc.)
- **Remove members** — remove users from the project team

### Documents
Upload and manage project-related files — specifications, designs, contracts, reports, etc.

### Activity
A timeline of all project activity — phase completions, task updates, team changes, and document uploads. See [Activity Timeline](./activity-timeline.md).

## Linked Opportunities

If the project was created from an opportunity:

- A link to the **source opportunity** appears on the project overview
- Click the link to navigate to the opportunity detail page
- Revenue and deal data from the opportunity is accessible in context

:::note
Linking projects to opportunities provides end-to-end visibility from deal to delivery. Reports can track revenue from sale through project completion.
:::
