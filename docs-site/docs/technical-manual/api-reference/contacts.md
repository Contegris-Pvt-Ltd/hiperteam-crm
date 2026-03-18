---
sidebar_position: 3
title: "Contacts API"
description: "Complete endpoint reference for contact management, account associations, activities, and notes"
---

# Contacts API

Base path: `/contacts`

All endpoints require JWT authentication and `@RequirePermission('contacts', 'action')`.

## Core CRUD

### POST /contacts

Create a new contact.

```bash
POST /contacts
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@globex.com",
  "phone": "+1234567890",
  "mobile": "+0987654321",
  "title": "VP Engineering",
  "department": "Engineering",
  "source": "website",
  "description": "Met at conference",
  "mailingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "US"
  },
  "customFields": {
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "industry": "Technology"
  }
}
```

**Response (201):**

```json
{
  "id": "contact-uuid",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@globex.com",
  "phone": "+1234567890",
  "mobile": "+0987654321",
  "title": "VP Engineering",
  "department": "Engineering",
  "source": "website",
  "createdBy": "user-uuid",
  "createdAt": "2025-01-20T10:00:00Z",
  "updatedAt": "2025-01-20T10:00:00Z"
}
```

### GET /contacts

List contacts with filters and pagination.

```bash
GET /contacts?page=1&limit=25&search=jane&source=website
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name, email, or phone |
| `source` | string | Filter by source |
| `accountId` | UUID | Filter by associated account |
| `createdBy` | UUID | Filter by creator |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `sortBy` | string | Sort column (default: `created_at`) |
| `sortDir` | string | Sort direction: `asc` or `desc` |

**Response (200):**

```json
{
  "data": [
    {
      "id": "contact-uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@globex.com",
      "phone": "+1234567890",
      "title": "VP Engineering",
      "accountName": "Globex Inc",
      "source": "website",
      "createdAt": "2025-01-20T10:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

### GET /contacts/:id

Get contact details with all fields.

**Response (200):**

```json
{
  "id": "contact-uuid",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@globex.com",
  "phone": "+1234567890",
  "mobile": "+0987654321",
  "title": "VP Engineering",
  "department": "Engineering",
  "source": "website",
  "description": "Met at conference",
  "mailingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "US"
  },
  "customFields": {
    "linkedin_url": "https://linkedin.com/in/janesmith"
  },
  "accounts": [
    { "id": "account-uuid", "name": "Globex Inc", "role": "primary" }
  ],
  "createdBy": "user-uuid",
  "createdByName": "John Doe",
  "createdAt": "2025-01-20T10:00:00Z",
  "updatedAt": "2025-01-20T10:00:00Z"
}
```

### PUT /contacts/:id

Update a contact.

```json
{
  "firstName": "Jane",
  "title": "CTO",
  "customFields": {
    "linkedin_url": "https://linkedin.com/in/janectosmith"
  }
}
```

### DELETE /contacts/:id

Soft-delete a contact.

**Response (200):**

```json
{ "success": true }
```

## Account Associations

### GET /contacts/:id/accounts

List accounts associated with a contact.

```json
[
  {
    "id": "account-uuid",
    "name": "Globex Inc",
    "role": "primary",
    "associatedAt": "2025-01-20T10:00:00Z"
  }
]
```

### POST /contacts/:id/accounts/:accountId

Associate a contact with an account.

```bash
POST /contacts/:contactId/accounts/:accountId
Content-Type: application/json
```

```json
{
  "role": "primary"
}
```

### DELETE /contacts/:id/accounts/:accountId

Remove association between contact and account.

## Activities & History

### GET /contacts/:id/activities

Get activity feed for a contact.

```json
[
  {
    "id": "activity-uuid",
    "activityType": "email",
    "title": "Follow-up email sent",
    "description": "Sent proposal follow-up",
    "performedBy": "John Doe",
    "createdAt": "2025-01-20T15:30:00Z"
  },
  {
    "id": "activity-uuid",
    "activityType": "call",
    "title": "Discovery call completed",
    "performedBy": "John Doe",
    "createdAt": "2025-01-19T11:00:00Z"
  }
]
```

### GET /contacts/:id/history

Get audit history (change log) for a contact.

```json
[
  {
    "id": "audit-uuid",
    "action": "update",
    "changes": {
      "before": { "title": "VP Engineering" },
      "after": { "title": "CTO" }
    },
    "performedBy": "John Doe",
    "createdAt": "2025-01-20T16:00:00Z"
  }
]
```

### GET /contacts/:id/documents

List documents attached to a contact.

```json
[
  {
    "id": "doc-uuid",
    "name": "business-card.jpg",
    "type": "image/jpeg",
    "size": 245000,
    "uploadedBy": "John Doe",
    "uploadedAt": "2025-01-20T10:05:00Z"
  }
]
```

## Notes

### GET /contacts/:id/notes

List notes for a contact.

```json
[
  {
    "id": "note-uuid",
    "content": "Interested in enterprise plan, follow up next week",
    "createdBy": "John Doe",
    "createdAt": "2025-01-20T10:15:00Z"
  }
]
```

### POST /contacts/:id/notes

Create a note for a contact.

```json
{
  "content": "Called and discussed Q2 renewal"
}
```

**Response (201):**

```json
{
  "id": "note-uuid",
  "content": "Called and discussed Q2 renewal",
  "createdBy": "user-uuid",
  "createdAt": "2025-01-20T10:15:00Z"
}
```
