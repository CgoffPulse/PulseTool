import 'server-only';
import { q, qOne } from './db';
import type {
  AgencyObjective,
  Approval,
  ApprovalQueueItem,
  ApprovalReceived,
  ApprovalState,
  ApproverKind,
  ApprovalArtifactKind,
  CalendarEvent,
  Client,
  ClientTier,
  Department,
  Person,
  PersonPlate,
  Project,
  ProjectSummary,
  Task,
  TaskPriority,
  TaskStatus,
  WorkKind,
  WorkState,
} from './types';

/**
 * Pulse Command read layer.
 *
 * Every query is wrapped in `safe()` so a missing schema (e.g. before Wave 0
 * migrations land) never breaks the dashboard. Empty results are the
 * fallback — pages render their designed empty states.
 */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn('[huddle/command] query failed:', (err as Error).message);
    return fallback;
  }
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date(v as string).toISOString();
}

// ─── Projects ──────────────────────────────────────────────────────────────

export interface ProjectFilter {
  kind?: WorkKind;
  state?: WorkState;
  client_id?: string;
  client_slug?: string;
  department_id?: string;
}

export async function listProjects(filter: ProjectFilter = {}): Promise<ProjectSummary[]> {
  return safe(
    (async (): Promise<ProjectSummary[]> => {
      const wheres: string[] = ['1=1'];
      const params: unknown[] = [];
      if (filter.kind) {
        params.push(filter.kind);
        wheres.push(`p.kind = $${params.length}`);
      }
      if (filter.state) {
        params.push(filter.state);
        wheres.push(`p.state::text = $${params.length}`);
      }
      if (filter.client_id) {
        params.push(filter.client_id);
        wheres.push(`p.client_id = $${params.length}`);
      }
      if (filter.client_slug) {
        params.push(filter.client_slug);
        wheres.push(`p.client_slug = $${params.length}`);
      }
      if (filter.department_id) {
        params.push(filter.department_id);
        wheres.push(`p.department_id = $${params.length}`);
      }

      const rows = await q<ProjectSummary & { open_task_count: string | number; in_progress_task_count: string | number }>(
        `select p.id, p.name, p.slug, p.state::text as state, p.kind::text as kind,
                p.summary, p.current_focus, p.owner,
                p.client_id, p.client_slug, c.name as client_name,
                p.service_line, p.department_id,
                d.key as department_key, d.name as department_name,
                p.assigned_person_id, pe.name as assigned_person_name,
                p.priority::text as priority,
                p.target_ship_date, p.github_repo, p.local_path,
                p.vercel_project_id, p.archived_at, p.created_at, p.updated_at,
                coalesce((select count(*) from command.tasks t
                          where t.project_id = p.id
                            and t.status not in ('done','cancelled'))::int, 0) as open_task_count,
                coalesce((select count(*) from command.tasks t
                          where t.project_id = p.id
                            and t.status = 'in_progress')::int, 0) as in_progress_task_count
           from command.projects p
           left join clients c on c.id = p.client_id
           left join command.departments d on d.id = p.department_id
           left join people pe on pe.id = p.assigned_person_id
          where ${wheres.join(' and ')}
          order by case p.state::text
                     when 'active' then 1
                     when 'idea' then 2
                     when 'paused' then 3
                     when 'shipped' then 4
                     else 5 end,
                   p.updated_at desc`,
        params
      );
      return rows.map(r => ({
        ...r,
        open_task_count: Number(r.open_task_count),
        in_progress_task_count: Number(r.in_progress_task_count),
      }));
    })(),
    []
  );
}

