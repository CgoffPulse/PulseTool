import 'server-only';
import { runOnboardingCascade } from './onboarding-cascade';

/**
 * Promote-to-client bridge. Delegates to the full onboarding cascade
 * (`runOnboardingCascade`) — the cascade upserts the client row, seeds the
 * first month, stubs the brand brief, spawns an onboarding project + tasks,
 * and writes a welcome notification. Idempotent on slug.
 *
 * The function signature is preserved for back-compat with existing callsites
 * in `lib/crm/actions.ts`. New callsites can pass `extras` to override
 * tier/service_lines defaults; without it, the cascade infers tier from
 * `valueCents` (here always null) and falls back to defaults.
 *
 * In the consolidated app, this delegate could later become a direct call
 * into `@/lib/social/...` (which has direct DB access to public.clients) —
 * but for Wave 1D we keep the pattern stable: the cascade owns all of the
 * cross-schema writes and is the single seam social-bridge talks to.
 */
export interface PromotedClient {
  id: string;
  slug: string;
  name: string;
}

export async function promoteLeadToClient(
  leadName: string,
  leadCompany: string | null,
  extras?: {
    valueCents?: number | null;
    serviceLines?: string[];
    notes?: string | null;
  }
): Promise<PromotedClient | null> {
  const result = await runOnboardingCascade({
    leadName,
    leadCompany,
    valueCents: extras?.valueCents ?? null,
    serviceLines: extras?.serviceLines,
    notes: extras?.notes ?? null,
  });
  if (!result.ok) {
    console.warn('[social-bridge] cascade failed:', result.reason);
    return null;
  }
  return {
    id: result.client.id,
    slug: result.client.slug,
    name: result.client.name,
  };
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

// Re-export the cascade entry point so consumers can run it directly when
// they don't need the back-compat lead-shaped signature.
export { runOnboardingCascade } from './onboarding-cascade';
