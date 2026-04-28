'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from './supabase/server';
import type {
  ContentType,
  Pillar,
  PostStatus,
  ShootAssetStatus,
} from './types';

function revalidateMonth(slug: string, month: string) {
  revalidatePath('/');
  revalidatePath(`/clients/${slug}`);
  revalidatePath(`/clients/${slug}/months/${month}/planning`);
  revalidatePath(`/clients/${slug}/months/${month}/production`);
  revalidatePath(`/clients/${slug}/months/${month}/calendar`);
}

// ============================================================================
// Posts
// ============================================================================

export async function createPost(input: {
  month_id: string;
  post_date: string;
  content_type: ContentType;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const { error } = await sb.from('posts').insert({
    month_id: input.month_id,
    post_date: input.post_date,
    content_type: input.content_type,
  });
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function updatePost(input: {
  id: string;
  client_slug: string;
  month_slug: string;
  patch: Partial<{
    post_date: string;
    post_time: string | null;
    platform: string | null;
    pillar: Pillar | null;
    content_type: ContentType;
    description: string | null;
    shoot_id: string | null;
    status: PostStatus;
    asset_ready: boolean;
    asset_url: string | null;
  }>;
}) {
  const sb = supabaseServer();
  // If asset_url is being set for the first time and status is still planned/captured,
  // auto-advance to `edited` so the pipeline reflects reality without a separate click.
  let patch = { ...input.patch };
  if (
    typeof patch.asset_url === 'string' &&
    patch.asset_url.trim().length > 0 &&
    patch.status == null
  ) {
    const { data: cur } = await sb
      .from('posts')
      .select('status')
      .eq('id', input.id)
      .maybeSingle();
    const s = cur?.status as PostStatus | undefined;
    if (s === 'planned' || s === 'captured') patch.status = 'edited';
  }
  const { error } = await sb.from('posts').update(patch).eq('id', input.id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function deletePost(input: {
  id: string;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const { error } = await sb.from('posts').delete().eq('id', input.id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function bulkCreatePosts(input: {
  month_id: string;
  client_slug: string;
  month_slug: string;
  drafts: Array<{
    post_date: string;
    content_type: ContentType;
    pillar: Pillar | null;
    description: string | null;
  }>;
}) {
  if (input.drafts.length === 0) return { inserted: 0 };
  const sb = supabaseServer();
  const rows = input.drafts.map(d => ({
    month_id: input.month_id,
    post_date: d.post_date,
    content_type: d.content_type,
    pillar: d.pillar,
    description: d.description,
  }));
  const { error, count } = await sb.from('posts').insert(rows, { count: 'exact' });
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
  return { inserted: count ?? rows.length };
}

// ============================================================================
// Shoots
// ============================================================================

export async function createShoot(input: {
  month_id: string;
  bundle_number: number;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('shoots')
    .insert({ month_id: input.month_id, bundle_number: input.bundle_number });
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function updateShoot(input: {
  id: string;
  client_slug: string;
  month_slug: string;
  patch: Partial<{
    shoot_template_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    location: string | null;
    assigned_to: string | null;
    asset_status: ShootAssetStatus;
    drive_folder_url: string | null;
    notes: string | null;
    piggyback_on_shoot_id: string | null;
  }>;
}) {
  const sb = supabaseServer();
  const { error } = await sb.from('shoots').update(input.patch).eq('id', input.id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function deleteShoot(input: {
  id: string;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  // Detach posts first (set shoot_id null) so the foreign key doesn't cascade-orphan them
  await sb.from('posts').update({ shoot_id: null }).eq('shoot_id', input.id);
  const { error } = await sb.from('shoots').delete().eq('id', input.id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

// ============================================================================
// Strategic frame & quotas
// ============================================================================

export async function upsertStrategicFrame(input: {
  client_slug: string;
  client_id: string;
  quarter: string;
  patch: Record<string, any>;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('strategic_frames')
    .upsert(
      { client_id: input.client_id, quarter: input.quarter, ...input.patch },
      { onConflict: 'client_id,quarter' }
    );
  if (error) throw error;
  revalidatePath(`/clients/${input.client_slug}/strategy`);
  revalidatePath(`/clients/${input.client_slug}`);
}

export async function upsertQuota(input: {
  client_slug: string;
  client_id: string;
  month: string; // ISO first-of-month
  patch: Record<string, any>;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('content_quotas')
    .upsert(
      { client_id: input.client_id, month: input.month, ...input.patch },
      { onConflict: 'client_id,month' }
    );
  if (error) throw error;
  const slug = input.month.slice(0, 7);
  revalidatePath(`/clients/${input.client_slug}/strategy`);
  revalidatePath(`/clients/${input.client_slug}/months/${slug}/production`);
  revalidatePath(`/clients/${input.client_slug}/months/${slug}/planning`);
}

// ============================================================================
// Clients
// ============================================================================

export async function createClient(input: { name: string; slug: string; color?: string }) {
  const sb = supabaseServer();
  const { error } = await sb.from('clients').insert({
    name: input.name,
    slug: input.slug,
    color: input.color ?? '#0ea5e9',
  });
  if (error) throw error;
  revalidatePath('/');
}

// ============================================================================
// Shoot templates
// ============================================================================

export async function upsertShootTemplate(input: { id?: string; patch: Record<string, any> }) {
  const sb = supabaseServer();
  if (input.id) {
    const { error } = await sb.from('shoot_templates').update(input.patch).eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('shoot_templates').insert(input.patch);
    if (error) throw error;
  }
  revalidatePath('/shoot-templates');
}

export async function deleteShootTemplate(id: string) {
  const sb = supabaseServer();
  const { error } = await sb.from('shoot_templates').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/shoot-templates');
}

// ============================================================================
// Capture items (per-shoot checklist + extras)
// ============================================================================

export async function seedCaptureItemsFromTemplate(input: {
  shoot_id: string;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const existing = await sb
    .from('capture_items')
    .select('id')
    .eq('shoot_id', input.shoot_id);
  if ((existing.data?.length ?? 0) > 0) return; // idempotent

  const { data: shoot } = await sb
    .from('shoots')
    .select('shoot_template_id')
    .eq('id', input.shoot_id)
    .maybeSingle();
  const tplId = shoot?.shoot_template_id as string | null | undefined;
  if (!tplId) return;
  const { data: tpl } = await sb
    .from('shoot_templates')
    .select('required_capture_list')
    .eq('id', tplId)
    .maybeSingle();
  const list = tpl?.required_capture_list as string | null | undefined;
  if (!list) return;
  const lines = list
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (!lines.length) return;
  const rows = lines.map((label, i) => ({
    shoot_id: input.shoot_id,
    label,
    is_required: true,
    is_captured: false,
    sort_index: i,
  }));
  await sb.from('capture_items').insert(rows);
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function markAllRequiredCaptured(input: {
  shoot_id: string;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('capture_items')
    .update({ is_captured: true, captured_at: now })
    .eq('shoot_id', input.shoot_id)
    .eq('is_required', true)
    .eq('is_captured', false)
    .select('id, linked_post_id');
  if (error) throw error;
  // Cascade: any linked posts in `planned` advance to `captured`.
  const postIds = (data ?? []).map(r => r.linked_post_id).filter((x): x is string => !!x);
  if (postIds.length > 0) {
    const { data: planned } = await sb
      .from('posts')
      .select('id')
      .in('id', postIds)
      .eq('status', 'planned');
    const ids = (planned ?? []).map(p => p.id);
    if (ids.length > 0) {
      await sb.from('posts').update({ status: 'captured' }).in('id', ids);
    }
  }
  revalidateMonth(input.client_slug, input.month_slug);
  return { swept: data?.length ?? 0 };
}

export async function bulkAddDriveUrlsAsExtras(input: {
  shoot_id: string;
  client_slug: string;
  month_slug: string;
  urls: string[];
}) {
  const cleaned = input.urls
    .map(u => u.trim())
    .filter(u => /^https?:\/\//i.test(u));
  if (cleaned.length === 0) return { added: 0 };
  const sb = supabaseServer();
  const max = await sb
    .from('capture_items')
    .select('sort_index')
    .eq('shoot_id', input.shoot_id)
    .order('sort_index', { ascending: false })
    .limit(1);
  let next = ((max.data?.[0]?.sort_index as number) ?? -1) + 1;
  const rows = cleaned.map(url => {
    const label = labelForDriveUrl(url);
    const row = {
      shoot_id: input.shoot_id,
      label,
      is_required: false,
      is_captured: true,
      captured_at: new Date().toISOString(),
      sort_index: next++,
      notes: url,
    };
    return row;
  });
  const { error } = await sb.from('capture_items').insert(rows);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
  return { added: rows.length };
}

function labelForDriveUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('drive.google.com')) {
      const last = u.pathname.split('/').filter(Boolean).pop();
      return `Drive · ${last?.slice(0, 24) ?? 'asset'}`;
    }
    return `${u.hostname.replace(/^www\./, '')} · ${u.pathname.split('/').filter(Boolean).pop()?.slice(0, 24) ?? 'asset'}`;
  } catch {
    return 'Bonus capture';
  }
}

export async function addCaptureItem(input: {
  shoot_id: string;
  client_slug: string;
  month_slug: string;
  label: string;
  is_required?: boolean;
  linked_post_id?: string | null;
}) {
  const sb = supabaseServer();
  const max = await sb
    .from('capture_items')
    .select('sort_index')
    .eq('shoot_id', input.shoot_id)
    .order('sort_index', { ascending: false })
    .limit(1);
  const next = ((max.data?.[0]?.sort_index as number) ?? -1) + 1;
  const { error } = await sb.from('capture_items').insert({
    shoot_id: input.shoot_id,
    label: input.label,
    is_required: input.is_required ?? false,
    is_captured: false,
    sort_index: next,
    linked_post_id: input.linked_post_id ?? null,
  });
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function updateCaptureItem(input: {
  id: string;
  client_slug: string;
  month_slug: string;
  patch: Partial<{
    label: string;
    is_required: boolean;
    is_captured: boolean;
    captured_at: string | null;
    linked_post_id: string | null;
    notes: string | null;
  }>;
}) {
  const sb = supabaseServer();
  const patch: Record<string, any> = { ...input.patch };
  // When marking captured, stamp the time. When unmarking, clear it.
  if ('is_captured' in patch) {
    patch.captured_at = patch.is_captured ? new Date().toISOString() : null;
  }
  const { data: row, error } = await sb
    .from('capture_items')
    .update(patch)
    .eq('id', input.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;

  // Post status auto-advance: if a capture item just got marked captured and it's
  // linked to a post, move that post to `captured` (only if it's still `planned`).
  if (
    row &&
    patch.is_captured === true &&
    row.linked_post_id &&
    typeof row.linked_post_id === 'string'
  ) {
    const cur = await sb
      .from('posts')
      .select('status')
      .eq('id', row.linked_post_id)
      .maybeSingle();
    if (cur.data?.status === 'planned') {
      await sb
        .from('posts')
        .update({ status: 'captured' })
        .eq('id', row.linked_post_id);
    }
  }

  revalidateMonth(input.client_slug, input.month_slug);
}

export async function deleteCaptureItem(input: {
  id: string;
  client_slug: string;
  month_slug: string;
}) {
  const sb = supabaseServer();
  const { error } = await sb.from('capture_items').delete().eq('id', input.id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

// ============================================================================
// People + notifications (Phase 2.1)
// ============================================================================

/**
 * Run the action engine and reconcile the notifications table. Same logic as
 * the cron route, exposed as a Server Action so the in-app "Recompute now"
 * button works without needing the CRON_SECRET (which the cron route requires
 * in production).
 */
export async function regenerateNotifications(): Promise<{
  upserted: number;
  resolved: number;
}> {
  const { runDetectors } = await import('./action-engine');
  const { loadEngineSnapshot } = await import('./queries');
  const sb = supabaseServer();
  const snapshot = await loadEngineSnapshot(new Date());
  const drafts = runDetectors(snapshot);

  let upserted = 0;
  if (drafts.length > 0) {
    const rows = drafts.map(d => ({
      kind: d.kind,
      severity: d.severity,
      dedup_key: d.dedup_key,
      title: d.title,
      detail: d.detail ?? null,
      link_url: d.link_url ?? null,
      audience_role: d.audience_role ?? null,
      audience_person_id: d.audience_person_id ?? null,
      related_post_id: d.related_post_id ?? null,
      related_shoot_id: d.related_shoot_id ?? null,
      related_client_id: d.related_client_id ?? null,
      related_month_id: d.related_month_id ?? null,
      resolved_at: null,
    }));
    const { error } = await sb
      .from('notifications')
      .upsert(rows, { onConflict: 'dedup_key' });
    if (error) throw error;
    upserted = rows.length;
  }

  const newKeys = new Set(drafts.map(d => d.dedup_key));
  const { data: openRows } = await sb
    .from('notifications')
    .select('id, dedup_key')
    .is('dismissed_at', null)
    .is('resolved_at', null);
  const stale = (openRows ?? []).filter(r => !newKeys.has(r.dedup_key));
  let resolved = 0;
  if (stale.length) {
    const ids = stale.map(r => r.id);
    const { error } = await sb
      .from('notifications')
      .update({ resolved_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;
    resolved = ids.length;
  }

  revalidatePath('/notifications');
  revalidatePath('/today');
  revalidatePath('/');
  return { upserted, resolved };
}

export async function dismissNotification(id: string) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  revalidatePath('/notifications');
  revalidatePath('/today');
  revalidatePath('/');
}

export async function dismissAllNotifications() {
  const sb = supabaseServer();
  const { error } = await sb
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .is('dismissed_at', null)
    .is('resolved_at', null);
  if (error) throw error;
  revalidatePath('/notifications');
  revalidatePath('/today');
  revalidatePath('/');
}

export async function assignShootToPerson(input: {
  shoot_id: string;
  client_slug: string;
  month_slug: string;
  person_id: string | null;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('shoots')
    .update({ assigned_person_id: input.person_id })
    .eq('id', input.shoot_id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function setPostOwner(input: {
  post_id: string;
  client_slug: string;
  month_slug: string;
  person_id: string | null;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from('posts')
    .update({ owner_person_id: input.person_id })
    .eq('id', input.post_id);
  if (error) throw error;
  revalidateMonth(input.client_slug, input.month_slug);
}

export async function upsertPerson(input: {
  id?: string;
  patch: Record<string, any>;
}) {
  const sb = supabaseServer();
  if (input.id) {
    const { error } = await sb.from('people').update(input.patch).eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('people').insert(input.patch);
    if (error) throw error;
  }
  revalidatePath('/');
  revalidatePath('/today');
}

// ============================================================================
// Holidays
// ============================================================================

export async function upsertHoliday(input: { id?: string; patch: Record<string, any> }) {
  const sb = supabaseServer();
  if (input.id) {
    const { error } = await sb.from('holidays').update(input.patch).eq('id', input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('holidays').insert(input.patch);
    if (error) throw error;
  }
  revalidatePath('/holidays');
}

export async function deleteHoliday(id: string) {
  const sb = supabaseServer();
  const { error } = await sb.from('holidays').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/holidays');
}
