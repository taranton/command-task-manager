// === Enums ===

export type Role = 'clevel' | 'team_lead' | 'member' | 'trainee';

// Entity-specific statuses
export type StoryStatus = 'backlog' | 'active' | 'done' | 'closed';
export type TaskStatus = 'backlog' | 'to_do' | 'in_progress' | 'in_review' | 'done';
export type SubtaskStatus = 'to_do' | 'in_progress' | 'done';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

// === Entities ===

export interface User {
  id: string;
  external_id?: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  team_id?: string;
  is_active: boolean;
  approved?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  external_id?: string;
  name: string;
  description?: string;
  office?: string;
  lead_id?: string;
  lead?: User;
  member_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  title: string;
  description?: string;
  status: StoryStatus;
  progress: number;
  priority: Priority;
  project_id?: string;
  tags: string[];
  assigned_lead?: string;
  team_id?: string;
  start_date?: string;
  deadline?: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  tasks?: Task[];
  task_count: number;
}

export interface Task {
  id: string;
  story_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  progress: number;
  priority: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  estimated_hours?: number;
  sort_order: number;
  team_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  assignee?: User;
  subtasks?: Subtask[];
  subtask_count: number;
  subtask_done: number;
  story_title?: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  progress: number;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: User;
}

// === Board ===

export interface BoardColumn {
  status: TaskStatus;
  tasks: Task[];
  count: number;
}

export interface Board {
  columns: BoardColumn[];
}

// === Inputs ===

export interface CreateStoryInput {
  title: string;
  description?: string;
  priority: Priority;
  project_id?: string;
  tags?: string[];
  assigned_lead?: string;
  start_date?: string;
  deadline?: string;
}

export interface UpdateStoryInput {
  title?: string;
  description?: string;
  status?: StoryStatus;
  priority?: Priority;
  project_id?: string;
  tags?: string[];
  assigned_lead?: string;
  start_date?: string;
  deadline?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  estimated_hours?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  estimated_hours?: number;
}

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
}

// === Comments ===

export type EntityType = 'story' | 'task' | 'subtask';

export interface Comment {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  author_id: string;
  body: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
}

// === Auth ===

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

// === WebSocket ===

export type WSEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.moved'
  | 'subtask.created'
  | 'subtask.updated'
  | 'subtask.deleted'
  | 'story.updated';

export interface WSMessage {
  type: WSEventType;
  payload: Record<string, unknown>;
}

// === API ===

export interface APIError {
  error: string;
  message: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// === Filters ===

export interface BoardFilter {
  story_id?: string;
  assignee_id?: string;
  team_id?: string;
  priority?: Priority;
  search?: string;
}

// === Constants ===

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'backlog',
  'to_do',
  'in_progress',
  'in_review',
  'done',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  to_do: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const STORY_STATUS_LABELS: Record<StoryStatus, string> = {
  backlog: 'Backlog',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
};

export const SUBTASK_STATUS_LABELS: Record<SubtaskStatus, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Legacy aliases for backward compat during migration
export type Status = TaskStatus;
export const STATUS_ORDER = TASK_STATUS_ORDER;
export const STATUS_LABELS = TASK_STATUS_LABELS;
