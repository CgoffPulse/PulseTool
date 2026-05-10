import 'server-only';
import { q, qOne } from '../db';
import type {
  AccountMetricsDaily,
  AccountWithLatestMetrics,
  AgencyOverviewStats,
  Ga4MetricsDaily,
  Insight,
  Platform,
  PlatformAccount,
  PostExternal,
  PostMetric,
  PostTag,
  PostWithLatestMetrics,
  Recommendation,
  SavedChart,
} from './types';

// ─── Platform accounts ─────────────────────────────────────────────────────

export async function listAccountsForClient(clientId: string): Promise<PlatformAccount[]> {
  return q<PlatformAccount>(
    `select * from analytics.platform_accounts
      where client_id = $1
      order by platform, handle`,
    [clientId]
  );
}

export async function listAllConnectedAccounts(): Promise<PlatformAccount[]> {
  return q<PlatformAccount>(
    `select * from analytics.platform_accounts
      where status = 'connected'
      order by platform, handle`
  );
}

export async function listConnectedMetaAccounts(): Promise<PlatformAccount[]> {
  return q<PlatformAccount>(
    `select * from analytics.platform_accounts
      where status = 'connected'
        and platform in ('instagram','facebook')
      order by platform, handle`
  );
}

export async function listConnectedGa4Accounts(): Promise<PlatformAccount[]> {
  return q<PlatformAccount>(
    `select * from analytics.platform_accounts
      where status = 'connected'
        and platform = 'ga4'
      order by handle`
  );
}

export async function getAccountById(id: string): Promise<PlatformAccount | null> {
  return qOne<PlatformAccount>(`select * from analytics.platform_accounts where id = $1`, [id]);
}

export async function listAccountsWithLatestMetrics(
  clientId: string
): Promise<AccountWithLatestMetrics[]> {
  return q<AccountWithLatestMetrics>(
    `select a.*,
            m.followers as latest_followers,
            m.reach as latest_reach,
            m.date::text as latest_date
       from analytics.platform_accounts a
       left join lateral (
         select followers, reach, date
           from analytics.account_metrics_daily
          where account_id = a.id
          order by date desc
          limit 1
       ) m on true
      where a.client_id = $1
      order by a.platform, a.handle`,
    [clientId]
  );
}

export async function listAllAccounts(): Promise<PlatformAccount[]> {
  return q<PlatformAccount>(
    `select * from analytics.platform_accounts order by client_id, platform`
  );
}

export async function upsertPlatformAccount(input: {
  client_id: string;
  platform: Platform;
  handle?: string | null;
  external_id?: string | null;
  access_token_ref?: string | null;
  status?: 'pending' | 'connected' | 'error' | 'revoked';
}): Promise<PlatformAccount | null> {
  return qOne<PlatformAccount>(
    `insert into analytics.platform_accounts
       (client_id, platform, handle, external_id, access_token_ref, status)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (client_id, platform, external_id) do update set
       handle = excluded.handle,
       access_token_ref = excluded.access_token_ref,
       status = excluded.status,
       updated_at = now()
     returning *`,
    [
      input.client_id,
      input.platform,
      input.handle ?? null,
      input.external_id ?? null,
      input.access_token_ref ?? null,
      input.status ?? 'connected',
    ]
  );
}

// ─── Account-level daily metrics ───────────────────────────────────────────

