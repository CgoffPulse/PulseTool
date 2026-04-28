import { q, qOne } from './db';
import type {
  Deployment,
  FsSnapshot,
  Project,
  ProjectWithLatest,
  RepoActivity,
  Task,
  TodayTask,
  HubStats,
  CommitFeedRow,
  DeployFeedRow,
} from './types';

// ============================================================================
// Read helpers — server-side only.
// ============================================================================

export async function listProjects(opts?: { includeArchived?: boolean }) {
  const where = opts?.includeArchived ? '' : `where state <> 'archived'`;
  return q<Project>(
    `select * from dev.projects ${where} order by updated_at desc`
  );
}

export async function getProjectBySlug(slug: string) {
  return qOne<Project>(`select * from dev.projects where slug = $1`, [slug]);
}

export async function listTasksForProject(projectId: string) {
  return q<Task>(
    `select * from dev.tasks
     where project_id = $1
     order by status asc, sort_index asc`,
    [projectId]
  );
}

export async function listAllOpenTasks() {
  return q<Task>(
    `select * from dev.tasks
     where status not in ('done','cancelled')
     order by priority asc, due_date asc nulls last, sort_index asc`
  );
}

export async function listAllTasks() {
  return q<Task>(`select * from dev.tasks order by updated_at desc`);
}

async function latestPerProject<T extends { project_id: string }>(
  table: 'repo_activity' | 'fs_snapshots' | 'deployments',
  projectIds: string[]
): Promise<Map<string, T>> {
  if (projectIds.length === 0) return new Map();
  const rows = await q<T>(
    `select distinct on (project_id) *
     from dev.${table}
     where project_id = any($1::uuid[])
     order by project_id, observed_at desc`,
    [projectIds]
  );
  return new Map(rows.map(r => [r.project_id, r]));
}

export async function buildProjectsWithLatest(): Promise<ProjectWithLatest[]> {
  const projects = await listProjects({ includeArchived: false });
  const ids = projects.map(p => p.id);
  if (ids.length === 0) return [];

  const [repos, fs, deploys, taskRows] = await Promise.all([
    latestPerProject<RepoActivity>('repo_activity', ids),
    latestPerProject<FsSnapshot>('fs_snapshots', ids),
    latestPerProject<Deployment>('deployments', ids),
    q<{ project_id: string; status: string; n: string }>(
      `select project_id, status, count(*)::int as n
       from dev.tasks
       where project_id = any($1::uuid[])
       group by project_id, status`,
      [ids]
    ),
  ]);

  const open = new Map<string, number>();
  const inprog = new Map<string, number>();
  for (const r of taskRows) {
    if (!r.project_id) continue;
    if (r.status === 'done' || r.status === 'cancelled') continue;
    const n = Number(r.n);
    open.set(r.project_id, (open.get(r.project_id) ?? 0) + n);
    if (r.status === 'in_progress') {
      inprog.set(r.project_id, (inprog.get(r.project_id) ?? 0) + n);
    }
  }

  return projects.map(p => ({
    project: p,
    latest_repo: repos.get(p.id) ?? null,
    latest_fs: fs.get(p.id) ?? null,
    latest_deployment: deploys.get(p.id) ?? null,
    open_task_count: open.get(p.id) ?? 0,
    in_progress_task_count: inprog.get(p.id) ?? 0,
  }));
}

/** Cross-project tasks worth surfacing on the Today view. */
export async function buildTodayTasks(): Promise<TodayTask[]> {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = await q<Task>(
    `select * from dev.tasks
     where status not in ('done','cancelled')
       and (
         status in ('in_progress','next')
         or priority in ('p0','p1')
         or (due_date is not null and due_date <= $1::date)
       )
     order by priority asc, due_date asc nulls last`,
    [today]
  );

  const projectIds = Array.from(
    new Set(tasks.map(t => t.project_id).filter((id): id is string => !!id))
  );
  let projectsById = new Map<string, Project>();
  if (projectIds.length > 0) {
    const ps = await q<Project>(
      `select * from dev.projects where id = any($1::uuid[])`,
      [projectIds]
    );
    projectsById = new Map(ps.map(p => [p.id, p]));
  }

  return tasks.map(t => ({
    task: t,
    project: t.project_id ? projectsById.get(t.project_id) ?? null : null,
  }));
}

// ============================================================================
// Dashboard / Hub queries
// ============================================================================

