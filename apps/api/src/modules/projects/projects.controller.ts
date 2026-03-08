// ============================================================
// FILE: apps/api/src/modules/projects/projects.controller.ts
//
// 25 endpoints: CRUD, templates, members, tasks, dependencies,
// comments, time tracking, Kanban, Gantt, client portal
// ============================================================
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard, RequirePermission, AdminOnly } from '../../common/guards/permissions.guard';
import { ProjectsService } from './projects.service';
import { DocumentsService } from '../shared/documents.service';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSchema: string;
  tenantSlug: string;
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly documentsService: DocumentsService,
  ) {}

  // ============================================================
  // NAMED ROUTES (before :id)
  // ============================================================

  @Get('statuses')
  @ApiOperation({ summary: 'Get project statuses' })
  async getStatuses(@Request() req: { user: JwtPayload }) {
    return this.projectsService.getStatuses(req.user.tenantSchema);
  }

  @Get('task-statuses')
  @ApiOperation({ summary: 'Get project task statuses' })
  async getTaskStatuses(@Request() req: { user: JwtPayload }) {
    return this.projectsService.getTaskStatuses(req.user.tenantSchema);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get project templates' })
  async getTemplates(@Request() req: { user: JwtPayload }) {
    return this.projectsService.getTemplates(req.user.tenantSchema);
  }

  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get project template by ID with phases and tasks' })
  async getTemplateById(
    @Request() req: { user: JwtPayload },
    @Param('templateId') templateId: string,
  ) {
    return this.projectsService.getTemplateById(req.user.tenantSchema, templateId);
  }

  // ============================================================
  // ADMIN CRUD — Project Statuses
  // ============================================================

  @Post('admin/project-statuses')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Create project status' })
  async createProjectStatus(
    @Request() req: { user: JwtPayload },
    @Body() dto: { name: string; color?: string; icon?: string; description?: string; isClosed?: boolean; sortOrder?: number },
  ) {
    return this.projectsService.createProjectStatus(req.user.tenantSchema, dto);
  }

  @Patch('admin/project-statuses/:statusId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update project status' })
  async updateProjectStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
    @Body() dto: { name?: string; color?: string; icon?: string; description?: string; isClosed?: boolean; isActive?: boolean; sortOrder?: number },
  ) {
    return this.projectsService.updateProjectStatus(req.user.tenantSchema, statusId, dto);
  }

  @Delete('admin/project-statuses/:statusId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete project status' })
  async deleteProjectStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
  ) {
    try {
      return await this.projectsService.deleteProjectStatus(req.user.tenantSchema, statusId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  // ============================================================
  // ADMIN CRUD — Task Statuses
  // ============================================================

  @Post('admin/task-statuses')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Create project task status' })
  async createProjectTaskStatus(
    @Request() req: { user: JwtPayload },
    @Body() dto: { name: string; color?: string; isDone?: boolean; sortOrder?: number },
  ) {
    return this.projectsService.createProjectTaskStatus(req.user.tenantSchema, dto);
  }

  @Patch('admin/task-statuses/:statusId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update project task status' })
  async updateProjectTaskStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
    @Body() dto: { name?: string; color?: string; isDone?: boolean; sortOrder?: number },
  ) {
    return this.projectsService.updateProjectTaskStatus(req.user.tenantSchema, statusId, dto);
  }

  @Delete('admin/task-statuses/:statusId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete project task status' })
  async deleteProjectTaskStatus(
    @Request() req: { user: JwtPayload },
    @Param('statusId') statusId: string,
  ) {
    try {
      return await this.projectsService.deleteProjectTaskStatus(req.user.tenantSchema, statusId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  // ============================================================
  // ADMIN CRUD — Templates
  // ============================================================

  @Post('admin/templates')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Create project template' })
  async createTemplate(
    @Request() req: { user: JwtPayload },
    @Body() dto: { name: string; description?: string; color?: string; icon?: string; estimatedDays?: number },
  ) {
    return this.projectsService.createTemplate(req.user.tenantSchema, dto, req.user.sub);
  }

  @Patch('admin/templates/:templateId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Update project template' })
  async updateTemplate(
    @Request() req: { user: JwtPayload },
    @Param('templateId') templateId: string,
    @Body() dto: { name?: string; description?: string; color?: string; icon?: string; estimatedDays?: number; isActive?: boolean },
  ) {
    return this.projectsService.updateTemplate(req.user.tenantSchema, templateId, dto);
  }

  @Delete('admin/templates/:templateId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete project template' })
  async deleteTemplate(
    @Request() req: { user: JwtPayload },
    @Param('templateId') templateId: string,
  ) {
    try {
      return await this.projectsService.deleteTemplate(req.user.tenantSchema, templateId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Post('from-opportunity')
  @ApiOperation({ summary: 'Create project from an opportunity' })
  async createFromOpportunity(
    @Request() req: { user: JwtPayload },
    @Body() body: { opportunityId: string; templateId?: string },
  ) {
    return this.projectsService.createFromOpportunity(
      req.user.tenantSchema,
      body.opportunityId,
      body.templateId || null,
      req.user.sub,
    );
  }

  // ============================================================
  // CORE CRUD
  // ============================================================

  @Get()
  @ApiOperation({ summary: 'List projects with filters' })
  async listProjects(
    @Request() req: { user: JwtPayload },
    @Query('statusId') statusId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('accountId') accountId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.projectsService.listProjects(req.user.tenantSchema, {
      statusId, ownerId, accountId, search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @Request() req: { user: JwtPayload },
    @Body() dto: {
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
    },
  ) {
    return this.projectsService.createProject(req.user.tenantSchema, dto, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID with full detail' })
  async getProjectById(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    const project = await this.projectsService.getProjectById(req.user.tenantSchema, id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  async updateProject(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.projectsService.updateProject(req.user.tenantSchema, id, dto, req.user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete project' })
  async deleteProject(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.deleteProject(req.user.tenantSchema, id, req.user.sub);
  }

  // ============================================================
  // KANBAN + GANTT
  // ============================================================

  @Get(':id/kanban')
  @ApiOperation({ summary: 'Get Kanban board data for project' })
  async getKanbanData(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.getKanbanData(req.user.tenantSchema, id);
  }

  @Get(':id/gantt')
  @ApiOperation({ summary: 'Get Gantt chart data for project' })
  async getGanttData(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.getGanttData(req.user.tenantSchema, id);
  }

  // ============================================================
  // MEMBERS
  // ============================================================

  @Get(':id/members')
  @ApiOperation({ summary: 'Get project members' })
  async getMembers(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.getMembers(req.user.tenantSchema, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add project member' })
  async addMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.projectsService.addMember(
      req.user.tenantSchema, id, body.userId, body.role ?? 'member', req.user.sub,
    );
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove project member' })
  async removeMember(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.projectsService.removeMember(req.user.tenantSchema, id, memberId);
  }

  // ============================================================
  // TASKS
  // ============================================================

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Create task in project' })
  async createTask(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.projectsService.createTask(req.user.tenantSchema, id, dto, req.user.sub);
  }

  @Put(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Update project task' })
  async updateTask(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: any,
  ) {
    return this.projectsService.updateTask(req.user.tenantSchema, id, taskId, dto, req.user.sub);
  }

  @Delete(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Soft-delete project task' })
  async deleteTask(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectsService.deleteTask(req.user.tenantSchema, taskId, req.user.sub);
  }

  // ============================================================
  // DEPENDENCIES
  // ============================================================

  @Get(':id/tasks/:taskId/dependencies')
  @ApiOperation({ summary: 'Get task dependencies' })
  async getTaskDependencies(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectsService.getTaskDependencies(req.user.tenantSchema, taskId);
  }

  @Post(':id/tasks/:taskId/dependencies')
  @ApiOperation({ summary: 'Add task dependency' })
  async addDependency(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') taskId: string,
    @Body() body: { dependsOnTaskId: string; dependencyType?: string },
  ) {
    return this.projectsService.addTaskDependency(
      req.user.tenantSchema, taskId, body.dependsOnTaskId,
      body.dependencyType ?? 'finish_to_start',
    );
  }

  @Delete(':id/tasks/:taskId/dependencies/:depId')
  @ApiOperation({ summary: 'Remove task dependency by row ID' })
  async removeDependency(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') _taskId: string,
    @Param('depId') depId: string,
  ) {
    return this.projectsService.removeTaskDependency(req.user.tenantSchema, depId);
  }

  // ============================================================
  // COMMENTS
  // ============================================================

  @Get(':id/tasks/:taskId/comments')
  @ApiOperation({ summary: 'Get task comments' })
  async getTaskComments(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectsService.getTaskComments(req.user.tenantSchema, taskId);
  }

  @Post(':id/tasks/:taskId/comments')
  @ApiOperation({ summary: 'Add task comment' })
  async addComment(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') taskId: string,
    @Body() body: { content: string; mentions?: string[] },
  ) {
    return this.projectsService.addComment(
      req.user.tenantSchema, taskId, req.user.sub, body.content, body.mentions,
    );
  }

  // ============================================================
  // TIME TRACKING
  // ============================================================

  @Post(':id/tasks/:taskId/time')
  @ApiOperation({ summary: 'Log time on a task' })
  async logTime(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: { minutes: number; description?: string; loggedAt?: string; isBillable?: boolean },
  ) {
    return this.projectsService.logTime(req.user.tenantSchema, id, taskId, req.user.sub, dto);
  }

  @Get(':id/time-report')
  @ApiOperation({ summary: 'Get time report for project' })
  async getTimeReport(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.getTimeReport(req.user.tenantSchema, id);
  }

  // ============================================================
  // ACTIVITIES + OPEN TASKS + APPROVALS
  // ============================================================

  @Get(':id/activities')
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Get project activity timeline' })
  async getActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.getProjectActivities(
      req.user.tenantSchema,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id/task-activities')
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Get task-level activities for a project' })
  async getTaskActivities(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.getProjectTaskActivities(
      req.user.tenantSchema,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/documents')
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Get project documents' })
  async getDocuments(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantSchema, 'projects', id);
  }

  @Get(':id/open-tasks-count')
  @RequirePermission('projects', 'view')
  @ApiOperation({ summary: 'Get count of open tasks in project' })
  async getOpenTasksCount(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.getOpenTasksCount(
      req.user.tenantSchema,
      id,
    );
  }

  @Post(':id/request-approval')
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Request project approval' })
  async requestApproval(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
  ) {
    return this.projectsService.requestProjectApproval(
      req.user.tenantSchema,
      id,
      req.user.sub,
    );
  }

  @Post(':id/tasks/:taskId/request-approval')
  @RequirePermission('projects', 'edit')
  @ApiOperation({ summary: 'Request task completion approval' })
  async requestTaskApproval(
    @Request() req: { user: JwtPayload },
    @Param('id') _id: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projectsService.requestTaskApproval(
      req.user.tenantSchema,
      taskId,
      req.user.sub,
    );
  }

  // ============================================================
  // CLIENT PORTAL
  // ============================================================

  @Post(':id/portal-token')
  @ApiOperation({ summary: 'Generate client portal token' })
  async generatePortalToken(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: { label?: string; email?: string; permissions?: Record<string, boolean>; expiresAt?: string },
  ) {
    return this.projectsService.generatePortalToken(req.user.tenantSchema, id, dto, req.user.sub);
  }
}

// ============================================================
// PUBLIC CLIENT PORTAL (no JWT required)
// ============================================================

@Controller('portal')
@ApiTags('Client Portal')
export class ClientPortalController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':tenantSlug/:token')
  @ApiOperation({ summary: 'Get project view via client portal token' })
  async getPortalView(
    @Param('tenantSlug') tenantSlug: string,
    @Param('token') token: string,
  ) {
    const result = await this.projectsService.getPortalView(tenantSlug, token);
    if (!result) throw new NotFoundException('Portal link is invalid or expired');
    return result;
  }
}
