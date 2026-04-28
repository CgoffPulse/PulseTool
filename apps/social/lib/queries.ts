import { supabaseServer } from './supabase/server';
import type {
  CaptureItem,
  Client,
  ContentQuota,
  Holiday,
  MonthContext,
  MonthRow,
  NotificationRow,
  Person,
  PersonRole,
  Post,
  Shoot,
  ShootTemplate,
  ShootWithTemplate,
  StrategicFrame,
} from './types';

// ============================================================================
// Read helpers used by Server Components.
// ============================================================================

// ============================================================================
// People + notifications (Phase 2.1)
// ============================================================================

export async function listPeople(): Promise<Person[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('people')
    .select('*')
    .eq('archived', false)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Person[];
}

export async function getPersonById(id: string): Promise<Person | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('people')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Person) ?? null;
}

export async function listOpenNotifications(opts?: {
  audiencePersonId?: string | null;
  audienceRole?: PersonRole | null;
}): Promise<NotificationRow[]> {
  const sb = supabaseServer();
  let q = sb
    .from('notifications')
    .select('*')
    .is('dismissed_at', null)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  // If a person is provided, the feed shows: targeted-to-them + their-role
  // + untargeted (anyone). Skip the filter when no person/role is provided
  // (admin/operator view sees everything).
  if (opts?.audiencePersonId || opts?.audienceRole) {
    const conds: string[] = ['and(audience_person_id.is.null,audience_role.is.null)'];
    if (opts.audiencePersonId) conds.push(`audience_person_id.eq.${opts.audiencePersonId}`);
    if (opts.audienceRole) conds.push(`audience_role.eq.${opts.audienceRole}`);
    q = q.or(conds.join(','));
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function listAllNotifications(): Promise<NotificationRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

// ============================================================================
// Original read helpers
// ============================================================================

export async function listClients(): Promise<Client[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .eq('archived', false)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Client) ?? null;
}

export async function listShootTemplates(): Promise<ShootTemplate[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('shoot_templates')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ShootTemplate[];
}

export async function listHolidays(): Promise<Holiday[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from('holidays').select('*').order('event');
  if (error) throw error;
  return (data ?? []) as Holiday[];
}

export async function getCurrentStrategicFrame(
  client_id: string
): Promise<StrategicFrame | null> {
  const sb = supabaseServer();
  // Latest by quarter_start_date, falling back to the row that exists.
  const { data, error } = await sb
    .from('strategic_frames')
    .select('*')
    .eq('client_id', client_id)
    .order('quarter_start_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as StrategicFrame) ?? null;
}

export async function getQuota(
  client_id: string,
  monthIso: string
): Promise<ContentQuota | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('content_quotas')
    .select('*')
    .eq('client_id', client_id)
    .eq('month', monthIso)
    .maybeSingle();
  if (error) throw error;
  return (data as ContentQuota) ?? null;
}

export async function getOrCreateMonth(
  client_id: string,
  monthIso: string
): Promise<MonthRow> {
  const sb = supabaseServer();
  const existing = await sb
    .from('months')
    .select('*')
    .eq('client_id', client_id)
    .eq('month', monthIso)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as MonthRow;
  const inserted = await sb
    .from('months')
    .insert({ client_id, month: monthIso })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as MonthRow;
}

export async function listAllMonths(): Promise<MonthRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('months')
    .select('*')
    .order('month', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthRow[];
}

export async function listAllShootsForMonths(
  monthIds: string[]
): Promise<Shoot[]> {
  if (monthIds.length === 0) return [];
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('shoots')
    .select('*')
    .in('month_id', monthIds);
  if (error) throw error;
  return (data ?? []) as Shoot[];
}

/** Convenience: every shoot ever planned, ordered by date desc. */
export async function listAllShoots(): Promise<Shoot[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('shoots')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Shoot[];
}

export async function listAllPostsForMonths(
  monthIds: string[]
): Promise<Post[]> {
  if (monthIds.length === 0) return [];
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('posts')
    .select('*')
    .in('month_id', monthIds);
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function listMonthsForClient(client_id: string): Promise<MonthRow[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('months')
    .select('*')
    .eq('client_id', client_id)
    .order('month', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthRow[];
}

export async function listShoots(month_id: string): Promise<Shoot[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('shoots')
    .select('*')
    .eq('month_id', month_id)
    .order('bundle_number');
  if (error) throw error;
  return (data ?? []) as Shoot[];
}

export async function listPosts(month_id: string): Promise<Post[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('posts')
    .select('*')
    .eq('month_id', month_id)
    .order('post_date', { ascending: true })
    .order('sort_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function listCaptureItems(shoot_id: string): Promise<CaptureItem[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('capture_items')
    .select('*')
    .eq('shoot_id', shoot_id)
    .order('sort_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaptureItem[];
}

export async function listCaptureItemsForMonth(
  month_id: string
): Promise<CaptureItem[]> {
  const sb = supabaseServer();
  const { data: shootRows } = await sb
    .from('shoots')
    .select('id')
    .eq('month_id', month_id);
  const ids = (shootRows ?? []).map(s => s.id as string);
  if (ids.length === 0) return [];
  const { data, error } = await sb
    .from('capture_items')
    .select('*')
    .in('shoot_id', ids);
  if (error) throw error;
  return (data ?? []) as CaptureItem[];
}

/**
 * Snapshot loader for the action engine. Pulls everything the detectors need
 * in a small number of round-trips so the cron route is fast.
 */
export async function loadEngineSnapshot(today: Date) {
  const sb = supabaseServer();
  const [clientsR, peopleR, monthsR, postsR, shootsR, templatesR, framesR, quotasR] =
    await Promise.all([
      sb.from('clients').select('*').eq('archived', false),
      sb.from('people').select('*').eq('archived', false),
      sb.from('months').select('*'),
      sb.from('posts').select('*'),
      sb.from('shoots').select('*'),
      sb.from('shoot_templates').select('*'),
      sb.from('strategic_frames').select('*'),
      sb.from('content_quotas').select('*'),
    ]);
  const errs = [clientsR, peopleR, monthsR, postsR, shootsR, templatesR, framesR, quotasR]
    .map(r => r.error)
    .filter(Boolean);
  if (errs.length) throw errs[0];
  return {
    today,
    clients: (clientsR.data ?? []) as Client[],
    people: (peopleR.data ?? []) as Person[],
    months: (monthsR.data ?? []) as MonthRow[],
    posts: (postsR.data ?? []) as Post[],
    shoots: (shootsR.data ?? []) as Shoot[],
    templates: (templatesR.data ?? []) as ShootTemplate[],
    frames: (framesR.data ?? []) as StrategicFrame[],
    quotas: (quotasR.data ?? []) as ContentQuota[],
  };
}

export async function buildMonthContext(
  client: Client,
  monthIso: string
): Promise<MonthContext> {
  const month = await getOrCreateMonth(client.id, monthIso);
  const [strategic_frame, quota, shoots, posts, templates] = await Promise.all([
    getCurrentStrategicFrame(client.id),
    getQuota(client.id, monthIso),
    listShoots(month.id),
    listPosts(month.id),
    listShootTemplates(),
  ]);
  const tplById = new Map(templates.map(t => [t.id, t]));
  const shootsWithTpl: ShootWithTemplate[] = shoots.map(s => ({
    ...s,
    template: s.shoot_template_id ? tplById.get(s.shoot_template_id) ?? null : null,
  }));
  return {
    month,
    client,
    strategic_frame,
    quota,
    shoots: shootsWithTpl,
    posts,
  };
}
