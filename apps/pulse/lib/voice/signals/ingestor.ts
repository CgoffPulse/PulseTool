/**
 * Signal ingest orchestrator.
 *
 * Runs each source detector, writes the resulting drafts into
 * `command.signals` keyed on `dedup_key` (idempotent — re-runs are no-ops).
 * The cron route (apps/voice/app/api/cron/signals-ingest) is the single
 * caller. Each source is wrapped in its own try/catch so a missing schema
 * (fresh DB, partial migration) doesn't stop the others from running.
 */
import 'server-only';
import { q } from '../../db';
import {
  detectAnalyticsRecommendationProposed,
  detectCrmStalledLead,
  detectDeployFailed,
  detectVoiceCostSpike,
  type AnalyticsRecommendation,
  type CrmLead,
  type DevDeployment,
  type SignalDraft,
  type VoiceRun,
} from './detectors';
import { harvestSocialSignals } from './social-bridge';

export interface IngestResult {
  ingested: number;
  deduped: number;
  by_source: Record<string, { drafts: number; inserted: number }>;
}

async function safeQuery<T>(sql: string): Promise<T[]> {
  try {
    // pg's QueryResultRow is `{ [k: string]: any }` — our domain types
    // (CrmLead, DevDeployment, etc.) are structurally compatible. We cast
    // through unknown to bridge the narrower domain type back.
    const rows = await q(sql);
    return rows as unknown as T[];
  } catch {
    return [];
  }
}

async function loadCrmLeads(): Promise<CrmLead[]> {
  return safeQuery<CrmLead>(`
    select
      l.id,
      l.name,
      l.company,
      l.stage::text as stage,
      l.value_cents,
      l.owner_person_id,
      l.client_id,
      l.archived,
      coalesce(
        (select max(t.happened_at) from crm.touches t where t.lead_id = l.id),
        l.created_at
      )::text as last_touch_at
    from crm.leads l
    where l.archived = false
  `);
}

async function loadFailedDeployments(): Promise<DevDeployment[]> {
  return safeQuery<DevDeployment>(`
    select
      d.id,
      d.project_id,
      p.name as project_name,
      p.slug as project_slug,
      d.state,
      d.url,
      d.commit_sha,
      d.observed_at::text as observed_at
    from dev.deployments d
    left join dev.projects p on p.id = d.project_id
    where d.observed_at > now() - interval '36 hours'
      and upper(coalesce(d.state, '')) in ('ERROR', 'FAILED', 'CANCELED')
  `);
}

async function loadRecentVoiceRuns(): Promise<VoiceRun[]> {
  return safeQuery<VoiceRun>(`
    select id, cost_cents, model, calling_app, created_at::text as created_at
      from voice.runs
     where created_at > now() - interval '2 hours'
  `);
}

async function loadProposedRecommendations(): Promise<AnalyticsRecommendation[]> {
  return safeQuery<AnalyticsRecommendation>(`
    select id, client_id, kind, title, status, created_at::text as created_at
      from analytics.recommendations
     where status = 'proposed'
       and created_at > now() - interval '14 days'
  `);
}

interface InsertResult {
  inserted: number;
  drafts: number;
}

async function persistSignals(drafts: SignalDraft[]): Promise<InsertResult> {
  if (drafts.length === 0) return { inserted: 0, drafts: 0 };
  let inserted = 0;
  for (const d of drafts) {
    try {
      // Idempotent on dedup_key. We never overwrite payloads — once a signal
      // exists, the lifecycle moves to `command.tasks` + auto-close.
      const rows = await q<{ id: string }>(
        `insert into command.signals
           (source, kind, dedup_key, payload, artifact_kind, artifact_id, state)
         values ($1, $2, $3, $4::jsonb, $5, $6, 'unprocessed')
         on conflict (dedup_key) do nothing
         returning id`,
        [
          d.source,
          d.kind,
          d.dedup_key,
          JSON.stringify(d.payload),
          d.artifact_kind ?? null,
          d.artifact_id ?? null,
        ]
      );
      if (rows.length > 0) inserted += 1;
    } catch {
      // command schema not migrated yet — bail on the whole batch.
      return { inserted, drafts: drafts.length };
    }
  }
  return { inserted, drafts: drafts.length };
}

/**
 * Pull fresh activity from every source app, write idempotent rows into
 * `command.signals`, return per-source counts. Errors in one source do not
 * stop others.
 */
