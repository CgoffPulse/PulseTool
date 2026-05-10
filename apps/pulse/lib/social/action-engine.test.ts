import { describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import {
  computeDueDate,
  computePeriodKey,
  detectAssetOverdue,
  detectCoverageGap,
  detectExpectationDue,
  detectLeadTimeTight,
  detectMissingMonthPlan,
  detectMonthGenerationDue,
  detectQuotaShortfall,
  detectRideAlongOpportunity,
  detectShootScheduleConflict,
  detectShootUnassigned,
  detectStuckPosts,
  runDetectors,
  type EngineSnapshot,
} from './action-engine';
import type {
  Client,
  ContentQuota,
  ExpectationCompletion,
  MonthRow,
  Person,
  Post,
  RecurringExpectation,
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
const trey: Person = { id: 'p_trey', name: 'Trey', role: 'field', roles: ['field'], responsibilities: [], color: '#c96f1f', archived: false };
const christian: Person = { id: 'p_chr', name: 'Christian', role: 'strategy', roles: ['strategy'], responsibilities: [], color: '#27452b', archived: false };

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

describe('detectMonthGenerationDue', () => {
  it('fires when current month has ≤10 days left and next month is empty', () => {
    const lateMay = new Date('2026-05-22'); // 9 days to month-end
    const snap = makeSnapshot({ today: lateMay });
    const drafts = detectMonthGenerationDue(ctxFromSnapshot(snap));
    const onscDraft = drafts.find(d => d.related_client_id === 'c1');
    expect(onscDraft).toBeDefined();
    expect(onscDraft!.kind).toBe('month_generation_due');
    expect(onscDraft!.dedup_key).toBe('month_generation_due:c1:2026-06');
    expect(onscDraft!.severity).toBe('warn');
  });

  it('escalates to bad inside the last 5 days', () => {
    const veryLateMay = new Date('2026-05-28'); // 3 days left
    const snap = makeSnapshot({ today: veryLateMay });
    const drafts = detectMonthGenerationDue(ctxFromSnapshot(snap));
    const onscDraft = drafts.find(d => d.related_client_id === 'c1');
    expect(onscDraft!.severity).toBe('bad');
  });

  it('does not fire if next month already has 5+ posts', () => {
    const lateMay = new Date('2026-05-22');
    const juneMonth: MonthRow = { ...may, id: 'm_jun', month: '2026-06-01' };
    const junePosts: Post[] = Array.from({ length: 6 }, (_, i) =>
      post(`pj${i}`, { month_id: 'm_jun', post_date: '2026-06-05' })
    );
    const snap = makeSnapshot({ today: lateMay, months: [may, juneMonth], posts: junePosts });
    expect(detectMonthGenerationDue(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('skips far from month-end', () => {
    const earlyMay = new Date('2026-05-04'); // 27 days left
    const snap = makeSnapshot({ today: earlyMay });
    expect(detectMonthGenerationDue(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectShootScheduleConflict', () => {
  it('fires when one person has two same-day shoots whose 2h windows overlap', () => {
    const snap = makeSnapshot({
      shoots: [
        shoot('s1', { scheduled_date: '2026-05-08', scheduled_time: '10:00', assigned_person_id: 'p_trey' }),
        shoot('s2', { scheduled_date: '2026-05-08', scheduled_time: '11:00', assigned_person_id: 'p_trey', bundle_number: 2 }),
      ],
    });
    const drafts = detectShootScheduleConflict(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('shoot_schedule_conflict');
    expect(drafts[0].audience_person_id).toBe('p_trey');
  });

  it('does not fire when shoots are on different days', () => {
    const snap = makeSnapshot({
      shoots: [
        shoot('s1', { scheduled_date: '2026-05-08', scheduled_time: '10:00', assigned_person_id: 'p_trey' }),
        shoot('s2', { scheduled_date: '2026-05-09', scheduled_time: '10:00', assigned_person_id: 'p_trey', bundle_number: 2 }),
      ],
    });
    expect(detectShootScheduleConflict(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('does not fire when same day but non-overlapping windows', () => {
    const snap = makeSnapshot({
      shoots: [
        shoot('s1', { scheduled_date: '2026-05-08', scheduled_time: '08:00', assigned_person_id: 'p_trey' }),
        shoot('s2', { scheduled_date: '2026-05-08', scheduled_time: '14:00', assigned_person_id: 'p_trey', bundle_number: 2 }),
      ],
    });
    expect(detectShootScheduleConflict(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectRideAlongOpportunity', () => {
  const pulseClient: Client = {
    id: 'c_pulse', name: 'Pulse', slug: 'pulse', color: '#27452b', archived: false,
  };
  const pulseMonth: MonthRow = {
    id: 'm_pulse_may', client_id: 'c_pulse', month: '2026-05-01',
    cadence_override: null, status: 'draft',
  };

  it('fires when an unbundled Pulse post sits within 14 days of a non-Pulse shoot', () => {
    const onscShoot = shoot('s_onsc', {
      scheduled_date: '2026-05-10',
      assigned_person_id: 'p_trey',
    });
    const pulsePost = post('p_pulse', {
      month_id: 'm_pulse_may',
      post_date: '2026-05-12',
      shoot_id: null,
      status: 'planned',
    });
    const snap = makeSnapshot({
      clients: [onsc, pulseClient],
      months: [may, pulseMonth],
      shoots: [onscShoot],
      posts: [pulsePost],
    });
    const drafts = detectRideAlongOpportunity(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('ride_along_opportunity');
    expect(drafts[0].related_client_id).toBe('c_pulse');
    expect(drafts[0].related_shoot_id).toBe('s_onsc');
  });

  it('does not fire when the only nearby shoot is also a Pulse shoot', () => {
    const pulseShoot = shoot('s_pulse', {
      month_id: 'm_pulse_may',
      scheduled_date: '2026-05-10',
    });
    const pulsePost = post('p_pulse', {
      month_id: 'm_pulse_may',
      post_date: '2026-05-12',
      shoot_id: null,
    });
    const snap = makeSnapshot({
      clients: [onsc, pulseClient],
      months: [may, pulseMonth],
      shoots: [pulseShoot],
      posts: [pulsePost],
    });
    expect(detectRideAlongOpportunity(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('does not fire when shoots are >14 days from the Pulse post', () => {
    const onscShoot = shoot('s_onsc', { scheduled_date: '2026-06-10' });
    const pulsePost = post('p_pulse', {
      month_id: 'm_pulse_may',
      post_date: '2026-05-12',
      shoot_id: null,
    });
    const snap = makeSnapshot({
      clients: [onsc, pulseClient],
      months: [may, pulseMonth],
      shoots: [onscShoot],
      posts: [pulsePost],
    });
    expect(detectRideAlongOpportunity(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('detectQuotaShortfall', () => {
  it('fires when planned trails calendar pace by 30%+', () => {
    // Mid-May (15/31 ≈ 48% elapsed). Quota total = 6+40+5+28+2+8 = 89.
    // Expected ≈ 43; only 5 planned → ratio ~0.12 → bad.
    const midMay = new Date('2026-05-15');
    const posts: Post[] = Array.from({ length: 5 }, (_, i) =>
      post(`p${i}`, { post_date: '2026-05-05' })
    );
    const snap = makeSnapshot({ today: midMay, posts });
    const drafts = detectQuotaShortfall(ctxFromSnapshot(snap));
    const draft = drafts.find(d => d.dedup_key === 'quota_shortfall:m_may');
    expect(draft).toBeDefined();
    expect(draft!.severity).toBe('bad');
  });

  it('does not fire when planned matches pace within 30%', () => {
    const midMay = new Date('2026-05-15');
    // ~50% elapsed × 89 ≈ 44 expected; ship 35 → ratio 0.79 → fine.
    const posts: Post[] = Array.from({ length: 35 }, (_, i) =>
      post(`p${i}`, { post_date: '2026-05-05' })
    );
    const snap = makeSnapshot({ today: midMay, posts });
    expect(detectQuotaShortfall(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('does not fire in the first quarter of the month', () => {
    const earlyMay = new Date('2026-05-04');
    const snap = makeSnapshot({ today: earlyMay, posts: [] });
    expect(detectQuotaShortfall(ctxFromSnapshot(snap))).toHaveLength(0);
  });
});

describe('computePeriodKey', () => {
  const may4 = new Date('2026-05-04T08:00:00');
  it('formats monthly as yyyy-mm', () => {
    expect(computePeriodKey(may4, 'monthly')).toBe('2026-05');
  });
  it('formats daily as yyyy-mm-dd', () => {
    expect(computePeriodKey(may4, 'daily')).toBe('2026-05-04');
  });
  it('formats quarterly as yyyy-Qn', () => {
    expect(computePeriodKey(may4, 'quarterly')).toBe('2026-Q2');
  });
  it('formats weekly as yyyy-Www', () => {
    // 2026-05-04 is a Monday → ISO week 19.
    expect(computePeriodKey(may4, 'weekly')).toBe('2026-W19');
  });
});

describe('computeDueDate', () => {
  const may4 = new Date('2026-05-04T08:00:00');
  it('monthly + eom returns last day of current month', () => {
    const d = computeDueDate(may4, 'monthly', 'eom')!;
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(4); // May (0-indexed)
  });
  it('monthly + d25 returns the 25th', () => {
    const d = computeDueDate(may4, 'monthly', 'd25')!;
    expect(d.getDate()).toBe(25);
  });
  it('weekly + friday returns the upcoming Friday', () => {
    const d = computeDueDate(may4, 'weekly', 'friday')!;
    expect(d.getDay()).toBe(5);
    expect(d.getDate()).toBe(8);
  });
  it('quarterly + eoq returns last day of current quarter', () => {
    const d = computeDueDate(may4, 'quarterly', 'eoq')!;
    expect(d.getMonth()).toBe(5); // June
    expect(d.getDate()).toBe(30);
  });
});

describe('detectExpectationDue', () => {
  function expectation(over: Partial<RecurringExpectation> = {}): RecurringExpectation {
    return {
      id: 'exp1',
      title: 'Send next-month social calendar',
      description: 'Finalize and send.',
      cadence: 'monthly',
      due_rule: 'eom',
      warn_days: 10,
      owner_role: 'producer',
      owner_person_id: null,
      severity_warn: 'warn',
      severity_overdue: 'bad',
      link_url: '/admin',
      active: true,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
      ...over,
    };
  }

  it('fires warn within the warn window when not yet completed', () => {
    const lateMay = new Date('2026-05-25'); // 6d to EOM, inside warn=10
    const snap = makeSnapshot({
      today: lateMay,
      expectations: [expectation()],
      completions: [],
    });
    const drafts = detectExpectationDue(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('expectation_due');
    expect(drafts[0].severity).toBe('warn');
    expect(drafts[0].dedup_key).toBe('expectation:exp1:2026-05');
    expect(drafts[0].audience_role).toBe('producer');
  });

  it('escalates to bad severity when overdue', () => {
    // Local-time June 5; due rule d1 puts the due date 4 days back in the same period.
    const june5 = new Date(2026, 5, 5);
    const snap = makeSnapshot({
      today: june5,
      expectations: [expectation({ due_rule: 'd1', warn_days: 5 })],
      completions: [],
    });
    const drafts = detectExpectationDue(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].severity).toBe('bad');
    expect(drafts[0].title).toMatch(/Overdue/);
  });

  it('does not fire when completion exists for the current period', () => {
    const lateMay = new Date('2026-05-25');
    const completion: ExpectationCompletion = {
      id: 'ec1',
      expectation_id: 'exp1',
      period_key: '2026-05',
      completed_at: '2026-05-20T00:00:00Z',
      completed_by: null,
      notes: null,
    };
    const snap = makeSnapshot({
      today: lateMay,
      expectations: [expectation()],
      completions: [completion],
    });
    expect(detectExpectationDue(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('does not fire outside the warn window', () => {
    const earlyMay = new Date('2026-05-04'); // 27d to EOM, outside warn=10
    const snap = makeSnapshot({
      today: earlyMay,
      expectations: [expectation()],
      completions: [],
    });
    expect(detectExpectationDue(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('skips inactive expectations', () => {
    const lateMay = new Date('2026-05-25');
    const snap = makeSnapshot({
      today: lateMay,
      expectations: [expectation({ active: false })],
    });
    expect(detectExpectationDue(ctxFromSnapshot(snap))).toHaveLength(0);
  });

  it('routes via owner_person_id without setting audience_role for non-enum roles', () => {
    const lateMay = new Date('2026-05-25');
    const snap = makeSnapshot({
      today: lateMay,
      expectations: [
        expectation({ owner_role: 'founder', owner_person_id: 'p_chr' }),
      ],
    });
    const drafts = detectExpectationDue(ctxFromSnapshot(snap));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].audience_role).toBeNull();
    expect(drafts[0].audience_person_id).toBe('p_chr');
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
