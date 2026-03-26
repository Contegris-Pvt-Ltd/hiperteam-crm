---
sidebar_position: 9
title: "Managing Contacts"
description: "Create, search, filter, edit, and delete contacts in IntelliSales CRM."
---

# Managing Contacts

This chapter covers the day-to-day operations for working with contacts — viewing the list, searching, creating new contacts, editing existing ones, and removing contacts you no longer need.

## Contacts List View

Navigate to **Contacts** in the sidebar to see the contacts list. The list displays contacts in a data table with configurable columns.

By default, visible columns include:
- Name (first + last)
- Email
- Phone
- Company
- Job Title
- Owner
- Created Date

![Screenshot: Contacts list view with data table showing multiple contacts](../../static/img/screenshots/contacts/contacts-list-view.png)

For details on table features like column resizing, sorting, and pagination, see [Data Tables](./data-tables.md).

## Searching Contacts

Use the **search bar** at the top of the contacts list to perform full-text search. The search matches against:

- First and last name
- Email address
- Phone number
- Company name

Results update as you type, filtering the list in real time.

## Sorting and Filtering

### Sorting
Click any **column header** to sort the list by that column. Click again to toggle between ascending and descending order. An arrow icon indicates the active sort direction.

### Filtering
Use the filter controls above the data table to narrow down results:

- **Status filter** — show contacts of a specific status
- **Owner filter** — show contacts owned by a specific user
- **Date range** — filter by creation or modification date
- **Custom field filters** — filter on any custom field values

## Column Customization

To show or hide columns in the contacts list:

1. Click the **column settings icon** (grid or columns icon) above the data table.
2. A modal opens listing all available columns.
3. Toggle columns on or off using checkboxes.
4. Click **Apply** to update the table.

Your column preferences are saved and persist across sessions.

:::tip
Hide columns you rarely use to reduce visual clutter. You can always re-enable them later.
:::

## Creating a New Contact

1. Click the **+ New Contact** button at the top of the contacts list.
2. The contact creation form opens with the following sections:
   - **Basic Information** — first name, last name, email, phone
   - **Professional Details** — job title, department, company
   - **Address** — street, city, state, zip, country
   - **Social Profiles** — LinkedIn, Twitter, website
   - **Custom Fields** — any admin-configured custom fields
3. Fill in the required fields (marked with a red asterisk *).
4. Click **Save** to create the contact.

:::warning
Required fields are configured by your administrator. The form will not submit until all required fields are filled. Check for validation messages highlighted in red below any incomplete fields.
:::

![Screenshot: New contact creation form with fields and Save button](../../static/img/screenshots/contacts/create-contact.png)

## Editing a Contact

1. Open the contact you want to edit by clicking its row in the list.
2. On the contact detail page, click the **Edit** button.
3. Modify the desired fields.
4. Click **Save** to apply changes.

Alternatively, from the list view:
1. Click the **actions menu** (three dots) on the contact's row.
2. Select **Edit**.

## Deleting a Contact

1. Open the contact or find it in the list.
2. Click the **actions menu** (three dots).
3. Select **Delete**.
4. Confirm the deletion in the dialog.

:::info
Contacts are **soft-deleted** — they are hidden from normal views but retained in the database. This protects against accidental data loss. Contact your administrator if you need to recover a deleted contact.
:::

## Quick Create Contact Modal

In many places across the platform — such as when adding a contact role to an opportunity or linking a contact to a lead — you can create a new contact inline without leaving the current page:

1. Look for a **"+ New Contact"** or **"Create Contact"** link in the contact selection dropdown.
2. A modal form opens with essential contact fields.
3. Fill in the basic information and click **Save**.
4. The new contact is automatically linked to the current record.

This saves time when you need to quickly add a new person while working in another module.
