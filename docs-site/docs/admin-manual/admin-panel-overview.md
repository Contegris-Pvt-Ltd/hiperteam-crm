---
sidebar_position: 2
title: "Admin Panel Overview"
description: "Navigate the HiperTeam CRM admin panel — understand the sidebar structure, find settings quickly, and follow the recommended setup sequence."
---

# Admin Panel Overview

The Admin Panel is your central command center for configuring every aspect of HiperTeam CRM. This chapter provides a map of the interface so you can find any setting quickly.

## Accessing the Admin Panel

Click the **Admin** (gear) icon in the main application sidebar. The admin panel opens with its own dedicated sidebar navigation on the left and a content area on the right.

![Screenshot: Admin panel layout with sidebar and content area](../../static/img/screenshots/admin/admin-panel-layout.png)

## Admin Sidebar Menu Structure

The admin sidebar is organized into logical groups:

### People & Organization
| Menu Item | Path | Description |
|-----------|------|-------------|
| Users | `/admin/users` | Manage user accounts, invitations, deactivation |
| Departments | `/admin/departments` | Organizational hierarchy |
| Teams | `/admin/teams` | Cross-functional team management |
| Roles & Permissions | `/admin/roles` | RBAC configuration |

### Data Customization
| Menu Item | Path | Description |
|-----------|------|-------------|
| Custom Fields | `/admin/custom-fields` | Add fields to any module |
| Field Validation | `/admin/field-validation` | Validation rules per field |
| Layout Designer | `/admin/layout-designer` | Layout and form builder |

### Module Settings
| Menu Item | Path | Description |
|-----------|------|-------------|
| Lead Settings | `/admin/lead-settings` | Pipelines, scoring, routing, qualification |
| Opportunity Settings | `/admin/opportunity-settings` | Stages, types, close reasons, forecasting |
| Task Settings | `/admin/task-settings` | Types, statuses, priorities |
| Project Settings | `/admin/project-settings` | Templates, phases, statuses |
| Target Settings | `/admin/targets` | Performance targets and assignments |

### Automation & Notifications
| Menu Item | Path | Description |
|-----------|------|-------------|
| Workflows | `/admin/workflows` | Visual automation builder |
| Approval Rules | `/admin/approval-rules` | Approval chains and escalation |
| Notification Settings | `/admin/notification-settings` | Channels, templates, DND |

### Integrations & Data
| Menu Item | Path | Description |
|-----------|------|-------------|
| Integrations | `/admin/integrations` | Xero, Google Calendar, email, Zapier |
| Import/Export | `/admin/batch-jobs` | Bulk data operations and job history |
| API Keys | `/admin/api-keys` | Third-party access tokens |

### System
| Menu Item | Path | Description |
|-----------|------|-------------|
| General Settings | `/admin/general-settings` | Company info, timezone, currency |
| Audit Logs | `/admin/audit-logs` | Change history and compliance |
| Gamification | `/admin/gamification` | Badges, achievements, leaderboards |

### Customer Success
| Menu Item | Path | Description |
|-----------|------|-------------|
| Customer Success | `/admin/cs-settings` | Health score weights, product recommendations, upcoming renewals |

## Quick Reference: What Settings Are Where

:::tip Finding a Setting
Use this table when you know what you want to configure but are not sure where to find it.
:::

| I want to... | Go to |
|--------------|-------|
| Add a new user | [Users](./users-management.md) |
| Change what a role can see/do | [Roles & Permissions](./roles-permissions.md) |
| Add a dropdown field to Leads | [Custom Fields](./custom-fields.md) |
| Make a field required | [Field Validation](./field-validation.md) |
| Rearrange fields on a detail page | [Layout Designer](./page-designer.md) |
| Create a new sales pipeline | [Pipelines & Stages](./pipelines-stages.md) |
| Set up lead scoring | [Lead Settings](./lead-settings.md) |
| Configure email notifications | [Notification Settings](./notification-settings.md) |
| Connect to Xero | [Xero Integration](./xero-integration.md) |
| Bulk import contacts | [Import/Export](./import-export.md) |
| Review who changed a record | [Audit Logs](./audit-logs.md) |
| Set company timezone | [General Settings](./general-settings.md) |
| Configure health score weights | [Customer Success Settings](./customer-success-settings.md) |
| Set up upsell recommendations | [Customer Success Settings](./customer-success-settings.md) |
| View upcoming renewals | [Customer Success Settings](./customer-success-settings.md) |

## Best Practices for Admin Setup Sequence

When setting up a new HiperTeam CRM instance, follow this order to avoid dependency issues:

```
1. Roles & Permissions   ← Define access before creating users
2. Departments           ← Build org structure
3. Teams                 ← Cross-functional groupings
4. Users & Invitations   ← Onboard people with correct roles
5. Custom Fields         ← Extend the data model
6. Field Validation      ← Enforce data quality
7. Layout Designer       ← Arrange layouts
8. Pipelines & Stages    ← Define sales processes
9. Lead/Opp Settings     ← Scoring, routing, qualification
10. Notifications        ← Configure channels
11. Workflows            ← Automate repetitive tasks
12. Integrations         ← Connect external systems
```

:::warning
Do not invite users before roles and departments are configured. Users will inherit their role's permissions at login time, and changing roles later may cause confusion or access issues.
:::

## Admin Panel Navigation Tips

- **Breadcrumbs** are displayed at the top of each admin page for context.
- **Tab interfaces** are used within settings pages (e.g., Lead Settings has 7 tabs). Click tabs to switch between sub-sections without leaving the page.
- **Save buttons** appear at the bottom of forms. Changes are not auto-saved unless explicitly noted.
- **Toast notifications** confirm successful saves or report errors at the top-right corner.

![Screenshot: Admin panel breadcrumbs and tab navigation](../../static/img/screenshots/admin/admin-navigation-tabs.png)

---

Next: [User Management](./users-management.md) — Start managing your team.
