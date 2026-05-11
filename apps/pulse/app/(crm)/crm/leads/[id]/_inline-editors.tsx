'use client';

import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Archive, Check, Loader2, Pencil, X } from 'lucide-react';
import {
  archiveLead,
  updateLeadHeat,
  updateLeadOwner,
  updateLeadValue,
} from '@/lib/crm/actions';
import { LEAD_HEATS, type LeadHeat, type Person } from '@/lib/crm/types';
import { formatMoneyFull } from '@/lib/crm/format';

/**
 * Inline editors for the three most-edited lead fields. Click → form
 * appears → submit-on-Enter or click Save. Cancel reverts. Each editor
 * is its own server-action-bound form so the patch is atomic.
 *
 * Design choices: edit pencil is subtle until hover; on click the editor
 * replaces the read view in place. No modal. Always one element visible.
 */

// ─── Value ────────────────────────────────────────────────────────────────

export function InlineValueEditor({
  leadId,
  initial,
}: {
  leadId: string;
  initial: number | null;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded px-1 py-0.5 -mx-1 hover:bg-stone-100"
      >
        <span className="font-display text-2xl font-semibold tabular-nums text-stone-900">
          {initial !== null ? formatMoneyFull(initial) : '—'}
        </span>
        <Pencil
          size={14}
          className="text-stone-400 opacity-60 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }
  const defaultValue =
    initial !== null
      ? (initial / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : '';
  return (
    <form
      action={async (fd: FormData) => {
        await updateLeadValue(fd);
        setEditing(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={leadId} />
      <div className="flex items-center rounded-md border border-stone-300 bg-white pl-2 focus-within:border-amber-deep">
        <span className="text-stone-500">$</span>
        <input
          name="value"
          type="text"
          inputMode="decimal"
          autoFocus
          defaultValue={defaultValue}
          placeholder="5,000"
          className="w-32 border-0 px-2 py-1.5 font-display text-xl font-semibold tabular-nums text-stone-900 focus:outline-none focus:ring-0"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
        />
      </div>
      <SaveBtn />
      <CancelBtn onCancel={() => setEditing(false)} />
    </form>
  );
}

// ─── Heat (cold/warm/hot pill picker) ─────────────────────────────────────

export function InlineHeatEditor({
  leadId,
  initial,
}: {
  leadId: string;
  initial: LeadHeat | null;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<LeadHeat | null>(initial);

  function setHeat(next: LeadHeat | null) {
    setOptimistic(next);
    start(async () => {
      const fd = new FormData();
      fd.set('id', leadId);
      fd.set('heat', next ?? '');
      try {
        await updateLeadHeat(fd);
      } catch {
        setOptimistic(initial); // rollback on failure
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {LEAD_HEATS.map(h => {
        const on = optimistic === h;
        const tone =
          h === 'hot'
            ? on
              ? 'border-bad bg-bad text-cream'
              : 'border-bad/40 bg-bad/5 text-bad hover:bg-bad/10'
            : h === 'warm'
              ? on
                ? 'border-amber-deep bg-amber-deep text-cream'
                : 'border-amber-deep/40 bg-amber/10 text-amber-deep hover:bg-amber/20'
              : on
                ? 'border-stone-700 bg-stone-700 text-cream'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50';
        return (
          <button
            key={h}
            type="button"
            disabled={pending}
            onClick={() => setHeat(on ? null : h)}
            aria-pressed={on}
            className={
              'rounded-full border px-3 py-1 text-[12px] uppercase tracking-wide transition-colors duration-150 disabled:opacity-50 ' +
              tone
            }
          >
            {h}
          </button>
        );
      })}
      {pending && <Loader2 size={12} className="animate-spin text-stone-400" />}
    </div>
  );
}

// ─── Owner ────────────────────────────────────────────────────────────────

export function InlineOwnerEditor({
  leadId,
  initial,
  people,
}: {
  leadId: string;
  initial: { id: string | null; name: string | null };
  people: Person[];
}) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group inline-flex items-center gap-1.5 rounded px-1 py-0.5 -mx-1 text-left hover:bg-stone-100"
      >
        <span className="text-[14px] text-stone-800">
          {initial.name ?? <span className="text-stone-500">Unassigned</span>}
        </span>
        <Pencil
          size={12}
          className="text-stone-400 opacity-60 transition-opacity group-hover:opacity-100"
        />
      </button>
    );
  }
  return (
    <form
      action={async (fd: FormData) => {
        await updateLeadOwner(fd);
        setEditing(false);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={leadId} />
      <select
        name="owner_person_id"
        defaultValue={initial.id ?? ''}
        autoFocus
        className="select w-44"
      >
        <option value="">Unassigned</option>
        {people.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <SaveBtn />
      <CancelBtn onCancel={() => setEditing(false)} />
    </form>
  );
}

// ─── Archive ──────────────────────────────────────────────────────────────

export function ArchiveLeadButton({ leadId }: { leadId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 transition-colors hover:border-bad/60 hover:bg-bad/5 hover:text-bad"
      >
        <Archive size={12} /> Archive lead
      </button>
    );
  }
  return (
    <form
      action={archiveLead}
      className="flex flex-col gap-2 rounded-md border border-bad/40 bg-bad/5 p-3 text-[12px]"
    >
      <input type="hidden" name="id" value={leadId} />
      <span className="text-stone-700">
        Archive this lead? It&rsquo;ll come out of the pipeline. You can find it later by querying the DB.
      </span>
      <div className="flex items-center gap-2">
        <ArchiveSubmit />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-deep bg-green-deep text-cream transition-colors hover:bg-green-deep/90 disabled:opacity-50"
      title="Save"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
    </button>
  );
}

function CancelBtn({ onCancel }: { onCancel: () => void }) {
  return (
    <button
      type="button"
      onClick={onCancel}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 transition-colors hover:bg-stone-50"
      title="Cancel"
    >
      <X size={14} />
    </button>
  );
}

function ArchiveSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-bad px-3 py-1 text-[12px] font-medium text-cream transition-colors hover:bg-bad/90 disabled:opacity-50"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
      Confirm archive
    </button>
  );
}
