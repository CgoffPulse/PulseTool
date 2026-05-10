import {
  getFunnel,
  getLostReasonReport,
  getPipelineStats,
  getSourceReport,
} from '@/lib/crm/queries';
import { LEAD_STAGES, type LeadStage } from '@/lib/crm/types';
import { StageChip } from '@/components/crm/stage-chip';
import { formatMoneyFull } from '@/lib/crm/format';

export default async function ReportsPage() {
  const [stats, funnel, sources, lost] = await Promise.all([
    getPipelineStats(),
    getFunnel(),
    getSourceReport(),
    getLostReasonReport(),
  ]);

  const funnelByStage = new Map<LeadStage, { count: number; value_cents: number }>();
  for (const row of funnel)
    funnelByStage.set(row.stage, { count: row.count, value_cents: row.value_cents });
  const totalActive =
    LEAD_STAGES
      .filter(s => s !== 'won' && s !== 'lost')
      .reduce((sum, s) => sum + (funnelByStage.get(s)?.count ?? 0), 0) || 1;
  const maxCount = Math.max(
    1,
    ...LEAD_STAGES.map(s => funnelByStage.get(s)?.count ?? 0)
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="eyebrow">Reports</span>
        <h1 className="font-display text-4xl font-bold tracking-display text-green-deep">
          The <span className="italic-amber">truth</span> about pipeline.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Funnel, win rate by source, and why we&apos;re losing — month over
          month. Numbers are live.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active leads" value={String(stats.active_leads)} />
        <Stat label="Pipeline value" value={formatMoneyFull(stats.pipeline_value_cents)} />
        <Stat label="Won (MTD)" value={String(stats.this_month_won)} hint={formatMoneyFull(stats.won_value_cents_mtd)} />
        <Stat label="Lost (MTD)" value={String(stats.this_month_lost)} />
      </section>

      <section className="flex flex-col gap-4">
        <span className="eyebrow">Funnel</span>
        <div className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            {LEAD_STAGES.map(stage => {
              const row = funnelByStage.get(stage) ?? { count: 0, value_cents: 0 };
              const pct = (row.count / maxCount) * 100;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <StageChip stage={stage} size="sm" />
                  </div>
                  <div className="relative flex-1 overflow-hidden rounded-full bg-cream/50">
                    <div
                      className={`h-3 ${barClass(stage)}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  <div className="flex w-44 shrink-0 items-baseline justify-end gap-3 font-mono text-xs tabular-nums text-charcoal/70">
                    <span className="font-semibold text-green-deep">{row.count}</span>
                    <span className="text-charcoal/55">{formatMoneyFull(row.value_cents)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
            {totalActive} active across the live stages.
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <span className="eyebrow">Win rate by source</span>
        <div className="overflow-hidden rounded-md border border-cream-dk/60 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-cream/40 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
              <tr>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-right">Leads</th>
                <th className="px-3 py-2 text-right">Won</th>
                <th className="px-3 py-2 text-right">Lost</th>
                <th className="px-3 py-2 text-right">Win %</th>
                <th className="px-3 py-2 text-right">Avg days to close</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-charcoal/55">
                    No leads yet.
                  </td>
                </tr>
              ) : (
                sources.map(s => (
                  <tr
                    key={s.source_id ?? 'none'}
                    className="border-t border-cream-dk/30 text-charcoal/85"
                  >
                    <td className="px-3 py-2">{s.source_label ?? 'Unattributed'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-deep">
                      {s.won}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-bad">
                      {s.lost}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(s.win_rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.avg_days_to_close !== null
                        ? `${s.avg_days_to_close.toFixed(0)}d`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <span className="eyebrow">Why we&apos;re losing</span>
        {lost.length === 0 ? (
          <div className="rounded-md border border-cream-dk/60 bg-white p-6 text-center text-sm text-charcoal/55 shadow-sm">
            No lost leads on record. Lucky us.
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {lost.map(r => (
              <li
                key={r.reason_id ?? 'none'}
                className="flex items-center justify-between rounded-md border border-cream-dk/60 bg-white px-3 py-2 text-sm shadow-sm"
              >
                <span>{r.reason_label ?? 'No reason logged'}</span>
                <span className="font-mono text-xs font-semibold text-bad tabular-nums">
                  {r.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
        {label}
      </div>
      <div className="font-display text-3xl font-bold tabular-nums text-green-deep">
        {value}
      </div>
      {hint && <div className="text-xs text-charcoal/55">{hint}</div>}
    </div>
  );
}

function barClass(stage: LeadStage): string {
  switch (stage) {
    case 'new':
      return 'bg-rust-200';
    case 'qualified':
      return 'bg-amber-mid';
    case 'proposal':
      return 'bg-amber-deep';
    case 'negotiation':
      return 'bg-green-mid';
    case 'won':
      return 'bg-green-deep';
    case 'lost':
      return 'bg-bad';
  }
}
