---
sidebar_position: 49
title: "Activity Timeline"
description: "View the chronological activity timeline and audit history on any CRM record — calls, emails, stage changes, and more."
---

# Activity Timeline

The **Activity Timeline** provides a chronological record of every interaction and event related to a CRM record. It appears on detail pages for contacts, leads, opportunities, accounts, and other entities.

## Activity Timeline Overview

The timeline is a living log of everything that has happened with a record — from its creation through every update, communication, and milestone. It helps you quickly understand the full context of a relationship without reading through individual tabs.

![Screenshot: Activity timeline on a lead detail page showing calls, emails, stage changes, and notes](../../static/img/screenshots/shared/activity-timeline.png)

## Timeline Events

The timeline captures many types of events:

| Event Type | Description |
|---|---|
| **Record Created** | When the record was first created |
| **Record Updated** | When any field was changed |
| **Stage Changed** | When the record moved to a new pipeline stage |
| **Email Sent/Received** | Email communications linked to the record |
| **Call Logged** | Phone calls logged against the record |
| **Meeting Held** | Meetings associated with the record |
| **Note Added** | Notes written on the record |
| **Task Created/Completed** | Tasks linked to the record |
| **Document Uploaded** | Files attached to the record |
| **Owner Changed** | Record ownership reassigned |
| **Score Changed** | Lead score updated (for leads) |
| **Converted** | Lead converted to contact/account/opportunity |
| **Approval Requested/Decided** | Approval workflow events |
| **Workflow Triggered** | Automated actions executed |

Each event entry shows:
- **Icon** — indicating the event type (email, phone, calendar, edit, etc.)
- **Description** — what happened
- **User** — who performed the action (with avatar)
- **Timestamp** — when it happened
- **Details** — additional context (e.g., stage names, field values)

## Change History (Audit Log)

The **History** tab (separate from the Activity tab) provides a detailed **audit log** showing field-level changes:

For each change, you can see:
- **Field name** — which field was changed
- **Old value** — the previous value
- **New value** — the updated value
- **Changed by** — who made the change (with user avatar)
- **Changed at** — when the change was made

**Example:**

| Field | Old Value | New Value | Changed By | Date |
|---|---|---|---|---|
| Stage | Discovery | Proposal | Jane Smith | Mar 15, 2026 |
| Amount | $50,000 | $75,000 | Jane Smith | Mar 15, 2026 |
| Priority | Medium | High | John Doe | Mar 14, 2026 |

![Screenshot: History/audit log tab showing field changes with old and new values](../../static/img/screenshots/shared/audit-history.png)

:::info
The audit log is automatically maintained by the system. Every change is recorded without any manual input. This provides full traceability and is valuable for compliance, dispute resolution, and understanding how records evolved over time.
:::

## Filtering the Timeline

For records with extensive history, you can filter the timeline to show only specific event types:

1. Look for **filter buttons** or a **filter dropdown** above the timeline.
2. Select the event types you want to see:
   - **All** — show everything
   - **Emails** — show only email events
   - **Calls** — show only call logs
   - **Notes** — show only notes
   - **Stage Changes** — show only pipeline movements
   - **System** — show only system-generated events
3. The timeline updates to show only the selected event types.

:::tip
When preparing for a client call, filter the timeline to "Emails" to quickly review all recent email exchanges. Then filter to "Notes" to see what your colleagues have documented. This gives you full context in seconds.
:::

### Timeline vs History

| Feature | Activity Timeline | History/Audit Log |
|---|---|---|
| **Shows** | All types of interactions and events | Field-level changes only |
| **Purpose** | Understand what happened with the record | See exactly what data changed |
| **Detail** | High-level summaries | Old value vs new value |
| **Use Case** | Daily relationship management | Compliance, auditing, dispute resolution |
