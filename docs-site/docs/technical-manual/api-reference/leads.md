---
sidebar_position: 5
title: "Leads API"
description: "Comprehensive endpoint reference for leads, pipeline management, scoring, SLA, conversion, and all lead settings"
---

# Leads API

The leads module is the largest in the system. It covers lead CRUD, pipeline stages, scoring, SLA tracking, conversion, and all lead settings.

## Core Lead Endpoints

Base path: `/leads`

### POST /leads

Create a new lead. Requires `@RequirePermission('leads', 'create')`.

```json
{
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice@startup.io",
  "phone": "+1234567890",
  "company": "StartupIO",
  "title": "Founder",
  "source": "website",
  "pipelineId": "pipeline-uuid",
  "stageId": "stage-uuid",
  "priority": "high",
  "estimatedValue": 50000,
  "description": "Inbound from pricing page",
  "customFields": {
    "utm_source": "google",
    "company_size": "50-100"
  }
}
```

**Response (201):**

```json
{
  "id": "lead-uuid",
  "firstName": "Alice",
  "lastName": "Johnson",
  "email": "alice@startup.io",
  "company": "StartupIO",
  "source": "website",
  "stageName": "New",
  "priority": "high",
  "estimatedValue": 50000,
  "score": 0,
  "createdBy": "user-uuid",
  "createdAt": "2025-01-20T10:00:00Z"
}
```

### GET /leads

List leads with filters. Requires `@RequirePermission('leads', 'view')`.

```bash
GET /leads?page=1&limit=25&search=alice&stageId=uuid&priority=high&source=website&pipelineId=uuid&assignedTo=uuid
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Name, email, company search |
| `stageId` | UUID | Filter by pipeline stage |
| `pipelineId` | UUID | Filter by pipeline |
| `priority` | string | `low`, `medium`, `high`, `critical` |
| `source` | string | Lead source filter |
| `assignedTo` | UUID | Filter by assigned user |
| `status` | string | `open`, `converted`, `disqualified` |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `sortBy` | string | Sort column |
| `sortDir` | string | `asc` or `desc` |

### GET /leads/:id

Get full lead details.

### PUT /leads/:id

Update a lead. Requires `@RequirePermission('leads', 'edit')`.

### DELETE /leads/:id

Soft-delete a lead. Requires `@RequirePermission('leads', 'delete')`.

### POST /leads/check-duplicates

Check for duplicate leads before creation.

```json
{ "email": "alice@startup.io", "phone": "+1234567890" }
```

**Response:**

```json
{
  "duplicates": [
    { "id": "existing-uuid", "firstName": "Alice", "lastName": "Johnson", "email": "alice@startup.io", "matchField": "email" }
  ]
}
```

### PUT /leads/bulk-update

Bulk update multiple leads. Requires `@RequirePermission('leads', 'edit')`.

```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "changes": { "assignedTo": "user-uuid", "priority": "high" }
}
```

### DELETE /leads/bulk-delete

Bulk soft-delete. Requires `@RequirePermission('leads', 'delete')`.

```json
{ "ids": ["uuid-1", "uuid-2"] }
```

## Stage Management

### POST /leads/:id/change-stage

Move a lead to a different pipeline stage.

```json
{
  "stageId": "target-stage-uuid",
  "stageFieldValues": {
    "amount": 50000,
    "close_date": "2025-03-01"
  }
}
```

### POST /leads/:id/disqualify

Disqualify a lead with a reason.

```json
{
  "reason": "no_budget",
  "notes": "Company confirmed no budget until next fiscal year"
}
```

## Conversion

### GET /leads/:id/conversion-check

Pre-check before converting a lead to opportunity/contact/account.

```json
{
  "canConvert": true,
  "existingContact": null,
  "existingAccount": { "id": "account-uuid", "name": "StartupIO" },
  "requiredFields": ["estimatedValue"]
}
```

### POST /leads/:id/convert

Convert a lead to opportunity + contact + account.

```json
{
  "createContact": true,
  "createAccount": true,
  "createOpportunity": true,
  "accountId": "existing-account-uuid",
  "opportunityName": "StartupIO Enterprise Deal",
  "opportunityPipelineId": "opp-pipeline-uuid",
  "opportunityStageId": "opp-stage-uuid"
}
```

**Response:**

```json
{
  "contactId": "new-contact-uuid",
  "accountId": "existing-account-uuid",
  "opportunityId": "new-opp-uuid",
  "message": "Lead converted successfully"
}
```

## SLA

### GET /leads/sla/summary

SLA compliance summary across all leads.

```json
{
  "total": 150,
  "withinSla": 130,
  "atRisk": 12,
  "breached": 8,
  "complianceRate": 86.7
}
```

### GET /leads/:id/sla

SLA status for a specific lead.

```json
{
  "leadId": "lead-uuid",
  "slaPolicy": "Standard Response",
  "responseDeadline": "2025-01-20T14:00:00Z",
  "status": "at_risk",
  "timeRemaining": "1h 30m",
  "firstResponseAt": null
}
```

### POST /leads/sla/check-breaches

Trigger an SLA breach check (typically called by cron).

## Products

### GET /leads/:id/products

```json
[
  { "id": "lp-uuid", "productId": "prod-uuid", "productName": "Enterprise Plan", "quantity": 1, "unitPrice": 5000, "discount": 10, "total": 4500 }
]
```

### POST /leads/:id/products

```json
{ "productId": "prod-uuid", "quantity": 2, "unitPrice": 5000, "discount": 0 }
```

### PUT /leads/:id/products/:productId

### DELETE /leads/:id/products/:productId

## Team

### GET /leads/:id/team

### POST /leads/:id/team

```json
{ "userId": "user-uuid", "role": "sales_rep" }
```

### DELETE /leads/:id/team/:userId

## Activities, History, Notes, Documents

### GET /leads/:id/activities
### GET /leads/:id/history
### GET /leads/:id/notes
### POST /leads/:id/notes
### GET /leads/:id/documents

---

## Lead Settings API

Base path: `/lead-settings`

All settings endpoints require `@AdminOnly()` for writes.

### Pipelines

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/pipelines?module=leads` | List pipelines |
| POST | `/lead-settings/pipelines` | Create pipeline |
| PUT | `/lead-settings/pipelines/:id` | Update pipeline |
| DELETE | `/lead-settings/pipelines/:id` | Delete pipeline |

