import 'server-only';
import { q, qOne } from './db';
import { upsertNotification } from './notifications';

/**
 * Onboarding cascade — the one-click client provisioning flow.
 *
 * When a CRM lead is promoted to client (or a client is added directly),
 * we stage the new engagement end-to-end:
 *
 *   1. Resolve display name + slug
 *   2. Resolve tier from monthly retainer value
 *   3. Resolve service_lines (default ['content'])
 *   4. Upsert public.clients (with tier + service_lines)
 *   5. Seed first month in public.months
 *   6. Seed default content_quotas (skipped for premium)
 *   7. Stub voice.brand_briefs v1
 *   8. Insert command.projects "Onboarding [Client]"
 *   9. Seed command.tasks under that project
 *  10. Write welcome notification
 *
 * Idempotent on slug — re-running with the same lead is safe.
 *
 * Steps 1-4 are critical (failure short-circuits and returns ok:false).
 * Steps 5-10 are best-effort enrichment — failures are logged via
 * console.warn and the cascade returns ok:true with whatever it managed
 * to seed. This keeps onboarding workable in environments where, e.g.,
 * the command.* migration hasn't been applied yet.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type ClientTier = 'premium' | 'mid' | 'productized';

export interface OnboardingCascadeInput {
  leadName: string;
  leadCompany: string | null;
  valueCents: number | null;
  serviceLines?: string[];
  notes?: string | null;
}

export interface OnboardingCascadeResult {
  ok: true;
  client: { id: string; slug: string; name: string; tier: ClientTier };
  projectId: string | null;
  taskCount: number;
}

export interface OnboardingCascadeFailure {
  ok: false;
  reason: string;
}

// ─── Tier-aware defaults (inlined; no apps/social workspace dep) ──────────

const DEFAULT_QUOTAS_BY_TIER: Record<
  ClientTier,
  { reels: number; photos: number; carousels: number; stories: number }
> = {
  // Premium clients: defaults exist as a fallback, but the cascade skips
  // seeding so the strategy team can author quotas case-by-case.
  premium: { reels: 8, photos: 10, carousels: 6, stories: 4 },
  mid: { reels: 5, photos: 6, carousels: 4, stories: 3 },
  productized: { reels: 4, photos: 5, carousels: 4, stories: 2 },
};

const DEFAULT_BRAND_DO: string[] = [
  'Speak in clear, confident sentences',
  "Lead with the customer's benefit",
  'Use specific local references where it lands',
];

const DEFAULT_BRAND_DONT: string[] = [
  'Generic SaaS marketing language',
  'Stock photo descriptions',
  'Hype words without specifics',
];

const KNOWN_SERVICE_LINE_KEYS = new Set<string>([
  'content',
  'seo_local',
  'reviews',
  'lead_nurture',
  'paid_ads',
  'ai_tools',
  'web',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function resolveTier(valueCents: number | null): ClientTier {
  if (valueCents === null || valueCents === undefined) return 'mid';
  if (valueCents >= 500_000) return 'premium';
  if (valueCents >= 150_000) return 'mid';
  return 'productized';
}

function resolveServiceLines(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return ['content'];
  const filtered = input
    .map(s => s.trim().toLowerCase())
    .filter(s => KNOWN_SERVICE_LINE_KEYS.has(s));
  return filtered.length > 0 ? filtered : ['content'];
}

/** Today as `YYYY-MM-01` for `public.months.month`. */
function firstOfMonthIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** ISO date offset N days from today. */
function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Step implementations (each best-effort, logs and continues) ──────────

interface ClientRow {
  id: string;
  slug: string;
  name: string;
}

async function upsertClient(
  slug: string,
  displayName: string,
  tier: ClientTier,
  serviceLines: string[]
): Promise<ClientRow | null> {
  // Try the new shape (with tier + service_lines columns from migration 0012).
  try {
    const row = await qOne<ClientRow>(
      `insert into clients (slug, name, tier, service_lines)
         values ($1, $2, $3::client_tier, $4)
       on conflict (slug) do update set
         name          = excluded.name,
         tier          = excluded.tier,
         service_lines = excluded.service_lines
       returning id, slug, name`,
      [slug, displayName, tier, serviceLines]
    );
    if (row) return row;
  } catch (err) {
    // Fall through to the legacy shape if the columns / enum don't exist yet.
    console.warn(
      '[onboarding-cascade] tier upsert failed, falling back to legacy shape:',
      (err as Error).message
    );
  }

  // Legacy fallback — works against the pre-0012 schema.
  try {
    const row = await qOne<ClientRow>(
      `insert into clients (slug, name)
         values ($1, $2)
       on conflict (slug) do update set name = excluded.name
       returning id, slug, name`,
      [slug, displayName]
    );
    return row ?? null;
  } catch (err) {
    console.warn(
      '[onboarding-cascade] legacy client upsert failed:',
      (err as Error).message
    );
    return null;
  }
}

