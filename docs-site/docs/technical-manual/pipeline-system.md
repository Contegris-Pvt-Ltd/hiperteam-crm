---
sidebar_position: 12
title: "Pipeline System"
description: "Shared pipeline architecture for leads, opportunities, deals, and projects with stage management and field visibility"
---

# Pipeline System

The pipeline system is a shared architecture used across multiple modules: **Leads**, **Opportunities**, **Deals**, and **Projects**. Rather than duplicating pipeline logic per module, a single set of tables and endpoints serves all modules via a `module` column discriminator.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    pipelines                              │
│  id | name        | module         | is_default | ...    │
│  1  | Sales       | leads          | true       |        │
│  2  | Enterprise  | leads          | false      |        │
│  3  | Deal Flow   | opportunities  | true       |        │
│  4  | Projects    | projects       | true       |        │
└──────────┬───────────────────────────────────────────────┘
           │ 1:N
┌──────────▼───────────────────────────────────────────────┐
│                 pipeline_stages                           │
│  id | pipeline_id | name       | position | color | ...  │
│  1  | 1           | New        | 1        | blue  |      │
│  2  | 1           | Qualified  | 2        | green |      │
│  3  | 1           | Proposal   | 3        | amber |      │
│  4  | 1           | Closed Won | 4        | green |      │
└──────────┬───────────────────────────────────────────────┘
           │ 1:N
┌──────────▼───────────────────────────────────────────────┐
│              pipeline_stage_fields                        │
│  id | stage_id | field_name | is_required | field_type   │
│  1  | 3        | amount     | true        | number       │
│  2  | 3        | proposal   | true        | file         │
│  3  | 4        | close_date | true        | date         │
└──────────────────────────────────────────────────────────┘
```

## Tables

### pipelines

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Pipeline name |
| `module` | VARCHAR(50) | Module discriminator |
| `is_default` | BOOLEAN | Default pipeline for the module |
| `is_active` | BOOLEAN | Whether pipeline is active |
| `created_by` | UUID | Creator user ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp |

### pipeline_stages

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `pipeline_id` | UUID | FK to pipelines |
| `name` | VARCHAR(255) | Stage name |
| `position` | INTEGER | Sort order |
| `color` | VARCHAR(20) | Display color |
| `probability` | INTEGER | Win probability percentage |
| `is_won` | BOOLEAN | Marks as "won" stage |
| `is_lost` | BOOLEAN | Marks as "lost" stage |
| `stage_owner_type` | VARCHAR(20) | `'user'`, `'team'`, or `'role'` |
| `stage_owner_user_id` | UUID | Owner user (if type = user) |
| `stage_owner_team_id` | UUID | Owner team (if type = team) |
| `stage_owner_role_id` | UUID | Owner role (if type = role) |
| `field_visibility` | JSONB | Per-field visibility rules for this stage |

### pipeline_stage_fields

Required fields that must be filled before transitioning to a stage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `stage_id` | UUID | FK to pipeline_stages |
| `field_name` | VARCHAR(255) | Field identifier |
| `field_label` | VARCHAR(255) | Display label |
| `field_type` | VARCHAR(50) | Input type (text, number, date, select, file) |
| `is_required` | BOOLEAN | Whether field is mandatory |
| `options` | JSONB | Options for select fields |

### record_stage_assignments

Tracks who is assigned to work on a record at each stage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `entity_type` | VARCHAR(50) | `'leads'`, `'opportunities'`, etc. |
| `entity_id` | UUID | Record ID |
| `stage_id` | UUID | Current stage |
| `assigned_to` | UUID | Assigned user |
| `assigned_at` | TIMESTAMPTZ | Assignment timestamp |
| `completed_at` | TIMESTAMPTZ | When assignment was completed |

## Module Column Values

| Value | Module |
|-------|--------|
| `'leads'` | Leads pipeline |
| `'opportunities'` | Opportunities pipeline |
| `'deals'` | Deals pipeline (Sprint 5) |
| `'projects'` | Projects pipeline (Sprint 8) |

## API Endpoints

All pipeline endpoints are consolidated under `/lead-settings/`:

:::info Shared Endpoints
Despite being under `/lead-settings/`, these endpoints serve ALL modules. The `module` query parameter determines which module's data is returned.
:::

### Pipelines

```
GET    /lead-settings/pipelines?module=leads
POST   /lead-settings/pipelines
PUT    /lead-settings/pipelines/:id
DELETE /lead-settings/pipelines/:id
```

### Stages

```
GET    /lead-settings/stages?module=leads&pipelineId=uuid
POST   /lead-settings/stages
PUT    /lead-settings/stages/:id
DELETE /lead-settings/stages/:id
PUT    /lead-settings/stages/reorder    (body: { stages: [{ id, position }] })
```

### Stage Fields

```
GET    /lead-settings/stages/:stageId/fields
POST   /lead-settings/stages/:stageId/fields
PUT    /lead-settings/stages/:stageId/fields/:fieldId
DELETE /lead-settings/stages/:stageId/fields/:fieldId
```

### Stage Ownership

```
GET    /lead-settings/stage-ownership/:stageId
PUT    /lead-settings/stage-ownership/:stageId
```

### Field Visibility

```
GET    /lead-settings/field-visibility/:stageId
PUT    /lead-settings/field-visibility/:stageId
```

## Frontend API Calls

```typescript
// leads.api.ts
export const leadSettingsApi = {
  // Pipelines
  getPipelines: async (module: string = 'leads') => {
    const { data } = await api.get('/lead-settings/pipelines', { params: { module } });
    return data;
  },

  // Stages
  getStages: async (pipelineId: string, module: string = 'leads') => {
    const { data } = await api.get('/lead-settings/stages', {
      params: { pipelineId, module },
    });
    return data;
  },

  // Stage fields
  getStageFields: async (stageId: string) => {
    const { data } = await api.get(`/lead-settings/stages/${stageId}/fields`);
    return data;
  },
};

