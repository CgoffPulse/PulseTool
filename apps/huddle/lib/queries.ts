import 'server-only';
import { q, qOne } from './db';

// Re-export the Pulse Command queries so callers have a single import surface.
export {
  getTodayQueue,
  getApprovalsQueue,
  getAgencyObjectives,
  getPersonPlate,
  getPeopleRoster,
  getRecentShipments,
  getCalendarMonth,
  getClient,
  getClientSnapshot,
  getProject,
  getProjectDevLinks,
  getApproval,
  getDepartment,
  getPerson,
  listApprovals,
  listClients,
  listDepartments,
  listPeople,
  listProjects,
  listTasks,
  getTask,
} from './command-queries';

/**
 * The Huddle reads from every schema in the suite. Every cross-schema query
 * is wrapped so that one tool being down (or its schema not yet migrated)
 * doesn't break the whole dashboard.
 */
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (err) {
    console.warn('[huddle] cross-schema query failed:', (err as Error).message);
    return fallback;
  }
}

/** pg returns `timestamptz` columns as JS Date objects; downstream code expects
 * ISO strings (so they survive serialization to client components). */
function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date(v as string).toISOString();
}

// ─── Money lane (CRM) ──────────────────────────────────────────────────────

export interface MoneyLane {
  new_this_week: number;
  in_pipeline_cents: number;
  won_mtd_cents: number;
  follow_ups_today: number;
  stalled_count: number;
  hot_leads: Array<{ id: string; name: string; company: string | null; value_cents: number | null; stage: string }>;
}

export async function getMoneyLane(): Promise<MoneyLane> {
  return safe(
    (async (): Promise<MoneyLane> => {
      const stats = await qOne<{
        new_this_week: number;
        in_pipeline_cents: string;
        won_mtd_cents: string;
        follow_ups_today: number;
        stalled_count: number;
      }>(
        `with active as (
           select * from crm.leads
            where archived = false
              and stage in ('new','qualified','proposal','negotiation')
         ),
         stalled as (
           select l.id from active l
             left join lateral (
               select max(happened_at) as last_at from crm.touches t where t.lead_id = l.id
             ) lt on true
            where coalesce(lt.last_at, l.created_at) < now() - interval '7 days'
         ),
         followups as (
           select distinct l.id from active l
             join crm.touches t on t.lead_id = l.id
            where t.follow_up_at is not null and t.follow_up_at <= now() + interval '1 day'
         )
         select
           (select count(*) from crm.leads
              where archived = false and created_at >= now() - interval '7 days')::int as new_this_week,
           (select coalesce(sum(value_cents), 0) from active)::text as in_pipeline_cents,
           (select coalesce(sum(value_cents), 0) from crm.leads
              where stage = 'won' and updated_at >= date_trunc('month', now()))::text as won_mtd_cents,
           (select count(*) from followups)::int as follow_ups_today,
           (select count(*) from stalled)::int as stalled_count`
      );
      const hot = await q<{ id: string; name: string; company: string | null; value_cents: number | null; stage: string }>(
        `select l.id, l.name, l.company, l.value_cents, l.stage::text as stage
           from crm.leads l
          where l.archived = false
            and l.stage in ('proposal','negotiation')
          order by coalesce(l.value_cents, 0) desc, l.updated_at desc
          limit 5`
      );
      return {
        new_this_week: stats?.new_this_week ?? 0,
        in_pipeline_cents: Number(stats?.in_pipeline_cents ?? 0),
        won_mtd_cents: Number(stats?.won_mtd_cents ?? 0),
        follow_ups_today: stats?.follow_ups_today ?? 0,
        stalled_count: stats?.stalled_count ?? 0,
        hot_leads: hot,
      };
    })(),
    {
      new_this_week: 0,
      in_pipeline_cents: 0,
      won_mtd_cents: 0,
      follow_ups_today: 0,
      stalled_count: 0,
      hot_leads: [],
    }
  );
}

// ─── Content lane (social schema) ──────────────────────────────────────────

export interface ContentLane {
  unbundled_posts: number;
  shoots_next_7d: number;
  posts_due_7d: number;
  open_notifications: number;
  notifications: Array<{ id: string; title: string; severity: string; link_url: string | null; created_at: string }>;
}

