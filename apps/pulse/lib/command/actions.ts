'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q, qOne } from '../db';
import { slugify } from '../utils';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORK_KINDS,
  WORK_STATES,
  type ApprovalDecision,
  type ApprovalReceived,
  type ApprovalState,
  type ApproverKind,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type WorkKind,
  type WorkState,
} from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function strField(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function requireStr(fd: FormData, key: string): string {
  const s = strField(fd, key);
  if (!s) throw new Error(`Missing required field: ${key}`);
  return s;
}

function dateField(fd: FormData, key: string): string | null {
  const s = strField(fd, key);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function uuidField(fd: FormData, key: string): string | null {
  const s = strField(fd, key);
  if (!s) return null;
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

function pickEnum<T extends string>(allowed: readonly T[], v: string | null, fallback: T): T {
  if (!v) return fallback;
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData): Promise<void> {
  const title = requireStr(formData, 'title');
  const project_id = uuidField(formData, 'project_id');
  const assigned_person_id = uuidField(formData, 'assigned_person_id');
  const client_id = uuidField(formData, 'client_id');
  const client_slug = strField(formData, 'client_slug');
  const notes = strField(formData, 'notes');
  const status = pickEnum<TaskStatus>(TASK_STATUSES, strField(formData, 'status'), 'backlog');
  const priority = pickEnum<TaskPriority>(TASK_PRIORITIES, strField(formData, 'priority'), 'p2');
  const due_date = dateField(formData, 'due_date');

  // Manual origin only — never accept signal/recap from form input.
  const t = await qOne<Task>(
    `insert into command.tasks
       (project_id, title, notes, status, priority, due_date,
        assigned_person_id, client_id, client_slug, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual')
     returning *`,
    [project_id, title, notes, status, priority, due_date, assigned_person_id, client_id, client_slug]
  );
  if (!t) throw new Error('Insert returned no row');

  revalidatePath('/');
  revalidatePath('/tasks');
  if (project_id) {
    const p = await qOne<{ slug: string }>(`select slug from command.projects where id = $1`, [project_id]);
    if (p) revalidatePath(`/projects/${p.slug}`);
  }
}

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  const s = pickEnum<TaskStatus>(TASK_STATUSES, status, 'backlog');
  const done_at = s === 'done' ? new Date().toISOString() : null;
  await q(
    `update command.tasks set status = $1, done_at = $2 where id = $3`,
    [s, done_at, id]
  );
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function updateTaskPriority(id: string, priority: string): Promise<void> {
  const p = pickEnum<TaskPriority>(TASK_PRIORITIES, priority, 'p2');
  await q(`update command.tasks set priority = $1 where id = $2`, [p, id]);
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function updateTaskField(
  id: string,
  patch: Partial<{
    title: string;
    notes: string | null;
    due_date: string | null;
    assigned_person_id: string | null;
    client_id: string | null;
    client_slug: string | null;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(id);
  await q(`update command.tasks set ${sets.join(', ')} where id = $${params.length}`, params);
  revalidatePath('/');
  revalidatePath('/tasks');
}

export async function deleteTask(id: string): Promise<void> {
  // Soft-delete: cancelled state, never physical delete (per spec).
  await q(
    `update command.tasks set status = 'cancelled', done_at = coalesce(done_at, now())
      where id = $1`,
    [id]
  );
  revalidatePath('/');
  revalidatePath('/tasks');
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function createProject(formData: FormData): Promise<void> {
  const name = requireStr(formData, 'name');
  const slugInput = strField(formData, 'slug');
  const slug = slugify(slugInput || name);
  const state = pickEnum<WorkState>(WORK_STATES, strField(formData, 'state'), 'idea');
  const kind = pickEnum<WorkKind>(WORK_KINDS, strField(formData, 'kind'), 'client_campaign');
  const summary = strField(formData, 'summary');
  const current_focus = strField(formData, 'current_focus');
  const owner = strField(formData, 'owner');
  const client_id = uuidField(formData, 'client_id');
  const client_slug = strField(formData, 'client_slug');
  const service_line = strField(formData, 'service_line');
  const department_id = uuidField(formData, 'department_id');
  const assigned_person_id = uuidField(formData, 'assigned_person_id');
  const target_ship_date = dateField(formData, 'target_ship_date');
  const priority = pickEnum<TaskPriority>(TASK_PRIORITIES, strField(formData, 'priority'), 'p2');

  const p = await qOne<Project>(
    `insert into command.projects
       (name, slug, state, kind, summary, current_focus, owner,
        client_id, client_slug, service_line, department_id,
        assigned_person_id, priority, target_ship_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *`,
    [
      name, slug, state, kind, summary, current_focus, owner,
      client_id, client_slug, service_line, department_id,
      assigned_person_id, priority, target_ship_date,
    ]
  );
  if (!p) throw new Error('Insert returned no row');

  revalidatePath('/');
  revalidatePath('/projects');
  redirect(`/projects/${p.slug}`);
}

export async function updateProjectState(id: string, state: string): Promise<void> {
  const s = pickEnum<WorkState>(WORK_STATES, state, 'idea');
  await q(
    `update command.projects
        set state = $1,
            archived_at = case when $1::text = 'archived' then now() else null end
      where id = $2`,
    [s, id]
  );
  revalidatePath('/');
  revalidatePath('/projects');
}

export async function updateProjectField(
  id: string,
  patch: Partial<{
    summary: string | null;
    current_focus: string | null;
    target_ship_date: string | null;
    assigned_person_id: string | null;
    department_id: string | null;
    service_line: string | null;
    priority: TaskPriority | null;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(id);
  await q(`update command.projects set ${sets.join(', ')} where id = $${params.length}`, params);
  revalidatePath('/');
  revalidatePath('/projects');
}

// ── Approvals ──────────────────────────────────────────────────────────────

const APPROVERS: ApproverKind[] = ['christian', 'client'];

export async function decideApproval(
  id: string,
  payload: { approver: ApproverKind; status: ApprovalDecision; note?: string | null }
): Promise<{ ok: boolean; state?: ApprovalState; error?: string }> {
  if (!APPROVERS.includes(payload.approver)) {
    return { ok: false, error: 'invalid approver' };
  }
  if (payload.status !== 'approved' && payload.status !== 'changes_requested') {
    return { ok: false, error: 'invalid status' };
  }

  // Read current approval row.
  const current = await qOne<{
    required_approvers: string[] | null;
    received: unknown;
    state: string;
  }>(
    `select required_approvers, received, state::text as state
       from command.approvals
      where id = $1
      limit 1`,
    [id]
  );
  if (!current) return { ok: false, error: 'not found' };
  if (current.state !== 'pending') {
    return { ok: false, error: 'already decided' };
  }

  let received: ApprovalReceived[] = [];
  if (Array.isArray(current.received)) {
    received = current.received as ApprovalReceived[];
  } else if (typeof current.received === 'string') {
    try {
      const parsed = JSON.parse(current.received);
      if (Array.isArray(parsed)) received = parsed;
    } catch {
      received = [];
    }
  }

  // Replace any prior decision from this approver (idempotent).
  received = received.filter(r => r.approver !== payload.approver);
  received.push({
    approver: payload.approver,
    status: payload.status,
    at: new Date().toISOString(),
    note: payload.note ?? null,
  });

  // Recompute state.
  let nextState: ApprovalState = 'pending';
  const required = (current.required_approvers ?? []) as ApproverKind[];
  const anyRejection = received.some(r => r.status === 'changes_requested');
  if (anyRejection) {
    nextState = 'changes_requested';
  } else {
    const allApproved = required.every(req => received.some(r => r.approver === req && r.status === 'approved'));
    if (allApproved) nextState = 'approved';
  }
  const decided_at = nextState === 'pending' ? null : new Date().toISOString();

  await q(
    `update command.approvals
        set received = $1::jsonb,
            state = $2::command.approval_state,
            decided_at = $3
      where id = $4`,
    [JSON.stringify(received), nextState, decided_at, id]
  );

  revalidatePath('/');
  revalidatePath('/approvals');
  return { ok: true, state: nextState };
}
