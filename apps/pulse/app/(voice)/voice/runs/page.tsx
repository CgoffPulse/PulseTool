import Link from 'next/link';
import { listRuns } from '@/lib/voice/queries';
import { CALLING_APPS } from '@/lib/voice/types';
import {
  formatCents,
  formatDateTime,
  formatLatency,
  formatTokens,
} from '@/lib/voice/format';
import { CallingAppChip, StatusChip } from '@/components/voice/calling-app-chip';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<{ app?: string }>;
}

export default async function RunsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const app =
    sp.app && CALLING_APPS.includes(sp.app as (typeof CALLING_APPS)[number])
      ? sp.app
      : null;
  const runs = await listRuns({ callingApp: app, limit: 200 });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Runs</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          Every <span className="italic-amber">call</span>, logged.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Append-only feed of every LLM call across the suite. Click in to see
          the full input + output for a run.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip href="/voice/runs" active={!app}>
            All apps
          </FilterChip>
          {CALLING_APPS.map(a => (
            <FilterChip key={a} href={`/voice/runs?app=${a}`} active={app === a}>
              {a}
            </FilterChip>
          ))}
        </div>
      </header>

      {runs.length === 0 ? (
        <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-12 text-center">
          <p className="text-sm text-charcoal/65">
            No runs yet for{' '}
            <span className="italic-amber">{app ?? 'any app'}</span>.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">App</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Model</th>
                <th className="px-3 py-2 text-right">Tokens</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Latency</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr
                  key={r.id}
                  className="border-t border-cream-dk/30 transition-colors hover:bg-cream/20"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/voice/runs/${r.id}`}
                      className="text-xs text-charcoal/75 hover:text-amber-deep"
                    >
                      {formatDateTime(r.created_at)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <CallingAppChip app={r.calling_app} size="sm" />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/voice/runs/${r.id}`}
                      className="font-semibold text-green-deep hover:text-amber-deep"
                    >
                      {r.template_name ?? r.prompt_slug ?? '—'}
                    </Link>
                    {r.client_name && (
                      <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                        {r.client_name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-charcoal/65">
                    {r.model ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-charcoal/75">
                    {formatTokens((r.tokens_in ?? 0) + (r.tokens_out ?? 0))}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-charcoal/75">
                    {formatCents(r.cost_cents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-charcoal/55">
                    {formatLatency(r.latency_ms)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs uppercase tracking-eyebrow transition-colors',
        active
          ? 'border-green-deep/40 bg-green-deep text-cream-lt'
          : 'border-cream-dk/50 bg-white text-charcoal/65 hover:border-amber-mid/50 hover:text-amber-deep'
      )}
    >
      {children}
    </Link>
  );
}
