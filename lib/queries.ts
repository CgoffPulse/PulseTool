import { supabaseServer } from './supabase/server';
import type {
  CaptureItem,
  Client,
  ContentQuota,
  Holiday,
  MonthContext,
  MonthRow,
  Post,
  Shoot,
  ShootTemplate,
  ShootWithTemplate,
  StrategicFrame,
} from './types';

// ============================================================================
// Read helpers used by Server Components.
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
