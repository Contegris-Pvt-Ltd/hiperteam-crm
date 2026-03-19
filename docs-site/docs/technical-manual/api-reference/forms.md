---
sidebar_position: 12
title: Forms API
---

# Forms API

## Authenticated Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/forms` | List forms (query: status, search, page, limit) |
| GET | `/forms/:id` | Get form by ID |
| POST | `/forms` | Create form |
| PUT | `/forms/:id` | Update form |
| DELETE | `/forms/:id` | Soft delete form |
| POST | `/forms/:id/duplicate` | Duplicate form as draft |
| GET | `/forms/:id/submissions` | List submissions (query: page, limit, status, dateFrom, dateTo) |
| GET | `/forms/:id/analytics` | Submission analytics (stats, trends, field breakdowns) |
| POST | `/forms/:id/submissions/:submissionId/retry-webhook` | Retry failed webhook action |

## Public Endpoints (No Auth)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/forms/public/:tenantSlug/:token` | Get public form for rendering |
| POST | `/forms/public/:tenantSlug/:token/submit` | Submit form data |

## Form Object

```json
{
  "id": "uuid",
  "name": "Contact Us",
  "description": "Main contact form",
  "status": "active",
  "type": "standard",
  "token": "abc123",
  "tenantSlug": "acme",
  "fields": [
    {
      "id": "field-1",
      "type": "text",
      "label": "Full Name",
      "name": "full_name",
      "required": true,
      "width": "full"
    }
  ],
  "settings": {
    "successMessage": "Thank you!",
    "redirectUrl": null,
    "allowMultiple": false,
    "requireCaptcha": true,
    "notifyEmails": ["admin@acme.com"]
  },
  "submitActions": [
    {
      "type": "create_lead",
      "enabled": true,
      "fieldMapping": {
        "first_name": "full_name",
        "email": "email_field"
      }
    }
  ],
  "branding": {
    "logoUrl": "https://...",
    "primaryColor": "#7C3AED",
    "backgroundColor": "#FFFFFF"
  },
  "submissionCount": 42,
  "createdAt": "2026-01-15T...",
  "updatedAt": "2026-03-19T..."
}
```

## Field Types

| Type | Input | Has Options |
|---|---|---|
| text | Single-line text | No |
| email | Email with validation | No |
| phone | Phone number | No |
| number | Numeric input | No |
| date | Date picker | No |
| textarea | Multi-line text | No |
| select | Dropdown | Yes |
| radio | Radio buttons | Yes |
| checkbox | Checkboxes | Yes |
| file | File upload | No |
| heading | Display only | No |
| paragraph | Display only | No |
| divider | Display only | No |

## Submit Action Types

| Type | Description | Config |
|---|---|---|
| create_lead | Create CRM lead | fieldMapping |
| create_contact | Create CRM contact | fieldMapping |
| create_account | Create CRM account | fieldMapping |
| webhook | POST to external URL | webhookUrl |
| send_email | Email to submitter | emailFieldName, subject, body |
