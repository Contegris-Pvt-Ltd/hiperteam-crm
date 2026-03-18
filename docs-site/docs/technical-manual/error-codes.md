---
sidebar_position: 20
title: "Error Codes"
description: "Complete reference of ICN error codes by category with descriptions and resolution guidance"
---

# Error Codes

Intellicon CRM uses structured error codes in the format `ICN-XXXX`. Error codes are grouped by category using numeric ranges.

## Error Response Format

All API errors follow this structure:

```json
{
  "statusCode": 400,
  "message": "Lead with this email already exists",
  "errorCode": "ICN-1201",
  "error": "Bad Request",
  "details": ["A lead with email alice@startup.io exists in stage 'Qualified'"]
}
```

## ICN-1000 -- ICN-1099: Authentication Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1000` | 401 | Invalid credentials (wrong email or password) |
| `ICN-1001` | 401 | Account is deactivated |
| `ICN-1002` | 401 | Access token expired |
| `ICN-1003` | 401 | Invalid access token signature |
| `ICN-1004` | 401 | Refresh token expired |
| `ICN-1005` | 401 | Invalid refresh token |
| `ICN-1006` | 401 | Missing Authorization header |
| `ICN-1010` | 400 | Password does not meet requirements |
| `ICN-1011` | 400 | Invalid registration data |
| `ICN-1012` | 409 | Email already registered |
| `ICN-1013` | 409 | Company name already taken |
| `ICN-1014` | 404 | Tenant not found (invalid slug) |
| `ICN-1020` | 400 | Invitation token expired |
| `ICN-1021` | 400 | Invitation token already used |
| `ICN-1022` | 404 | Invitation token not found |
| `ICN-1030` | 400 | Password reset token expired |
| `ICN-1031` | 404 | Password reset token not found |
| `ICN-1032` | 400 | Current password is incorrect (change-password) |

## ICN-1100 -- ICN-1199: User & Role Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1100` | 404 | User not found |
| `ICN-1101` | 409 | User with this email already exists |
| `ICN-1102` | 403 | Insufficient permissions for this action |
| `ICN-1103` | 403 | Cannot deactivate your own account |
| `ICN-1104` | 403 | Cannot delete your own account |
| `ICN-1105` | 400 | Cannot assign a higher role than your own |
| `ICN-1110` | 404 | Role not found |
| `ICN-1111` | 409 | Role name already exists |
| `ICN-1112` | 400 | Cannot delete role with assigned users |
| `ICN-1113` | 400 | Cannot delete the default admin role |
| `ICN-1120` | 404 | Department not found |
| `ICN-1121` | 409 | Department name already exists |
| `ICN-1130` | 404 | Team not found |
| `ICN-1131` | 409 | Team name already exists |

## ICN-1200 -- ICN-1299: Lead Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1200` | 404 | Lead not found |
| `ICN-1201` | 409 | Duplicate lead detected (matching email/phone) |
| `ICN-1202` | 400 | Invalid lead data |
| `ICN-1203` | 400 | Required stage fields not provided |
| `ICN-1204` | 400 | Cannot transition to this stage |
| `ICN-1205` | 400 | Lead already converted |
| `ICN-1206` | 400 | Lead already disqualified |
| `ICN-1207` | 400 | Conversion prerequisites not met |
| `ICN-1210` | 404 | Pipeline not found |
| `ICN-1211` | 404 | Stage not found |
| `ICN-1212` | 400 | Stage does not belong to this pipeline |
| `ICN-1220` | 400 | SLA policy violation |
| `ICN-1221` | 404 | Scoring rule not found |
| `ICN-1230` | 400 | Import file format not supported |
| `ICN-1231` | 400 | Import column mapping invalid |
| `ICN-1232` | 404 | Import job not found |

## ICN-1300 -- ICN-1399: Opportunity Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1300` | 404 | Opportunity not found |
| `ICN-1301` | 409 | Duplicate opportunity detected |
| `ICN-1302` | 400 | Invalid opportunity data |
| `ICN-1303` | 400 | Required stage fields not provided |
| `ICN-1304` | 400 | Opportunity is already closed |
| `ICN-1305` | 400 | Cannot reopen — reason required |
| `ICN-1310` | 404 | Contact role not found |
| `ICN-1311` | 409 | Contact already associated with this opportunity |
| `ICN-1320` | 404 | Line item not found |
| `ICN-1321` | 400 | Invalid line item data |
| `ICN-1330` | 404 | Close reason not found |
| `ICN-1331` | 404 | Priority not found |

