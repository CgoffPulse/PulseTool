import { addDays, format, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  coverageRows,
  leadTimeStatus,
  monthKpis,
  validationGates,
} from './computations';
import type {
  ContentType,
  MonthContext,
  Post,
  ShootTemplate,
  ShootWithTemplate,
} from './types';

// ----------------------------------------------------------------------------
// Test fixtures derived from the spreadsheet's ONSC May 2026 plan and the
// Shoot Templates sheet. Only the fields the computations actually read are
// populated; identifiers are synthetic.
// ----------------------------------------------------------------------------

const tplBase = {
  id: 't',
  name: 'X',
  duration: null,
  client_scope: 'either' as const,
  required_capture_list: null,
  produces_reels: 0,
  produces_photos: 0,
  produces_carousels: 0,
  produces_stories: 0,
  produces_videos: 0,
  produces_graphics: 0,
};

const TEMPLATES: Record<string, ShootTemplate> = {
  ranch: { ...tplBase, id: 't_ranch', name: 'Ranch Shoot', produces_reels: 1, produces_photos: 4, produces_carousels: 1, produces_stories: 3 },
  studio: { ...tplBase, id: 't_studio', name: 'Studio Product Session', produces_reels: 2, produces_photos: 6, produces_carousels: 1 },
  partner: { ...tplBase, id: 't_partner', name: 'Restaurant Partner Visit', produces_reels: 1, produces_photos: 3, produces_carousels: 1, produces_stories: 1 },
  lunch: { ...tplBase, id: 't_lunch', name: 'Restaurant Lunch Service', produces_reels: 1, produces_photos: 5, produces_carousels: 1, produces_stories: 1 },
  dinner: { ...tplBase, id: 't_dinner', name: 'Restaurant Dinner Service', produces_reels: 1, produces_photos: 5, produces_carousels: 1, produces_stories: 3 },
};

// 5 shoots — matches the May 2026 ONSC Production Plan rows 10-14.
// Shoot 5 has no template assigned in the spreadsheet, so we leave template null.
const SHOOTS: ShootWithTemplate[] = [
  { id: 's1', month_id: 'm', bundle_number: 1, shoot_template_id: TEMPLATES.partner.id, scheduled_date: '2026-04-29', scheduled_time: '2:00 - 3:00 PM', location: 'OAK Steak House', assigned_to: 'Trey', assigned_person_id: null, asset_status: 'scheduled', drive_folder_url: null, notes: null, piggyback_on_shoot_id: null, template: TEMPLATES.partner },
  { id: 's2', month_id: 'm', bundle_number: 2, shoot_template_id: TEMPLATES.lunch.id, scheduled_date: '2026-05-05', scheduled_time: '14:00', location: 'Tusk And Trotter', assigned_to: 'Trey', assigned_person_id: null, asset_status: 'not_scheduled', drive_folder_url: null, notes: null, piggyback_on_shoot_id: null, template: TEMPLATES.lunch },
  { id: 's3', month_id: 'm', bundle_number: 3, shoot_template_id: TEMPLATES.ranch.id, scheduled_date: '2026-05-11', scheduled_time: '18:00', location: 'Oklahoma Ranch', assigned_to: 'Trey', assigned_person_id: null, asset_status: 'not_scheduled', drive_folder_url: null, notes: null, piggyback_on_shoot_id: null, template: TEMPLATES.ranch },
  { id: 's4', month_id: 'm', bundle_number: 4, shoot_template_id: TEMPLATES.studio.id, scheduled_date: '2026-05-09', scheduled_time: 'All Day', location: 'Pulse Office', assigned_to: 'Trey', assigned_person_id: null, asset_status: 'not_scheduled', drive_folder_url: null, notes: null, piggyback_on_shoot_id: null, template: TEMPLATES.studio },
  { id: 's5', month_id: 'm', bundle_number: 5, shoot_template_id: null, scheduled_date: null, scheduled_time: null, location: null, assigned_to: null, assigned_person_id: null, asset_status: 'not_scheduled', drive_folder_url: null, notes: null, piggyback_on_shoot_id: null, template: null },
];

