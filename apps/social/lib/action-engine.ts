/**
 * Action engine — turns the current DB state into zero-or-more Notification
 * drafts. Pure functions: same input → same output. The cron job (or a manual
 * trigger) feeds in a snapshot, gets back drafts, and upserts to the DB
 * keyed by `dedup_key` so re-runs stay in sync without spamming duplicates.
 *
 * Each detector takes a typed snapshot — never the Supabase client — so this
 * file is fully unit-testable against fixtures.
 */
import { addDays, differenceInCalendarDays, isAfter, isBefore, parseISO, startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';
import {
  type Client,
  type ContentQuota,
  type MonthRow,
  type NotificationDraft,
  type Person,
  type Post,
  type Shoot,
  type ShootTemplate,
  type StrategicFrame,
} from './types';

export interface EngineSnapshot {
  today: Date;
  clients: Client[];
  people: Person[];
  months: MonthRow[];
  posts: Post[];
  shoots: Shoot[];
  templates: ShootTemplate[];
  frames: StrategicFrame[];
  quotas: ContentQuota[];
}

export interface DetectorContext extends EngineSnapshot {
  clientById: Map<string, Client>;
  monthById: Map<string, MonthRow>;
  templateById: Map<string, ShootTemplate>;
  frameByClient: Map<string, StrategicFrame>;
  postsByMonth: Map<string, Post[]>;
  shootsByMonth: Map<string, Shoot[]>;
}

function buildContext(s: EngineSnapshot): DetectorContext {
  const clientById = new Map(s.clients.map(c => [c.id, c]));
  const monthById = new Map(s.months.map(m => [m.id, m]));
  const templateById = new Map(s.templates.map(t => [t.id, t]));
  const frameByClient = new Map(s.frames.map(f => [f.client_id, f]));
  const postsByMonth = new Map<string, Post[]>();
  for (const p of s.posts) {
    const arr = postsByMonth.get(p.month_id) ?? [];
    arr.push(p);
    postsByMonth.set(p.month_id, arr);
  }
  const shootsByMonth = new Map<string, Shoot[]>();
  for (const sh of s.shoots) {
    const arr = shootsByMonth.get(sh.month_id) ?? [];
    arr.push(sh);
    shootsByMonth.set(sh.month_id, arr);
  }
  return {
    ...s,
    clientById,
    monthById,
    templateById,
    frameByClient,
    postsByMonth,
    shootsByMonth,
  };
}

export function runDetectors(snapshot: EngineSnapshot): NotificationDraft[] {
  const ctx = buildContext(snapshot);
  return [
    ...detectStuckPosts(ctx),
    ...detectLeadTimeTight(ctx),
    ...detectMissingMonthPlan(ctx),
    ...detectShootUnassigned(ctx),
    ...detectCoverageGap(ctx),
    ...detectAssetOverdue(ctx),
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Stuck posts — due this week, status `planned`, with a shoot assigned.
// ─────────────────────────────────────────────────────────────────────────
export function detectStuckPosts(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const start = startOfWeek(ctx.today, { weekStartsOn: 0 });
  const end = endOfWeek(ctx.today, { weekStartsOn: 0 });
  for (const p of ctx.posts) {
    if (p.status !== 'planned') continue;
    if (!p.shoot_id) continue;
    const d = parseISO(p.post_date);
    if (!isWithinInterval(d, { start, end })) continue;
    const month = ctx.monthById.get(p.month_id);
    const client = month ? ctx.clientById.get(month.client_id) : null;
    drafts.push({
      kind: 'stuck_post',
      severity: 'bad',
      dedup_key: `stuck_post:${p.id}`,
      title: `Stuck before capture: ${client?.name ?? 'Post'} · ${format(d, 'EEE MMM d')}`,
      detail: p.description?.slice(0, 140) ?? '— No description —',
      link_url: linkPlanning(client, month),
      audience_person_id: p.owner_person_id ?? null,
      related_post_id: p.id,
      related_shoot_id: p.shoot_id,
      related_client_id: client?.id ?? null,
      related_month_id: p.month_id,
    });
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Lead time tight — earliest post on a shoot is inside the lead window.
// ─────────────────────────────────────────────────────────────────────────
export function detectLeadTimeTight(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  for (const s of ctx.shoots) {
    if (!s.scheduled_date) continue;
    const month = ctx.monthById.get(s.month_id);
    if (!month) continue;
    const frame = ctx.frameByClient.get(month.client_id);
    const minLead = frame?.min_lead_time_days ?? 5;
    const linked = ctx.posts.filter(p => p.shoot_id === s.id);
    if (linked.length === 0) continue;
    const earliest = linked
      .map(p => parseISO(p.post_date))
      .reduce((a, b) => (a < b ? a : b));
    const days = differenceInCalendarDays(earliest, parseISO(s.scheduled_date));
    if (days >= minLead) continue;
    const client = ctx.clientById.get(month.client_id);
    drafts.push({
      kind: 'lead_time_tight',
      severity: 'warn',
      dedup_key: `lead_time:${s.id}`,
      title: `Lead time tight on ${client?.name ?? 'shoot'} · Shoot ${s.bundle_number}`,
      detail: `${days}d between shoot and earliest post (min ${minLead}d).`,
      link_url: linkProduction(client, month),
      audience_person_id: s.assigned_person_id ?? null,
      related_shoot_id: s.id,
      related_client_id: client?.id ?? null,
      related_month_id: s.month_id,
    });
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Missing month plan — next month is approaching, no posts yet.
// ─────────────────────────────────────────────────────────────────────────
export function detectMissingMonthPlan(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const today = ctx.today;
  // Look at every non-archived client; identify the upcoming month and check
  // if it's been planned yet.
  for (const c of ctx.clients) {
    if (c.archived) continue;
    // Find the soonest future month_start whose client_id matches.
    const nextStart = nextMonthStart(today);
    const daysUntil = differenceInCalendarDays(nextStart, today);
    if (daysUntil < 0 || daysUntil > 14) continue;
    const monthIso = format(nextStart, 'yyyy-MM-01');
    const monthRow = ctx.months.find(
      m => m.client_id === c.id && m.month.startsWith(monthIso.slice(0, 7))
    );
    const postCount = monthRow ? (ctx.postsByMonth.get(monthRow.id)?.length ?? 0) : 0;
    if (postCount > 5) continue; // already underway
    const frame = ctx.frameByClient.get(c.id);
    const cadenceTarget = parseCadenceTarget(frame?.cadence);
    drafts.push({
      kind: 'missing_month_plan',
      severity: daysUntil <= 7 ? 'bad' : 'warn',
      dedup_key: `missing_plan:${c.id}:${monthIso.slice(0, 7)}`,
      title: `Plan ${c.name}'s ${format(nextStart, 'MMMM yyyy')}`,
      detail:
        postCount === 0
          ? `Next month starts in ${daysUntil}d — no posts planned${cadenceTarget ? ` (cadence: ~${cadenceTarget}/mo)` : ''}.`
          : `Only ${postCount} post(s) planned for next month.`,
      link_url: `/clients/${c.slug}/months/${monthIso.slice(0, 7)}/planning`,
      audience_role: 'strategy',
      related_client_id: c.id,
      related_month_id: monthRow?.id ?? null,
    });
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Shoot unassigned — contracted shoot in next 7 days with no person.
// ─────────────────────────────────────────────────────────────────────────
export function detectShootUnassigned(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const horizon = addDays(ctx.today, 7);
  for (const s of ctx.shoots) {
    if (!s.scheduled_date) continue;
    if (s.assigned_person_id) continue;
    if (s.assigned_to && s.assigned_to.trim()) continue; // legacy text assignment
    const d = parseISO(s.scheduled_date);
    if (isBefore(d, ctx.today) || isAfter(d, horizon)) continue;
    const month = ctx.monthById.get(s.month_id);
    const client = month ? ctx.clientById.get(month.client_id) : null;
    drafts.push({
      kind: 'shoot_unassigned',
      severity: 'warn',
      dedup_key: `unassigned:${s.id}`,
      title: `Assign someone to ${client?.name ?? ''} Shoot ${s.bundle_number}`,
      detail: `Scheduled ${format(d, 'EEE MMM d')}${s.location ? ` at ${s.location}` : ''}.`,
      link_url: linkPlanning(client, month),
      audience_role: 'producer',
      related_shoot_id: s.id,
      related_client_id: client?.id ?? null,
      related_month_id: s.month_id,
    });
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Coverage gap — current month is short on plan with little lead left.
// ─────────────────────────────────────────────────────────────────────────
export function detectCoverageGap(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  for (const month of ctx.months) {
    const monthStart = parseISO(month.month);
    const monthEndDate = addDays(monthStart, 30);
    if (isBefore(monthEndDate, ctx.today)) continue; // past month
    const client = ctx.clientById.get(month.client_id);
    if (!client) continue;
    const quota = ctx.quotas.find(
      q => q.client_id === client.id && q.month === month.month
    );
    if (!quota) continue;
    const posts = ctx.postsByMonth.get(month.id) ?? [];
    const types: Array<['reels' | 'photos' | 'carousels' | 'stories' | 'videos' | 'graphics', number | null, string]> = [
      ['reels', quota.reels_target, 'reel'],
      ['photos', quota.photos_target, 'photo'],
      ['carousels', quota.carousels_target, 'carousel'],
      ['stories', quota.stories_target, 'story'],
      ['videos', quota.videos_target, 'video'],
      ['graphics', quota.graphics_target, 'graphic'],
    ];
    const daysLeft = differenceInCalendarDays(monthEndDate, ctx.today);
    if (daysLeft > 21) continue; // only nag in the back half of the month
    for (const [label, target, ct] of types) {
      if (target == null || target === 0) continue;
      const planned = posts.filter(p => p.content_type === (ct as any)).length;
      if (planned >= target) continue;
      drafts.push({
        kind: 'coverage_gap',
        severity: daysLeft <= 7 ? 'bad' : 'warn',
        dedup_key: `coverage:${month.id}:${label}`,
        title: `Short on ${label}: ${client.name}`,
        detail: `${planned}/${target} planned with ${daysLeft}d left in the month.`,
        link_url: `/clients/${client.slug}/months/${month.month.slice(0, 7)}/planning`,
        audience_role: 'strategy',
        related_client_id: client.id,
        related_month_id: month.id,
      });
    }
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Asset overdue — captured post nearing go-live with no asset URL.
// ─────────────────────────────────────────────────────────────────────────
export function detectAssetOverdue(ctx: DetectorContext): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  for (const p of ctx.posts) {
    if (p.status !== 'captured') continue;
    if (p.asset_url && p.asset_url.trim()) continue;
    const d = parseISO(p.post_date);
    const days = differenceInCalendarDays(d, ctx.today);
    if (days > 5 || days < 0) continue;
    const month = ctx.monthById.get(p.month_id);
    const client = month ? ctx.clientById.get(month.client_id) : null;
    drafts.push({
      kind: 'asset_overdue',
      severity: days <= 2 ? 'bad' : 'warn',
      dedup_key: `asset_overdue:${p.id}`,
      title: `Edit overdue: ${client?.name ?? 'Post'} · ${format(d, 'EEE MMM d')}`,
      detail: `Captured but no asset linked yet (${days}d to go-live).`,
      link_url: linkPlanning(client, month),
      audience_role: 'editor',
      related_post_id: p.id,
      related_client_id: client?.id ?? null,
      related_month_id: p.month_id,
    });
  }
  return drafts;
}

// ─────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────
function linkPlanning(client: Client | null | undefined, month: MonthRow | null | undefined) {
  if (!client || !month) return null;
  return `/clients/${client.slug}/months/${month.month.slice(0, 7)}/planning`;
}
function linkProduction(client: Client | null | undefined, month: MonthRow | null | undefined) {
  if (!client || !month) return null;
  return `/clients/${client.slug}/months/${month.month.slice(0, 7)}/production`;
}

function nextMonthStart(today: Date): Date {
  const d = new Date(today);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseCadenceTarget(cadence: string | null | undefined): number | null {
  if (!cadence) return null;
  // "3x Per-week IG + FB" → 12
  const m = cadence.match(/(\d+)\s*x\s*(?:\/|per[\-\s]?)?(week|wk|day|month)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('w') || unit === 'wk') return n * 4;
  if (unit.startsWith('d')) return n * 30;
  return n;
}
