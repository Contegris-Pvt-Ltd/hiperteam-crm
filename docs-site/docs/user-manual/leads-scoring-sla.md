---
sidebar_position: 18
title: "Lead Scoring & SLA"
description: "Understand how lead scoring rules calculate scores and how SLA rules enforce first-contact deadlines."
---

# Lead Scoring & SLA

Intellicon CRM provides two powerful mechanisms to help you prioritize and manage leads effectively: **Lead Scoring** ranks leads by quality, and **SLA (Service Level Agreement)** rules ensure timely follow-up.

## Lead Scoring Overview

Lead scoring assigns a **numerical score** to each lead based on how well it matches your ideal customer profile and engagement criteria. Higher-scoring leads are more likely to convert and should receive priority attention.

![Screenshot: Lead detail page showing score badge and score breakdown panel](../../static/img/screenshots/leads/lead-scoring.png)

## How Scores Are Calculated

Scores are calculated using **rules** configured by your administrator. Each rule evaluates a specific condition and adds or subtracts points:

| Rule Component | Example |
|---|---|
| **Field** | Industry |
| **Condition** | equals "Technology" |
| **Points** | +15 |

| Rule Component | Example |
|---|---|
| **Field** | Company Size |
| **Condition** | greater than 100 |
| **Points** | +10 |

| Rule Component | Example |
|---|---|
| **Field** | Source |
| **Condition** | equals "Cold Call" |
| **Points** | -5 |

Rules are evaluated whenever a lead is created or updated. The total score is the sum of all matching rule point values.

:::info
Lead scoring rules are configured by administrators under **Admin > Lead Settings > Scoring**. If you believe a scoring rule needs adjustment, discuss it with your admin.
:::

## Viewing Your Lead Score

The lead's score is visible in several places:

- **Lead detail page** — a score badge in the header area
- **Kanban cards** — score displayed on each card (if configured)
- **List view** — score column in the data table
- **Dashboards** — scoring-related widgets

## Score Breakdown

On the lead detail page, you can view a **score breakdown** that lists:

- Each scoring rule that matched the lead
- The points contributed by each rule (positive or negative)
- The total accumulated score

This transparency helps you understand why a lead has a particular score and what changes might improve it.

:::tip
When working a lead, review the score breakdown to understand what makes it valuable. If a high-scoring lead has specific characteristics (like a large budget or a decision-maker title), tailor your approach accordingly.
:::

## SLA Overview

SLA (Service Level Agreement) rules define **time limits** for responding to and acting on leads. They ensure that no lead sits unattended for too long, which is critical for maintaining prospect engagement.

Common SLA rules:
- **First contact deadline** — the lead must receive initial outreach within X hours of creation
- **Follow-up deadline** — after initial contact, follow-up must occur within Y hours
- **Stage dwell time** — a lead should not stay in a single stage longer than Z days

## SLA Indicators

Leads display color-coded SLA status indicators throughout the platform:

| Color | Status | Meaning |
|---|---|---|
| **Green** | On Track | Plenty of time remaining before the SLA deadline |
| **Yellow** | Warning | Approaching the SLA deadline — take action soon |
| **Red** | Breached | The SLA deadline has passed — requires immediate attention |

SLA indicators appear on:
- Lead detail page
- Kanban cards
- List view rows
- Dashboard widgets

![Screenshot: Lead list showing SLA indicators — green, yellow, and red badges on different leads](../../static/img/screenshots/leads/sla-indicators.png)

## SLA Breach Notifications

When a lead's SLA is approaching breach or has been breached, the system can send **automated notifications**:

- **Warning notification** — sent when the SLA is nearing its deadline (configurable threshold)
- **Breach notification** — sent immediately when the SLA deadline passes
- **Escalation** — breached leads can be escalated to managers automatically

Notifications are sent via the channels configured in your [Notification Preferences](./your-profile.md) — in-app, email, SMS, or browser push.

:::warning
SLA breaches may be tracked in reports and affect performance metrics. Respond to SLA warning notifications promptly to avoid breaches.
:::
