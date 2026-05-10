import 'server-only';

/**
 * Pulse Voice gateway client (social tool).
 *
 * The social tool never calls Anthropic directly. Every AI surface
 * (caption rewriter, shoot brief, month drafter) goes through
 * `<VOICE_GATEWAY_URL>/api/llm/...` with a service bearer token. When
 * the env vars are missing we return realistic stubs so the UI still
 * renders during onboarding — Voice itself does the same thing
 * downstream when its own ANTHROPIC_API_KEY is missing.
 */

const CALLING_APP = 'social' as const;

export interface VoiceRunInput {
  template_slug: string;
  vars: Record<string, string>;
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
  if (!cfg) return stubRun(input);
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

function stubRun(input: VoiceRunInput): VoiceRunOk {
  let output = '';
  switch (input.template_slug) {
    case 'post-caption':
      output = [
        'Crisp morning at the ranch — coffee steaming, dogs at our heels, the herd already moving.',
        'Before sunrise, before the noise. The work that nobody sees is the work that builds the whole thing.',
        'Most days start the same way: boots, coffee, fence line. We just point a camera at it.',
      ].join('\n');
      break;
    case 'shoot-brief':
      output =
        '[stub] We are capturing the morning chore loop at the ranch — feed, fence walk, herd check — through an editorial eye that emphasizes texture and quiet labor over choreographed action. Land at least one wide of the herd at first light, one tight portrait of a hand at work, and one motion clip of the truck pulling out of frame at sunrise. Voice gateway not configured; replace this paragraph by setting VOICE_GATEWAY_URL + VOICE_GATEWAY_TOKEN.';
      break;
    case 'month-plan-drafter':
      output = [
        '[stub draft month plan — Voice gateway not configured]',
        '',
        '- 2026-05-04 reel · p1 · Pre-dawn ranch chore loop, herd-first wide → tight on hands → truck pulls out',
        '- 2026-05-06 carousel · p2 · "What a real ranch breakfast looks like" — 5 frames, no influencer plating',
        '- 2026-05-09 photo · p1 · Brand portrait of the lead hand against the morning haze',
        '- 2026-05-11 reel · p3 · ONSC origin story v2: 30s, single take, voice-over from the founder',
        '- 2026-05-14 story · p2 · Behind the carousel: the take we cut',
        '- 2026-05-17 reel · p1 · Mid-day fence walk, slow push-in, ambient sound only',
        '- 2026-05-20 carousel · p2 · "Three quiet skills the camera misses" with hands-only frames',
        '- 2026-05-23 photo · p3 · Late golden-hour wide of the working pen',
        '- 2026-05-25 reel · p1 · Sound-led: rope, gate, hoof, breath, then a single line of copy',
        '- 2026-05-28 story · p2 · Crew shot for the team page',
      ].join('\n');
      break;
    default:
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
