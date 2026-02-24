// ============================================================
// FILE: apps/web/src/api/tasks.api.ts
// ============================================================

import { api } from './contacts.api';

// ============================================================
// TYPES
// ============================================================

export interface TaskType {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
  defaultDurationMinutes: number | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface TaskStatus {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  isOpen: boolean;
  isCompleted: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  taskCount?: number;
}

export interface TaskPriority {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  level: number;
  isDefault: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface TaskAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  taskTypeId: string | null;
  taskType: TaskType | null;
  statusId: string | null;
  status: TaskStatus | null;
  priorityId: string | null;
  priority: TaskPriority | null;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  reminderAt: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  ownerId: string | null;
  owner: TaskAssignee | null;
  assignedTo: string | null;
  assignee: TaskAssignee | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  parentTaskId: string | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  recurrenceParentId: string | null;
  recurrenceIndex: number | null;
  tags: string[];
  customFields: Record<string, any>;
  result: string | null;
  subtaskCount: number;
  completedSubtaskCount: number;
  subtasks?: Task[];
  createdBy: string;
  createdByUser: TaskAssignee | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval?: number;
  daysOfWeek?: number[];
  endType: 'never' | 'after' | 'on';
  endAfterCount?: number;
  endDate?: string;
}

export interface CreateTaskData {
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
  recurrenceRule?: RecurrenceRule;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  result?: string;
  actualMinutes?: number;
}

export interface TasksQuery {
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
  isCompleted?: string;
  isOverdue?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  tags?: string;
  view?: 'list' | 'kanban';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface KanbanStatusData {
  id: string;
  name: string;
  slug: string;
  color: string;
  isOpen: boolean;
  isCompleted: boolean;
  sortOrder: number;
  count: number;
  tasks: Task[];
}

// ============================================================
// TASKS API
// ============================================================

export const tasksApi = {
  // ── Core CRUD ──
  list: async (query: TasksQuery = {}): Promise<{ data: Task[]; meta: any } | KanbanStatusData[]> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) params.append(k, String(v));
    });
    const { data } = await api.get(`/tasks?${params.toString()}`);
    return data;
  },

  get: async (id: string): Promise<Task> => {
    const { data } = await api.get(`/tasks/${id}`);
    return data;
  },

  create: async (dto: CreateTaskData): Promise<Task> => {
    const { data } = await api.post('/tasks', dto);
    return data;
  },

  update: async (id: string, dto: UpdateTaskData): Promise<Task> => {
    const { data } = await api.put(`/tasks/${id}`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  // ── Quick actions ──
  complete: async (id: string, result?: string): Promise<Task> => {
    const { data } = await api.patch(`/tasks/${id}/complete`, { result });
    return data;
  },

  reopen: async (id: string): Promise<Task> => {
    const { data } = await api.patch(`/tasks/${id}/reopen`);
    return data;
  },

  // ── Subtasks ──
  getSubtasks: async (id: string): Promise<{ data: Task[] }> => {
    const { data } = await api.get(`/tasks/${id}/subtasks`);
    return data;
  },

  createSubtask: async (parentId: string, dto: CreateTaskData): Promise<Task> => {
    const { data } = await api.post(`/tasks/${parentId}/subtasks`, dto);
    return data;
  },

  // ── Entity tasks (for detail pages) ──
  getByEntity: async (entityType: string, entityId: string): Promise<Task[]> => {
    const { data } = await api.get(`/tasks/entity/${entityType}/${entityId}`);
    return data;
  },

  // ── Dashboard ──
  getUpcoming: async (days?: number, limit?: number): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (days) params.append('days', String(days));
    if (limit) params.append('limit', String(limit));
    const { data } = await api.get(`/tasks/dashboard/upcoming?${params.toString()}`);
    return data;
  },

  getDashboardCounts: async (): Promise<{ dueToday: number; overdue: number }> => {
    const { data } = await api.get('/tasks/dashboard/counts');
    return data;
  },

  // ── Notes ──
  getNotes: async (id: string) => {
    const { data } = await api.get(`/tasks/${id}/notes`);
    return data;
  },

  addNote: async (id: string, content: string) => {
    const { data } = await api.post(`/tasks/${id}/notes`, { content });
    return data;
  },

  // ── Activities / History ──
  getActivities: async (id: string) => {
    const { data } = await api.get(`/tasks/${id}/activities`);
    return data;
  },

  getHistory: async (id: string) => {
    const { data } = await api.get(`/tasks/${id}/history`);
    return data;
  },
};

// ============================================================
// TASK SETTINGS API
// ============================================================

export const taskSettingsApi = {
  // ── Types ──
  getTypes: async (): Promise<TaskType[]> => {
    const { data } = await api.get('/tasks/types');
    return data;
  },

  createType: async (body: { name: string; icon?: string; color?: string; description?: string; defaultDurationMinutes?: number }): Promise<TaskType> => {
    const { data } = await api.post('/tasks/types', body);
    return data;
  },

  updateType: async (id: string, body: any): Promise<TaskType[]> => {
    const { data } = await api.put(`/tasks/types/${id}`, body);
    return data;
  },

  deleteType: async (id: string): Promise<void> => {
    await api.delete(`/tasks/types/${id}`);
  },

  // ── Statuses ──
  getStatuses: async (): Promise<TaskStatus[]> => {
    const { data } = await api.get('/tasks/statuses');
    return data;
  },

  // ── Priorities ──
  getPriorities: async (): Promise<TaskPriority[]> => {
    const { data } = await api.get('/tasks/priorities');
    return data;
  },

  // ── Status CRUD ──
  createStatus: async (body: { name: string; color?: string; icon?: string; isOpen?: boolean; isCompleted?: boolean }) => {
    const { data } = await api.post('/tasks/statuses', body);
    return data;
  },

  updateStatus: async (id: string, body: any) => {
    const { data } = await api.put(`/tasks/statuses/${id}`, body);
    return data;
  },

  deleteStatus: async (id: string): Promise<void> => {
    await api.delete(`/tasks/statuses/${id}`);
  },

  reorderStatuses: async (statusIds: string[]) => {
    const { data } = await api.put('/tasks/statuses/reorder', { statusIds });
    return data;
  },

  // ── Priority CRUD ──
  createPriority: async (body: { name: string; color?: string; icon?: string; level?: number }) => {
    const { data } = await api.post('/tasks/priorities', body);
    return data;
  },

  updatePriority: async (id: string, body: any) => {
    const { data } = await api.put(`/tasks/priorities/${id}`, body);
    return data;
  },

  deletePriority: async (id: string): Promise<void> => {
    await api.delete(`/tasks/priorities/${id}`);
  },

  reorderPriorities: async (priorityIds: string[]) => {
    const { data } = await api.put('/tasks/priorities/reorder', { priorityIds });
    return data;
  },
  
  // ── Settings ──
  getSettings: async (): Promise<Record<string, any>> => {
    const { data } = await api.get('/tasks/settings');
    return data;
  },

  updateSetting: async (key: string, value: any): Promise<Record<string, any>> => {
    const { data } = await api.put(`/tasks/settings/${key}`, value);
    return data;
  },
};