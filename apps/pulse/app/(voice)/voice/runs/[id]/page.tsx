import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getRun } from '@/lib/voice/queries';
import {
  formatCents,
  formatDateTime,
  formatLatency,
  formatTokens,
} from '@/lib/voice/format';
import { CallingAppChip, StatusChip } from '@/components/voice/calling-app-chip';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const tokens = (run.tokens_in ?? 0) + (run.tokens_out ?? 0);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/voice/runs"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Runs
        </Link>

        <header className="grain relative mt-4 overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-8 text-cream shadow-card">
          <span
            aria-hidden
            className="watermark cream pointer-events-none absolute -top-6 right-4 text-[140px] leading-none"
          >
            RUN
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <CallingAppChip app={run.calling_app} />
            <StatusChip status={run.status} />
            {run.client_name && (
              <span className="chip-on-dark">{run.client_name}</span>
            )}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-display sm:text-4xl">
            {run.template_name ?? run.prompt_slug ?? 'Custom run'}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/75">
            <span>
              Model: <span className="italic-amber">{run.model ?? '—'}</span>
            </span>
            <span>
              Tokens:{' '}
              <span className="italic-amber">{formatTokens(tokens)}</span>{' '}
              <span className="text-cream/50">
                ({run.tokens_in ?? 0} in / {run.tokens_out ?? 0} out)
              </span>
            </span>
            <span>
              Cost:{' '}
              <span className="italic-amber">
                {formatCents(run.cost_cents)}
              </span>
            </span>
            <span>
              Latency:{' '}
              <span className="italic-amber">
                {formatLatency(run.latency_ms)}
              </span>
            </span>
            <span>{formatDateTime(run.created_at)}</span>
          </div>
          {run.used_in && (
            <div className="mt-3 text-xs text-cream/60">
              Used in: <span className="font-mono">{run.used_in}</span>
            </div>
          )}
        </header>
      </div>

      {run.error && (
        <section className="rounded-md border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
          <div className="font-semibold uppercase tracking-eyebrow">Error</div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
            {run.error}
          </pre>
        </section>
      )}

      {run.output && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Output</span>
          <pre className="overflow-auto rounded-md border border-cream-dk/60 bg-white p-4 font-mono text-xs leading-body text-charcoal/85 shadow-sm whitespace-pre-wrap">
            {run.output}
          </pre>
        </section>
      )}

      {run.output_json !== null && run.output_json !== undefined ? (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Structured output</span>
          <pre className="overflow-auto rounded-md border border-cream-dk/60 bg-charcoal text-cream-lt p-4 font-mono text-xs leading-body shadow-sm">
            {JSON.stringify(run.output_json, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <span className="eyebrow">Input</span>
        <pre className="overflow-auto rounded-md border border-cream-dk/60 bg-charcoal text-cream-lt p-4 font-mono text-xs leading-body shadow-sm">
          {JSON.stringify(run.input_json, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm sm:grid-cols-3">
        <Meta label="Run ID" value={run.id} mono />
        {run.template_slug && (
          <Meta
            label="Template"
            value={run.template_slug}
            href={`/voice/templates/${run.template_slug}`}
            mono
          />
        )}
        {run.client_id && (
          <Meta
            label="Client"
            value={run.client_name ?? run.client_id}
            href={`/voice/briefs/${run.client_id}`}
          />
        )}
      </section>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
}) {
  const inner = (
    <span
      className={
        mono
          ? 'font-mono text-xs text-charcoal/85 break-all'
          : 'text-sm text-charcoal/85'
      }
    >
      {value}
    </span>
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
        {label}
      </span>
      {href ? (
        <Link href={href} className="hover:text-amber-deep">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}
