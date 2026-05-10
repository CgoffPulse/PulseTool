/**
 * Engineering monitor types — read from the `dev.*` schema (repo_activity,
 * deployments, fs_snapshots). These are append-only observation logs keyed by
 * project_id. The project UUIDs match `command.projects.id` (Wave 0 backfill),
 * so command-side queries can join them seamlessly.
 *
 * Pulse Command already owns the `Project`/`Task` types — this file only
 * defines what's engineering-specific.
 */

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

/** A monitored engineering project — `command.projects` row filtered to
 *  `kind='internal_build'`, plus latest engineering observations. */
export interface MonitoredProject {
  id: string;
  name: string;
  slug: string;
  state: string;
  summary: string | null;
  current_focus: string | null;
  github_repo: string | null;
  local_path: string | null;
  vercel_project_id: string | null;
  archived_at: string | null;
  updated_at: string;
}

export interface MonitoredProjectWithLatest {
  project: MonitoredProject;
  latest_repo: RepoActivity | null;
  latest_fs: FsSnapshot | null;
  latest_deployment: Deployment | null;
  open_task_count: number;
  in_progress_task_count: number;
}

/** Top-line engineering counts for the /dev hero. */
export interface DevHubStats {
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

/** Tasks worth surfacing on the engineering home (P0/P1, in-progress, due). */
export interface EngineeringTaskRow {
  id: string;
  project_id: string | null;
  project_name: string | null;
  project_slug: string | null;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}
