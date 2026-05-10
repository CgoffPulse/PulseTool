'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import type { Recommendation } from '@/lib/analytics/types';
import { acceptRecommendation, dismissRecommendation } from '@/lib/analytics/actions';

const KIND_LABELS: Record<Recommendation['kind'], string> = {
  new_post: 'New post',
  repeat_post: 'Repeat',
  change_format: 'Change format',
  change_cadence: 'Change cadence',
  pillar_rebalance: 'Rebalance pillars',
  audience_test: 'Audience test',
};

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onAccept = () => {
    setFeedback(null);
    const fd = new FormData();
    fd.set('id', rec.id);
    startTransition(async () => {
      try {
        await acceptRecommendation(fd);
        setFeedback('Accepted — draft created on the social side.');
      } catch (err) {
        setFeedback(`Failed: ${(err as Error).message}`);
      }
    });
  };

  const onDismiss = () => {
    if (!reason.trim()) {
      setShowReason(true);
      return;
    }
    setFeedback(null);
    const fd = new FormData();
    fd.set('id', rec.id);
    fd.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await dismissRecommendation(fd);
        setFeedback('Dismissed.');
      } catch (err) {
        setFeedback(`Failed: ${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="chip-amber whitespace-nowrap">
          {KIND_LABELS[rec.kind] ?? rec.kind}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
          {rec.evidence_post_ids.length} ev.
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold text-green-deep">{rec.title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-body text-charcoal/80">
        {rec.rationale_md}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-green-deep/20 bg-green-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-cream-lt shadow-sm hover:bg-green-deep disabled:opacity-50"
        >
          <Check size={14} /> Accept
        </button>
        {showReason && (
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="One-word reason"
            maxLength={120}
            className="input max-w-[180px] py-1.5 text-xs"
          />
        )}
        <button
          type="button"
          onClick={onDismiss}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-cream-dk px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65 hover:border-bad/40 hover:bg-bad/10 hover:text-bad disabled:opacity-50"
        >
          <X size={14} /> Dismiss
        </button>
        {feedback && (
          <span className="text-[11px] text-charcoal/60">{feedback}</span>
        )}
      </div>
    </div>
  );
}