## ICN-1400 -- ICN-1499: Deal Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1400` | 404 | Deal not found |
| `ICN-1401` | 400 | Invalid deal data |
| `ICN-1402` | 400 | Deal status transition not allowed |
| `ICN-1410` | 404 | Contract not found |
| `ICN-1420` | 404 | Invoice not found |
| `ICN-1421` | 400 | Invoice already paid |

:::note
Deal error codes (ICN-1400 series) are reserved for Sprint 5 (Deals Module).
:::

## ICN-1500 -- ICN-1599: Project Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1500` | 404 | Project not found |
| `ICN-1501` | 400 | Invalid project data |
| `ICN-1502` | 400 | Project phase transition not allowed |
| `ICN-1510` | 404 | Phase not found |
| `ICN-1520` | 400 | Task dependency cycle detected |

:::note
Project error codes (ICN-1500 series) are reserved for Sprint 8 (Projects Module).
:::

## ICN-1600 -- ICN-1699: Support Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-1600` | 404 | Ticket not found |
| `ICN-1601` | 400 | Invalid ticket data |
| `ICN-1602` | 400 | Ticket status transition not allowed |
| `ICN-1610` | 404 | SLA policy not found |

:::note
Support error codes (ICN-1600 series) are reserved for Sprint 10 (Support Tickets).
:::

## ICN-9000 -- ICN-9099: Generic / Validation Errors

| Code | HTTP | Description |
|------|------|-------------|
| `ICN-9000` | 400 | Generic validation error |
| `ICN-9001` | 400 | Required field missing |
| `ICN-9002` | 400 | Invalid field format |
| `ICN-9003` | 400 | Value out of allowed range |
| `ICN-9004` | 400 | Invalid UUID format |
| `ICN-9005` | 400 | Invalid date format |
| `ICN-9010` | 413 | File too large |
| `ICN-9011` | 400 | Unsupported file type |
| `ICN-9020` | 403 | Admin access required |
| `ICN-9021` | 403 | Insufficient module permissions |
| `ICN-9022` | 403 | Record access denied |
| `ICN-9023` | 403 | Field is read-only |
| `ICN-9030` | 500 | Internal server error |
| `ICN-9031` | 503 | Database connection error |
| `ICN-9032` | 503 | Redis connection error |
| `ICN-9033` | 503 | Email service unavailable |

## Handling Errors in the Frontend

### Centralized Error Handler

```typescript
import { AxiosError } from 'axios';

interface ApiError {
  statusCode: number;
  message: string;
  errorCode?: string;
  details?: string[];
}

export function handleApiError(error: AxiosError<ApiError>) {
  const data = error.response?.data;

  if (!data) {
    return 'Network error. Please check your connection.';
  }

  // Handle specific error codes
  switch (data.errorCode) {
    case 'ICN-1002':
      // Token expired — should be handled by interceptor
      return 'Session expired. Please log in again.';

    case 'ICN-1201':
      return 'A lead with this email already exists.';

    case 'ICN-1203':
      return `Please fill in the required fields: ${data.details?.join(', ')}`;

    case 'ICN-9021':
      return 'You do not have permission to perform this action.';

    default:
      return data.message || 'An unexpected error occurred.';
  }
}
```

### Using in Components

```typescript
try {
  await leadsApi.create(formData);
  toast.success('Lead created successfully');
} catch (err) {
  const message = handleApiError(err as AxiosError<ApiError>);
  toast.error(message);
}
```

## Custom Error Responses

Backend services throw typed exceptions that NestJS converts to standard error responses:

```typescript
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

// 400 Bad Request
throw new BadRequestException({
  message: 'Required stage fields not provided',
  errorCode: 'ICN-1203',
  details: ['amount is required', 'close_date is required'],
});

// 404 Not Found
throw new NotFoundException({
  message: 'Lead not found',
  errorCode: 'ICN-1200',
});

// 409 Conflict
throw new ConflictException({
  message: 'Duplicate lead detected',
  errorCode: 'ICN-1201',
  details: ['A lead with email alice@startup.io exists in stage "Qualified"'],
});

// 403 Forbidden
throw new ForbiddenException({
  message: 'Insufficient permissions',
  errorCode: 'ICN-9021',
});
```