export async function ingestSignals(now: Date = new Date()): Promise<IngestResult> {
  const by_source: Record<string, { drafts: number; inserted: number }> = {};
  let totalInserted = 0;
  let totalDrafts = 0;

  // Each source is its own promise so the timing is roughly parallel; each
  // is also wrapped in try/catch so failures don't poison the batch.
  const social = await harvestSocialSignals(now).catch(() => [] as SignalDraft[]);
  const socialResult = await persistSignals(social);
  by_source.social = socialResult;
  totalInserted += socialResult.inserted;
  totalDrafts += socialResult.drafts;

  try {
    const leads = await loadCrmLeads();
    const drafts = detectCrmStalledLead(leads, now);
    const r = await persistSignals(drafts);
    by_source.crm = r;
    totalInserted += r.inserted;
    totalDrafts += r.drafts;
  } catch {
    by_source.crm = { drafts: 0, inserted: 0 };
  }

  try {
    const deployments = await loadFailedDeployments();
    const drafts = detectDeployFailed(deployments, now);
    const r = await persistSignals(drafts);
    by_source.dev = r;
    totalInserted += r.inserted;
    totalDrafts += r.drafts;
  } catch {
    by_source.dev = { drafts: 0, inserted: 0 };
  }

  try {
    const runs = await loadRecentVoiceRuns();
    const drafts = detectVoiceCostSpike(runs, undefined, now);
    const r = await persistSignals(drafts);
    by_source.voice = r;
    totalInserted += r.inserted;
    totalDrafts += r.drafts;
  } catch {
    by_source.voice = { drafts: 0, inserted: 0 };
  }

  try {
    const recs = await loadProposedRecommendations();
    const drafts = detectAnalyticsRecommendationProposed(recs, now);
    const r = await persistSignals(drafts);
    by_source.analytics = r;
    totalInserted += r.inserted;
    totalDrafts += r.drafts;
  } catch {
    by_source.analytics = { drafts: 0, inserted: 0 };
  }

  return {
    ingested: totalInserted,
    deduped: totalDrafts - totalInserted,
    by_source,
  };
}

// ─── Signal → task conversion ──────────────────────────────────────────────
//
// Once a signal is in `command.signals`, it gets converted into a row on
// `command.tasks` keyed on `signal_key` (idempotent). The cron route calls
// `processUnhandledSignals` after `ingestSignals`.

export interface SignalRow {
  id: string;
  source: string;
  kind: string;
  dedup_key: string;
  payload: Record<string, unknown>;
  artifact_kind: string | null;
  artifact_id: string | null;
  state: string;
}

export interface ProcessResult {
  scanned: number;
  processed: number;
  ignored: number;
  by_kind: Record<string, number>;
}

interface TaskMapping {
  title: (p: Record<string, unknown>) => string;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  artifact_kind: string;
  auto_close_rule: string;
  /** Pull fields out of the payload to populate command.tasks columns. */
  fields: (p: Record<string, unknown>) => {
    assigned_person_id?: string | null;
    client_id?: string | null;
    client_slug?: string | null;
    artifact_id?: string | null;
  };
}

const str = (p: Record<string, unknown>, k: string): string | null => {
  const v = p[k];
  return typeof v === 'string' && v.length > 0 ? v : null;
};

