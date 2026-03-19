---
sidebar_position: 15
title: Approvals API
---

# Approvals API

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/approvals/pending?page=&limit=` | Get pending approval requests |
| GET | `/approvals/requests/:requestId` | Get single request |
| GET | `/approvals/entity/:entityType/:entityId` | Get approvals for entity |
| POST | `/approvals/requests/:requestId/approve` | Approve with optional comment |
| POST | `/approvals/requests/:requestId/reject` | Reject with required comment |
| POST | `/approvals/requests/:requestId/cancel` | Cancel request |
| GET | `/approvals/rules` | List rules (optional ?entityType) |
| GET | `/approvals/rules/:ruleId` | Get rule |
| POST | `/approvals/rules` | Create rule |
| PUT | `/approvals/rules/:ruleId` | Update rule |
| DELETE | `/approvals/rules/:ruleId` | Delete rule |

## Approval Rule

```json
{
  "id": "uuid",
  "name": "Manager approval for large deals",
  "entityType": "opportunities",
  "triggerEvent": "close_won",
  "conditions": {},
  "isActive": true,
  "priority": 1,
  "steps": [
    { "stepOrder": 1, "approverType": "role", "approverRoleId": "uuid" },
    { "stepOrder": 2, "approverType": "user", "approverUserId": "uuid" }
  ]
}
```

## Trigger Events

`publish`, `close_won`, `discount_threshold`, `manual`, `project_created`, `project_completed`, `budget_exceeded`

## Entity Types

`proposals`, `opportunities`, `deals`, `leads`, `projects`, `custom`

## Request Statuses

`pending`, `approved`, `rejected`, `cancelled`
