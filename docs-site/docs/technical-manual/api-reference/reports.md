---
sidebar_position: 10
title: "Reports API"
description: "Complete endpoint reference for the dynamic report builder, execution, export, scheduling, and folders"
---

# Reports API

Base path: `/reports`

All endpoints require JWT authentication and `@RequirePermission('reports', 'action')`.

## Data Sources

### GET /reports/data-sources

Returns available data sources (modules) for building reports.

```json
[
  {
    "name": "leads",
    "label": "Leads",
    "fields": [
      { "name": "first_name", "label": "First Name", "type": "text" },
      { "name": "email", "label": "Email", "type": "text" },
      { "name": "stage_name", "label": "Stage", "type": "text" },
      { "name": "estimated_value", "label": "Estimated Value", "type": "number" },
      { "name": "created_at", "label": "Created Date", "type": "date" },
      { "name": "source", "label": "Source", "type": "text" }
    ],
    "relationships": [
      { "name": "accounts", "label": "Account", "type": "many_to_one" },
      { "name": "contacts", "label": "Contact", "type": "many_to_one" }
    ]
  },
  {
    "name": "opportunities",
    "label": "Opportunities",
    "fields": [
      { "name": "name", "label": "Name", "type": "text" },
      { "name": "amount", "label": "Amount", "type": "number" },
      { "name": "probability", "label": "Probability", "type": "number" },
      { "name": "expected_close_date", "label": "Expected Close Date", "type": "date" }
    ]
  }
]
```

## Report Library

### GET /reports/library

Pre-built report templates.

```json
[
  {
    "id": "template-uuid",
    "name": "Leads by Source",
    "description": "Breakdown of leads by acquisition source",
    "category": "leads",
    "chartType": "bar"
  },
  {
    "id": "template-uuid",
    "name": "Monthly Revenue Trend",
    "description": "Revenue over time with trend line",
    "category": "revenue",
    "chartType": "line"
  }
]
```

## Folders

### GET /reports/folders

```json
[
  { "id": "folder-uuid", "name": "Sales Reports", "reportCount": 8 },
  { "id": "folder-uuid", "name": "Marketing Reports", "reportCount": 5 }
]
```

### POST /reports/folders

```json
{ "name": "Q1 Analysis" }
```

### PUT /reports/folders/:id

### DELETE /reports/folders/:id

## Reports CRUD

### POST /reports

Create a custom report.

```json
{
  "name": "Q1 Lead Conversion by Source",
  "description": "Analyze lead conversion rates by source for Q1",
  "folderId": "folder-uuid",
  "dataSource": "leads",
  "chartType": "bar",
  "columns": [
    { "field": "source", "label": "Source", "aggregate": null },
    { "field": "id", "label": "Total Leads", "aggregate": "count" },
    { "field": "id", "label": "Converted", "aggregate": "count", "filter": { "status": "converted" } }
  ],
  "filters": [
    { "field": "created_at", "operator": "between", "value": ["2025-01-01", "2025-03-31"] }
  ],
  "groupBy": ["source"],
  "orderBy": { "field": "count", "direction": "desc" },
  "isPublic": false
}
```

### GET /reports

```bash
GET /reports?folderId=uuid&search=conversion&page=1&limit=25
```

```json
{
  "data": [
    {
      "id": "report-uuid",
      "name": "Q1 Lead Conversion by Source",
      "dataSource": "leads",
      "chartType": "bar",
      "folderName": "Sales Reports",
      "createdBy": "John Doe",
      "lastRunAt": "2025-01-20T15:00:00Z",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": { "total": 15, "page": 1, "limit": 25, "totalPages": 1 }
}
```

### GET /reports/:id

Get report definition.

### PUT /reports/:id

Update report definition.

### DELETE /reports/:id

### POST /reports/:id/clone

Clone an existing report.

```json
{ "name": "Q1 Lead Conversion by Source (Copy)" }
```

## Execution

### POST /reports/:id/execute

Run a report and get results.

```bash
POST /reports/:id/execute
Content-Type: application/json
```

```json
{
  "filters": {
    "dateRange": { "from": "2025-01-01", "to": "2025-03-31" }
  },
  "limit": 1000
}
```

**Response:**

```json
{
  "reportId": "report-uuid",
  "reportName": "Q1 Lead Conversion by Source",
  "executedAt": "2025-01-20T15:30:00Z",
  "data": [
    { "source": "website", "totalLeads": 120, "converted": 35 },
    { "source": "referral", "totalLeads": 85, "converted": 30 },
    { "source": "linkedin", "totalLeads": 60, "converted": 15 }
  ],
  "summary": {
    "totalRows": 5,
    "aggregates": {
      "totalLeads": 340,
      "converted": 95
    }
  },
  "chartData": {
    "labels": ["website", "referral", "linkedin", "cold_call", "other"],
    "datasets": [
      { "label": "Total Leads", "data": [120, 85, 60, 45, 30] },
      { "label": "Converted", "data": [35, 30, 15, 10, 5] }
    ]
  }
}
```

## Export

### POST /reports/:id/export

Export report results to CSV or XLSX.

```json
{
  "format": "csv",
  "filters": {
    "dateRange": { "from": "2025-01-01", "to": "2025-03-31" }
  }
}
```

**Response:** File download (Content-Type: text/csv or application/vnd.openxmlformats)

## Schedules

### GET /reports/:id/schedules

```json
[
  {
    "id": "schedule-uuid",
    "frequency": "weekly",
    "dayOfWeek": 1,
    "time": "08:00",
    "recipients": ["user1@acme.com", "user2@acme.com"],
    "format": "pdf",
    "isActive": true,
    "lastSentAt": "2025-01-20T08:00:00Z",
    "nextRunAt": "2025-01-27T08:00:00Z"
  }
]
```

### POST /reports/:id/schedules

```json
{
  "frequency": "weekly",
  "dayOfWeek": 1,
  "time": "08:00",
  "recipients": ["user1@acme.com"],
  "format": "pdf",
  "isActive": true
}
```

### PUT /reports/:id/schedules/:scheduleId

### DELETE /reports/:id/schedules/:scheduleId
