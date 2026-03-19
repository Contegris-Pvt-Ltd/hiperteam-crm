---
sidebar_position: 13
title: Scheduling API
---

# Scheduling API

## Authenticated Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/scheduling/forms` | List booking forms |
| GET | `/scheduling/bookings` | List bookings (query: status, page, limit) |
| GET | `/scheduling/forms/:formId/slots?date=YYYY-MM-DD` | Get available time slots |
| GET | `/scheduling/forms/:formId/available-dates?year=&month=` | Get available dates for month |
| PUT | `/scheduling/forms/:formId/availability` | Save form-level availability |
| GET | `/scheduling/my-availability` | Get personal availability |
| PUT | `/scheduling/my-availability` | Save personal availability |
| GET | `/scheduling/users/:userId/availability` | Get another user's availability |

## Public Endpoints (No Auth)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/scheduling/public/:tenantSlug/:token` | Get public booking page |
| GET | `/scheduling/public/:tenantSlug/:token/dates?year=&month=` | Available dates |
| GET | `/scheduling/public/:tenantSlug/:token/slots?date=` | Available time slots |
| POST | `/scheduling/public/:tenantSlug/:token/book` | Create booking |
| POST | `/scheduling/public/cancel/:cancelToken` | Cancel booking |

## Booking Object

```json
{
  "id": "uuid",
  "formId": "uuid",
  "formName": "Sales Demo",
  "hostUserId": "uuid",
  "inviteeName": "Jane Smith",
  "inviteeEmail": "jane@example.com",
  "inviteePhone": "+1234567890",
  "inviteeNotes": "Interested in enterprise plan",
  "startTime": "2026-03-20T10:00:00Z",
  "endTime": "2026-03-20T10:30:00Z",
  "timezone": "America/New_York",
  "status": "confirmed",
  "locationType": "video",
  "locationValue": "https://meet.google.com/abc-def",
  "cancelToken": "cancel-token-uuid",
  "crmLeadId": "uuid",
  "crmTaskId": "uuid",
  "createdAt": "2026-03-19T..."
}
```

## Availability Window

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "isActive": true
}
```

Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday

## Meeting Configuration

```json
{
  "durationMinutes": 30,
  "bufferBefore": 0,
  "bufferAfter": 15,
  "maxDaysAhead": 30,
  "minNoticeHours": 2,
  "locationType": "video",
  "locationValue": "Google Meet",
  "confirmationMessage": "Your meeting is confirmed!",
  "crmAction": "create_lead",
  "timezone": "Asia/Karachi",
  "availabilityMode": "user",
  "teamUserIds": []
}
```
