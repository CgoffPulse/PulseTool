import 'server-only';
import { q, qOne } from '../db';
import type { SocialClient, SocialPostBridge } from './types';

/**
 * Read-only access to the social schema (clients, posts, people).
 *
 * The analytics app never writes here — it only reads to:
 *   • Resolve a slug to a client_id when navigating client pages
 *   • Stitch planned `posts` to ingested `posts_external` via post_match
 *   • List people for "owner" displays
 *
 * Every call is wrapped in try/catch so the analytics UI still renders
 * cleanly when the social schema is unreachable or the tables don't exist.
 */

export async function getClientByPlatformSlug(slug: string): Promise<SocialClient | null> {
  if (!slug) return null;
  try {
    return await qOne<SocialClient>(
      `select id, slug, name, color from clients where slug = $1 and archived = false limit 1`,
      [slug]
    );
  } catch (err) {
    console.warn('[social-bridge] getClientByPlatformSlug failed:', (err as Error).message);
    return null;
  }
}

export async function getClientById(id: string): Promise<SocialClient | null> {
  if (!id) return null;
  try {
    return await qOne<SocialClient>(
      `select id, slug, name, color from clients where id = $1 limit 1`,
      [id]
    );
  } catch (err) {
    console.warn('[social-bridge] getClientById failed:', (err as Error).message);
    return null;
  }
}

export async function listClientsForAnalytics(): Promise<SocialClient[]> {
  try {
    return await q<SocialClient>(
      `select c.id, c.slug, c.name, c.color
         from clients c
         where c.archived = false
         order by c.name`
    );
  } catch (err) {
    console.warn('[social-bridge] listClientsForAnalytics failed:', (err as Error).message);
    return [];
  }
}

/**
 * Recent planned posts for a client over the last `days` window.
 * Used for the matrix page — joins to analytics.post_match elsewhere.
 */
export async function listRecentPlannedPosts(
  clientId: string,
  days = 60
): Promise<SocialPostBridge[]> {
  if (!clientId) return [];
  try {
    return await q<SocialPostBridge>(
      `select p.id, p.post_date::text as post_date, p.post_time, p.platform,
              p.pillar::text as pillar, p.content_type::text as content_type,
              p.description, p.status::text as status, m.client_id
         from posts p
         join months m on m.id = p.month_id
        where m.client_id = $1
          and p.post_date >= (current_date - ($2 || ' days')::interval)
        order by p.post_date desc, p.sort_index asc
        limit 200`,
      [clientId, days]
    );
  } catch (err) {
    console.warn('[social-bridge] listRecentPlannedPosts failed:', (err as Error).message);
    return [];
  }
}

/**
 * Inserts a draft row into the social schema's `posts` table when an
 * analytics recommendation is accepted. Best-effort — if the social schema
 * is unreachable we just return null so the recommendation flow can still
 * mark accepted with a note.
 *
 * Stamps a description prefixed with the recommendation title so the
 * planning UI on the social side can spot it.
 */
export interface DraftPostFromRecInput {
  client_id: string;
  title: string;
  rationale: string;
  pillar?: string | null;
  content_type?: string | null;
}

export async function createDraftPostFromRec(
  input: DraftPostFromRecInput
): Promise<{ id: string } | null> {
  try {
    // Find the most recent month row for this client; create one for the
    // current month if none exist.
    const monthRow = await qOne<{ id: string }>(
      `with c as (
         select date_trunc('month', current_date)::date as cur
       )
       select m.id from months m, c
        where m.client_id = $1
          and m.month <= c.cur
        order by m.month desc
        limit 1`,
      [input.client_id]
    );

    let monthId = monthRow?.id;
    if (!monthId) {
      const inserted = await qOne<{ id: string }>(
        `insert into months (client_id, month)
         values ($1, date_trunc('month', current_date)::date)
         on conflict (client_id, month) do update set updated_at = now()
         returning id`,
        [input.client_id]
      );
      monthId = inserted?.id;
    }
    if (!monthId) return null;

    const contentType = (input.content_type ?? 'reel').toLowerCase();
    const safeContentType = ['reel', 'photo', 'carousel', 'story', 'video', 'graphic'].includes(
      contentType
    )
      ? contentType
      : 'reel';

    const inserted = await qOne<{ id: string }>(
      `insert into posts (month_id, post_date, content_type, description, status)
       values ($1, current_date, $2::content_type, $3, 'planned')
       returning id`,
      [
        monthId,
        safeContentType,
        `[Analytics rec] ${input.title}\n\n${input.rationale}`.slice(0, 4000),
      ]
    );
    return inserted ?? null;
  } catch (err) {
    console.warn('[social-bridge] createDraftPostFromRec failed:', (err as Error).message);
    return null;
  }
}

export function socialClientUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_SOCIAL_URL ?? '';
  if (!base) return `/clients/${slug}`;
  return `${base.replace(/\/$/, '')}/clients/${slug}`;
}
