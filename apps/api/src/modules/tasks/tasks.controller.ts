// ============================================================
// FILE: apps/api/src/modules/tasks/tasks.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Query, Body, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PermissionGuard, RequirePermission } from '../../common/guards/permissions.guard';
import { TasksService, CreateTaskDto, UpdateTaskDto, QueryTasksDto } from './tasks.service';
import { ActivityService } from '../shared/activity.service';
import { AuditService } from '../shared/audit.service';
import { NotesService } from '../shared/notes.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private tasksService: TasksService,
    private activityService: ActivityService,
    private auditService: AuditService,
    private notesService: NotesService,
  ) {}

  // ============================================================
  // LOOKUPS — must be BEFORE :id routes
  // ============================================================

  @Get('types')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get all task types' })
  async getTypes(@Request() req: { user: JwtPayload }) {
    return this.tasksService.getTypes(req.user.tenantSchema);
  }

  @Post('types')
  @RequirePermission('tasks', 'create')
  @ApiOperation({ summary: 'Create a task type' })
  async createType(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; icon?: string; color?: string; description?: string; defaultDurationMinutes?: number },
  ) {
    return this.tasksService.createType(req.user.tenantSchema, body);
  }

  @Put('types/:typeId')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Update a task type' })
  async updateType(
    @Request() req: { user: JwtPayload },
    @Param('typeId') typeId: string,
    @Body() body: any,
  ) {
    return this.tasksService.updateType(req.user.tenantSchema, typeId, body);
  }

  @Delete('types/:typeId')
  @RequirePermission('tasks', 'delete')
  @ApiOperation({ summary: 'Delete a task type' })
  async deleteType(
    @Request() req: { user: JwtPayload },
    @Param('typeId') typeId: string,
  ) {
    return this.tasksService.deleteType(req.user.tenantSchema, typeId);
  }

  @Post('statuses')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Create a task status' })
  async createStatus(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; color?: string; icon?: string; isOpen?: boolean; isCompleted?: boolean },
  ) {
    return this.tasksService.createStatus(req.user.tenantSchema, body);
  }

  @Put('statuses/reorder')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Reorder task statuses' })
  async reorderStatuses(
    @Request() req: { user: JwtPayload },
    @Body() body: { statusIds: string[] },
  ) {
    return this.tasksService.reorderStatuses(req.user.tenantSchema, body.statusIds);
  }

  @Put('statuses/:statusId')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Update a task status' })
  async updateStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
    @Body() body: any,
  ) {
    return this.tasksService.updateStatus(req.user.tenantSchema, statusId, body);
  }

  @Delete('statuses/:statusId')
  @RequirePermission('tasks', 'delete')
  @ApiOperation({ summary: 'Delete a task status' })
  async deleteStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
  ) {
    return this.tasksService.deleteStatus(req.user.tenantSchema, statusId);
  }

  @Get('statuses')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get all task statuses' })
  async getStatuses(@Request() req: { user: JwtPayload }) {
    return this.tasksService.getStatuses(req.user.tenantSchema);
  }

  @Post('priorities')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Create a task priority' })
  async createPriority(
    @Request() req: { user: JwtPayload },
    @Body() body: { name: string; color?: string; icon?: string; level?: number },
  ) {
    return this.tasksService.createPriority(req.user.tenantSchema, body);
  }

  @Put('priorities/reorder')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Reorder task priorities' })
  async reorderPriorities(
    @Request() req: { user: JwtPayload },
    @Body() body: { priorityIds: string[] },
  ) {
    return this.tasksService.reorderPriorities(req.user.tenantSchema, body.priorityIds);
  }

  @Put('priorities/:priorityId')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Update a task priority' })
  async updatePriority(
    @Request() req: { user: JwtPayload },
    @Param('priorityId') priorityId: string,
    @Body() body: any,
  ) {
    return this.tasksService.updatePriority(req.user.tenantSchema, priorityId, body);
  }

  @Delete('priorities/:priorityId')
  @RequirePermission('tasks', 'delete')
  @ApiOperation({ summary: 'Delete a task priority' })
  async deletePriority(
    @Request() req: { user: JwtPayload },
    @Param('priorityId') priorityId: string,
  ) {
    return this.tasksService.deletePriority(req.user.tenantSchema, priorityId);
  }
  
  @Get('priorities')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get all task priorities' })
  async getPriorities(@Request() req: { user: JwtPayload }) {
    return this.tasksService.getPriorities(req.user.tenantSchema);
  }

  @Get('settings')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task settings' })
  async getSettings(@Request() req: { user: JwtPayload }) {
    return this.tasksService.getSettings(req.user.tenantSchema);
  }

  @Put('settings/:key')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Update a task setting' })
  async updateSetting(
    @Request() req: { user: JwtPayload },
    @Param('key') key: string,
    @Body() body: any,
  ) {
    return this.tasksService.updateSetting(req.user.tenantSchema, key, body);
  }

  // ============================================================
  // DASHBOARD ENDPOINTS — before :id
  // ============================================================

  @Get('dashboard/upcoming')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get upcoming tasks for current user (dashboard)' })
  async getUpcoming(
    @Request() req: { user: JwtPayload },
    @Query('days') days?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tasksService.getUpcoming(
      req.user.tenantSchema, req.user.sub,
      days || 7, limit || 10,
    );
  }

  @Get('dashboard/counts')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task counts for dashboard' })
  async getDashboardCounts(@Request() req: { user: JwtPayload }) {
    const [dueToday, overdue] = await Promise.all([
      this.tasksService.getDueTodayCount(req.user.tenantSchema, req.user.sub),
      this.tasksService.getOverdueCount(req.user.tenantSchema, req.user.sub),
    ]);
    return { dueToday, overdue };
  }

  // ============================================================
  // ENTITY TASKS — tasks linked to a specific entity
  // ============================================================

  @Get('entity/:entityType/:entityId')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get tasks for a specific entity (lead, contact, etc.)' })
  async getEntityTasks(
    @Request() req: { user: JwtPayload },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.tasksService.getByEntity(req.user.tenantSchema, entityType, entityId);
  }

  // ============================================================
  // CORE CRUD
  // ============================================================

  @Get()
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'List tasks (list or kanban)' })
  async findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryTasksDto,
  ) {
    return this.tasksService.findAll(req.user.tenantSchema, query, req.user.sub);
  }

  @Post()
  @RequirePermission('tasks', 'create')
  @ApiOperation({ summary: 'Create a task' })
  async create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(req.user.tenantSchema, req.user.sub, dto);
  }

  @Get(':id')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task by ID (includes subtasks)' })
  async findOne(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.tasksService.findOne(req.user.tenantSchema, id);
  }

  @Put(':id')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(req.user.tenantSchema, id, req.user.sub, dto);
  }

  @Delete(':id')
  @RequirePermission('tasks', 'delete')
  @ApiOperation({ summary: 'Delete a task (soft)' })
  async remove(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.tasksService.remove(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // QUICK ACTIONS
  // ============================================================

  @Patch(':id/complete')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Mark task as completed' })
  async complete(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { result?: string },
  ) {
    return this.tasksService.complete(req.user.tenantSchema, id, req.user.sub, body.result);
  }

  @Patch(':id/reopen')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Reopen a completed task' })
  async reopen(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.tasksService.reopen(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // SUBTASKS
  // ============================================================

  @Get(':id/subtasks')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get subtasks for a task' })
  async getSubtasks(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.tasksService.findAll(req.user.tenantSchema, { parentTaskId: id } as any);
  }

  @Post(':id/subtasks')
  @RequirePermission('tasks', 'create')
  @ApiOperation({ summary: 'Create a subtask' })
  async createSubtask(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(req.user.tenantSchema, req.user.sub, {
      ...dto,
      parentTaskId: id,
    });
  }

  // ============================================================
  // NOTES on tasks
  // ============================================================

  @Get(':id/notes')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task notes' })
  async getNotes(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.notesService.findByEntity(req.user.tenantSchema, 'tasks', id);
  }

  @Post(':id/notes')
  @RequirePermission('tasks', 'edit')
  @ApiOperation({ summary: 'Add a note to a task' })
  async addNote(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const note = await this.notesService.create(
      req.user.tenantSchema, 'tasks', id, body.content, req.user.sub,
    );

    await this.activityService.create(req.user.tenantSchema, {
      entityType: 'tasks',
      entityId: id,
      activityType: 'note_added',
      title: 'Note added',
      performedBy: req.user.sub,
    });

    return note;
  }

  // ============================================================
  // ACTIVITIES / HISTORY
  // ============================================================

  @Get(':id/activities')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task activities' })
  async getActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.activityService.getTimeline(req.user.tenantSchema, 'tasks', id, page, limit);
  }

  @Get(':id/history')
  @RequirePermission('tasks', 'view')
  @ApiOperation({ summary: 'Get task change history' })
  async getHistory(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.auditService.getHistory(req.user.tenantSchema, 'tasks', id);
  }
}