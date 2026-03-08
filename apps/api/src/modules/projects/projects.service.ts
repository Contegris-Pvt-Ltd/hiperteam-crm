// ============================================================
// FILE: apps/api/src/modules/projects/projects.service.ts
//
// Full CRUD + templates + phases + tasks + Kanban + Gantt +
// time tracking + members + client portal + dependencies
//
// Multi-tenant raw SQL — same patterns as opportunities.service.ts
// ============================================================
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { ActivityService } from '../shared/activity.service';
import { ApprovalService } from '../shared/approval.service';

// ============================================================
// TYPES
// ============================================================

export type ProjectHealthStatus = 'on_track' | 'at_risk' | 'off_track';
export type DependencyType = 'finish_to_start' | 'start_to_start';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activityService: ActivityService,
    private readonly approvalService: ApprovalService,
  ) {}

  // ============================================================
  // 1. GET STATUSES
  // ============================================================
  async getStatuses(schemaName: string) {
    return this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_statuses ORDER BY sort_order ASC`,
    );
  }

  // ============================================================
  // 2. GET TASK STATUSES
  // ============================================================
  async getTaskStatuses(schemaName: string) {
    return this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_task_statuses ORDER BY sort_order ASC`,
    );
  }

  // ============================================================
  // 3. GET TEMPLATES
  // ============================================================
  async getTemplates(schemaName: string) {
    return this.dataSource.query(
      `SELECT pt.*, COUNT(ptp.id) as phase_count
       FROM "${schemaName}".project_templates pt
       LEFT JOIN "${schemaName}".project_template_phases ptp ON ptp.template_id = pt.id
       WHERE pt.is_active = true
       GROUP BY pt.id
       ORDER BY pt.is_system DESC, pt.name ASC`,
    );
  }

  // ============================================================
  // 4. GET TEMPLATE BY ID
  // ============================================================
  async getTemplateById(schemaName: string, templateId: string) {
    const [template] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_templates WHERE id = $1`,
      [templateId],
    );
    if (!template) return null;

    const phases = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_template_phases
       WHERE template_id = $1 ORDER BY sort_order ASC`,
      [templateId],
    );

    const tasks = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_template_tasks
       WHERE template_id = $1 ORDER BY sort_order ASC`,
      [templateId],
    );

    template.phases = phases.map((phase: any) => ({
      ...phase,
      tasks: tasks.filter((t: any) => t.phase_id === phase.id),
    }));

    return template;
  }

  // ============================================================
  // 4a. PROJECT STATUS CRUD (Admin)
  // ============================================================

  async createProjectStatus(schemaName: string, dto: { name: string; color?: string; icon?: string; description?: string; isClosed?: boolean; sortOrder?: number }) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".project_statuses`,
    );
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_statuses (name, slug, color, icon, description, is_closed, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [dto.name, slug, dto.color || '#3B82F6', dto.icon || 'circle', dto.description || null, dto.isClosed ?? false, dto.sortOrder ?? maxOrder.next_order],
    );
    return row;
  }

  async updateProjectStatus(schemaName: string, id: string, dto: { name?: string; color?: string; icon?: string; description?: string; isClosed?: boolean; isActive?: boolean; sortOrder?: number }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.color !== undefined) { sets.push(`color = $${idx++}`); params.push(dto.color); }
    if (dto.icon !== undefined) { sets.push(`icon = $${idx++}`); params.push(dto.icon); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.isClosed !== undefined) { sets.push(`is_closed = $${idx++}`); params.push(dto.isClosed); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.isActive); }
    if (dto.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sortOrder); }

    if (sets.length === 0) return;

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".project_statuses SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return row;
  }

  async deleteProjectStatus(schemaName: string, id: string) {
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "${schemaName}".projects WHERE status_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (usage.count > 0) {
      throw new Error(`Cannot delete status: ${usage.count} project(s) are using it`);
    }
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_statuses WHERE id = $1 AND is_system = false`,
      [id],
    );
    return { deleted: true };
  }

  // ============================================================
  // 4b. PROJECT TASK STATUS CRUD (Admin)
  // ============================================================

  async createProjectTaskStatus(schemaName: string, dto: { name: string; color?: string; isDone?: boolean; sortOrder?: number }) {
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".project_task_statuses`,
    );
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_task_statuses (name, slug, color, is_done, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.name, slug, dto.color || '#3B82F6', dto.isDone ?? false, dto.sortOrder ?? maxOrder.next_order],
    );
    return row;
  }

  async updateProjectTaskStatus(schemaName: string, id: string, dto: { name?: string; color?: string; isDone?: boolean; sortOrder?: number }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.color !== undefined) { sets.push(`color = $${idx++}`); params.push(dto.color); }
    if (dto.isDone !== undefined) { sets.push(`is_done = $${idx++}`); params.push(dto.isDone); }
    if (dto.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(dto.sortOrder); }

    if (sets.length === 0) return;

    params.push(id);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".project_task_statuses SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return row;
  }

  async deleteProjectTaskStatus(schemaName: string, id: string) {
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "${schemaName}".project_tasks WHERE status_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (usage.count > 0) {
      throw new Error(`Cannot delete task status: ${usage.count} task(s) are using it`);
    }
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_task_statuses WHERE id = $1 AND is_system = false`,
      [id],
    );
    return { deleted: true };
  }

  // ============================================================
  // 4c. PROJECT TEMPLATE CRUD (Admin)
  // ============================================================

  async createTemplate(schemaName: string, dto: { name: string; description?: string; color?: string; icon?: string; estimatedDays?: number }, userId: string) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_templates (name, description, color, icon, estimated_days, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [dto.name, dto.description || null, dto.color || '#3B82F6', dto.icon || 'folder', dto.estimatedDays || null, userId],
    );
    return row;
  }

  async updateTemplate(schemaName: string, id: string, dto: { name?: string; description?: string; color?: string; icon?: string; estimatedDays?: number; isActive?: boolean }) {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { sets.push(`name = $${idx++}`); params.push(dto.name); }
    if (dto.description !== undefined) { sets.push(`description = $${idx++}`); params.push(dto.description); }
    if (dto.color !== undefined) { sets.push(`color = $${idx++}`); params.push(dto.color); }
    if (dto.icon !== undefined) { sets.push(`icon = $${idx++}`); params.push(dto.icon); }
    if (dto.estimatedDays !== undefined) { sets.push(`estimated_days = $${idx++}`); params.push(dto.estimatedDays); }
    if (dto.isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(dto.isActive); }

    if (sets.length === 0) return;

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const [row] = await this.dataSource.query(
      `UPDATE "${schemaName}".project_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return row;
  }

  async deleteTemplate(schemaName: string, id: string) {
    const [usage] = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM "${schemaName}".projects WHERE template_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (usage.count > 0) {
      throw new Error(`Cannot delete template: ${usage.count} project(s) are using it`);
    }
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_templates WHERE id = $1 AND is_system = false`,
      [id],
    );
    return { deleted: true };
  }

  // ============================================================
  // 5. LIST PROJECTS
  // ============================================================
  async listProjects(
    schemaName: string,
    filters: {
      statusId?: string;
      ownerId?: string;
      accountId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { statusId, ownerId, accountId, search, page = 1, limit = 25 } = filters;

    const conditions: string[] = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (statusId) {
      conditions.push(`p.status_id = $${paramIndex}`);
      params.push(statusId);
      paramIndex++;
    }

    if (ownerId) {
      conditions.push(`p.owner_id = $${paramIndex}`);
      params.push(ownerId);
      paramIndex++;
    }

    if (accountId) {
      conditions.push(`p.account_id = $${paramIndex}`);
      params.push(accountId);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT p.id) as count
       FROM "${schemaName}".projects p
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    const projects = await this.dataSource.query(
      `SELECT
         p.*,
         ps.name as status_name, ps.color as status_color, ps.icon as status_icon,
         u.first_name || ' ' || u.last_name as owner_name,
         a.name as account_name,
         COUNT(DISTINCT pt.id) FILTER (WHERE pt.deleted_at IS NULL) as task_count,
         COUNT(DISTINCT pt.id) FILTER (WHERE pt.deleted_at IS NULL AND pts.is_done = true) as completed_task_count,
         COUNT(DISTINCT pm.id) as member_count
       FROM "${schemaName}".projects p
       LEFT JOIN "${schemaName}".project_statuses ps ON ps.id = p.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = p.owner_id
       LEFT JOIN "${schemaName}".accounts a ON a.id = p.account_id
       LEFT JOIN "${schemaName}".project_tasks pt ON pt.project_id = p.id
       LEFT JOIN "${schemaName}".project_task_statuses pts ON pts.id = pt.status_id
       LEFT JOIN "${schemaName}".project_members pm ON pm.project_id = p.id
       WHERE ${whereClause}
       GROUP BY p.id, ps.name, ps.color, ps.icon, u.first_name, u.last_name, a.name
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data: projects.map((p: any) => this.formatProject(p)),
      total,
      page,
      limit,
    };
  }

  // ============================================================
  // 6. GET PROJECT BY ID
  // ============================================================
  async getProjectById(schemaName: string, projectId: string) {
    // 1. Project row + status + owner + account + contact + template name
    const [project] = await this.dataSource.query(
      `SELECT p.*,
              ps.name as status_name, ps.color as status_color, ps.icon as status_icon,
              u.first_name || ' ' || u.last_name as owner_name,
              a.name as account_name,
              c.first_name || ' ' || c.last_name as contact_name,
              ptpl.name as template_name
       FROM "${schemaName}".projects p
       LEFT JOIN "${schemaName}".project_statuses ps ON ps.id = p.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = p.owner_id
       LEFT JOIN "${schemaName}".accounts a ON a.id = p.account_id
       LEFT JOIN "${schemaName}".contacts c ON c.id = p.contact_id
       LEFT JOIN "${schemaName}".project_templates ptpl ON ptpl.id = p.template_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [projectId],
    );
    if (!project) return null;

    // 2. Members
    const members = await this.dataSource.query(
      `SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM "${schemaName}".project_members pm
       JOIN "${schemaName}".users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [projectId],
    );

    // 3. Phases
    const phases = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_phases
       WHERE project_id = $1
       ORDER BY sort_order ASC`,
      [projectId],
    );

    // 4. Tasks with status + assignee
    const tasks = await this.dataSource.query(
      `SELECT pt.*,
              pts.name as status_name, pts.color as status_color, pts.is_done,
              u.first_name || ' ' || u.last_name as assignee_name
       FROM "${schemaName}".project_tasks pt
       LEFT JOIN "${schemaName}".project_task_statuses pts ON pts.id = pt.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = pt.assignee_id
       WHERE pt.project_id = $1 AND pt.deleted_at IS NULL
       ORDER BY pt.phase_id NULLS LAST, pt.sort_order ASC`,
      [projectId],
    );

    // 5. Batch-load dependencies for all tasks
    const taskIds = tasks.map((t: any) => t.id);
    let depRows: any[] = [];
    if (taskIds.length > 0) {
      depRows = await this.dataSource.query(
        `SELECT d.id, d.task_id, d.depends_on_task_id, d.dependency_type, d.created_at,
                pt.title AS depends_on_title
         FROM "${schemaName}".project_task_dependencies d
         JOIN "${schemaName}".project_tasks pt ON pt.id = d.depends_on_task_id
         WHERE d.task_id = ANY($1) AND pt.deleted_at IS NULL`,
        [taskIds],
      );
    }
    // Group deps by task_id
    const depsByTask = new Map<string, any[]>();
    depRows.forEach((d: any) => {
      const arr = depsByTask.get(d.task_id) || [];
      arr.push({
        id: d.id,
        taskId: d.task_id,
        dependsOnTaskId: d.depends_on_task_id,
        dependencyType: d.dependency_type,
        dependsOnTitle: d.depends_on_title,
        createdAt: d.created_at,
      });
      depsByTask.set(d.task_id, arr);
    });
    // Attach to each task row
    tasks.forEach((t: any) => {
      t.dependencies = depsByTask.get(t.id) || [];
    });

    // 6. Milestones
    const milestones = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_milestones
       WHERE project_id = $1
       ORDER BY due_date ASC`,
      [projectId],
    );

    // Nest tasks under phases
    const formatted = this.formatProject(project);
    formatted.phases = phases.map((phase: any) => ({
      id: phase.id,
      projectId: phase.project_id,
      name: phase.name,
      color: phase.color,
      sortOrder: phase.sort_order,
      tasks: tasks
        .filter((t: any) => t.phase_id === phase.id)
        .map((t: any) => this.formatTask(t)),
    }));
    formatted.unassignedTasks = tasks
      .filter((t: any) => !t.phase_id)
      .map((t: any) => this.formatTask(t));
    formatted.members = members.map((m: any) => this.formatMember(m));
    formatted.milestones = milestones;

    return formatted;
  }

  // ============================================================
  // 7. CREATE PROJECT
  // ============================================================
  async createProject(
    schemaName: string,
    dto: {
      name: string;
      description?: string;
      color?: string;
      opportunityId?: string;
      accountId?: string;
      contactId?: string;
      templateId?: string;
      startDate?: string;
      endDate?: string;
      budget?: number;
      currency?: string;
      ownerId?: string;
      teamId?: string;
    },
    userId: string,
  ) {
    // a. Get default status
    const [defaultStatus] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".project_statuses
       WHERE is_default = true LIMIT 1`,
    );
    const statusId = defaultStatus?.id || null;

    const ownerId = dto.ownerId || userId;

    const [project] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".projects
       (name, description, color, opportunity_id, account_id, contact_id,
        template_id, start_date, end_date, budget, currency,
        owner_id, team_id, status_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        dto.color || null,
        dto.opportunityId || null,
        dto.accountId || null,
        dto.contactId || null,
        dto.templateId || null,
        dto.startDate || null,
        dto.endDate || null,
        dto.budget ?? null,
        dto.currency || 'USD',
        ownerId,
        dto.teamId || null,
        statusId,
        userId,
      ],
    );

    // b. Apply template if provided
    if (dto.templateId) {
      await this.applyTemplate(schemaName, project.id, dto.templateId, dto.startDate || null);
    }

    // c. Add creator as project member with role='owner'
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_members (project_id, user_id, role, added_by)
       VALUES ($1, $2, 'owner', $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [project.id, userId, userId],
    );

    // d. Activity log
    try {
      await this.activityService.create(schemaName, {
        entityType: 'projects',
        entityId: project.id,
        activityType: 'created',
        title: 'Project created',
        description: `Project "${dto.name}" was created`,
        performedBy: userId,
      });
    } catch { /* ignore */ }

    // e. Return full project
    return this.getProjectById(schemaName, project.id);
  }

  // ============================================================
  // 8. APPLY TEMPLATE (private)
  // ============================================================
  private async applyTemplate(
    schemaName: string,
    projectId: string,
    templateId: string,
    projectStartDate: string | null,
  ) {
    const template = await this.getTemplateById(schemaName, templateId);
    if (!template || !template.phases) return;

    for (const phase of template.phases) {
      const [insertedPhase] = await this.dataSource.query(
        `INSERT INTO "${schemaName}".project_phases
         (project_id, name, color, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [projectId, phase.name, phase.color || null, phase.sort_order],
      );

      if (phase.tasks && phase.tasks.length > 0) {
        for (const task of phase.tasks) {
          let dueDate: string | null = null;
          if (projectStartDate && task.due_days_from_start) {
            const start = new Date(projectStartDate);
            start.setDate(start.getDate() + task.due_days_from_start);
            dueDate = start.toISOString().split('T')[0];
          }

          await this.dataSource.query(
            `INSERT INTO "${schemaName}".project_tasks
             (project_id, phase_id, title, description, priority,
              estimated_hours, sort_order, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              projectId,
              insertedPhase.id,
              task.title,
              task.description || null,
              task.priority || 'medium',
              task.estimated_hours ?? null,
              task.sort_order,
              dueDate,
            ],
          );
        }
      }
    }
  }

  // ============================================================
  // 9. UPDATE PROJECT
  // ============================================================
  async updateProject(
    schemaName: string,
    projectId: string,
    dto: {
      name?: string;
      description?: string;
      color?: string;
      statusId?: string;
      ownerId?: string;
      teamId?: string;
      startDate?: string;
      endDate?: string;
      budget?: number;
      currency?: string;
      clientPortalEnabled?: boolean;
      healthStatus?: ProjectHealthStatus;
      accountId?: string | null;
    },
    userId: string,
  ) {
    // Fetch existing for change detection
    const [existingProject] = await this.dataSource.query(
      `SELECT p.status_id FROM "${schemaName}".projects p
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [projectId],
    );

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      color: 'color',
      statusId: 'status_id',
      ownerId: 'owner_id',
      teamId: 'team_id',
      startDate: 'start_date',
      endDate: 'end_date',
      budget: 'budget',
      currency: 'currency',
      clientPortalEnabled: 'client_portal_enabled',
      healthStatus: 'health_status',
      accountId: 'account_id',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        updates.push(`${dbCol} = $${idx}`);
        params.push((dto as any)[dtoKey]);
        idx++;
      }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`, `updated_by = $${idx}`);
    params.push(userId);
    idx++;

    params.push(projectId);

    const [updated] = await this.dataSource.query(
      `UPDATE "${schemaName}".projects
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );

    if (updated) {
      // Activity: general update
      try {
        await this.activityService.create(schemaName, {
          entityType: 'projects',
          entityId: projectId,
          activityType: 'updated',
          title: 'Project updated',
          performedBy: userId,
        });
      } catch { /* ignore */ }

      // Activity: status change
      if (dto.statusId && existingProject && dto.statusId !== existingProject.status_id) {
        const [newStatus] = await this.dataSource.query(
          `SELECT name FROM "${schemaName}".project_statuses WHERE id = $1`,
          [dto.statusId],
        );
        try {
          await this.activityService.create(schemaName, {
            entityType: 'projects',
            entityId: projectId,
            activityType: 'status_changed',
            title: 'Status changed',
            description: `Status changed to "${newStatus?.name || 'Unknown'}"`,
            performedBy: userId,
          });
        } catch { /* ignore */ }
      }
    }

    return updated || null;
  }

  // ============================================================
  // 10. DELETE PROJECT (soft)
  // ============================================================
  async deleteProject(schemaName: string, projectId: string, userId: string) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".projects
       SET deleted_at = NOW(), updated_by = $1
       WHERE id = $2`,
      [userId, projectId],
    );
    return { success: true };
  }

  // ============================================================
  // 11. GET KANBAN DATA
  // ============================================================
  async getKanbanData(schemaName: string, projectId: string) {
    const statuses = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_task_statuses
       ORDER BY sort_order ASC`,
    );

    const tasks = await this.dataSource.query(
      `SELECT pt.*,
              pts.name as status_name, pts.color as status_color, pts.is_done,
              u.first_name || ' ' || u.last_name as assignee_name
       FROM "${schemaName}".project_tasks pt
       LEFT JOIN "${schemaName}".project_task_statuses pts ON pts.id = pt.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = pt.assignee_id
       WHERE pt.project_id = $1 AND pt.deleted_at IS NULL
       ORDER BY pt.sort_order ASC`,
      [projectId],
    );

    const formattedTasks = tasks.map((t: any) => this.formatTask(t));
    return statuses.map((status: any) => ({
      status: {
        id: status.id,
        name: status.name,
        color: status.color,
        slug: status.slug,
        isDone: status.is_done,
        isDefault: status.is_default,
        sortOrder: status.sort_order,
      },
      tasks: formattedTasks.filter((t: any) => t.statusId === status.id),
    }));
  }

  // ============================================================
  // 12. GET GANTT DATA
  // ============================================================
  async getGanttData(schemaName: string, projectId: string) {
    const tasks = await this.dataSource.query(
      `SELECT pt.*,
              pp.name as phase_name, pp.color as phase_color,
              u.first_name || ' ' || u.last_name as assignee_name
       FROM "${schemaName}".project_tasks pt
       LEFT JOIN "${schemaName}".project_phases pp ON pp.id = pt.phase_id
       LEFT JOIN "${schemaName}".users u ON u.id = pt.assignee_id
       WHERE pt.project_id = $1 AND pt.deleted_at IS NULL
       ORDER BY pt.sort_order ASC`,
      [projectId],
    );

    const taskIds = tasks.map((t: any) => t.id);

    let dependencies: any[] = [];
    if (taskIds.length > 0) {
      dependencies = await this.dataSource.query(
        `SELECT * FROM "${schemaName}".project_task_dependencies
         WHERE task_id = ANY($1)`,
        [taskIds],
      );
    }

    const milestones = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".project_milestones
       WHERE project_id = $1
       ORDER BY due_date ASC`,
      [projectId],
    );

    return {
      tasks: tasks.map((t: any) => this.formatTask(t)),
      dependencies,
      milestones,
    };
  }

  // ============================================================
  // 13. CREATE TASK
  // ============================================================
  async createTask(
    schemaName: string,
    projectId: string,
    dto: {
      title: string;
      description?: string;
      phaseId?: string;
      parentTaskId?: string;
      assigneeId?: string;
      priority?: TaskPriority;
      startDate?: string;
      dueDate?: string;
      estimatedHours?: number;
      tags?: string[];
    },
    userId: string,
  ) {
    // Get default task status
    const [defaultStatus] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".project_task_statuses
       ORDER BY sort_order ASC LIMIT 1`,
    );

    // Get next sort_order
    const [maxOrder] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next
       FROM "${schemaName}".project_tasks
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId],
    );

    const [task] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_tasks
       (project_id, phase_id, parent_task_id, title, description,
        assignee_id, priority, start_date, due_date,
        estimated_hours, tags, status_id, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        projectId,
        dto.phaseId || null,
        dto.parentTaskId || null,
        dto.title,
        dto.description || null,
        dto.assigneeId || null,
        dto.priority || 'medium',
        dto.startDate || null,
        dto.dueDate || null,
        dto.estimatedHours ?? null,
        dto.tags || [],
        defaultStatus?.id || null,
        maxOrder.next,
        userId,
      ],
    );

    // Return with status join
    const [enriched] = await this.dataSource.query(
      `SELECT pt.*,
              pts.name as status_name, pts.color as status_color, pts.is_done,
              u.first_name || ' ' || u.last_name as assignee_name
       FROM "${schemaName}".project_tasks pt
       LEFT JOIN "${schemaName}".project_task_statuses pts ON pts.id = pt.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = pt.assignee_id
       WHERE pt.id = $1`,
      [task.id],
    );

    // Activity log
    try {
      await this.activityService.create(schemaName, {
        entityType: 'project_tasks',
        entityId: task.id,
        activityType: 'created',
        title: 'Task created',
        description: `Task "${dto.title}" was created`,
        relatedType: 'projects',
        relatedId: projectId,
        performedBy: userId,
      });
    } catch { /* ignore */ }

    return this.formatTask(enriched);
  }

  // ============================================================
  // 14. UPDATE TASK
  // ============================================================
  async updateTask(
    schemaName: string,
    projectId: string,
    taskId: string,
    dto: {
      title?: string;
      description?: string;
      statusId?: string;
      phaseId?: string;
      assigneeId?: string;
      priority?: TaskPriority;
      startDate?: string;
      dueDate?: string;
      estimatedHours?: number;
      tags?: string[];
      sortOrder?: number;
    },
    userId: string,
  ) {
    // Fetch existing task for change detection
    const [existingTask] = await this.dataSource.query(
      `SELECT pt.status_id, pt.due_date, pt.assignee_id
       FROM "${schemaName}".project_tasks pt
       WHERE pt.id = $1 AND pt.project_id = $2`,
      [taskId, projectId],
    );

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      statusId: 'status_id',
      phaseId: 'phase_id',
      assigneeId: 'assignee_id',
      priority: 'priority',
      startDate: 'start_date',
      dueDate: 'due_date',
      estimatedHours: 'estimated_hours',
      tags: 'tags',
      sortOrder: 'sort_order',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [dtoKey, dbCol] of Object.entries(fieldMap)) {
      if ((dto as any)[dtoKey] !== undefined) {
        updates.push(`${dbCol} = $${idx}`);
        params.push((dto as any)[dtoKey]);
        idx++;
      }
    }

    if (updates.length === 0) return null;

    // Handle completed_at based on status change
    if (dto.statusId) {
      const [status] = await this.dataSource.query(
        `SELECT is_done FROM "${schemaName}".project_task_statuses WHERE id = $1`,
        [dto.statusId],
      );
      if (status?.is_done) {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    updates.push(`updated_at = NOW()`, `updated_by = $${idx}`);
    params.push(userId);
    idx++;

    params.push(taskId);
    params.push(projectId);

    await this.dataSource.query(
      `UPDATE "${schemaName}".project_tasks
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND project_id = $${idx + 1}`,
      params,
    );

    // Return updated row with joins
    const [updated] = await this.dataSource.query(
      `SELECT pt.*,
              pts.name as status_name, pts.color as status_color, pts.is_done,
              u.first_name || ' ' || u.last_name as assignee_name
       FROM "${schemaName}".project_tasks pt
       LEFT JOIN "${schemaName}".project_task_statuses pts ON pts.id = pt.status_id
       LEFT JOIN "${schemaName}".users u ON u.id = pt.assignee_id
       WHERE pt.id = $1`,
      [taskId],
    );

    // Activity logs for specific field changes
    if (updated && existingTask) {
      // Status changed
      if (dto.statusId && dto.statusId !== existingTask.status_id) {
        try {
          await this.activityService.create(schemaName, {
            entityType: 'project_tasks',
            entityId: taskId,
            activityType: 'status_changed',
            title: 'Task status changed',
            description: `Status changed to "${updated.status_name || 'Unknown'}"`,
            relatedType: 'projects',
            relatedId: projectId,
            performedBy: userId,
          });
        } catch { /* ignore */ }
      }

      // Due date changed
      if (dto.dueDate !== undefined && String(dto.dueDate || '') !== String(existingTask.due_date || '').slice(0, 10)) {
        try {
          await this.activityService.create(schemaName, {
            entityType: 'project_tasks',
            entityId: taskId,
            activityType: 'due_date_changed',
            title: 'Due date changed',
            description: `Due date set to "${dto.dueDate}"`,
            relatedType: 'projects',
            relatedId: projectId,
            performedBy: userId,
          });
        } catch { /* ignore */ }
      }

      // Assignee changed
      if (dto.assigneeId !== undefined && dto.assigneeId !== existingTask.assignee_id) {
        try {
          await this.activityService.create(schemaName, {
            entityType: 'project_tasks',
            entityId: taskId,
            activityType: 'assignee_changed',
            title: 'Assignee changed',
            description: `Assigned to "${updated.assignee_name || 'Unassigned'}"`,
            relatedType: 'projects',
            relatedId: projectId,
            performedBy: userId,
          });
        } catch { /* ignore */ }
      }
    }

    return updated ? this.formatTask(updated) : null;
  }

  // ============================================================
  // 15. DELETE TASK (soft)
  // ============================================================
  async deleteTask(schemaName: string, taskId: string, userId: string) {
    await this.dataSource.query(
      `UPDATE "${schemaName}".project_tasks
       SET deleted_at = NOW(), updated_by = $1
       WHERE id = $2`,
      [userId, taskId],
    );
    return { success: true };
  }

  // ============================================================
  // 16. ADD DEPENDENCY
  // ============================================================
  async addDependency(
    schemaName: string,
    taskId: string,
    dependsOnTaskId: string,
    type: DependencyType = 'finish_to_start',
  ) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_task_dependencies
       (task_id, depends_on_task_id, dependency_type)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [taskId, dependsOnTaskId, type],
    );
    return { success: true };
  }

  // ============================================================
  // 17. REMOVE DEPENDENCY
  // ============================================================
  async removeDependency(
    schemaName: string,
    taskId: string,
    dependsOnTaskId: string,
  ) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_task_dependencies
       WHERE task_id = $1 AND depends_on_task_id = $2`,
      [taskId, dependsOnTaskId],
    );
    return { success: true };
  }

  // ============================================================
  // 18. GET TASK COMMENTS
  // ============================================================
  async getTaskComments(schemaName: string, taskId: string) {
    const rows = await this.dataSource.query(
      `SELECT tc.*,
              u.first_name || ' ' || u.last_name as user_name,
              u.avatar_url
       FROM "${schemaName}".project_task_comments tc
       JOIN "${schemaName}".users u ON u.id = tc.user_id
       WHERE tc.task_id = $1 AND tc.deleted_at IS NULL
       ORDER BY tc.created_at ASC`,
      [taskId],
    );
    return rows.map((r: any) => this.formatComment(r));
  }

  // ============================================================
  // 19. ADD COMMENT
  // ============================================================
  async addComment(
    schemaName: string,
    taskId: string,
    userId: string,
    content: string,
    mentions?: string[],
  ) {
    const [comment] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_task_comments
       (task_id, user_id, content, mentions)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [taskId, userId, content, mentions || []],
    );

    // Return with user join
    const [enriched] = await this.dataSource.query(
      `SELECT tc.*,
              u.first_name || ' ' || u.last_name as user_name,
              u.avatar_url
       FROM "${schemaName}".project_task_comments tc
       JOIN "${schemaName}".users u ON u.id = tc.user_id
       WHERE tc.id = $1`,
      [comment.id],
    );

    return this.formatComment(enriched);
  }

  // ============================================================
  // 20. LOG TIME
  // ============================================================
  async logTime(
    schemaName: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: {
      minutes: number;
      description?: string;
      loggedAt?: string;
      isBillable?: boolean;
    },
  ) {
    const [entry] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_time_entries
       (project_id, task_id, user_id, minutes, description, logged_at, is_billable)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        taskId,
        userId,
        dto.minutes,
        dto.description || null,
        dto.loggedAt || new Date().toISOString(),
        dto.isBillable ?? false,
      ],
    );

    // Update logged_hours on the task
    await this.dataSource.query(
      `UPDATE "${schemaName}".project_tasks
       SET logged_hours = COALESCE(logged_hours, 0) + $1
       WHERE id = $2`,
      [dto.minutes / 60.0, taskId],
    );

    return entry;
  }

  // ============================================================
  // 21. GET TIME REPORT
  // ============================================================
  async getTimeReport(schemaName: string, projectId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         u.id as user_id,
         u.first_name || ' ' || u.last_name as user_name,
         SUM(te.minutes) as total_minutes,
         SUM(te.minutes) FILTER (WHERE te.is_billable) as billable_minutes,
         COUNT(te.id) as entry_count
       FROM "${schemaName}".project_time_entries te
       JOIN "${schemaName}".users u ON u.id = te.user_id
       WHERE te.project_id = $1
       GROUP BY u.id, u.first_name, u.last_name
       ORDER BY total_minutes DESC`,
      [projectId],
    );

    return rows.map((r: any) => ({
      userId: r.user_id,
      userName: r.user_name,
      totalMinutes: parseInt(r.total_minutes, 10) || 0,
      billableMinutes: parseInt(r.billable_minutes, 10) || 0,
      entryCount: parseInt(r.entry_count, 10) || 0,
    }));
  }

  // ============================================================
  // 22. GET MEMBERS
  // ============================================================
  async getMembers(schemaName: string, projectId: string) {
    const rows = await this.dataSource.query(
      `SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM "${schemaName}".project_members pm
       JOIN "${schemaName}".users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [projectId],
    );
    return rows.map((r: any) => this.formatMember(r));
  }

  // ============================================================
  // 23. ADD MEMBER
  // ============================================================
  async addMember(
    schemaName: string,
    projectId: string,
    userId: string,
    role: string,
    addedBy: string,
  ) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_members
       (project_id, user_id, role, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [projectId, userId, role, addedBy],
    );

    const [member] = await this.dataSource.query(
      `SELECT pm.*, u.first_name, u.last_name, u.email, u.avatar_url
       FROM "${schemaName}".project_members pm
       JOIN "${schemaName}".users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId],
    );
    // Activity log
    try {
      await this.activityService.create(schemaName, {
        entityType: 'projects',
        entityId: projectId,
        activityType: 'member_added',
        title: 'Member added',
        description: `User added as ${role}`,
        performedBy: addedBy,
      });
    } catch { /* ignore */ }

    return member ? this.formatMember(member) : null;
  }

  // ============================================================
  // 24. REMOVE MEMBER
  // ============================================================
  async removeMember(schemaName: string, projectId: string, userId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_members
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );

    // Activity log
    try {
      await this.activityService.create(schemaName, {
        entityType: 'projects',
        entityId: projectId,
        activityType: 'member_removed',
        title: 'Member removed',
        performedBy: userId,
      });
    } catch { /* ignore */ }

    return { success: true };
  }

  // ============================================================
  // GET PROJECT ACTIVITIES
  // ============================================================
  async getProjectActivities(
    schemaName: string,
    projectId: string,
    page = 1,
    limit = 20,
  ): Promise<any> {
    return this.activityService.getTimeline(
      schemaName,
      'projects',
      projectId,
      page,
      limit,
    );
  }

  // ============================================================
  // GET PROJECT TASK-LEVEL ACTIVITIES
  // ============================================================
  async getProjectTaskActivities(
    schemaName: string,
    projectId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: any[]; total: number }> {
    // 1) Collect all task IDs that belong to this project
    const taskRows = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".project_tasks
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId],
    );
    const taskIds = taskRows.map((r: any) => r.id);
    if (taskIds.length === 0) return { data: [], total: 0 };

    // 2) Fetch activities whose entity_type = 'project_tasks'
    //    and entity_id is one of those task IDs
    const offset = (page - 1) * limit;

    const [countRow] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schemaName}".activities
       WHERE entity_type = 'project_tasks'
         AND entity_id = ANY($1)`,
      [taskIds],
    );

    const rows = await this.dataSource.query(
      `SELECT a.*,
              u.first_name, u.last_name, u.email
       FROM "${schemaName}".activities a
       LEFT JOIN "${schemaName}".users u ON u.id = a.performed_by
       WHERE a.entity_type = 'project_tasks'
         AND a.entity_id = ANY($1)
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [taskIds, limit, offset],
    );

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        activityType: r.activity_type,
        title: r.title,
        description: r.description,
        metadata: r.metadata,
        relatedType: r.related_type,
        relatedId: r.related_id,
        performedBy: r.performed_by
          ? { id: r.performed_by, firstName: r.first_name, lastName: r.last_name, email: r.email }
          : null,
        createdAt: r.created_at,
      })),
      total: countRow.total,
    };
  }

  // ============================================================
  // GET TASK DEPENDENCIES
  // ============================================================
  async getTaskDependencies(schemaName: string, taskId: string) {
    const rows = await this.dataSource.query(
      `SELECT d.id, d.task_id, d.depends_on_task_id, d.dependency_type, d.created_at,
              pt.title AS depends_on_title
       FROM "${schemaName}".project_task_dependencies d
       JOIN "${schemaName}".project_tasks pt ON pt.id = d.depends_on_task_id
       WHERE d.task_id = $1 AND pt.deleted_at IS NULL
       ORDER BY d.created_at ASC`,
      [taskId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      dependsOnTaskId: r.depends_on_task_id,
      dependencyType: r.dependency_type,
      dependsOnTitle: r.depends_on_title,
      createdAt: r.created_at,
    }));
  }

  // ============================================================
  // ADD TASK DEPENDENCY (returns enriched row)
  // ============================================================
  async addTaskDependency(
    schemaName: string,
    taskId: string,
    dependsOnTaskId: string,
    dependencyType: string = 'finish_to_start',
  ) {
    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".project_task_dependencies
       (task_id, depends_on_task_id, dependency_type)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [taskId, dependsOnTaskId, dependencyType],
    );
    if (!row) return { success: false, message: 'Dependency already exists' };

    // Return enriched with title
    const [enriched] = await this.dataSource.query(
      `SELECT d.id, d.task_id, d.depends_on_task_id, d.dependency_type, d.created_at,
              pt.title AS depends_on_title
       FROM "${schemaName}".project_task_dependencies d
       JOIN "${schemaName}".project_tasks pt ON pt.id = d.depends_on_task_id
       WHERE d.id = $1`,
      [row.id],
    );
    return {
      id: enriched.id,
      taskId: enriched.task_id,
      dependsOnTaskId: enriched.depends_on_task_id,
      dependencyType: enriched.dependency_type,
      dependsOnTitle: enriched.depends_on_title,
      createdAt: enriched.created_at,
    };
  }

  // ============================================================
  // REMOVE TASK DEPENDENCY (by row ID)
  // ============================================================
  async removeTaskDependency(schemaName: string, depId: string) {
    await this.dataSource.query(
      `DELETE FROM "${schemaName}".project_task_dependencies WHERE id = $1`,
      [depId],
    );
    return { success: true };
  }

  // ============================================================
  // GET OPEN TASKS COUNT
  // ============================================================
  async getOpenTasksCount(
    schemaName: string,
    projectId: string,
  ): Promise<{ count: number; tasks: { id: string; title: string }[] }> {
    const rows = await this.dataSource.query(
      `SELECT pt.id, pt.title
       FROM "${schemaName}".project_tasks pt
       JOIN "${schemaName}".project_task_statuses pts
         ON pts.id = pt.status_id
       WHERE pt.project_id = $1
         AND pt.deleted_at IS NULL
         AND (pts.is_done IS NULL OR pts.is_done = false)
       ORDER BY pt.created_at ASC`,
      [projectId],
    );
    return { count: rows.length, tasks: rows };
  }

  // ============================================================
  // REQUEST PROJECT APPROVAL
  // ============================================================
  async requestProjectApproval(
    schemaName: string,
    projectId: string,
    requestedBy: string,
  ): Promise<any> {
    return this.approvalService.createRequest(
      schemaName,
      'projects',
      projectId,
      'project_start',
      requestedBy,
    );
  }

  // ============================================================
  // REQUEST TASK APPROVAL
  // ============================================================
  async requestTaskApproval(
    schemaName: string,
    taskId: string,
    requestedBy: string,
  ): Promise<any> {
    return this.approvalService.createRequest(
      schemaName,
      'project_tasks',
      taskId,
      'task_complete',
      requestedBy,
    );
  }

  // ============================================================
  // 25. CREATE FROM OPPORTUNITY
  // ============================================================
  async createFromOpportunity(
    schemaName: string,
    opportunityId: string,
    templateId: string | null,
    userId: string,
  ) {
    const [opp] = await this.dataSource.query(
      `SELECT name, account_id, primary_contact_id, amount, currency, owner_id
       FROM "${schemaName}".opportunities
       WHERE id = $1 AND deleted_at IS NULL`,
      [opportunityId],
    );
    if (!opp) return null;

    return this.createProject(
      schemaName,
      {
        name: `${opp.name} — Project`,
        opportunityId,
        accountId: opp.account_id || undefined,
        contactId: opp.primary_contact_id || undefined,
        currency: opp.currency || 'USD',
        ownerId: opp.owner_id || undefined,
        templateId: templateId || undefined,
        budget: opp.amount ? parseFloat(opp.amount) : undefined,
      },
      userId,
    );
  }

  // ============================================================
  // 26. GENERATE PORTAL TOKEN
  // ============================================================
  async generatePortalToken(
    schemaName: string,
    projectId: string,
    dto: {
      label?: string;
      email?: string;
      permissions?: Record<string, boolean>;
      expiresAt?: string;
    },
    userId: string,
  ) {
    const token = randomBytes(48).toString('hex');

    const [row] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".client_portal_tokens
       (project_id, token, label, email, permissions, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        token,
        dto.label || null,
        dto.email || null,
        JSON.stringify(dto.permissions || {}),
        dto.expiresAt || null,
        userId,
      ],
    );

    return {
      token: row.token,
      project_id: row.project_id,
      permissions: typeof row.permissions === 'string'
        ? JSON.parse(row.permissions)
        : row.permissions,
      expires_at: row.expires_at,
    };
  }

  // ============================================================
  // 27. GET PORTAL VIEW (public — resolves schema from tenant slug)
  // ============================================================
  async getPortalView(tenantSlug: string, token: string): Promise<any> {
    // Resolve schema from tenant slug
    const [tenant] = await this.dataSource.query(
      `SELECT schema_name FROM master.tenants WHERE slug = $1 AND status = 'active'`,
      [tenantSlug],
    );
    if (!tenant) return null;

    const schema = tenant.schema_name;

    const [row] = await this.dataSource.query(
      `SELECT * FROM "${schema}".client_portal_tokens
       WHERE token = $1
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [token],
    );

    if (!row) return null;

    // Update last_accessed_at
    await this.dataSource.query(
      `UPDATE "${schema}".client_portal_tokens
       SET last_accessed_at = NOW()
       WHERE token = $1`,
      [token],
    );

    const permissions = typeof row.permissions === 'string'
      ? JSON.parse(row.permissions)
      : (row.permissions || {});

    // Load full project via existing method
    const project = await this.getProjectById(schema, row.project_id);

    return { project, permissions };
  }

  // ============================================================
  // PRIVATE FORMATTERS
  // ============================================================

  private formatProject(p: any): any {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      statusId: p.status_id,
      statusName: p.status_name,
      statusColor: p.status_color,
      statusIcon: p.status_icon,
      opportunityId: p.opportunity_id,
      accountId: p.account_id,
      accountName: p.account_name,
      contactId: p.contact_id,
      contactName: p.contact_name,
      templateId: p.template_id,
      templateName: p.template_name,
      healthScore: p.health_score,
      healthStatus: p.health_status,
      startDate: p.start_date,
      endDate: p.end_date,
      actualEndDate: p.actual_end_date,
      budget: p.budget,
      actualCost: p.actual_cost,
      currency: p.currency,
      ownerId: p.owner_id,
      ownerName: p.owner_name,
      teamId: p.team_id,
      tags: p.tags || [],
      clientPortalEnabled: p.client_portal_enabled,
      taskCount: parseInt(p.task_count || '0', 10),
      completedTaskCount: parseInt(p.completed_task_count || '0', 10),
      memberCount: parseInt(p.member_count || '0', 10),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  private formatTask(t: any): any {
    return {
      id: t.id,
      projectId: t.project_id,
      phaseId: t.phase_id,
      parentTaskId: t.parent_task_id,
      title: t.title,
      description: t.description,
      statusId: t.status_id,
      statusName: t.status_name,
      statusColor: t.status_color,
      isDone: t.is_done || false,
      priority: t.priority || 'medium',
      assigneeId: t.assignee_id,
      assigneeName: t.assignee_name,
      phaseName: t.phase_name,
      phaseColor: t.phase_color,
      startDate: t.start_date,
      dueDate: t.due_date,
      completedAt: t.completed_at,
      estimatedHours: t.estimated_hours != null ? parseFloat(t.estimated_hours) : null,
      loggedHours: t.logged_hours != null ? parseFloat(t.logged_hours) : 0,
      sortOrder: t.sort_order || 0,
      tags: t.tags || [],
      dependencies: t.dependencies ?? [],
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }

  private formatMember(m: any): any {
    return {
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      avatarUrl: m.avatar_url,
      role: m.role,
      isClientContact: m.is_client_contact,
      createdAt: m.created_at,
    };
  }

  private formatComment(c: any): any {
    return {
      id: c.id,
      taskId: c.task_id,
      userId: c.user_id,
      userName: c.user_name,
      avatarUrl: c.avatar_url,
      content: c.content,
      mentions: c.mentions || [],
      isEdited: c.is_edited,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }
}
