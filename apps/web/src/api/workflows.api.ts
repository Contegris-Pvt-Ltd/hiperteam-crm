import { api } from '../lib/api';

// ============================================================
// TYPES
// ============================================================

export type TriggerModule =
  | 'leads' | 'contacts' | 'accounts'
  | 'opportunities' | 'tasks' | 'projects';

export type TriggerType =
  | 'lead_created' | 'lead_updated' | 'lead_stage_changed'
  | 'lead_score_changed' | 'lead_converted' | 'lead_assigned'
  | 'contact_created' | 'contact_updated' | 'contact_assigned'
  | 'account_created' | 'account_updated' | 'account_assigned'
  | 'opportunity_created' | 'opportunity_updated' | 'opportunity_stage_changed'
  | 'opportunity_won' | 'opportunity_lost' | 'opportunity_assigned'
  | 'task_created' | 'task_updated' | 'task_overdue' | 'task_completed'
  | 'project_created' | 'project_updated' | 'project_status_changed'
  | 'project_task_overdue' | 'project_completed';

export type ActionType =
  | 'assign_owner' | 'create_task' | 'update_field' | 'add_tag'
  | 'send_notification' | 'send_email' | 'webhook'
  | 'wait' | 'branch' | 'create_opportunity' | 'create_project'
  | 'send_whatsapp' | 'send_sms';

export type RunStatus = 'running' | 'completed' | 'failed' | 'skipped';

// ── Condition engine ─────────────────────────────────────────

export interface Condition {
  id: string;
  type: 'condition';
  field: string;
  fieldType: 'system' | 'custom' | 'meta';
  operator: string;
  value: any;
}

export interface ConditionGroup {
  id: string;
  match: 'all' | 'any';
  items: (Condition | ConditionGroup)[];
}

// ── Workflow + actions ───────────────────────────────────────

export interface WorkflowAction {
  id: string;
  workflowId: string;
  actionType: ActionType;
  config: Record<string, any>;
  sortOrder: number;
  parentActionId: string | null;
  branch: 'yes' | 'no' | null;
  // Frontend-only (used during builder, stripped before save)
  tempId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  triggerModule: TriggerModule;
  triggerType: TriggerType;
  triggerFilters: ConditionGroup;
  isActive: boolean;
  version: number;
  actionCount?: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  actions?: WorkflowAction[];
}

// ── Runs ─────────────────────────────────────────────────────

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggerModule: string;
  triggerType: string;
  triggerEntityId: string;
  status: RunStatus;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  steps?: WorkflowRunStep[];
}

