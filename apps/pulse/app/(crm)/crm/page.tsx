import Link from 'next/link';
import { AlertTriangle, ArrowRight, Plus, Sparkles } from 'lucide-react';
import {
  getPipelineStats,
  listLeads,
  listSources,
  listStalledLeads,
} from '@/lib/crm/queries';
import { LeadCard } from '@/components/crm/lead-card';
import { PipelineBoard } from '@/components/crm/pipeline-board';
import { QuickLeadForm } from '@/components/crm/quick-lead-form';
import { formatMoneyFull } from '@/lib/crm/format';

export default async function PipelinePage() {
  const [stats, leads, stalled, sources] = await Promise.all([
    getPipelineStats(),
    listLeads(),
    listStalledLeads(7),
    listSources(),
  ]);

  const isEmpty = leads.length === 0;

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Header
        stats={{
          newCount: stats.this_month_new,
          wonCount: stats.this_month_won,
          lostCount: stats.this_month_lost,
          pipeline: stats.pipeline_value_cents,
          wonValue: stats.won_value_cents_mtd,
          active: stats.active_leads,
          stalledCount: stats.stalled_count,
        }}
      />

      {stalled.length > 0 && <StalledStrip stalled={stalled} />}

      <section className="flex flex-col gap-3">
        <SectionHeading title="Quick add">
          <Link
            href="/crm/leads/new"
            className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
          >
            Open full editor →
          </Link>
        </SectionHeading>
        <QuickLeadForm sources={sources} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Pipeline">
          <span className="text-[11px] uppercase tracking-[0.08em] text-stone-500">
            {leads.length} lead{leads.length === 1 ? '' : 's'}
          </span>
        </SectionHeading>
        {isEmpty ? <EmptyState /> : <PipelineBoard leads={leads} />}
      </section>
    </div>
  );
}

// ─── Header (neutral, no editorial hero) ──────────────────────────────────

function Header({
  stats,
}: {
  stats: {
    newCount: number;
    wonCount: number;
    lostCount: number;
    pipeline: number;
    wonValue: number;
    active: number;
    stalledCount: number;
  };
}) {
  return (
    <header className="flex flex-col gap-6 border-b border-stone-200 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
            Pulse CRM · Pipeline
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            Pipeline
          </h1>
          <p className="text-[14px] text-stone-600">
            {stats.active} live · {stats.stalledCount} stalled ·{' '}
            <span className="tabular-nums">{formatMoneyFull(stats.pipeline)}</span> on the table
          </p>
        </div>
        <Link
          href="/crm/leads/new"
          className="inline-flex items-center gap-2 rounded-md bg-green-deep px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-cream shadow-sm transition-colors hover:bg-green-deep/90"
        >
          <Plus size={14} /> New lead
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="New this month" value={String(stats.newCount)} />
        <StatTile label="Won this month" value={String(stats.wonCount)} accent />
        <StatTile label="Lost this month" value={String(stats.lostCount)} />
        <StatTile label="Pipeline value" value={formatMoneyFull(stats.pipeline)} />
        <StatTile label="Won (MTD)" value={formatMoneyFull(stats.wonValue)} accent />
      </div>
    </header>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-semibold tabular-nums ${
          accent ? 'text-amber-deep' : 'text-stone-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Stalled strip ────────────────────────────────────────────────────────

function StalledStrip({ stalled }: { stalled: Awaited<ReturnType<typeof listStalledLeads>> }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Needs attention">
        <Link
          href="/crm/inbox"
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          See full inbox <ArrowRight size={12} />
        </Link>
      </SectionHeading>
      <div className="flex flex-col gap-3 rounded-lg border border-bad/30 bg-bad/5 p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-bad">
          <AlertTriangle size={14} />
          {stalled.length} lead{stalled.length === 1 ? '' : 's'} stalled
          <span className="font-normal text-stone-600">— no touch in 7+ days</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stalled.slice(0, 6).map(l => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────

function SectionHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
      <Sparkles size={24} className="mb-3 text-amber-deep" />
      <h2 className="font-display text-xl font-semibold text-stone-900">
        Pipeline is empty
      </h2>
      <p className="mt-2 max-w-md text-[14px] text-stone-600">
        Add your first lead with the quick form above, or open the full editor for richer detail.
      </p>
      <Link
        href="/crm/leads/new"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-green-deep px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-cream shadow-sm hover:bg-green-deep/90"
      >
        <Plus size={14} /> New lead in full editor
      </Link>
    </div>
  );
}
