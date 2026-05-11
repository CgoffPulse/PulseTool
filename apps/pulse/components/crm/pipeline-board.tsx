'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { LeadCard } from './lead-card';
import { StageChip } from './stage-chip';
import { LEAD_HEATS, LEAD_STAGES, type LeadHeat, type LeadStage, type LeadWithMeta } from '@/lib/crm/types';
import { formatMoneyFull } from '@/lib/crm/format';

/**
 * Client-side pipeline kanban with text search + heat filter. Server hands
 * us every lead; we re-bucket per stage on each filter change. The filter
 * state lives in the URL via no-op on top of plain React state (we could
 * push to query string later but for now it's local — pipeline page is a
 * fast in-memory filter).
 */
export function PipelineBoard({ leads }: { leads: LeadWithMeta[] }) {
  const [query, setQuery] = useState('');
  const [heat, setHeat] = useState<LeadHeat | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(l => {
      if (heat !== 'all' && l.heat !== heat) return false;
      if (!q) return true;
      const haystack = [
        l.name,
        l.company,
        l.email,
        l.business_type,
        l.city,
        l.region,
        l.industry,
        ...(l.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, query, heat]);

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, LeadWithMeta[]>();
    for (const stage of LEAD_STAGES) map.set(stage, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const totalShown = filtered.length;
  const totalAll = leads.length;
  const heatCount = useMemo(() => {
    const c: Record<LeadHeat | 'all' | 'none', number> = {
      all: leads.length,
      hot: 0,
      warm: 0,
      cold: 0,
      none: 0,
    };
    for (const l of leads) {
      if (l.heat) c[l.heat]++;
      else c.none++;
    }
    return c;
  }, [leads]);

  return (
    <div className="flex flex-col gap-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, company, email, city, tag…"
              className="w-full rounded-md border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-8 text-[13px] text-stone-800 placeholder:text-stone-400 focus:border-amber-deep focus:bg-white focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <HeatPill label={`All · ${heatCount.all}`} active={heat === 'all'} onClick={() => setHeat('all')} tone="neutral" />
            {LEAD_HEATS.map(h => (
              <HeatPill
                key={h}
                label={`${h} · ${heatCount[h]}`}
                active={heat === h}
                onClick={() => setHeat(h)}
                tone={h}
              />
            ))}
          </div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.08em] text-stone-500 tabular-nums">
          Showing {totalShown} of {totalAll}
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {LEAD_STAGES.map(stage => {
          const stageLeads = byStage.get(stage) ?? [];
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.value_cents ?? 0), 0);
          return (
            <div key={stage} className="flex flex-col gap-3 rounded-md bg-cream/35 p-3">
              <div className="flex items-center justify-between gap-2">
                <StageChip stage={stage} size="sm" />
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-charcoal/55 tabular-nums">
                  {stageLeads.length} · {formatMoneyFull(stageValue)}
                </span>
              </div>
              {stageLeads.length === 0 ? (
                <div className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-cream-dk/60 bg-white/40 text-[11px] uppercase tracking-[0.08em] text-charcoal/40">
                  {query || heat !== 'all' ? 'No matches' : 'Empty'}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {stageLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatPill({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: LeadHeat | 'neutral';
}) {
  const cls =
    tone === 'hot'
      ? active
        ? 'border-bad bg-bad text-cream'
        : 'border-bad/40 bg-bad/5 text-bad hover:bg-bad/10'
      : tone === 'warm'
        ? active
          ? 'border-amber-deep bg-amber-deep text-cream'
          : 'border-amber-deep/40 bg-amber/10 text-amber-deep hover:bg-amber/20'
        : tone === 'cold'
          ? active
            ? 'border-stone-700 bg-stone-700 text-cream'
            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
          : active
            ? 'border-green-deep bg-green-deep text-cream'
            : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] transition-colors ' +
        cls
      }
    >
      {label}
    </button>
  );
}
