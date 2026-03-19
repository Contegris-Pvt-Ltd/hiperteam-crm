---
sidebar_position: 18
title: Projects API
---

# Projects API

## Project Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects` | List projects (query: statusId, ownerId, search, page, limit) |
| GET | `/projects/:id` | Full project with phases, tasks, members |
| POST | `/projects` | Create project |
| POST | `/projects/from-opportunity` | Create from opportunity + template |
| PUT | `/projects/:id` | Update project |
| DELETE | `/projects/:id` | Delete project |
| GET | `/projects/:id/kanban` | Kanban view |
| GET | `/projects/:id/gantt` | Gantt timeline data |

## Team & Members

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/members` | List members |
| POST | `/projects/:id/members` | Add member |
| DELETE | `/projects/:id/members/:memberId` | Remove member |

## Tasks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/projects/:id/tasks` | Create task |
| PUT | `/projects/:id/tasks/:taskId` | Update task |
| DELETE | `/projects/:id/tasks/:taskId` | Delete task |

## Dependencies

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks/:taskId/dependencies` | Get dependencies |
| POST | `/projects/:id/tasks/:taskId/dependencies` | Add dependency |
| DELETE | `/projects/:id/tasks/:taskId/dependencies/:depId` | Remove |

## Time Tracking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/projects/:id/tasks/:taskId/time` | Log time entry |
| GET | `/projects/:id/time-report` | Time report by user |

## Client Portal

| Method | Endpoint | Description |
|---|---|---|
| POST | `/projects/:id/portal-token` | Generate portal link |
| GET | `/portal/:tenantSlug/:token` | Public portal view (no auth) |

## Admin

| Method | Endpoint | Description |
|---|---|---|
| POST/PATCH/DELETE | `/projects/admin/project-statuses/:id` | Manage statuses |
| POST/PATCH/DELETE | `/projects/admin/task-statuses/:id` | Manage task statuses |
| POST/PATCH/DELETE | `/projects/admin/templates/:id` | Manage templates |
| PUT | `/projects/admin/templates/:id/structure` | Update template phases + tasks |

## Health Statuses

`on_track`, `at_risk`, `off_track`
