import 'server-only';
import { qOne } from './db';

/**
 * Promote-to-client bridge. Writes a row into the social tool's `clients`
 * table and returns the resulting id + slug. No FK is enforced across
 * schemas; we stamp the resulting client_id on `crm.leads.client_id` after.
 *
 * Idempotent on slug: if a client with that slug already exists, we return it.
 */
export interface PromotedClient {
  id: string;
  slug: string;
  name: string;
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export async function promoteLeadToClient(
  leadName: string,
  leadCompany: string | null
): Promise<PromotedClient | null> {
  const displayName = leadCompany?.trim() || leadName.trim();
  if (!displayName) return null;
  const slug = slugifyName(displayName);
  if (!slug) return null;
  try {
    // Try to read existing first.
    const existing = await qOne<{ id: string; slug: string; name: string }>(
      `select id, slug, name from clients where slug = $1 limit 1`,
      [slug]
    );
    if (existing) return existing;
    // Otherwise insert a new client. The social tool's clients table
    // accepts (slug, name) at minimum — color and other fields default.
    const inserted = await qOne<{ id: string; slug: string; name: string }>(
      `insert into clients (slug, name)
       values ($1, $2)
       on conflict (slug) do update set name = excluded.name
       returning id, slug, name`,
      [slug, displayName]
    );
    return inserted ?? null;
  } catch (err) {
    console.warn(
      '[social-bridge] promote failed (social schema unavailable?):',
      (err as Error).message
    );
    return null;
  }
}

/**
 * Build a permalink to the social tool for a given client slug. Used to send
 * the user from the CRM "Promote to client" success state into the planning
 * flow on the other side.
 */
export function socialClientUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_SOCIAL_URL ?? '';
  if (!base) return `/clients/${slug}`;
  return `${base.replace(/\/$/, '')}/clients/${slug}`;
}
