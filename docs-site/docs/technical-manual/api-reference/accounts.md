---
sidebar_position: 4
title: "Accounts API"
description: "Complete endpoint reference for account (company) management, hierarchies, and associations"
---

# Accounts API

Base path: `/accounts`

All endpoints require JWT authentication and `@RequirePermission('accounts', 'action')`.

## Core CRUD

### POST /accounts

Create a new account.

```bash
POST /accounts
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Globex Inc",
  "type": "B2B",
  "industry": "Technology",
  "website": "https://globex.com",
  "phone": "+1234567890",
  "email": "info@globex.com",
  "annualRevenue": 5000000,
  "employees": 250,
  "parentAccountId": null,
  "billingAddress": {
    "street": "456 Market St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "US"
  },
  "shippingAddress": {
    "street": "456 Market St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "US"
  },
  "description": "Enterprise software company",
  "customFields": {
    "sic_code": "7372",
    "account_tier": "enterprise"
  }
}
```

**Response (201):**

```json
{
  "id": "account-uuid",
  "name": "Globex Inc",
  "type": "B2B",
  "industry": "Technology",
  "website": "https://globex.com",
  "annualRevenue": 5000000,
  "employees": 250,
  "createdBy": "user-uuid",
  "createdAt": "2025-01-20T10:00:00Z"
}
```

### GET /accounts

List accounts with filters and pagination.

```bash
GET /accounts?page=1&limit=25&search=globex&type=B2B&industry=Technology
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name, email, or phone |
| `type` | string | Filter: `B2B`, `B2C` |
| `industry` | string | Filter by industry |
| `parentAccountId` | UUID | Filter by parent account |
| `page` | number | Page number |
| `limit` | number | Items per page |
| `sortBy` | string | Sort column |
| `sortDir` | string | `asc` or `desc` |

**Response (200):**

```json
{
  "data": [
    {
      "id": "account-uuid",
      "name": "Globex Inc",
      "type": "B2B",
      "industry": "Technology",
      "website": "https://globex.com",
      "phone": "+1234567890",
      "annualRevenue": 5000000,
      "employees": 250,
      "contactCount": 5,
      "createdAt": "2025-01-20T10:00:00Z"
    }
  ],
  "meta": {
    "total": 75,
    "page": 1,
    "limit": 25,
    "totalPages": 3
  }
}
```

### GET /accounts/:id

Get account details.

**Response (200):**

```json
{
  "id": "account-uuid",
  "name": "Globex Inc",
  "type": "B2B",
  "industry": "Technology",
  "website": "https://globex.com",
  "phone": "+1234567890",
  "email": "info@globex.com",
  "annualRevenue": 5000000,
  "employees": 250,
  "parentAccountId": null,
  "parentAccountName": null,
  "billingAddress": { "street": "456 Market St", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "US" },
  "shippingAddress": { "street": "456 Market St", "city": "San Francisco", "state": "CA", "zip": "94102", "country": "US" },
  "description": "Enterprise software company",
  "customFields": { "sic_code": "7372", "account_tier": "enterprise" },
  "contacts": [
    { "id": "contact-uuid", "firstName": "Jane", "lastName": "Smith", "title": "CTO", "role": "primary" }
  ],
  "createdBy": "user-uuid",
  "createdByName": "John Doe",
  "createdAt": "2025-01-20T10:00:00Z",
  "updatedAt": "2025-01-20T10:00:00Z"
}
```

### PUT /accounts/:id

Update an account.

### DELETE /accounts/:id

Soft-delete an account.

## Hierarchy

### GET /accounts/:id/children

Get child accounts (subsidiaries) of an account.

```bash
GET /accounts/:id/children
```

**Response (200):**

```json
[
  {
    "id": "child-uuid-1",
    "name": "Globex West",
    "type": "B2B",
    "industry": "Technology",
    "employees": 50
  },
  {
    "id": "child-uuid-2",
    "name": "Globex East",
    "type": "B2B",
    "industry": "Technology",
    "employees": 75
  }
]
```

## Activities & Related Data

### GET /accounts/:id/activities

Activity feed for the account.

### GET /accounts/:id/history

Audit change history for the account.

### GET /accounts/:id/documents

Documents attached to the account.

### GET /accounts/:id/notes

Notes for the account.

### POST /accounts/:id/notes

Create a note for the account.

```json
{ "content": "Renewed enterprise contract for 2 years" }
```

:::note
Activities, history, documents, and notes follow the same patterns as the [Contacts API](./contacts.md).
:::
