'use client';

import {
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type DragEvent,
} from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { LeadCard } from './lead-card';
import { StageChip } from './stage-chip';
import { moveLeadStage } from '@/lib/crm/actions';
import {
  LEAD_HEATS,
  LEAD_STAGES,
  type LeadHeat,
  type LeadStage,
  type LeadWithMeta,
  type LostReason,
} from '@/lib/crm/types';
import { formatMoneyFull } from '@/lib/crm/format';

const DND_MIME = 'application/x-pulse-lead-id';

/**
 * Client-side pipeline kanban with:
 *   • Text search across name, company, email, business type, city, region,
 *     industry, tags.
 *   • Heat filter pills with live counts.
 *   • HTML5 drag-and-drop between stages. Cards optimistically jump on drop;
 *     server action fires asynchronously. On failure the optimistic state
 *     rolls back.
 *   • Dropping into "lost" surfaces a reason-picker overlay because the
 *     server requires lost_reason_id whenever a lead moves to that stage.
 */
export function PipelineBoard({
  leads,
  lostReasons,
}: {
  leads: LeadWithMeta[];
  lostReasons: LostReason[];
}) {
  const [query, setQuery] = useState('');
  const [heat, setHeat] = useState<LeadHeat | 'all'>('all');

  // Optimistic state: when a card is dropped into a new column, we
  // immediately update the in-memory view of its stage. The server action
  // revalidatePath will eventually re-fetch and confirm.
  const [optimisticLeads, setOptimisticLeads] = useOptimistic(
    leads,
    (state: LeadWithMeta[], patch: { id: string; stage: LeadStage }) =>
      state.map(l => (l.id === patch.id ? { ...l, stage: patch.stage } : l))
  );

  const [pending, startTransition] = useTransition();
  const [pendingLost, setPendingLost] = useState<{
    leadId: string;
    fromStage: LeadStage;
  } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return optimisticLeads.filter(l => {
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
  }, [optimisticLeads, query, heat]);

  const byStage = useMemo(() => {
    const map = new Map<LeadStage, LeadWithMeta[]>();
    for (const stage of LEAD_STAGES) map.set(stage, []);
    for (const lead of filtered) map.get(lead.stage)?.push(lead);
    return map;
  }, [filtered]);

  const totalShown = filtered.length;
  const totalAll = optimisticLeads.length;
  const heatCount = useMemo(() => {
    const c: Record<LeadHeat | 'all' | 'none', number> = {
      all: optimisticLeads.length,
      hot: 0,
      warm: 0,
      cold: 0,
      none: 0,
    };
    for (const l of optimisticLeads) {
      if (l.heat) c[l.heat]++;
      else c.none++;
    }
    return c;
  }, [optimisticLeads]);

  // ─── Drag handlers ───────────────────────────────────────────────────────

  const onCardDragStart = useCallback(
    (leadId: string) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DND_MIME, leadId);
      e.dataTransfer.effectAllowed = 'move';
      setDraggingLeadId(leadId);
    },
    []
  );

  const onCardDragEnd = useCallback(() => {
    setDraggingLeadId(null);
    setDragOverStage(null);
  }, []);

  const onColumnDragOver = useCallback(
    (stage: LeadStage) => (e: DragEvent<HTMLDivElement>) => {
      // Required to allow drop. Without this preventDefault, onDrop never fires.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverStage !== stage) setDragOverStage(stage);
    },
    [dragOverStage]
  );

  const onColumnDragLeave = useCallback(
    (stage: LeadStage) => () => {
      // Only clear if we're leaving the stage we were tracking; this avoids
      // flicker when crossing card boundaries inside a column.
      if (dragOverStage === stage) setDragOverStage(null);
    },
    [dragOverStage]
  );

  const onColumnDrop = useCallback(
    (toStage: LeadStage) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverStage(null);
      setDraggingLeadId(null);

      const leadId = e.dataTransfer.getData(DND_MIME);
      if (!leadId) return;
      const current = optimisticLeads.find(l => l.id === leadId);
      if (!current || current.stage === toStage) return;

      // Lost requires a reason. Capture the in-flight drop and show the
      // overlay; the actual server call happens once the user picks one.
      if (toStage === 'lost') {
        setPendingLost({ leadId, fromStage: current.stage });
        return;
      }

      startTransition(async () => {
        setOptimisticLeads({ id: leadId, stage: toStage });
        const fd = new FormData();
        fd.set('id', leadId);
        fd.set('to_stage', toStage);
        try {
          await moveLeadStage(fd);
        } catch (err) {
          console.error('[pipeline] drop failed', err);
          // useOptimistic auto-reverts on the next render after the
          // transition completes if the server data didn't change. Nothing
          // more to do here — leaving the in-flight state alone.
        }
      });
    },
    [optimisticLeads, setOptimisticLeads, startTransition]
  );

  const confirmLost = useCallback(
    (lostReasonId: string) => {
      if (!pendingLost) return;
      const { leadId } = pendingLost;
      const fd = new FormData();
      fd.set('id', leadId);
      fd.set('to_stage', 'lost');
      fd.set('lost_reason_id', lostReasonId);
      startTransition(async () => {
        setOptimisticLeads({ id: leadId, stage: 'lost' });
        try {
          await moveLeadStage(fd);
        } catch (err) {
          console.error('[pipeline] lost confirm failed', err);
        }
      });
      setPendingLost(null);
    },
    [pendingLost, setOptimisticLeads, startTransition]
  );

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

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.08em] text-stone-500 tabular-nums">
          {pending && <Loader2 size={12} className="animate-spin text-stone-400" aria-label="Saving" />}
          <span>
            Showing {totalShown} of {totalAll}
          </span>
        </div>
      </div>

      {/* Drag hint */}
      <p className="text-[11px] text-stone-500">
        Drag a card to another column to move the lead. Dropping into{' '}
        <span className="font-medium text-bad">Lost</span> will ask why first.
      </p>

      {/* Columns */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {LEAD_STAGES.map(stage => {
          const stageLeads = byStage.get(stage) ?? [];
          const stageValue = stageLeads.reduce((sum, l) => sum + (l.value_cents ?? 0), 0);
          const isOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              onDragOver={onColumnDragOver(stage)}
              onDragLeave={onColumnDragLeave(stage)}
              onDrop={onColumnDrop(stage)}
              className={
                'flex flex-col gap-3 rounded-md p-3 transition-all duration-150 ' +
                (isOver
                  ? stage === 'lost'
                    ? 'bg-bad/10 ring-2 ring-bad/40'
                    : 'bg-green-deep/10 ring-2 ring-green-deep/30'
                  : 'bg-cream/35')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <StageChip stage={stage} size="sm" />
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-charcoal/55 tabular-nums">
                  {stageLeads.length} · {formatMoneyFull(stageValue)}
                </span>
              </div>
              {stageLeads.length === 0 ? (
                <div
                  className={
                    'flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-white/40 text-[11px] uppercase tracking-[0.08em] ' +
                    (isOver
                      ? 'border-green-deep/40 text-green-deep'
                      : 'border-cream-dk/60 text-charcoal/40')
                  }
                >
                  {isOver
                    ? 'Drop to move'
                    : query || heat !== 'all'
                      ? 'No matches'
                      : 'Empty'}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {stageLeads.map(lead => (
                    <DraggableLead
                      key={lead.id}
                      lead={lead}
                      onDragStart={onCardDragStart(lead.id)}
                      onDragEnd={onCardDragEnd}
                      isDragging={draggingLeadId === lead.id}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lost-reason picker overlay */}
      {pendingLost && (
        <LostReasonOverlay
          lostReasons={lostReasons}
          onCancel={() => setPendingLost(null)}
          onConfirm={confirmLost}
        />
      )}
    </div>
  );
}

// ─── Draggable card wrapper ──────────────────────────────────────────────

function DraggableLead({
  lead,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  lead: LeadWithMeta;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={
        'cursor-grab active:cursor-grabbing transition-opacity duration-150 ' +
        (isDragging ? 'opacity-40' : 'opacity-100')
      }
    >
      <LeadCard lead={lead} />
    </div>
  );
}

// ─── Lost reason picker overlay ──────────────────────────────────────────

function LostReasonOverlay({
  lostReasons,
  onCancel,
  onConfirm,
}: {
  lostReasons: LostReason[];
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const [reasonId, setReasonId] = useState<string>(lostReasons[0]?.id ?? '');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-xl"
      >
        <header className="border-b border-stone-100 px-5 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-bad">
            Mark as lost
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-stone-900">
            Why is this lost?
          </h3>
        </header>
        <div className="px-5 py-4">
          {lostReasons.length === 0 ? (
            <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4 text-[13px] text-stone-600">
              No lost reasons configured yet. Add some at{' '}
              <a
                href="/crm/settings/lost-reasons"
                className="text-amber-deep hover:underline"
              >
                /crm/settings/lost-reasons
              </a>
              .
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lostReasons.map(r => (
                <label
                  key={r.id}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-[13px] transition-colors ' +
                    (reasonId === r.id
                      ? 'border-bad bg-bad/5 text-bad'
                      : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50')
                  }
                >
                  <input
                    type="radio"
                    name="lost_reason_id"
                    value={r.id}
                    checked={reasonId === r.id}
                    onChange={() => setReasonId(r.id)}
                    className="accent-bad"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reasonId && onConfirm(reasonId)}
            disabled={!reasonId}
            className="inline-flex items-center gap-1.5 rounded-md bg-bad px-3 py-1.5 text-[13px] font-medium text-cream hover:bg-bad/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm lost
          </button>
        </footer>
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
