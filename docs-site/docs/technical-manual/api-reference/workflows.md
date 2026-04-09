---
sidebar_position: 14
title: Workflows API
---

# Workflows API

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/workflows` | List workflows (optional ?module filter) |
| GET | `/workflows/:id` | Get workflow with actions |
| POST | `/workflows` | Create workflow |
| PUT | `/workflows/:id` | Update workflow |
| PATCH | `/workflows/:id/toggle` | Enable/disable workflow |
| DELETE | `/workflows/:id` | Delete workflow |
| GET | `/workflows/:id/runs?page=&limit=` | Run history |
| GET | `/workflows/runs/:runId` | Run detail with steps |

## Workflow Object

```json
{
  "id": "uuid",
  "name": "Auto-assign new leads",
  "description": "Round-robin assignment for inbound leads",
  "triggerModule": "leads",
  "triggerType": "lead_created",
  "triggerFilters": {
    "logic": "AND",
    "conditions": [
      { "field": "source", "operator": "equals", "value": "website" }
    ]
  },
  "isActive": true,
  "version": 1,
  "actions": [
    {
      "id": "uuid",
      "actionType": "assign_owner",
      "config": { "algorithm": "round_robin", "userIds": ["uuid1", "uuid2"] },
      "sortOrder": 1
    }
  ]
}
```

## Trigger Events

### Leads
`lead_created`, `lead_updated`, `lead_stage_changed`, `lead_score_changed`, `lead_converted`, `lead_assigned`

### Contacts
`contact_created`, `contact_updated`, `contact_assigned`

### Accounts
`account_created`, `account_updated`, `account_assigned`

### Opportunities
`opportunity_created`, `opportunity_updated`, `opportunity_stage_changed`, `opportunity_won`, `opportunity_lost`, `opportunity_assigned`

### Tasks
`task_created`, `task_updated`, `task_overdue`, `task_completed`

### Projects
`project_created`, `project_updated`, `project_status_changed`, `project_task_overdue`, `project_completed`

## Action Types

| Type | Description |
|---|---|
| assign_owner | Auto-assign record owner |
| create_task | Create follow-up task |
| update_field | Update entity field |
| add_tag | Add tag to record |
| send_notification | In-app notification |
| send_email | Send email |
| send_whatsapp | Send WhatsApp via Twilio |
| send_sms | Send SMS via Twilio |
| webhook | Call external API |
| wait | Delay before next action |
| branch | If/else conditional split |
| create_opportunity | Create opportunity from lead |
| create_project | Create project from opportunity |
| add_to_email_list | Subscribe contacts to email marketing list |
| remove_from_email_list | Remove contacts from email marketing list |

## Condition Operators

`equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `is_empty`, `is_not_empty`, `greater_than`, `less_than`, `greater_or_equal`, `less_or_equal`, `in`, `not_in`, `changed_to`, `changed_from`, `any_change`

## Variable Interpolation

Use `{{trigger.fieldName}}` in action configs to reference the trigger entity's fields. Both snake_case and camelCase are supported.

## Action Config Reference

### assign_owner

```json
{
  "algorithm": "round_robin",
  "pool": ["userId1", "userId2", "userId3"],
  "weights": [{"userId": "userId1", "weight": 2}]
}
```

Algorithms: `round_robin`, `weighted`, `load_based`, `territory`, `skill_match`, `sticky`

### create_task

```json
{
  "title": "Follow up with {{trigger.firstName}}",
  "description": "...",
  "assignedTo": "owner",
  "dueOffsetDays": 3,
  "startOffsetDays": 0,
  "estimatedMinutes": 30,
  "tags": "follow-up, workflow"
}
```

`assignedTo` values: `owner` (default), `trigger_user`, `specific` (with `specificUserId`)

### webhook

```json
{
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "bodyType": "json",
  "bodyJson": "{\"leadId\": \"{{trigger.id}}\"}",
  "headers": [{"key": "Authorization", "value": "Bearer xxx", "enabled": true}],
  "params": [{"key": "source", "value": "crm", "enabled": true}],
  "verifySsl": true,
  "timeoutSeconds": 30
}
```

### send_email / send_whatsapp / send_sms

```json
{
  "to": "record_email",
  "subject": "Welcome {{trigger.firstName}}",
  "body": "<p>Hello {{trigger.firstName}},</p>",
  "cc": "manager@example.com",
  "bcc": ""
}
```

`to` values: `record_email`/`record_phone`, `owner_email`/`owner_phone`, or a literal address/number

### branch

```json
{
  "condition": {
    "match": "all",
    "items": [
      {"field": "score", "operator": "greater_than", "value": "80"}
    ]
  }
}
```

Child actions use `parentActionId` + `branch: "yes"` or `branch: "no"`.

### add_to_email_list / remove_from_email_list

```json
{
  "listId": "uuid",
  "listName": "Newsletter",
  "contactSelector": "primary"
}
```

`contactSelector` values: `primary`, `all`, `owner`

## Run History Endpoints

### GET `/workflows/:id/runs`

Query params: `page` (default 1), `limit` (default 25)

Response:
```json
{
  "data": [{
    "id": "uuid",
    "workflowId": "uuid",
    "triggerModule": "leads",
    "triggerType": "lead_created",
    "triggerEntityId": "uuid",
    "status": "completed",
    "error": null,
    "startedAt": "ISO",
    "finishedAt": "ISO"
  }],
  "total": 42,
  "page": 1,
  "limit": 25
}
```

### GET `/workflows/runs/:runId`

Response includes `steps` array:
```json
{
  "id": "uuid",
  "status": "completed",
  "steps": [{
    "id": "uuid",
    "actionType": "assign_owner",
    "status": "completed",
    "result": {"assignedUserId": "uuid"},
    "error": null,
    "startedAt": "ISO",
    "finishedAt": "ISO"
  }]
}
```
