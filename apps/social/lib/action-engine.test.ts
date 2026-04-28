import { describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import {
  detectAssetOverdue,
  detectCoverageGap,
  detectLeadTimeTight,
  detectMissingMonthPlan,
  detectShootUnassigned,
  detectStuckPosts,
  runDetectors,
  type EngineSnapshot,
} from './action-engine';
import type {
  Client,
  ContentQuota,
  MonthRow,
  Person,
  Post,
  Shoot,
  ShootTemplate,
  StrategicFrame,
} from './types';

// ─────────────────────────────────────────────────────────────────────────
// Synthetic fixture: ONSC May 2026, "today" = 2026-05-04 (Mon).
// ─────────────────────────────────────────────────────────────────────────
const today = new Date('2026-05-04T08:00:00');

const onsc: Client = {
  id: 'c1', name: 'Ozark Natural Steak Co.', slug: 'onsc', color: '#7c2d12', archived: false,
};
const pueblito: Client = {
  id: 'c2', name: 'El Pueblito', slug: 'el_pueblito', color: '#b45309', archived: false,
};
const trey: Person = { id: 'p_trey', name: 'Trey', role: 'field', color: '#c96f1f', archived: false };
const christian: Person = { id: 'p_chr', name: 'Christian', role: 'strategy', color: '#27452b', archived: false };

const may: MonthRow = {
  id: 'm_may', client_id: 'c1', month: '2026-05-01', cadence_override: null, status: 'draft',
};

const tplPartner: ShootTemplate = {
  id: 't_partner', name: 'Restaurant Partner Visit', duration: '90 min', client_scope: 'onsc',
  required_capture_list: 'a\nb', produces_reels: 1, produces_photos: 3, produces_carousels: 1,
  produces_stories: 1, produces_videos: 0, produces_graphics: 0,
};

const frame: StrategicFrame = {
  id: 'f1', client_id: 'c1', quarter: 'Q2 2026', quarter_start_date: null,
  goal_90day: null, primary_audience: null, role_of_social: null,
  brand_voice: null, avoid: null,
  pillar_1_name: null, pillar_1_desc: null, pillar_2_name: null, pillar_2_desc: null,
  pillar_3_name: null, pillar_3_desc: null,
  pillar_mix: { p1: 33, p2: 33, p3: 34 },
  cadence: '3x per week', contracted_shoots_per_month: 4, min_lead_time_days: 5,
};

const quota: ContentQuota = {
  id: 'q1', client_id: 'c1', month: '2026-05-01',
  reels_target: 6, photos_target: 40, carousels_target: 5,
  stories_target: 28, videos_target: 2, graphics_target: 8,
};

function shoot(id: string, opts: Partial<Shoot> = {}): Shoot {
  return {
    id,
    month_id: 'm_may',
    bundle_number: 1,
    shoot_template_id: 't_partner',
    scheduled_date: '2026-04-29',
    scheduled_time: '14:00',
    location: 'OAK Steak House',
    assigned_to: null,
    assigned_person_id: null,
    asset_status: 'scheduled',
    drive_folder_url: null,
    notes: null,
    piggyback_on_shoot_id: null,
    ...opts,
  };
}

function post(id: string, opts: Partial<Post> = {}): Post {
  return {
    id,
    month_id: 'm_may',
    post_date: '2026-05-01',
    post_time: null,
    platform: 'IG + FB',
    pillar: 'p1',
    content_type: 'photo',
    description: null,
    shoot_id: null,
    status: 'planned',
    asset_ready: false,
    asset_url: null,
    owner_person_id: null,
    sort_index: 0,
    ...opts,
  };
}

function makeSnapshot(over: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    today,
    clients: [onsc],
    people: [trey, christian],
    months: [may],
    posts: [],
    shoots: [],
    templates: [tplPartner],
    frames: [frame],
    quotas: [quota],
    ...over,
  };
}

