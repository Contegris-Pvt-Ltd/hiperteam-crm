---
sidebar_position: 31
title: "Calendar Sync"
description: "Connect Google Calendar for two-way sync between HiperTeam CRM tasks and calendar events."
---

# Calendar Sync

HiperTeam CRM integrates with **Google Calendar** to provide two-way synchronization between your CRM tasks and your calendar events. This ensures your schedule stays consistent across both platforms.

## Google Calendar Integration Overview

The calendar sync feature:

- Creates Google Calendar events from CRM tasks with due dates
- Creates CRM tasks from Google Calendar events
- Keeps changes synchronized in both directions
- Runs automatically on a schedule

![Screenshot: Calendar sync settings page showing Google Calendar connection status](../../static/img/screenshots/tasks/calendar-sync-settings.png)

## Connecting Google Calendar

To set up the integration:

1. Navigate to your **profile settings** or **calendar sync settings**.
2. Click **Connect Google Calendar**.
3. You will be redirected to Google's authorization page.
4. Sign in to your Google account (if not already signed in).
5. Grant HiperTeam CRM permission to access your calendar.
6. You will be redirected back to HiperTeam CRM with the connection confirmed.

:::info
The integration requires permission to read and write calendar events. HiperTeam CRM only accesses the calendars you authorize — it does not access your email, contacts, or other Google services.
:::

## Two-Way Sync

Once connected, synchronization works in both directions:

### CRM to Google Calendar
When you create or update a task in HiperTeam CRM that has a due date and time:
- A corresponding event is created in your Google Calendar
- Updates to the task (title, date, time, description) sync to the calendar event
- Completing or deleting the task updates or removes the calendar event

### Google Calendar to CRM
When you create or update an event in Google Calendar:
- A corresponding task may be created in HiperTeam CRM
- Changes to the event (title, time, description) sync to the CRM task
- Deleting the event updates the linked CRM task

:::note
The two-way sync is designed to keep both systems in harmony. However, if conflicts arise (e.g., the same task is edited in both systems simultaneously), the most recent change takes precedence.
:::

## What Syncs

| CRM Task Field | Google Calendar Field |
|---|---|
| Title | Event Title |
| Description | Event Description |
| Due Date | Event Date |
| Due Time | Event Start Time |
| Assignee | Attendees (if applicable) |

## Sync Frequency

The calendar sync runs automatically on a **periodic schedule** managed by the system. Changes typically appear in the other system within a few minutes.

If you need an immediate sync:
1. Navigate to calendar sync settings.
2. Click **Sync Now** to trigger a manual synchronization.

## Troubleshooting Sync Issues

### Events not appearing in Google Calendar
- Verify the task has a **due date and time** set — tasks without times may not create calendar events
- Check that your Google Calendar connection is **active** in settings
- Try a manual **Sync Now**

### Google events not creating CRM tasks
- Ensure two-way sync is **enabled** (not one-way only)
- Check that the Google Calendar event is on a **synced calendar** (primary calendar)
- Verify the event has a future date

### Duplicate events
- This can happen if sync is disconnected and reconnected. Review and remove duplicates manually.

### Connection lost
- Google may revoke access if permissions change or the token expires
- Reconnect by clicking **Connect Google Calendar** again in settings

:::warning
If you revoke HiperTeam CRM's access in your Google account security settings, the sync will stop working. Reconnect from within HiperTeam CRM to re-authorize.
:::

![Screenshot: Calendar sync troubleshooting showing connection status and sync history](../../static/img/screenshots/tasks/calendar-sync-status.png)
