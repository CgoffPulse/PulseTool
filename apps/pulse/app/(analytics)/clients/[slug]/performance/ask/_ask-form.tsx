'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Pin } from 'lucide-react';
import { askDataQuestion, pinChart } from '@/lib/analytics/actions';
import { ChartRenderer } from '@/components/analytics/chart-renderer';
import type { ChartSpec } from '@/lib/analytics/types';

export function AskForm({ clientId }: { clientId: string }) {
  const [question, setQuestion] = useState('');
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [stub, setStub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    formData.set('client_id', clientId);
    setError(null);
    setSpec(null);
    setStub(false);
    setPinned(null);
    startTransition(async () => {
      try {
        const res = await askDataQuestion(formData);
        setSpec(res.spec ?? null);
        setStub(res.stub);
        if (res.error) setError(res.error);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const onPin = () => {
    if (!spec) return;
    const fd = new FormData();
    fd.set('client_id', clientId);
    fd.set('prompt', question);
    fd.set('spec_json', JSON.stringify(spec));
    startTransition(async () => {
      try {
        const r = await pinChart(fd);
        setPinned(r.ok ? 'Pinned to saved charts.' : 'Failed to pin.');
      } catch (err) {
        setPinned(`Failed: ${(err as Error).message}`);
      }
    });
  };

  return (
    <>
      <form action={onSubmit} className="flex flex-col gap-3">
        <textarea
          name="question"
          required
          minLength={3}
          maxLength={500}
          placeholder="Which day of the week earned the most reach last month? Are reels outperforming carousels?"
          className="input h-24 resize-y text-base leading-body"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-eyebrow text-charcoal/45">
            Server picks the chart shape via the voice gateway.
          </p>
          <button
            type="submit"
            disabled={isPending || question.trim().length < 3}
            className="btn-primary"
          >
            <Sparkles size={14} /> {isPending ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          {error}
        </div>
      )}

      {spec && (
        <div className="flex flex-col gap-3">
          {stub && (
            <div className="rounded-md border border-amber-mid/40 bg-amber/10 p-2 text-[11px] uppercase tracking-eyebrow text-amber-deep">
              Stub mode — VOICE_GATEWAY_URL / VOICE_GATEWAY_TOKEN not configured.
            </div>
          )}
          <ChartRenderer spec={spec} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={onPin} className="btn-secondary">
              <Pin size={14} /> Pin this chart
            </button>
            {pinned && <span className="text-[11px] text-charcoal/55">{pinned}</span>}
          </div>
        </div>
      )}
    </>
  );
}
