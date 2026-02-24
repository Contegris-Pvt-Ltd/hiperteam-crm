// ============================================================
// FILE: apps/api/src/modules/tasks/tasks.service.ts
// ============================================================

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../shared/audit.service';
import { ActivityService } from '../shared/activity.service';
import { NotificationService } from '../notifications/notification.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

// ============================================================
// TYPES
// ============================================================

export interface CreateTaskDto {
  title: string;
  description?: string;
  taskTypeId?: string;
  statusId?: string;
  priorityId?: string;
  dueDate?: string;
  startDate?: string;
  reminderAt?: string;
  estimatedMinutes?: number;
  ownerId?: string;
  assignedTo?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  parentTaskId?: string;
  isRecurring?: boolean;
  recurrenceRule?: Record<string, any>;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  result?: string;
  actualMinutes?: number;
}

export interface QueryTasksDto {
  search?: string;
  statusId?: string;
  statusSlug?: string;
  taskTypeId?: string;
  taskTypeSlug?: string;
  priorityId?: string;
  assignedTo?: string;
  ownerId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  parentTaskId?: string;
  isCompleted?: string;      // 'true' | 'false'
  isOverdue?: string;        // 'true'
  dueDateFrom?: string;
  dueDateTo?: string;
  tags?: string;
  view?: 'list' | 'kanban';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  private readonly trackedFields = [
    'title', 'description', 'taskTypeId', 'statusId', 'priorityId',
    'dueDate', 'startDate', 'assignedTo', 'ownerId',
    'relatedEntityType', 'relatedEntityId', 'tags',
  ];

  constructor(
    private dataSource: DataSource,
    private auditService: AuditService,
    private activityService: ActivityService,
    private notificationService: NotificationService,
    private calendarSyncService: CalendarSyncService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(schemaName: string, userId: string, dto: CreateTaskDto): Promise<any> {
    // Resolve defaults
    const settings = await this.getSettings(schemaName);
    const general = settings.general || {};

    // Default status = first open status
    let statusId = dto.statusId;
    if (!statusId) {
      const [defaultStatus] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".task_statuses WHERE is_open = true AND is_active = true ORDER BY sort_order ASC LIMIT 1`,
      );
      statusId = defaultStatus?.id || null;
    }

    // Default priority
    let priorityId = dto.priorityId;
    if (!priorityId) {
      const [defaultPriority] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".task_priorities WHERE is_default = true AND is_active = true LIMIT 1`,
      );
      priorityId = defaultPriority?.id || null;
    }

    // Default task type
    let taskTypeId = dto.taskTypeId;
    if (!taskTypeId && general.defaultTaskType) {
      const [defaultType] = await this.dataSource.query(
        `SELECT id FROM "${schemaName}".task_types WHERE slug = $1 AND is_active = true LIMIT 1`,
        [general.defaultTaskType],
      );
      taskTypeId = defaultType?.id || null;
    }

    // Owner defaults to creator if enabled
    const ownerId = dto.ownerId || (general.autoAssignToCreator ? userId : null);
    const assignedTo = dto.assignedTo || ownerId;

    // Validate parent task if subtask
    if (dto.parentTaskId) {
      const [parent] = await this.dataSource.query(
        `SELECT id, parent_task_id FROM "${schemaName}".tasks WHERE id = $1 AND deleted_at IS NULL`,
        [dto.parentTaskId],
      );
      if (!parent) throw new NotFoundException('Parent task not found');

      // Check max depth
      const maxDepth = general.maxSubtaskDepth || 2;
      const depth = await this.getTaskDepth(schemaName, dto.parentTaskId);
      if (depth >= maxDepth) {
        throw new BadRequestException(`Maximum subtask depth of ${maxDepth} reached`);
      }
    }