async function seedFirstMonth(clientId: string): Promise<string | null> {
  const month = firstOfMonthIso();
  try {
    const inserted = await qOne<{ id: string }>(
      `insert into months (client_id, month)
         values ($1, $2::date)
       on conflict (client_id, month) do nothing
       returning id`,
      [clientId, month]
    );
    if (inserted) return inserted.id;
    const existing = await qOne<{ id: string }>(
      `select id from months where client_id = $1 and month = $2::date limit 1`,
      [clientId, month]
    );
    return existing?.id ?? null;
  } catch (err) {
    console.warn(
      '[onboarding-cascade] seedFirstMonth failed:',
      (err as Error).message
    );
    return null;
  }
}

async function seedContentQuotas(
  clientId: string,
  tier: ClientTier
): Promise<void> {
  if (tier === 'premium') return; // premium clients build quotas case-by-case
  const month = firstOfMonthIso();
  const q_ = DEFAULT_QUOTAS_BY_TIER[tier];
  try {
    await q(
      `insert into content_quotas (
         client_id, month,
         reels_target, photos_target, carousels_target, stories_target
       ) values ($1, $2::date, $3, $4, $5, $6)
       on conflict (client_id, month) do nothing`,
      [clientId, month, q_.reels, q_.photos, q_.carousels, q_.stories]
    );
  } catch (err) {
    console.warn(
      '[onboarding-cascade] seedContentQuotas failed:',
      (err as Error).message
    );
  }
}

async function stubBrandBrief(clientId: string): Promise<void> {
  try {
    // voice.brand_briefs has no unique constraint on (client_id, version);
    // we guard with an existence check.
    const existing = await qOne<{ id: string }>(
      `select id from voice.brand_briefs where client_id = $1 and version = 1 limit 1`,
      [clientId]
    );
    if (existing) return;
    await q(
      `insert into voice.brand_briefs (client_id, version, body_md, do_list, dont_list, sample_copy)
       values ($1, 1, '', $2, $3, '')`,
      [clientId, DEFAULT_BRAND_DO, DEFAULT_BRAND_DONT]
    );
  } catch (err) {
    console.warn(
      '[onboarding-cascade] stubBrandBrief failed:',
      (err as Error).message
    );
  }
}

interface SeededProject {
  id: string;
  isNew: boolean;
}

async function spawnOnboardingProject(
  clientId: string,
  clientSlug: string,
  clientName: string,
  serviceLine: string
): Promise<SeededProject | null> {
  const projectSlug = `onboarding-${clientSlug}`;
  const projectName = `Onboarding ${clientName}`;
  const targetShipDate = daysFromNowIso(14);
  try {
    // Department lookup is best-effort — if departments aren't seeded, leave null.
    let departmentId: string | null = null;
    try {
      const dept = await qOne<{ id: string }>(
        `select id from command.departments where key = 'account' limit 1`
      );
      departmentId = dept?.id ?? null;
    } catch {
      // departments table may not exist yet; that's fine
    }

    const inserted = await qOne<{ id: string }>(
      `insert into command.projects (
         kind, slug, name, state, client_id, client_slug,
         service_line, department_id, priority, target_ship_date
       ) values (
         'client_campaign', $1, $2, 'active', $3, $4,
         $5, $6, 'p1', $7::date
       )
       on conflict (slug) do nothing
       returning id`,
      [
        projectSlug,
        projectName,
        clientId,
        clientSlug,
        serviceLine,
        departmentId,
        targetShipDate,
      ]
    );
    if (inserted) return { id: inserted.id, isNew: true };

    const existing = await qOne<{ id: string }>(
      `select id from command.projects where slug = $1 limit 1`,
      [projectSlug]
    );
    return existing ? { id: existing.id, isNew: false } : null;
  } catch (err) {
    console.warn(
      '[onboarding-cascade] spawnOnboardingProject failed:',
      (err as Error).message
    );
    return null;
  }
}

interface OnboardingTaskSeed {
  title: string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  dueDays: number;
  notes?: string;
  serviceLineGate?: string; // only insert if client has this service line
}

const ONBOARDING_TASKS: OnboardingTaskSeed[] = [
  { title: 'Intake call with client', priority: 'p1', dueDays: 3 },
  { title: 'Brand brief intake & first draft', priority: 'p1', dueDays: 5 },
  {
    title: 'Set up Drive folder structure',
    priority: 'p2',
    dueDays: 5,
    notes: 'Drive folder: TBD',
  },
  {
    title: 'Audit Google Business Profile',
    priority: 'p2',
    dueDays: 7,
    serviceLineGate: 'seo_local',
  },
  { title: 'Draft first month plan', priority: 'p1', dueDays: 10 },
  { title: 'Schedule kickoff call', priority: 'p1', dueDays: 14 },
];

