import 'server-only';
import type {
  ChartSpec,
  RecommendationStructured,
  TagPostStructured,
} from './types';

/**
 * Pulse Voice gateway client.
 *
 * Analytics is a thin client of the Voice LLM gateway sibling app — every
 * outbound call (insight, recommendation, tag, chart pick) goes through
 * `<VOICE_GATEWAY_URL>/api/llm/...` with a service bearer token. When the env
 * vars are missing we return realistic stubs so the UI still renders during
 * onboarding.
 *
 * Note: post-merge the orchestrator may swap this for direct
 * `@/lib/voice/llm/anthropic` imports. For now we keep the gateway hop so
 * the public contract is unchanged.
 */

const CALLING_APP = 'analytics';

export type VoiceSchemaName =
  | 'analytics.tag_post'
  | 'analytics.recommendation'
  | 'analytics.chart_pick';

export interface VoiceRunInput {
  template_slug: string;
  vars: Record<string, unknown>;
  client_id?: string | null;
  used_in?: string | null;
}

export interface VoiceRunOk {
  ok: true;
  output: string;
  run_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  stub?: boolean;
}

export interface VoiceRunErr {
  ok: false;
  output: string;
  error?: string;
  stub?: boolean;
  run_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
}

export type VoiceRunResult = VoiceRunOk | VoiceRunErr;

export interface VoiceStructuredOk<T> {
  ok: true;
  data: T;
  run_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  stub?: boolean;
}

export interface VoiceStructuredErr<T> {
  ok: false;
  data: T;
  error?: string;
  stub?: boolean;
  run_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
}

export type VoiceStructuredResult<T> = VoiceStructuredOk<T> | VoiceStructuredErr<T>;

function gatewayConfigured(): { base: string; token: string } | null {
  const base = (process.env.VOICE_GATEWAY_URL ?? '').replace(/\/$/, '');
  const token = process.env.VOICE_GATEWAY_TOKEN ?? '';
  if (!base || !token) return null;
  return { base, token };
}

export function isVoiceGatewayConfigured(): boolean {
  return gatewayConfigured() !== null;
}

export async function runPrompt(input: VoiceRunInput): Promise<VoiceRunResult> {
  const cfg = gatewayConfigured();
  if (!cfg) {
    return stubRun(input);
  }
  try {
    const res = await fetch(`${cfg.base}/api/llm/run`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        template_slug: input.template_slug,
        vars: input.vars,
        client_id: input.client_id ?? null,
        calling_app: CALLING_APP,
        used_in: input.used_in ?? null,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        output: '[gateway error]',
        error: `${res.status} ${text.slice(0, 200)}`,
        run_id: null,
        model: null,
        tokens_in: null,
        tokens_out: null,
        cost_cents: null,
      };
    }
    const json = (await res.json().catch(() => null)) as
      | (Partial<VoiceRunOk> & { ok?: boolean })
      | null;
    if (!json || !json.ok) {
      return {
        ok: false,
        output: '[gateway empty]',
        error: 'no body',
        run_id: null,
        model: null,
        tokens_in: null,
        tokens_out: null,
        cost_cents: null,
      };
    }
    return {
      ok: true,
      output: typeof json.output === 'string' ? json.output : '',
      run_id: json.run_id ?? null,
      model: json.model ?? null,
      tokens_in: json.tokens_in ?? null,
      tokens_out: json.tokens_out ?? null,
      cost_cents: json.cost_cents ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      output: '[gateway unreachable]',
      error: (err as Error).message,
      run_id: null,
      model: null,
      tokens_in: null,
      tokens_out: null,
      cost_cents: null,
    };
  }
}

export interface VoiceStructuredInput {
  template_slug: string;
  vars: Record<string, unknown>;
  output_schema_name: VoiceSchemaName;
  client_id?: string | null;
  used_in?: string | null;
}

