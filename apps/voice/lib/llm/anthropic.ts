import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

/**
 * Pulse Voice — Anthropic wrapper.
 *
 * Two entry points: `runPrompt` (free-form) + `runStructured` (tool-calling
 * coerces the model output into a Zod schema). Both handle the no-key path
 * gracefully so the rest of the app stays navigable in local dev.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 1024;

export interface RunMeta {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  latencyMs: number;
}

export interface RunResult extends RunMeta {
  output: string;
}

export interface StructuredResult<T> extends RunMeta {
  data: T;
  output: string;
}

interface RunPromptArgs {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

interface RunStructuredArgs<T> {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  schema: z.ZodType<T>;
  /**
   * JSON Schema describing the same shape as `schema`. Anthropic's tool API
   * needs JSON Schema; we keep both so we can validate at the edge.
   */
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  schemaDescription?: string;
}

// Cents per 1,000 tokens. Round up so we never under-bill.
// Source: Anthropic public pricing as of May 2026.
// Sonnet pricing has been stable across 4.5 → 4.6 generations.
const PRICING: Record<string, { in: number; out: number }> = {
  // Current generation defaults.
  'claude-sonnet-4-6': { in: 0.3, out: 1.5 },
  'claude-opus-4-7': { in: 1.5, out: 7.5 },
  'claude-haiku-4-5': { in: 0.1, out: 0.5 },
  // Legacy entry — kept so we can re-compute cost on historical runs.
  'claude-sonnet-4-5-20250929': { in: 0.3, out: 1.5 },
  // Fallback bucket, used when model is unrecognized.
  default: { in: 0.3, out: 1.5 },
};

function pricingFor(model: string) {
  return PRICING[model] ?? PRICING.default;
}

export function calcCostCents(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const p = pricingFor(model);
  // cents = (tokens / 1000) * cents_per_1k
  const raw = (tokensIn / 1000) * p.in + (tokensOut / 1000) * p.out;
  return Math.ceil(raw);
}

function makeClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function isStubMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

const STUB_MESSAGE =
  '[stub] No ANTHROPIC_API_KEY set — wire it in Vercel project settings.';

export async function runPrompt(args: RunPromptArgs): Promise<RunResult> {
  const model = args.model || DEFAULT_MODEL;
  const client = makeClient();
  if (!client) {
    return {
      output: STUB_MESSAGE,
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      model: 'stub',
      latencyMs: 0,
    };
  }
  const t0 = Date.now();
  const resp = await client.messages.create({
    model,
    max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: args.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: args.user }],
  });
  const latencyMs = Date.now() - t0;

  const output = resp.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  const tokensIn =
    (resp.usage.input_tokens ?? 0) +
    // count cached tokens against input even though they're billed less —
    // we err high on the cost calc for safety.
    (resp.usage.cache_creation_input_tokens ?? 0) +
    (resp.usage.cache_read_input_tokens ?? 0);
  const tokensOut = resp.usage.output_tokens ?? 0;

  return {
    output,
    model,
    tokensIn,
    tokensOut,
    costCents: calcCostCents(model, tokensIn, tokensOut),
    latencyMs,
  };
}

export async function runStructured<T>(
  args: RunStructuredArgs<T>
): Promise<StructuredResult<T>> {
  const model = args.model || DEFAULT_MODEL;
  const client = makeClient();
  if (!client) {
    return {
      data: {} as T,
      output: STUB_MESSAGE,
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      model: 'stub',
      latencyMs: 0,
    };
  }

  const t0 = Date.now();
  const resp = await client.messages.create({
    model,
    max_tokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: args.system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: args.user }],
    tools: [
      {
        name: args.schemaName,
        description:
          args.schemaDescription ??
          'Return the structured response in the requested shape.',
        input_schema: args.jsonSchema as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: args.schemaName },
  });
  const latencyMs = Date.now() - t0;

  const toolUse = resp.content.find(
    (b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use'
  );
  if (!toolUse) {
    throw new Error('Model did not return a tool_use block.');
  }
  const data = args.schema.parse(toolUse.input);

  const tokensIn =
    (resp.usage.input_tokens ?? 0) +
    (resp.usage.cache_creation_input_tokens ?? 0) +
    (resp.usage.cache_read_input_tokens ?? 0);
  const tokensOut = resp.usage.output_tokens ?? 0;

  return {
    data,
    output: JSON.stringify(toolUse.input, null, 2),
    model,
    tokensIn,
    tokensOut,
    costCents: calcCostCents(model, tokensIn, tokensOut),
    latencyMs,
  };
}
