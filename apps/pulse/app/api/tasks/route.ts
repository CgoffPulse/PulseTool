// TODO(auth): wire bearer-token auth before exposing this beyond local dev.
// All callers must hold a future Pulse internal token. For now, the route is
// available to authenticated agency users (any in-app caller with a session).

import { NextResponse } from 'next/server';
import { q, qOne } from '@/lib/db';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_SET = new Set<string>(TASK_STATUSES);
const PRIORITY_SET = new Set<string>(TASK_PRIORITIES);

interface CreateTaskBody {
  title?: unknown;
  notes?: unknown;
  status?: unknown;
  priority?: unknown;
  due_date?: unknown;
  project_id?: unknown;
  assigned_person_id?: unknown;
  client_id?: unknown;
  client_slug?: unknown;
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function asUuid(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

function asDate(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function POST(req: Request) {
  let body: CreateTaskBody = {};
  try {
    body = (await req.json()) as CreateTaskBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const title = asString(body.title);
  if (!title) {
    return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 });
  }

  const status: TaskStatus = STATUS_SET.has(asString(body.status) ?? '')
    ? (asString(body.status) as TaskStatus)
    : 'backlog';
  const priority: TaskPriority = PRIORITY_SET.has(asString(body.priority) ?? '')
    ? (asString(body.priority) as TaskPriority)
    : 'p2';

  try {
    const t = await qOne<Task>(
      `insert into command.tasks
         (project_id, title, notes, status, priority, due_date,
          assigned_person_id, client_id, client_slug, origin)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual')
       returning *`,
      [
        asUuid(body.project_id),
        title,
        asString(body.notes),
        status,
        priority,
        asDate(body.due_date),
        asUuid(body.assigned_person_id),
        asUuid(body.client_id),
        asString(body.client_slug),
      ]
    );
    if (!t) {
      return NextResponse.json({ ok: false, error: 'insert failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, task: t }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

interface PatchTaskBody {
  id?: unknown;
  status?: unknown;
  priority?: unknown;
  due_date?: unknown;
  title?: unknown;
  notes?: unknown;
  assigned_person_id?: unknown;
}

export async function PATCH(req: Request) {
  let body: PatchTaskBody = {};
  try {
    body = (await req.json()) as PatchTaskBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const id = asUuid(body.id);
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const sets: string[] = [];
  const params: unknown[] = [];

  const status = asString(body.status);
  if (status !== null) {
    if (!STATUS_SET.has(status)) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 });
    }
    params.push(status);
    sets.push(`status = $${params.length}`);
    if (status === 'done') {
      params.push(new Date().toISOString());
      sets.push(`done_at = $${params.length}`);
    } else {
      sets.push(`done_at = null`);
    }
  }

  const priority = asString(body.priority);
  if (priority !== null) {
    if (!PRIORITY_SET.has(priority)) {
      return NextResponse.json({ ok: false, error: 'invalid priority' }, { status: 400 });
    }
    params.push(priority);
    sets.push(`priority = $${params.length}`);
  }

  if (body.due_date !== undefined) {
    params.push(asDate(body.due_date));
    sets.push(`due_date = $${params.length}`);
  }
  const title = asString(body.title);
  if (title !== null) {
    params.push(title);
    sets.push(`title = $${params.length}`);
  }
  if (body.notes !== undefined) {
    params.push(asString(body.notes));
    sets.push(`notes = $${params.length}`);
  }
  if (body.assigned_person_id !== undefined) {
    params.push(asUuid(body.assigned_person_id));
    sets.push(`assigned_person_id = $${params.length}`);
  }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 });
  }
  params.push(id);

  try {
    const t = await qOne<Task>(
      `update command.tasks set ${sets.join(', ')} where id = $${params.length} returning *`,
      params
    );
    return NextResponse.json({ ok: true, task: t });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  // Soft delete: set status to cancelled. Never physical delete.
  const url = new URL(req.url);
  const id = asUuid(url.searchParams.get('id'));
  if (!id) {
    let body: { id?: unknown } = {};
    try {
      body = (await req.json()) as { id?: unknown };
    } catch {
      // ignore — fall through to error
    }
    const idFromBody = asUuid(body.id);
    if (!idFromBody) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }
    return softCancel(idFromBody);
  }
  return softCancel(id);
}

async function softCancel(id: string) {
  try {
    await q(
      `update command.tasks
          set status = 'cancelled',
              done_at = coalesce(done_at, now())
        where id = $1`,
      [id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