export async function runStructured<T>(
  input: VoiceStructuredInput
): Promise<VoiceStructuredResult<T>> {
  const cfg = gatewayConfigured();
  if (!cfg) {
    return stubStructured<T>(input);
  }
  try {
    const res = await fetch(`${cfg.base}/api/llm/structured`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        template_slug: input.template_slug,
        vars: input.vars,
        output_schema_name: input.output_schema_name,
        client_id: input.client_id ?? null,
        calling_app: CALLING_APP,
        used_in: input.used_in ?? null,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const stub = stubStructured<T>(input);
      const text = await res.text().catch(() => '');
      return { ...stub, ok: false, error: `${res.status} ${text.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: T; run_id?: string; model?: string; tokens_in?: number; tokens_out?: number; cost_cents?: number }
      | null;
    if (!json || !json.ok || json.data === undefined) {
      const stub = stubStructured<T>(input);
      return { ...stub, ok: false, error: 'empty body' };
    }
    return {
      ok: true,
      data: json.data,
      run_id: json.run_id ?? null,
      model: json.model ?? null,
      tokens_in: json.tokens_in ?? null,
      tokens_out: json.tokens_out ?? null,
      cost_cents: json.cost_cents ?? null,
    };
  } catch (err) {
    const stub = stubStructured<T>(input);
    return { ...stub, ok: false, error: (err as Error).message };
  }
}

// ───── Stubs ───────────────────────────────────────────────────────────────

function stubRun(input: VoiceRunInput): VoiceRunOk {
  const slug = input.template_slug;
  let output = '';
  if (slug === 'analytics-insight') {
    output = [
      '**Stub insight (voice gateway not configured).**',
      '',
      'Reach is up modestly week-over-week, but saves are flat — engagement quality',
      'is leveling off. The strongest piece this week was a behind-the-scenes reel',
      '— that pillar earned 3× the saves of any promotional post.',
      '',
      '_Question for the team_: should we double the cadence on behind-the-scenes',
      'next month and pull back on hard-promo carousels?',
    ].join('\n');
  } else {
    output =
      '[stub] Voice gateway is not configured. Set VOICE_GATEWAY_URL and VOICE_GATEWAY_TOKEN to enable AI output.';
  }
  return {
    ok: true,
    output,
    run_id: null,
    model: null,
    tokens_in: null,
    tokens_out: null,
    cost_cents: null,
    stub: true,
  };
}

function stubStructured<T>(input: VoiceStructuredInput): VoiceStructuredOk<T> {
  const data = stubDataFor(input.output_schema_name) as unknown as T;
  return {
    ok: true,
    data,
    run_id: null,
    model: null,
    tokens_in: null,
    tokens_out: null,
    cost_cents: null,
    stub: true,
  };
}

function stubDataFor(schema: VoiceSchemaName): unknown {
  switch (schema) {
    case 'analytics.tag_post': {
      const t: TagPostStructured = {
        pillar: 'behind_the_scenes',
        hook_style: 'story',
        format_quality: 4,
        reasoning: '[stub] Looks like a BTS story-style post.',
      };
      return t;
    }
    case 'analytics.recommendation': {
      const r: RecommendationStructured = {
        actions: [
          {
            kind: 'repeat_post',
            title: 'Repeat the BTS reel from last week',
            rationale_md:
              '[stub] BTS reels are over-indexing on saves. Repeat the format with a new angle within 7 days.',
            evidence_post_ids: [],
          },
          {
            kind: 'change_cadence',
            title: 'Shift one promo carousel to a Reel',
            rationale_md:
              '[stub] Carousel reach is below median; reel reach is 2× higher. Convert one promo asset to reel.',
            evidence_post_ids: [],
          },
          {
            kind: 'pillar_rebalance',
            title: 'Move pillar mix to 40 / 30 / 30',
            rationale_md:
              '[stub] Pillar 1 is starving the feed. Bring it from 33 → 40 over the next 14 days.',
            evidence_post_ids: [],
          },
        ],
      };
      return r;
    }
    case 'analytics.chart_pick': {
      const c: ChartSpec = {
        chart_type: 'line',
        x_axis: 'date',
        y_axis: 'reach',
        series: [{ label: 'Reach 28d', dataset_filter: 'all' }],
        title: '[stub] Reach over the last 28 days',
        explanation:
          '[stub] Voice gateway not configured — pretend this is a sensible chart for your question.',
        data: stubChartData(),
      };
      return c;
    }
    default:
      return {};
  }
}

function stubChartData(): Array<Record<string, string | number | null>> {
  const today = new Date();
  const out: Array<Record<string, string | number | null>> = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const base = 800 + Math.round(Math.sin(i / 3) * 200 + i * 12);
    out.push({ date: iso, reach: base });
  }
  return out;
}