    const [task] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".tasks (
        title, description, task_type_id, status_id, priority_id,
        due_date, start_date, reminder_at, estimated_minutes,
        owner_id, assigned_to,
        related_entity_type, related_entity_id,
        parent_task_id,
        is_recurring, recurrence_rule,
        tags, custom_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11,
        $12, $13,
        $14,
        $15, $16,
        $17, $18, $19
      ) RETURNING *`,
      [
        dto.title,
        dto.description || null,
        taskTypeId || null,
        statusId || null,
        priorityId || null,
        dto.dueDate || null,
        dto.startDate || null,
        dto.reminderAt || null,
        dto.estimatedMinutes || null,
        ownerId,
        assignedTo,
        dto.relatedEntityType || null,
        dto.relatedEntityId || null,
        dto.parentTaskId || null,
        dto.isRecurring || false,
        dto.recurrenceRule ? JSON.stringify(dto.recurrenceRule) : null,
        dto.tags || [],
        JSON.stringify(dto.customFields || {}),
        userId,
      ],
    );

    // Activity log
    await this.activityService.create(schemaName, {
      entityType: 'tasks',
      entityId: task.id,
      activityType: 'created',
      title: 'Task created',
      description: `"${dto.title}" was created`,
      performedBy: userId,
    });

    // If linked to entity, log activity on that entity too
    if (dto.relatedEntityType && dto.relatedEntityId) {
      await this.activityService.create(schemaName, {
        entityType: dto.relatedEntityType,
        entityId: dto.relatedEntityId,
        activityType: 'task_created',
        title: 'Task created',
        description: `Task "${dto.title}" was linked`,
        relatedType: 'tasks',
        relatedId: task.id,
        performedBy: userId,
      });
    }

    // Audit
    const formatted = await this.findOne(schemaName, task.id);
    await this.auditService.log(schemaName, {
      entityType: 'tasks',
      entityId: task.id,
      action: 'create',
      changes: {},
      newValues: formatted,
      performedBy: userId,
    });

    // ── Notification: task assigned ──
    if (assignedTo && assignedTo !== userId) {
      const assigneeName = formatted.assignee
        ? `${formatted.assignee.firstName || ''} ${formatted.assignee.lastName || ''}`.trim()
        : 'User';
      const priorityName = formatted.priority?.name || 'Medium';
      const dueDateLabel = formatted.dueDate
        ? new Date(formatted.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No due date';

      this.notificationService.notify(schemaName, {
        userId: assignedTo,
        eventType: 'task_assigned',
        title: `New task assigned: ${dto.title}`,
        body: dto.description || undefined,
        icon: 'check-square',
        actionUrl: `/tasks/${task.id}`,
        entityType: 'tasks',
        entityId: task.id,
        variables: {
          assigneeName,
          taskTitle: dto.title,
          dueDate: dueDateLabel,
          priority: priorityName,
          actionUrl: `${process.env.APP_URL || 'http://localhost:5173'}/tasks/${task.id}`,
        },
      }).catch(err => this.logger.error(`Notification failed (task_assigned): ${err.message}`));
    }

    // ── Calendar sync: push to Google ──
    if (formatted.dueDate && (formatted.assignedTo || formatted.ownerId)) {
      this.calendarSyncService.onTaskChanged(schemaName, formatted.assignedTo || formatted.ownerId, formatted.id, 'create')
        .catch(err => this.logger.error(`Calendar sync failed (create): ${err.message}`));
    }

    return formatted;
  }

  // ============================================================
  // FIND ALL (List + Kanban)
  // ============================================================
  async findAll(schemaName: string, query: QueryTasksDto, userId?: string): Promise<any> {
    const {
      search, statusId, statusSlug, taskTypeId, taskTypeSlug,
      priorityId, assignedTo, ownerId,
      relatedEntityType, relatedEntityId, parentTaskId,
      isCompleted, isOverdue, dueDateFrom, dueDateTo, tags,
      view = 'list',
      page = 1, limit = 20,
      sortBy = 'due_date', sortOrder = 'ASC',
    } = query;

    const conditions: string[] = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
    let pi = 1;

    // Only top-level tasks by default (no subtasks) unless parentTaskId specified
    if (parentTaskId) {
      conditions.push(`t.parent_task_id = $${pi}`);
      params.push(parentTaskId);
      pi++;
    } else if (view === 'list' || view === 'kanban') {
      conditions.push(`t.parent_task_id IS NULL`);
    }

    if (search) {
      conditions.push(`(t.title ILIKE $${pi} OR t.description ILIKE $${pi})`);
      params.push(`%${search}%`);
      pi++;
    }

    if (statusId) {
      conditions.push(`t.status_id = $${pi}`);
      params.push(statusId);
      pi++;
    }

    if (statusSlug) {
      conditions.push(`ts.slug = $${pi}`);
      params.push(statusSlug);
      pi++;
    }

    if (taskTypeId) {
      conditions.push(`t.task_type_id = $${pi}`);
      params.push(taskTypeId);
      pi++;
    }

    if (taskTypeSlug) {
      conditions.push(`tt.slug = $${pi}`);
      params.push(taskTypeSlug);
      pi++;
    }

    if (priorityId) {
      conditions.push(`t.priority_id = $${pi}`);
      params.push(priorityId);
      pi++;
    }

    if (assignedTo) {
      conditions.push(`t.assigned_to = $${pi}`);
      params.push(assignedTo);
      pi++;
    }

    if (ownerId) {
      conditions.push(`t.owner_id = $${pi}`);
      params.push(ownerId);
      pi++;
    }

    if (relatedEntityType) {
      conditions.push(`t.related_entity_type = $${pi}`);
      params.push(relatedEntityType);
      pi++;
    }

    if (relatedEntityId) {
      conditions.push(`t.related_entity_id = $${pi}`);
      params.push(relatedEntityId);
      pi++;
    }

    if (isCompleted === 'true') {
      conditions.push(`t.completed_at IS NOT NULL`);
    } else if (isCompleted === 'false') {
      conditions.push(`t.completed_at IS NULL`);
    }

    if (isOverdue === 'true') {
      conditions.push(`t.due_date < NOW() AND t.completed_at IS NULL`);
    }

    if (dueDateFrom) {
      conditions.push(`t.due_date >= $${pi}`);
      params.push(dueDateFrom);
      pi++;
    }

    if (dueDateTo) {
      conditions.push(`t.due_date <= $${pi}`);
      params.push(dueDateTo);
      pi++;
    }

    if (tags) {
      conditions.push(`t.tags && $${pi}::text[]`);
      params.push(`{${tags}}`);
      pi++;
    }

    const whereClause = conditions.join(' AND ');

    // Allowed sort columns
    const sortMap: Record<string, string> = {
      title: 't.title',
      due_date: 't.due_date',
      created_at: 't.created_at',
      updated_at: 't.updated_at',
      priority: 'tp.level',
      status: 'ts.sort_order',
      assignee: 'au.first_name',
    };
    const sortCol = sortMap[sortBy] || 't.due_date';
    const sortDir = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    if (view === 'kanban') {
      return this.findAllKanban(schemaName, whereClause, params);
    }

    // Count
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(count, 10);
    const offset = (page - 1) * limit;

    // Fetch
    const tasks = await this.dataSource.query(
      `SELECT t.*,
              ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
              ts.is_open as status_is_open, ts.is_completed as status_is_completed,
              tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
              tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
              tp.icon as priority_icon, tp.level as priority_level,
              ou.first_name as owner_first, ou.last_name as owner_last,
              au.first_name as assignee_first, au.last_name as assignee_last,
              cu.first_name as created_by_first, cu.last_name as created_by_last,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) as subtask_count,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.completed_at IS NOT NULL AND st.deleted_at IS NULL) as completed_subtask_count
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       LEFT JOIN "${schemaName}".users ou ON t.owner_id = ou.id
       LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
       LEFT JOIN "${schemaName}".users cu ON t.created_by = cu.id
       WHERE ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST, t.created_at DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset],
    );

    return {
      data: tasks.map((t: any) => this.formatTask(t)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ============================================================
  // KANBAN VIEW
  // ============================================================
  private async findAllKanban(schemaName: string, whereClause: string, params: unknown[]) {
    const statuses = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_statuses WHERE is_active = true ORDER BY sort_order ASC`,
    );

    const kanbanData = [];
    for (const status of statuses) {
      const statusCondition = `${whereClause} AND t.status_id = '${status.id}'`;

      const tasks = await this.dataSource.query(
        `SELECT t.*,
                ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
                ts.is_open as status_is_open, ts.is_completed as status_is_completed,
                tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
                tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
                tp.icon as priority_icon, tp.level as priority_level,
                ou.first_name as owner_first, ou.last_name as owner_last,
                au.first_name as assignee_first, au.last_name as assignee_last,
                cu.first_name as created_by_first, cu.last_name as created_by_last,
                (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) as subtask_count,
                (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.completed_at IS NOT NULL AND st.deleted_at IS NULL) as completed_subtask_count
         FROM "${schemaName}".tasks t
         LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
         LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
         LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
         LEFT JOIN "${schemaName}".users ou ON t.owner_id = ou.id
         LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
         LEFT JOIN "${schemaName}".users cu ON t.created_by = cu.id
         WHERE ${statusCondition}
         ORDER BY tp.level DESC NULLS LAST, t.due_date ASC NULLS LAST
         LIMIT 50`,
        params,
      );

      const [{ count }] = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${schemaName}".tasks t
         LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
         LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
         WHERE ${statusCondition}`,
        params,
      );

      kanbanData.push({
        id: status.id,
        name: status.name,
        slug: status.slug,
        color: status.color,
        isOpen: status.is_open,
        isCompleted: status.is_completed,
        sortOrder: status.sort_order,
        count: parseInt(count, 10),
        tasks: tasks.map((t: any) => this.formatTask(t)),
      });
    }

    return kanbanData;
  }

  // ============================================================
  // FIND ONE
  // ============================================================
  async findOne(schemaName: string, id: string): Promise<any> {
    const [task] = await this.dataSource.query(
      `SELECT t.*,
              ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
              ts.is_open as status_is_open, ts.is_completed as status_is_completed,
              tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
              tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
              tp.icon as priority_icon, tp.level as priority_level,
              ou.first_name as owner_first, ou.last_name as owner_last,
              au.first_name as assignee_first, au.last_name as assignee_last,
              cu.first_name as created_by_first, cu.last_name as created_by_last,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) as subtask_count,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.completed_at IS NOT NULL AND st.deleted_at IS NULL) as completed_subtask_count
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       LEFT JOIN "${schemaName}".users ou ON t.owner_id = ou.id
       LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
       LEFT JOIN "${schemaName}".users cu ON t.created_by = cu.id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id],
    );

    if (!task) throw new NotFoundException('Task not found');

    const formatted = this.formatTask(task);

    // Load subtasks
    const subtasks = await this.dataSource.query(
      `SELECT t.*,
              ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
              ts.is_open as status_is_open, ts.is_completed as status_is_completed,
              tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
              tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
              tp.icon as priority_icon, tp.level as priority_level,
              au.first_name as assignee_first, au.last_name as assignee_last
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
       WHERE t.parent_task_id = $1 AND t.deleted_at IS NULL
       ORDER BY t.created_at ASC`,
      [id],
    );

    formatted.subtasks = subtasks.map((s: any) => this.formatTask(s));

    return formatted;
  }

  // ============================================================
  // UPDATE
  // ============================================================
  async update(schemaName: string, id: string, userId: string, dto: UpdateTaskDto): Promise<any> {
    const existing = await this.findOne(schemaName, id);

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      taskTypeId: 'task_type_id',
      statusId: 'status_id',
      priorityId: 'priority_id',
      dueDate: 'due_date',
      startDate: 'start_date',
      reminderAt: 'reminder_at',
      estimatedMinutes: 'estimated_minutes',
      actualMinutes: 'actual_minutes',
      ownerId: 'owner_id',
      assignedTo: 'assigned_to',
      relatedEntityType: 'related_entity_type',
      relatedEntityId: 'related_entity_id',
      parentTaskId: 'parent_task_id',
      result: 'result',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    let pi = 1;

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((dto as any)[key] !== undefined) {
        updates.push(`${col} = $${pi}`);
        params.push((dto as any)[key]);
        pi++;
      }
    }

    if (dto.tags !== undefined) {
      updates.push(`tags = $${pi}`);
      params.push(dto.tags);
      pi++;
    }

    if (dto.customFields !== undefined) {
      updates.push(`custom_fields = $${pi}`);
      params.push(JSON.stringify(dto.customFields));
      pi++;
    }

    if (dto.isRecurring !== undefined) {
      updates.push(`is_recurring = $${pi}`);
      params.push(dto.isRecurring);
      pi++;
    }

    if (dto.recurrenceRule !== undefined) {
      updates.push(`recurrence_rule = $${pi}`);
      params.push(JSON.stringify(dto.recurrenceRule));
      pi++;
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_by = $${pi}`, `updated_at = NOW()`);
    params.push(userId);
    pi++;

    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".tasks SET ${updates.join(', ')} WHERE id = $${pi}`,
      params,
    );

    // Check if status changed to completed
    if (dto.statusId && dto.statusId !== existing.statusId) {
      const [newStatus] = await this.dataSource.query(
        `SELECT is_completed FROM "${schemaName}".task_statuses WHERE id = $1`,
        [dto.statusId],
      );
      if (newStatus?.is_completed) {
        await this.dataSource.query(
          `UPDATE "${schemaName}".tasks SET completed_at = NOW() WHERE id = $1 AND completed_at IS NULL`,
          [id],
        );
        // Generate next recurring instance if needed
        await this.generateNextRecurrence(schemaName, id, userId);

        // ── Notification: task completed ──
        if (existing.ownerId && existing.ownerId !== userId) {
          const ownerName = existing.owner
            ? `${existing.owner.firstName || ''} ${existing.owner.lastName || ''}`.trim()
            : 'User';
          const [completedByUser] = await this.dataSource.query(
            `SELECT first_name, last_name FROM "${schemaName}".users WHERE id = $1`, [userId],
          );
          const completedByName = completedByUser
            ? `${completedByUser.first_name || ''} ${completedByUser.last_name || ''}`.trim()
            : 'Someone';

          this.notificationService.notify(schemaName, {
            userId: existing.ownerId,
            eventType: 'task_completed',
            title: `Task completed: ${existing.title}`,
            icon: 'check-circle',
            actionUrl: `/tasks/${id}`,
            entityType: 'tasks',
            entityId: id,
            variables: {
              ownerName,
              taskTitle: existing.title,
              completedBy: completedByName,
              actionUrl: `${process.env.APP_URL || 'http://localhost:5173'}/tasks/${id}`,
            },
          }).catch(err => this.logger.error(`Notification failed (task_completed): ${err.message}`));
        }
      } else {
        // Reopen — clear completed_at
        await this.dataSource.query(
          `UPDATE "${schemaName}".tasks SET completed_at = NULL WHERE id = $1`,
          [id],
        );
      }
    }

    const updated = await this.findOne(schemaName, id);

    // ── Notification: assignee changed ──
    if (dto.assignedTo && dto.assignedTo !== existing.assignedTo && dto.assignedTo !== userId) {
      const newAssigneeName = updated.assignee
        ? `${updated.assignee.firstName || ''} ${updated.assignee.lastName || ''}`.trim()
        : 'User';
      const dueDateLabel = updated.dueDate
        ? new Date(updated.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No due date';

      this.notificationService.notify(schemaName, {
        userId: dto.assignedTo,
        eventType: 'task_assigned',
        title: `Task reassigned to you: ${updated.title}`,
        body: updated.description || undefined,
        icon: 'check-square',
        actionUrl: `/tasks/${id}`,
        entityType: 'tasks',
        entityId: id,
        variables: {
          assigneeName: newAssigneeName,
          taskTitle: updated.title,
          dueDate: dueDateLabel,
          priority: updated.priority?.name || 'Medium',
          actionUrl: `${process.env.APP_URL || 'http://localhost:5173'}/tasks/${id}`,
        },
      }).catch(err => this.logger.error(`Notification failed (task_reassigned): ${err.message}`));
    }

    // Audit
    const changes = this.auditService.calculateChanges(existing, updated, this.trackedFields);
    if (Object.keys(changes).length > 0) {
      await this.activityService.create(schemaName, {
        entityType: 'tasks',
        entityId: id,
        activityType: 'updated',
        title: 'Task updated',
        description: `Updated: ${Object.keys(changes).join(', ')}`,
        metadata: { changedFields: Object.keys(changes) },
        performedBy: userId,
      });

      await this.auditService.log(schemaName, {
        entityType: 'tasks',
        entityId: id,
        action: 'update',
        changes,
        previousValues: existing,
        newValues: updated,
        performedBy: userId,
      });
    }

    // ── Calendar sync: push update to Google ──
    if (updated.assignedTo || updated.ownerId) {
      this.calendarSyncService.onTaskChanged(schemaName, updated.assignedTo || updated.ownerId, id, 'update')
        .catch(err => this.logger.error(`Calendar sync failed (update): ${err.message}`));
    }

    return updated;
  }

  // ============================================================
  // COMPLETE / REOPEN shortcuts
  // ============================================================
  async complete(schemaName: string, id: string, userId: string, result?: string): Promise<any> {
    const [completedStatus] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".task_statuses WHERE is_completed = true AND is_active = true ORDER BY sort_order ASC LIMIT 1`,
    );
    if (!completedStatus) throw new BadRequestException('No completed status configured');

    return this.update(schemaName, id, userId, {
      statusId: completedStatus.id,
      result: result || undefined,
    });
  }

  async reopen(schemaName: string, id: string, userId: string): Promise<any> {
    const [openStatus] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".task_statuses WHERE slug = 'in_progress' AND is_active = true LIMIT 1`,
    );
    if (!openStatus) throw new BadRequestException('No open status configured');

    return this.update(schemaName, id, userId, { statusId: openStatus.id });
  }

  // ============================================================
  // DELETE (soft)
  // ============================================================
  async remove(schemaName: string, id: string, userId: string) {
    const task = await this.findOne(schemaName, id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".tasks SET deleted_at = NOW(), updated_by = $1 WHERE id = $2`,
      [userId, id],
    );

    // Also soft-delete subtasks
    await this.dataSource.query(
      `UPDATE "${schemaName}".tasks SET deleted_at = NOW(), updated_by = $1 WHERE parent_task_id = $2 AND deleted_at IS NULL`,
      [userId, id],
    );

    await this.activityService.create(schemaName, {
      entityType: 'tasks',
      entityId: id,
      activityType: 'deleted',
      title: 'Task deleted',
      description: `"${task.title}" was deleted`,
      performedBy: userId,
    });

    await this.auditService.log(schemaName, {
      entityType: 'tasks',
      entityId: id,
      action: 'delete',
      changes: {},
      previousValues: task,
      performedBy: userId,
    });

    // ── Calendar sync: remove from Google ──
    if (task.assignedTo || task.ownerId) {
      this.calendarSyncService.onTaskChanged(schemaName, task.assignedTo || task.ownerId, id, 'delete')
        .catch(err => this.logger.error(`Calendar sync failed (delete): ${err.message}`));
    }
    
    return { message: 'Task deleted' };
  }

  // ============================================================
  // GET TASKS FOR ENTITY (lead/contact/account/opp detail pages)
  // ============================================================
  async getByEntity(schemaName: string, entityType: string, entityId: string) {
    const tasks = await this.dataSource.query(
      `SELECT t.*,
              ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
              ts.is_open as status_is_open, ts.is_completed as status_is_completed,
              tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
              tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
              tp.icon as priority_icon, tp.level as priority_level,
              au.first_name as assignee_first, au.last_name as assignee_last,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.deleted_at IS NULL) as subtask_count,
              (SELECT COUNT(*) FROM "${schemaName}".tasks st WHERE st.parent_task_id = t.id AND st.completed_at IS NOT NULL AND st.deleted_at IS NULL) as completed_subtask_count
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
       WHERE t.related_entity_type = $1 AND t.related_entity_id = $2
         AND t.parent_task_id IS NULL AND t.deleted_at IS NULL
       ORDER BY t.completed_at ASC NULLS FIRST, tp.level DESC NULLS LAST, t.due_date ASC NULLS LAST`,
      [entityType, entityId],
    );

    return tasks.map((t: any) => this.formatTask(t));
  }

  // ============================================================
  // DASHBOARD METHODS
  // ============================================================
  async getDueTodayCount(schemaName: string, userId: string): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks
       WHERE (assigned_to = $1 OR owner_id = $1)
         AND due_date::date = CURRENT_DATE
         AND completed_at IS NULL AND deleted_at IS NULL`,
      [userId],
    );
    return parseInt(count, 10);
  }

  async getOverdueCount(schemaName: string, userId: string): Promise<number> {
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks
       WHERE (assigned_to = $1 OR owner_id = $1)
         AND due_date < NOW()
         AND completed_at IS NULL AND deleted_at IS NULL`,
      [userId],
    );
    return parseInt(count, 10);
  }

  async getUpcoming(schemaName: string, userId: string, days: number = 7, limit: number = 10) {
    const tasks = await this.dataSource.query(
      `SELECT t.*,
              ts.name as status_name, ts.slug as status_slug, ts.color as status_color,
              ts.is_open as status_is_open, ts.is_completed as status_is_completed,
              tt.name as type_name, tt.slug as type_slug, tt.icon as type_icon, tt.color as type_color,
              tp.name as priority_name, tp.slug as priority_slug, tp.color as priority_color,
              tp.icon as priority_icon, tp.level as priority_level,
              au.first_name as assignee_first, au.last_name as assignee_last
       FROM "${schemaName}".tasks t
       LEFT JOIN "${schemaName}".task_statuses ts ON t.status_id = ts.id
       LEFT JOIN "${schemaName}".task_types tt ON t.task_type_id = tt.id
       LEFT JOIN "${schemaName}".task_priorities tp ON t.priority_id = tp.id
       LEFT JOIN "${schemaName}".users au ON t.assigned_to = au.id
       WHERE (t.assigned_to = $1 OR t.owner_id = $1)
         AND t.completed_at IS NULL AND t.deleted_at IS NULL
         AND (t.due_date IS NULL OR t.due_date <= NOW() + INTERVAL '${days} days')
       ORDER BY t.due_date ASC NULLS LAST, tp.level DESC NULLS LAST
       LIMIT $2`,
      [userId, limit],
    );

    return tasks.map((t: any) => this.formatTask(t));
  }

  // ============================================================
  // RECURRING TASK GENERATION
  // ============================================================
  private async generateNextRecurrence(schemaName: string, taskId: string, userId: string) {
    const [task] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".tasks WHERE id = $1 AND deleted_at IS NULL`,
      [taskId],
    );

    if (!task || !task.is_recurring || !task.recurrence_rule) return;

    const rule = typeof task.recurrence_rule === 'string'
      ? JSON.parse(task.recurrence_rule)
      : task.recurrence_rule;

    // Check if recurrence should end
    if (rule.endType === 'after') {
      const [{ count }] = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${schemaName}".tasks
         WHERE recurrence_parent_id = $1 AND deleted_at IS NULL`,
        [task.recurrence_parent_id || taskId],
      );
      if (parseInt(count, 10) >= (rule.endAfterCount || 10)) return;
    }

    if (rule.endType === 'on' && rule.endDate) {
      if (new Date() > new Date(rule.endDate)) return;
    }

    // Calculate next due date
    const nextDue = this.calculateNextDueDate(
      task.due_date ? new Date(task.due_date) : new Date(),
      rule,
    );

    if (!nextDue) return;

    // Count existing recurrences for index
    const [{ count: recIdx }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks
       WHERE recurrence_parent_id = $1 AND deleted_at IS NULL`,
      [task.recurrence_parent_id || taskId],
    );

    // Default status (first open)
    const [defaultStatus] = await this.dataSource.query(
      `SELECT id FROM "${schemaName}".task_statuses WHERE is_open = true AND is_active = true ORDER BY sort_order ASC LIMIT 1`,
    );

    await this.dataSource.query(
      `INSERT INTO "${schemaName}".tasks (
        title, description, task_type_id, status_id, priority_id,
        due_date, estimated_minutes,
        owner_id, assigned_to,
        related_entity_type, related_entity_id,
        is_recurring, recurrence_rule,
        recurrence_parent_id, recurrence_index,
        tags, custom_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        $16, $17, $18
      )`,
      [
        task.title,
        task.description,
        task.task_type_id,
        defaultStatus?.id || task.status_id,
        task.priority_id,
        nextDue,
        task.estimated_minutes,
        task.owner_id,
        task.assigned_to,
        task.related_entity_type,
        task.related_entity_id,
        true,
        JSON.stringify(rule),
        task.recurrence_parent_id || taskId,
        parseInt(recIdx, 10) + 1,
        task.tags,
        task.custom_fields ? JSON.stringify(task.custom_fields) : '{}',
        userId,
      ],
    );
  }

  private calculateNextDueDate(currentDue: Date, rule: any): Date | null {
    const interval = rule.interval || 1;
    const next = new Date(currentDue);

    switch (rule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7 * interval);
        break;
      case 'biweekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + interval);
        break;
      default:
        return null;
    }

    // Check end date
    if (rule.endType === 'on' && rule.endDate && next > new Date(rule.endDate)) {
      return null;
    }

    return next;
  }

  // ============================================================
  // SETTINGS
  // ============================================================
  async getSettings(schemaName: string): Promise<Record<string, any>> {
    const settings = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_settings ORDER BY setting_key ASC`,
    );
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.setting_key] = typeof s.setting_value === 'string'
        ? JSON.parse(s.setting_value) : s.setting_value;
    }
    return result;
  }

  async updateSetting(schemaName: string, key: string, value: any) {
    await this.dataSource.query(
      `INSERT INTO "${schemaName}".task_settings (setting_key, setting_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = "${schemaName}".task_settings.setting_value || $2::jsonb,
         updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
    return this.getSettings(schemaName);
  }

  // ============================================================
  // LOOKUPS (types, statuses, priorities)
  // ============================================================
  async getTypes(schemaName: string) {
    const types = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_types WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return types.map((t: any) => ({
      id: t.id, name: t.name, slug: t.slug, icon: t.icon, color: t.color,
      description: t.description, defaultDurationMinutes: t.default_duration_minutes,
      isSystem: t.is_system, isActive: t.is_active, sortOrder: t.sort_order,
    }));
  }

  async createType(schemaName: string, data: { name: string; icon?: string; color?: string; description?: string; defaultDurationMinutes?: number }) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const [type] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".task_types (name, slug, icon, color, description, default_duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, slug, data.icon || 'check-square', data.color || '#3B82F6', data.description || null, data.defaultDurationMinutes || null],
    );
    return type;
  }

  async updateType(schemaName: string, id: string, data: any) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({ name: 'name', icon: 'icon', color: 'color', description: 'description', defaultDurationMinutes: 'default_duration_minutes', isActive: 'is_active', sortOrder: 'sort_order' })) {
      if (data[key] !== undefined) { updates.push(`${col} = $${idx}`); params.push(data[key]); idx++; }
    }
    if (updates.length === 0) return;
    updates.push(`updated_at = NOW()`);
    params.push(id);
    await this.dataSource.query(`UPDATE "${schemaName}".task_types SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    return this.getTypes(schemaName);
  }

  async deleteType(schemaName: string, id: string) {
    const [type] = await this.dataSource.query(`SELECT * FROM "${schemaName}".task_types WHERE id = $1`, [id]);
    if (!type) throw new NotFoundException('Type not found');
    if (type.is_system) throw new BadRequestException('Cannot delete system task types');
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks WHERE task_type_id = $1 AND deleted_at IS NULL`, [id],
    );
    if (parseInt(count, 10) > 0) throw new BadRequestException(`Cannot delete — ${count} task(s) use this type`);
    await this.dataSource.query(`DELETE FROM "${schemaName}".task_types WHERE id = $1`, [id]);
    return { success: true };
  }

  // ============================================================
  // STATUS CRUD
  // ============================================================

  async createStatus(schemaName: string, data: { name: string; color?: string; icon?: string; isOpen?: boolean; isCompleted?: boolean }): Promise<any> {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    // Ensure only one status can be isCompleted = true
    if (data.isCompleted) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".task_statuses SET is_completed = false WHERE is_completed = true`,
      );
    }

    const [maxOrder]: [any] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".task_statuses`,
    );

    const [status]: [any] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".task_statuses (name, slug, color, icon, is_open, is_completed, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.name, slug, data.color || '#6B7280', data.icon || null,
       data.isOpen ?? true, data.isCompleted ?? false, maxOrder.next_order],
    );

    return this.formatStatus(status);
  }

  async updateStatus(schemaName: string, id: string, data: any): Promise<any> {
    const [existing]: [any] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_statuses WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Status not found');

    // If setting isCompleted = true, unset others
    if (data.isCompleted === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".task_statuses SET is_completed = false WHERE id != $1`, [id],
      );
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({
      name: 'name', color: 'color', icon: 'icon',
      isOpen: 'is_open', isCompleted: 'is_completed',
      isActive: 'is_active', sortOrder: 'sort_order',
    })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (updates.length === 0) return this.formatStatus(existing);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".task_statuses SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    return this.getStatuses(schemaName);
  }

  async deleteStatus(schemaName: string, id: string): Promise<any> {
    const [status]: [any] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_statuses WHERE id = $1`, [id],
    );
    if (!status) throw new NotFoundException('Status not found');
    if (status.is_system) throw new BadRequestException('Cannot delete system statuses');

    const [{ count }]: [any] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks WHERE status_id = $1 AND deleted_at IS NULL`, [id],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} task(s) use this status`);
    }

    await this.dataSource.query(`DELETE FROM "${schemaName}".task_statuses WHERE id = $1`, [id]);
    return { success: true };
  }

  async reorderStatuses(schemaName: string, statusIds: string[]): Promise<any> {
    for (let i = 0; i < statusIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".task_statuses SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [i + 1, statusIds[i]],
      );
    }
    return this.getStatuses(schemaName);
  }

  // ============================================================
  // PRIORITY CRUD
  // ============================================================

  async createPriority(schemaName: string, data: { name: string; color?: string; icon?: string; level?: number }): Promise<any> {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    const [maxOrder]: [any] = await this.dataSource.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM "${schemaName}".task_priorities`,
    );

    const [priority]: [any] = await this.dataSource.query(
      `INSERT INTO "${schemaName}".task_priorities (name, slug, color, icon, level, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, slug, data.color || '#6B7280', data.icon || 'minus', data.level ?? 0, maxOrder.next_order],
    );

    return this.formatPriority(priority);
  }

  async updatePriority(schemaName: string, id: string, data: any): Promise<any> {
    const [existing]: [any] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_priorities WHERE id = $1`, [id],
    );
    if (!existing) throw new NotFoundException('Priority not found');

    if (data.isDefault === true) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".task_priorities SET is_default = false WHERE id != $1`, [id],
      );
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries({
      name: 'name', color: 'color', icon: 'icon', level: 'level',
      isDefault: 'is_default', isActive: 'is_active', sortOrder: 'sort_order',
    })) {
      if (data[key] !== undefined) {
        updates.push(`${col} = $${idx}`);
        params.push(data[key]);
        idx++;
      }
    }

    if (updates.length === 0) return this.formatPriority(existing);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await this.dataSource.query(
      `UPDATE "${schemaName}".task_priorities SET ${updates.join(', ')} WHERE id = $${idx}`,
      params,
    );

    return this.getPriorities(schemaName);
  }

  async deletePriority(schemaName: string, id: string): Promise<any> {
    const [priority]: [any] = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_priorities WHERE id = $1`, [id],
    );
    if (!priority) throw new NotFoundException('Priority not found');
    if (priority.is_system) throw new BadRequestException('Cannot delete system priorities');

    const [{ count }]: [any] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${schemaName}".tasks WHERE priority_id = $1 AND deleted_at IS NULL`, [id],
    );
    if (parseInt(count, 10) > 0) {
      throw new BadRequestException(`Cannot delete — ${count} task(s) use this priority`);
    }

    await this.dataSource.query(`DELETE FROM "${schemaName}".task_priorities WHERE id = $1`, [id]);
    return { success: true };
  }

  async reorderPriorities(schemaName: string, priorityIds: string[]): Promise<any> {
    for (let i = 0; i < priorityIds.length; i++) {
      await this.dataSource.query(
        `UPDATE "${schemaName}".task_priorities SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [i + 1, priorityIds[i]],
      );
    }
    return this.getPriorities(schemaName);
  }
  
  async getStatuses(schemaName: string) {
    const statuses = await this.dataSource.query(
      `SELECT ts.*,
              (SELECT COUNT(*) FROM "${schemaName}".tasks t WHERE t.status_id = ts.id AND t.deleted_at IS NULL) as task_count
       FROM "${schemaName}".task_statuses ts
       ORDER BY ts.sort_order ASC`,
    );
    return statuses.map((s: any) => ({
      id: s.id, name: s.name, slug: s.slug, color: s.color, icon: s.icon,
      isOpen: s.is_open, isCompleted: s.is_completed, isSystem: s.is_system,
      isActive: s.is_active, sortOrder: s.sort_order, taskCount: parseInt(s.task_count || '0', 10),
    }));
  }

  async getPriorities(schemaName: string) {
    const priorities = await this.dataSource.query(
      `SELECT * FROM "${schemaName}".task_priorities WHERE is_active = true ORDER BY sort_order ASC`,
    );
    return priorities.map((p: any) => ({
      id: p.id, name: p.name, slug: p.slug, color: p.color, icon: p.icon,
      level: p.level, isDefault: p.is_default, isSystem: p.is_system,
      isActive: p.is_active, sortOrder: p.sort_order,
    }));
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private async getTaskDepth(schemaName: string, taskId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = taskId;
    while (currentId) {
      const [row]: [any] = await this.dataSource.query(
        `SELECT parent_task_id FROM "${schemaName}".tasks WHERE id = $1 AND deleted_at IS NULL`,
        [currentId],
        );
        if (!row || !row.parent_task_id) break;
        currentId = row.parent_task_id;
      depth++;
      if (depth > 10) break; // safety
    }
    return depth;
  }

  private formatTask(t: Record<string, any>): any {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      taskTypeId: t.task_type_id,
      taskType: t.type_name ? {
        id: t.task_type_id, name: t.type_name, slug: t.type_slug,
        icon: t.type_icon, color: t.type_color,
      } : null,
      statusId: t.status_id,
      status: t.status_name ? {
        id: t.status_id, name: t.status_name, slug: t.status_slug,
        color: t.status_color, isOpen: t.status_is_open, isCompleted: t.status_is_completed,
      } : null,
      priorityId: t.priority_id,
      priority: t.priority_name ? {
        id: t.priority_id, name: t.priority_name, slug: t.priority_slug,
        color: t.priority_color, icon: t.priority_icon, level: t.priority_level,
      } : null,
      dueDate: t.due_date,
      startDate: t.start_date,
      completedAt: t.completed_at,
      reminderAt: t.reminder_at,
      estimatedMinutes: t.estimated_minutes,
      actualMinutes: t.actual_minutes,
      ownerId: t.owner_id,
      owner: t.owner_first ? { id: t.owner_id, firstName: t.owner_first, lastName: t.owner_last } : null,
      assignedTo: t.assigned_to,
      assignee: t.assignee_first ? { id: t.assigned_to, firstName: t.assignee_first, lastName: t.assignee_last } : null,
      relatedEntityType: t.related_entity_type,
      relatedEntityId: t.related_entity_id,
      parentTaskId: t.parent_task_id,
      isRecurring: t.is_recurring || false,
      recurrenceRule: typeof t.recurrence_rule === 'string' ? JSON.parse(t.recurrence_rule) : (t.recurrence_rule || null),
      recurrenceParentId: t.recurrence_parent_id,
      recurrenceIndex: t.recurrence_index,
      tags: t.tags || [],
      customFields: typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields) : (t.custom_fields || {}),
      result: t.result,
      subtaskCount: parseInt(t.subtask_count || '0', 10),
      completedSubtaskCount: parseInt(t.completed_subtask_count || '0', 10),
      createdBy: t.created_by,
      createdByUser: t.created_by_first ? { id: t.created_by, firstName: t.created_by_first, lastName: t.created_by_last } : null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }

  private formatStatus(s: Record<string, any>): any {
    return {
      id: s.id, name: s.name, slug: s.slug, color: s.color, icon: s.icon,
      isOpen: s.is_open, isCompleted: s.is_completed, isSystem: s.is_system,
      isActive: s.is_active, sortOrder: s.sort_order,
    };
  }

  private formatPriority(p: Record<string, any>): any {
    return {
      id: p.id, name: p.name, slug: p.slug, color: p.color, icon: p.icon,
      level: p.level, isDefault: p.is_default, isSystem: p.is_system,
      isActive: p.is_active, sortOrder: p.sort_order,
    };
  }
}
