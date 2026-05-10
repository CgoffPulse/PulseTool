// Pulse Command — domain types.
// Mirrors the planned `command.*` schema (migrations 0011/0012/0013/0014).
// Snake_case field names match the DB so rows pass through with minimal mapping.

export type WorkKind = 'client_campaign' | 'internal_build' | 'onboarding' | 'service_engagement';
export type WorkState = 'idea' | 'active' | 'paused' | 'shipped' | 'archived';
export type TaskStatus =
  | 'backlog'
  | 'next'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'cancelled';
export type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type TaskOrigin = 'manual' | 'signal' | 'recap' | 'cascade';
export type ApprovalArtifactKind =
  | 'post'
  | 'brief'
  | 'recap'
  | 'shoot_brief'
  | 'project_close'
  | 'month_plan';
export type ApprovalState = 'pending' | 'approved' | 'changes_requested' | 'expired';
export type ApproverKind = 'christian' | 'client';
export type ApprovalDecision = 'approved' | 'changes_requested';
export type ClientTier = 'premium' | 'mid' | 'productized';

export const WORK_KINDS: WorkKind[] = [
  'client_campaign',
  'internal_build',
  'onboarding',
  'service_engagement',
];

export const WORK_STATES: WorkState[] = [
  'idea',
  'active',
  'paused',
  'shipped',
  'archived',
];

export const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'next',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
];

export const TASK_PRIORITIES: TaskPriority[] = ['p0', 'p1', 'p2', 'p3'];

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  client_campaign: 'Client Campaign',
  internal_build: 'Internal Build',
  onboarding: 'Onboarding',
  service_engagement: 'Service Engagement',
};

export const WORK_STATE_LABEL: Record<WorkState, string> = {
  idea: 'Idea',
  active: 'Active',
  paused: 'Paused',
  shipped: 'Shipped',
  archived: 'Archived',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  next: 'Up Next',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

export const CLIENT_TIER_LABEL: Record<ClientTier, string> = {
  premium: 'Premium',
  mid: 'Mid-market',
  productized: 'Productized',
};

// ─── Core entities ─────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  slug: string;
  state: WorkState;
  kind: WorkKind;
  summary: string | null;
  current_focus: string | null;
  owner: string | null;
  client_id: string | null;
  client_slug: string | null;
  client_name?: string | null;
  service_line: string | null;
  department_id: string | null;
  department_key?: string | null;
  department_name?: string | null;
  assigned_person_id: string | null;
  assigned_person_name?: string | null;
  priority: TaskPriority | null;
  target_ship_date: string | null;
  github_repo: string | null;
  local_path: string | null;
  vercel_project_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  project_name?: string | null;
  project_slug?: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  done_at: string | null;
  sort_index: number;
  assigned_person_id: string | null;
  assigned_person_name?: string | null;
  client_id: string | null;
  client_slug: string | null;
  client_name?: string | null;
  origin: TaskOrigin;
  signal_key: string | null;
  artifact_url: string | null;
  artifact_kind: string | null;
  artifact_id: string | null;
  auto_close_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lead_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  color: string;
  department_id?: string | null;
  department_key?: string | null;
  department_name?: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  tier: ClientTier | null;
  service_lines: string[] | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalReceived {
  approver: ApproverKind;
  status: ApprovalDecision;
  at: string;
  note?: string | null;
  by_person_id?: string | null;
}

export interface Approval {
  id: string;
  artifact_kind: ApprovalArtifactKind | string;
  artifact_id: string | null;
  artifact_slug: string | null;
  artifact_title: string | null;
  artifact_url: string | null;
  client_id: string | null;
  client_slug: string | null;
  client_name?: string | null;
  required_approvers: ApproverKind[];
  received: ApprovalReceived[];
  state: ApprovalState;
  requested_at: string;
  decided_at: string | null;
  notes: string | null;
}

// ─── Joined / synthetic shapes ─────────────────────────────────────────────

export interface ProjectSummary extends Project {
  open_task_count: number;
  in_progress_task_count: number;
}

export interface TaskWithContext {
  task: Task;
  project: Pick<Project, 'id' | 'name' | 'slug' | 'kind'> | null;
  client: Pick<Client, 'id' | 'name' | 'slug' | 'color'> | null;
  assignee: Pick<Person, 'id' | 'name' | 'color'> | null;
}

export interface CalendarEvent {
  id: string;
  source: 'shoot' | 'post' | 'project_ship' | 'holiday';
  date: string; // YYYY-MM-DD
  time: string | null;
  title: string;
  client_id: string | null;
  client_slug: string | null;
  client_name: string | null;
  client_color: string | null;
  detail: string | null;
  href: string | null;
}

export interface PersonPlate {
  person: Person;
  open_task_count: number;
  in_progress_count: number;
  blocked_count: number;
  shoots_next_14d: number;
  active_project_count: number;
  top_tasks: Task[];
  shoots_today: Array<{
    id: string;
    client_id: string | null;
    client_name: string | null;
    location: string | null;
    scheduled_time: string | null;
  }>;
}

export interface AgencyObjective {
  project: Project;
  open_task_count: number;
  days_until_ship: number | null;
}

export interface ApprovalQueueItem extends Approval {
  waiting_hours: number;
}
