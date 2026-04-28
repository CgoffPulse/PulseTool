'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from './supabase/server';
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

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('projects')
    .insert({ ...input, slug })
    .select('*')
    .single();
  if (error) throw error;

  const p = data as Project;
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
  const sb = supabaseServer();
  const update: Record<string, unknown> = { ...patch };
  if (patch.state === 'archived') update.archived_at = new Date().toISOString();
  if (patch.state && patch.state !== 'archived') update.archived_at = null;

  const { data, error } = await sb
    .from('projects')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;

  const p = data as Project;
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

  const sb = supabaseServer();
  const { data, error } = await sb.from('tasks').insert(input).select('*').single();
  if (error) throw error;

  const t = data as Task;
  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
  if (input.project_id) {
    const { data: p } = await sb
      .from('projects')
      .select('slug')
      .eq('id', input.project_id)
      .maybeSingle();
    if (p) revalidatePath(`/projects/${(p as { slug: string }).slug}`);
  }
}

export async function updateTaskStatus(id: string, status: string) {
  const sb = supabaseServer();
  const update: Record<string, unknown> = { status };
  if (status === 'done') update.done_at = new Date().toISOString();
  if (status !== 'done') update.done_at = null;
  const { data, error } = await sb
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const t = data as Task;
  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function updateTaskPriority(id: string, priority: string) {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('tasks')
    .update({ priority })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  const t = data as Task;
  await markdownSync.upsert('task', t.id, taskFrontmatter(t), t.notes ?? '');
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function deleteTask(id: string) {
  const sb = supabaseServer();
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) throw error;
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
