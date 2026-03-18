---
sidebar_position: 16
title: "Lead Detail Page"
description: "Explore the lead detail page — stage journey bar, action buttons, tabs, scoring, SLA tracking, and record teams."
---

# Lead Detail Page

The lead detail page is a comprehensive view of a single lead record. It displays all the information, relationships, and history associated with that lead, and provides actions for managing its lifecycle.

## Lead Detail Layout

The header section displays:

- **Avatar** — based on the lead's contact information or initials
- **Lead Name** — displayed prominently
- **Company** — the prospect's organization
- **Priority badge** — with the corresponding priority icon
- **Stage badge** — the current pipeline stage
- **Value** — estimated monetary value
- **Owner** — assigned user with avatar

![Screenshot: Lead detail page header showing name, stage badge, priority, and value](../../static/img/screenshots/leads/lead-detail-header.png)

## Stage Journey Bar

Below the header, a **visual progress bar** shows the lead's journey through pipeline stages. Each stage is represented as a step:

- **Completed stages** — shown in solid color with a checkmark
- **Current stage** — highlighted and active
- **Future stages** — shown as outlined or grayed out
- **Timestamps** — each completed stage shows when the lead arrived and left

The stage journey bar gives an instant visual sense of how far a lead has progressed.

![Screenshot: Stage journey bar showing completed, current, and future stages with timestamps](../../static/img/screenshots/leads/stage-journey-bar.png)

## Action Buttons

The detail page provides these primary actions:

| Button | Description |
|---|---|
| **Edit** | Open the lead editing form |
| **Convert** | Convert the lead into a Contact + Account + Opportunity |
| **Disqualify** | Mark the lead as disqualified with a reason |
| **Delete** | Soft-delete the lead |

:::warning
Converting a lead is a significant action that creates new records. Make sure the lead is properly qualified before converting. See [Converting Leads](./leads-converting.md).
:::

## Tabs

The lead detail page organizes related data into the following tabs:

### Details
The main information panel showing all standard and custom fields, organized into collapsible field groups configured by your administrator.

### Accounts
Accounts linked to this lead. You can associate existing accounts or create new ones.

### Contacts
Contacts associated with this lead. Link existing contacts or quick-create new ones.

### Products
Products or services the lead is interested in. Add products from your catalog with quantities and pricing.

### Emails
Email threads related to this lead. Compose, reply, and forward emails directly from this tab.

### Notes
Free-text notes about the lead. Add conversation summaries, observations, and follow-up reminders. See [Notes & Documents](./notes-documents.md).

### Tasks
Tasks linked to this lead — follow-up calls, meetings, demos, etc. Create tasks directly from this tab. See [Tasks Overview](./tasks-overview.md).

### Documents
Files attached to this lead — proposals, presentations, RFPs, etc. See [Notes & Documents](./notes-documents.md).

### Activity
A timeline of all interactions and events related to this lead. See [Activity Timeline](./activity-timeline.md).

### History
A detailed audit log showing every change made to the lead record.

## Record Team Panel

On the side or within the detail page, the **Record Team** panel shows all users collaborating on this lead:

- **Owner** — the primary assignee (shown prominently)
- **Team members** — additional users with access to this lead

To manage the team:
1. Click **Add Member** on the team panel.
2. Search for a user.
3. Select them to add to the record team.

## Scoring Display

If lead scoring rules are configured, the detail page shows:

- **Current Score** — the lead's total score based on rule matches
- **Score Breakdown** — a list of rules that contributed to the score, with individual point values

See [Lead Scoring & SLA](./leads-scoring-sla.md) for details on how scoring works.

## SLA Tracking

If SLA rules are active, the detail page displays:

- **SLA Timer** — time remaining until the SLA deadline
- **SLA Status** — On Track (green), Warning (yellow), or Breached (red)
- **SLA Details** — which SLA rule applies and its time limits

## Stage Field Requirements

When a lead is moved to a stage that has **required fields**, a modal appears:

1. The modal lists all required fields for the target stage.
2. Fill in each required field.
3. Click **Confirm** to complete the stage change.

If you close the modal without filling in the required fields, the stage change is cancelled.

:::tip
Review required fields in advance by checking the stage configuration in your admin settings. This helps sales reps prepare information before attempting to advance leads.
:::

## Custom Field Groups

Below the main details, **collapsible field groups** display custom fields organized by your administrator. Click a group header to expand or collapse it. These groups may include categories like "Qualification Criteria," "Budget Information," or "Technical Requirements."

![Screenshot: Lead detail page showing custom field groups expanded and collapsed](../../static/img/screenshots/leads/lead-custom-fields.png)
