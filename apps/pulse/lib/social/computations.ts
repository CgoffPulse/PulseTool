import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  CONTENT_TYPES,
  type ContentType,
  type MonthContext,
  type Post,
  type Shoot,
  type ShootTemplate,
  type ShootWithTemplate,
} from './types';

const TEMPLATE_FIELD: Record<ContentType, keyof ShootTemplate> = {
  reel: 'produces_reels',
  photo: 'produces_photos',
  carousel: 'produces_carousels',
  story: 'produces_stories',
  video: 'produces_videos',
  graphic: 'produces_graphics',
};

export function shootCapacity(template: ShootTemplate | null, contentType: ContentType): number {
  if (!template) return 0;
  return (template[TEMPLATE_FIELD[contentType]] as number) ?? 0;
}

export function postsForShoot(posts: Post[], shootId: string): Post[] {
  return posts.filter(p => p.shoot_id === shootId);
}

export function postsByContentType(posts: Post[], type: ContentType): Post[] {
  return posts.filter(p => p.content_type === type);
}

// ============================================================================
// Coverage rows — one per content type
// ============================================================================

export type CoverageStatus = 'ok' | 'short_on_plan' | 'gap_to_fill' | 'over_capacity' | 'no_target';

export interface CoverageRow {
  content_type: ContentType;
  target: number | null;
  planned: number;
  from_shoots: number;
  capacity: number;
  gap: number;
  status: CoverageStatus;
  action: string;
}

export function coverageRow(args: {
  content_type: ContentType;
  target: number | null;
  posts: Post[];
  shoots: ShootWithTemplate[];
  contracted_shoot_count: number | null;
}): CoverageRow {
  const { content_type, target, posts, shoots, contracted_shoot_count } = args;

  const typePosts = postsByContentType(posts, content_type);
  const planned = typePosts.length;
  const fromShoots = typePosts.filter(p => p.shoot_id !== null).length;

  // Capacity sums template capacity for shoots within the contracted count.
  const usableShoots = shoots
    .slice()
    .sort((a, b) => a.bundle_number - b.bundle_number)
    .filter(s =>
      contracted_shoot_count == null ? true : s.bundle_number <= contracted_shoot_count
    );
  const capacity = usableShoots.reduce(
    (sum, s) => sum + shootCapacity(s.template, content_type),
    0
  );

  const gap = Math.max(0, planned - capacity);

  let status: CoverageStatus;
  let action: string;
  if (target == null) {
    status = 'no_target';
    action = 'Set quota on Strategic Frame';
  } else if (planned < target) {
    status = 'short_on_plan';
    action = `Plan ${target - planned} more ${content_type} post(s) before shipping`;
  } else if (gap === 0) {
    status = 'ok';
    action = capacity > planned ? 'Capacity covers plan' : 'Plan fits capacity exactly';
  } else if (capacity === 0) {
    status = 'gap_to_fill';
    action = `Fill ${gap} via B-roll, repurposing, or UGC`;
  } else {
    status = 'gap_to_fill';
    action = `Shoots cover ${capacity}; fill remaining ${gap} via B-roll/UGC`;
  }

  return {
    content_type,
    target,
    planned,
    from_shoots: fromShoots,
    capacity,
    gap,
    status,
    action,
  };
}

export function coverageRows(ctx: MonthContext): CoverageRow[] {
  const q = ctx.quota;
  const targetMap: Record<ContentType, number | null> = {
    reel: q?.reels_target ?? null,
    photo: q?.photos_target ?? null,
    carousel: q?.carousels_target ?? null,
    story: q?.stories_target ?? null,
    video: q?.videos_target ?? null,
    graphic: q?.graphics_target ?? null,
  };
  return CONTENT_TYPES.map(t =>
    coverageRow({
      content_type: t,
      target: targetMap[t],
      posts: ctx.posts,
      shoots: ctx.shoots,
      contracted_shoot_count: ctx.strategic_frame?.contracted_shoots_per_month ?? null,
    })
  );
}

// ============================================================================
// Lead time
// ============================================================================

export type LeadTimeStatus =
  | { kind: 'ok'; days: number }
  | { kind: 'tight'; days: number }
  | { kind: 'no_posts' }
  | { kind: 'no_date' };

export function leadTimeStatus(
  shoot: Shoot,
  posts: Post[],
  minLeadDays: number
): LeadTimeStatus {
  if (!shoot.scheduled_date) return { kind: 'no_date' };
  const shootDate = parseISO(shoot.scheduled_date);
  const linked = postsForShoot(posts, shoot.id);
  if (linked.length === 0) return { kind: 'no_posts' };
  const earliest = linked
    .map(p => parseISO(p.post_date))
    .reduce((a, b) => (a < b ? a : b));
  const days = differenceInCalendarDays(earliest, shootDate);
  return days >= minLeadDays ? { kind: 'ok', days } : { kind: 'tight', days };
}

