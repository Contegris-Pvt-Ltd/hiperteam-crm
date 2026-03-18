---
sidebar_position: 7
title: "Tasks API"
description: "Complete endpoint reference for tasks, subtasks, lookups, settings, and entity-scoped tasks"
---

# Tasks API

Base path: `/tasks`

All endpoints require JWT authentication and `@RequirePermission('tasks', 'action')`.

## Lookups

Task types, statuses, and priorities are configurable. Each supports CRUD and reordering.

### Types

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks/lookups/types` | List task types |
| POST | `/tasks/lookups/types` | Create type |
| PUT | `/tasks/lookups/types/:id` | Update type |
| DELETE | `/tasks/lookups/types/:id` | Delete type |
| PUT | `/tasks/lookups/types/reorder` | Reorder types |

```json
// GET /tasks/lookups/types
[
  { "id": "type-uuid", "name": "Call", "color": "#3b82f6", "position": 1 },
  { "id": "type-uuid", "name": "Email", "color": "#10b981", "position": 2 },
  { "id": "type-uuid", "name": "Meeting", "color": "#f59e0b", "position": 3 },
  { "id": "type-uuid", "name": "Follow-up", "color": "#8b5cf6", "position": 4 }
]
```

### Statuses

| Method | Path |
|--------|------|
| GET | `/tasks/lookups/statuses` |
| POST | `/tasks/lookups/statuses` |
| PUT | `/tasks/lookups/statuses/:id` |
| DELETE | `/tasks/lookups/statuses/:id` |
| PUT | `/tasks/lookups/statuses/reorder` |

```json
[
  { "id": "status-uuid", "name": "Not Started", "color": "#6b7280", "position": 1, "isDefault": true },
  { "id": "status-uuid", "name": "In Progress", "color": "#3b82f6", "position": 2 },
  { "id": "status-uuid", "name": "Completed", "color": "#10b981", "position": 3, "isCompleted": true }
]
```

### Priorities

| Method | Path |
|--------|------|
| GET | `/tasks/lookups/priorities` |
| POST | `/tasks/lookups/priorities` |
| PUT | `/tasks/lookups/priorities/:id` |
| DELETE | `/tasks/lookups/priorities/:id` |
| PUT | `/tasks/lookups/priorities/reorder` |

## Settings

### GET /tasks/settings/:key

Get a task setting by key.

```json
{ "key": "default_due_days", "value": 7 }
```

### PUT /tasks/settings/:key

Update a task setting. Requires `@AdminOnly()`.

```json
{ "value": 14 }
```

## Dashboard Widgets

### GET /tasks/dashboard/upcoming

Get upcoming tasks for the current user.

```bash
GET /tasks/dashboard/upcoming?days=7&limit=10
```

```json
[
  {
    "id": "task-uuid",
    "title": "Follow up with Globex",
    "typeName": "Call",
    "priorityName": "High",
    "dueDate": "2025-01-22T09:00:00Z",
    "entityType": "leads",
    "entityId": "lead-uuid",
    "entityName": "Alice Johnson"
  }
]
```

### GET /tasks/dashboard/counts

```json
{
  "overdue": 3,
  "dueToday": 5,
  "dueThisWeek": 12,
  "completed": 45,
  "total": 65
}
```

## Entity Tasks

### GET /tasks/entity/:entityType/:entityId

Get all tasks linked to a specific entity.

```bash
GET /tasks/entity/leads/lead-uuid
```

```json
[
  {
    "id": "task-uuid",
    "title": "Send proposal",
    "typeName": "Email",
    "statusName": "In Progress",
    "priorityName": "High",
    "assignedTo": "user-uuid",
    "assignedToName": "John Doe",
    "dueDate": "2025-01-25T17:00:00Z",
    "createdAt": "2025-01-20T10:00:00Z"
  }
]
```

## Core CRUD

### POST /tasks

```json
{
  "title": "Send proposal to Globex",
  "description": "Include enterprise pricing and implementation timeline",
  "typeId": "type-uuid",
  "statusId": "status-uuid",
  "priorityId": "priority-uuid",
  "assignedTo": "user-uuid",
  "dueDate": "2025-01-25T17:00:00Z",
  "entityType": "opportunities",
  "entityId": "opp-uuid",
  "reminderAt": "2025-01-25T09:00:00Z"
}
```

### GET /tasks

```bash
GET /tasks?page=1&limit=25&statusId=uuid&priorityId=uuid&assignedTo=uuid&entityType=leads&overdue=true
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search in title and description |
| `statusId` | UUID | Filter by status |
| `priorityId` | UUID | Filter by priority |
| `typeId` | UUID | Filter by type |
| `assignedTo` | UUID | Filter by assigned user |
| `entityType` | string | Filter by linked entity type |
| `entityId` | UUID | Filter by linked entity |
| `overdue` | boolean | Only overdue tasks |
| `dueBefore` | date | Due before date |
| `dueAfter` | date | Due after date |

### GET /tasks/:id

### PUT /tasks/:id

### DELETE /tasks/:id

### POST /tasks/:id/complete

Mark a task as completed.

```json
{
  "completionNotes": "Proposal sent and acknowledged by client"
}
```

**Response:**

```json
{
  "id": "task-uuid",
  "title": "Send proposal to Globex",
  "statusName": "Completed",
  "completedAt": "2025-01-24T16:00:00Z",
  "completedBy": "user-uuid"
}
```

### POST /tasks/:id/reopen

Reopen a completed task.

## Subtasks

### GET /tasks/:id/subtasks

```json
[
  {
    "id": "subtask-uuid",
    "title": "Draft pricing section",
    "isCompleted": true,
    "completedAt": "2025-01-23T10:00:00Z"
  },
  {
    "id": "subtask-uuid",
    "title": "Get manager approval",
    "isCompleted": false,
    "completedAt": null
  }
]
```

### POST /tasks/:id/subtasks

```json
{
  "title": "Review proposal with legal team"
}
```

## Notes, Activities, History

- `GET /tasks/:id/notes`
- `POST /tasks/:id/notes`
- `GET /tasks/:id/activities`
- `GET /tasks/:id/history`
