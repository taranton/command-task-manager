// === Enums ===

export type Role = 'clevel' | 'team_lead' | 'member' | 'trainee';

export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';

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
  status: Status;
  progress: number;
  priority: Priority;
  project_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tasks?: Task[];
  task_count: number;
}

export interface Task {
  id: string;
  story_id: string;
  title: string;
  description?: string;
  status: Status;
  progress: number;
  priority: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  position: string;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  status: Status;
  progress: number;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
  position: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: User;
}

// === Board ===

export interface BoardColumn {
  status: Status;
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
}

export interface UpdateStoryInput {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  project_id?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
}

export interface CreateSubtaskInput {
  title: string;
  description?: string;
  assignee_id?: string;
  start_date?: string;
  deadline?: string;
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

export const STATUS_ORDER: Status[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
];

export const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