// Posts mirroring rows 9-53 of the ONSC Planning sheet.
// Format: [date, content_type, shoot_bundle_number_or_0]. Values match the spreadsheet.
const POST_SPECS: Array<[string, ContentType, number]> = [
  ['2026-05-01', 'carousel', 1],
  ['2026-05-01', 'story',    0],
  ['2026-05-02', 'story',    0],
  ['2026-05-03', 'story',    0],
  ['2026-05-04', 'photo',    0],
  ['2026-05-04', 'story',    0],
  ['2026-05-06', 'story',    0],
  ['2026-05-06', 'story',    0],
  ['2026-05-06', 'photo',    0],
  ['2026-05-07', 'reel',     0],
  ['2026-05-08', 'graphic',  2],
  ['2026-05-08', 'story',    0],
  ['2026-05-09', 'story',    0],
  ['2026-05-10', 'story',    3],
  ['2026-05-11', 'video',    0],
  ['2026-05-11', 'story',    0],
  ['2026-05-12', 'reel',     0],
  ['2026-05-13', 'carousel', 0],
  ['2026-05-13', 'story',    0],
  ['2026-05-14', 'story',    4],
  ['2026-05-15', 'carousel', 0],
  ['2026-05-15', 'story',    4],
  ['2026-05-16', 'story',    0],
  ['2026-05-17', 'story',    3],
  ['2026-05-18', 'carousel', 0],
  ['2026-05-18', 'story',    0],
  ['2026-05-19', 'story',    0],
  ['2026-05-20', 'photo',    5],
  ['2026-05-20', 'story',    5],
  ['2026-05-21', 'story',    0],
  ['2026-05-22', 'story',    0],
  ['2026-05-22', 'graphic',  4],
  ['2026-05-23', 'story',    4],
  ['2026-05-24', 'story',    0],
  ['2026-05-25', 'video',    0],
  ['2026-05-25', 'graphic',  0],
  ['2026-05-26', 'photo',    0],
  ['2026-05-27', 'photo',    4],
  ['2026-05-27', 'graphic',  0],
  ['2026-05-28', 'graphic',  0],
  ['2026-05-29', 'video',    0],
  ['2026-05-29', 'story',    0],
  ['2026-05-30', 'story',    0],
  ['2026-05-31', 'story',    0],
];

const POSTS: Post[] = POST_SPECS.map(([date, type, bundle], i) => ({
  id: `p${i}`,
  month_id: 'm',
  post_date: date,
  post_time: null,
  platform: 'Both (IG+FB)',
  pillar: null,
  content_type: type,
  description: null,
  shoot_id: bundle === 0 ? null : `s${bundle}`,
  status: 'planned',
  asset_ready: false,
  asset_url: null,
  owner_person_id: null,
  sort_index: i,
}));

const ctx: MonthContext = {
  month: { id: 'm', client_id: 'c', month: '2026-05-01', cadence_override: null, status: 'draft' },
  client: { id: 'c', name: 'ONSC', slug: 'onsc', color: '#000', archived: false },
  strategic_frame: {
    id: 'sf',
    client_id: 'c',
    quarter: 'Q1',
    quarter_start_date: null,
    goal_90day: null,
    primary_audience: null,
    role_of_social: null,
    brand_voice: null,
    avoid: null,
    pillar_1_name: null, pillar_1_desc: null,
    pillar_2_name: null, pillar_2_desc: null,
    pillar_3_name: null, pillar_3_desc: null,
    pillar_mix: { p1: 33, p2: 33, p3: 34 },
    cadence: null,
    contracted_shoots_per_month: 4,
    min_lead_time_days: 5,
  },
  quota: {
    id: 'q',
    client_id: 'c',
    month: '2026-05-01',
    reels_target: 6,
    photos_target: 40,
    carousels_target: 5,
    stories_target: 28,
    videos_target: 2,
    graphics_target: 8,
  },
  shoots: SHOOTS,
  posts: POSTS,
};

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('monthKpis', () => {
  it('matches spreadsheet header counts', () => {
    const k = monthKpis(ctx);
    expect(k.contracted_shoots).toBe(4);
    expect(k.total_posts).toBe(POSTS.length); // every row in the planning sheet
    const viaShoots = POSTS.filter(p => p.shoot_id !== null).length;
    expect(k.posts_via_shoots).toBe(viaShoots);
    expect(k.posts_via_no_shoot).toBe(POSTS.length - viaShoots);
  });
});