// opportunities.api.ts — reuses the same endpoints
export const opportunitySettingsApi = {
  getPipelines: () => leadSettingsApi.getPipelines('opportunities'),
  getStages: (pipelineId: string) => leadSettingsApi.getStages(pipelineId, 'opportunities'),
};
```

## Stage Change Flow

When a record moves between stages:

```
1. Client calls POST /leads/:id/change-stage
   Body: { stageId, stageFieldValues? }

2. Service validates:
   a. Record exists and belongs to user's access scope
   b. Target stage exists in the record's pipeline
   c. All required stage fields have values

3. If stage has ownership:
   a. Check stage_owner_type
   b. Create/update record_stage_assignments entry

4. Update record's stage_id

5. Log audit trail (AuditService)

6. Create activity entry (ActivityService)
   "Stage changed from 'New' to 'Qualified'"

7. Return updated record
```

```typescript
async changeStage(schemaName: string, userId: string, leadId: string, dto: ChangeStageDto) {
  // 1. Validate required stage fields
  const requiredFields = await this.dataSource.query(
    `SELECT * FROM "${schemaName}".pipeline_stage_fields
     WHERE stage_id = $1 AND is_required = true`,
    [dto.stageId],
  );

  for (const field of requiredFields) {
    if (!dto.stageFieldValues?.[field.field_name]) {
      throw new BadRequestException(`Field "${field.field_label}" is required for this stage`);
    }
  }

  // 2. Get current and target stage names for activity log
  const [currentStage] = await this.dataSource.query(
    `SELECT ps.name FROM "${schemaName}".pipeline_stages ps
     JOIN "${schemaName}".leads l ON l.stage_id = ps.id
     WHERE l.id = $1`,
    [leadId],
  );

  const [targetStage] = await this.dataSource.query(
    `SELECT name FROM "${schemaName}".pipeline_stages WHERE id = $1`,
    [dto.stageId],
  );

  // 3. Update the record
  await this.dataSource.query(
    `UPDATE "${schemaName}".leads SET stage_id = $1, updated_at = NOW() WHERE id = $2`,
    [dto.stageId, leadId],
  );

  // 4. Handle stage assignment
  await this.dataSource.query(
    `INSERT INTO "${schemaName}".record_stage_assignments
     (entity_type, entity_id, stage_id, assigned_to, assigned_at)
     VALUES ('leads', $1, $2, $3, NOW())`,
    [leadId, dto.stageId, userId],
  );

  // 5. Audit + Activity
  await this.auditService.log(schemaName, { /* ... */ });
  await this.activityService.create(schemaName, {
    entityType: 'leads',
    entityId: leadId,
    activityType: 'stage_change',
    title: `Stage changed from "${currentStage.name}" to "${targetStage.name}"`,
    performedBy: userId,
  });
}
```

## Stage Ordering and Reordering

Stages have a `position` column that determines display order. Reordering is done via bulk update:

```typescript
// PUT /lead-settings/stages/reorder
// Body: { stages: [{ id: "uuid-1", position: 1 }, { id: "uuid-2", position: 2 }] }

async reorderStages(schemaName: string, stages: { id: string; position: number }[]) {
  for (const stage of stages) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".pipeline_stages SET position = $1 WHERE id = $2`,
      [stage.position, stage.id],
    );
  }
}
```

:::tip
When creating a new stage, set its position to `MAX(position) + 1` from the existing stages in the same pipeline to append it at the end.
:::
