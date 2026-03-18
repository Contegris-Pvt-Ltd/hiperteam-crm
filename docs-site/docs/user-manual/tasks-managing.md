---
sidebar_position: 30
title: "Managing Tasks"
description: "Create, edit, complete, reopen, and manage tasks including subtasks, notes, attachments, and time tracking."
---

# Managing Tasks

This chapter covers the day-to-day operations for working with tasks — creating them, updating their progress, tracking time, and completing them.

## Creating Tasks

### From the Tasks Module

1. Navigate to **Tasks** in the sidebar.
2. Click **+ New Task**.
3. Fill in the task form:
   - **Title** (required) — a clear description of the action
   - **Type** — Call, Email, Meeting, Follow-up, Demo, etc.
   - **Status** — defaults to "Not Started"
   - **Priority** — Urgent, High, Medium, or Low
   - **Assignee** — who will do this task
   - **Due Date and Time** — when it needs to be completed
   - **Description** — additional details and context
   - **Linked Entity** — optionally link to a Lead, Opportunity, Contact, Account, or Project
   - **Estimated Minutes** — planned effort
4. Click **Save**.

![Screenshot: New task creation form with type, priority, assignee, and due date fields](../../static/img/screenshots/tasks/create-task.png)

### Quick Create Modal

From any entity detail page (Lead, Opportunity, Contact, etc.):

1. Go to the **Tasks** tab.
2. Click **+ Add Task** or **+ New Task**.
3. A modal form opens with the entity pre-linked.
4. Fill in the task details and save.

The task is automatically linked to the entity you created it from.

:::tip
Use quick create from entity detail pages whenever possible. It ensures the task is properly linked, and you do not need to navigate away from the record you are working on.
:::

## Editing Tasks

1. Click a task in any view (list, Kanban, calendar) to open it.
2. Click **Edit** or directly modify fields inline (where supported).
3. Update any fields — title, status, priority, assignee, due date, description, etc.
4. Click **Save**.

## Completing Tasks

To mark a task as complete:

1. Open the task.
2. Click **Mark Complete** (or change status to "Completed").
3. Optionally enter a **result** — a summary of the outcome (e.g., "Client agreed to a follow-up meeting next Tuesday").
4. The task moves to the "Completed" status.

From the list view, you can also click the **checkbox** on a task row for a quick completion.

:::note
When completing a task, consider adding a result note. This creates a valuable record of outcomes that shows up in activity timelines on linked entities.
:::

## Reopening Completed Tasks

If a completed task needs to be revisited:

1. Open the completed task.
2. Click **Reopen** or change the status back to "Not Started" or "In Progress".
3. The task returns to your active task list.

## Creating Subtasks

Subtasks break down a task into smaller checklist items:

1. Open a task.
2. Scroll to the **Subtasks** section.
3. Click **Add Subtask**.
4. Enter a title for the subtask.
5. Press Enter or click the add button.
6. Repeat for additional subtasks.

To complete a subtask, click its **checkbox**. The parent task shows progress (e.g., "3/5 complete").

![Screenshot: Task detail showing subtask checklist with some items checked off](../../static/img/screenshots/tasks/subtasks.png)

## Adding Notes to Tasks

1. Open the task.
2. Scroll to the **Notes** section.
3. Click **Add Note**.
4. Type your note content.
5. Click **Save**.

Notes are timestamped and attributed to the user who wrote them. They appear in chronological order.

## File Attachments

To attach files to a task:

1. Open the task.
2. Scroll to the **Attachments** or **Documents** section.
3. Click **Upload** or drag and drop files.
4. Files are uploaded and listed with name, size, and upload date.

Supported file types include documents, images, spreadsheets, and PDFs.

## Time Tracking

Tasks support time tracking through two fields:

| Field | Description |
|---|---|
| **Estimated Minutes** | How long you think the task will take (set at creation) |
| **Actual Minutes** | How long the task actually took (set at completion) |

To track time:
1. When creating or editing a task, set the **Estimated Minutes**.
2. When completing the task, enter the **Actual Minutes**.
3. Reports can compare estimated vs actual time across tasks and team members.

:::tip
Consistent time tracking helps managers identify tasks that regularly exceed estimates, improve future planning, and understand where the team spends its time.
:::

## Deleting Tasks

1. Open the task or find it in the list view.
2. Click the **actions menu** (three dots).
3. Select **Delete**.
4. Confirm the deletion.

:::warning
Deleted tasks are soft-deleted and hidden from normal views. The deletion is recorded in the activity timeline of any linked entity.
:::
