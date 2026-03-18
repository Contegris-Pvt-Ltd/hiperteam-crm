---
sidebar_position: 2
title: "Users API"
description: "Complete endpoint reference for user management, invitations, org tree, and profile operations"
---

# Users API

Base path: `/users`

All endpoints require JWT authentication. Most require `@RequirePermission('users', 'action')`.

## GET /users

List users with filters and pagination.

```bash
GET /users?page=1&limit=25&search=john&status=active&departmentId=uuid&roleId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search by name or email |
| `status` | string | Filter by status: `active`, `inactive` |
| `departmentId` | UUID | Filter by department |
| `roleId` | UUID | Filter by role |
| `managerId` | UUID | Filter by direct manager |
| `teamId` | UUID | Filter by team membership |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 25, max: 100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "user-uuid-1",
      "email": "john@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "roleLevel": 100,
      "roleName": "Administrator",
      "departmentName": "Sales",
      "status": "active",
      "avatar": "/uploads/avatars/uuid.jpg",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 25,
    "totalPages": 2
  }
}
```

## Lookup Endpoints

Quick-access lookups for form selectors.

### GET /users/lookup/roles

```json
[
  { "id": "role-uuid", "name": "Administrator", "level": 100 },
  { "id": "role-uuid", "name": "Manager", "level": 50 },
  { "id": "role-uuid", "name": "User", "level": 10 }
]
```

### GET /users/lookup/departments

```json
[
  { "id": "dept-uuid", "name": "Sales" },
  { "id": "dept-uuid", "name": "Marketing" }
]
```

### GET /users/lookup/teams

```json
[
  { "id": "team-uuid", "name": "Team Alpha" },
  { "id": "team-uuid", "name": "Team Beta" }
]
```

## GET /users/org-tree

Returns the organizational hierarchy tree.

```bash
GET /users/org-tree
Authorization: Bearer <token>
```

**Response (200):**

```json
[
  {
    "id": "ceo-uuid",
    "firstName": "Jane",
    "lastName": "CEO",
    "title": "Chief Executive Officer",
    "avatar": null,
    "children": [
      {
        "id": "vp-uuid",
        "firstName": "Bob",
        "lastName": "VP",
        "title": "VP Sales",
        "children": [
          { "id": "rep-uuid", "firstName": "Alice", "lastName": "Rep", "children": [] }
        ]
      }
    ]
  }
]
```

## Invitation Endpoints

### GET /users/invitations

List all pending invitations. Requires `@AdminOnly()`.

```json
[
  {
    "id": "invite-uuid",
    "email": "newuser@acme.com",
    "roleName": "Sales Rep",
    "invitedBy": "John Doe",
    "status": "pending",
    "createdAt": "2025-01-20T10:00:00Z",
    "expiresAt": "2025-01-27T10:00:00Z"
  }
]
```

### POST /users/invite

Send an invitation to a new user. Requires `@RequirePermission('users', 'invite')`.

```bash
POST /users/invite
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "email": "newuser@acme.com",
  "roleId": "role-uuid",
  "teamIds": ["team-uuid-1", "team-uuid-2"],
  "departmentId": "dept-uuid"
}
```

**Response (201):**

```json
{
  "id": "invite-uuid",
  "email": "newuser@acme.com",
  "status": "pending",
  "message": "Invitation sent successfully"
}
```

### POST /users/invitations/:id/resend

Resend an invitation email. Requires `@AdminOnly()`.

### DELETE /users/invitations/:id

Cancel a pending invitation. Requires `@AdminOnly()`.

## POST /users

Create a user directly (without invitation). Requires `@RequirePermission('users', 'create')`.

```json
{
  "email": "direct@acme.com",
  "password": "TempPass123!",
  "firstName": "Direct",
  "lastName": "User",
  "roleId": "role-uuid",
  "departmentId": "dept-uuid",
  "managerId": "manager-uuid",
  "title": "Sales Representative"
}
```

## GET /users/:id

Get user details by ID.

**Response (200):**

```json
{
  "id": "user-uuid",
  "email": "john@acme.com",
  "firstName": "John",
  "lastName": "Doe",
  "title": "Sales Manager",
  "phone": "+1234567890",
  "role": "manager",
  "roleLevel": 50,
  "roleName": "Sales Manager",
  "roleId": "role-uuid",
  "departmentId": "dept-uuid",
  "departmentName": "Sales",
  "managerId": "manager-uuid",
  "managerName": "Jane CEO",
  "teamIds": ["team-uuid"],
  "status": "active",
  "avatar": "/uploads/avatars/uuid.jpg",
  "lastLoginAt": "2025-01-20T15:30:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

## PUT /users/:id

Update user details. Requires `@RequirePermission('users', 'edit')`.

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "title": "Senior Sales Manager",
  "phone": "+1234567890",
  "roleId": "new-role-uuid",
  "departmentId": "new-dept-uuid",
  "managerId": "new-manager-uuid"
}
```

## PUT /users/:id/deactivate

Deactivate a user account. Requires `@AdminOnly()`.

**Response (200):**

```json
{ "message": "User deactivated successfully" }
```

## PUT /users/:id/activate

Reactivate a user account. Requires `@AdminOnly()`.

## DELETE /users/:id

Soft-delete a user. Requires `@RequirePermission('users', 'delete')`.

## GET /users/:id/direct-reports

Get users who report to this user.

```json
[
  {
    "id": "report-uuid",
    "firstName": "Alice",
    "lastName": "Rep",
    "title": "Sales Representative",
    "avatar": null
  }
]
```

## GET /users/:id/profile-stats

Get activity statistics for a user.

```json
{
  "leadsCreated": 45,
  "leadsConverted": 12,
  "opportunitiesWon": 8,
  "tasksCompleted": 156,
  "activitiesLogged": 320,
  "averageResponseTime": "2.5h"
}
```

## Email Signature

### GET /users/me/email-signature

```json
{
  "signature": "<p>Best regards,<br>John Doe<br>Sales Manager</p>",
  "isHtml": true
}
```

### PUT /users/me/email-signature

```json
{
  "signature": "<p>Best regards,<br>John Doe<br>Sales Manager</p>",
  "isHtml": true
}
```
