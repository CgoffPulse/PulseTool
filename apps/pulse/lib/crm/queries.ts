import 'server-only';
import { q, qOne } from '../db';
import type {
  Event,
  LeadStage,
  LeadWithMeta,
  LostReason,
  Person,
  PipelineStats,
  Source,
  Touch,
} from './types';

// ─── Sources / Lost reasons ────────────────────────────────────────────────

export async function listSources(): Promise<Source[]> {
  return q<Source>(
    `select id, slug, label, sort_index, archived
       from crm.sources
      where archived = false
      order by sort_index, label`
  );
}

export async function listLostReasons(): Promise<LostReason[]> {
  return q<LostReason>(
    `select id, slug, label, sort_index, archived
       from crm.lost_reasons
      where archived = false
      order by sort_index, label`
  );
}

export async function listAllSources(): Promise<Source[]> {
  return q<Source>(
    `select id, slug, label, sort_index, archived
       from crm.sources
      order by archived, sort_index, label`
  );
}

export async function listAllLostReasons(): Promise<LostReason[]> {
  return q<LostReason>(
    `select id, slug, label, sort_index, archived
       from crm.lost_reasons
      order by archived, sort_index, label`
  );
}

// ─── People (cross-tool, lives in social schema) ───────────────────────────

export async function listPeople(): Promise<Person[]> {
  try {
    return await q<Person>(
      `select id, name, role::text as role, color
         from people
        where archived = false
        order by name`
    );
  } catch {
    return [];
  }
}

// ─── Leads ─────────────────────────────────────────────────────────────────

const LEAD_WITH_META_SELECT = `
  select
    l.id, l.name, l.company, l.email, l.phone,
    l.stage::text as stage,
    l.source_id, l.lost_reason_id,
    l.value_cents, l.expected_close_date,
    l.owner_person_id, l.client_id, l.notes, l.archived,
    l.created_at, l.updated_at,
    s.label as source_label, s.slug as source_slug,
    last_touch.happened_at as last_touch_at,
    next_followup.follow_up_at as next_followup_at,
    p.name as owner_name
  from crm.leads l
  left join crm.sources s on s.id = l.source_id
  left join lateral (
    select happened_at from crm.touches t
    where t.lead_id = l.id
    order by t.happened_at desc
    limit 1
  ) last_touch on true
  left join lateral (
    select follow_up_at from crm.touches t
    where t.lead_id = l.id and t.follow_up_at is not null
    order by t.follow_up_at asc
    limit 1
  ) next_followup on true
  left join people p on p.id = l.owner_person_id
`;

export async function listLeads(): Promise<LeadWithMeta[]> {
  return q<LeadWithMeta>(
    `${LEAD_WITH_META_SELECT}
     where l.archived = false
     order by
       case l.stage::text
         when 'new' then 1
         when 'qualified' then 2
         when 'proposal' then 3
         when 'negotiation' then 4
         when 'won' then 5
         when 'lost' then 6
         else 9
       end,
       l.updated_at desc`
  );
}

export async function getLead(id: string): Promise<LeadWithMeta | null> {
  return qOne<LeadWithMeta>(
    `${LEAD_WITH_META_SELECT}
     where l.id = $1`,
    [id]
  );
}

export async function listTouches(leadId: string): Promise<Touch[]> {
  return q<Touch>(
    `select id, lead_id,
            kind::text as kind,
            happened_at, summary, person_id, follow_up_at, created_at
       from crm.touches
      where lead_id = $1
      order by happened_at desc`,
    [leadId]
  );
}

export async function listEvents(leadId: string): Promise<Event[]> {
  return q<Event>(
    `select id, lead_id,
            from_stage::text as from_stage,
            to_stage::text as to_stage,
            at, by_person_id, note
       from crm.events
      where lead_id = $1
      order by at desc`,
    [leadId]
  );
}

// ─── Pipeline stats ────────────────────────────────────────────────────────

