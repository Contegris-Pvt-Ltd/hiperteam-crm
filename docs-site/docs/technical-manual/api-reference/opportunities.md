---
sidebar_position: 6
title: "Opportunities API"
description: "Complete endpoint reference for opportunities, pipeline stages, contact roles, line items, and settings"
---

# Opportunities API

Base path: `/opportunities`

All endpoints require JWT authentication and `@RequirePermission('opportunities', 'action')`.

## Core CRUD

### POST /opportunities

Create a new opportunity.

```json
{
  "name": "Globex Enterprise Deal",
  "accountId": "account-uuid",
  "pipelineId": "pipeline-uuid",
  "stageId": "stage-uuid",
  "amount": 150000,
  "probability": 60,
  "expectedCloseDate": "2025-06-30",
  "priority": "high",
  "type": "new_business",
  "source": "referral",
  "description": "Enterprise deployment for 500 users",
  "customFields": {
    "deal_region": "west_coast"
  }
}
```

**Response (201):**

```json
{
  "id": "opp-uuid",
  "name": "Globex Enterprise Deal",
  "accountName": "Globex Inc",
  "stageName": "Discovery",
  "amount": 150000,
  "probability": 60,
  "weightedAmount": 90000,
  "expectedCloseDate": "2025-06-30",
  "priority": "high",
  "createdAt": "2025-01-20T10:00:00Z"
}
```

### GET /opportunities

List with filters.

```bash
GET /opportunities?page=1&limit=25&stageId=uuid&priority=high&accountId=uuid&minAmount=10000&maxAmount=500000
```

**Additional Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `minAmount` | number | Minimum deal amount |
| `maxAmount` | number | Maximum deal amount |
| `expectedCloseBefore` | date | Expected close date before |
| `expectedCloseAfter` | date | Expected close date after |
| `type` | string | `new_business`, `upsell`, `renewal`, `cross_sell` |

### GET /opportunities/:id

### PUT /opportunities/:id

### DELETE /opportunities/:id

### POST /opportunities/check-duplicates

```json
{ "name": "Globex Enterprise Deal", "accountId": "account-uuid" }
```

### GET /opportunities/forecast

Get pipeline forecast summary.

```bash
GET /opportunities/forecast?pipelineId=uuid&quarter=Q1&year=2025
```

```json
{
  "totalPipeline": 2500000,
  "weightedPipeline": 1250000,
  "closedWon": 450000,
  "closedLost": 120000,
  "byStage": [
    { "stageName": "Discovery", "count": 15, "totalAmount": 750000, "weightedAmount": 150000 },
    { "stageName": "Proposal", "count": 8, "totalAmount": 500000, "weightedAmount": 300000 },
    { "stageName": "Negotiation", "count": 5, "totalAmount": 400000, "weightedAmount": 320000 }
  ]
}
```

## Stage Operations

### POST /opportunities/:id/change-stage

```json
{
  "stageId": "target-stage-uuid",
  "stageFieldValues": { "decision_maker": "true", "proposal_sent": "2025-02-15" }
}
```

### POST /opportunities/:id/close-won

```json
{
  "closeDate": "2025-02-28",
  "finalAmount": 145000,
  "notes": "Signed 2-year contract"
}
```

### POST /opportunities/:id/close-lost

```json
{
  "closeReasonId": "reason-uuid",
  "competitorName": "CompetitorX",
  "notes": "Lost on price"
}
```

### POST /opportunities/:id/reopen

Reopen a closed opportunity.

```json
{
  "stageId": "stage-to-reopen-to",
  "reason": "Client wants to renegotiate"
}
```

### GET /opportunities/:id/stage-history

```json
[
  {
    "id": "history-uuid",
    "fromStage": "Discovery",
    "toStage": "Proposal",
    "changedBy": "John Doe",
    "changedAt": "2025-01-25T14:00:00Z",
    "duration": "5 days"
  },
  {
    "id": "history-uuid",
    "fromStage": null,
    "toStage": "Discovery",
    "changedBy": "John Doe",
    "changedAt": "2025-01-20T10:00:00Z",
    "duration": null
  }
]
```

## Contact Roles

### GET /opportunities/:id/contacts

```json
[
  {
    "id": "ocr-uuid",
    "contactId": "contact-uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@globex.com",
    "role": "decision_maker",
    "isPrimary": true
  }
]
```

### POST /opportunities/:id/contacts

```json
{
  "contactId": "contact-uuid",
  "role": "economic_buyer",
  "isPrimary": false
}
```

### DELETE /opportunities/:id/contacts/:contactRoleId

## Line Items

### GET /opportunities/:id/line-items

```json
[
  {
    "id": "li-uuid",
    "productId": "prod-uuid",
    "productName": "Enterprise License",
    "quantity": 500,
    "unitPrice": 250,
    "discount": 10,
    "discountType": "percentage",
    "total": 112500,
    "description": "Annual enterprise license"
  }
]
```

### POST /opportunities/:id/line-items

```json
{
  "productId": "prod-uuid",
  "quantity": 500,
  "unitPrice": 250,
  "discount": 10,
  "discountType": "percentage",
  "description": "Annual enterprise license"
}
```

### PUT /opportunities/:id/line-items/:itemId

### DELETE /opportunities/:id/line-items/:itemId

## Team, Activities, History, Notes, Documents

Same pattern as [Leads API](./leads.md):

- `GET /opportunities/:id/team`
- `POST /opportunities/:id/team`
- `DELETE /opportunities/:id/team/:userId`
- `GET /opportunities/:id/activities`
- `GET /opportunities/:id/history`
- `GET /opportunities/:id/notes`
- `POST /opportunities/:id/notes`
- `GET /opportunities/:id/documents`

---

## Opportunity Settings API

Base path: `/opportunity-settings`

### Priorities

| Method | Path |
|--------|------|
| GET | `/opportunity-settings/priorities` |
| POST | `/opportunity-settings/priorities` |
| PUT | `/opportunity-settings/priorities/:id` |
| DELETE | `/opportunity-settings/priorities/:id` |

### Close Reasons

| Method | Path |
|--------|------|
| GET | `/opportunity-settings/close-reasons` |
| POST | `/opportunity-settings/close-reasons` |
| PUT | `/opportunity-settings/close-reasons/:id` |
| DELETE | `/opportunity-settings/close-reasons/:id` |

:::note Pipeline and Stages
Opportunity pipelines and stages use the shared pipeline system under `/lead-settings/` with `module=opportunities`. See [Pipeline System](../pipeline-system.md) for details.
:::
