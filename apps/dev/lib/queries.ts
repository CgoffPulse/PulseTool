import { q, qOne } from './db';
import type {
  Deployment,
  FsSnapshot,
  Project,
  ProjectWithLatest,
  RepoActivity,
  Task,
  TodayTask,
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