/** Top-line stats for the command center hero strip. */
export async function buildHubStats(): Promise<HubStats> {
  const [
    projectCounts,
    taskCounts,
    fsRows,
    deployRows,
    repoRows,
  ] = await Promise.all([
    q<{ state: string; n: string }>(
      `select state::text, count(*)::int as n
       from dev.projects
       group by state`
    ),
    q<{ status: string; n: string }>(
      `select status::text, count(*)::int as n
       from dev.tasks
       group by status`
    ),
    q<{ project_id: string; is_dirty: boolean | null }>(
      `select distinct on (project_id) project_id, is_dirty
       from dev.fs_snapshots
       order by project_id, observed_at desc`
    ),
    q<{ project_id: string; state: string | null }>(
      `select distinct on (project_id) project_id, state
       from dev.deployments
       order by project_id, observed_at desc`
    ),
    q<{ project_id: string; last_commit_at: string | null }>(
      `select distinct on (project_id) project_id, last_commit_at
       from dev.repo_activity
       order by project_id, observed_at desc`
    ),
  ]);

  const byProjectState = new Map<string, number>();
  for (const r of projectCounts) byProjectState.set(r.state, Number(r.n));

  const byTaskStatus = new Map<string, number>();
  for (const r of taskCounts) byTaskStatus.set(r.status, Number(r.n));

  const dirtyRepos = fsRows.filter(r => r.is_dirty === true).length;
  const failingDeploys = deployRows.filter(r => r.state === 'ERROR').length;
  const liveDeploys = deployRows.filter(r => r.state === 'READY').length;
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const staleRepos = repoRows.filter(r => {
    if (!r.last_commit_at) return false;
    return new Date(r.last_commit_at).getTime() < fourteenDaysAgo;
  }).length;

  return {
    active_projects: byProjectState.get('active') ?? 0,
    idea_projects: byProjectState.get('idea') ?? 0,
    paused_projects: byProjectState.get('paused') ?? 0,
    shipped_projects: byProjectState.get('shipped') ?? 0,
    archived_projects: byProjectState.get('archived') ?? 0,
    open_tasks:
      (byTaskStatus.get('backlog') ?? 0) +
      (byTaskStatus.get('next') ?? 0) +
      (byTaskStatus.get('in_progress') ?? 0) +
      (byTaskStatus.get('blocked') ?? 0),
    in_progress_tasks: byTaskStatus.get('in_progress') ?? 0,
    blocked_tasks: byTaskStatus.get('blocked') ?? 0,
    done_tasks: byTaskStatus.get('done') ?? 0,
    dirty_repos: dirtyRepos,
    failing_deploys: failingDeploys,
    live_deploys: liveDeploys,
    stale_repos: staleRepos,
  };
}

/** Latest commit per project across the last N projects (default 20). */
export async function listRecentCommits(limit = 20): Promise<CommitFeedRow[]> {
  return q<CommitFeedRow>(
    `with latest as (
        select distinct on (project_id)
          project_id,
          last_commit_sha,
          last_commit_message,
          last_commit_at
        from dev.repo_activity
        where last_commit_sha is not null
        order by project_id, observed_at desc
      )
      select
        l.project_id,
        l.last_commit_sha     as sha,
        l.last_commit_message as message,
        l.last_commit_at      as committed_at,
        p.name                as project_name,
        p.slug                as project_slug,
        p.github_repo         as github_repo
      from latest l
      join dev.projects p on p.id = l.project_id
      where p.state <> 'archived'
      order by l.last_commit_at desc nulls last
      limit $1`,
    [limit]
  );
}

/** Last N deployment events across the workspace. */
export async function listRecentDeploys(limit = 10): Promise<DeployFeedRow[]> {
  return q<DeployFeedRow>(
    `select
        d.project_id,
        d.state,
        d.url,
        d.commit_sha,
        d.deployed_at,
        d.observed_at,
        p.name as project_name,
        p.slug as project_slug
      from dev.deployments d
      join dev.projects p on p.id = d.project_id
      where d.state is not null
      order by coalesce(d.deployed_at, d.observed_at) desc
      limit $1`,
    [limit]
  );
}

export async function listCommitsForProject(
  projectId: string,
  limit = 10
): Promise<RepoActivity[]> {
  return q<RepoActivity>(
    `select * from dev.repo_activity
     where project_id = $1 and last_commit_sha is not null
     order by observed_at desc
     limit $2`,
    [projectId, limit]
  );
}

export async function listDeploysForProject(
  projectId: string,
  limit = 10
): Promise<Deployment[]> {
  return q<Deployment>(
    `select * from dev.deployments
     where project_id = $1
     order by coalesce(deployed_at, observed_at) desc
     limit $2`,
    [projectId, limit]
  );
}

export async function listFsSnapshotsForProject(
  projectId: string,
  limit = 10
): Promise<FsSnapshot[]> {
  return q<FsSnapshot>(
    `select * from dev.fs_snapshots
     where project_id = $1
     order by observed_at desc
     limit $2`,
    [projectId, limit]
  );
}
