---
sidebar_position: 9
title: "Dashboard API"
description: "Complete endpoint reference for all 19 dashboard widget endpoints with statistics and analytics"
---

# Dashboard API

Base path: `/dashboard`

All endpoints require JWT authentication and `@RequirePermission('leads', 'view')` or appropriate module permissions.

## Common Query Parameters

Most dashboard endpoints accept these filtering parameters:

| Param | Type | Description |
|-------|------|-------------|
| `scope` | string | `own`, `team`, `department`, `all` |
| `from` | date | Start date (ISO 8601) |
| `to` | date | End date (ISO 8601) |
| `pipelineId` | UUID | Filter by specific pipeline |

## Endpoints

### GET /dashboard/stats

Overall CRM statistics.

```bash
GET /dashboard/stats?scope=all&from=2025-01-01&to=2025-01-31
```

```json
{
  "totalLeads": 450,
  "newLeadsThisPeriod": 85,
  "totalOpportunities": 120,
  "openOpportunityValue": 2500000,
  "wonDeals": 15,
  "wonDealValue": 450000,
  "lostDeals": 8,
  "conversionRate": 28.5,
  "averageDealSize": 30000,
  "averageSalesCycle": 45
}
```

### GET /dashboard/lead-pipeline

Leads grouped by pipeline stage.

```json
[
  { "stageId": "uuid", "stageName": "New", "count": 45, "color": "#3b82f6" },
  { "stageId": "uuid", "stageName": "Qualified", "count": 30, "color": "#10b981" },
  { "stageId": "uuid", "stageName": "Proposal", "count": 18, "color": "#f59e0b" },
  { "stageId": "uuid", "stageName": "Negotiation", "count": 8, "color": "#8b5cf6" }
]
```

### GET /dashboard/opportunity-pipeline

Opportunities grouped by pipeline stage with amounts.

```json
[
  { "stageId": "uuid", "stageName": "Discovery", "count": 25, "totalAmount": 750000, "weightedAmount": 150000 },
  { "stageId": "uuid", "stageName": "Proposal", "count": 15, "totalAmount": 500000, "weightedAmount": 300000 }
]
```

### GET /dashboard/revenue-trend

Revenue trend over time.

```bash
GET /dashboard/revenue-trend?period=monthly&from=2025-01-01&to=2025-06-30
```

```json
[
  { "period": "2025-01", "wonAmount": 45000, "lostAmount": 15000, "pipelineAmount": 250000 },
  { "period": "2025-02", "wonAmount": 62000, "lostAmount": 8000, "pipelineAmount": 280000 },
  { "period": "2025-03", "wonAmount": 78000, "lostAmount": 22000, "pipelineAmount": 310000 }
]
```

### GET /dashboard/lead-sources

Leads grouped by source.

```json
[
  { "source": "website", "count": 120, "percentage": 35.3 },
  { "source": "referral", "count": 85, "percentage": 25.0 },
  { "source": "linkedin", "count": 60, "percentage": 17.6 },
  { "source": "cold_call", "count": 45, "percentage": 13.2 },
  { "source": "other", "count": 30, "percentage": 8.8 }
]
```

### GET /dashboard/conversion-funnel

Funnel from lead to closed-won.

```json
[
  { "stage": "Leads Created", "count": 450, "percentage": 100 },
  { "stage": "Qualified", "count": 225, "percentage": 50 },
  { "stage": "Opportunity Created", "count": 120, "percentage": 26.7 },
  { "stage": "Proposal Sent", "count": 68, "percentage": 15.1 },
  { "stage": "Closed Won", "count": 34, "percentage": 7.6 }
]
```

### GET /dashboard/top-performers

```bash
GET /dashboard/top-performers?metricKey=deals_won&limit=10
```

```json
[
  { "userId": "uuid", "userName": "John Doe", "avatar": null, "value": 12, "amount": 180000 },
  { "userId": "uuid", "userName": "Jane Smith", "avatar": null, "value": 10, "amount": 155000 }
]
```

### GET /dashboard/activities-summary

```json
{
  "totalActivities": 320,
  "byType": [
    { "type": "call", "count": 95 },
    { "type": "email", "count": 120 },
    { "type": "meeting", "count": 45 },
    { "type": "note", "count": 60 }
  ]
}
```

### GET /dashboard/tasks-summary

```json
{
  "overdue": 12,
  "dueToday": 8,
  "dueThisWeek": 25,
  "completedThisPeriod": 45,
  "completionRate": 78.5
}
```

### GET /dashboard/recent-activities

```bash
GET /dashboard/recent-activities?limit=20
```

```json
[
  {
    "id": "activity-uuid",
    "activityType": "stage_change",
    "title": "Lead moved to Qualified",
    "entityType": "leads",
    "entityId": "lead-uuid",
    "entityName": "Alice Johnson",
    "performedBy": "John Doe",
    "createdAt": "2025-01-20T15:30:00Z"
  }
]
```

### GET /dashboard/upcoming-tasks

```bash
GET /dashboard/upcoming-tasks?days=7&limit=10
```

### GET /dashboard/sla-compliance

```json
{
  "withinSla": 130,
  "atRisk": 12,
  "breached": 8,
  "complianceRate": 86.7
}
```

### GET /dashboard/target-progress

```bash
GET /dashboard/target-progress?quarter=Q1
```

```json
[
  {
    "targetId": "target-uuid",
    "name": "Q1 Revenue Target",
    "targetValue": 500000,
    "currentValue": 310000,
    "progress": 62,
    "unit": "currency"
  }
]
```

### GET /dashboard/lead-aging

```json
[
  { "ageRange": "0-7 days", "count": 45 },
  { "ageRange": "8-14 days", "count": 30 },
  { "ageRange": "15-30 days", "count": 22 },
  { "ageRange": "31-60 days", "count": 15 },
  { "ageRange": "60+ days", "count": 8 }
]
```

### GET /dashboard/win-loss-analysis

```json
{
  "wonCount": 34,
  "lostCount": 18,
  "winRate": 65.4,
  "topWinReasons": [
    { "reason": "Product fit", "count": 15 },
    { "reason": "Pricing", "count": 10 }
  ],
  "topLossReasons": [
    { "reason": "Price too high", "count": 8 },
    { "reason": "Chose competitor", "count": 6 }
  ]
}
```

### GET /dashboard/deal-velocity

Average time spent in each pipeline stage.

```json
[
  { "stageName": "Discovery", "avgDays": 5.2 },
  { "stageName": "Proposal", "avgDays": 8.1 },
  { "stageName": "Negotiation", "avgDays": 12.3 },
  { "stageName": "Closed Won", "avgDays": 3.0 }
]
```

### GET /dashboard/score-card

Configurable KPI scorecard.

```bash
GET /dashboard/score-card?metrics=leads_created,deals_won,revenue
```

```json
[
  { "metric": "leads_created", "label": "Leads Created", "value": 85, "previousPeriod": 72, "change": 18.1, "trend": "up" },
  { "metric": "deals_won", "label": "Deals Won", "value": 15, "previousPeriod": 12, "change": 25.0, "trend": "up" },
  { "metric": "revenue", "label": "Revenue", "value": 450000, "previousPeriod": 380000, "change": 18.4, "trend": "up" }
]
```

### GET /dashboard/funnel-chart

```bash
GET /dashboard/funnel-chart?pipelineId=uuid
```

### GET /dashboard/public/:token

Public dashboard access (no auth required, uses a shared token).

```bash
GET /dashboard/public/abc123-public-token
```