async function seedOnboardingTasks(
  projectId: string,
  clientId: string,
  clientSlug: string,
  serviceLines: string[]
): Promise<number> {
  let inserted = 0;
  const seedTasks = ONBOARDING_TASKS.filter(
    t => !t.serviceLineGate || serviceLines.includes(t.serviceLineGate)
  );

  for (let i = 0; i < seedTasks.length; i++) {
    const t = seedTasks[i];
    const signalKey = `onboarding:${clientSlug}:${i}`;
    const dueDate = daysFromNowIso(t.dueDays);
    try {
      const row = await qOne<{ id: string }>(
        `insert into command.tasks (
           project_id, title, notes, priority, due_date,
           origin, signal_key, client_id, client_slug
         ) values (
           $1, $2, $3, $4::command.task_priority, $5::date,
           'onboarding', $6, $7, $8
         )
         on conflict (signal_key) do nothing
         returning id`,
        [
          projectId,
          t.title,
          t.notes ?? null,
          t.priority,
          dueDate,
          signalKey,
          clientId,
          clientSlug,
        ]
      );
      if (row) inserted++;
    } catch (err) {
      console.warn(
        `[onboarding-cascade] seed task "${t.title}" failed:`,
        (err as Error).message
      );
    }
  }
  return inserted;
}

async function writeWelcomeNotification(
  clientId: string,
  clientSlug: string,
  clientName: string,
  tier: ClientTier
): Promise<void> {
  const socialBase = (process.env.NEXT_PUBLIC_SOCIAL_URL ?? '').replace(
    /\/$/,
    ''
  );
  const linkUrl = socialBase
    ? `${socialBase}/clients/${clientSlug}`
    : `/clients/${clientSlug}`;
  await upsertNotification({
    dedup_key: `onboarding:${clientSlug}:welcome`,
    title: `New client onboarded: ${clientName} (${tier})`,
    detail: 'Onboarding cascade staged. Review brief, quotas, and project tasks.',
    link_url: linkUrl,
    severity: 'info',
    audience_role: 'strategy',
    related_client_id: clientId,
  });
}

// ─── Entry point ───────────────────────────────────────────────────────────

export async function runOnboardingCascade(
  input: OnboardingCascadeInput
): Promise<OnboardingCascadeResult | OnboardingCascadeFailure> {
  // 1. Resolve display name + slug.
  const displayName = (input.leadCompany || input.leadName || '').trim();
  if (!displayName) return { ok: false, reason: 'missing display name' };
  const slug = slugifyName(displayName);
  if (!slug) return { ok: false, reason: 'could not slugify name' };

  // 2-3. Resolve tier + service_lines.
  const tier = resolveTier(input.valueCents);
  const serviceLines = resolveServiceLines(input.serviceLines);
  const primaryServiceLine = serviceLines[0] ?? 'content';

  // 4. Upsert client (critical — fail loud if this doesn't work).
  const client = await upsertClient(slug, displayName, tier, serviceLines);
  if (!client) {
    return { ok: false, reason: 'client upsert failed' };
  }

  // 5. Seed first month.
  const monthId = await seedFirstMonth(client.id);

  // 6. Seed default content quotas (skipped for premium, no-op if month missing).
  if (monthId) {
    await seedContentQuotas(client.id, tier);
  }

  // 7. Stub brand brief v1.
  await stubBrandBrief(client.id);

  // 8. Spawn onboarding project.
  const project = await spawnOnboardingProject(
    client.id,
    client.slug,
    client.name,
    primaryServiceLine
  );

  // 9. Seed onboarding tasks (only on first creation — re-runs are no-op via signal_key conflict).
  let taskCount = 0;
  if (project) {
    taskCount = await seedOnboardingTasks(
      project.id,
      client.id,
      client.slug,
      serviceLines
    );
  }

  // 10. Welcome notification.
  await writeWelcomeNotification(client.id, client.slug, client.name, tier);

  return {
    ok: true,
    client: { id: client.id, slug: client.slug, name: client.name, tier },
    projectId: project?.id ?? null,
    taskCount,
  };
}

// Re-export the inlined defaults so other modules can read them if needed.
export {
  DEFAULT_QUOTAS_BY_TIER,
  DEFAULT_BRAND_DO,
  DEFAULT_BRAND_DONT,
  KNOWN_SERVICE_LINE_KEYS,
};
