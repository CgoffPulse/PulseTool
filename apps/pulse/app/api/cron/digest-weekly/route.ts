import { NextResponse } from 'next/server';
import type { QueryResultRow } from 'pg';
import { q, qOne, tx } from '@/lib/db';
import { runPrompt } from '@/lib/voice/llm/anthropic';
import { resolveTemplate } from '@/lib/voice/template-resolver';
import { insertRun } from '@/lib/voice/queries';

/**
 * Weekly internal team digest.
 *
 * Runs every Monday at 13:00 UTC (≈ 8am CT). Pulls last-7-days activity
 * across every Pulse schema, hands it to Sonnet via the
 * `digest.weekly_internal` template, and lands the synthesized digest as a
 * `command.tasks` row (origin='recap') with a paired notification so it
 * shows up in the team's inbox.
 *
 * Auth: bearer-secret matching `CRON_SECRET`. Vercel cron sets this
 * automatically when configured in vercel.json. A `x-pulse-cron` fallback
 * header is honored for manual triggers from the UI.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience — open if no secret set
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-pulse-cron') === secret) return true;
  return false;
}

interface PostMovementRow {
  id: string;
  status: string;
  post_date: string | null;
  client_name: string | null;
}

interface ShootRow {
  id: string;
  scheduled_date: string | null;
  asset_status: string;
  client_name: string | null;
}

interface RunSummary {
  count: number;
  total_cost_cents: number;
}

interface DeploymentSummary {
  ready: number;
  errored: number;
}

interface LeadSummary {
  movements: number;
  won: number;
  lost: number;
}

interface SignalTaskSummary {
  count: number;
}

async function safeQ<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    return await q<T>(sql, params);
  } catch (err) {
    console.warn('[digest-weekly] query failed (likely missing schema):', err);
    return [];
  }
}

async function safeQOne<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  try {
    return await qOne<T>(sql, params);
  } catch (err) {
    console.warn('[digest-weekly] qOne failed (likely missing schema):', err);
    return null;
  }
}

export async function GET(req: Request) {
  return runDigest(req);
}

export async function POST(req: Request) {
  return runDigest(req);
}

async function runDigest(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rangeLabel = `${sevenDaysAgo.toISOString().slice(0, 10)} → ${now
    .toISOString()
    .slice(0, 10)}`;

  // ── Activity pulls ─────────────────────────────────────────────────────
  // Posts whose status changed (we approximate by updated_at, since the
  // public.posts table doesn't carry status_change_log). Bucketed by status.
  const postMovements = await safeQ<PostMovementRow>(
    `select p.id, p.status::text as status, p.post_date::text as post_date,
            c.name as client_name
       from posts p
       left join months m on m.id = p.month_id
       left join clients c on c.id = m.client_id
      where p.updated_at >= $1
        and p.status in ('captured', 'edited', 'posted')
      order by p.updated_at desc
      limit 200`,
    [sevenDaysAgo.toISOString()]
  );

  const shootsCompleted = await safeQ<ShootRow>(
    `select s.id, s.scheduled_date::text as scheduled_date,
            s.asset_status::text as asset_status,
            c.name as client_name
       from shoots s
       left join months m on m.id = s.month_id
       left join clients c on c.id = m.client_id
      where s.scheduled_date >= $1
        and s.scheduled_date <= $2
        and s.asset_status in ('captured', 'uploaded', 'edited', 'delivered')
      order by s.scheduled_date desc
      limit 200`,
    [sevenDaysAgo.toISOString().slice(0, 10), now.toISOString().slice(0, 10)]
  );

  const runSummary = (await safeQOne<RunSummary>(
    `select count(*)::int as count,
            coalesce(sum(cost_cents), 0)::int as total_cost_cents
       from voice.runs
      where created_at >= $1`,
    [sevenDaysAgo.toISOString()]
  )) ?? { count: 0, total_cost_cents: 0 };

  const deploySummary = (await safeQOne<DeploymentSummary>(
    `select
        count(*) filter (where state = 'READY')::int as ready,
        count(*) filter (where state = 'ERROR')::int as errored
       from dev.deployments
      where created_at >= $1`,
    [sevenDaysAgo.toISOString()]
  )) ?? { ready: 0, errored: 0 };

  const leadSummary = (await safeQOne<LeadSummary>(
    `select
        count(*) filter (where last_stage_changed_at >= $1)::int as movements,
        count(*) filter (where stage = 'won' and last_stage_changed_at >= $1)::int as won,
        count(*) filter (where stage = 'lost' and last_stage_changed_at >= $1)::int as lost
       from crm.leads`,
    [sevenDaysAgo.toISOString()]
  )) ?? { movements: 0, won: 0, lost: 0 };

  const signalSummary = (await safeQOne<SignalTaskSummary>(
    `select count(*)::int as count
       from command.tasks
      where origin = 'signal'
        and created_at >= $1`,
    [sevenDaysAgo.toISOString()]
  )) ?? { count: 0 };

  // ── Render the activity log markdown ──────────────────────────────────
  const lines: string[] = [];
  lines.push(`# Weekly activity — ${rangeLabel}`);
  lines.push('');

  lines.push('## Posts moved');
  if (postMovements.length === 0) {
    lines.push('_No post status changes in the last 7 days._');
  } else {
    const byStatus: Record<string, PostMovementRow[]> = {};
    for (const p of postMovements) {
      (byStatus[p.status] ??= []).push(p);
    }
    for (const [status, rows] of Object.entries(byStatus)) {
      lines.push(`- **${status}**: ${rows.length}`);
    }
  }
  lines.push('');

  lines.push('## Shoots completed');
  if (shootsCompleted.length === 0) {
    lines.push('_No shoots reached captured/edited/delivered this week._');
  } else {
    for (const s of shootsCompleted.slice(0, 20)) {
      lines.push(
        `- ${s.scheduled_date ?? 'undated'} — ${s.client_name ?? 'unknown'} — _${s.asset_status}_`
      );
    }
  }
  lines.push('');

  lines.push('## Voice (Anthropic) usage');
  lines.push(
    `- ${runSummary.count} runs · ~$${(runSummary.total_cost_cents / 100).toFixed(2)} total cost`
  );
  lines.push('');

  lines.push('## Deployments');
  lines.push(`- ${deploySummary.ready} READY · ${deploySummary.errored} ERROR`);
  lines.push('');

  lines.push('## CRM');
  lines.push(
    `- ${leadSummary.movements} stage movements · ${leadSummary.won} won · ${leadSummary.lost} lost`
  );
  lines.push('');

  lines.push('## Signals → tasks');
  lines.push(`- ${signalSummary.count} new signal-driven tasks created.`);
  lines.push('');

  const activity_log_md = lines.join('\n');

  // ── LLM render ────────────────────────────────────────────────────────
  let resolved;
  try {
    resolved = await resolveTemplate('digest.weekly_internal', {
      activity_log_md,
      week_range: rangeLabel,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `Template digest.weekly_internal not resolvable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }

  let result;
  try {
    result = await runPrompt({
      system: resolved.system,
      user: resolved.user,
      model: resolved.defaultModel,
      maxTokens: 2048,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }

  const status: 'ok' | 'stub' = result.model === 'stub' ? 'stub' : 'ok';
  await insertRun({
    prompt_template_id: resolved.templateId,
    prompt_slug: resolved.templateSlug,
    client_id: null,
    person_id: null,
    calling_app: 'voice',
    input_json: {
      activity_log_md,
      week_range: rangeLabel,
      system: resolved.system,
      user: resolved.user,
    },
    output: result.output,
    output_json: null,
    model: result.model,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    cost_cents: result.costCents,
    latency_ms: result.latencyMs,
    used_in: 'cron:digest-weekly',
    status,
    error: null,
  });

  // ── Land as a command.tasks row + notification ────────────────────────
  const title = `Weekly team digest — ${rangeLabel}`;
  const notes = result.output;
  let taskId: string | null = null;
  try {
    await tx(async client => {
      const taskRow = await client.query<{ id: string }>(
        `insert into command.tasks (
           origin, title, notes, status, client_id, created_at, updated_at
         )
         values ('recap', $1, $2, 'backlog', null, now(), now())
         returning id`,
        [title, notes]
      );
      taskId = taskRow.rows[0]?.id ?? null;

      // Notification — link points at the task. The schema for
      // public.notifications is owned by social, so we be defensive: only
      // insert the columns we know exist and let the NOT NULL set defaults.
      await client.query(
        `insert into notifications (
           kind, severity, dedup_key, title, detail, link_url, created_at, updated_at
         )
         values (
           'today_action', 'info',
           $1, $2, $3, $4, now(), now()
         )
         on conflict (dedup_key) do update set
           title = excluded.title,
           detail = excluded.detail,
           updated_at = now(),
           dismissed_at = null,
           resolved_at = null`,
        [
          `weekly-digest-${now.toISOString().slice(0, 10)}`,
          title,
          notes.slice(0, 500),
          taskId ? `/command/tasks/${taskId}` : null,
        ]
      );
    });
  } catch (err) {
    console.warn('[digest-weekly] failed to land task/notification', err);
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    week_range: rangeLabel,
    posted_count: postMovements.length,
    shoot_count: shootsCompleted.length,
    runs_count: runSummary.count,
    runs_cost_cents: runSummary.total_cost_cents,
    deploys_ready: deploySummary.ready,
    deploys_errored: deploySummary.errored,
    leads_moved: leadSummary.movements,
    signals_to_tasks: signalSummary.count,
    task_id: taskId,
    model: result.model,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    cost_cents: result.costCents,
    latency_ms: result.latencyMs,
    status,
  });
}
