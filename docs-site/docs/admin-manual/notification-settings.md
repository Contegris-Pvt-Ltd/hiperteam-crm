---
sidebar_position: 24
title: "Notification Settings"
description: "Configure notification channels in Intellicon CRM — set up in-app, email (SMTP), SMS (Twilio), WhatsApp, and browser push (VAPID) notifications."
---

# Notification Settings

The notification system delivers timely alerts to users through multiple channels. As an admin, you configure which channels are available, how they connect to external services, and which events trigger notifications.

Navigate to **Admin > Notification Settings**.

![Screenshot: Notification settings overview](../../static/img/screenshots/admin/notification-settings.png)

## Notification Channels

Intellicon CRM supports five notification channels:

| Channel | Provider | Setup Required |
|---------|----------|---------------|
| **In-App** | Built-in | None — always available |
| **Email** | SMTP | SMTP server configuration |
| **SMS** | Twilio | Twilio account credentials |
| **WhatsApp** | WhatsApp Business API | Business API configuration |
| **Browser Push** | Web Push (VAPID) | VAPID key generation |

## In-App Notifications

In-app notifications are delivered instantly through WebSocket and appear in the notification bell icon in the application header. No external configuration is needed.

- Notifications appear as a dropdown list.
- Unread count is shown as a badge on the bell icon.
- Users can mark notifications as read or dismiss them.
- Notification history is preserved and searchable.

## Email (SMTP) Configuration

1. Select the **Email** channel tab.
2. Configure the SMTP server:
   - **SMTP Host** — e.g., `smtp.gmail.com`, `smtp.office365.com`, `email-smtp.us-east-1.amazonaws.com`
   - **SMTP Port** — typically 587 (TLS) or 465 (SSL)
   - **Username** — SMTP authentication username
   - **Password** — SMTP authentication password
   - **Encryption** — TLS or SSL
   - **From Address** — the sender email address (e.g., `notifications@yourcompany.com`)
   - **From Name** — the sender display name (e.g., "Intellicon CRM")
3. Click **Test Connection** to send a test email.
4. Click **Save**.

![Screenshot: SMTP configuration form](../../static/img/screenshots/admin/smtp-config.png)

:::warning
Store SMTP credentials securely. The password is encrypted at rest but visible to admin users on this settings page. Use a dedicated service account for SMTP, not a personal email account.
:::

### Common SMTP Configurations

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Gmail | `smtp.gmail.com` | 587 | Requires App Password (not regular password) |
| Microsoft 365 | `smtp.office365.com` | 587 | Requires OAuth or App Password |
| Amazon SES | `email-smtp.{region}.amazonaws.com` | 587 | Use IAM SMTP credentials |
| SendGrid | `smtp.sendgrid.net` | 587 | Use API key as password |

## SMS (Twilio) Configuration

1. Select the **SMS** channel tab.
2. Configure Twilio credentials:
   - **Account SID** — from your Twilio dashboard
   - **Auth Token** — from your Twilio dashboard
   - **Phone Number** — your Twilio phone number (e.g., `+15551234567`)
3. Click **Test SMS** to send a test message.
4. Click **Save**.

![Screenshot: Twilio SMS configuration](../../static/img/screenshots/admin/twilio-config.png)

:::info
Twilio charges per SMS message. Monitor your Twilio usage dashboard to control costs. Consider limiting SMS notifications to high-priority events (e.g., deal closed, urgent task assigned).
:::

## WhatsApp Configuration

1. Select the **WhatsApp** channel tab.
2. Configure the WhatsApp Business API connection.
3. This requires a WhatsApp Business Account and approved message templates.
4. Enter the API credentials and configure message templates.
5. Test the connection.
6. Save.

:::note
WhatsApp Business API requires approval from Meta. Template messages must be pre-approved before they can be used for notifications. This channel has more setup overhead than others.
:::

## Browser Push (VAPID) Configuration

Browser push notifications appear as native OS notifications even when the CRM tab is not active.

1. Select the **Browser Push** channel tab.
2. Click **Generate VAPID Keys** to create a public/private key pair.
3. The public key is shared with browsers; the private key is stored securely on the server.
4. Click **Save**.

Once configured, users are prompted to **allow notifications** in their browser when they next log in.

:::tip
Browser push is excellent for time-sensitive alerts because it reaches users even when they are in another application. Encourage your team to accept the browser permission prompt.
:::

## Channel Enable/Disable

Each channel can be toggled on or off independently:

1. Click the **toggle switch** next to the channel name.
2. Disabled channels stop delivering notifications immediately.
3. Pending notifications for disabled channels are queued and delivered when the channel is re-enabled.

## Event Types

Notifications are triggered by events in the CRM. Each event can be routed to one or more channels.

### Available Event Types

| Event | Description |
|-------|-------------|
| `task_assigned` | A task is assigned to a user |
| `task_due_soon` | A task is due within 24 hours |
| `task_overdue` | A task has passed its due date |
| `lead_assigned` | A lead is assigned to a user |
| `lead_stage_change` | A lead moves to a new pipeline stage |
| `deal_stage_change` | A deal/opportunity changes stage |
| `deal_closed_won` | A deal is marked as won |
| `deal_closed_lost` | A deal is marked as lost |
| `note_added` | A note is added to a record |
| `mention` | A user is @mentioned in a note or comment |
| `approval_requested` | An approval is requested from a user |
| `approval_completed` | An approval decision is made |
| `target_milestone` | A target reaches 50%, 75%, or 100% |
| `import_completed` | A batch import job finishes |

### Default Notification Routing

1. Select the **Event Routing** tab.
2. For each event, configure which channels deliver the notification.
3. Set defaults that apply to all users (users can override some preferences in their personal settings).

| Event | In-App | Email | SMS | Browser Push |
|-------|--------|-------|-----|-------------|
| task_assigned | Yes | Yes | No | Yes |
| deal_closed_won | Yes | Yes | Yes | Yes |
| mention | Yes | Yes | No | Yes |
| import_completed | Yes | No | No | No |

## Do Not Disturb Settings

Configure quiet hours when notifications are suppressed:

1. Select the **DND** tab.
2. Set:
   - **DND Start Time** — e.g., 20:00 (8 PM)
   - **DND End Time** — e.g., 08:00 (8 AM)
   - **DND Days** — e.g., Saturday and Sunday
   - **Override for urgent** — whether high-priority notifications bypass DND
3. Save.

:::info
DND settings configured here are the **organization default**. Individual users can adjust their own DND hours in their notification preferences, but cannot exceed the admin-set boundaries.
:::

## Best Practices

1. **Enable in-app and email first** — these are the most reliable and lowest-cost channels.
2. **Reserve SMS for critical events** — SMS has per-message costs and can be intrusive.
3. **Test every channel** — always send a test notification after configuring a new channel.
4. **Set sensible DND hours** — respect your team's work-life balance.
5. **Review event routing quarterly** — too many notifications cause alert fatigue. Only notify for actionable events.
6. **Monitor delivery** — check notification logs for failed deliveries and troubleshoot connectivity issues.

---

Next: [Notification Templates](./notification-templates.md) — Customize notification message content.
