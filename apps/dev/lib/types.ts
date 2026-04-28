// Domain types — mirror the schema in packages/db/migrations/0004_dev_dev_hub_init.sql.
// Snake_case field names match the DB so rows pass through with minimal mapping.

export type ProjectState = 'idea' | 'active' | 'paused' | 'shipped' | 'archived';
export type TaskStatus =
  | 'backlog'
  | 'next'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'cancelled';
export type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3';

export const PROJECT_STATES: ProjectState[] = [
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

export const PROJECT_STATE_LABEL: Record<ProjectState, string> = {
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

export interface Project {
  id: string;
  name: string;
  slug: string;
  state: ProjectState;
  summary: string | null;
  current_focus: string | null;
  owner: string | null;
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
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  done_at: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
}

export interface RepoActivity {
  id: string;
  project_id: string;
  observed_at: string;
  default_branch: string | null;
  last_commit_sha: string | null;
  last_commit_at: string | null;
  last_commit_message: string | null;
  open_pr_count: number | null;
  open_issue_count: number | null;
  ahead: number | null;
  behind: number | null;
}

export interface FsSnapshot {
  id: string;
  project_id: string;
  observed_at: string;
  current_branch: string | null;
  is_dirty: boolean | null;
  last_modified_at: string | null;
  uncommitted_files: number | null;
}

export interface Deployment {
  id: string;
  project_id: string;
  observed_at: string;
  provider: string;
  state: string | null;
  url: string | null;
  commit_sha: string | null;
  deployed_at: string | null;
}

export interface ProjectWithLatest {
  project: Project;
  latest_repo: RepoActivity | null;
  latest_fs: FsSnapshot | null;
  latest_deployment: Deployment | null;
  open_task_count: number;
  in_progress_task_count: number;
}

/** Tasks worth surfacing on the Today view, with their project. */
export interface TodayTask {
  task: Task;
  project: Project | null;
}

/** Top-line counts for the dashboard hero. */
export interface HubStats {
  active_projects: number;
  idea_projects: number;
  paused_projects: number;
  shipped_projects: number;
  archived_projects: number;
  open_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  done_tasks: number;
  dirty_repos: number;
  failing_deploys: number;
  live_deploys: number;
  stale_repos: number;
}

/** Joined commit row for the activity feed. */
export interface CommitFeedRow {
  project_id: string;
  project_name: string;
  project_slug: string;
  github_repo: string | null;
  sha: string | null;
  message: string | null;
  committed_at: string | null;
}

/** Joined deployment row for the activity feed. */
export interface DeployFeedRow {
  project_id: string;
  project_name: string;
  project_slug: string;
  state: string | null;
  url: string | null;
  commit_sha: string | null;
  deployed_at: string | null;
  observed_at: string;
}
