import 'server-only';
import {
  getOrCreateAccountMetrics,
  insertPostMetric,
  upsertPostExternal,
} from '../queries';
import type { PlatformAccount } from '../types';

/**
 * Meta Graph API helpers for Instagram Business + Facebook Page metrics.
 *
 * Graceful when keys missing: returns `{ ok: false, skipped: true }` with no
 * mutations so callers can keep iterating across other accounts.
 */

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export interface PollResult {
  ok: boolean;
  skipped?: boolean;
  account_id: string;
  platform: string;
  posts: number;
  metric_rows: number;
  error?: string;
}

export function metaCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID ?? '';
  const appSecret = process.env.META_APP_SECRET ?? '';
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function metaConfigured(): boolean {
  return metaCredentials() !== null;
}

function tokenForAccount(row: PlatformAccount): string | null {
  // The Meta access token is stored as an env var name (`access_token_ref`)
  // for security — the actual long-lived token lives in Vercel env or vault.
  // We dereference here. If missing we return null so the caller can skip
  // gracefully.
  if (!row.access_token_ref) return null;
  const tok = process.env[row.access_token_ref];
  return tok && tok.length > 8 ? tok : null;
}

async function graphGet(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<unknown> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`graph ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

interface IgInsightsResponse {
  data?: Array<{
    name: string;
    period: string;
    values: Array<{ value: number; end_time: string }>;
  }>;
}

interface IgMediaResponse {
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_product_type?: string;
    permalink?: string;
    thumbnail_url?: string;
    media_url?: string;
    timestamp?: string;
  }>;
}

interface IgPostInsightsResponse {
  data?: Array<{
    name: string;
    values?: Array<{ value: number }>;
  }>;
}

function pickInsight(
  body: IgInsightsResponse,
  metric: string,
  date: string
): number | null {
  const m = body.data?.find(d => d.name === metric);
  if (!m) return null;
  const v = m.values?.find(v => (v.end_time ?? '').slice(0, 10) === date);
  return typeof v?.value === 'number' ? v.value : null;
}

export async function pollAccount(account: PlatformAccount): Promise<PollResult> {
  if (!metaConfigured()) {
    return {
      ok: true,
      skipped: true,
      account_id: account.id,
      platform: account.platform,
      posts: 0,
      metric_rows: 0,
      error: 'META_APP_ID/SECRET missing',
    };
  }
  const token = tokenForAccount(account);
  if (!token) {
    return {
      ok: true,
      skipped: true,
      account_id: account.id,
      platform: account.platform,
      posts: 0,
      metric_rows: 0,
      error: 'no access token in env',
    };
  }
  if (!account.external_id) {
    return {
      ok: false,
      account_id: account.id,
      platform: account.platform,
      posts: 0,
      metric_rows: 0,
      error: 'no external_id',
    };
  }

  let posts = 0;
  let metricRows = 0;

  try {
    if (account.platform === 'instagram') {
      // Account-level insights for the last day (we run every 6h so we
      // re-upsert today's row repeatedly).
      try {
        const insights = (await graphGet(
          `/${account.external_id}/insights`,
          {
            metric: 'reach,impressions,profile_views',
            period: 'day',
          },
          token
        )) as IgInsightsResponse;
        const today = new Date().toISOString().slice(0, 10);
        const reach = pickInsight(insights, 'reach', today);
        const impressions = pickInsight(insights, 'impressions', today);
        const profileViews = pickInsight(insights, 'profile_views', today);

        // Followers count is on the user object itself.
        const userObj = (await graphGet(
          `/${account.external_id}`,
          { fields: 'followers_count' },
          token
        )) as { followers_count?: number };

        await getOrCreateAccountMetrics({
          account_id: account.id,
          date: today,
          followers: userObj.followers_count ?? null,
          reach,
          impressions,
          profile_visits: profileViews,
          raw: { insights, userObj },
        });
        metricRows++;
      } catch (err) {
        console.warn('[meta] ig account insights failed', (err as Error).message);
      }

      // Recent media + per-post insights.
      try {
        const media = (await graphGet(
          `/${account.external_id}/media`,
          {
            fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp',
            limit: '30',
          },
          token
        )) as IgMediaResponse;

        for (const m of media.data ?? []) {
          const pe = await upsertPostExternal({
            account_id: account.id,
            platform_post_id: m.id,
            posted_at: m.timestamp ?? null,
            caption: m.caption ?? null,
            media_type: m.media_product_type ?? m.media_type ?? null,
            permalink: m.permalink ?? null,
            thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
            raw: m,
          });
          posts++;

          if (pe?.id) {
            try {
              const pi = (await graphGet(
                `/${m.id}/insights`,
                {
                  metric:
                    m.media_type === 'VIDEO' || m.media_product_type === 'REELS'
                      ? 'impressions,reach,likes,comments,saves,shares,video_views,plays'
                      : 'impressions,reach,likes,comments,saves,shares',
                },
                token
              )) as IgPostInsightsResponse;

              const v = (k: string): number | null => {
                const row = pi.data?.find(d => d.name === k);
                const val = row?.values?.[0]?.value;
                return typeof val === 'number' ? val : null;
              };

              await insertPostMetric({
                posts_external_id: pe.id,
                impressions: v('impressions'),
                reach: v('reach'),
                likes: v('likes'),
                comments: v('comments'),
                saves: v('saves'),
                shares: v('shares'),
                video_views: v('video_views'),
                plays: v('plays'),
                raw: pi,
              });
              metricRows++;
            } catch (err) {
              console.warn('[meta] ig post insights failed', (err as Error).message);
            }
          }
        }
      } catch (err) {
        console.warn('[meta] ig media fetch failed', (err as Error).message);
      }
    } else if (account.platform === 'facebook') {
      // FB page insights.
      try {
        const insights = (await graphGet(
          `/${account.external_id}/insights`,
          {
            metric: 'page_impressions,page_post_engagements,page_fan_count,page_views_total',
            period: 'day',
          },
          token
        )) as IgInsightsResponse;
        const today = new Date().toISOString().slice(0, 10);
        const impressions = pickInsight(insights, 'page_impressions', today);
        const fans = pickInsight(insights, 'page_fan_count', today);
        const pageViews = pickInsight(insights, 'page_views_total', today);

        await getOrCreateAccountMetrics({
          account_id: account.id,
          date: today,
          followers: fans,
          reach: null,
          impressions,
          profile_visits: pageViews,
          raw: insights,
        });
        metricRows++;
      } catch (err) {
        console.warn('[meta] fb page insights failed', (err as Error).message);
      }

      // FB page posts.
      try {
        const posts_ = (await graphGet(
          `/${account.external_id}/posts`,
          {
            fields: 'id,message,created_time,permalink_url,attachments{media_type}',
            limit: '30',
          },
          token
        )) as {
          data?: Array<{
            id: string;
            message?: string;
            created_time?: string;
            permalink_url?: string;
            attachments?: { data?: Array<{ media_type?: string }> };
          }>;
        };
        for (const p of posts_.data ?? []) {
          await upsertPostExternal({
            account_id: account.id,
            platform_post_id: p.id,
            posted_at: p.created_time ?? null,
            caption: p.message ?? null,
            media_type: p.attachments?.data?.[0]?.media_type ?? null,
            permalink: p.permalink_url ?? null,
            raw: p,
          });
          posts++;
        }
      } catch (err) {
        console.warn('[meta] fb posts fetch failed', (err as Error).message);
      }
    }

    return {
      ok: true,
      account_id: account.id,
      platform: account.platform,
      posts,
      metric_rows: metricRows,
    };
  } catch (err) {
    return {
      ok: false,
      account_id: account.id,
      platform: account.platform,
      posts,
      metric_rows: metricRows,
      error: (err as Error).message,
    };
  }
}

/**
 * OAuth helpers for the connect/callback routes.
 */
export function metaAuthorizeUrl(state: string): string | null {
  const cred = metaCredentials();
  if (!cred) return null;
  const redirect =
    process.env.META_REDIRECT_URI ??
    'https://pulse-analytics.vercel.app/api/integrations/meta/callback';
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', cred.appId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('state', state);
  url.searchParams.set(
    'scope',
    [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'instagram_basic',
      'instagram_manage_insights',
      'read_insights',
      'business_management',
    ].join(',')
  );
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string | null> {
  const cred = metaCredentials();
  if (!cred) return null;
  const redirect =
    process.env.META_REDIRECT_URI ??
    'https://pulse-analytics.vercel.app/api/integrations/meta/callback';
  try {
    const res = await fetch(
      `${GRAPH_BASE}/oauth/access_token?` +
        new URLSearchParams({
          client_id: cred.appId,
          client_secret: cred.appSecret,
          redirect_uri: redirect,
          code,
        }).toString(),
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) return null;
    // Exchange for long-lived token.
    const lresp = await fetch(
      `${GRAPH_BASE}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: cred.appId,
          client_secret: cred.appSecret,
          fb_exchange_token: json.access_token,
        }).toString(),
      { cache: 'no-store' }
    );
    if (!lresp.ok) return json.access_token;
    const ljson = (await lresp.json()) as { access_token?: string };
    return ljson.access_token ?? json.access_token;
  } catch (err) {
    console.warn('[meta] token exchange failed', (err as Error).message);
    return null;
  }
}

