import { supabaseServer } from './supabase/server';
import type {
  Deployment,
  FsSnapshot,
  Project,
  ProjectWithLatest,
  RepoActivity,
  Task,
  TodayTask,
} from './types';

export async function listProjects(opts?: {
  includeArchived?: boolean;
}): Promise<Project[]> {
  const sb = supabaseServer();
  let q = sb.from('projects').select('*').order('updated_at', { ascending: false });
  if (!opts?.includeArchived) q = q.neq('state', 'archived');
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Project) ?? null;
}

export async function listTasksForProject(projectId: string): Promise<Task[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('status', { ascending: true })
    .order('sort_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listAllOpenTasks(): Promise<Task[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .not('status', 'in', '("done","cancelled")')
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('sort_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function listAllTasks(): Promise<Task[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

async function latestPerProject<T extends { project_id: string; observed_at: string }>(
  table: 'repo_activity' | 'fs_snapshots' | 'deployments',
  projectIds: string[]
): Promise<Map<string, T>> {
  if (projectIds.length === 0) return new Map();
  const sb = supabaseServer();
  const { data, error } = await sb
    .from(table)
    .select('*')
    .in('project_id', projectIds)
    .order('observed_at', { ascending: false });
  if (error) throw error;
  const m = new Map<string, T>();
  for (const row of (data ?? []) as T[]) {
    if (!m.has(row.project_id)) m.set(row.project_id, row);
  }
  return m;
}

export async function buildProjectsWithLatest(): Promise<ProjectWithLatest[]> {
  const projects = await listProjects({ includeArchived: false });
  const ids = projects.map(p => p.id);
  if (ids.length === 0) return [];
  const sb = supabaseServer();

  const [repos, fs, deploys, taskCounts] = await Promise.all([
    latestPerProject<RepoActivity>('repo_activity', ids),
    latestPerProject<FsSnapshot>('fs_snapshots', ids),
    latestPerProject<Deployment>('deployments', ids),
    sb
      .from('tasks')
      .select('project_id, status')
      .in('project_id', ids)
      .then(r => {
        const open = new Map<string, number>();
        const inprog = new Map<string, number>();
        for (const row of (r.data ?? []) as { project_id: string; status: string }[]) {
          if (row.status === 'done' || row.status === 'cancelled') continue;
          open.set(row.project_id, (open.get(row.project_id) ?? 0) + 1);
          if (row.status === 'in_progress') {
            inprog.set(row.project_id, (inprog.get(row.project_id) ?? 0) + 1);
          }
        }
        return { open, inprog };
      }),
  ]);

  return projects.map(p => ({
    project: p,
    latest_repo: repos.get(p.id) ?? null,
    latest_fs: fs.get(p.id) ?? null,
    latest_deployment: deploys.get(p.id) ?? null,
    open_task_count: taskCounts.open.get(p.id) ?? 0,
    in_progress_task_count: taskCounts.inprog.get(p.id) ?? 0,
  }));
}

/** Cross-project tasks worth surfacing on the Today view. */
export async function buildTodayTasks(): Promise<TodayTask[]> {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await sb
    .from('tasks')
    .select('*')
    .or(
      `status.eq.in_progress,status.eq.next,priority.eq.p0,priority.eq.p1,due_date.lte.${today}`
    )
    .not('status', 'in', '("done","cancelled")')
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  const tasks = (rows ?? []) as Task[];

  const projectIds = Array.from(
    new Set(tasks.map(t => t.project_id).filter((id): id is string => !!id))
  );
  let projectsById = new Map<string, Project>();
  if (projectIds.length > 0) {
    const { data: ps } = await sb
      .from('projects')
      .select('*')
      .in('id', projectIds);
    projectsById = new Map((ps ?? []).map((p: Project) => [p.id, p]));
  }

  return tasks.map(t => ({
    task: t,
    project: t.project_id ? projectsById.get(t.project_id) ?? null : null,
  }));
}