export interface WorkflowRunStep {
  id: string;
  runId: string;
  actionId: string;
  actionType: ActionType;
  status: RunStatus | 'pending';
  result: Record<string, any> | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WorkflowRunsResponse {
  data: WorkflowRun[];
  total: number;
  page: number;
  limit: number;
}

// ── Create / Update DTOs ─────────────────────────────────────

export interface CreateWorkflowData {
  name: string;
  description?: string;
  triggerModule: TriggerModule;
  triggerType: TriggerType;
  triggerFilters?: ConditionGroup;
  isActive?: boolean;
  actions?: Omit<WorkflowAction, 'id' | 'workflowId'>[];
}

export type UpdateWorkflowData = Partial<CreateWorkflowData>;

// ============================================================
// TRIGGER + ACTION METADATA (used by builder UI)
// ============================================================

export const TRIGGER_MODULES: { value: TriggerModule; label: string; icon: string }[] = [
  { value: 'leads',         label: 'Leads',         icon: 'UserPlus' },
  { value: 'contacts',      label: 'Contacts',      icon: 'Users' },
  { value: 'accounts',      label: 'Accounts',      icon: 'Building2' },
  { value: 'opportunities', label: 'Opportunities', icon: 'TrendingUp' },
  { value: 'tasks',         label: 'Tasks',         icon: 'CheckSquare' },
  { value: 'projects',      label: 'Projects',      icon: 'FolderKanban' },
];

export const TRIGGER_TYPES_BY_MODULE: Record<TriggerModule, { value: TriggerType; label: string }[]> = {
  leads: [
    { value: 'lead_created',       label: 'Lead Created' },
    { value: 'lead_updated',       label: 'Lead Updated' },
    { value: 'lead_stage_changed', label: 'Stage Changed' },
    { value: 'lead_score_changed', label: 'Score Changed' },
    { value: 'lead_converted',     label: 'Lead Converted' },
    { value: 'lead_assigned',      label: 'Lead Assigned' },
  ],
  contacts: [
    { value: 'contact_created',  label: 'Contact Created' },
    { value: 'contact_updated',  label: 'Contact Updated' },
    { value: 'contact_assigned', label: 'Contact Assigned' },
  ],
  accounts: [
    { value: 'account_created',  label: 'Account Created' },
    { value: 'account_updated',  label: 'Account Updated' },
    { value: 'account_assigned', label: 'Account Assigned' },
  ],
  opportunities: [
    { value: 'opportunity_created',       label: 'Opportunity Created' },
    { value: 'opportunity_updated',       label: 'Opportunity Updated' },
    { value: 'opportunity_stage_changed', label: 'Stage Changed' },
    { value: 'opportunity_won',           label: 'Opportunity Won' },
    { value: 'opportunity_lost',          label: 'Opportunity Lost' },
    { value: 'opportunity_assigned',      label: 'Opportunity Assigned' },
  ],
  tasks: [
    { value: 'task_created',   label: 'Task Created' },
    { value: 'task_updated',   label: 'Task Updated' },
    { value: 'task_overdue',   label: 'Task Overdue' },
    { value: 'task_completed', label: 'Task Completed' },
  ],
  projects: [
    { value: 'project_created',        label: 'Project Created' },
    { value: 'project_updated',        label: 'Project Updated' },
    { value: 'project_status_changed', label: 'Status Changed' },
    { value: 'project_task_overdue',   label: 'Task Overdue' },
    { value: 'project_completed',      label: 'Project Completed' },
  ],
};

export const ACTION_TYPES: { value: ActionType; label: string; description: string; color: string }[] = [
  { value: 'assign_owner',       label: 'Assign Owner',        description: 'Auto-assign to a user',       color: 'blue' },
  { value: 'create_task',        label: 'Create Task',         description: 'Create a follow-up task',     color: 'green' },
  { value: 'update_field',       label: 'Update Field',        description: 'Set a field value',           color: 'purple' },
  { value: 'add_tag',            label: 'Add Tag',             description: 'Add a tag to the record',     color: 'yellow' },
  { value: 'send_notification',  label: 'Send Notification',   description: 'Notify a team member',        color: 'orange' },
  { value: 'webhook',            label: 'Webhook',             description: 'Call an external URL',        color: 'slate' },
  { value: 'wait',               label: 'Wait',                description: 'Pause before next action',    color: 'slate' },
  { value: 'branch',             label: 'Branch (If/Else)',    description: 'Split based on condition',    color: 'pink' },
  { value: 'create_opportunity', label: 'Create Opportunity',  description: 'Auto-create opportunity',     color: 'teal' },
  { value: 'create_project',     label: 'Create Project',      description: 'Auto-create project',         color: 'indigo' },
  { value: 'send_whatsapp',    label: 'Send WhatsApp',       description: 'Send a WhatsApp message via Twilio', color: 'emerald' },
  { value: 'send_sms',         label: 'Send SMS',            description: 'Send an SMS message via Twilio',     color: 'cyan' },
];

export const CONDITION_OPERATORS = [
  { value: 'equals',          label: 'equals',            types: ['text','select','number','boolean'] },
  { value: 'not_equals',      label: 'does not equal',    types: ['text','select','number','boolean'] },
  { value: 'contains',        label: 'contains',          types: ['text'] },
  { value: 'not_contains',    label: 'does not contain',  types: ['text'] },
  { value: 'starts_with',     label: 'starts with',       types: ['text'] },
  { value: 'is_empty',        label: 'is empty',          types: ['text','select','number'] },
  { value: 'is_not_empty',    label: 'is not empty',      types: ['text','select','number'] },
  { value: 'greater_than',    label: 'greater than',      types: ['number'] },
  { value: 'less_than',       label: 'less than',         types: ['number'] },
  { value: 'greater_or_equal',label: '≥',                 types: ['number'] },
  { value: 'less_or_equal',   label: '≤',                 types: ['number'] },
  { value: 'in',              label: 'is one of',         types: ['select','text'] },
  { value: 'not_in',          label: 'is not one of',     types: ['select','text'] },
  { value: 'changed_to',      label: 'changed to',        types: ['text','select'] },
  { value: 'changed_from',    label: 'changed from',      types: ['text','select'] },
  { value: 'any_change',      label: 'any change',        types: ['text','select','number'] },
];

// ============================================================
// API CALLS
// ============================================================

export const workflowsApi = {
  // ── Workflows ─────────────────────────────────────────────
  list: async (module?: TriggerModule): Promise<Workflow[]> => {
    const params = module ? `?module=${module}` : '';
    const { data } = await api.get(`/workflows${params}`);
    return data;
  },

  getOne: async (id: string): Promise<Workflow> => {
    const { data } = await api.get(`/workflows/${id}`);
    return data;
  },

  create: async (payload: CreateWorkflowData): Promise<Workflow> => {
    const { data } = await api.post('/workflows', payload);
    return data;
  },

  update: async (id: string, payload: UpdateWorkflowData): Promise<Workflow> => {
    const { data } = await api.put(`/workflows/${id}`, payload);
    return data;
  },

  toggle: async (id: string, isActive: boolean): Promise<Workflow> => {
    const { data } = await api.patch(`/workflows/${id}/toggle`, { isActive });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workflows/${id}`);
  },

  // ── Runs ──────────────────────────────────────────────────
  getRuns: async (workflowId: string, page = 1, limit = 25): Promise<WorkflowRunsResponse> => {
    const { data } = await api.get(`/workflows/${workflowId}/runs?page=${page}&limit=${limit}`);
    return data;
  },

  getRunDetail: async (runId: string): Promise<WorkflowRun> => {
    const { data } = await api.get(`/workflows/runs/${runId}`);
    return data;
  },
};
