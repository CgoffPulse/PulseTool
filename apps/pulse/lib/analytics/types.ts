// Pulse Analytics — TypeScript shapes mirroring the analytics.* Postgres tables.

export type Platform = 'instagram' | 'facebook' | 'ga4';
export const PLATFORMS: Platform[] = ['instagram', 'facebook', 'ga4'];

export type AccountStatus = 'pending' | 'connected' | 'error' | 'revoked';

export interface PlatformAccount {
  id: string;
  client_id: string;
  platform: Platform;
  handle: string | null;
  external_id: string | null;
  access_token_ref: string | null;
  status: AccountStatus;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountMetricsDaily {
  id: string;
  account_id: string;
  date: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  profile_visits: number | null;
  website_clicks: number | null;
  raw: unknown;
  created_at: string;
}

export interface Ga4MetricsDaily {
  id: string;
  client_id: string;
  date: string;
  sessions: number | null;
  users: number | null;
  conversions: number | null;
  bounce_rate: number | null;
  avg_session_seconds: number | null;
  top_source_json: unknown;
  raw: unknown;
  created_at: string;
}

export interface PostExternal {
  id: string;
  account_id: string;
  platform_post_id: string;
  posted_at: string | null;
  caption: string | null;
  media_type: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  raw: unknown;
  created_at: string;
  updated_at: string;
}

export interface PostMetric {
  id: string;
  posts_external_id: string;
  captured_at: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  video_views: number | null;
  plays: number | null;
  completion_rate: number | null;
  raw: unknown;
}

export type MatchedBy = 'human' | 'heuristic' | 'ai';

export interface PostMatch {
  id: string;
  posts_external_id: string;
  public_post_id: string;
  matched_by: MatchedBy;
  confidence: number | null;
  matched_at: string;
}

export type TagKind = 'pillar' | 'hook_style' | 'format' | 'hashtag_quality';

export interface PostTag {
  id: string;
  posts_external_id: string;
  tag_kind: TagKind;
  tag_value: string;
  confidence: number | null;
  source: 'ai' | 'human';
  run_id: string | null;
  created_at: string;
}

export interface Insight {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  body_md: string;
  evidence_post_ids: string[];
  run_id: string | null;
  generated_at: string;
  dismissed_at: string | null;
}

export type RecommendationKind =
  | 'new_post'
  | 'repeat_post'
  | 'change_format'
  | 'change_cadence'
  | 'pillar_rebalance'
  | 'audience_test';

export const RECOMMENDATION_KINDS: RecommendationKind[] = [
  'new_post',
  'repeat_post',
  'change_format',
  'change_cadence',
  'pillar_rebalance',
  'audience_test',
];

export type RecommendationStatus = 'proposed' | 'accepted' | 'dismissed';
export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  'proposed',
  'accepted',
  'dismissed',
];

export interface Recommendation {
  id: string;
  client_id: string;
  kind: RecommendationKind;
  title: string;
  rationale_md: string;
  evidence_post_ids: string[];
  status: RecommendationStatus;
  accepted_at: string | null;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  target_post_id: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedChart {
  id: string;
  client_id: string | null;
  prompt: string;
  chart_spec_json: ChartSpec;
  pinned: boolean;
  run_id: string | null;
  created_by_person_id: string | null;
  created_at: string;
}

// Joined / display shapes
export interface AccountWithLatestMetrics extends PlatformAccount {
  latest_followers: number | null;
  latest_reach: number | null;
  latest_date: string | null;
}

export interface PostWithLatestMetrics extends PostExternal {
  account_handle: string | null;
  account_platform: Platform | null;
  client_id: string | null;
  m_likes: number | null;
  m_saves: number | null;
  m_shares: number | null;
  m_reach: number | null;
  m_impressions: number | null;
  m_comments: number | null;
}

// AI structured output shapes returned by the voice gateway.
export interface ChartSpec {
  chart_type: 'line' | 'bar' | 'scatter' | 'table';
  x_axis: string;
  y_axis: string;
  series: Array<{ label: string; dataset_filter: string }>;
  title: string;
  explanation: string;
  data?: Array<Record<string, string | number | null>>;
}

export interface TagPostStructured {
  pillar: string;
  hook_style: string;
  format_quality: number;
  reasoning: string;
}

export interface RecommendationStructured {
  actions: Array<{
    kind: RecommendationKind;
    title: string;
    rationale_md: string;
    evidence_post_ids: string[];
  }>;
}

export interface AgencyOverviewStats {
  active_clients: number;
  ingested_posts_28d: number;
  reach_28d: number;
  avg_engagement_rate_28d: number;
}

// Bridge / read-only shapes from the social schema.
export interface SocialClient {
  id: string;
  slug: string;
  name: string;
  color: string | null;
}

export interface SocialPostBridge {
  id: string;
  post_date: string;
  post_time: string | null;
  platform: string | null;
  pillar: string | null;
  content_type: string;
  description: string | null;
  status: string;
  client_id: string;
}
