// Domain types — mirror the schema in supabase/migrations/0001_init.sql.
// Snake_case field names match the DB so we can pass rows through with minimal mapping.

export type ContentType = 'reel' | 'photo' | 'carousel' | 'story' | 'video' | 'graphic';
export type Pillar = 'p1' | 'p2' | 'p3';
export type PostStatus =
  | 'planned'
  | 'captured'
  | 'edited'
  | 'approved'
  | 'ready' // legacy — treated as `approved`
  | 'scheduled'
  | 'posted';

/** Pipeline order — render `[planned, captured, edited, approved, scheduled, posted]`. */
export const POST_PIPELINE: PostStatus[] = [
  'planned',
  'captured',
  'edited',
  'approved',
  'scheduled',
  'posted',
];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  planned: 'Planned',
  captured: 'Captured',
  edited: 'Edited',
  approved: 'Approved',
  ready: 'Approved',
  scheduled: 'Scheduled',
  posted: 'Posted',
};

/** Index in POST_PIPELINE; legacy `ready` collapses onto `approved` (3). */
export function postStatusIndex(s: PostStatus): number {
  if (s === 'ready') return 3;
  return POST_PIPELINE.indexOf(s);
}
export type ShootAssetStatus = 'not_scheduled' | 'scheduled' | 'captured' | 'delivered';
export type MonthStatus = 'draft' | 'ready' | 'sent';
export type ClientFit = 'onsc' | 'el_pueblito' | 'both';
export type ShootClientScope = 'onsc' | 'el_pueblito' | 'either';
export type AssetProviderKind = 'drive' | 'dam' | 'nas' | 'supabase';

export const CONTENT_TYPES: ContentType[] = ['reel', 'photo', 'carousel', 'story', 'video', 'graphic'];

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  reel: 'Reels',
  photo: 'Photos',
  carousel: 'Carousels',
  story: 'Stories',
  video: 'Videos',
  graphic: 'Graphics',
};

export const PILLAR_LABEL: Record<Pillar, string> = {
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

export interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  archived: boolean;
}

export interface StrategicFrame {
  id: string;
  client_id: string;
  quarter: string;
  quarter_start_date: string | null;
  goal_90day: string | null;
  primary_audience: string | null;
  role_of_social: string | null;
  brand_voice: string | null;
  avoid: string | null;
  pillar_1_name: string | null;
  pillar_1_desc: string | null;
  pillar_2_name: string | null;
  pillar_2_desc: string | null;
  pillar_3_name: string | null;
  pillar_3_desc: string | null;
  pillar_mix: { p1: number; p2: number; p3: number };
  cadence: string | null;
  contracted_shoots_per_month: number | null;
  min_lead_time_days: number;
}

export interface ContentQuota {
  id: string;
  client_id: string;
  month: string;
  reels_target: number | null;
  photos_target: number | null;
  carousels_target: number | null;
  stories_target: number | null;
  videos_target: number | null;
  graphics_target: number | null;
}

export interface ShootTemplate {
  id: string;
  name: string;
  duration: string | null;
  client_scope: ShootClientScope;
  required_capture_list: string | null;
  produces_reels: number;
  produces_photos: number;
  produces_carousels: number;
  produces_stories: number;
  produces_videos: number;
  produces_graphics: number;
}

export interface Holiday {
  id: string;
  date_label: string;
  event: string;
  client_fit: ClientFit;
  content_angle: string | null;
  is_recurring: boolean;
  client_specific_client_id: string | null;
}

export interface MonthRow {
  id: string;
  client_id: string;
  month: string;
  cadence_override: string | null;
  status: MonthStatus;
}

export interface Shoot {
  id: string;
  month_id: string;
  bundle_number: number;
  shoot_template_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  assigned_to: string | null;
  assigned_person_id: string | null;
  asset_status: ShootAssetStatus;
  drive_folder_url: string | null;
  notes: string | null;
  /** Host shoot this one rides along on. When set, it's captured during that outing. */
  piggyback_on_shoot_id: string | null;
}

/** Slug Pulse uses for itself when treated as a client. */
export const PULSE_HOUSE_SLUG = 'pulse';

export interface Post {
  id: string;
  month_id: string;
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
  owner_person_id: string | null;
  sort_index: number;
}

// ─────────────────────────────────────────────────────────────────────────
// People + Notifications (Phase 2.1)
// ─────────────────────────────────────────────────────────────────────────

export type PersonRole = 'field' | 'strategy' | 'producer' | 'editor' | 'approver';

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  field: 'Field',
  strategy: 'Strategy',
  producer: 'Producer',
  editor: 'Editor',
  approver: 'Approver',
};

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  color: string;
  archived: boolean;
}

export type NotificationSeverity = 'info' | 'warn' | 'bad';

export type NotificationKind =
  | 'today_action'
  | 'stuck_post'
  | 'lead_time_tight'
  | 'missing_month_plan'
  | 'coverage_gap'
  | 'shoot_unassigned'
  | 'asset_overdue'
  | 'month_generation_due'
  | 'shoot_schedule_conflict'
  | 'ride_along_opportunity'
  | 'quota_shortfall';

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  today_action: 'Today',
  stuck_post: 'Stuck post',
  lead_time_tight: 'Lead time tight',
  missing_month_plan: 'Missing plan',
  coverage_gap: 'Coverage gap',
  shoot_unassigned: 'Shoot unassigned',
  asset_overdue: 'Asset overdue',
  month_generation_due: 'Plan due',
  shoot_schedule_conflict: 'Schedule conflict',
  ride_along_opportunity: 'Ride-along opportunity',
  quota_shortfall: 'Quota shortfall',
};

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  audience_role: PersonRole | null;
  audience_person_id: string | null;
  dedup_key: string;
  title: string;
  detail: string | null;
  link_url: string | null;
  related_post_id: string | null;
  related_shoot_id: string | null;
  related_client_id: string | null;
  related_month_id: string | null;
  dismissed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Input shape used by the action engine to upsert. */
export interface NotificationDraft {
  kind: NotificationKind;
  severity: NotificationSeverity;
  dedup_key: string;
  title: string;
  detail?: string | null;
  link_url?: string | null;
  audience_role?: PersonRole | null;
  audience_person_id?: string | null;
  related_post_id?: string | null;
  related_shoot_id?: string | null;
  related_client_id?: string | null;
  related_month_id?: string | null;
}

export interface CaptureItem {
  id: string;
  shoot_id: string;
  label: string;
  is_required: boolean;
  is_captured: boolean;
  captured_at: string | null;
  linked_post_id: string | null;
  notes: string | null;
  sort_index: number;
}

export interface Asset {
  id: string;
  shoot_id: string;
  post_id: string | null;
  content_type: ContentType | null;
  provider: AssetProviderKind;
  provider_ref: string;
  thumbnail_path: string | null;
  label: string | null;
  captured_at: string | null;
}

// Convenience: shoot enriched with its template (joined client-side or by query)
export interface ShootWithTemplate extends Shoot {
  template: ShootTemplate | null;
}

export interface MonthContext {
  month: MonthRow;
  client: Client;
  strategic_frame: StrategicFrame | null;
  quota: ContentQuota | null;
  shoots: ShootWithTemplate[];
  posts: Post[];
}
