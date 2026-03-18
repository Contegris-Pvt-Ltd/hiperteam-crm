---
sidebar_position: 8
title: "Roles & Permissions"
description: "Configure role-based access control (RBAC) in Intellicon CRM — define module permissions, create custom roles, and manage the permission matrix."
---

# Roles & Permissions

Intellicon CRM uses a comprehensive **Role-Based Access Control (RBAC)** system with three layers: Module Permissions, Record Scope, and Field Permissions. This chapter covers the first layer — module-level permissions and role management.

## RBAC Overview

The permission system has three distinct layers:

| Layer | Controls | Configured In |
|-------|----------|---------------|
| **Module Permissions** | What actions a user can perform per module (view, create, edit, delete, export, import, invite) | This page |
| **[Record Access](./record-access.md)** | Which records a user can see (own, team, department, reporting line, all) | Record Access settings |
| **[Field Permissions](./field-permissions.md)** | Which fields are visible, read-only, or editable per role | Field Permissions settings |

## The Permission Matrix

The matrix covers **18 modules** and **7 actions**:

### Modules
`contacts` · `accounts` · `leads` · `opportunities` · `deals` · `tasks` · `projects` · `reports` · `users` · `roles` · `settings` · `admin` · `targets` · `gamification` · `notifications` · `forms` · `email`

### Actions
| Action | Description |
|--------|-------------|
| **view** | See records in lists and detail pages |
| **create** | Create new records |
| **edit** | Modify existing records |
| **delete** | Soft-delete records |
| **export** | Export data to CSV/Excel |
| **import** | Bulk import data |
| **invite** | Send invitations (users module only) |

![Screenshot: Permission matrix grid](../../static/img/screenshots/admin/permission-matrix.png)

## System Roles

Three built-in roles are provided out of the box and **cannot be deleted**:

| Role | Level | Description |
|------|-------|-------------|
| **Admin** | 100 | Full access to all modules and admin panel. Can manage users, roles, and all settings. |
| **Manager** | 50 | Can view, create, and edit across most modules. Can see team/department records. Cannot access admin settings. |
| **User** | 10 | Standard access. Typically limited to own records. Can create and edit within assigned modules. |

:::warning
System roles cannot be deleted or renamed, but their permissions **can** be modified. Be cautious when editing system roles — changes affect all users assigned to that role.
:::

## Creating Custom Roles

1. Navigate to **Admin > Roles**.
2. Click **Add Role**.
3. Fill in the form:
   - **Name** (required) — e.g., "Sales Rep", "Marketing Coordinator", "Support Agent"
   - **Description** (optional) — explain the role's purpose
   - **Level** (required) — a number between 0 and 100 that determines hierarchy
4. Configure the **permission matrix** — toggle each action on/off for each module.
5. Click **Create Role**.

![Screenshot: Create custom role form](../../static/img/screenshots/admin/create-role.png)

### Role Level Hierarchy

The role level is a numeric value (0-100) that determines authority ranking:

- Higher levels can manage users with lower levels.
- Level 100 is reserved for admin-equivalent roles.
- A user with level 50 cannot modify users at level 50 or above.
- Use levels like 10, 20, 30, 50 to create clear tiers.

:::info
Role level is separate from permissions. A level-50 role with only `contacts.view` permission can see contacts but cannot do much else — the level only affects who can manage whom.
:::

## Cloning Existing Roles

To create a new role based on an existing one:

1. Open the role you want to clone.
2. Click **Clone Role**.
3. A new role form opens pre-populated with all the same permissions.
4. Change the name and adjust permissions as needed.
5. Click **Create Role**.

:::tip
Cloning is the fastest way to create variations. For example, clone "Sales Rep" to create "Senior Sales Rep" with additional export permissions.
:::

## Editing Role Permissions

1. Open the role from the roles list.
2. Use the **permission grid** — rows are modules, columns are actions.
3. Click checkboxes to toggle permissions on/off.
4. Click **Save Changes**.

The grid provides a clear visual overview:

```
Module          | View | Create | Edit | Delete | Export | Import | Invite
----------------|------|--------|------|--------|--------|--------|-------
Contacts        |  ✓   |   ✓    |  ✓   |   ✗    |   ✓    |   ✗    |   -
Leads           |  ✓   |   ✓    |  ✓   |   ✗    |   ✓    |   ✓    |   -
Opportunities   |  ✓   |   ✓    |  ✓   |   ✗    |   ✗    |   ✗    |   -
Tasks           |  ✓   |   ✓    |  ✓   |   ✓    |   ✗    |   ✗    |   -
Users           |  ✓   |   ✗    |  ✗   |   ✗    |   ✗    |   ✗    |   ✗
```

## Module Permissions Explained

| Module | Key Permissions |
|--------|----------------|
| **contacts** | Access to contact records |
| **accounts** | Access to company/organization records |
| **leads** | Access to lead pipeline |
| **opportunities** | Access to opportunity pipeline |
| **deals** | Access to closed deals |
| **tasks** | Access to task management |
| **projects** | Access to project management |
| **reports** | Access to report builder and viewing |
| **users** | User management (admin area); invite permission for sending invitations |
| **roles** | Role configuration (typically admin only) |
| **settings** | General settings access |
| **admin** | Admin panel access |
| **targets** | Target/quota management |
| **gamification** | Badges and leaderboard access |
| **notifications** | Notification preferences |
| **forms** | Form builder access |
| **email** | Email integration features |

## Best Practices for Role Design

1. **Start with the principle of least privilege** — give each role only the permissions it needs.
2. **Use descriptive names** — "Inside Sales Rep" is better than "Role 4".
3. **Create role tiers** — establish clear levels (Rep: 10, Senior Rep: 20, Manager: 50, Director: 70, Admin: 100).
4. **Clone and modify** — do not build complex roles from scratch.
5. **Document your roles** — maintain an internal wiki page explaining each role's purpose and permissions.
6. **Review quarterly** — permissions requirements change as the business evolves.
7. **Test before deploying** — create a test user with the new role and verify access before rolling it out.

:::danger Common Mistakes
- Giving all users the `admin` module permission — this grants access to the entire admin panel.
- Setting all roles to level 100 — this makes everyone an admin-equivalent.
- Forgetting to set `view` permission — a user with `create` but not `view` can create records but cannot see them afterward.
:::

---

Next: [Record Access](./record-access.md) — Control which records each role can see.
