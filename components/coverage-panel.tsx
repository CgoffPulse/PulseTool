import { Check, X as XIcon } from 'lucide-react';
import { coverageRows, monthKpis, validationGates } from '@/lib/computations';
import { CONTENT_TYPE_LABEL, type MonthContext } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_RING: Record<string, string> = {
  ok: 'bg-green-light/15 text-green-deep ring-green-light/50',
  short_on_plan: 'bg-bad/10 text-bad ring-bad/40',
  gap_to_fill: 'bg-amber-mid/15 text-amber-deep ring-amber-mid/40',
  over_capacity: 'bg-amber-mid/15 text-amber-deep ring-amber-mid/40',
  no_target: 'bg-cream-lt text-charcoal/45 ring-cream-dk',
};

const STATUS_LABEL: Record<string, string> = {
  ok: 'OK',
  short_on_plan: 'Short',
  gap_to_fill: 'Gap',
  over_capacity: 'Over',
  no_target: '—',
};

export function CoveragePanel({
  ctx,
  variant = 'rail',
}: {
  ctx: MonthContext;
  variant?: 'rail' | 'full';
}) {
  const rows = coverageRows(ctx);
  const k = monthKpis(ctx);
  const gates = validationGates(ctx);
  const okGates = gates.filter(g => g.status === 'ok').length;
  const allGreen = okGates === gates.length;

  return (
    <div className="space-y-6">
      <Scoreboard
        kpis={k}
        okGates={okGates}
        totalGates={gates.length}
        allGreen={allGreen}
      />

      <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
        <div className="border-b border-cream-dk/60 px-5 py-4">
          <div className="eyebrow">Coverage gaps</div>
          <div className="mt-2 font-display text-lg font-bold text-green-deep">
            By content type
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-lt/60 text-[10px] uppercase tracking-eyebrow text-charcoal/50">
              <th className="px-5 py-2.5 text-left font-semibold">Type</th>
              <th className="px-2 py-2.5 text-right font-semibold">Plan</th>
              <th className="px-2 py-2.5 text-right font-semibold">Cap</th>
              <th className="px-2 py-2.5 text-right font-semibold">Gap</th>
              <th className="px-2 py-2.5 text-right font-semibold">Tgt</th>
              <th className="px-4 py-2.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-dk/40">
            {rows.map(r => (
              <tr key={r.content_type}>
                <td className="px-5 py-3 font-medium text-charcoal">
                  {CONTENT_TYPE_LABEL[r.content_type]}
                </td>
                <td className="px-2 py-3 text-right font-display font-bold text-green-deep tabular-nums">
                  {r.planned}
                </td>
                <td className="px-2 py-3 text-right font-display tabular-nums text-charcoal/55">
                  {r.capacity}
                </td>
                <td
                  className={cn(
                    'px-2 py-3 text-right font-display font-bold tabular-nums',
                    r.gap > 0 ? 'text-amber-deep' : 'text-charcoal/35'
                  )}
                >
                  {r.gap || '—'}
                </td>
                <td className="px-2 py-3 text-right font-display tabular-nums text-charcoal/55">
                  {r.target ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-label ring-1 ring-inset',
                      STATUS_RING[r.status]
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {variant === 'full' ? (
          <div className="border-t border-cream-dk/60 bg-cream-lt/40 px-5 py-3 text-[11px] leading-snug text-charcoal/60">
            <strong className="text-charcoal">Plan</strong> = posts of that type ·{' '}
            <strong className="text-charcoal">Cap</strong> = sum of shoot template
            capacities (within contracted shoots) ·{' '}
            <strong className="text-charcoal">Gap</strong> = max(0, Plan − Cap)
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-cream-dk/60 px-5 py-4">
          <div>
            <div className="eyebrow">Ready to send</div>
            <div className="mt-2 font-display text-lg font-bold text-green-deep">
              {allGreen ? 'All gates green.' : `${okGates} of ${gates.length} green`}
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-label ring-1 ring-inset',
              allGreen
                ? 'bg-green-light/15 text-green-deep ring-green-light/50'
                : 'bg-bad/10 text-bad ring-bad/40'
            )}
          >
            {allGreen ? 'Ship-ready' : 'Hold'}
          </span>
        </div>
        <ul className="divide-y divide-cream-dk/40">
          {gates.map(g => (
            <li key={g.name} className="flex items-start gap-3 px-5 py-3.5">
              <span
                className={cn(
                  'mt-0.5 grid h-5 w-5 place-items-center rounded-full',
                  g.status === 'ok'
                    ? 'bg-green-light/20 text-green-deep'
                    : 'bg-bad/15 text-bad'
                )}
              >
                {g.status === 'ok' ? <Check size={12} /> : <XIcon size={12} />}
              </span>
              <div className="flex-1 leading-snug">
                <div className="text-sm font-semibold text-charcoal">{g.name}</div>
                <div className="text-xs text-charcoal/60">{g.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Scoreboard({
  kpis,
  okGates,
  totalGates,
  allGreen,
}: {
  kpis: ReturnType<typeof monthKpis>;
  okGates: number;
  totalGates: number;
  allGreen: boolean;
}) {
  return (
    <div className="grain overflow-hidden rounded-2xl border border-green-deep bg-green-deep p-6 text-cream shadow-glowGreen">
      <div className="flex items-center justify-between">
        <div className="eyebrow cream">Scoreboard</div>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-cream/60">
          <span
            className={cn(
              'pulse-dot inline-block h-1.5 w-1.5 rounded-full',
              allGreen ? 'bg-amber-mid' : 'bg-amber-light'
            )}
          />
          {allGreen ? 'Live' : 'In progress'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
        <Cell label="Posts" value={kpis.total_posts} />
        <Cell label="Via shoots" value={kpis.posts_via_shoots} />
        <Cell label="No-shoot" value={kpis.posts_via_no_shoot} />
        <Cell label="Shoots" value={kpis.contracted_shoots ?? '—'} />
      </div>

      <div className="mt-6 border-t border-cream/10 pt-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-eyebrow text-cream/55">
          <span>Gates</span>
          <span className="font-display text-base font-bold text-cream tabular-nums">
            {okGates}/{totalGates}
          </span>
        </div>
        <div className="mt-2.5 flex gap-1">
          {Array.from({ length: totalGates }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-sm transition-colors duration-fast',
                i < okGates ? 'bg-amber-mid' : 'bg-cream/15'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl font-black leading-none tabular-nums text-cream">
        {value}
      </div>
    </div>
  );
}
