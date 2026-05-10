import 'server-only';
import { q, qOne } from '../db';
import type {
  CommitFeedRow,
  DeployFeedRow,
  Deployment,
  DevHubStats,
  EngineeringTaskRow,
  FsSnapshot,
  MonitoredProject,
  MonitoredProjectWithLatest,
  RepoActivity,
} from './types';

/**
 * Engineering monitor reads.
 *
 * Source of truth for the project list is `command.projects` filtered to
 * `kind='internal_build'`. The append-only observation tables (`dev.repo_activity`,
 * `dev.deployments`, `dev.fs_snapshots`) are keyed by the same UUID, so a join
 * on `project_id = command.projects.id` is sound (Wave 0 backfilled them).
 *
 * Every query is wrapped in `safe()` so a missing schema or sparse data never
 * breaks the page — empty results fall back to the designed empty states.
 */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn('[pulse/dev] query failed:', (err as Error).message);
    return fallback;
  }
}

// ─── Projects (engineering only — kind='internal_build') ───────────────────

export async function listEngineeringProjects(opts?: { includeArchived?: boolean }) {
  return safe(
    (async (): Promise<MonitoredProject[]> => {
      const where = opts?.includeArchived
        ? `where p.kind = 'internal_build'`
        : `where p.kind = 'internal_build' and p.state::text <> 'archived'`;
      return q<MonitoredProject>(
        `select p.id, p.name, p.slug, p.state::text as state,
                p.summary, p.current_focus,
                p.github_repo, p.local_path, p.vercel_project_id,
                p.archived_at, p.updated_at
           from command.projects p
           ${where}
           order by p.updated_at desc`
      );
    })(),
    []
  );
}

export async function getEngineeringProjectBySlug(slug: string) {
  return safe(
    (async (): Promise<MonitoredProject | null> => {
      return qOne<MonitoredProject>(
        `select p.id, p.name, p.slug, p.state::text as state,
                p.summary, p.current_focus,
                p.github_repo, p.local_path, p.vercel_project_id,
                p.archived_at, p.updated_at
           from command.projects p
           where p.slug = $1
             and p.kind = 'internal_build'
           limit 1`,
        [slug]
      );
    })(),
    null
  );
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

export async function buildEngineeringProjectsWithLatest(): Promise<MonitoredProjectWithLatest[]> {
  const projects = await listEngineeringProjects({ includeArchived: false });
  const ids = projects.map(p => p.id);
  if (ids.length === 0) return [];

  return safe(
    (async (): Promise<MonitoredProjectWithLatest[]> => {
      const [repos, fs, deploys, taskRows] = await Promise.all([
        latestPerProject<RepoActivity>('repo_activity', ids),
        latestPerProject<FsSnapshot>('fs_snapshots', ids),
        latestPerProject<Deployment>('deployments', ids),
        q<{ project_id: string; status: string; n: string }>(
          `select project_id, status::text as status, count(*)::int as n
           from command.tasks
           where project_id = any($1::uuid[])
           group by project_id, status::text`,
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
    })(),
    projects.map(p => ({
      project: p,
      latest_repo: null,
      latest_fs: null,
      latest_deployment: null,
      open_task_count: 0,
      in_progress_task_count: 0,
    }))
  );
}

// ─── Cross-project engineering tasks (urgent / in-flight) ──────────────────

export async function listEngineeringTodayTasks(): Promise<EngineeringTaskRow[]> {
  return safe(
    (async (): Promise<EngineeringTaskRow[]> => {
      const today = new Date().toISOString().slice(0, 10);
      return q<EngineeringTaskRow>(
        `select t.id, t.project_id,
                p.name as project_name, p.slug as project_slug,
                t.title,
                t.status::text as status,
                t.priority::text as priority,
                t.due_date
           from command.tasks t
           left join command.projects p on p.id = t.project_id
          where (p.kind is null or p.kind = 'internal_build')
            and t.status::text not in ('done','cancelled')
            and (
              t.status::text in ('in_progress','next')
              or t.priority::text in ('p0','p1')
              or (t.due_date is not null and t.due_date <= $1::date)
            )
          order by case t.priority::text
                     when 'p0' then 0 when 'p1' then 1
                     when 'p2' then 2 when 'p3' then 3 else 4 end,
                   t.due_date nulls last,
                   t.updated_at desc
          limit 50`,
        [today]
      );
    })(),
    []
  );
}

// ─── Hub stats — top-line engineering counts ───────────────────────────────

export async function buildDevHubStats(): Promise<DevHubStats> {
  return safe(
    (async (): Promise<DevHubStats> => {
      const [projectCounts, taskCounts, fsRows, deployRows, repoRows] = await Promise.all([
        q<{ state: string; n: string }>(
          `select state::text, count(*)::int as n
           from command.projects
           where kind = 'internal_build'
           group by state`
        ),
        q<{ status: string; n: string }>(
          `select t.status::text, count(*)::int as n
           from command.tasks t
           left join command.projects p on p.id = t.project_id
           where (p.kind is null or p.kind = 'internal_build')
           group by t.status::text`
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
    })(),
    {
      active_projects: 0,
      idea_projects: 0,
      paused_projects: 0,
      shipped_projects: 0,
      archived_projects: 0,
      open_tasks: 0,
      in_progress_tasks: 0,
      blocked_tasks: 0,
      done_tasks: 0,
      dirty_repos: 0,
      failing_deploys: 0,
      live_deploys: 0,
      stale_repos: 0,
    }
  );
}

// ─── Activity feed ─────────────────────────────────────────────────────────

export async function listRecentCommits(limit = 20): Promise<CommitFeedRow[]> {
  return safe(
    (async (): Promise<CommitFeedRow[]> => {
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
          join command.projects p on p.id = l.project_id
          where p.kind = 'internal_build'
            and p.state::text <> 'archived'
          order by l.last_commit_at desc nulls last
          limit $1`,
        [limit]
      );
    })(),
    []
  );
}

export async function listRecentDeploys(limit = 10): Promise<DeployFeedRow[]> {
  return safe(
    (async (): Promise<DeployFeedRow[]> => {
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
          join command.projects p on p.id = d.project_id
          where d.state is not null
            and p.kind = 'internal_build'
          order by coalesce(d.deployed_at, d.observed_at) desc
          limit $1`,
        [limit]
      );
    })(),
    []
  );
}

// ─── Per-project monitor history ───────────────────────────────────────────

export async function listCommitsForProject(
  projectId: string,
  limit = 10
): Promise<RepoActivity[]> {
  return safe(
    q<RepoActivity>(
      `select * from dev.repo_activity
       where project_id = $1 and last_commit_sha is not null
       order by observed_at desc
       limit $2`,
      [projectId, limit]
    ),
    []
  );
}

export async function listDeploysForProject(
  projectId: string,
  limit = 10
): Promise<Deployment[]> {
  return safe(
    q<Deployment>(
      `select * from dev.deployments
       where project_id = $1
       order by coalesce(deployed_at, observed_at) desc
       limit $2`,
      [projectId, limit]
    ),
    []
  );
}

export async function listFsSnapshotsForProject(
  projectId: string,
  limit = 10
): Promise<FsSnapshot[]> {
  return safe(
    q<FsSnapshot>(
      `select * from dev.fs_snapshots
       where project_id = $1
       order by observed_at desc
       limit $2`,
      [projectId, limit]
    ),
    []
  );
}
