'use client';

import { useState, useTransition } from 'react';
import { runPlaygroundPrompt, type PlaygroundResult } from '@/lib/voice/actions';
import {
  formatCents,
  formatLatency,
  formatTokens,
} from '@/lib/voice/format';
import { CallingAppChip, StatusChip } from '@/components/voice/calling-app-chip';
import type { ClientLite, PromptTemplate } from '@/lib/voice/types';

export function PlaygroundForm({
  templates,
  clients,
}: {
  templates: PromptTemplate[];
  clients: ClientLite[];
}) {
  const active = templates.filter(t => !t.archived);
  const [slug, setSlug] = useState<string>(active[0]?.slug ?? '');
  const [clientId, setClientId] = useState<string>('');
  const [varsJson, setVarsJson] = useState<string>('{\n  \n}');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = active.find(t => t.slug === slug);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('template_slug', slug);
    fd.set('client_id', clientId);
    fd.set('vars_json', varsJson);
    startTransition(async () => {
      try {
        const r = await runPlaygroundPrompt(fd);
        setResult(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResult(null);
      }
    });
  }

  function loadDefaults() {
    if (!current) return;
    const placeholders = new Set<string>();
    const re = /\{\{\s*([\w.-]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    const blob = `${current.system_md}\n${current.user_md_template}`;
    while ((m = re.exec(blob))) placeholders.add(m[1]);
    const obj: Record<string, string> = {};
    for (const k of placeholders) obj[k] = '';
    setVarsJson(JSON.stringify(obj, null, 2));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 rounded-md border border-cream-dk/60 bg-white p-5 shadow-sm"
      >
        <Field label="Template">
          <select
            value={slug}
            onChange={e => setSlug(e.target.value)}
            className="select"
          >
            {active.length === 0 && <option value="">No templates</option>}
            {active.map(t => (
              <option key={t.id} value={t.slug}>
                {t.name} · {t.slug}
              </option>
            ))}
          </select>
        </Field>
        {current?.description && (
          <p className="text-xs text-charcoal/65">{current.description}</p>
        )}

        <Field label="Client (optional)" hint="Auto-injects brand brief + glossary.">
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="select"
          >
            <option value="">— No client (use vars only)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Variables (JSON)"
          hint="Maps {{var}} placeholders to strings."
        >
          <div className="flex flex-col gap-2">
            <textarea
              rows={10}
              value={varsJson}
              onChange={e => setVarsJson(e.target.value)}
              className="input font-mono text-xs"
            />
            <button
              type="button"
              onClick={loadDefaults}
              className="btn-ghost text-[11px] self-start"
            >
              Auto-fill placeholders
            </button>
          </div>
        </Field>

        <button
          type="submit"
          disabled={isPending || !slug}
          className="btn-primary disabled:opacity-50"
        >
          {isPending ? 'Running…' : 'Run prompt'}
        </button>
      </form>

      <div className="flex flex-col gap-5">
        {error && (
          <div className="rounded-md border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
              <CallingAppChip app="voice" size="sm" />
              <StatusChip status={result.status} />
              <span className="font-mono text-xs text-charcoal/65">
                {result.model}
              </span>
              <span className="ml-auto text-xs text-charcoal/55">
                {formatTokens(result.tokens_in + result.tokens_out)} tok ·{' '}
                {formatCents(result.cost_cents)} ·{' '}
                {formatLatency(result.latency_ms)}
              </span>
            </div>

            {result.error && (
              <div className="rounded-md border border-bad/30 bg-bad/10 p-4 text-sm text-bad whitespace-pre-wrap">
                {result.error}
              </div>
            )}

            <section className="flex flex-col gap-2">
              <span className="eyebrow">Output</span>
              <pre className="overflow-auto rounded-md border border-cream-dk/60 bg-white p-4 font-mono text-xs leading-body text-charcoal/85 shadow-sm whitespace-pre-wrap min-h-[180px]">
                {result.output || '(empty)'}
              </pre>
            </section>

            <details className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
                Resolved system + user
              </summary>
              <div className="mt-3 grid gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                    system
                  </div>
                  <pre className="mt-1 overflow-auto rounded-md border border-cream-dk/40 bg-cream/30 p-3 font-mono text-[11px] leading-body whitespace-pre-wrap">
                    {result.resolved_system}
                  </pre>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/50">
                    user
                  </div>
                  <pre className="mt-1 overflow-auto rounded-md border border-cream-dk/40 bg-cream/30 p-3 font-mono text-[11px] leading-body whitespace-pre-wrap">
                    {result.resolved_user}
                  </pre>
                </div>
              </div>
            </details>
          </>
        )}

        {!result && !error && (
          <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/50 p-12 text-center">
            <p className="text-sm text-charcoal/55">
              Pick a template, fill the vars, run the prompt. Result lands here
              and a row goes into the runs feed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-charcoal/55">{hint}</span>}
    </label>
  );
}