export async function getContentLane(): Promise<ContentLane> {
  return safe(
    (async (): Promise<ContentLane> => {
      const stats = await qOne<{
        unbundled_posts: number;
        shoots_next_7d: number;
        posts_due_7d: number;
        open_notifications: number;
      }>(
        `select
           (select count(*) from posts
              where shoot_id is null
                and status not in ('posted'))::int as unbundled_posts,
           (select count(*) from shoots
              where scheduled_date between current_date and current_date + 7)::int as shoots_next_7d,
           (select count(*) from posts
              where status not in ('posted')
                and post_date between current_date and current_date + 7)::int as posts_due_7d,
           (select count(*) from notifications
              where resolved_at is null and dismissed_at is null)::int as open_notifications`
      );
      const notes = await q<{
        id: string;
        title: string;
        severity: string;
        link_url: string | null;
        created_at: string;
      }>(
        `select id, title,
                severity::text as severity,
                link_url,
                created_at
           from notifications
          where resolved_at is null and dismissed_at is null
          order by case severity::text when 'bad' then 1 when 'warn' then 2 else 3 end,
                   created_at desc
          limit 8`
      );
      return {
        unbundled_posts: stats?.unbundled_posts ?? 0,
        shoots_next_7d: stats?.shoots_next_7d ?? 0,
        posts_due_7d: stats?.posts_due_7d ?? 0,
        open_notifications: stats?.open_notifications ?? 0,
        notifications: notes,
      };
    })(),
    {
      unbundled_posts: 0,
      shoots_next_7d: 0,
      posts_due_7d: 0,
      open_notifications: 0,
      notifications: [],
    }
  );
}

// ─── Code lane (dev schema) ────────────────────────────────────────────────
// dev.tasks status enum: backlog/next/in_progress/blocked/done/cancelled
// priority enum:         p0/p1/p2/p3
// dev.deployments holds vercel deploy state; dev.fs_snapshots holds is_dirty
// (one row per observation; we read latest per project).

export interface CodeLane {
  dirty_repos: number;
  failing_deploys_24h: number;
  open_tasks: number;
  urgent_tasks: Array<{ id: string; title: string; project_name: string | null; priority: string }>;
}

export async function getCodeLane(): Promise<CodeLane> {
  return safe(
    (async (): Promise<CodeLane> => {
      const stats = await qOne<{
        dirty_repos: number;
        failing_deploys_24h: number;
        open_tasks: number;
      }>(
        `with latest_fs as (
           select distinct on (project_id) project_id, is_dirty
             from dev.fs_snapshots
            order by project_id, observed_at desc
         ),
         recent_deploys as (
           select * from dev.deployments
            where deployed_at >= now() - interval '24 hours'
               or observed_at >= now() - interval '24 hours'
         )
         select
           (select count(*) from latest_fs where is_dirty = true)::int as dirty_repos,
           (select count(*) from recent_deploys
              where lower(coalesce(state, '')) in ('error','canceled','cancelled'))::int as failing_deploys_24h,
           (select count(*) from dev.tasks
              where status in ('backlog','next','in_progress','blocked'))::int as open_tasks`
      );
      const tasks = await q<{
        id: string;
        title: string;
        project_name: string | null;
        priority: string;
      }>(
        `select t.id, t.title, p.name as project_name, t.priority::text as priority
           from dev.tasks t
           left join dev.projects p on p.id = t.project_id
          where t.status in ('next','in_progress','blocked')
            and t.priority in ('p0','p1')
          order by case t.priority::text when 'p0' then 1 when 'p1' then 2 else 3 end,
                   t.created_at desc
          limit 6`
      );
      return {
        dirty_repos: stats?.dirty_repos ?? 0,
        failing_deploys_24h: stats?.failing_deploys_24h ?? 0,
        open_tasks: stats?.open_tasks ?? 0,
        urgent_tasks: tasks,
      };
    })(),
    {
      dirty_repos: 0,
      failing_deploys_24h: 0,
      open_tasks: 0,
      urgent_tasks: [],
    }
  );
}

// ─── Brand lane (voice schema) ─────────────────────────────────────────────

export interface BrandLane {
  runs_7d: number;
  cost_cents_7d: number;
  briefs_total: number;
  stale_brief_clients: number;
  recent_runs: Array<{
    id: string;
    calling_app: string;
    template_slug: string | null;
    template_name: string | null;
    model: string | null;
    cost_cents: number | null;
    status: string;
    created_at: string;
  }>;
}

