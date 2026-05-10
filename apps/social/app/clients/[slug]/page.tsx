import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { ArrowUpRight, Compass } from 'lucide-react';
import {
  buildMonthContext,
  getClientBySlug,
  getCurrentStrategicFrame,
  listMonthsForClient,
} from '@/lib/queries';
import { monthKpis, validationGates } from '@/lib/computations';
import { fmtMonth, monthSlug } from '@/lib/utils';
import { NotificationBanner } from '@/components/notification-banner';

export const dynamic = 'force-dynamic';

export default async function ClientHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const today = startOfMonth(new Date());
  const upcomingIsos = [today, addMonths(today, 1), addMonths(today, 2)].map(d =>
    format(d, 'yyyy-MM-01')
  );
  const existingMonths = await listMonthsForClient(client.id);
  const existingIsos = new Set(existingMonths.map(m => m.month));
  const allIsos = Array.from(
    new Set([...upcomingIsos, ...existingMonths.map(m => m.month)])
  ).sort((a, b) => (a < b ? 1 : -1));

  const frame = await getCurrentStrategicFrame(client.id);

  const summaries = await Promise.all(
    allIsos.map(async iso => {
      const ctx = await buildMonthContext(client, iso);
      const k = monthKpis(ctx);
      const gates = validationGates(ctx);
      return {
        iso,
        kpis: k,
        ok: gates.filter(g => g.status === 'ok').length,
        total: gates.length,
        hasData: existingIsos.has(iso),
      };
    })
  );

  return (
    <div className="space-y-12">
      <Header client={client} frame={frame} />

      <NotificationBanner clientId={client.id} />

      <section>
        <header className="flex items-end justify-between border-b border-cream-dk/60 pb-4">
          <div>
            <div className="eyebrow">Issues</div>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-display text-green-deep">
              Months
            </h2>
          </div>
          <p className="hidden max-w-md text-right text-sm italic text-charcoal/60 md:block">
            Every month is its own issue. Plan, produce, ship.
          </p>
        </header>

        <ul className="mt-6 divide-y divide-cream-dk/60 overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
          {summaries.map(s => (
            <MonthRow key={s.iso} slug={slug} summary={s} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Header({
  client,
  frame,
}: {
  client: { name: string; color: string; slug: string };
  frame: Awaited<ReturnType<typeof getCurrentStrategicFrame>>;
}) {
  return (
    <header className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr,1fr]">
      <div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-eyebrow text-charcoal/55">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-cream-dk/60"
            style={{ backgroundColor: client.color }}
          />
          Workspace · /{client.slug}
        </div>
        <h1 className="mt-5 font-display text-5xl font-black leading-display tracking-display text-green-deep md:text-6xl">
          {client.name}
        </h1>
        {frame?.role_of_social ? (
          <p className="mt-5 max-w-2xl text-base leading-body text-charcoal/75">
            {frame.role_of_social}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/clients/${client.slug}/strategy`}
            className="inline-flex items-center gap-2 rounded-md border border-cream-dk bg-white px-4 py-2 text-xs uppercase tracking-label text-charcoal transition-colors duration-fast hover:border-amber-mid/50 hover:text-amber-deep"
          >
            <Compass size={14} />
            Strategy
            <ArrowUpRight size={14} className="opacity-60" />
          </Link>
        </div>
      </div>

      {frame ? (
        <aside className="rounded-2xl border border-cream-dk/60 bg-cream-lt p-6">
          <div className="eyebrow">
            Strategic frame · {frame.quarter ?? '—'}
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <DefRow label="Audience" value={frame.primary_audience} />
            <DefRow label="Voice" value={frame.brand_voice} />
            <DefRow label="Cadence" value={frame.cadence} />
            <DefRow
              label="Shoots / mo"
              value={
                frame.contracted_shoots_per_month != null
                  ? String(frame.contracted_shoots_per_month)
                  : null
              }
            />
          </dl>
        </aside>
      ) : null}
    </header>
  );
}

function DefRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[auto,1fr] items-baseline gap-4">
      <dt className="text-[10px] uppercase tracking-eyebrow text-charcoal/50">{label}</dt>
      <dd className="text-right text-charcoal">
        {value ?? <span className="text-charcoal/40">—</span>}
      </dd>
    </div>
  );
}

function MonthRow({
  slug,
  summary,
}: {
  slug: string;
  summary: {
    iso: string;
    kpis: ReturnType<typeof monthKpis>;
    ok: number;
    total: number;
    hasData: boolean;
  };
}) {
  const m = monthSlug(summary.iso);
  const allGreen = summary.ok === summary.total && summary.kpis.contracted_shoots != null;
  const month = parseISO(summary.iso);
  return (
    <li className="group">
      <Link
        href={`/clients/${slug}/months/${m}/planning`}
        className="grid grid-cols-[auto,1fr,auto] items-center gap-7 px-6 py-6 transition-colors duration-fast hover:bg-cream-lt"
      >
        <div className="text-right leading-none">
          <div className="font-display text-4xl font-bold text-green-deep">
            {format(month, 'LL')}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
            {format(month, 'yyyy')}
          </div>
        </div>

        <div>
          <div className="font-display text-2xl font-bold text-green-deep">
            {fmtMonth(summary.iso)}
            {summary.hasData ? null : (
              <span className="ml-3 text-xs italic font-body font-normal text-charcoal/45">
                empty
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-charcoal/60">
            <Stat label="Posts" value={summary.kpis.total_posts} />
            <Stat label="Via shoots" value={summary.kpis.posts_via_shoots} />
            <Stat label="No-shoot" value={summary.kpis.posts_via_no_shoot} />
            <Stat label="Shoots" value={summary.kpis.contracted_shoots ?? '—'} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <GateMeter ok={summary.ok} total={summary.total} allGreen={allGreen} />
          <span className="rounded-md border border-cream-dk px-3 py-1.5 text-xs uppercase tracking-label text-charcoal/55 transition-colors duration-fast group-hover:border-amber-mid group-hover:text-amber-deep">
            Open →
          </span>
        </div>
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/45">{label}</span>
      <span className="font-display text-xl font-bold text-green-deep tabular-nums">
        {value}
      </span>
    </span>
  );
}

function GateMeter({
  ok,
  total,
  allGreen,
}: {
  ok: number;
  total: number;
  allGreen: boolean;
}) {
  return (
    <div className="hidden items-center gap-3 md:flex">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={
              i < ok
                ? 'h-4 w-1.5 rounded-sm bg-green-mid'
                : 'h-4 w-1.5 rounded-sm bg-cream-dk/70'
            }
          />
        ))}
      </div>
      <span
        className={
          'font-display text-sm font-bold tabular-nums ' +
          (allGreen ? 'text-green-deep' : ok > 0 ? 'text-amber-deep' : 'text-charcoal/40')
        }
      >
        {ok}/{total}
      </span>
    </div>
  );
}
