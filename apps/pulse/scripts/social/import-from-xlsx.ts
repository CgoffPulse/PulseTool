#!/usr/bin/env tsx
/**
 * Reads the existing Pulse_Social_Monthly_Template.xlsx and seeds Supabase
 * with clients, shoot templates, holidays, the strategic frame, content quotas,
 * and the May 2026 ONSC plan that's already filled in.
 *
 * Idempotent: re-running upserts existing rows by stable keys.
 *
 * Usage:
 *   pnpm run import ~/Downloads/Pulse_Social_Monthly_Template.xlsx
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import type {
  ContentType,
  Pillar,
  ShootClientScope,
  ClientFit,
} from '../../lib/social/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env. Copy .env.example to .env.local first.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const argPath = process.argv[2];
if (!argPath) {
  console.error('Usage: pnpm import <path-to-xlsx>');
  process.exit(1);
}

async function main() {
  const file = await readFile(path.resolve(argPath));
  const wb = XLSX.read(file, { type: 'buffer', cellDates: true });

  console.log('Sheets:', wb.SheetNames.join(', '));

  // 1. Clients
  const clients = await upsertClients();
  const onsc = clients.find(c => c.slug === 'onsc')!;
  const pueblito = clients.find(c => c.slug === 'el_pueblito')!;

  // 2. Shoot templates from the "Shoot Templates" sheet
  await importShootTemplates(wb);

  // 3. Holidays
  await importHolidays(wb);

  // 4. Strategic frames (per-client quarter row + content quotas)
  await importStrategicFrames(wb, { onsc: onsc.id, el_pueblito: pueblito.id });

  // 5. May 2026 ONSC plan: month, shoots, posts
  await importOnscMay2026(wb, onsc.id);

  console.log('\n✔ Import complete.');
}

// ---------------------------------------------------------------------------
// Cell-address helpers — mirror the spreadsheet's actual A1-style references
// so column/row numbers in this file match what you see in Excel.
// ---------------------------------------------------------------------------

function cellVal(ws: XLSX.WorkSheet, addr: string): any {
  const c = ws[addr];
  return c == null ? null : c.v;
}

function colLetter(col: number): string {
  // 1-based: 1 -> A, 2 -> B, ..., 27 -> AA
  let s = '';
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

function cellByRC(ws: XLSX.WorkSheet, row: number, col: number): any {
  return cellVal(ws, `${colLetter(col)}${row}`);
}

// ---------------------------------------------------------------------------

async function upsertClients() {
  const rows = [
    { slug: 'onsc', name: 'Ozark Natural Steak Co.', color: '#7c2d12' },
    { slug: 'el_pueblito', name: 'El Pueblito', color: '#b45309' },
  ];
  const { data, error } = await sb
    .from('clients')
    .upsert(rows, { onConflict: 'slug' })
    .select('*');
  if (error) throw error;
  console.log(`✔ clients: ${data?.length}`);
  return data!;
}

// ---------------------------------------------------------------------------

async function importShootTemplates(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Shoot Templates'];
  if (!ws) return;
  // Header at row 5, data rows 6..N
  const payload: any[] = [];
  const seen = new Set<string>();
  for (let r = 6; r <= 50; r++) {
    const name = cellByRC(ws, r, 2); // column B
    if (!name) continue;
    const nameStr = String(name).trim();
    if (!nameStr || seen.has(nameStr)) continue;
    seen.add(nameStr);
    const scope = String(cellByRC(ws, r, 4) ?? '').toLowerCase();
    const client_scope: ShootClientScope = scope.includes('onsc')
      ? 'onsc'
      : scope.includes('pueblito')
      ? 'el_pueblito'
      : 'either';
    payload.push({
      name: nameStr,
      duration: cellByRC(ws, r, 3) ? String(cellByRC(ws, r, 3)).trim() : null,
      client_scope,
      required_capture_list: cellByRC(ws, r, 5) ? String(cellByRC(ws, r, 5)) : null,
      produces_reels: Number(cellByRC(ws, r, 6) ?? 0),
      produces_photos: Number(cellByRC(ws, r, 7) ?? 0),
      produces_carousels: Number(cellByRC(ws, r, 8) ?? 0),
      produces_stories: Number(cellByRC(ws, r, 9) ?? 0),
      produces_videos: Number(cellByRC(ws, r, 10) ?? 0),
      produces_graphics: Number(cellByRC(ws, r, 11) ?? 0),
    });
  }
  const { error } = await sb.from('shoot_templates').upsert(payload, { onConflict: 'name' });
  if (error) throw error;
  console.log(`✔ shoot_templates: ${payload.length}`);
}

async function importHolidays(wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Holiday & Key Dates'];
  if (!ws) return;
  // Header at row 5; rows 6.. until "CLIENT-SPECIFIC DATES" header.
  const payload: any[] = [];
  for (let r = 6; r <= 50; r++) {
    const dateLabel = cellByRC(ws, r, 2); // column B
    const event = cellByRC(ws, r, 3); // column C
    if (!dateLabel || !event) continue;
    if (String(dateLabel).includes('CLIENT-SPECIFIC')) break;
    const fit = String(cellByRC(ws, r, 4) ?? '').toLowerCase();
    const client_fit: ClientFit = fit === 'onsc'
      ? 'onsc'
      : fit.includes('pueblito')
      ? 'el_pueblito'
      : 'both';
    payload.push({
      date_label: String(dateLabel),
      event: String(event),
      client_fit,
      content_angle: cellByRC(ws, r, 5) ? String(cellByRC(ws, r, 5)) : null,
      is_recurring: true,
    });
  }
  await sb.from('holidays').delete().is('client_specific_client_id', null);
  if (payload.length) {
    const { error } = await sb.from('holidays').insert(payload);
    if (error) throw error;
  }
  console.log(`✔ holidays: ${payload.length}`);
}

async function importStrategicFrames(
  wb: XLSX.WorkBook,
  ids: { onsc: string; el_pueblito: string }
) {
  const ws = wb.Sheets['Strategic Frame'];
  if (!ws) return;
  // ONSC at columns B/C, El Pueblito at columns E/F. Rows 6..17 hold strategy
  // fields; row 30 has Min Lead Time.

  const onscFrame = {
    quarter: textOrNull(cellByRC(ws, 6, 3)) ?? 'Q1',
    goal_90day: textOrNull(cellByRC(ws, 7, 3)),
    primary_audience: textOrNull(cellByRC(ws, 8, 3)),
    role_of_social: textOrNull(cellByRC(ws, 9, 3)),
    pillar_1_name: textOrNull(cellByRC(ws, 10, 3)),
    pillar_2_name: textOrNull(cellByRC(ws, 11, 3)),
    pillar_3_name: textOrNull(cellByRC(ws, 12, 3)),
    brand_voice: textOrNull(cellByRC(ws, 14, 3)),
    avoid: textOrNull(cellByRC(ws, 15, 3)),
    cadence: textOrNull(cellByRC(ws, 16, 3)),
    contracted_shoots_per_month: numOrNull(cellByRC(ws, 17, 3)),
  };
  const pueblitoFrame = {
    quarter: textOrNull(cellByRC(ws, 6, 6)) ?? 'Q2 2026 (Apr - Jun)',
    goal_90day: textOrNull(cellByRC(ws, 7, 6)),
    primary_audience: textOrNull(cellByRC(ws, 8, 6)),
    role_of_social: textOrNull(cellByRC(ws, 9, 6)),
    pillar_1_name: textOrNull(cellByRC(ws, 10, 6)),
    pillar_2_name: textOrNull(cellByRC(ws, 11, 6)),
    pillar_3_name: textOrNull(cellByRC(ws, 12, 6)),
    brand_voice: textOrNull(cellByRC(ws, 14, 6)),
    avoid: textOrNull(cellByRC(ws, 15, 6)),
    cadence: textOrNull(cellByRC(ws, 16, 6)),
    contracted_shoots_per_month: numOrNull(cellByRC(ws, 17, 6)),
  };
  const minLead = numOrNull(cellByRC(ws, 30, 3)) ?? 5;

  for (const [client_id, f] of [
    [ids.onsc, onscFrame],
    [ids.el_pueblito, pueblitoFrame],
  ] as const) {
    const { error } = await sb
      .from('strategic_frames')
      .upsert(
        { client_id, ...f, min_lead_time_days: minLead },
        { onConflict: 'client_id,quarter' }
      );
    if (error) throw error;
  }
  console.log('✔ strategic_frames: 2');

  // Quotas — rows 21..26, ONSC col C, El Pueblito col F
  const month = '2026-05-01';
  const quotaPayload = [
    {
      client_id: ids.onsc,
      month,
      reels_target: numOrNull(cellByRC(ws, 21, 3)),
      photos_target: numOrNull(cellByRC(ws, 22, 3)),
      carousels_target: numOrNull(cellByRC(ws, 23, 3)),
      stories_target: numOrNull(cellByRC(ws, 24, 3)),
      videos_target: numOrNull(cellByRC(ws, 25, 3)),
      graphics_target: numOrNull(cellByRC(ws, 26, 3)),
    },
    {
      client_id: ids.el_pueblito,
      month,
      reels_target: numOrNull(cellByRC(ws, 21, 6)),
      photos_target: numOrNull(cellByRC(ws, 22, 6)),
      carousels_target: numOrNull(cellByRC(ws, 23, 6)),
      stories_target: numOrNull(cellByRC(ws, 24, 6)),
      videos_target: numOrNull(cellByRC(ws, 25, 6)),
      graphics_target: numOrNull(cellByRC(ws, 26, 6)),
    },
  ];
  const { error } = await sb
    .from('content_quotas')
    .upsert(quotaPayload, { onConflict: 'client_id,month' });
  if (error) throw error;
  console.log('✔ content_quotas: 2');
}

// ---------------------------------------------------------------------------

async function importOnscMay2026(wb: XLSX.WorkBook, clientId: string) {
  const month = '2026-05-01';

  await sb.from('months').upsert({ client_id: clientId, month }, { onConflict: 'client_id,month' });
  const { data: monthRow } = await sb
    .from('months')
    .select('id')
    .eq('client_id', clientId)
    .eq('month', month)
    .single();
  if (!monthRow) throw new Error('month row missing');
  const monthId = monthRow.id as string;

  await sb.from('posts').delete().eq('month_id', monthId);
  await sb.from('shoots').delete().eq('month_id', monthId);

  const { data: tpls } = await sb.from('shoot_templates').select('id,name');
  const tplByName = new Map((tpls ?? []).map(t => [String(t.name), t.id as string]));

  // Shoots from Production Plan rows 10..17 (Shoot 1..8). Cols B..I.
  const ppWs = wb.Sheets['ONSC - Production Plan'];
  const shoots: any[] = [];
  if (ppWs) {
    for (let n = 1; n <= 8; n++) {
      const r = 9 + n; // row 10 = Shoot 1
      const tplName = textOrNull(cellByRC(ppWs, r, 3));
      const dateCell = cellByRC(ppWs, r, 4);
      const date = dateCell instanceof Date ? dateCell.toISOString().slice(0, 10) : null;
      const time = textOrNull(cellByRC(ppWs, r, 5)) ?? formatTime(cellByRC(ppWs, r, 5));
      const location = textOrNull(cellByRC(ppWs, r, 6));
      const assigned = textOrNull(cellByRC(ppWs, r, 7));
      const assetRaw = String(cellByRC(ppWs, r, 9) ?? '')
        .toLowerCase()
        .replace(' ', '_');
      const asset_status =
        assetRaw === 'scheduled' || assetRaw === 'captured' || assetRaw === 'delivered'
          ? assetRaw
          : 'not_scheduled';
      if (!tplName && !date && !location && !assigned) continue;
      shoots.push({
        month_id: monthId,
        bundle_number: n,
        shoot_template_id: tplName ? tplByName.get(tplName) ?? null : null,
        scheduled_date: date,
        scheduled_time: time,
        location,
        assigned_to: assigned,
        asset_status,
      });
    }
  }
  let shootByBundle = new Map<number, string>();
  if (shoots.length) {
    const { data, error } = await sb.from('shoots').insert(shoots).select('*');
    if (error) throw error;
    shootByBundle = new Map((data ?? []).map(s => [s.bundle_number as number, s.id as string]));
  }
  console.log(`✔ shoots: ${shoots.length}`);

  // Posts from Planning sheet rows 9..N. Cols B..J.
  const planWs = wb.Sheets['ONSC - Planning'];
  const posts: any[] = [];
  if (planWs) {
    for (let r = 9; r <= 200; r++) {
      const dateCell = cellByRC(planWs, r, 2); // column B
      if (!dateCell) continue;
      const date = dateCell instanceof Date ? dateCell.toISOString().slice(0, 10) : null;
      if (!date) continue;
      const ctRaw = String(cellByRC(planWs, r, 7) ?? '').toLowerCase();
      const content_type = mapContentType(ctRaw);
      if (!content_type) continue;
      const pillarRaw = String(cellByRC(planWs, r, 6) ?? '').toLowerCase().replace(/\s+/g, '');
      const pillar: Pillar | null =
        pillarRaw === 'p1' || pillarRaw === 'p2' || pillarRaw === 'p3'
          ? (pillarRaw as Pillar)
          : null;
      const bundleRaw = String(cellByRC(planWs, r, 9) ?? '');
      const m = bundleRaw.match(/Shoot\s*(\d+)/i);
      const shoot_id = m ? shootByBundle.get(Number(m[1])) ?? null : null;
      posts.push({
        month_id: monthId,
        post_date: date,
        post_time: formatTime(cellByRC(planWs, r, 4)),
        platform: textOrNull(cellByRC(planWs, r, 5)),
        pillar,
        content_type,
        description: textOrNull(cellByRC(planWs, r, 8)),
        shoot_id,
        status: 'planned',
        sort_index: r,
      });
    }
  }
  if (posts.length) {
    const { error } = await sb.from('posts').insert(posts);
    if (error) throw error;
  }
  console.log(`✔ posts (ONSC May 2026): ${posts.length}`);
}

// ---------------------------------------------------------------------------

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(v: any): string | null {
  if (v == null) return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith('[') && s.endsWith(']')) return null;
  return s;
}

function mapContentType(s: string): ContentType | null {
  switch (s.trim()) {
    case 'reel':
    case 'reels':
      return 'reel';
    case 'photo':
    case 'photos':
      return 'photo';
    case 'carousel':
    case 'carousels':
      return 'carousel';
    case 'story':
    case 'stories':
      return 'story';
    case 'video':
    case 'videos':
      return 'video';
    case 'graphic':
    case 'graphics':
      return 'graphic';
    default:
      return null;
  }
}

function formatTime(v: any): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const hh = String(v.getUTCHours()).padStart(2, '0');
    const mm = String(v.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const s = String(v).trim();
  return s || null;
}

main().catch(err => {
  console.error('\n✖ Import failed:', err);
  process.exit(1);
});