const TASK_MAP: Record<string, TaskMapping> = {
  'social.stuck_post': {
    title: p =>
      `Stuck post: ${str(p, 'description')?.slice(0, 60) ?? str(p, 'platform') ?? 'post'} — ${str(p, 'client_name') ?? 'client'}`,
    priority: 'p1',
    artifact_kind: 'post',
    auto_close_rule: 'post.captured_or_posted',
    fields: p => ({
      assigned_person_id: str(p, 'owner_person_id'),
      client_id: str(p, 'client_id'),
      client_slug: str(p, 'client_slug'),
      artifact_id: str(p, 'post_id'),
    }),
  },
  'social.shoot_unassigned': {
    title: p =>
      `Assign someone to ${str(p, 'client_name') ?? 'shoot'} (Shoot ${p.bundle_number ?? '?'})`,
    priority: 'p1',
    artifact_kind: 'shoot',
    auto_close_rule: 'shoot.has_assignee',
    fields: p => ({
      client_id: str(p, 'client_id'),
      client_slug: str(p, 'client_slug'),
      artifact_id: str(p, 'shoot_id'),
    }),
  },
  'social.asset_overdue': {
    title: p =>
      `Edit overdue: ${str(p, 'client_name') ?? 'client'} (${p.days_to_live ?? '?'}d to live)`,
    priority: 'p1',
    artifact_kind: 'post',
    auto_close_rule: 'post.captured_or_posted',
    fields: p => ({
      assigned_person_id: str(p, 'owner_person_id'),
      client_id: str(p, 'client_id'),
      client_slug: str(p, 'client_slug'),
      artifact_id: str(p, 'post_id'),
    }),
  },
  'social.lead_time_tight': {
    title: p =>
      `Lead time tight: ${str(p, 'client_name') ?? 'client'} Shoot ${p.bundle_number ?? '?'}`,
    priority: 'p2',
    artifact_kind: 'shoot',
    auto_close_rule: 'shoot.has_assignee',
    fields: p => ({
      assigned_person_id: str(p, 'assigned_person_id'),
      client_id: str(p, 'client_id'),
      client_slug: str(p, 'client_slug'),
      artifact_id: str(p, 'shoot_id'),
    }),
  },
  'crm.stalled_lead': {
    title: p =>
      `Stalled lead: ${str(p, 'name') ?? 'lead'}${str(p, 'company') ? ` — ${str(p, 'company')}` : ''} (${p.days_since_touch ?? '?'}d)`,
    priority: 'p2',
    artifact_kind: 'lead',
    auto_close_rule: 'lead.advanced_or_lost',
    fields: p => ({
      assigned_person_id: str(p, 'owner_person_id'),
      client_id: str(p, 'client_id'),
      artifact_id: str(p, 'lead_id'),
    }),
  },
  'dev.deploy_failed': {
    title: p =>
      `Deploy failed: ${str(p, 'project_name') ?? str(p, 'project_slug') ?? 'project'}`,
    priority: 'p1',
    artifact_kind: 'deployment',
    auto_close_rule: 'deploy.next_ready',
    fields: p => ({
      artifact_id: str(p, 'deployment_id'),
    }),
  },
  'voice.cost_spike': {
    title: p =>
      `Voice cost spike: $${(((p.total_cents as number) ?? 0) / 100).toFixed(2)} in last hour`,
    priority: 'p1',
    artifact_kind: 'voice_cost_window',
    // No auto-close rule — cost spikes are point-in-time alerts, manually dismissed.
    auto_close_rule: '',
    fields: () => ({}),
  },
  'analytics.recommendation_proposed': {
    title: p => `Review recommendation: ${str(p, 'title') ?? 'analytics rec'}`,
    priority: 'p2',
    artifact_kind: 'recommendation',
    auto_close_rule: 'recommendation.actioned_or_dismissed',
    fields: p => ({
      client_id: str(p, 'client_id'),
      artifact_id: str(p, 'recommendation_id'),
    }),
  },
};

/**
 * For each unprocessed signal, create (or look up) a corresponding
 * `command.tasks` row, mark the signal as `processed` with `task_id` set,
 * and `ignored` for kinds we don't know how to map.
 *
 * Idempotent: signals are matched on `signal_key` so re-running is a no-op.
 */
export async function processUnhandledSignals(): Promise<ProcessResult> {
  const result: ProcessResult = { scanned: 0, processed: 0, ignored: 0, by_kind: {} };
  let signals: SignalRow[] = [];
  try {
    signals = await q<SignalRow>(
      `select id, source, kind, dedup_key, payload, artifact_kind, artifact_id, state
         from command.signals
        where state = 'unprocessed'
        order by created_at asc
        limit 500`
    );
  } catch {
    return result;
  }
  result.scanned = signals.length;

  for (const s of signals) {
    const mapping = TASK_MAP[s.kind];
    if (!mapping) {
      try {
        await q(
          `update command.signals
              set state = 'ignored', processed_at = now()
            where id = $1`,
          [s.id]
        );
      } catch {
        /* ignore */
      }
      result.ignored += 1;
      continue;
    }
    const f = mapping.fields(s.payload);
    const title = mapping.title(s.payload);
    let taskId: string | null = null;
    try {
      const rows = await q<{ id: string }>(
        `insert into command.tasks
           (title, status, priority, origin, signal_key, assigned_person_id,
            client_id, client_slug, artifact_kind, artifact_id, auto_close_rule)
         values ($1, 'next', $2, 'signal', $3, $4, $5, $6, $7, $8, $9)
         on conflict (signal_key) do nothing
         returning id`,
        [
          title,
          mapping.priority,
          s.dedup_key,
          f.assigned_person_id ?? null,
          f.client_id ?? null,
          f.client_slug ?? null,
          mapping.artifact_kind,
          f.artifact_id ?? s.artifact_id ?? null,
          mapping.auto_close_rule || null,
        ]
      );
      if (rows[0]) {
        taskId = rows[0].id;
      } else {
        // Conflict: pull the existing task by signal_key.
        const existing = await q<{ id: string }>(
          `select id from command.tasks where signal_key = $1 limit 1`,
          [s.dedup_key]
        );
        taskId = existing[0]?.id ?? null;
      }
    } catch {
      // command.tasks insert failed — leave the signal unprocessed for next run.
      continue;
    }
    try {
      await q(
        `update command.signals
            set state = 'processed', task_id = $2, processed_at = now()
          where id = $1`,
        [s.id, taskId]
      );
    } catch {
      /* ignore */
    }
    result.processed += 1;
    result.by_kind[s.kind] = (result.by_kind[s.kind] ?? 0) + 1;
  }
  return result;
}