// ============================================================================
// Validation gates — the 7 checks from the spreadsheet's Production Plan
// ============================================================================

export type GateStatus = 'ok' | 'fix';

export interface ValidationGate {
  name: string;
  status: GateStatus;
  detail: string;
}

export function validationGates(ctx: MonthContext): ValidationGate[] {
  const sf = ctx.strategic_frame;
  const contracted = sf?.contracted_shoots_per_month ?? null;
  const minLead = sf?.min_lead_time_days ?? 5;
  const contractedShoots = contracted == null
    ? ctx.shoots
    : ctx.shoots.filter(s => s.bundle_number <= contracted);

  const gates: ValidationGate[] = [];

  // 1. Contracted shoots set
  gates.push(
    contracted == null
      ? { name: 'Contracted shoots set', status: 'fix', detail: 'Set Contracted Shoots/Month on Strategic Frame' }
      : { name: 'Contracted shoots set', status: 'ok', detail: `${contracted} contracted` }
  );

  // 2. Shoot dates
  const missingDate = contractedShoots.filter(s => !s.scheduled_date).length;
  gates.push(
    missingDate === 0
      ? { name: 'Shoot dates', status: 'ok', detail: 'All contracted shoots have a date' }
      : { name: 'Shoot dates', status: 'fix', detail: `${missingDate} shoot(s) missing a date` }
  );

  // 3. Shoot types selected
  const missingType = contractedShoots.filter(s => !s.shoot_template_id).length;
  gates.push(
    missingType === 0
      ? { name: 'Shoot types selected', status: 'ok', detail: 'All contracted shoots have a Shoot Type' }
      : { name: 'Shoot types selected', status: 'fix', detail: `${missingType} shoot(s) missing a type` }
  );

  // 4. Shoots assigned to people
  const missingAssignee = contractedShoots.filter(s => !s.assigned_to || s.assigned_to.trim() === '').length;
  gates.push(
    missingAssignee === 0
      ? { name: 'Shoots assigned to people', status: 'ok', detail: 'All contracted shoots assigned' }
      : { name: 'Shoots assigned to people', status: 'fix', detail: `${missingAssignee} shoot(s) unassigned` }
  );

  // 5. Posts properly bundled — every post has either a shoot or is explicitly "No Shoot".
  // In our schema, shoot_id null === No Shoot, so the only failure is a post with content_type
  // unset. We treat all dated rows with content_type as "bundled". Use a stricter check: posts
  // with no content_type or no date.
  const malformed = ctx.posts.filter(p => !p.content_type || !p.post_date).length;
  gates.push(
    malformed === 0
      ? { name: 'Posts properly bundled', status: 'ok', detail: `${ctx.posts.length} posts, all bundled` }
      : { name: 'Posts properly bundled', status: 'fix', detail: `${malformed} post(s) missing date or type` }
  );

  // 6. Lead time respected
  const tight = ctx.shoots.flatMap(s => {
    const lt = leadTimeStatus(s, ctx.posts, minLead);
    return lt.kind === 'tight' ? [s] : [];
  });
  gates.push(
    tight.length === 0
      ? { name: 'Lead time respected', status: 'ok', detail: `${minLead}-day minimum honored` }
      : { name: 'Lead time respected', status: 'fix', detail: `${tight.length} shoot(s) below ${minLead}-day lead` }
  );

  // 7. Coverage gaps resolved — no row in `short_on_plan`
  const rows = coverageRows(ctx);
  const short = rows.filter(r => r.status === 'short_on_plan').length;
  gates.push(
    short === 0
      ? { name: 'Coverage gaps resolved', status: 'ok', detail: 'No coverage rows short on plan' }
      : { name: 'Coverage gaps resolved', status: 'fix', detail: `${short} content type(s) short on plan` }
  );

  return gates;
}

// ============================================================================
// Header KPIs (Production Plan top strip)
// ============================================================================

export interface MonthKpis {
  contracted_shoots: number | null;
  total_posts: number;
  posts_via_shoots: number;
  posts_via_no_shoot: number;
}

export function monthKpis(ctx: MonthContext): MonthKpis {
  const total = ctx.posts.length;
  const viaShoots = ctx.posts.filter(p => p.shoot_id !== null).length;
  return {
    contracted_shoots: ctx.strategic_frame?.contracted_shoots_per_month ?? null,
    total_posts: total,
    posts_via_shoots: viaShoots,
    posts_via_no_shoot: total - viaShoots,
  };
}
