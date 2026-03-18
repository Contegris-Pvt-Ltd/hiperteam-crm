---
sidebar_position: 3
title: "User Management"
description: "Create, edit, deactivate, and manage user accounts in Intellicon CRM — including role assignment, department placement, and activity tracking."
---

# User Management

The Users page is where you manage every person who has access to your Intellicon CRM instance. From here you can create accounts, assign roles and departments, deactivate departing employees, and monitor user activity.

## Users List

Navigate to **Admin > Users** to see the full user table.

![Screenshot: Users list table with columns](../../static/img/screenshots/admin/users-list.png)

The table displays:

| Column | Description |
|--------|-------------|
| Name | Full name with avatar |
| Email | Login email address |
| Role | Assigned RBAC role (Admin, Manager, User, or custom) |
| Department | Primary department assignment |
| Status | Active or Inactive |
| Last Login | Timestamp of most recent authentication |

### Searching and Filtering Users

- **Search bar** — Type a name or email to filter the list in real time.
- **Role filter** — Select a role from the dropdown to show only users with that role.
- **Department filter** — Filter by department.
- **Status filter** — Toggle between All, Active, and Inactive users.

:::tip
Combine filters to quickly find users. For example, filter by "Sales" department and "Inactive" status to find former sales reps.
:::

## Creating a User Directly

1. Click the **Add User** button in the top-right corner.
2. Fill in the required fields:
   - **First Name** and **Last Name**
   - **Email** — must be unique across the tenant
   - **Password** — minimum 8 characters; the user can change it later
   - **Role** — select from existing roles
3. Optionally assign:
   - **Department**
   - **Team(s)**
   - **Manager** (direct report relationship)
   - **Phone number**
   - **Job title**
4. Click **Create User**.

![Screenshot: Create user form](../../static/img/screenshots/admin/create-user-form.png)

:::warning
Creating a user directly sets their password immediately. For a more secure onboarding flow, use [Invitations](./inviting-users.md) instead, which lets the user set their own password.
:::

## Editing User Profiles

1. Click on a user's name in the list to open their profile.
2. Modify any of the following:
   - **Role** — changes take effect on the user's next API request (JWT refresh)
   - **Department** — affects record access scoping
   - **Team assignments** — add or remove team memberships
   - **Manager** — sets the reporting line (used for org chart and reporting_line scoping)
   - **Job title, phone, profile picture**
3. Click **Save Changes**.

:::info
Role and department changes affect the user's permissions immediately after their JWT token refreshes (typically within minutes). For an immediate effect, ask the user to log out and back in.
:::

## Deactivating vs. Deleting Users

Intellicon CRM uses **soft deactivation** rather than hard deletion for user accounts.

| Action | What Happens |
|--------|-------------|
| **Deactivate** | User cannot log in. All their records, history, and audit trail are preserved. The user disappears from active assignment dropdowns. |
| **Delete** | Not available through the UI. User records must be preserved for audit compliance. |

### To Deactivate a User

1. Open the user's profile.
2. Click the **Deactivate** button (or toggle the status switch).
3. Confirm the action in the dialog.

:::danger
Deactivating a user does **not** reassign their open records (leads, opportunities, tasks). You should reassign ownership before deactivating to avoid orphaned records.
:::

### To Reactivate a User

1. Filter the users list to show **Inactive** users.
2. Open the inactive user's profile.
3. Click **Activate** (or toggle the status switch back on).
4. The user can log in again with their existing credentials.

## Manager Assignment and Direct Reports

Each user can have a **Manager** field set, which builds the reporting hierarchy used for:

- The [Org Chart](./org-chart.md) visualization
- **Reporting Line** record access scoping (see [Record Access](./record-access.md))
- Target cascading from managers to their reports

To view a user's direct reports, open their profile and scroll to the **Direct Reports** section.

## Viewing User Activity

The user profile includes an **Activity** tab showing:

- Recent login timestamps
- Records created/modified count
- Tasks completed
- Pipeline activity summary

This helps administrators monitor engagement and identify inactive users who may need follow-up or deactivation.

## Best Practices for User Lifecycle

1. **Use invitations** for new hires — it is more secure than setting passwords manually.
2. **Assign roles before departments** — the role determines what the user can do; the department determines what they can see.
3. **Set managers early** — the org chart and reporting line scoping depend on this relationship.
4. **Deactivate promptly** when employees leave — do not leave stale active accounts.
5. **Reassign records first** — before deactivating, use bulk reassignment to transfer ownership of open items.
6. **Review inactive users quarterly** — audit the inactive list and clean up any accounts that should be fully removed from reporting.

---

Next: [Inviting Users](./inviting-users.md) — The recommended way to onboard new team members.
