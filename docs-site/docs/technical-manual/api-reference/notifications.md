---
sidebar_position: 11
title: "Notifications API"
description: "Complete endpoint reference for user notifications, preferences, push subscriptions, and admin notification settings"
---

# Notifications API

Base path: `/notifications`

## User Notifications

### GET /notifications

Get notifications for the current user.

```bash
GET /notifications?page=1&limit=25&unreadOnly=true
Authorization: Bearer <token>
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `unreadOnly` | boolean | Show only unread notifications |

**Response (200):**

```json
{
  "data": [
    {
      "id": "notif-uuid-1",
      "type": "lead_assigned",
      "title": "New Lead Assigned",
      "message": "Alice Johnson has been assigned to you",
      "entityType": "leads",
      "entityId": "lead-uuid",
      "isRead": false,
      "createdAt": "2025-01-20T15:30:00Z"
    },
    {
      "id": "notif-uuid-2",
      "type": "task_due",
      "title": "Task Due Today",
      "message": "Send proposal to Globex is due today",
      "entityType": "tasks",
      "entityId": "task-uuid",
      "isRead": true,
      "readAt": "2025-01-20T14:00:00Z",
      "createdAt": "2025-01-20T08:00:00Z"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 25, "totalPages": 2 }
}
```

### GET /notifications/unread-count

```json
{ "count": 8 }
```

### PUT /notifications/:id/read

Mark a single notification as read.

```json
{ "success": true }
```

### PUT /notifications/read-all

Mark all notifications as read.

```json
{ "markedCount": 8 }
```

### DELETE /notifications/:id/dismiss

Dismiss (hide) a notification.

```json
{ "success": true }
```

## Notification Preferences

### GET /notifications/preferences

Get the current user's notification preferences.

```json
[
  {
    "event": "lead_assigned",
    "label": "Lead Assigned to Me",
    "category": "leads",
    "channels": {
      "inApp": true,
      "email": true,
      "push": false,
      "sms": false
    }
  },
  {
    "event": "task_due",
    "label": "Task Due Reminder",
    "category": "tasks",
    "channels": {
      "inApp": true,
      "email": true,
      "push": true,
      "sms": false
    }
  },
  {
    "event": "opportunity_stage_change",
    "label": "Opportunity Stage Changed",
    "category": "opportunities",
    "channels": {
      "inApp": true,
      "email": false,
      "push": false,
      "sms": false
    }
  }
]
```

### PUT /notifications/preferences/:event

Update preference for a single event.

```json
{
  "channels": {
    "inApp": true,
    "email": true,
    "push": true,
    "sms": false
  }
}
```

### PUT /notifications/preferences/bulk

Update multiple preferences at once.

```json
{
  "preferences": [
    { "event": "lead_assigned", "channels": { "inApp": true, "email": true, "push": true, "sms": false } },
    { "event": "task_due", "channels": { "inApp": true, "email": false, "push": true, "sms": false } }
  ]
}
```

## Push Notifications

### GET /notifications/push/public-key

Get the VAPID public key for push subscription.

```json
{
  "publicKey": "BKe9v1..."
}
```

### POST /notifications/push/subscribe

Register a push subscription.

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BKe9v1...",
    "auth": "abc123..."
  }
}
```

### POST /notifications/push/unsubscribe

Unregister a push subscription.

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

## Admin Notification Settings

All admin endpoints require `@AdminOnly()`.

### GET /notifications/admin/templates

List notification templates.

```json
[
  {
    "id": "template-uuid",
    "event": "lead_assigned",
    "channel": "email",
    "subject": "New Lead Assigned: {{lead.name}}",
    "body": "Hi {{user.firstName}},\n\nA new lead has been assigned to you...",
    "variables": ["user.firstName", "lead.name", "lead.email", "lead.company"],
    "isActive": true
  }
]
```

### PUT /notifications/admin/templates/:id

Update a notification template.

```json
{
  "subject": "New Lead: {{lead.name}} - Action Required",
  "body": "Hi {{user.firstName}},\n\nPlease review the new lead assigned to you.\n\nLead: {{lead.name}}\nCompany: {{lead.company}}",
  "isActive": true
}
```

### GET /notifications/admin/settings

Get global notification settings.

```json
{
  "emailEnabled": true,
  "pushEnabled": true,
  "smsEnabled": false,
  "smtpConfigured": true,
  "twilioConfigured": false,
  "vapidConfigured": true,
  "digestFrequency": "daily",
  "digestTime": "08:00",
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

### PUT /notifications/admin/settings

```json
{
  "digestFrequency": "daily",
  "digestTime": "09:00",
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

### POST /notifications/admin/verify/smtp

Test SMTP configuration by sending a test email.

```json
{
  "testEmail": "admin@acme.com"
}
```

**Response:**

```json
{ "success": true, "message": "Test email sent successfully" }
```

### POST /notifications/admin/verify/twilio

Test Twilio configuration by sending a test SMS.

```json
{
  "testPhone": "+1234567890"
}
```

### POST /notifications/admin/generate-vapid

Generate new VAPID keys for push notifications.

```json
{
  "publicKey": "BKe9v1...",
  "privateKey": "encrypted...",
  "message": "VAPID keys generated. Update your environment variables."
}
```

:::warning
Generating new VAPID keys will invalidate all existing push subscriptions. Users will need to re-subscribe.
:::

### POST /notifications/admin/test

Send a test notification through all configured channels.

```json
{
  "userId": "user-uuid",
  "title": "Test Notification",
  "message": "This is a test notification from the admin panel"
}
```