export async function getPipelineStats(): Promise<PipelineStats> {
  const row = await qOne<{
    this_month_new: number;
    this_month_won: number;
    this_month_lost: number;
    pipeline_value_cents: string;
    won_value_cents_mtd: string;
    active_leads: number;
    stalled_count: number;
  }>(
    `with month_start as (select date_trunc('month', now())::date as d),
         active as (
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
         )
     select
       (select count(*) from crm.leads
          where archived = false and created_at >= (select d from month_start))::int as this_month_new,
       (select count(*) from crm.events
          where to_stage = 'won' and at >= (select d from month_start))::int as this_month_won,
       (select count(*) from crm.events
          where to_stage = 'lost' and at >= (select d from month_start))::int as this_month_lost,
       (select coalesce(sum(value_cents), 0) from active)::text as pipeline_value_cents,
       (select coalesce(sum(l.value_cents), 0)
          from crm.leads l
         where l.stage = 'won'
           and l.updated_at >= (select d from month_start))::text as won_value_cents_mtd,
       (select count(*) from active)::int as active_leads,
       (select count(*) from stalled)::int as stalled_count`
  );
  return {
    this_month_new: row?.this_month_new ?? 0,
    this_month_won: row?.this_month_won ?? 0,
    this_month_lost: row?.this_month_lost ?? 0,
    pipeline_value_cents: row ? Number(row.pipeline_value_cents) : 0,
    won_value_cents_mtd: row ? Number(row.won_value_cents_mtd) : 0,
    active_leads: row?.active_leads ?? 0,
    stalled_count: row?.stalled_count ?? 0,
  };
}

export async function listStalledLeads(thresholdDays = 7): Promise<LeadWithMeta[]> {
  return q<LeadWithMeta>(
    `${LEAD_WITH_META_SELECT}
     where l.archived = false
       and l.stage in ('new','qualified','proposal','negotiation')
       and coalesce(last_touch.happened_at, l.created_at) < now() - ($1 || ' days')::interval
     order by coalesce(last_touch.happened_at, l.created_at) asc
     limit 50`,
    [thresholdDays]
  );
}

export async function listFollowupsDueToday(): Promise<LeadWithMeta[]> {
  return q<LeadWithMeta>(
    `${LEAD_WITH_META_SELECT}
     where l.archived = false
       and next_followup.follow_up_at is not null
       and next_followup.follow_up_at <= now() + interval '1 day'
     order by next_followup.follow_up_at asc
     limit 100`
  );
}

// ─── Reports ───────────────────────────────────────────────────────────────

export interface FunnelRow {
  stage: LeadStage;
  count: number;
  value_cents: number;
}

export async function getFunnel(): Promise<FunnelRow[]> {
  const rows = await q<{ stage: string; count: number; value_cents: string }>(
    `select stage::text as stage,
            count(*)::int as count,
            coalesce(sum(value_cents), 0)::text as value_cents
       from crm.leads
      where archived = false
      group by stage`
  );
  return rows.map(r => ({
    stage: r.stage as LeadStage,
    count: r.count,
    value_cents: Number(r.value_cents),
  }));
}

export interface SourceReportRow {
  source_id: string | null;
  source_label: string | null;
  total: number;
  won: number;
  lost: number;
  win_rate: number;
  avg_days_to_close: number | null;
}

export async function getSourceReport(): Promise<SourceReportRow[]> {
  const rows = await q<{
    source_id: string | null;
    source_label: string | null;
    total: number;
    won: number;
    lost: number;
    avg_days_to_close: number | null;
  }>(
    `with closed as (
       select l.id, l.source_id, l.created_at,
              e.to_stage::text as outcome, e.at as closed_at
         from crm.leads l
         join lateral (
           select to_stage, at from crm.events
            where lead_id = l.id and to_stage in ('won','lost')
            order by at desc limit 1
         ) e on true
        where l.archived = false
     )
     select l.source_id,
            s.label as source_label,
            count(*)::int as total,
            sum(case when l.stage = 'won' then 1 else 0 end)::int as won,
            sum(case when l.stage = 'lost' then 1 else 0 end)::int as lost,
            avg(extract(epoch from (c.closed_at - c.created_at)) / 86400)::float as avg_days_to_close
       from crm.leads l
       left join crm.sources s on s.id = l.source_id
       left join closed c on c.id = l.id
      where l.archived = false
      group by l.source_id, s.label
      order by total desc`
  );
  return rows.map(r => ({
    source_id: r.source_id,
    source_label: r.source_label,
    total: r.total,
    won: r.won,
    lost: r.lost,
    win_rate: r.total > 0 ? r.won / r.total : 0,
    avg_days_to_close: r.avg_days_to_close ?? null,
  }));
}

export interface LostReasonReportRow {
  reason_id: string | null;
  reason_label: string | null;
  count: number;
}

export async function getLostReasonReport(): Promise<LostReasonReportRow[]> {
  return q<LostReasonReportRow>(
    `select l.lost_reason_id as reason_id,
            r.label as reason_label,
            count(*)::int as count
       from crm.leads l
       left join crm.lost_reasons r on r.id = l.lost_reason_id
      where l.archived = false and l.stage = 'lost'
      group by l.lost_reason_id, r.label
      order by count desc`
  );
}
