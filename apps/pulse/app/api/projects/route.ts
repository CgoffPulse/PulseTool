// TODO(auth): wire bearer-token auth before exposing this beyond local dev.

import { NextResponse } from 'next/server';
import { qOne } from '@/lib/db';
import { slugify } from '@/lib/utils';
import {
  TASK_PRIORITIES,
  WORK_KINDS,
  WORK_STATES,
  type Project,
  type TaskPriority,
  type WorkKind,
  type WorkState,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KIND_SET = new Set<string>(WORK_KINDS);
const STATE_SET = new Set<string>(WORK_STATES);
const PRIORITY_SET = new Set<string>(TASK_PRIORITIES);

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

interface CreateProjectBody {
  name?: unknown;
  slug?: unknown;
  state?: unknown;
  kind?: unknown;
  summary?: unknown;
  current_focus?: unknown;
  owner?: unknown;
  client_id?: unknown;
  client_slug?: unknown;
  service_line?: unknown;
  department_id?: unknown;
  assigned_person_id?: unknown;
  priority?: unknown;
  target_ship_date?: unknown;
}

export async function POST(req: Request) {
  let body: CreateProjectBody = {};
  try {
    body = (await req.json()) as CreateProjectBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const name = asString(body.name);
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name required' }, { status: 400 });
  }
  const slug = slugify(asString(body.slug) ?? name);
  const kind: WorkKind = KIND_SET.has(asString(body.kind) ?? '')
    ? (asString(body.kind) as WorkKind)
    : 'client_campaign';
  const state: WorkState = STATE_SET.has(asString(body.state) ?? '')
    ? (asString(body.state) as WorkState)
    : 'idea';
  const priority: TaskPriority = PRIORITY_SET.has(asString(body.priority) ?? '')
    ? (asString(body.priority) as TaskPriority)
    : 'p2';

  try {
    const p = await qOne<Project>(
      `insert into command.projects
         (name, slug, state, kind, summary, current_focus, owner,
          client_id, client_slug, service_line, department_id,
          assigned_person_id, priority, target_ship_date)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [
        name,
        slug,
        state,
        kind,
        asString(body.summary),
        asString(body.current_focus),
        asString(body.owner),
        asUuid(body.client_id),
        asString(body.client_slug),
        asString(body.service_line),
        asUuid(body.department_id),
        asUuid(body.assigned_person_id),
        priority,
        asDate(body.target_ship_date),
      ]
    );
    if (!p) return NextResponse.json({ ok: false, error: 'insert failed' }, { status: 500 });
    return NextResponse.json({ ok: true, project: p }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

interface PatchProjectBody {
  id?: unknown;
  state?: unknown;
  summary?: unknown;
  current_focus?: unknown;
  target_ship_date?: unknown;
  assigned_person_id?: unknown;
  department_id?: unknown;
  service_line?: unknown;
  priority?: unknown;
}

export async function PATCH(req: Request) {
  let body: PatchProjectBody = {};
  try {
    body = (await req.json()) as PatchProjectBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const id = asUuid(body.id);
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const sets: string[] = [];
  const params: unknown[] = [];

  const state = asString(body.state);
  if (state !== null) {
    if (!STATE_SET.has(state)) {
      return NextResponse.json({ ok: false, error: 'invalid state' }, { status: 400 });
    }
    params.push(state);
    sets.push(`state = $${params.length}`);
    sets.push(`archived_at = case when $${params.length}::text = 'archived' then now() else null end`);
  }
  if (body.summary !== undefined) {
    params.push(asString(body.summary));
    sets.push(`summary = $${params.length}`);
  }
  if (body.current_focus !== undefined) {
    params.push(asString(body.current_focus));
    sets.push(`current_focus = $${params.length}`);
  }
  if (body.target_ship_date !== undefined) {
    params.push(asDate(body.target_ship_date));
    sets.push(`target_ship_date = $${params.length}`);
  }
  if (body.assigned_person_id !== undefined) {
    params.push(asUuid(body.assigned_person_id));
    sets.push(`assigned_person_id = $${params.length}`);
  }
  if (body.department_id !== undefined) {
    params.push(asUuid(body.department_id));
    sets.push(`department_id = $${params.length}`);
  }
  if (body.service_line !== undefined) {
    params.push(asString(body.service_line));
    sets.push(`service_line = $${params.length}`);
  }
  const priority = asString(body.priority);
  if (priority !== null) {
    if (!PRIORITY_SET.has(priority)) {
      return NextResponse.json({ ok: false, error: 'invalid priority' }, { status: 400 });
    }
    params.push(priority);
    sets.push(`priority = $${params.length}`);
  }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: 'no fields to update' }, { status: 400 });
  }
  params.push(id);

  try {
    const p = await qOne<Project>(
      `update command.projects set ${sets.join(', ')} where id = $${params.length} returning *`,
      params
    );
    return NextResponse.json({ ok: true, project: p });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
