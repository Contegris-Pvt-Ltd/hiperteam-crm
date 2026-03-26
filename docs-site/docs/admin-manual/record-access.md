---
sidebar_position: 9
title: "Record Access & Scoping"
description: "Configure record-level access scoping in IntelliSales CRM — control which records users can see based on ownership, teams, departments, and reporting lines."
---

# Record Access & Scoping

Record access scoping is the second layer of RBAC. While [module permissions](./roles-permissions.md) control what actions a user can perform, record access controls **which records** they can see and act on.

## Scope Levels

Each role can be configured with one of five scope levels **per module**:

| Scope | Records Visible | Typical User |
|-------|----------------|--------------|
| **Own** | Only records the user created or is assigned to | Sales reps, individual contributors |
| **Team** | Own records + records owned by members of the same team(s) | Team leads, collaborative sales teams |
| **Department** | Own records + all records from users in the same department and sub-departments | Department managers, regional directors |
| **Reporting Line** | Own records + records from all direct and indirect reports (down the org chart) | VPs, senior managers with cross-team oversight |
| **All** | Every record in the tenant | Admins, executives, operations staff |

![Screenshot: Record access scope configuration per role](../../static/img/screenshots/admin/record-access-scope.png)

## How Scoping Works Per Module

Record access is configured independently for each module. A role might have:

- **Leads**: Team scope (see your team's leads)
- **Contacts**: All scope (everyone can see all contacts)
- **Opportunities**: Department scope (managers see department opportunities)
- **Tasks**: Own scope (only see your own tasks)

This per-module granularity lets you match access patterns to business needs.

## Examples of Each Scope Level

### Own Scope
**Scenario:** Sales Rep Sarah (role: User, scope: Own for Leads)
- Sarah sees only leads she created or that are assigned to her.
- She cannot see leads owned by her colleague Tom, even if they sit next to each other.

### Team Scope
**Scenario:** Sales Rep Sarah is on "Enterprise Team" with Tom and Lisa (scope: Team for Leads)
- Sarah sees her own leads plus leads owned by Tom and Lisa.
- She cannot see leads owned by Mike, who is on "SMB Team".

### Department Scope
**Scenario:** Sales Manager Dave manages the Sales department (scope: Department for Leads)
- Dave sees all leads owned by anyone in the Sales department and its sub-departments (Inside Sales, Field Sales).
- He cannot see leads owned by Marketing department members.

### Reporting Line Scope
**Scenario:** VP of Sales Karen has three managers reporting to her, each with reps below them (scope: Reporting Line for Opportunities)
- Karen sees her own opportunities plus all opportunities owned by her direct reports and their reports (her entire tree in the org chart).
- She cannot see opportunities owned by the VP of Marketing's reports.

### All Scope
**Scenario:** CRM Admin Alex (scope: All for every module)
- Alex sees every record in the system, regardless of ownership.

## Setting Record Access Per Role

1. Navigate to **Admin > Roles**.
2. Open the role you want to configure.
3. Switch to the **Record Access** tab.
4. For each module, select the scope level from the dropdown.
5. Click **Save**.

:::info
Changes to record access take effect when the user's JWT token refreshes. For immediate effect, ask users to log out and log back in.
:::

## Common Configurations

| Role | Leads | Opportunities | Contacts | Tasks | Reports |
|------|-------|---------------|----------|-------|---------|
| **Sales Rep** | Own | Own | All | Own | Own |
| **Sales Manager** | Team | Team | All | Team | Department |
| **Sales Director** | Department | Department | All | Department | Department |
| **VP Sales** | Reporting Line | Reporting Line | All | All | All |
| **Admin** | All | All | All | All | All |
| **Support Agent** | Own | — | All | Own | Own |
| **Marketing** | — | — | All | Own | Department |

:::tip
Most organizations make **Contacts** and **Accounts** accessible to all users (scope: All) since contact information is widely needed. Restrict access on revenue-sensitive modules like Leads and Opportunities.
:::

## Impact on List Views, Reports, and Dashboards

Record access scoping affects every surface that displays data:

- **List views** — Users only see records within their scope. Filters and searches are pre-scoped.
- **Reports** — Report results are automatically filtered by the viewer's scope. A manager's report shows more data than a rep's report for the same query.
- **Dashboards** — Dashboard widgets respect scoping. A "Total Pipeline Value" widget shows different numbers for different users based on their scope.
- **Search results** — Global search only returns records within the user's scope.

:::warning
When building reports or dashboards for team use, remember that each viewer sees different data. If you need a "company-wide" dashboard, ensure the viewing role has "All" scope for the relevant modules — or create it under an admin account and share as a public dashboard.
:::

## DataAccessService Behavior

For technical context, the backend `DataAccessService` automatically adds SQL `WHERE` clauses based on the requesting user's scope. This means:

- Scoping is enforced at the **database query level**, not just the UI.
- There is no way to bypass scoping through API calls — the JWT payload determines what the user can access.
- Custom reports and API integrations also respect scoping unless the API key has explicit override permissions.

## Best Practices

1. **Default to restrictive** — start with "Own" scope and expand only as needed.
2. **Use Team scope for collaborative groups** — it is the most natural fit for sales teams.
3. **Make shared data "All" scope** — contacts, accounts, and products are usually shared across the org.
4. **Test with a real user** — after configuring scoping, log in as a user with that role to verify they see the correct records.
5. **Document your scoping model** — create an internal table (like the one above) so new admins understand the design.

---

Next: [Field Permissions](./field-permissions.md) — Control field-level visibility and editability per role.
