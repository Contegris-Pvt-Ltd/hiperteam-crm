---
sidebar_position: 33
title: "Managing Projects"
description: "Navigate project views, manage phases and tasks, use the Gantt chart, Kanban board, client portal, and track time."
---

# Managing Projects

This chapter covers the detailed management of projects including views, phases, tasks, dependencies, Gantt charts, Kanban boards, team management, time tracking, and the client portal.

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
- Linked opportunity (if applicable)
- Milestones with status

### Phases/Tasks

The structured breakdown of the project into **phases** and **tasks**.

**Phases** are major milestones or stages of the project (e.g., "Planning," "Development," "Testing," "Launch").

Each phase contains:
- Phase name and description
- Start and end dates
- Status
- Tasks assigned to that phase
- Progress percentage

**Tasks** within phases:
- Can be created, edited, and completed inline
- Support assignees, due dates, and priorities
- Support **subtasks** for breaking down complex work items
- Show dependency indicators when linked to other tasks
- Are the same task entities used throughout the CRM

**Subtasks:**
- Click a task to expand and view its subtasks
- Add subtasks with their own assignee, due date, and status
- Subtask completion contributes to the parent task's progress

To add a phase:
1. Click **Add Phase**.
2. Enter the phase name, dates, and description.
3. Click **Save**.

To add a task to a phase:
1. Click **Add Task** within the phase.
2. Fill in task details (title, assignee, due date, priority).
3. Click **Save**.

To add a subtask:
1. Click a task to open it.
2. Click **Add Subtask**.
3. Enter the subtask details.
4. Click **Save**.

![Screenshot: Project phases and tasks view showing collapsible phases with nested tasks](../../static/img/screenshots/projects/phases-tasks.png)

### Task Dependencies

Set up dependencies between tasks to define execution order:

1. Open a task within a project.
2. In the task detail, click **Add Dependency**.
3. Select the task that must be completed first.
4. The dependency is created as **Finish-to-Start** (the dependent task cannot start until the predecessor finishes).

Dependencies are visualized in the Gantt chart as connecting arrow lines between task bars.

:::warning
Circular dependencies (A depends on B, B depends on A) are not allowed. The system validates dependency chains when you add them.
:::

### Kanban View

A board-style view with tasks organized by status:

- Columns represent task statuses (To Do, In Progress, In Review, Done, etc.)
- **Drag and drop** tasks between columns to change their status
- Each card shows task title, assignee avatar, due date, and priority
- Filter by phase, assignee, or priority

![Screenshot: Project Kanban board with tasks organized by status columns](../../static/img/screenshots/projects/project-kanban.png)

:::tip
Use the Kanban view for daily standups and sprint management. It provides the quickest way to see what everyone is working on and move tasks through the workflow.
:::

### Gantt Chart

A visual timeline showing phases and tasks as horizontal bars on a time axis:

- **Phases** appear as summary bars spanning their date range
- **Tasks** appear as bars within their phase
- **Dependencies** are shown as connecting arrow lines between tasks
- **Milestones** appear as diamond markers at their target date
- **Today marker** — a vertical line indicating the current date
- **Drag to adjust** — resize bars to change dates
- **Zoom levels** — day, week, month views

![Screenshot: Gantt chart view showing phases as summary bars with tasks and dependency lines](../../static/img/screenshots/projects/gantt-chart.png)

:::tip
Use the Gantt chart during project planning and status meetings. It provides the best visual representation of timelines, overlaps, and dependencies.
:::

### Team

Manage the project team:

- **View team members** — see all assigned users with their project roles
- **Add members** — search and add CRM users to the project
- **Set roles** — assign project roles (Project Manager, Developer, Designer, QA, etc.)
- **Remove members** — remove users from the project team

| Role | Description |
|---|---|
| **Project Manager** | Overall project ownership and coordination |
| **Developer** | Technical implementation |
| **Designer** | UI/UX and visual design |
| **QA** | Quality assurance and testing |
| **Consultant** | Advisory or specialist role |
| **Custom** | Any other role defined by the team |

### Time Tracking

Log and view time entries for project tasks:

#### Logging Time

1. Open a task within the project.
2. Click **Log Time**.
3. Enter:
   - **Hours** — time spent (decimal, e.g., 1.5 for 90 minutes)
   - **Date** — when the work was performed
   - **Description** — brief note about what was done
   - **Billable** — toggle whether this time is billable to the client
4. Click **Save**.

#### Viewing Time Entries

- **Per Task** — each task shows total logged hours
- **Per Phase** — phases aggregate time from all their tasks
- **Project Total** — the overview shows total hours logged and total billable hours
- **By Team Member** — see how hours are distributed across team members

:::note
Billable time entries can be used when generating invoices. The total billable hours help calculate project profitability and can be included on client invoices.
:::

### Documents

Upload and manage project-related files — specifications, designs, contracts, reports, deliverables, etc.

### Activity

A timeline of all project activity — phase completions, task updates, team changes, time entries, and document uploads. See [Activity Timeline](./activity-timeline.md).

## Client Portal

The client portal provides external stakeholders with read-only access to project progress without requiring a CRM account.

### How It Works

1. Open a project.
2. Go to **Settings** or **Client Portal** tab.
3. Enable the client portal.
4. A unique **token-based URL** is generated:
   ```
   https://yourdomain.com/portal/{tenant-slug}/{project-token}
   ```
5. Share this URL with your client.

### Client Portal Permissions

The portal provides controlled access — clients can see:

| Feature | Visible |
|---|---|
| Project overview and progress | Yes |
| Phase names and status | Yes |
| Task list and completion status | Yes |
| Milestones | Yes |
| Documents (shared) | Yes |
| Team member names | Yes |
| Internal notes and comments | No |
| Time tracking details | No |
| Financial data | No |
| Other projects | No |

:::warning
The client portal URL contains a security token. Anyone with the link can access the portal. Regenerate the token if you need to revoke access.
:::

### Client Portal View

The portal displays:
- **Project name and description**
- **Overall progress** bar and health status
- **Phases** with completion percentage
- **Milestones** with dates and status
- **Shared documents** available for download
- **Team members** with names and roles

## Linked Opportunities

If the project was created from an opportunity:

- A link to the **source opportunity** appears on the project overview
- Click the link to navigate to the opportunity detail page
- Revenue and deal data from the opportunity is accessible in context

:::note
Linking projects to opportunities provides end-to-end visibility from deal to delivery. Reports can track revenue from sale through project completion.
:::

## Milestones Management

Milestones mark key checkpoints in the project lifecycle:

1. Open the project.
2. Go to the **Overview** or **Milestones** section.
3. Click **Add Milestone**.
4. Enter:
   - **Name** — milestone title (e.g., "Phase 1 Delivery," "Client Sign-off")
   - **Date** — target completion date
5. Click **Save**.

### Milestone Statuses

| Status | Description |
|---|---|
| **Pending** | Milestone has not been reached yet |
| **Completed** | Milestone has been achieved |
| **Overdue** | Target date has passed without completion |

Milestones appear in the Gantt chart as diamond markers and on the project overview for quick status checking.
