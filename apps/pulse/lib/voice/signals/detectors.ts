/**
 * Cross-app signal detectors. Pure functions: take a typed snapshot, return
 * SignalDraft[]. No DB writes — the orchestrator (`ingestor.ts`) is the only
 * caller and decides when to persist.
 *
 * Signals returned here are agency-wide events that need a task created on
 * Christian's command surface. Social signals are produced by the existing
 * 11-detector engine in apps/social/lib/action-engine.ts via `social-bridge.ts`;
 * everything else (CRM stalled leads, dev deploy failures, voice cost spikes,
 * analytics recommendations) lives here.
 */
import 'server-only';

export interface SignalDraft {
  source: string;
  kind: string;
  payload: Record<string, unknown>;
  dedup_key: string;
  artifact_kind?: string;
  artifact_id?: string;
}

// ─── CRM: stalled leads ────────────────────────────────────────────────────

export interface CrmLead {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  value_cents: number | null;
  owner_person_id: string | null;
  client_id: string | null;
  /** Latest crm.touches.happened_at for this lead (or lead.created_at when none). */
  last_touch_at: string;
  archived: boolean;
}

const STALLED_DAYS = 7;

/**
 * A lead is "stalled" when its last touch is older than STALLED_DAYS and the
 * stage isn't terminal (won/lost/archived). One signal per lead.
 */
export function detectCrmStalledLead(leads: CrmLead[], now: Date = new Date()): SignalDraft[] {
  const out: SignalDraft[] = [];
  const cutoff = now.getTime() - STALLED_DAYS * 86_400_000;
  for (const l of leads) {
    if (l.archived) continue;
    if (l.stage === 'won' || l.stage === 'lost') continue;
    const last = Date.parse(l.last_touch_at);
    if (!Number.isFinite(last)) continue;
    if (last > cutoff) continue;
    const days = Math.max(1, Math.round((now.getTime() - last) / 86_400_000));
    out.push({
      source: 'crm',
      kind: 'crm.stalled_lead',
      dedup_key: `crm.stalled_lead:${l.id}`,
      artifact_kind: 'lead',
      artifact_id: l.id,
      payload: {
        lead_id: l.id,
        name: l.name,
        company: l.company,
        stage: l.stage,
        days_since_touch: days,
        value_cents: l.value_cents,
        owner_person_id: l.owner_person_id,
        client_id: l.client_id,
      },
    });
  }
  return out;
}

// ─── Dev: failed deployments ───────────────────────────────────────────────

export interface DevDeployment {
  id: string;
  project_id: string;
  project_name: string | null;
  project_slug: string | null;
  state: string | null;
  url: string | null;
  commit_sha: string | null;
  observed_at: string;
}

const DEPLOY_FAIL_STATES = new Set(['ERROR', 'FAILED', 'CANCELED']);
const DEPLOY_LOOKBACK_HOURS = 24;

/**
 * Failed Vercel deploys observed in the last 24h. One signal per deployment row.
 */
export function detectDeployFailed(
  deployments: DevDeployment[],
  now: Date = new Date()
): SignalDraft[] {
  const out: SignalDraft[] = [];
  const cutoff = now.getTime() - DEPLOY_LOOKBACK_HOURS * 3_600_000;
  for (const d of deployments) {
    const state = (d.state ?? '').toUpperCase();
    if (!DEPLOY_FAIL_STATES.has(state)) continue;
    const observedMs = Date.parse(d.observed_at);
    if (!Number.isFinite(observedMs) || observedMs < cutoff) continue;
    out.push({
      source: 'dev',
      kind: 'dev.deploy_failed',
      dedup_key: `dev.deploy_failed:${d.id}`,
      artifact_kind: 'deployment',
      artifact_id: d.id,
      payload: {
        deployment_id: d.id,
        project_id: d.project_id,
        project_name: d.project_name,
        project_slug: d.project_slug,
        state,
        url: d.url,
        commit_sha: d.commit_sha,
        observed_at: d.observed_at,
      },
    });
  }
  return out;
}

// ─── Voice: cost spikes ────────────────────────────────────────────────────

export interface VoiceRun {
  id: string;
  cost_cents: number | null;
  created_at: string;
  model: string | null;
  calling_app: string | null;
}

export const COST_SPIKE_CENTS_DEFAULT = 500; // $5 per hour
const COST_LOOKBACK_HOURS = 1;

/**
 * If the sum of voice.runs.cost_cents in the last hour exceeds the threshold,
 * fire a single signal. Dedup key is bucketed by hour so back-to-back ingests
 * within the same hour don't double-task.
 */
export function detectVoiceCostSpike(
  runs: VoiceRun[],
  thresholdCents: number = COST_SPIKE_CENTS_DEFAULT,
  now: Date = new Date()
): SignalDraft[] {
  const cutoff = now.getTime() - COST_LOOKBACK_HOURS * 3_600_000;
  let total = 0;
  let topModel: string | null = null;
  const modelCosts = new Map<string, number>();
  let n = 0;
  for (const r of runs) {
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const c = r.cost_cents ?? 0;
    total += c;
    n += 1;
    if (r.model) {
      modelCosts.set(r.model, (modelCosts.get(r.model) ?? 0) + c);
    }
  }
  if (total < thresholdCents) return [];
  for (const [m, c] of modelCosts) {
    if (topModel == null || c > (modelCosts.get(topModel) ?? 0)) topModel = m;
  }
  // Bucket by the rounded hour so we don't fire repeatedly within the same window.
  const hour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000)
    .toISOString()
    .slice(0, 13); // 'yyyy-mm-ddTHH'
  return [
    {
      source: 'voice',
      kind: 'voice.cost_spike',
      dedup_key: `voice.cost_spike:${hour}`,
      payload: {
        hour_bucket: hour,
        total_cents: total,
        run_count: n,
        threshold_cents: thresholdCents,
        top_model: topModel,
      },
    },
  ];
}

// ─── Analytics: proposed recommendations ──────────────────────────────────

export interface AnalyticsRecommendation {
  id: string;
  client_id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
}

const REC_LOOKBACK_DAYS = 7;

/**
 * Proposed (un-actioned) recommendations from the analytics advisor. Older
 * proposals (>7d) stop generating signals so the inbox doesn't bloat — we
 * surface them once via auto-task, then the auto-close engine handles the
 * lifecycle when the rec is accepted/dismissed.
 */
export function detectAnalyticsRecommendationProposed(
  recs: AnalyticsRecommendation[],
  now: Date = new Date()
): SignalDraft[] {
  const out: SignalDraft[] = [];
  const cutoff = now.getTime() - REC_LOOKBACK_DAYS * 86_400_000;
  for (const r of recs) {
    if (r.status !== 'proposed') continue;
    const t = Date.parse(r.created_at);
    if (!Number.isFinite(t) || t < cutoff) continue;
    out.push({
      source: 'analytics',
      kind: 'analytics.recommendation_proposed',
      dedup_key: `analytics.recommendation_proposed:${r.id}`,
      artifact_kind: 'recommendation',
      artifact_id: r.id,
      payload: {
        recommendation_id: r.id,
        client_id: r.client_id,
        kind: r.kind,
        title: r.title,
        created_at: r.created_at,
      },
    });
  }
  return out;
}