describe('coverageRows', () => {
  const rows = coverageRows(ctx);
  const byType = (t: ContentType) => rows.find(r => r.content_type === t)!;

  it('counts planned per content type', () => {
    expect(byType('reel').planned).toBe(POSTS.filter(p => p.content_type === 'reel').length);
    expect(byType('photo').planned).toBe(POSTS.filter(p => p.content_type === 'photo').length);
    expect(byType('carousel').planned).toBe(POSTS.filter(p => p.content_type === 'carousel').length);
    expect(byType('story').planned).toBe(POSTS.filter(p => p.content_type === 'story').length);
    expect(byType('video').planned).toBe(POSTS.filter(p => p.content_type === 'video').length);
    expect(byType('graphic').planned).toBe(POSTS.filter(p => p.content_type === 'graphic').length);
  });

  it('caps capacity at contracted shoot count (4 of 5 shoots)', () => {
    // Capacity = sum across shoots 1..4 of template capacity for that content type.
    // Reels: partner(1) + lunch(1) + ranch(1) + studio(2) = 5
    expect(byType('reel').capacity).toBe(5);
    // Photos: 3 + 5 + 4 + 6 = 18
    expect(byType('photo').capacity).toBe(18);
    // Carousels: 1 + 1 + 1 + 1 = 4
    expect(byType('carousel').capacity).toBe(4);
    // Stories: 1 + 1 + 3 + 0 = 5
    expect(byType('story').capacity).toBe(5);
    // Videos: 0
    expect(byType('video').capacity).toBe(0);
    // Graphics: 0
    expect(byType('graphic').capacity).toBe(0);
  });

  it('flags short_on_plan where planned < target', () => {
    // photos: planned 4, target 40 -> short
    expect(byType('photo').status).toBe('short_on_plan');
    // stories: planned 22-ish, target 28 -> short
    expect(byType('story').status).toBe('short_on_plan');
  });

  it('computes gap as max(0, planned - capacity) for every row', () => {
    for (const r of rows) {
      expect(r.gap).toBe(Math.max(0, r.planned - r.capacity));
    }
  });

  it('flags carousels as short_on_plan (planned 4, target 5)', () => {
    const c = byType('carousel');
    expect(c.planned).toBe(4);
    expect(c.target).toBe(5);
    expect(c.status).toBe('short_on_plan');
  });
});

describe('validationGates', () => {
  it('returns 7 gates', () => {
    expect(validationGates(ctx)).toHaveLength(7);
  });

  it('passes gates 1-4 with current fixtures', () => {
    const gates = validationGates(ctx);
    expect(gates[0].status).toBe('ok'); // contracted set = 4
    expect(gates[1].status).toBe('ok'); // all 4 contracted shoots have dates
    expect(gates[2].status).toBe('ok'); // all 4 contracted shoots have types
    expect(gates[3].status).toBe('ok'); // all 4 assigned to Trey
  });

  it('fixes gate 1 when contracted is unset', () => {
    const noFrame = { ...ctx, strategic_frame: null };
    const gates = validationGates(noFrame);
    expect(gates[0].status).toBe('fix');
  });

  it('reports lead-time gate based on actual shoot/post spacing', () => {
    // Shoot 1 (2026-04-29) feeds a 2026-05-01 carousel — 2 days, below the 5-day
    // minimum, so gate 6 reports FIX in this fixture (matches the spreadsheet's
    // "TIGHT" status for that shoot).
    const gates = validationGates(ctx);
    expect(gates[5].name).toBe('Lead time respected');
    expect(gates[5].status).toBe('fix');
  });

  it('passes lead-time gate when no post starts before shoot+min_lead', () => {
    // Strip posts so each shoot has only posts that respect the 5-day minimum.
    const cleanCtx: MonthContext = {
      ...ctx,
      posts: ctx.posts.map(p => {
        if (!p.shoot_id) return p;
        const shoot = ctx.shoots.find(s => s.id === p.shoot_id);
        if (!shoot?.scheduled_date) return { ...p, shoot_id: null };
        // Push every shoot-linked post out 30 days from its shoot date.
        const d = parseISO(shoot.scheduled_date);
        const safe = addDays(d, 30);
        return { ...p, post_date: format(safe, 'yyyy-MM-dd') };
      }),
    };
    const gates = validationGates(cleanCtx);
    expect(gates[5].status).toBe('ok');
  });
});

describe('leadTimeStatus', () => {
  it('returns no_posts for a dated shoot with nothing linked to it', () => {
    const orphan: ShootWithTemplate = {
      ...SHOOTS[4],
      id: 's_orphan',
      scheduled_date: '2026-05-25',
    };
    expect(leadTimeStatus(orphan, POSTS, 5)).toEqual({ kind: 'no_posts' });
  });

  it('returns no_date for a shoot without scheduled_date', () => {
    const noDate = { ...SHOOTS[0], scheduled_date: null };
    expect(leadTimeStatus(noDate, POSTS, 5).kind).toBe('no_date');
  });

  it('detects tight lead time when posts run before shoot+min_lead', () => {
    const earlyPost: Post = { ...POSTS[0], shoot_id: 's2', post_date: '2026-05-06' };
    const result = leadTimeStatus(SHOOTS[1], [earlyPost], 5);
    expect(result.kind).toBe('tight');
  });
});
