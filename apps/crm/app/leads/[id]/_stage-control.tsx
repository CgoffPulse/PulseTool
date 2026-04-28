'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { moveLeadStage } from '@/lib/actions';
import { LEAD_STAGES, type LeadStage, type LostReason } from '@/lib/types';

const NEXT_STAGES: Record<LeadStage, LeadStage[]> = {
  new: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: ['negotiation'],
  lost: ['new'],
};

const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export function StageControl({
  leadId,
  current,
  lostReasons,
}: {
  leadId: string;
  current: LeadStage;
  lostReasons: LostReason[];
}) {
  const [pending, start] = useTransition();
  const [confirmingLost, setConfirmingLost] = useState(false);
  const [reasonId, setReasonId] = useState<string>(lostReasons[0]?.id ?? '');
  const targets = NEXT_STAGES[current] ?? LEAD_STAGES;

  function move(to: LeadStage, lostReasonId?: string) {
    const fd = new FormData();
    fd.set('id', leadId);
    fd.set('to_stage', to);
    if (lostReasonId) fd.set('lost_reason_id', lostReasonId);
    start(() => {
      void moveLeadStage(fd);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/55">
        Move to
      </span>
      <div className="flex flex-wrap gap-2">
        {targets.map(target => {
          if (target === 'lost') {
            return (
              <button
                key="lost"
                type="button"
                onClick={() => setConfirmingLost(c => !c)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-bad/40 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-bad hover:bg-bad/5"
              >
                Mark lost
              </button>
            );
          }
          return (
            <button
              key={target}
              type="button"
              onClick={() => move(target)}
              disabled={pending}
              className={
                target === 'won'
                  ? 'inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-cream-lt hover:bg-green-bark'
                  : 'inline-flex items-center gap-1.5 rounded-md border border-amber-mid/60 bg-amber-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal hover:bg-amber-deep hover:text-cream-lt'
              }
            >
              {pending ? <Loader2 size={12} className="spin-slow" /> : <ArrowRight size={12} />}
              {STAGE_LABEL[target]}
            </button>
          );
        })}
      </div>

      {confirmingLost && (
        <div className="rounded-md border border-bad/30 bg-white p-3 text-xs text-charcoal/80">
          <div className="font-semibold uppercase tracking-eyebrow text-bad">
            Why is this lost?
          </div>
          <select
            value={reasonId}
            onChange={e => setReasonId(e.target.value)}
            className="select mt-2"
          >
            {lostReasons.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingLost(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!reasonId) return;
                move('lost', reasonId);
                setConfirmingLost(false);
              }}
              disabled={pending || !reasonId}
              className="inline-flex items-center gap-1.5 rounded-md border border-bad/40 bg-bad px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-cream-lt hover:bg-rust-300"
            >
              {pending ? <Loader2 size={12} className="spin-slow" /> : null}
              Confirm lost
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