export async function getBrandLane(): Promise<BrandLane> {
  return safe(
    (async (): Promise<BrandLane> => {
      const stats = await qOne<{
        runs_7d: number;
        cost_cents_7d: string;
        briefs_total: number;
        stale_brief_clients: number;
      }>(
        `with latest_brief_per_client as (
           select client_id, max(updated_at) as last_updated
             from voice.brand_briefs
            where client_id is not null
            group by client_id
         )
         select
           (select count(*) from voice.runs
              where created_at >= now() - interval '7 days')::int as runs_7d,
           (select coalesce(sum(cost_cents), 0) from voice.runs
              where created_at >= now() - interval '7 days')::text as cost_cents_7d,
           (select count(distinct client_id) from voice.brand_briefs
              where client_id is not null)::int as briefs_total,
           (select count(*) from latest_brief_per_client
              where last_updated < now() - interval '30 days')::int as stale_brief_clients`
      );
      const runs = await q<{
        id: string;
        calling_app: string;
        template_slug: string | null;
        template_name: string | null;
        model: string | null;
        cost_cents: number | null;
        status: string;
        created_at: string;
      }>(
        `select r.id, r.calling_app, r.prompt_slug as template_slug,
                t.name as template_name,
                r.model, r.cost_cents, r.status, r.created_at
           from voice.runs r
           left join voice.prompt_templates t on t.id = r.prompt_template_id
          order by r.created_at desc
          limit 6`
      );
      return {
        runs_7d: stats?.runs_7d ?? 0,
        cost_cents_7d: Number(stats?.cost_cents_7d ?? 0),
        briefs_total: stats?.briefs_total ?? 0,
        stale_brief_clients: stats?.stale_brief_clients ?? 0,
        recent_runs: runs,
      };
    })(),
    {
      runs_7d: 0,
      cost_cents_7d: 0,
      briefs_total: 0,
      stale_brief_clients: 0,
      recent_runs: [],
    }
  );
}

// ─── People lane (capacity heuristic) ──────────────────────────────────────
// Posts have owner_person_id; shoots have assigned_person_id; CRM has
// owner_person_id. Dev tasks don't have an owner column today, so we omit
// them from capacity.

export interface CapacityRow {
  person_id: string;
  name: string;
  color: string;
  open_leads: number;
  open_shoots: number;
  open_posts: number;
  total: number;
}

export async function getCapacityLane(): Promise<CapacityRow[]> {
  return safe(
    (async (): Promise<CapacityRow[]> => {
      return q<CapacityRow>(
        `with leads as (
           select owner_person_id as person_id, count(*)::int as n
             from crm.leads
            where archived = false
              and stage in ('new','qualified','proposal','negotiation')
              and owner_person_id is not null
            group by owner_person_id
         ),
         post_owners as (
           select owner_person_id as person_id, count(*)::int as n
             from posts
            where status not in ('posted')
              and owner_person_id is not null
            group by owner_person_id
         ),
         shoot_owners as (
           select assigned_person_id as person_id, count(*)::int as n
             from shoots
            where assigned_person_id is not null
              and (scheduled_date is null or scheduled_date >= current_date - 7)
            group by assigned_person_id
         )
         select p.id as person_id, p.name, p.color,
                coalesce(l.n, 0) as open_leads,
                coalesce(s.n, 0) as open_shoots,
                coalesce(po.n, 0) as open_posts,
                (coalesce(l.n,0) + coalesce(s.n,0) + coalesce(po.n,0))::int as total
           from people p
           left join leads l on l.person_id = p.id
           left join post_owners po on po.person_id = p.id
           left join shoot_owners s on s.person_id = p.id
          where p.archived = false
          order by total desc, p.name`
      );
    })(),
    []
  );
}

// ─── Performance lane (analytics schema) ───────────────────────────────────

export interface PerformanceLane {
  insights_7d: number;
  recommendations_open: number;
  posts_ingested_7d: number;
  recent_insight: { client_id: string; client_name: string | null; body_md: string; generated_at: string } | null;
}

export async function getPerformanceLane(): Promise<PerformanceLane> {
  return safe(
    (async (): Promise<PerformanceLane> => {
      const stats = await qOne<{
        insights_7d: number;
        recommendations_open: number;
        posts_ingested_7d: number;
      }>(
        `select
           (select count(*) from analytics.insights
              where generated_at >= now() - interval '7 days')::int as insights_7d,
           (select count(*) from analytics.recommendations
              where status = 'proposed')::int as recommendations_open,
           (select count(*) from analytics.posts_external
              where posted_at >= now() - interval '7 days')::int as posts_ingested_7d`
      );
      const recent = await qOne<{
        client_id: string;
        client_name: string | null;
        body_md: string;
        generated_at: string;
      }>(
        `select i.client_id, c.name as client_name, i.body_md, i.generated_at
           from analytics.insights i
           left join clients c on c.id = i.client_id
          where i.dismissed_at is null
          order by i.generated_at desc
          limit 1`
      );
      return {
        insights_7d: stats?.insights_7d ?? 0,
        recommendations_open: stats?.recommendations_open ?? 0,
        posts_ingested_7d: stats?.posts_ingested_7d ?? 0,
        recent_insight: recent,
      };
    })(),
    {
      insights_7d: 0,
      recommendations_open: 0,
      posts_ingested_7d: 0,
      recent_insight: null,
    }
  );
}

// ─── Morning diff feed (since=) ────────────────────────────────────────────