### Stages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/stages?module=leads&pipelineId=uuid` | List stages |
| POST | `/lead-settings/stages` | Create stage |
| PUT | `/lead-settings/stages/:id` | Update stage |
| DELETE | `/lead-settings/stages/:id` | Delete stage |
| PUT | `/lead-settings/stages/reorder` | Reorder stages |
| GET | `/lead-settings/stages/:id/fields` | Get stage fields |
| POST | `/lead-settings/stages/:id/fields` | Add stage field |
| PUT | `/lead-settings/stages/:id/fields/:fieldId` | Update stage field |
| DELETE | `/lead-settings/stages/:id/fields/:fieldId` | Delete stage field |

### Stage Ownership

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/stage-ownership/:stageId` | Get stage ownership config |
| PUT | `/lead-settings/stage-ownership/:stageId` | Update stage ownership |

### Field Visibility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/field-visibility/:stageId` | Get field visibility per stage |
| PUT | `/lead-settings/field-visibility/:stageId` | Update field visibility |

### Priorities, Sources, Reasons

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/priorities` | List lead priorities |
| POST | `/lead-settings/priorities` | Create priority |
| PUT | `/lead-settings/priorities/:id` | Update priority |
| DELETE | `/lead-settings/priorities/:id` | Delete priority |
| GET | `/lead-settings/sources` | List lead sources |
| POST | `/lead-settings/sources` | Create source |
| GET | `/lead-settings/disqualification-reasons` | List reasons |
| POST | `/lead-settings/disqualification-reasons` | Create reason |

### Scoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/scoring-rules` | List scoring rules |
| POST | `/lead-settings/scoring-rules` | Create rule |
| PUT | `/lead-settings/scoring-rules/:id` | Update rule |
| DELETE | `/lead-settings/scoring-rules/:id` | Delete rule |
| GET | `/lead-settings/qualification-threshold` | Get threshold |
| PUT | `/lead-settings/qualification-threshold` | Set threshold |

### Team Roles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/team-roles` | List team roles |
| POST | `/lead-settings/team-roles` | Create role |

### General Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lead-settings/settings` | Get all lead settings |
| PUT | `/lead-settings/settings` | Update lead settings |
