---
sidebar_position: 21
title: "Project Settings"
description: "Configure project management settings in Intellicon CRM — statuses, templates, custom fields, phase templates, and task templates."
---

# Project Settings

Project Settings control how projects are structured and managed within Intellicon CRM. Configure statuses, create reusable templates, and define standard phases and task structures.

Navigate to **Admin > Project Settings**.

![Screenshot: Project Settings page](../../static/img/screenshots/admin/project-settings-page.png)

## Project Statuses

Project statuses track the lifecycle of a project from initiation to completion.

### Configuring Statuses

1. Select the **Statuses** tab.
2. Click **Add Status** to create a new status.
3. Configure:
   - **Name** (required) — e.g., "Planning", "In Progress", "On Hold", "Completed", "Cancelled"
   - **Color** — visual identifier
   - **Order** — progression sequence
4. Save.

### Recommended Status Set

| Order | Status | Color | Description |
|-------|--------|-------|-------------|
| 1 | Planning | Gray | Project is being scoped and planned |
| 2 | Not Started | Blue-gray | Planned but work has not begun |
| 3 | In Progress | Blue | Active work underway |
| 4 | On Hold | Amber | Paused due to dependencies or issues |
| 5 | Review | Purple | Deliverables under review |
| 6 | Completed | Green | All deliverables finished |
| 7 | Cancelled | Red | Project was abandoned |

:::info
The first status in the list is used as the default for new projects. Ensure it represents the initial state (typically "Planning" or "Not Started").
:::

## Project Templates

Templates are reusable project structures that standardize how projects are set up. Instead of creating every project from scratch, select a template to pre-populate phases, tasks, and settings.

### Creating a Project Template

1. Select the **Templates** tab.
2. Click **Create Template**.
3. Configure:
   - **Template Name** (required) — e.g., "Standard Implementation", "Website Redesign", "Onboarding"
   - **Description** — what this template is for
   - **Default Status** — initial status for projects using this template
   - **Estimated Duration** — typical project length in days
4. Save the template.

![Screenshot: Create project template form](../../static/img/screenshots/admin/create-project-template.png)

### Using Templates

When a user creates a new project, they can select a template. The project is created with all the template's phases and tasks pre-populated. Users can then customize the specific project as needed.

:::tip
Create templates for your most common project types. An implementation team might have templates for "Small Implementation (30 days)", "Medium Implementation (60 days)", and "Enterprise Implementation (90 days)".
:::

## Custom Project Fields

Add module-specific custom fields to projects through the [Custom Fields](./custom-fields.md) page (select "Projects" as the module). Common custom fields for projects include:

- **Budget** (Currency)
- **Client Sponsor** (Text)
- **Risk Level** (Select: Low / Medium / High)
- **Go-Live Date** (Date)
- **Project Code** (Text)

## Phase Templates

Phases break a project into major milestones or workstreams. Phase templates define the standard phases within a project template.

### Creating Phase Templates

1. Open a project template.
2. Switch to the **Phases** tab.
3. Click **Add Phase**.
4. Configure:
   - **Phase Name** (required) — e.g., "Discovery", "Design", "Development", "Testing", "Launch"
   - **Order** — sequence within the project
   - **Estimated Duration** — days allocated to this phase
   - **Description** — what this phase covers
5. Save.

### Example: Implementation Project Phases

| Order | Phase | Duration | Description |
|-------|-------|----------|-------------|
| 1 | Discovery & Planning | 5 days | Gather requirements and create project plan |
| 2 | Configuration | 10 days | Set up the system to match requirements |
| 3 | Data Migration | 5 days | Import and validate customer data |
| 4 | User Training | 3 days | Train end users on the system |
| 5 | UAT & Go-Live | 5 days | User acceptance testing and launch |

## Task Templates Within Phases

Each phase can have pre-defined tasks that are created when a project uses the template.

### Creating Task Templates

1. Open a phase within a project template.
2. Click **Add Task Template**.
3. Configure:
   - **Task Name** (required) — e.g., "Conduct stakeholder interviews"
   - **Task Type** — from configured [task types](./task-settings.md)
   - **Estimated Hours** — time estimate
   - **Description** — what needs to be done
   - **Relative Due Date** — days from phase start (e.g., "+3 days")
   - **Assignee Role** — which role should handle this task (actual person assigned at project creation)
4. Save.

![Screenshot: Task templates within a phase](../../static/img/screenshots/admin/task-templates.png)

:::warning
Task templates create real tasks when a project is instantiated from the template. Ensure task names and descriptions are generic enough to apply across different project instances.
:::

## Best Practices

1. **Build templates from experience** — create templates based on projects you have already completed successfully.
2. **Keep templates maintained** — update templates as your processes evolve.
3. **Use realistic time estimates** — over-optimistic estimates set projects up for failure.
4. **Include buffer phases** — add review or buffer time between major phases.
5. **Define dependencies in tasks** — note which tasks depend on others completing first (task dependencies are managed at the project level).
6. **Version your templates** — when making significant changes, create a new template version rather than modifying the existing one.

---

Next: [Targets Setup](./targets-setup.md) — Configure performance targets and assignments.
