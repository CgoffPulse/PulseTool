'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne } from './db';
import { markdownSync } from './sync/markdown';
import { slugify } from './utils';
import {
  PROJECT_STATES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Project,
  type Task,
} from './types';

// ============================================================================
// Projects
// ============================================================================

const ProjectInput = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  state: z.enum(PROJECT_STATES as [string, ...string[]]).default('idea'),
  summary: z.string().trim().nullish().transform(v => v || null),
  current_focus: z.string().trim().nullish().transform(v => v || null),
  owner: z.string().trim().nullish().transform(v => v || null),
  github_repo: z.string().trim().nullish().transform(v => v || null),
  local_path: z.string().trim().nullish().transform(v => v || null),
  vercel_project_id: z.string().trim().nullish().transform(v => v || null),
});

export async function createProject(formData: FormData) {
  const input = ProjectInput.parse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? undefined,
    state: formData.get('state') ?? 'idea',
    summary: formData.get('summary'),
    current_focus: formData.get('current_focus'),
    owner: formData.get('owner'),
    github_repo: formData.get('github_repo'),
    local_path: formData.get('local_path'),
    vercel_project_id: formData.get('vercel_project_id'),
  });
  const slug = (input.slug && slugify(input.slug)) || slugify(input.name);

  const p = await qOne<Project>(
    `insert into dev.projects
       (name, slug, state, summary, current_focus, owner,
        github_repo, local_path, vercel_project_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      input.name,
      slug,
      input.state,
      input.summary,
      input.current_focus,
      input.owner,
      input.github_repo,
      input.local_path,
      input.vercel_project_id,
    ]
  );
  if (!p) throw new Error('Insert returned no row');

  await markdownSync.upsert('project', p.id, projectFrontmatter(p), p.summary ?? '');
  revalidatePath('/');
  revalidatePath('/projects');
  redirect(`/projects/${p.slug}`);
}

export async function updateProjectField(
  id: string,
  patch: Partial<{
    state: string;
    current_focus: string | null;
    summary: string | null;
    github_repo: string | null;
    local_path: string | null;
    vercel_project_id: string | null;
  }>
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (patch.state === 'archived') {
    params.push(new Date().toISOString());
    sets.push(`archived_at = $${params.length}`);
  } else if (patch.state) {
    sets.push(`archived_at = null`);
  }
  if (sets.length === 0) return;

  params.push(id);
  const p = await qOne<Project>(
    `update dev.projects set ${sets.join(', ')} where id = $${params.length} returning *`,
    params
  );
  if (!p) return;

  await markdownSync.upsert('project', p.id, projectFrontmatter(p), p.summary ?? '');
  revalidatePath('/');
  revalidatePath('/projects');
  revalidatePath(`/projects/${p.slug}`);
}

// ============================================================================
// Tasks
// ============================================================================

const TaskInput = z.object({
  project_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1),
  notes: z.string().trim().nullish().transform(v => v || null),
  status: z.enum(TASK_STATUSES as [string, ...string[]]).default('backlog'),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).default('p2'),
  due_date: z
    .string()
    .trim()
    .nullish()
    .transform(v => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
});

export async function createTask(formData: FormData) {
  const projectIdRaw = formData.get('project_id');
  const input = TaskInput.parse({
    project_id: projectIdRaw && projectIdRaw !== '' ? projectIdRaw : null,
    title: formData.get('title'),
    notes: formData.get('notes'),
    status: formData.get('status') ?? 'backlog',
    priority: formData.get('priority') ?? 'p2',
    due_date: formData.get('due_date'),
  });

  const t = await qOne<Task>(
    `insert into dev.tasks (project_id, title, notes, status, priority, due_date)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [
      input.project_id ?? null,
      input.title,
      input.notes,
      input.status,
      input.priority,
      input.due_date,
    ]
  );
  if (!t) throw new Error('Insert returned no row');

  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
  if (input.project_id) {
    const p = await qOne<{ slug: string }>(
      `select slug from dev.projects where id = $1`,
      [input.project_id]
    );
    if (p) revalidatePath(`/projects/${p.slug}`);
  }
}

export async function updateTaskStatus(id: string, status: string) {
  const done_at =
    status === 'done' ? new Date().toISOString() : null;
  const t = await qOne<Task>(
    `update dev.tasks set status = $1, done_at = $2
     where id = $3 returning *`,
    [status, done_at, id]
  );
  if (!t) return;
  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function updateTaskPriority(id: string, priority: string) {
  const t = await qOne<Task>(
    `update dev.tasks set priority = $1 where id = $2 returning *`,
    [priority, id]
  );
  if (!t) return;
  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function deleteTask(id: string) {
  await q(`delete from dev.tasks where id = $1`, [id]);
  await markdownSync.delete('task', id);
  revalidatePath('/');
  revalidatePath('/tasks');
}

// ============================================================================
// Markdown frontmatter helpers
// ============================================================================

function projectFrontmatter(p: Project): Record<string, unknown> {
  return {
    type: 'project',
    id: p.id,
    name: p.name,
    slug: p.slug,
    state: p.state,
    owner: p.owner,
    github_repo: p.github_repo,
    local_path: p.local_path,
    updated_at: p.updated_at,
  };
}

function taskFrontmatter(t: Task): Record<string, unknown> {
  return {
    type: 'task',
    id: t.id,
    project_id: t.project_id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    done_at: t.done_at,
    updated_at: t.updated_at,
  };
}