export async function listAccountMetricsForRange(
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<AccountMetricsDaily[]> {
  return q<AccountMetricsDaily>(
    `select * from analytics.account_metrics_daily
      where account_id = $1
        and date between $2 and $3
      order by date asc`,
    [accountId, fromDate, toDate]
  );
}

export async function listAccountMetricsLastNDays(
  accountId: string,
  days: number
): Promise<AccountMetricsDaily[]> {
  return q<AccountMetricsDaily>(
    `select * from analytics.account_metrics_daily
      where account_id = $1
        and date >= (current_date - ($2 || ' days')::interval)
      order by date asc`,
    [accountId, days]
  );
}

export async function getOrCreateAccountMetrics(input: {
  account_id: string;
  date: string;
  followers?: number | null;
  reach?: number | null;
  impressions?: number | null;
  profile_visits?: number | null;
  website_clicks?: number | null;
  raw?: unknown;
}): Promise<AccountMetricsDaily | null> {
  return qOne<AccountMetricsDaily>(
    `insert into analytics.account_metrics_daily
       (account_id, date, followers, reach, impressions, profile_visits, website_clicks, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     on conflict (account_id, date) do update set
       followers = coalesce(excluded.followers, analytics.account_metrics_daily.followers),
       reach = coalesce(excluded.reach, analytics.account_metrics_daily.reach),
       impressions = coalesce(excluded.impressions, analytics.account_metrics_daily.impressions),
       profile_visits = coalesce(excluded.profile_visits, analytics.account_metrics_daily.profile_visits),
       website_clicks = coalesce(excluded.website_clicks, analytics.account_metrics_daily.website_clicks),
       raw = coalesce(excluded.raw, analytics.account_metrics_daily.raw)
     returning *`,
    [
      input.account_id,
      input.date,
      input.followers ?? null,
      input.reach ?? null,
      input.impressions ?? null,
      input.profile_visits ?? null,
      input.website_clicks ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ]
  );
}

// ─── GA4 daily metrics ─────────────────────────────────────────────────────

export async function listGa4MetricsForClient(
  clientId: string,
  days = 28
): Promise<Ga4MetricsDaily[]> {
  return q<Ga4MetricsDaily>(
    `select * from analytics.ga4_metrics_daily
      where client_id = $1
        and date >= (current_date - ($2 || ' days')::interval)
      order by date asc`,
    [clientId, days]
  );
}

export async function upsertGa4Daily(input: {
  client_id: string;
  date: string;
  sessions?: number | null;
  users?: number | null;
  conversions?: number | null;
  bounce_rate?: number | null;
  avg_session_seconds?: number | null;
  top_source_json?: unknown;
  raw?: unknown;
}): Promise<Ga4MetricsDaily | null> {
  return qOne<Ga4MetricsDaily>(
    `insert into analytics.ga4_metrics_daily
       (client_id, date, sessions, users, conversions, bounce_rate, avg_session_seconds, top_source_json, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
     on conflict (client_id, date) do update set
       sessions = coalesce(excluded.sessions, analytics.ga4_metrics_daily.sessions),
       users = coalesce(excluded.users, analytics.ga4_metrics_daily.users),
       conversions = coalesce(excluded.conversions, analytics.ga4_metrics_daily.conversions),
       bounce_rate = coalesce(excluded.bounce_rate, analytics.ga4_metrics_daily.bounce_rate),
       avg_session_seconds = coalesce(excluded.avg_session_seconds, analytics.ga4_metrics_daily.avg_session_seconds),
       top_source_json = coalesce(excluded.top_source_json, analytics.ga4_metrics_daily.top_source_json),
       raw = coalesce(excluded.raw, analytics.ga4_metrics_daily.raw)
     returning *`,
    [
      input.client_id,
      input.date,
      input.sessions ?? null,
      input.users ?? null,
      input.conversions ?? null,
      input.bounce_rate ?? null,
      input.avg_session_seconds ?? null,
      input.top_source_json ? JSON.stringify(input.top_source_json) : null,
      input.raw ? JSON.stringify(input.raw) : null,
    ]
  );
}

// ─── Posts external + metrics ──────────────────────────────────────────────

export async function upsertPostExternal(input: {
  account_id: string;
  platform_post_id: string;
  posted_at?: string | null;
  caption?: string | null;
  media_type?: string | null;
  permalink?: string | null;
  thumbnail_url?: string | null;
  raw?: unknown;
}): Promise<PostExternal | null> {
  return qOne<PostExternal>(
    `insert into analytics.posts_external
       (account_id, platform_post_id, posted_at, caption, media_type, permalink, thumbnail_url, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     on conflict (account_id, platform_post_id) do update set
       posted_at = coalesce(excluded.posted_at, analytics.posts_external.posted_at),
       caption = coalesce(excluded.caption, analytics.posts_external.caption),
       media_type = coalesce(excluded.media_type, analytics.posts_external.media_type),
       permalink = coalesce(excluded.permalink, analytics.posts_external.permalink),
       thumbnail_url = coalesce(excluded.thumbnail_url, analytics.posts_external.thumbnail_url),
       raw = coalesce(excluded.raw, analytics.posts_external.raw)
     returning *`,
    [
      input.account_id,
      input.platform_post_id,
      input.posted_at ?? null,
      input.caption ?? null,
      input.media_type ?? null,
      input.permalink ?? null,
      input.thumbnail_url ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ]
  );
}

export async function insertPostMetric(input: {
  posts_external_id: string;
  impressions?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  video_views?: number | null;
  plays?: number | null;
  completion_rate?: number | null;
  raw?: unknown;
}): Promise<PostMetric | null> {
  return qOne<PostMetric>(
    `insert into analytics.post_metrics
       (posts_external_id, impressions, reach, likes, comments, saves, shares, video_views, plays, completion_rate, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     on conflict (posts_external_id, captured_at) do nothing
     returning *`,
    [
      input.posts_external_id,
      input.impressions ?? null,
      input.reach ?? null,
      input.likes ?? null,
      input.comments ?? null,
      input.saves ?? null,
      input.shares ?? null,
      input.video_views ?? null,
      input.plays ?? null,
      input.completion_rate ?? null,
      input.raw ? JSON.stringify(input.raw) : null,
    ]
  );
}

export async function listPostsForClient(
  clientId: string,
  days = 28
): Promise<PostWithLatestMetrics[]> {
  return q<PostWithLatestMetrics>(
    `select pe.*,
            a.handle as account_handle,
            a.platform::text as account_platform,
            a.client_id,
            m.likes as m_likes,
            m.saves as m_saves,
            m.shares as m_shares,
            m.reach as m_reach,
            m.impressions as m_impressions,
            m.comments as m_comments
       from analytics.posts_external pe
       join analytics.platform_accounts a on a.id = pe.account_id
       left join lateral (
         select likes, saves, shares, reach, impressions, comments
           from analytics.post_metrics
          where posts_external_id = pe.id
          order by captured_at desc
          limit 1
       ) m on true
      where a.client_id = $1
        and pe.posted_at >= (now() - ($2 || ' days')::interval)
      order by pe.posted_at desc
      limit 200`,
    [clientId, days]
  );
}

export async function listUntaggedPosts(limit = 50): Promise<PostExternal[]> {
  return q<PostExternal>(
    `select pe.* from analytics.posts_external pe
       left join analytics.post_tags pt on pt.posts_external_id = pe.id
      where pt.id is null
      order by pe.posted_at desc nulls last
      limit $1`,
    [limit]
  );
}

export async function upsertPostTag(input: {
  posts_external_id: string;
  tag_kind: 'pillar' | 'hook_style' | 'format' | 'hashtag_quality';
  tag_value: string;
  confidence?: number | null;
  source?: 'ai' | 'human';
  run_id?: string | null;
}): Promise<PostTag | null> {
  return qOne<PostTag>(
    `insert into analytics.post_tags
       (posts_external_id, tag_kind, tag_value, confidence, source, run_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (posts_external_id, tag_kind) do update set
       tag_value = excluded.tag_value,
       confidence = excluded.confidence,
       source = excluded.source,
       run_id = excluded.run_id
     returning *`,
    [
      input.posts_external_id,
      input.tag_kind,
      input.tag_value,
      input.confidence ?? null,
      input.source ?? 'ai',
      input.run_id ?? null,
    ]
  );
}

export async function listTagsForPosts(postIds: string[]): Promise<PostTag[]> {
  if (postIds.length === 0) return [];
  return q<PostTag>(
    `select * from analytics.post_tags where posts_external_id = any($1::uuid[])`,
    [postIds]
  );
}

// ─── Top posts leaderboard ─────────────────────────────────────────────────

export async function listTopPostsAgency(days = 28, limit = 10): Promise<PostWithLatestMetrics[]> {
  return q<PostWithLatestMetrics>(
    `select pe.*,
            a.handle as account_handle,
            a.platform::text as account_platform,
            a.client_id,
            m.likes as m_likes,
            m.saves as m_saves,
            m.shares as m_shares,
            m.reach as m_reach,
            m.impressions as m_impressions,
            m.comments as m_comments
       from analytics.posts_external pe
       join analytics.platform_accounts a on a.id = pe.account_id
       left join lateral (
         select likes, saves, shares, reach, impressions, comments
           from analytics.post_metrics
          where posts_external_id = pe.id
          order by captured_at desc
          limit 1
       ) m on true
      where pe.posted_at >= (now() - ($1 || ' days')::interval)
      order by coalesce(m.saves, 0) + coalesce(m.shares, 0) * 2 desc, m.reach desc nulls last
      limit $2`,
    [days, limit]
  );
}

// ─── Insights ──────────────────────────────────────────────────────────────

export async function latestInsightForClient(clientId: string): Promise<Insight | null> {
  return qOne<Insight>(
    `select * from analytics.insights
      where client_id = $1
        and dismissed_at is null
      order by generated_at desc
      limit 1`,
    [clientId]
  );
}

export async function latestInsightAcrossAgency(): Promise<Insight | null> {
  return qOne<Insight>(
    `select * from analytics.insights
      where dismissed_at is null
      order by generated_at desc
      limit 1`
  );
}

export async function insertInsight(input: {
  client_id: string;
  period_start: string;
  period_end: string;
  body_md: string;
  evidence_post_ids?: string[];
  run_id?: string | null;
}): Promise<Insight | null> {
  return qOne<Insight>(
    `insert into analytics.insights
       (client_id, period_start, period_end, body_md, evidence_post_ids, run_id)
     values ($1, $2, $3, $4, $5::uuid[], $6)
     returning *`,
    [
      input.client_id,
      input.period_start,
      input.period_end,
      input.body_md,
      input.evidence_post_ids ?? [],
      input.run_id ?? null,
    ]
  );
}

// ─── Recommendations ───────────────────────────────────────────────────────

export async function proposedRecsForClient(
  clientId: string,
  limit = 5
): Promise<Recommendation[]> {
  return q<Recommendation>(
    `select * from analytics.recommendations
      where client_id = $1 and status = 'proposed'
      order by created_at desc
      limit $2`,
    [clientId, limit]
  );
}

export async function listAgencyRecs(status: 'proposed' | 'accepted' | 'dismissed' | 'all' = 'proposed'): Promise<Recommendation[]> {
  if (status === 'all') {
    return q<Recommendation>(
      `select * from analytics.recommendations order by created_at desc limit 200`
    );
  }
  return q<Recommendation>(
    `select * from analytics.recommendations where status = $1 order by created_at desc limit 200`,
    [status]
  );
}

export async function getRecommendation(id: string): Promise<Recommendation | null> {
  return qOne<Recommendation>(`select * from analytics.recommendations where id = $1`, [id]);
}

export async function insertRecommendation(input: {
  client_id: string;
  kind: Recommendation['kind'];
  title: string;
  rationale_md: string;
  evidence_post_ids?: string[];
  run_id?: string | null;
}): Promise<Recommendation | null> {
  return qOne<Recommendation>(
    `insert into analytics.recommendations
       (client_id, kind, title, rationale_md, evidence_post_ids, run_id)
     values ($1, $2, $3, $4, $5::uuid[], $6)
     returning *`,
    [
      input.client_id,
      input.kind,
      input.title,
      input.rationale_md,
      input.evidence_post_ids ?? [],
      input.run_id ?? null,
    ]
  );
}

// ─── Saved charts ──────────────────────────────────────────────────────────

export async function insertSavedChart(input: {
  client_id?: string | null;
  prompt: string;
  chart_spec_json: unknown;
  run_id?: string | null;
}): Promise<SavedChart | null> {
  return qOne<SavedChart>(
    `insert into analytics.saved_charts
       (client_id, prompt, chart_spec_json, run_id)
     values ($1, $2, $3::jsonb, $4)
     returning *`,
    [
      input.client_id ?? null,
      input.prompt,
      JSON.stringify(input.chart_spec_json),
      input.run_id ?? null,
    ]
  );
}

export async function listSavedChartsForClient(clientId: string): Promise<SavedChart[]> {
  return q<SavedChart>(
    `select * from analytics.saved_charts
      where client_id = $1 and pinned = true
      order by created_at desc
      limit 50`,
    [clientId]
  );
}

// ─── Anomalies + agency overview ───────────────────────────────────────────

export interface AnomalyRow {
  client_id: string;
  account_id: string;
  platform: Platform;
  handle: string | null;
  reach_7d: number;
  reach_prev_7d: number;
  ratio: number;
}

export async function listAnomalies(): Promise<AnomalyRow[]> {
  return q<AnomalyRow>(
    `with curr as (
       select account_id, sum(reach)::int as reach_7d
         from analytics.account_metrics_daily
        where date >= (current_date - interval '7 days')
        group by account_id
     ),
     prev as (
       select account_id, sum(reach)::int as reach_prev_7d
         from analytics.account_metrics_daily
        where date >= (current_date - interval '14 days')
          and date < (current_date - interval '7 days')
        group by account_id
     )
     select a.client_id,
            a.id as account_id,
            a.platform::text as platform,
            a.handle,
            coalesce(curr.reach_7d, 0) as reach_7d,
            coalesce(prev.reach_prev_7d, 0) as reach_prev_7d,
            case when coalesce(prev.reach_prev_7d, 0) > 0
                 then coalesce(curr.reach_7d, 0)::float / prev.reach_prev_7d
                 else null end as ratio
       from analytics.platform_accounts a
       left join curr on curr.account_id = a.id
       left join prev on prev.account_id = a.id
      where a.status = 'connected'
        and prev.reach_prev_7d > 100
        and (curr.reach_7d::float / prev.reach_prev_7d) < 0.7
      order by ratio asc nulls last
      limit 20`
  );
}

export async function agencyOverviewStats(): Promise<AgencyOverviewStats> {
  const row = await qOne<{
    active_clients: number;
    ingested_posts_28d: number;
    reach_28d: string;
    avg_engagement_rate_28d: string;
  }>(
    `with active as (
       select distinct client_id
         from analytics.platform_accounts
        where status = 'connected'
     ),
     posts28 as (
       select pe.id, pe.account_id, a.client_id, m.likes, m.comments, m.saves, m.shares, m.reach, m.impressions
         from analytics.posts_external pe
         join analytics.platform_accounts a on a.id = pe.account_id
         left join lateral (
           select likes, comments, saves, shares, reach, impressions
             from analytics.post_metrics
            where posts_external_id = pe.id
            order by captured_at desc
            limit 1
         ) m on true
        where pe.posted_at >= (now() - interval '28 days')
     ),
     reach28 as (
       select coalesce(sum(reach), 0)::bigint as r
         from analytics.account_metrics_daily amd
        where amd.date >= (current_date - interval '28 days')
     )
     select
       (select count(*) from active)::int as active_clients,
       (select count(*) from posts28)::int as ingested_posts_28d,
       (select r from reach28)::text as reach_28d,
       coalesce(
         (select avg(
           case when reach > 0
                then (coalesce(likes,0) + coalesce(comments,0) + coalesce(saves,0) + coalesce(shares,0))::float / reach
                else null end
         ) from posts28),
       0)::text as avg_engagement_rate_28d`
  );
  return {
    active_clients: row?.active_clients ?? 0,
    ingested_posts_28d: row?.ingested_posts_28d ?? 0,
    reach_28d: row ? Number(row.reach_28d) : 0,
    avg_engagement_rate_28d: row ? Number(row.avg_engagement_rate_28d) : 0,
  };
}
