import { NextResponse } from 'next/server';
import type { QueryResultRow } from 'pg';
import { q, qOne, tx } from '@/lib/db';
import { runPrompt } from '@/lib/llm/anthropic';
import {
  injectBrandBrief,
  injectGlossary,
  resolveTemplate,
} from '@/lib/template-resolver';
import { insertRun } from '@/lib/queries';

/**
 * Monthly per-client recap.
 *
 * Runs on the 1st of each month at 14:00 UTC. For every active client:
 *   1. Pulls the prior month's posts + shoots (delivered work).
 *   2. Tries to pull analytics insights (best-effort — try/catch on cross
 *      schema, since `analytics.*` tables may not exist in dev).
 *   3. Notes brand-brief alignment (latest version + age).
 *   4. Resolves `digest.monthly_client_recap` with brand brief + glossary
 *      auto-injected so the recap lands in the client's voice.
 *   5. Lands the recap as a `command.tasks` row + a `command.approvals`
 *      row requiring Christian + client signoff before sending.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get('x-pulse-cron') === secret) return true;
  return false;
}

interface ClientRow {
  id: string;
  name: string;
  slug: string;
}

interface PostRow {
  id: string;
  status: string;
  post_date: string | null;
  content_type: string | null;
}

interface ShootRow {
  id: string;
  scheduled_date: string | null;
  asset_status: string;
}

interface BriefMetaRow {
  version: number;
  updated_at: string;
}

interface AnalyticsSummary {
  posts_counted: number;
  total_impressions: number | null;
  total_engagement: number | null;
}

async function safeQ<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    return await q<T>(sql, params);
  } catch (err) {
    console.warn('[digest-monthly-client] query failed:', err);
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
    console.warn('[digest-monthly-client] qOne failed:', err);
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
  // Recap covers the previous calendar month.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = monthStart.toISOString().slice(0, 7); // YYYY-MM

  const clients = await safeQ<ClientRow>(
    `select id, name, slug
       from clients
      where archived = false
      order by name`
  );

  let recapsGenerated = 0;
  let totalCostCents = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const errors: Array<{ client: string; error: string }> = [];

  for (const client of clients) {
    try {
      const posts = await safeQ<PostRow>(
        `select p.id, p.status::text as status, p.post_date::text as post_date,
                p.content_type::text as content_type
           from posts p
           join months m on m.id = p.month_id
          where m.client_id = $1
            and p.post_date >= $2
            and p.post_date < $3
          order by p.post_date`,
        [client.id, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
      );

      const shoots = await safeQ<ShootRow>(
        `select s.id, s.scheduled_date::text as scheduled_date,
                s.asset_status::text as asset_status
           from shoots s
           join months m on m.id = s.month_id
          where m.client_id = $1
            and s.scheduled_date >= $2
            and s.scheduled_date < $3
          order by s.scheduled_date`,
        [client.id, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
      );

      // Best-effort analytics pull — table may not exist.
      const analytics = await safeQOne<AnalyticsSummary>(
        `select
            count(*)::int as posts_counted,
            sum(impressions)::bigint as total_impressions,
            sum(engagement)::bigint as total_engagement
           from analytics.posts_external
          where client_id = $1
            and posted_at >= $2
            and posted_at < $3`,
        [client.id, monthStart.toISOString(), monthEnd.toISOString()]
      );

      const brief = await safeQOne<BriefMetaRow>(
        `select version, updated_at::text as updated_at
           from voice.brand_briefs
          where client_id = $1
          order by version desc
          limit 1`,
        [client.id]
      );

      // Render activity_log_md per client.
      const lines: string[] = [];
      lines.push(`# ${client.name} — ${monthLabel} recap`);
      lines.push('');

      lines.push('## Content delivered');
      const posted = posts.filter(p => p.status === 'posted');
      lines.push(`- **${posted.length} posts published** of ${posts.length} planned.`);
      if (posted.length > 0) {
        const byType: Record<string, number> = {};
        for (const p of posted) {
          const t = p.content_type ?? 'other';
          byType[t] = (byType[t] ?? 0) + 1;
        }
        for (const [type, n] of Object.entries(byType)) {
          lines.push(`  - ${type}: ${n}`);
        }
      }
      lines.push('');

      lines.push('## Shoots');
      const completedShoots = shoots.filter(s =>
        ['captured', 'uploaded', 'edited', 'delivered'].includes(s.asset_status)
      );
      lines.push(`- ${completedShoots.length} of ${shoots.length} shoots completed.`);
      lines.push('');

      lines.push('## Performance');
      if (analytics && analytics.posts_counted > 0) {
        lines.push(`- ${analytics.posts_counted} posts measured externally.`);
        if (analytics.total_impressions !== null) {
          lines.push(`- Total impressions: ${analytics.total_impressions}`);
        }
        if (analytics.total_engagement !== null) {
          lines.push(`- Total engagement: ${analytics.total_engagement}`);
        }
      } else {
        lines.push('_No external analytics pulled this month._');
      }
      lines.push('');

      lines.push('## Brand brief alignment');
      if (brief) {
        const ageMs = now.getTime() - new Date(brief.updated_at).getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        lines.push(`- Latest brief: v${brief.version} (${ageDays} days old).`);
      } else {
        lines.push('- No brand brief on file. **Recommendation:** capture one this month.');
      }
      lines.push('');

      const activity_log_md = lines.join('\n');

      // Inject brand brief + glossary so the prompt has the voice baked in.
      let vars: Record<string, string> = {
        activity_log_md,
        client_name: client.name,
        month: monthLabel,
      };
      try {
        vars = await injectBrandBrief(client.id, vars);
        vars = await injectGlossary(client.id, vars);
      } catch (err) {
        console.warn(
          `[digest-monthly-client] brief/glossary injection failed for ${client.slug}`,
          err
        );
      }

      const resolved = await resolveTemplate('digest.monthly_client_recap', vars);

      const result = await runPrompt({
        system: resolved.system,
        user: resolved.user,
        model: resolved.defaultModel,
        maxTokens: 3000,
      });

      const status: 'ok' | 'stub' = result.model === 'stub' ? 'stub' : 'ok';
      await insertRun({
        prompt_template_id: resolved.templateId,
        prompt_slug: resolved.templateSlug,
        client_id: client.id,
        person_id: null,
        calling_app: 'voice',
        input_json: {
          vars,
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
        used_in: `cron:digest-monthly-client:${client.slug}`,
        status,
        error: null,
      });

      totalCostCents += result.costCents;
      totalTokensIn += result.tokensIn;
      totalTokensOut += result.tokensOut;

      // Land task + approvals row.
      const title = `Monthly recap — ${client.name} — ${monthLabel}`;
      const notes = result.output;
      try {
        await tx(async pgClient => {
          const taskRow = await pgClient.query<{ id: string }>(
            `insert into command.tasks (
               origin, title, notes, status, client_id, created_at, updated_at
             )
             values ('recap', $1, $2, 'backlog', $3, now(), now())
             returning id`,
            [title, notes, client.id]
          );
          const taskId = taskRow.rows[0]?.id ?? null;

          if (taskId) {
            await pgClient.query(
              `insert into command.approvals (
                 artifact_kind, artifact_id, client_id,
                 required_approvers, state, created_at, updated_at
               )
               values (
                 'recap', $1, $2,
                 array['christian', 'client']::text[], 'pending', now(), now()
               )`,
              [taskId, client.id]
            );
          }
        });
      } catch (err) {
        console.warn(
          `[digest-monthly-client] failed to land task+approval for ${client.slug}`,
          err
        );
      }

      recapsGenerated += 1;
    } catch (err) {
      errors.push({
        client: client.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - t0,
    month: monthLabel,
    clients_processed: clients.length,
    recaps_generated: recapsGenerated,
    total_cost_cents: totalCostCents,
    total_tokens_in: totalTokensIn,
    total_tokens_out: totalTokensOut,
    errors,
  });
}
