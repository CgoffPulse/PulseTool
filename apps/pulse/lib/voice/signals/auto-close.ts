/**
 * Auto-close resolver — the second half of the AI-velocity loop.
 *
 * Tasks created by the signal ingestor carry an `auto_close_rule` string.
 * This module evaluates each rule against the current state of the world
 * (cross-schema reads against the same Postgres cluster) and flips the
 * task to `done` when the predicate fires. Zero human writes.
 *
 * Rules are dispatched by string key — matches the constants used by
 * `apps/voice/lib/signals/ingestor.ts:TASK_MAP`.
 */
import 'server-only';
import { q } from '../../db';

export interface AutoCloseResult {
  scanned: number;
  closed: number;
  by_rule: Record<string, number>;
}

interface OpenTask {
  id: string;
  auto_close_rule: string | null;
  artifact_kind: string | null;
  artifact_id: string | null;
}

// Each predicate returns true when the task should auto-close. Predicates
// are tolerant of missing schema/tables — a thrown error inside is treated
// as "do not close" so we never lose open tasks to flaky reads.

type Predicate = (task: OpenTask) => Promise<boolean>;

const POST_DONE_STATES = new Set(['captured', 'edited', 'approved', 'ready', 'scheduled', 'posted']);

const predicates: Record<string, Predicate> = {
  /**
   * post.captured_or_posted — the linked post has moved out of `planned`.
   */
  'post.captured_or_posted': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ status: string }>(
        `select status::text as status from public.posts where id = $1`,
        [task.artifact_id]
      );
      const status = rows[0]?.status;
      return !!status && POST_DONE_STATES.has(status);
    } catch {
      return false;
    }
  },

  /**
   * shoot.has_assignee — the linked shoot now has a person assigned.
   */
  'shoot.has_assignee': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ assigned_person_id: string | null; assigned_to: string | null }>(
        `select assigned_person_id, assigned_to
           from public.shoots
          where id = $1`,
        [task.artifact_id]
      );
      const r = rows[0];
      if (!r) return false;
      if (r.assigned_person_id) return true;
      if (r.assigned_to && r.assigned_to.trim()) return true;
      return false;
    } catch {
      return false;
    }
  },

  /**
   * deploy.next_ready — a newer deployment to the same project landed in
   * READY state, so the failed one is no longer the top of stack.
   */
  'deploy.next_ready': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ project_id: string; observed_at: string }>(
        `select project_id, observed_at::text as observed_at
           from dev.deployments
          where id = $1`,
        [task.artifact_id]
      );
      const failed = rows[0];
      if (!failed) return false;
      const newer = await q<{ id: string }>(
        `select id
           from dev.deployments
          where project_id = $1
            and observed_at > $2::timestamptz
            and upper(coalesce(state, '')) = 'READY'
          limit 1`,
        [failed.project_id, failed.observed_at]
      );
      return newer.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * recommendation.actioned_or_dismissed — analytics recommendation has
   * left the `proposed` state.
   */
  'recommendation.actioned_or_dismissed': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ status: string }>(
        `select status from analytics.recommendations where id = $1`,
        [task.artifact_id]
      );
      const s = rows[0]?.status;
      return !!s && s !== 'proposed';
    } catch {
      return false;
    }
  },

  /**
   * month_plan.populated — the linked month now has at least 5 posts.
   * Threshold matches the social-engine "underway" cutoff.
   */
  'month_plan.populated': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ n: string }>(
        `select count(*)::text as n from public.posts where month_id = $1`,
        [task.artifact_id]
      );
      const n = Number(rows[0]?.n ?? 0);
      return n >= 5;
    } catch {
      return false;
    }
  },

  /**
   * lead.advanced_or_lost — CRM lead moved out of the early funnel.
   */
  'lead.advanced_or_lost': async task => {
    if (!task.artifact_id) return false;
    try {
      const rows = await q<{ stage: string }>(
        `select stage::text as stage from crm.leads where id = $1`,
        [task.artifact_id]
      );
      const stage = rows[0]?.stage;
      if (!stage) return false;
      return stage === 'won' || stage === 'lost' || stage === 'negotiation';
    } catch {
      return false;
    }
  },
};

/**
 * Scan every open task with an auto_close_rule, evaluate the predicate, and
 * close the ones that match. Returns aggregate counts.
 */
export async function processAutoCloses(): Promise<AutoCloseResult> {
  const result: AutoCloseResult = { scanned: 0, closed: 0, by_rule: {} };
  let tasks: OpenTask[] = [];
  try {
    tasks = await q<OpenTask>(
      `select id, auto_close_rule, artifact_kind, artifact_id
         from command.tasks
        where status not in ('done', 'cancelled')
          and auto_close_rule is not null
          and auto_close_rule <> ''
        order by created_at asc
        limit 1000`
    );
  } catch {
    return result;
  }
  result.scanned = tasks.length;

  for (const t of tasks) {
    const rule = t.auto_close_rule!;
    const fn = predicates[rule];
    if (!fn) continue;
    let shouldClose = false;
    try {
      shouldClose = await fn(t);
    } catch {
      shouldClose = false;
    }
    if (!shouldClose) continue;
    try {
      await q(
        `update command.tasks
            set status = 'done', done_at = now()
          where id = $1
            and status not in ('done', 'cancelled')`,
        [t.id]
      );
      result.closed += 1;
      result.by_rule[rule] = (result.by_rule[rule] ?? 0) + 1;
    } catch {
      /* ignore */
    }
  }
  return result;
}
