---
sidebar_position: 45
title: "Scheduling"
description: "Set up public booking pages for clients to schedule meetings, view available time slots, and manage bookings."
---

# Scheduling

The **Scheduling** module allows you to create public booking pages where clients, prospects, and partners can schedule meetings with you based on your available time slots.

## Scheduling / Booking Page Overview

A booking page is a public web page that displays your availability and lets visitors pick a time to meet. This eliminates the back-and-forth of scheduling emails and ensures meetings are booked during times that work for you.

![Screenshot: Public booking page showing a calendar with available time slots](../../static/img/screenshots/scheduling/booking-page.png)

## Setting Up a Booking Page

1. Navigate to **Engagement > Scheduling** in the sidebar.
2. Click **+ New Booking Page** (or edit an existing one).
3. Configure the settings:
   - **Page Title** — the heading visitors see (e.g., "Schedule a Demo with John")
   - **Description** — context about the meeting purpose
   - **Duration** — default meeting length (15 min, 30 min, 60 min, or custom)
   - **Availability** — set which days and hours you are available
   - **Buffer Time** — minimum gap between meetings
   - **Advance Notice** — how far in advance meetings must be booked
   - **Max Bookings** — maximum meetings per day (optional)
4. Click **Save** and **Publish**.

:::tip
Set buffer time between meetings (e.g., 15 minutes) to avoid back-to-back scheduling. This gives you time for notes, preparation, and short breaks.
:::

## Public Booking Page

Once published, the booking page is accessible via a **public URL**. Share this link with prospects and clients.

The visitor experience:
1. They see a **calendar view** with your available dates highlighted.
2. They click a date to see **available time slots**.
3. They select a time slot.
4. They fill in their **name, email, and optional notes**.
5. They click **Confirm Booking**.

![Screenshot: Booking page visitor view showing date selection and available time slots](../../static/img/screenshots/scheduling/booking-visitor.png)

## Available Time Slots

Time slots are calculated based on:
- Your configured **availability hours** (e.g., Monday-Friday 9am-5pm)
- Your **calendar events** (connected via Google Calendar sync — busy times are excluded)
- **Buffer time** between meetings
- **Advance notice** requirements
- **Existing bookings** on the same page

:::info
For accurate availability, connect your Google Calendar. The system automatically blocks times where you have existing events, preventing double-booking.
:::

## Booking Confirmation

When a visitor books a meeting:

1. **Confirmation page** — the visitor sees a success message with the meeting details.
2. **Confirmation email** — both you and the visitor receive an email with:
   - Meeting date and time
   - Duration
   - Visitor's name and email
   - Any notes they provided
   - Calendar invite attachment (.ics file)
3. **CRM record** — a task or calendar entry is created in IntelliSales CRM linked to the visitor's contact record (if one exists).

## Integration with Tasks and Calendar

Booked meetings integrate with the CRM:

- A **task** of type "Meeting" is automatically created for the booked time
- If [Google Calendar Sync](./tasks-calendar-sync.md) is connected, the meeting appears on your Google Calendar
- If the visitor's email matches an existing contact, the task is linked to that contact
- The booking appears on your [Tasks Calendar View](./tasks-views.md)

:::note
If the visitor is a new person (no matching contact), you can manually create a contact and link the meeting task to them afterward.
:::

### Managing Bookings

View and manage your bookings:
1. Navigate to **Engagement > Scheduling**.
2. Click a booking page to see its **Bookings** tab.
3. View upcoming and past bookings with visitor name, date, and status.
4. **Cancel** a booking if needed — the visitor will be notified.
5. **Reschedule** by cancelling and asking the visitor to rebook.