export interface MetaPageWithIg {
  page_id: string;
  page_name: string;
  page_token: string;
  ig_id: string | null;
  ig_username: string | null;
}

export async function listManagedPages(userToken: string): Promise<MetaPageWithIg[]> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/me/accounts?` +
        new URLSearchParams({
          fields: 'id,name,access_token,instagram_business_account',
          access_token: userToken,
        }).toString(),
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
    };
    const out: MetaPageWithIg[] = [];
    for (const p of json.data ?? []) {
      let igUsername: string | null = null;
      if (p.instagram_business_account?.id) {
        try {
          const ig = await fetch(
            `${GRAPH_BASE}/${p.instagram_business_account.id}?` +
              new URLSearchParams({
                fields: 'username',
                access_token: p.access_token,
              }).toString(),
            { cache: 'no-store' }
          );
          if (ig.ok) {
            const j = (await ig.json()) as { username?: string };
            igUsername = j.username ?? null;
          }
        } catch {
          // ignore
        }
      }
      out.push({
        page_id: p.id,
        page_name: p.name,
        page_token: p.access_token,
        ig_id: p.instagram_business_account?.id ?? null,
        ig_username: igUsername,
      });
    }
    return out;
  } catch (err) {
    console.warn('[meta] listManagedPages failed', (err as Error).message);
    return [];
  }
}