export async function getProject(slug: string): Promise<ProjectSummary | null> {
  return safe(
    (async (): Promise<ProjectSummary | null> => {
      const r = await qOne<ProjectSummary & { open_task_count: string | number; in_progress_task_count: string | number }>(
        `select p.id, p.name, p.slug, p.state::text as state, p.kind::text as kind,
                p.summary, p.current_focus, p.owner,
                p.client_id, p.client_slug, c.name as client_name,
                p.service_line, p.department_id,
                d.key as department_key, d.name as department_name,
                p.assigned_person_id, pe.name as assigned_person_name,
                p.priority::text as priority,
                p.target_ship_date, p.github_repo, p.local_path,
                p.vercel_project_id, p.archived_at, p.created_at, p.updated_at,
                coalesce((select count(*) from command.tasks t
                          where t.project_id = p.id
                            and t.status not in ('done','cancelled'))::int, 0) as open_task_count,
                coalesce((select count(*) from command.tasks t
                          where t.project_id = p.id
                            and t.status = 'in_progress')::int, 0) as in_progress_task_count
           from command.projects p
           left join clients c on c.id = p.client_id
           left join command.departments d on d.id = p.department_id
           left join people pe on pe.id = p.assigned_person_id
          where p.slug = $1
          limit 1`,
        [slug]
      );
      if (!r) return null;
      return {
        ...r,
        open_task_count: Number(r.open_task_count),
        in_progress_task_count: Number(r.in_progress_task_count),
      };
    })(),
    null
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  project_id?: string;
  client_id?: string;
  client_slug?: string;
  assigned_person_id?: string;
  department_id?: string;
  open_only?: boolean;
  limit?: number;
}

export async function listTasks(filter: TaskFilter = {}): Promise<Task[]> {
  return safe(
    (async (): Promise<Task[]> => {
      const wheres: string[] = ['1=1'];
      const params: unknown[] = [];
      if (filter.status) {
        const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
        params.push(arr);
        wheres.push(`t.status::text = ANY($${params.length})`);
      }
      if (filter.priority) {
        const arr = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        params.push(arr);
        wheres.push(`t.priority::text = ANY($${params.length})`);
      }
      if (filter.open_only) {
        wheres.push(`t.status::text not in ('done','cancelled')`);
      }
      if (filter.project_id) {
        params.push(filter.project_id);
        wheres.push(`t.project_id = $${params.length}`);
      }
      if (filter.client_id) {
        params.push(filter.client_id);
        wheres.push(`t.client_id = $${params.length}`);
      }
      if (filter.client_slug) {
        params.push(filter.client_slug);
        wheres.push(`t.client_slug = $${params.length}`);
      }
      if (filter.assigned_person_id) {
        params.push(filter.assigned_person_id);
        wheres.push(`t.assigned_person_id = $${params.length}`);
      }
      if (filter.department_id) {
        params.push(filter.department_id);
        wheres.push(`p.department_id = $${params.length}`);
      }
      const lim = filter.limit ?? 500;

      const rows = await q<Task>(
        `select t.id, t.project_id, p.name as project_name, p.slug as project_slug,
                t.title, t.notes,
                t.status::text as status, t.priority::text as priority,
                t.due_date, t.done_at, t.sort_index,
                t.assigned_person_id, pe.name as assigned_person_name,
                t.client_id, t.client_slug, c.name as client_name,
                coalesce(t.origin::text, 'manual') as origin,
                t.signal_key, t.artifact_url, t.artifact_kind, t.artifact_id,
                t.auto_close_rule,
                t.created_at, t.updated_at
           from command.tasks t
           left join command.projects p on p.id = t.project_id
           left join people pe on pe.id = t.assigned_person_id
           left join clients c on c.id = t.client_id
          where ${wheres.join(' and ')}
          order by case t.priority::text
                     when 'p0' then 0 when 'p1' then 1
                     when 'p2' then 2 when 'p3' then 3 else 4 end,
                   t.due_date nulls last,
                   t.updated_at desc
          limit ${lim}`,
        params
      );
      return rows;
    })(),
    []
  );
}

export async function getTask(id: string): Promise<Task | null> {
  return safe(
    (async (): Promise<Task | null> => {
      return qOne<Task>(
        `select t.id, t.project_id, p.name as project_name, p.slug as project_slug,
                t.title, t.notes,
                t.status::text as status, t.priority::text as priority,
                t.due_date, t.done_at, t.sort_index,
                t.assigned_person_id, pe.name as assigned_person_name,
                t.client_id, t.client_slug, c.name as client_name,
                coalesce(t.origin::text, 'manual') as origin,
                t.signal_key, t.artifact_url, t.artifact_kind, t.artifact_id,
                t.auto_close_rule,
                t.created_at, t.updated_at
           from command.tasks t
           left join command.projects p on p.id = t.project_id
           left join people pe on pe.id = t.assigned_person_id
           left join clients c on c.id = t.client_id
          where t.id = $1
          limit 1`,
        [id]
      );
    })(),
    null
  );
}

// ─── Approvals ─────────────────────────────────────────────────────────────

function rowToApproval(r: {
  id: string;
  artifact_kind: string;
  artifact_id: string | null;
  artifact_slug: string | null;
  artifact_title: string | null;
  artifact_url: string | null;
  client_id: string | null;
  client_slug: string | null;
  client_name: string | null;
  required_approvers: string[] | null;
  received: unknown;
  state: string;
  requested_at: string;
  decided_at: string | null;
  notes: string | null;
}): Approval {
  let received: ApprovalReceived[] = [];
  if (Array.isArray(r.received)) {
    received = r.received as ApprovalReceived[];
  } else if (typeof r.received === 'string') {
    try {
      const parsed = JSON.parse(r.received);
      if (Array.isArray(parsed)) received = parsed;
    } catch {
      received = [];
    }
  }
  return {
    id: r.id,
    artifact_kind: r.artifact_kind as ApprovalArtifactKind,
    artifact_id: r.artifact_id,
    artifact_slug: r.artifact_slug,
    artifact_title: r.artifact_title,
    artifact_url: r.artifact_url,
    client_id: r.client_id,
    client_slug: r.client_slug,
    client_name: r.client_name,
    required_approvers: (r.required_approvers ?? []) as ApproverKind[],
    received,
    state: r.state as ApprovalState,
    requested_at: toIso(r.requested_at),
    decided_at: r.decided_at ? toIso(r.decided_at) : null,
    notes: r.notes,
  };
}

export async function listApprovals(state?: ApprovalState): Promise<Approval[]> {
  return safe(
    (async (): Promise<Approval[]> => {
      const params: unknown[] = [];
      const where = state ? `where a.state::text = $1` : '';
      if (state) params.push(state);
      const rows = await q<Parameters<typeof rowToApproval>[0]>(
        `select a.id, a.artifact_kind::text as artifact_kind,
                a.artifact_id, a.artifact_slug, a.artifact_title, a.artifact_url,
                a.client_id, a.client_slug, c.name as client_name,
                a.required_approvers, a.received, a.state::text as state,
                a.requested_at, a.decided_at, a.notes
           from command.approvals a
           left join clients c on c.id = a.client_id
          ${where}
          order by case a.state::text when 'pending' then 0 else 1 end,
                   a.requested_at desc`,
        params
      );
      return rows.map(rowToApproval);
    })(),
    []
  );
}

export async function getApproval(id: string): Promise<Approval | null> {
  return safe(
    (async (): Promise<Approval | null> => {
      const r = await qOne<Parameters<typeof rowToApproval>[0]>(
        `select a.id, a.artifact_kind::text as artifact_kind,
                a.artifact_id, a.artifact_slug, a.artifact_title, a.artifact_url,
                a.client_id, a.client_slug, c.name as client_name,
                a.required_approvers, a.received, a.state::text as state,
                a.requested_at, a.decided_at, a.notes
           from command.approvals a
           left join clients c on c.id = a.client_id
          where a.id = $1
          limit 1`,
        [id]
      );
      return r ? rowToApproval(r) : null;
    })(),
    null
  );
}

// ─── Departments ───────────────────────────────────────────────────────────

export async function listDepartments(): Promise<Department[]> {
  return safe(
    (async (): Promise<Department[]> => {
      return q<Department>(
        `select id, key, name, description, lead_person_id, created_at, updated_at
           from command.departments
          order by name`
      );
    })(),
    []
  );
}

export async function getDepartment(key: string): Promise<Department | null> {
  return safe(
    (async (): Promise<Department | null> => {
      return qOne<Department>(
        `select id, key, name, description, lead_person_id, created_at, updated_at
           from command.departments
          where key = $1
          limit 1`,
        [key]
      );
    })(),
    null
  );
}

// ─── Clients ───────────────────────────────────────────────────────────────

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  tier: ClientTier | null;
  service_lines: string[] | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export async function listClients(): Promise<Client[]> {
  // Try the rich query first (post-Wave-0). Fall back to the minimal one.
  const rich = await safe(
    (async (): Promise<Client[]> => {
      const rows = await q<ClientRow>(
        `select id, name, slug, color, tier::text as tier, service_lines,
                archived, created_at, updated_at
           from clients
          where archived = false
          order by name`
      );
      return rows;
    })(),
    null as Client[] | null
  );
  if (rich) return rich;

  return safe(
    (async (): Promise<Client[]> => {
      const rows = await q<Omit<ClientRow, 'tier' | 'service_lines'>>(
        `select id, name, slug, color, archived, created_at, updated_at
           from clients
          where archived = false
          order by name`
      );
      return rows.map(r => ({
        ...r,
        tier: null,
        service_lines: null,
      }));
    })(),
    []
  );
}

export async function getClient(slug: string): Promise<Client | null> {
  const rich = await safe(
    (async (): Promise<Client | null> => {
      return qOne<Client>(
        `select id, name, slug, color, tier::text as tier, service_lines,
                archived, created_at, updated_at
           from clients
          where slug = $1
          limit 1`,
        [slug]
      );
    })(),
    null
  );
  if (rich) return rich;

  return safe(
    (async (): Promise<Client | null> => {
      const r = await qOne<Omit<Client, 'tier' | 'service_lines'>>(
        `select id, name, slug, color, archived, created_at, updated_at
           from clients
          where slug = $1
          limit 1`,
        [slug]
      );
      if (!r) return null;
      return { ...r, tier: null, service_lines: null };
    })(),
    null
  );
}

// ─── People ────────────────────────────────────────────────────────────────

export async function listPeople(): Promise<Person[]> {
  return safe(
    (async (): Promise<Person[]> => {
      return q<Person>(
        `select p.id, p.name, p.role::text as role, p.color,
                p.archived, p.created_at, p.updated_at
           from people p
          where p.archived = false
          order by p.name`
      );
    })(),
    []
  );
}

export async function getPerson(id: string): Promise<Person | null> {
  return safe(
    (async (): Promise<Person | null> => {
      return qOne<Person>(
        `select p.id, p.name, p.role::text as role, p.color,
                p.archived, p.created_at, p.updated_at
           from people p
          where p.id = $1
          limit 1`,
        [id]
      );
    })(),
    null
  );
}

// ─── Calendar ──────────────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number): Promise<CalendarEvent[]> {
  // month = 1..12
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  void startDate; // satisfy lint when unused

  const events: CalendarEvent[] = [];

  // Shoots (public)
  await safe(
    (async () => {
      const rows = await q<{
        id: string;
        scheduled_date: string;
        scheduled_time: string | null;
        location: string | null;
        client_id: string | null;
        client_slug: string | null;
        client_name: string | null;
        client_color: string | null;
      }>(
        `select s.id, s.scheduled_date, s.scheduled_time, s.location,
                m.client_id, c.slug as client_slug, c.name as client_name, c.color as client_color
           from shoots s
           join months m on m.id = s.month_id
           left join clients c on c.id = m.client_id
          where s.scheduled_date between $1 and $2`,
        [start, end]
      );
      for (const r of rows) {
        events.push({
          id: `shoot-${r.id}`,
          source: 'shoot',
          date: r.scheduled_date,
          time: r.scheduled_time,
          title: 'Shoot',
          client_id: r.client_id,
          client_slug: r.client_slug,
          client_name: r.client_name,
          client_color: r.client_color,
          detail: r.location,
          href: null,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Posts (public)
  await safe(
    (async () => {
      const rows = await q<{
        id: string;
        post_date: string;
        platform: string | null;
        content_type: string | null;
        description: string | null;
        status: string;
        client_id: string | null;
        client_slug: string | null;
        client_name: string | null;
        client_color: string | null;
      }>(
        `select p.id, p.post_date, p.platform, p.content_type::text as content_type,
                p.description, p.status::text as status,
                m.client_id, c.slug as client_slug, c.name as client_name, c.color as client_color
           from posts p
           join months m on m.id = p.month_id
           left join clients c on c.id = m.client_id
          where p.post_date between $1 and $2`,
        [start, end]
      );
      for (const r of rows) {
        const label = [r.platform, r.content_type].filter(Boolean).join(' · ') || 'Post';
        events.push({
          id: `post-${r.id}`,
          source: 'post',
          date: r.post_date,
          time: null,
          title: label,
          client_id: r.client_id,
          client_slug: r.client_slug,
          client_name: r.client_name,
          client_color: r.client_color,
          detail: r.description ? r.description.slice(0, 80) : r.status,
          href: null,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Project ship dates (command)
  await safe(
    (async () => {
      const rows = await q<{
        id: string;
        slug: string;
        name: string;
        target_ship_date: string;
        client_id: string | null;
        client_slug: string | null;
        client_name: string | null;
        client_color: string | null;
      }>(
        `select p.id, p.slug, p.name, p.target_ship_date,
                p.client_id, c.slug as client_slug, c.name as client_name, c.color as client_color
           from command.projects p
           left join clients c on c.id = p.client_id
          where p.target_ship_date between $1 and $2`,
        [start, end]
      );
      for (const r of rows) {
        events.push({
          id: `proj-${r.id}`,
          source: 'project_ship',
          date: r.target_ship_date,
          time: null,
          title: `Ship · ${r.name}`,
          client_id: r.client_id,
          client_slug: r.client_slug,
          client_name: r.client_name,
          client_color: r.client_color,
          detail: null,
          href: `/projects/${r.slug}`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Holidays (public)
  await safe(
    (async () => {
      const rows = await q<{
        id: string;
        date_label: string;
        event: string;
        client_specific_client_id: string | null;
      }>(
        `select id, date_label, event, client_specific_client_id
           from holidays
          where is_recurring = true
             or (date_label between $1 and $2)`,
        [start, end]
      );
      for (const r of rows) {
        // date_label is text (e.g. "2024-12-25" or "Mon"); only include if it parses to a date in range.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date_label)) continue;
        if (r.date_label < start || r.date_label > end) continue;
        events.push({
          id: `hol-${r.id}`,
          source: 'holiday',
          date: r.date_label,
          time: null,
          title: r.event,
          client_id: r.client_specific_client_id,
          client_slug: null,
          client_name: null,
          client_color: null,
          detail: null,
          href: null,
        });
      }
    })(),
    undefined as unknown as void
  );

  return events.sort((a, b) =>
    a.date === b.date ? (a.time ?? '').localeCompare(b.time ?? '') : a.date.localeCompare(b.date)
  );
}

// ─── Per-person plate ──────────────────────────────────────────────────────

export async function getPersonPlate(personId: string): Promise<PersonPlate | null> {
  const person = await getPerson(personId);
  if (!person) return null;

  const [openTasks, allMine, todayShoots] = await Promise.all([
    listTasks({ assigned_person_id: personId, open_only: true, limit: 200 }),
    listTasks({ assigned_person_id: personId, limit: 500 }),
    safe(
      (async () => {
        return q<{
          id: string;
          client_id: string | null;
          client_name: string | null;
          location: string | null;
          scheduled_time: string | null;
        }>(
          `select s.id, m.client_id, c.name as client_name, s.location, s.scheduled_time
             from shoots s
             join months m on m.id = s.month_id
             left join clients c on c.id = m.client_id
             left join people p on p.name = s.assigned_to
            where s.scheduled_date = current_date
              and (p.id = $1 or s.assigned_to ilike (select name from people where id = $1))`,
          [personId]
        );
      })(),
      []
    ),
  ]);

  // Count shoots in next 14d for this person (by name match — schema has assigned_to text).
  const shoots14 = await safe(
    (async () => {
      const r = await qOne<{ n: number }>(
        `select count(*)::int as n
           from shoots s
           join people p on p.name = s.assigned_to
          where p.id = $1
            and s.scheduled_date between current_date and current_date + 14`,
        [personId]
      );
      return r?.n ?? 0;
    })(),
    0
  );

  const inProgress = openTasks.filter(t => t.status === 'in_progress').length;
  const blocked = openTasks.filter(t => t.status === 'blocked').length;
  const activeProjects = await safe(
    (async () => {
      const r = await qOne<{ n: number }>(
        `select count(*)::int as n
           from command.projects
          where assigned_person_id = $1
            and state::text in ('active','idea')`,
        [personId]
      );
      return r?.n ?? 0;
    })(),
    0
  );

  // Top tasks: priority, then due, then in_progress weight.
  const top = openTasks.slice(0, 3);

  void allMine;

  return {
    person,
    open_task_count: openTasks.length,
    in_progress_count: inProgress,
    blocked_count: blocked,
    shoots_next_14d: shoots14,
    active_project_count: activeProjects,
    top_tasks: top,
    shoots_today: todayShoots,
  };
}

// ─── Cross-cutting queues ──────────────────────────────────────────────────

export async function getTodayQueue(): Promise<Task[]> {
  return safe(
    (async (): Promise<Task[]> => {
      return q<Task>(
        `select t.id, t.project_id, p.name as project_name, p.slug as project_slug,
                t.title, t.notes,
                t.status::text as status, t.priority::text as priority,
                t.due_date, t.done_at, t.sort_index,
                t.assigned_person_id, pe.name as assigned_person_name,
                t.client_id, t.client_slug, c.name as client_name,
                coalesce(t.origin::text, 'manual') as origin,
                t.signal_key, t.artifact_url, t.artifact_kind, t.artifact_id,
                t.auto_close_rule,
                t.created_at, t.updated_at
           from command.tasks t
           left join command.projects p on p.id = t.project_id
           left join people pe on pe.id = t.assigned_person_id
           left join clients c on c.id = t.client_id
          where t.status::text not in ('done','cancelled')
            and (t.due_date is null or t.due_date <= current_date + 1
                 or t.priority::text in ('p0','p1'))
          order by case t.priority::text
                     when 'p0' then 0 when 'p1' then 1
                     when 'p2' then 2 when 'p3' then 3 else 4 end,
                   t.due_date nulls last,
                   t.updated_at desc
          limit 50`
      );
    })(),
    []
  );
}

export async function getApprovalsQueue(): Promise<ApprovalQueueItem[]> {
  const rows = await listApprovals('pending');
  const now = Date.now();
  return rows.map(a => ({
    ...a,
    waiting_hours: Math.max(0, Math.floor((now - new Date(a.requested_at).getTime()) / 3_600_000)),
  }));
}

export async function getAgencyObjectives(): Promise<AgencyObjective[]> {
  return safe(
    (async (): Promise<AgencyObjective[]> => {
      const rows = await q<{
        project: Project;
        open_task_count: number;
        days_until_ship: number | null;
      } & Project & { open_task_count: number; days_until_ship: number | null }>(
        `select p.id, p.name, p.slug, p.state::text as state, p.kind::text as kind,
                p.summary, p.current_focus, p.owner,
                p.client_id, p.client_slug, c.name as client_name,
                p.service_line, p.department_id,
                d.key as department_key, d.name as department_name,
                p.assigned_person_id, pe.name as assigned_person_name,
                p.priority::text as priority,
                p.target_ship_date, p.github_repo, p.local_path,
                p.vercel_project_id, p.archived_at, p.created_at, p.updated_at,
                coalesce((select count(*) from command.tasks t
                          where t.project_id = p.id
                            and t.status not in ('done','cancelled'))::int, 0) as open_task_count,
                case when p.target_ship_date is null then null
                     else (p.target_ship_date - current_date)::int end as days_until_ship
           from command.projects p
           left join clients c on c.id = p.client_id
           left join command.departments d on d.id = p.department_id
           left join people pe on pe.id = p.assigned_person_id
          where p.state::text in ('active','idea')
            and p.target_ship_date is not null
            and p.target_ship_date between current_date and current_date + 30
          order by p.target_ship_date asc
          limit 5`
      );
      return rows.map(r => {
        const { open_task_count, days_until_ship, ...rest } = r;
        return {
          project: rest as Project,
          open_task_count: Number(open_task_count),
          days_until_ship: days_until_ship === null ? null : Number(days_until_ship),
        };
      });
    })(),
    []
  );
}

// ─── Per-client snapshot helpers ───────────────────────────────────────────

export interface ClientSnapshot {
  posts_this_month: number;
  shoots_this_month: number;
  brand_brief: { version: number | null; updated_at: string | null } | null;
  recent_insights: Array<{ id: string; body_md: string; generated_at: string }>;
}

export async function getClientSnapshot(clientId: string): Promise<ClientSnapshot> {
  return safe(
    (async (): Promise<ClientSnapshot> => {
      const counts = await safe(
        qOne<{ posts_this_month: number; shoots_this_month: number }>(
          `with this_month as (
             select id from months
              where client_id = $1
                and date_trunc('month', month) = date_trunc('month', current_date)
           )
           select
             (select count(*) from posts where month_id in (select id from this_month))::int as posts_this_month,
             (select count(*) from shoots where month_id in (select id from this_month))::int as shoots_this_month`,
          [clientId]
        ),
        null
      );
      const brief = await safe(
        qOne<{ version: number | null; updated_at: string | null }>(
          `select version::int as version, updated_at::text as updated_at
             from voice.brand_briefs
            where client_id = $1
            order by version desc nulls last, updated_at desc
            limit 1`,
          [clientId]
        ),
        null
      );
      const insights = await safe(
        q<{ id: string; body_md: string; generated_at: string }>(
          `select id, body_md, generated_at::text as generated_at
             from analytics.insights
            where client_id = $1
              and dismissed_at is null
            order by generated_at desc
            limit 3`,
          [clientId]
        ),
        []
      );
      return {
        posts_this_month: counts?.posts_this_month ?? 0,
        shoots_this_month: counts?.shoots_this_month ?? 0,
        brand_brief: brief,
        recent_insights: insights,
      };
    })(),
    {
      posts_this_month: 0,
      shoots_this_month: 0,
      brand_brief: null,
      recent_insights: [],
    }
  );
}

// ─── Per-person workload (for /people index) ───────────────────────────────

export interface PeopleRosterRow {
  person: Person;
  open_tasks: number;
  shoots_next_14d: number;
  active_projects: number;
}

export async function getPeopleRoster(): Promise<PeopleRosterRow[]> {
  const people = await listPeople();
  if (people.length === 0) return [];
  return Promise.all(
    people.map(async person => {
      const openTasks = await safe(
        (async () => {
          const r = await qOne<{ n: number }>(
            `select count(*)::int as n
               from command.tasks
              where assigned_person_id = $1
                and status::text not in ('done','cancelled')`,
            [person.id]
          );
          return r?.n ?? 0;
        })(),
        0
      );
      const shoots14 = await safe(
        (async () => {
          const r = await qOne<{ n: number }>(
            `select count(*)::int as n
               from shoots s
               join people p on p.name = s.assigned_to
              where p.id = $1
                and s.scheduled_date between current_date and current_date + 14`,
            [person.id]
          );
          return r?.n ?? 0;
        })(),
        0
      );
      const activeProjects = await safe(
        (async () => {
          const r = await qOne<{ n: number }>(
            `select count(*)::int as n
               from command.projects
              where assigned_person_id = $1
                and state::text in ('active','idea')`,
            [person.id]
          );
          return r?.n ?? 0;
        })(),
        0
      );
      return {
        person,
        open_tasks: openTasks,
        shoots_next_14d: shoots14,
        active_projects: activeProjects,
      };
    })
  );
}

// ─── "What shipped today / yesterday" ──────────────────────────────────────

export interface ShipmentRow {
  source: string;
  count: number;
  detail: string;
}

export async function getRecentShipments(): Promise<ShipmentRow[]> {
  const out: ShipmentRow[] = [];
  await safe(
    (async () => {
      const r = await qOne<{ posts_done: number }>(
        `select count(*)::int as posts_done
           from posts
          where status::text = 'posted'
            and updated_at >= now() - interval '36 hours'`
      );
      if (r && r.posts_done > 0) {
        out.push({ source: 'posts', count: r.posts_done, detail: `${r.posts_done} post${r.posts_done === 1 ? '' : 's'} went live` });
      }
    })(),
    undefined as unknown as void
  );
  await safe(
    (async () => {
      const r = await qOne<{ tasks_done: number }>(
        `select count(*)::int as tasks_done
           from command.tasks
          where status::text = 'done'
            and done_at >= now() - interval '36 hours'`
      );
      if (r && r.tasks_done > 0) {
        out.push({ source: 'tasks', count: r.tasks_done, detail: `${r.tasks_done} task${r.tasks_done === 1 ? '' : 's'} closed` });
      }
    })(),
    undefined as unknown as void
  );
  await safe(
    (async () => {
      const r = await qOne<{ deploys: number }>(
        `select count(*)::int as deploys
           from dev.deployments
          where lower(coalesce(state, '')) = 'ready'
            and deployed_at >= now() - interval '36 hours'`
      );
      if (r && r.deploys > 0) {
        out.push({ source: 'deploys', count: r.deploys, detail: `${r.deploys} deploy${r.deploys === 1 ? '' : 's'} succeeded` });
      }
    })(),
    undefined as unknown as void
  );
  return out;
}

// ─── Project + linked dev data (for internal_build kind) ───────────────────

export interface ProjectDevLinks {
  latest_deployment: {
    state: string | null;
    url: string | null;
    deployed_at: string | null;
  } | null;
  latest_repo: {
    last_commit_at: string | null;
    last_commit_message: string | null;
    open_pr_count: number | null;
  } | null;
}

export async function getProjectDevLinks(projectId: string): Promise<ProjectDevLinks> {
  return safe(
    (async (): Promise<ProjectDevLinks> => {
      const dep = await qOne<{ state: string | null; url: string | null; deployed_at: string | null }>(
        `select state, url, deployed_at
           from dev.deployments
          where project_id = $1
          order by observed_at desc
          limit 1`,
        [projectId]
      );
      const repo = await qOne<{ last_commit_at: string | null; last_commit_message: string | null; open_pr_count: number | null }>(
        `select last_commit_at, last_commit_message, open_pr_count
           from dev.repo_activity
          where project_id = $1
          order by observed_at desc
          limit 1`,
        [projectId]
      );
      return { latest_deployment: dep, latest_repo: repo };
    })(),
    { latest_deployment: null, latest_repo: null }
  );
}