function ctxFromSnapshot(s: EngineSnapshot) {
  // Helper that mirrors the buildContext in the engine. Safe duplication for
  // unit tests so we can call individual detectors directly.
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

// ─────────────────────────────────────────────────────────────────────────

describe('detectStuckPosts', () => {
  it('flags a planned post due this week with a shoot assigned', () => {
    const snap = makeSnapshot({
      posts: [post('p1', { shoot_id: 's1', post_date: '2026-05-06', status: 'planned' })],
      shoots: [shoot('s1')],
    });
    const drafts = detectStuckPosts(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('stuck_post');
    expect(drafts[0].severity).toBe('bad');
    expect(drafts[0].dedup_key).toBe('stuck_post:p1');
  });

  it('skips a post with no shoot — it intentionally has no shoot', () => {
    const snap = makeSnapshot({
      posts: [post('p1', { shoot_id: null, post_date: '2026-05-06', status: 'planned' })],
    });
    expect(detectStuckPosts(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('skips a post outside this week', () => {
    const snap = makeSnapshot({
      posts: [post('p1', { shoot_id: 's1', post_date: '2026-05-25' })],
      shoots: [shoot('s1')],
    });
    expect(detectStuckPosts(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectLeadTimeTight', () => {
  it('flags a shoot whose earliest post is inside the 5-day lead window', () => {
    const snap = makeSnapshot({
      shoots: [shoot('s1', { scheduled_date: '2026-04-29' })],
      posts: [post('p1', { shoot_id: 's1', post_date: '2026-05-01' })], // 2 days
    });
    const drafts = detectLeadTimeTight(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('lead_time_tight');
    expect(drafts[0].dedup_key).toBe('lead_time:s1');
  });

  it('does not flag when lead time is clear', () => {
    const snap = makeSnapshot({
      shoots: [shoot('s1', { scheduled_date: '2026-04-20' })],
      posts: [post('p1', { shoot_id: 's1', post_date: '2026-05-15' })],
    });
    expect(detectLeadTimeTight(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('skips shoots with no linked posts', () => {
    const snap = makeSnapshot({
      shoots: [shoot('s_orphan', { scheduled_date: '2026-04-29' })],
    });
    expect(detectLeadTimeTight(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectMissingMonthPlan', () => {
  // Today is 2026-05-04 → next month is June 2026, ~28 days away → outside window.
  // Move "today" closer to month-end.
  const lateMay = new Date('2026-05-22');

  it('flags a client with empty next month within 14 days of start', () => {
    const snap = makeSnapshot({
      today: lateMay,
      months: [],
      posts: [],
    });
    const drafts = detectMissingMonthPlan(ctxFromSnapshot(snap));
    const onscDraft = drafts.find(d => d.related_client_id === 'c1');
    expect(onscDraft).toBeDefined();
    expect(onscDraft!.kind).toBe('missing_month_plan');
    expect(onscDraft!.dedup_key).toBe('missing_plan:c1:2026-06');
  });

  it('does not flag when next month has plenty of posts', () => {
    const juneMonth: MonthRow = { ...may, id: 'm_jun', month: '2026-06-01' };
    const junePosts: Post[] = Array.from({ length: 12 }, (_, i) =>
      post(`pj${i}`, { month_id: 'm_jun', post_date: '2026-06-05' })
    );
    const snap = makeSnapshot({
      today: lateMay,
      months: [may, juneMonth],
      posts: junePosts,
    });
    const drafts = detectMissingMonthPlan(ctxFromSnapshot(snap));
    expect(drafts.find(d => d.related_client_id === 'c1')).toBeUndefined();
  });
});

describe('detectShootUnassigned', () => {
  it('flags a contracted shoot in next 7 days with no assignee', () => {
    const tomorrow = format(addDays(today, 3), 'yyyy-MM-dd');
    const snap = makeSnapshot({
      shoots: [shoot('s1', { scheduled_date: tomorrow, assigned_person_id: null, assigned_to: null })],
    });
    const drafts = detectShootUnassigned(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('shoot_unassigned');
    expect(drafts[0].audience_role).toBe('producer');
  });

  it('respects legacy text assignment', () => {
    const tomorrow = format(addDays(today, 3), 'yyyy-MM-dd');
    const snap = makeSnapshot({
      shoots: [shoot('s1', { scheduled_date: tomorrow, assigned_to: 'Trey', assigned_person_id: null })],
    });
    expect(detectShootUnassigned(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectAssetOverdue', () => {
  it('flags a captured post within 5 days of go-live with no asset URL', () => {
    const goLive = format(addDays(today, 3), 'yyyy-MM-dd');
    const snap = makeSnapshot({
      posts: [post('p1', { post_date: goLive, status: 'captured', asset_url: null })],
    });
    const drafts = detectAssetOverdue(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('asset_overdue');
  });

  it('does not flag when asset URL exists', () => {
    const goLive = format(addDays(today, 3), 'yyyy-MM-dd');
    const snap = makeSnapshot({
      posts: [
        post('p1', {
          post_date: goLive,
          status: 'captured',
          asset_url: 'https://drive.google.com/whatever',
        }),
      ],
    });
    expect(detectAssetOverdue(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectCoverageGap', () => {
  it('flags a content type below quota in the back half of the month', () => {
    const lateMay = new Date('2026-05-22');
    // Only 2 reels planned vs target 6 → short, with only ~9 days left.
    const reels: Post[] = [
      post('r1', { content_type: 'reel', post_date: '2026-05-05' }),
      post('r2', { content_type: 'reel', post_date: '2026-05-12' }),
    ];
    const snap = makeSnapshot({ today: lateMay, posts: reels });
    const drafts = detectCoverageGap(ctxFromSnapshot(snap));
    const reelGap = drafts.find(d => d.dedup_key === 'coverage:m_may:reels');
    expect(reelGap).toBeDefined();
    expect(reelGap!.severity).toBe('warn'); // ~9d left → warn, not bad
  });

  it('does not nag in the front half of the month', () => {
    const earlyMay = new Date('2026-05-04');
    const snap = makeSnapshot({ today: earlyMay, posts: [] });
    expect(detectCoverageGap(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('runDetectors', () => {
  it('returns an array (smoke)', () => {
    const drafts = runDetectors(makeSnapshot());
    expect(Array.isArray(drafts)).toBe(true);
  });

  it('produces stable dedup_keys (re-running gives the same keys)', () => {
    const snap = makeSnapshot({
      shoots: [shoot('s1', { scheduled_date: '2026-04-29' })],
      posts: [post('p1', { shoot_id: 's1', post_date: '2026-05-01', status: 'planned' })],
    });
    const a = runDetectors(snap).map(d => d.dedup_key).sort();
    const b = runDetectors(snap).map(d => d.dedup_key).sort();
    expect(a).toEqual(b);
  });
});
