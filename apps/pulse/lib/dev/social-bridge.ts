/**
 * Read-only bridge into `public.*` (social) tables from the engineering view.
 *
 * The engineering home shows a small social-tool pulse card so the dev team
 * can see the agency's content side at a glance. Returns null on any failure
 * (missing schema, missing tables, no DB) so the dashboard widget gracefully
 * no-ops instead of bringing the whole page down.
 */
import 'server-only';
import { q } from '../db';

export interface SocialPulse {
  client_count: number;
  active_clients: number;
  this_month: string; // YYYY-MM
  open_shoots: number;
  open_posts: number;
  posted_last_30d: number;
}

export async function readSocialPulse(): Promise<SocialPulse | null> {
  try {
    const ym = new Date().toISOString().slice(0, 7);
    const monthStart = `${ym}-01`;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [clients, shoots, openPosts, recentPosts] = await Promise.all([
      q<{ total: number; active: number }>(
        `select
           count(*)::int as total,
           sum(case when archived = false then 1 else 0 end)::int as active
         from public.clients`
      ),
      q<{ n: number }>(
        `select count(*)::int as n
         from public.shoots
         where scheduled_date >= $1::date
           and asset_status not in ('captured','delivered')`,
        [monthStart]
      ),
      q<{ n: number }>(
        `select count(*)::int as n
         from public.posts
         where status <> 'posted'`
      ),
      q<{ n: number }>(
        `select count(*)::int as n
         from public.posts
         where status = 'posted'
           and post_date >= $1::date`,
        [thirtyDaysAgo]
      ),
    ]);

    return {
      client_count: clients[0]?.total ?? 0,
      active_clients: clients[0]?.active ?? 0,
      this_month: ym,
      open_shoots: shoots[0]?.n ?? 0,
      open_posts: openPosts[0]?.n ?? 0,
      posted_last_30d: recentPosts[0]?.n ?? 0,
    };
  } catch {
    return null;
  }
}
