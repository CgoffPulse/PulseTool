import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyGatewayAuth } from '@/lib/voice/auth-gateway';
import { runPrompt } from '@/lib/voice/llm/anthropic';
import {
  injectBrandBrief,
  injectGlossary,
  resolveTemplate,
} from '@/lib/voice/template-resolver';
import { insertRun } from '@/lib/voice/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BodySchema = z.object({
  template_slug: z.string().min(1),
  vars: z.record(z.string()).default({}),
  client_id: z.string().uuid().nullable().optional(),
  calling_app: z.enum(['crm', 'social', 'analytics', 'voice', 'huddle']),
  used_in: z.string().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const auth = await verifyGatewayAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: z.infer<typeof BodySchema>;
  try {
    const json = (await req.json()) as unknown;
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid request body.',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  let vars = { ...body.vars };
  try {
    vars = await injectBrandBrief(body.client_id ?? null, vars);
    vars = await injectGlossary(body.client_id ?? null, vars);
  } catch (err) {
    // Brief/glossary injection failures shouldn't kill the call — log + carry on.
    console.warn('[voice] brief/glossary injection failed', err);
  }

  let resolved;
  try {
    resolved = await resolveTemplate(body.template_slug, vars);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : `Template not resolvable: ${body.template_slug}`,
      },
      { status: 404 }
    );
  }

  try {
    const result = await runPrompt({
      system: resolved.system,
      user: resolved.user,
      model: resolved.defaultModel,
    });
    const status: 'ok' | 'stub' = result.model === 'stub' ? 'stub' : 'ok';
    const run = await insertRun({
      prompt_template_id: resolved.templateId,
      prompt_slug: resolved.templateSlug,
      client_id: body.client_id ?? null,
      person_id: body.person_id ?? null,
      calling_app: body.calling_app,
      input_json: { vars, system: resolved.system, user: resolved.user },
      output: result.output,
      output_json: null,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_cents: result.costCents,
      latency_ms: result.latencyMs,
      used_in: body.used_in ?? null,
      status,
      error: null,
    });
    return NextResponse.json({
      ok: true,
      output: result.output,
      run_id: run.id,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_cents: result.costCents,
      latency_ms: result.latencyMs,
      status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await insertRun({
        prompt_template_id: resolved.templateId,
        prompt_slug: resolved.templateSlug,
        client_id: body.client_id ?? null,
        person_id: body.person_id ?? null,
        calling_app: body.calling_app,
        input_json: { vars, system: resolved.system, user: resolved.user },
        output: null,
        output_json: null,
        model: resolved.defaultModel,
        tokens_in: 0,
        tokens_out: 0,
        cost_cents: 0,
        latency_ms: 0,
        used_in: body.used_in ?? null,
        status: 'error',
        error: message,
      });
    } catch (logErr) {
      console.error('[voice] failed to insert error run', logErr);
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
