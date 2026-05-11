import Link from 'next/link';
import { AlertTriangle, ArrowRight, Plus, Sparkles } from 'lucide-react';
import {
  getPipelineStats,
  listLeads,
  listSources,
  listStalledLeads,
} from '@/lib/crm/queries';
import type { LeadWithMeta } from '@/lib/crm/types';
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
    <div className="flex flex-col gap-10">
      <Hero
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

      <section className="flex flex-col gap-3">
        <span className="eyebrow">Quick add</span>
        <QuickLeadForm sources={sources} />
      </section>

      {stalled.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Needs attention</span>
            <Link
              href="/crm/inbox"
              className="text-xs uppercase tracking-eyebrow text-green-deep underline-offset-4 hover:text-amber-deep hover:underline"
            >
              See full inbox <ArrowRight size={12} className="inline" />
            </Link>
          </div>
          <div className="grid gap-3 rounded-md border border-bad/30 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-bad">
              <AlertTriangle size={16} />
              {stalled.length} lead{stalled.length === 1 ? '' : 's'} stalled
              <span className="font-normal text-charcoal/60">
                — no touch in 7+ days
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stalled.slice(0, 6).map(l => (
                <LeadCard key={l.id} lead={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Pipeline</span>
          <span className="text-xs uppercase tracking-eyebrow text-charcoal/55">
            {leads.length} lead{leads.length === 1 ? '' : 's'}
          </span>
        </div>

        {isEmpty ? <EmptyState /> : <PipelineBoard leads={leads} />}
      </section>
    </div>
  );
}

function Hero({
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
    <section className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-10 text-cream shadow-card">
      <span aria-hidden className="watermark cream pointer-events-none absolute -bottom-6 right-4 text-[160px] leading-none">
        CRM
      </span>
      <span className="eyebrow cream">Where new clients come from</span>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-display tracking-display sm:text-5xl">
          Pulse <span className="italic-amber">Pipeline</span>.
          <span className="block font-normal text-cream/75 mt-1 text-2xl sm:text-3xl">
            {stats.active} live · {stats.stalledCount} stalled · {formatMoneyFull(stats.pipeline)} on the table
          </span>
        </h1>
        <Link
          href="/crm/leads/new"
          className="inline-flex items-center gap-2 rounded-md bg-amber-deep px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-cream shadow-sm transition-colors hover:bg-amber-deep/90"
        >
          <Plus size={14} /> New lead
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="New this month" value={String(stats.newCount)} />
        <StatTile label="Won this month" value={String(stats.wonCount)} accent="amber" />
        <StatTile label="Lost this month" value={String(stats.lostCount)} />
        <StatTile label="Pipeline value" value={formatMoneyFull(stats.pipeline)} />
        <StatTile label="Won (MTD)" value={formatMoneyFull(stats.wonValue)} accent="amber" />
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 px-4 py-3">
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">
        {label}
      </div>
      <div
        className={`font-display text-2xl font-bold tabular-nums ${
          accent === 'amber' ? 'italic-amber' : 'text-cream-lt'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-cream-dk bg-white/60 p-12 text-center">
      <Sparkles size={28} className="mb-3 text-amber-deep" />
      <h2 className="font-display text-2xl font-bold text-green-deep">
        Pipeline is <span className="italic-amber">empty</span>.
      </h2>
      <p className="mt-2 max-w-md text-sm text-charcoal/65">
        Add your first lead with the form above, or create one with the full
        editor for richer detail.
      </p>
      <Link href="/crm/leads/new" className="btn-primary mt-4">
        New lead in full editor
      </Link>
    </div>
  );
}
