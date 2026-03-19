---
sidebar_position: 1
title: "Getting Started"
description: "Welcome to the HiperTeam CRM Admin Manual — learn who this guide is for, what admin access means, and how to navigate the admin panel."
---

# Getting Started with HiperTeam CRM Administration

Welcome to the **HiperTeam CRM Admin Manual**. This guide covers every configuration surface available to system administrators, from user management and role-based access control through to workflow automation, integrations, and audit compliance.

## Who Is This Guide For?

This manual is written for:

- **System Administrators** — users with the `admin` role (roleLevel = 100) who are responsible for configuring and maintaining the CRM platform.
- **Power Users** — experienced users who have been granted administrative privileges to manage specific areas such as pipelines, custom fields, or team structures.

:::info Prerequisites
You must have a user account with **roleLevel >= 100** (Admin) to access the admin panel. If you cannot see the admin menu, contact your organization's primary administrator to elevate your role.
:::

## Admin Role Requirements

HiperTeam CRM uses a **role-level hierarchy** where higher numbers indicate broader authority:

| Role | Level | Admin Access |
|------|-------|-------------|
| User | 10 | No |
| Manager | 50 | No |
| Admin | 100 | **Full** |

Only users at level 100 or above can access the `/admin` routes. The system enforces this through the `@AdminOnly()` guard on all admin endpoints.

## Accessing the Admin Panel

1. Log in to HiperTeam CRM with your admin credentials.
2. Click the **gear icon** or **Admin** link in the left sidebar.
3. You will be taken to the Admin Panel, which contains its own sidebar navigation organized by category.

![Screenshot: Admin panel entry point in the sidebar](../../static/img/screenshots/admin/admin-panel-entry.png)

:::tip
Bookmark `/admin` in your browser for quick access. The admin panel is also accessible via the keyboard shortcut displayed in the sidebar tooltip.
:::

## Admin Responsibilities Overview

As an administrator, you are responsible for:

| Area | What You Configure |
|------|--------------------|
| **People** | Users, departments, teams, org chart, invitations |
| **Access Control** | Roles, module permissions, record scoping, field permissions |
| **Data Model** | Custom fields, field validation, page layouts, custom tabs |
| **Sales Process** | Pipelines, stages, priorities, scoring, routing, qualification |
| **Automation** | Workflows, approval rules, notification templates |
| **Integrations** | Xero, Google Calendar, email, Zapier, API keys |
| **Data Operations** | Import/export, batch jobs, audit logs |
| **General** | Company settings, currency, timezone, session policies |

## Recommended Setup Sequence

If you are setting up HiperTeam CRM for the first time, follow this order:

1. **[Roles & Permissions](./roles-permissions.md)** — Define who can do what.
2. **[Departments](./departments.md)** — Create your organizational structure.
3. **[Teams](./teams.md)** — Set up cross-functional teams.
4. **[Users](./users-management.md)** — Create and invite users.
5. **[Custom Fields](./custom-fields.md)** — Tailor the data model to your business.
6. **[Layout Designer](./page-designer.md)** — Arrange field layouts.
7. **[Pipelines & Stages](./pipelines-stages.md)** — Configure your sales process.
8. **[Notifications](./notification-settings.md)** — Set up communication channels.
9. **[Integrations](./integrations-overview.md)** — Connect external tools.

:::warning
Changing roles or permissions after users have started working can disrupt their access. Plan your RBAC model before onboarding users whenever possible.
:::

## Getting Help

- **This Manual** — Covers all admin features in detail.
- **[User Manual](../user-manual/getting-started)** — For end-user guidance on daily CRM operations.
- **[Technical Manual](../technical-manual/architecture-overview)** — For developers and DevOps engineers.
- **Support** — Contact your HiperTeam CRM account manager or submit a ticket through the support portal.

---

Next: [Admin Panel Overview](./admin-panel-overview.md) — Learn how the admin interface is organized.
