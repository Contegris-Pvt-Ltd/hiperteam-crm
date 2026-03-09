// ============================================================
// FILE: apps/web/src/api/projects.api.ts
// ============================================================
import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface ProjectStatus {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  isDefault: boolean;
  isClosed: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface ProjectTaskStatus {
  id: string;
  name: string;
  slug: string;
  color: string;
  isDefault: boolean;
  isDone: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  estimatedDays: number | null;
  isActive: boolean;
  isSystem: boolean;
  phaseCount?: number;
  phases?: ProjectTemplatePhase[];
}

export interface ProjectTemplatePhase {
  id: string;
  templateId: string;
  name: string;
  color: string;
  sortOrder: number;
  estimatedDays: number | null;
  tasks: ProjectTemplateTask[];
}

export interface ProjectTemplateTask {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  assigneeRole: string | null;
  dueDaysFromStart: number | null;
  estimatedHours: number | null;
  priority: string;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  statusIcon: string | null;
  color: string;
  opportunityId: string | null;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  templateId: string | null;
  healthScore: number;
  healthStatus: string;
  startDate: string | null;
  endDate: string | null;
  actualEndDate: string | null;
  budget: number | null;
  actualCost: number;
  currency: string;
  ownerId: string | null;
  ownerName: string | null;
  teamId: string | null;
  tags: string[];
  clientPortalEnabled: boolean;
  taskCount?: number;
  completedTaskCount?: number;
  memberCount?: number;
  phases?: ProjectPhase[];
  unassignedTasks?: ProjectTask[];
  members?: ProjectMember[];
  milestones?: ProjectMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  isComplete: boolean;
  completedAt: string | null;
  tasks: ProjectTask[];
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: string;
  dependsOnTitle: string;
  isDone: boolean;
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  phaseId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  isDone: boolean;
  priority: string;
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  loggedHours: number;
  sortOrder: number;
  tags: string[];
  subtasks?: ProjectTask[];
  dependencies?: TaskDependency[];
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  isClientContact: boolean;
  createdAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isComplete: boolean;
  completedAt: string | null;
  linkedTaskIds: string[];
  createdAt: string;
}

export interface ProjectTaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  mentions: string[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  userId: string;
  description: string | null;
  minutes: number;
  loggedAt: string;
  isBillable: boolean;
  createdAt: string;
}

export interface TimeReport {
  userId: string;
  userName: string;
  totalMinutes: number;
  billableMinutes: number;
  entryCount: number;
}

export interface KanbanColumn {
  status: ProjectTaskStatus;
  tasks: ProjectTask[];
}

export interface GanttData {
  tasks: ProjectTask[];
  dependencies: Array<{
    id: string;
    taskId: string;
    dependsOnTaskId: string;
    dependencyType: string;
  }>;
  milestones: ProjectMilestone[];
}

export interface PortalToken {
  token: string;
  projectId: string;
  label: string | null;
  email: string | null;
  permissions: {
    view_tasks: boolean;
    view_files: boolean;
    view_timeline: boolean;
    add_comments: boolean;
  };
  expiresAt: string | null;
}

export interface ProjectActivity {
  id: string;
  entityType: string;
  entityId: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  relatedType: string | null;
  relatedId: string | null;
  performedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface ActivityTimeline {
  data: ProjectActivity[];
  total: number;
}

export interface OpenTasksCount {
  count: number;
  tasks: { id: string; title: string }[];
}

export interface ListProjectsParams {
  statusId?: string;
  ownerId?: string;
  accountId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedProjects {
  data: Project[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// PROJECTS API
// ============================================================

export const projectsApi = {
  // ── Reference data ──────────────────────────────────────────

  getStatuses: async (): Promise<ProjectStatus[]> => {
    const { data } = await api.get('/projects/statuses');
    return data;
  },

  getTaskStatuses: async (): Promise<ProjectTaskStatus[]> => {
    const { data } = await api.get('/projects/task-statuses');
    return data;
  },

  getTemplates: async (includeInactive = false): Promise<ProjectTemplate[]> => {
    const { data } = await api.get('/projects/templates', {
      params: includeInactive ? { includeInactive: 'true' } : undefined,
    });
    return data;
  },

  getTemplateById: async (templateId: string): Promise<ProjectTemplate> => {
    const { data } = await api.get(`/projects/templates/${templateId}`);
    return data;
  },

  // ── Projects CRUD ───────────────────────────────────────────

  list: async (params?: ListProjectsParams): Promise<PaginatedProjects> => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    const { data } = await api.get(`/projects?${query.toString()}`);
    return data;
  },

  getById: async (id: string): Promise<Project> => {
    const { data } = await api.get(`/projects/${id}`);
    return data;
  },

  create: async (dto: Partial<Project> & { name: string }): Promise<Project> => {
    const { data } = await api.post('/projects', dto);
    return data;
  },

  createFromOpportunity: async (dto: {
    opportunityId: string;
    templateId?: string;
  }): Promise<Project> => {
    const { data } = await api.post('/projects/from-opportunity', dto);
    return data;
  },

  update: async (id: string, dto: Partial<Project>): Promise<Project> => {
    const { data } = await api.put(`/projects/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/projects/${id}`);
    return data;
  },

  // ── Views ───────────────────────────────────────────────────

  getKanban: async (id: string): Promise<KanbanColumn[]> => {
    const { data } = await api.get(`/projects/${id}/kanban`);
    return data;
  },

  getGantt: async (id: string): Promise<GanttData> => {
    const { data } = await api.get(`/projects/${id}/gantt`);
    return data;
  },

  // ── Members ─────────────────────────────────────────────────

  getMembers: async (id: string): Promise<ProjectMember[]> => {
    const { data } = await api.get(`/projects/${id}/members`);
    return data;
  },

  addMember: async (id: string, dto: {
    userId: string;
    role?: string;
  }): Promise<ProjectMember> => {
    const { data } = await api.post(`/projects/${id}/members`, dto);
    return data;
  },

  removeMember: async (id: string, memberId: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/projects/${id}/members/${memberId}`);
    return data;
  },

  // ── Tasks ───────────────────────────────────────────────────

  createTask: async (id: string, dto: Partial<ProjectTask> & {
    title: string;
  }): Promise<ProjectTask> => {
    const { data } = await api.post(`/projects/${id}/tasks`, dto);
    return data;
  },

  updateTask: async (id: string, taskId: string, dto: Partial<ProjectTask>): Promise<ProjectTask> => {
    const { data } = await api.put(`/projects/${id}/tasks/${taskId}`, dto);
    return data;
  },

  deleteTask: async (id: string, taskId: string): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/projects/${id}/tasks/${taskId}`);
    return data;
  },

  // ── Dependencies ────────────────────────────────────────────

  getTaskDependencies: async (id: string, taskId: string): Promise<TaskDependency[]> => {
    const { data } = await api.get(`/projects/${id}/tasks/${taskId}/dependencies`);
    return data;
  },

  addDependency: async (id: string, taskId: string, dto: {
    dependsOnTaskId: string;
    dependencyType?: string;
  }): Promise<TaskDependency> => {
    const { data } = await api.post(`/projects/${id}/tasks/${taskId}/dependencies`, dto);
    return data;
  },

  removeDependency: async (
    id: string,
    taskId: string,
    depId: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.delete(`/projects/${id}/tasks/${taskId}/dependencies/${depId}`);
    return data;
  },

  // ── Comments ────────────────────────────────────────────────

  getComments: async (id: string, taskId: string): Promise<ProjectTaskComment[]> => {
    const { data } = await api.get(`/projects/${id}/tasks/${taskId}/comments`);
    return data;
  },

  addComment: async (id: string, taskId: string, dto: {
    content: string;
    mentions?: string[];
  }): Promise<ProjectTaskComment> => {
    const { data } = await api.post(`/projects/${id}/tasks/${taskId}/comments`, dto);
    return data;
  },

  // ── Time tracking ──────────────────────────────────────────

  logTime: async (id: string, taskId: string, dto: {
    minutes: number;
    description?: string;
    loggedAt?: string;
    isBillable?: boolean;
  }): Promise<ProjectTimeEntry> => {
    const { data } = await api.post(`/projects/${id}/tasks/${taskId}/time`, dto);
    return data;
  },

  getTimeReport: async (id: string): Promise<TimeReport[]> => {
    const { data } = await api.get(`/projects/${id}/time-report`);
    return data;
  },

  // ── Portal ──────────────────────────────────────────────────

  generatePortalToken: async (id: string, dto: {
    label?: string;
    email?: string;
    permissions?: Partial<PortalToken['permissions']>;
    expiresAt?: string;
  }): Promise<PortalToken> => {
    const { data } = await api.post(`/projects/${id}/portal-token`, dto);
    return data;
  },

  getPortalView: async (tenantSlug: string, token: string): Promise<{
    project: Project;
    permissions: PortalToken['permissions'];
  }> => {
    const { data } = await api.get(`/portal/${tenantSlug}/${token}`);
    return data;
  },

  // ── Activities ──────────────────────────────────────────────

  getActivities: async (
    id: string,
    page = 1,
    limit = 20,
  ): Promise<ActivityTimeline> => {
    const { data } = await api.get(
      `/projects/${id}/activities?page=${page}&limit=${limit}`,
    );
    return data;
  },

  getTaskActivities: async (
    id: string,
    page = 1,
    limit = 50,
  ): Promise<ActivityTimeline> => {
    const { data } = await api.get(
      `/projects/${id}/task-activities?page=${page}&limit=${limit}`,
    );
    return data;
  },

  // ── Documents ──────────────────────────────────────────────

  getDocuments: async (id: string): Promise<any[]> => {
    const { data } = await api.get(`/projects/${id}/documents`);
    return data;
  },

  // ── Close guard ─────────────────────────────────────────────

  getOpenTasksCount: async (id: string): Promise<OpenTasksCount> => {
    const { data } = await api.get(`/projects/${id}/open-tasks-count`);
    return data;
  },

  // ── Approvals ───────────────────────────────────────────────

  requestApproval: async (id: string): Promise<any> => {
    const { data } = await api.post(`/projects/${id}/request-approval`);
    return data;
  },

  requestTaskApproval: async (
    id: string,
    taskId: string,
  ): Promise<any> => {
    const { data } = await api.post(
      `/projects/${id}/tasks/${taskId}/request-approval`,
    );
    return data;
  },

  // ── Admin: Project Statuses ──────────────────────────────────
  createProjectStatus: async (dto: {
    name: string; color?: string; isClosed?: boolean;
  }) => {
    const { data } = await api.post('/projects/admin/project-statuses', dto);
    return data;
  },

  updateProjectStatus: async (id: string, dto: {
    name?: string; color?: string; isClosed?: boolean;
    isActive?: boolean;
  }) => {
    const { data } = await api.patch(`/projects/admin/project-statuses/${id}`, dto);
    return data;
  },

  deleteProjectStatus: async (id: string) => {
    await api.delete(`/projects/admin/project-statuses/${id}`);
  },

  // ── Admin: Task Statuses ────────────────────────────────────
  createProjectTaskStatus: async (dto: {
    name: string; color?: string; isDone?: boolean;
  }) => {
    const { data } = await api.post('/projects/admin/task-statuses', dto);
    return data;
  },

  updateProjectTaskStatus: async (id: string, dto: {
    name?: string; color?: string; isDone?: boolean; isActive?: boolean;
  }) => {
    const { data } = await api.patch(`/projects/admin/task-statuses/${id}`, dto);
    return data;
  },

  deleteProjectTaskStatus: async (id: string) => {
    await api.delete(`/projects/admin/task-statuses/${id}`);
  },

  // ── Admin: Templates ────────────────────────────────────────
  createTemplate: async (dto: {
    name: string; description?: string; color?: string;
  }) => {
    const { data } = await api.post('/projects/admin/templates', dto);
    return data;
  },

  updateTemplate: async (id: string, dto: {
    name?: string; description?: string; color?: string; isActive?: boolean;
  }) => {
    const { data } = await api.patch(`/projects/admin/templates/${id}`, dto);
    return data;
  },

  deleteTemplate: async (id: string) => {
    await api.delete(`/projects/admin/templates/${id}`);
  },

  saveTemplateStructure: async (id: string, dto: {
    name?: string;
    description?: string;
    color?: string;
    estimatedDays?: number;
    approvalConfig?: any;
    phases: Array<{
      id?: string;
      name: string;
      color?: string;
      estimatedDays?: number;
      sortOrder: number;
      tasks: Array<{
        id?: string;
        title: string;
        description?: string;
        priority?: string;
        assigneeRole?: string;
        dueDaysFromStart?: number;
        estimatedHours?: number;
        sortOrder: number;
        subtasks?: Array<{
          id?: string;
          title: string;
          description?: string;
          priority?: string;
          assigneeRole?: string;
          dueDaysFromStart?: number;
          estimatedHours?: number;
          sortOrder: number;
        }>;
      }>;
    }>;
  }): Promise<ProjectTemplate> => {
    const { data } = await api.put(`/projects/admin/templates/${id}/structure`, dto);
    return data;
  },
};
