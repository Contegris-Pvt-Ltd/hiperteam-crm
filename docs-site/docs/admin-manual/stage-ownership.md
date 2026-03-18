---
sidebar_position: 16
title: "Stage Ownership"
description: "Configure stage ownership and field visibility per stage in Intellicon CRM — assign users, teams, or roles as stage owners and control which fields appear at each stage."
---

# Stage Ownership

Stage ownership extends the [pipeline system](./pipelines-stages.md) by allowing you to assign responsibility for each stage to a specific user, team, or role. Combined with per-stage field visibility, this creates a powerful workflow where the right people see the right information at every step.

## Stage Ownership Concept

In many organizations, different stages of a pipeline are handled by different people or groups:

- **Qualification** — handled by SDR team
- **Discovery** — handled by Account Executives
- **Proposal** — handled by Solutions Engineers
- **Negotiation** — handled by Sales Managers
- **Legal Review** — handled by Legal team

Stage ownership formalizes this by assigning an **owner** to each stage. When a record enters a stage, the stage owner is notified and responsible.

## Owner Types

Each stage can be assigned one of three owner types:

| Type | Description | Use Case |
|------|-------------|----------|
| **User** | A specific individual user | Small teams where one person handles a stage |
| **Team** | An entire team | Round-robin or shared responsibility within a team |
| **Role** | All users with a specific role | Any user with the matching role can handle the stage |

![Screenshot: Stage ownership configuration](../../static/img/screenshots/admin/stage-ownership-config.png)

## Configuring Ownership Per Stage

1. Navigate to the relevant settings page:
   - **Admin > Lead Settings > Stage Ownership tab**
   - **Admin > Opportunity Settings > Stage Ownership tab**
2. Select the pipeline.
3. For each stage, click **Configure Ownership**.
4. Select the **owner type** (User, Team, or Role).
5. Select the specific user, team, or role from the dropdown.
6. Click **Save**.

### Example Configuration

| Stage | Owner Type | Owner |
|-------|-----------|-------|
| New | Team | SDR Team |
| Qualified | Role | Account Executive |
| Proposal | User | Jane Smith (Solutions Engineer) |
| Negotiation | Team | Sales Leadership |
| Closed | Role | Admin |

:::info
If no ownership is configured for a stage, the record's assigned owner remains responsible. Stage ownership is an **optional** enhancement to the standard ownership model.
:::

## Field Visibility Per Stage

In addition to ownership, you can control which fields are visible at each stage. This keeps forms clean by showing only relevant information.

### Configuring Field Visibility

1. Open the stage ownership settings.
2. Select a stage.
3. Switch to the **Field Visibility** tab.
4. For each field, toggle:
   - **Visible** — the field appears when the record is at this stage
   - **Hidden** — the field is not shown at this stage
5. Save.

### Example: Field Visibility

| Field | New | Qualified | Proposal | Negotiation | Closed |
|-------|-----|-----------|----------|-------------|--------|
| Contact Name | Visible | Visible | Visible | Visible | Visible |
| Budget | Hidden | Visible | Visible | Visible | Visible |
| Proposal Doc | Hidden | Hidden | Visible | Visible | Visible |
| Discount % | Hidden | Hidden | Hidden | Visible | Visible |
| Contract | Hidden | Hidden | Hidden | Visible | Visible |
| Close Reason | Hidden | Hidden | Hidden | Hidden | Visible |

:::tip
Use stage-based field visibility to **progressively reveal** fields as a deal advances. Early stages need minimal fields (reduce data entry friction), while later stages require detailed information.
:::

## Record Stage Assignments

When a record moves to a stage with configured ownership, the system creates a **stage assignment** record that tracks:

- Which record was assigned
- Which stage it entered
- Who the stage owner is
- When the assignment happened
- How long the record spent at the stage (calculated on exit)

This data powers stage-level analytics:
- Average time per stage
- Bottleneck identification
- Owner workload analysis

## Impact on Notifications and Workflow

Stage ownership integrates with other systems:

- **Notifications** — When a record enters an owned stage, the stage owner receives a notification (configurable in [Notification Settings](./notification-settings.md)).
- **Workflows** — Stage change triggers in [Workflows](./workflow-builder.md) can reference the stage owner for assignment and notification actions.
- **Dashboards** — Stage-specific widgets can show data filtered by stage owner.

:::warning
If a stage owner (user) is [deactivated](./users-management.md), records entering that stage will not have a responsible party. Update stage ownership before deactivating users who are stage owners.
:::

## Best Practices

1. **Use teams over users** when possible — individual assignments create single points of failure. Teams allow for coverage during absences.
2. **Align with your org structure** — stage ownership should reflect who actually handles each stage in practice.
3. **Keep field visibility progressive** — do not show all fields at every stage. Reveal information as it becomes relevant.
4. **Monitor stage duration** — use the assignment data to identify stages where records get stuck.
5. **Review ownership quarterly** — as teams change, ensure stage ownership reflects the current organization.
6. **Combine with stage fields** — use [stage fields](./pipelines-stages.md) to require data collection and stage ownership to enforce accountability.

---

Next: [Priorities](./priorities.md) — Configure priority levels for leads and opportunities.