export interface DiffEntry {
  source: 'crm' | 'social' | 'dev' | 'voice' | 'analytics';
  at: string;
  title: string;
  detail: string | null;
  link?: string | null;
}

export async function getMorningDiff(sinceISO: string): Promise<DiffEntry[]> {
  const since = new Date(sinceISO);
  if (Number.isNaN(since.getTime())) return [];

  const entries: DiffEntry[] = [];

  // CRM events
  await safe(
    (async () => {
      const rows = await q<{ at: string; lead_id: string; lead_name: string; from_stage: string | null; to_stage: string }>(
        `select e.at, e.lead_id, l.name as lead_name,
                e.from_stage::text as from_stage,
                e.to_stage::text as to_stage
           from crm.events e
           join crm.leads l on l.id = e.lead_id
          where e.at > $1
          order by e.at desc`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'crm',
          at: toIso(r.at),
          title: `${r.lead_name} · ${r.from_stage ?? '∅'} → ${r.to_stage}`,
          detail: null,
          link: `${process.env.NEXT_PUBLIC_CRM_URL ?? ''}/leads/${r.lead_id}`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // CRM touches
  await safe(
    (async () => {
      const rows = await q<{ at: string; lead_id: string; lead_name: string; kind: string; summary: string | null }>(
        `select t.happened_at as at, l.id as lead_id, l.name as lead_name,
                t.kind::text as kind, t.summary
           from crm.touches t
           join crm.leads l on l.id = t.lead_id
          where t.happened_at > $1
          order by t.happened_at desc`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'crm',
          at: toIso(r.at),
          title: `${r.lead_name} · ${r.kind}`,
          detail: r.summary,
          link: `${process.env.NEXT_PUBLIC_CRM_URL ?? ''}/leads/${r.lead_id}`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Social posts updated
  await safe(
    (async () => {
      const rows = await q<{ id: string; status: string; updated_at: string; description: string | null }>(
        `select id, status::text as status, updated_at, description
           from posts
          where updated_at > $1
          order by updated_at desc
          limit 50`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'social',
          at: toIso(r.updated_at),
          title: `Post · ${r.status}`,
          detail: r.description ? r.description.slice(0, 80) : null,
          link: `${process.env.NEXT_PUBLIC_SOCIAL_URL ?? ''}/`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Dev tasks updated
  await safe(
    (async () => {
      const rows = await q<{ id: string; title: string; status: string; updated_at: string }>(
        `select id, title, status::text as status, updated_at
           from dev.tasks
          where updated_at > $1
          order by updated_at desc
          limit 50`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'dev',
          at: toIso(r.updated_at),
          title: `Task · ${r.status}`,
          detail: r.title,
          link: `${process.env.NEXT_PUBLIC_DEV_URL ?? ''}/tasks`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Voice runs
  await safe(
    (async () => {
      const rows = await q<{
        id: string;
        calling_app: string;
        prompt_slug: string | null;
        cost_cents: number | null;
        status: string;
        created_at: string;
      }>(
        `select id, calling_app, prompt_slug, cost_cents, status, created_at
           from voice.runs
          where created_at > $1
          order by created_at desc
          limit 50`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'voice',
          at: toIso(r.created_at),
          title: `${r.calling_app} → ${r.prompt_slug ?? 'custom'}`,
          detail: r.status === 'stub' ? 'No API key — stubbed.' : `${(r.cost_cents ?? 0) / 100}¢`,
          link: `${process.env.NEXT_PUBLIC_VOICE_URL ?? ''}/runs/${r.id}`,
        });
      }
    })(),
    undefined as unknown as void
  );

  // Analytics insights + recommendations
  await safe(
    (async () => {
      const rows = await q<{ id: string; client_id: string; generated_at: string }>(
        `select id, client_id, generated_at
           from analytics.insights
          where generated_at > $1
          order by generated_at desc
          limit 20`,
        [since.toISOString()]
      );
      for (const r of rows) {
        entries.push({
          source: 'analytics',
          at: r.generated_at,
          title: `New insight generated`,
          detail: null,
          link: `${process.env.NEXT_PUBLIC_ANALYTICS_URL ?? ''}/`,
        });
      }
      const recs = await q<{ id: string; title: string; client_id: string; created_at: string }>(
        `select id, title, client_id, created_at
           from analytics.recommendations
          where created_at > $1
            and status = 'proposed'
          order by created_at desc
          limit 20`,
        [since.toISOString()]
      );
      for (const r of recs) {
        entries.push({
          source: 'analytics',
          at: toIso(r.created_at),
          title: `Recommendation: ${r.title}`,
          detail: null,
          link: `${process.env.NEXT_PUBLIC_ANALYTICS_URL ?? ''}/recommendations`,
        });
      }
    })(),
    undefined as unknown as void
  );

  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}
