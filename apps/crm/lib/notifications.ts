import 'server-only';
import { q } from './db';

/**
 * Cross-tool notification: writes a row into the social tool's `notifications`
 * table so its in-app bell shows CRM events. We use the existing `today_action`
 * notification kind so we don't have to extend the enum across schemas, and
 * carry a `link_url` that points at the CRM (or social) page that resolves it.
 *
 * `dedup_key` makes inserts idempotent — the social tool's action engine
 * already upserts on this key. Re-running the cron won't duplicate rows.
 */
export interface CrossToolNotification {
  dedup_key: string;
  title: string;
  detail?: string;
  link_url?: string;
  severity?: 'info' | 'warn' | 'bad';
  audience_role?: 'field' | 'strategy' | 'producer' | 'editor' | 'approver' | null;
  related_client_id?: string | null;
}

export async function upsertNotification(n: CrossToolNotification): Promise<void> {
  try {
    await q(
      `insert into notifications (
         kind, severity, audience_role, dedup_key, title, detail, link_url, related_client_id
       ) values (
         'today_action', $1::notification_severity, $2::person_role, $3, $4, $5, $6, $7
       )
       on conflict (dedup_key) do update set
         title = excluded.title,
         detail = excluded.detail,
         link_url = excluded.link_url,
         severity = excluded.severity,
         audience_role = excluded.audience_role,
         updated_at = now(),
         resolved_at = null,
         dismissed_at = null`,
      [
        n.severity ?? 'info',
        n.audience_role ?? null,
        n.dedup_key,
        n.title,
        n.detail ?? null,
        n.link_url ?? null,
        n.related_client_id ?? null,
      ]
    );
  } catch (err) {
    console.warn(
      '[notifications] upsert failed (likely missing notifications table):',
      (err as Error).message
    );
  }
}

export async function resolveNotification(dedupKey: string): Promise<void> {
  try {
    await q(
      `update notifications
          set resolved_at = now(), updated_at = now()
        where dedup_key = $1 and resolved_at is null`,
      [dedupKey]
    );
  } catch {
    // social tool may not be live; ignore
  }
}
