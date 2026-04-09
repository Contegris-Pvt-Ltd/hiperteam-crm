---
sidebar_position: 38
title: Engagement Hub
---

# Engagement Hub

The Engagement Hub is your unified platform for lead capture, customer engagement, and meeting scheduling. Access it from the sidebar under **Engagement**.

## Forms

Create custom web forms to capture leads, collect feedback, or gather information.

### Form Types

| Type | Description |
|------|-------------|
| **Standard Forms** | Collect data and trigger CRM actions (create leads, contacts, accounts) |
| **Meeting Booking Pages** | Let visitors book meetings directly on your calendar |
| **Landing Pages** | Full-page forms with custom branding and SEO metadata |

### Creating a Form

1. Navigate to **Engagement > Forms**.
2. Click **New Form** or **New Booking Page**.
3. Use the drag-and-drop builder to add fields (text, email, phone, dropdown, checkbox, date, file upload, etc.).
4. Configure **Submit Actions** to define what happens on submission.

### Submit Actions

Actions execute in sequence when a form is submitted:

- **Create Lead** — creates a CRM lead with mapped fields, default pipeline/stage, and qualification framework
- **Create Contact** — creates a contact, auto-linked to any account created by a prior action
- **Create Account** — creates a prospect account
- **Send Email** — sends a confirmation email to the submitter with `{{field_name}}` placeholders
- **Webhook** — sends form data to an external URL via HTTP POST

### Sharing & Embedding

Forms can be shared via:
- **Direct link** — copy the public form URL
- **iFrame embed** — embed on your website
- **JavaScript snippet** — load dynamically
- **Popup modal** — trigger from a button click

### Submissions

View all submissions under a form's **Submissions** tab:
- Filter by date range and action status (success/error)
- View action results for each submission
- Retry failed webhooks

## Scheduling

Manage your booking pages and meetings.

### Booking Pages

Each booking page is a special form with calendar integration:
- Set **available time slots** per day of the week
- Configure **meeting duration** and **max days ahead**
- Automatic **Google Calendar integration** for availability checking
- **Google Meet links** generated automatically for booked meetings

### Managing Bookings

View all scheduled meetings under **Engagement > Scheduling**:
- Filter by status: confirmed, pending, cancelled
- See meeting details: time, duration, invitee info
- Link to the related lead/contact created from the booking

### Your Availability

Set your personal availability:
1. Go to **Your Profile > Availability** tab.
2. Toggle each day on/off.
3. Set start and end times for each day.
4. Save — this applies to all your booking pages.

## Workflow Integration

Forms trigger CRM workflows automatically:
- **Lead creation** from a form fires the `lead_created` workflow trigger
- **Contact creation** fires `contact_created`
- **Account creation** fires `account_created`

This means automated assignment, task creation, and notifications happen instantly when someone submits your form.
