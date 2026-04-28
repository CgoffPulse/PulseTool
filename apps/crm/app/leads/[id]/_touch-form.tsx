'use client';

import { useRef, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import { logTouch } from '@/lib/actions';
import { TOUCH_KINDS, type Person } from '@/lib/types';

export function TouchForm({
  leadId,
  people,
}: {
  leadId: string;
  people: Person[];
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd: FormData) => {
        start(async () => {
          await logTouch(fd);
          formRef.current?.reset();
        });
      }}
      className="flex flex-col gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
            Kind
          </span>
          <select name="kind" className="select" defaultValue="email" required>
            {TOUCH_KINDS.map(k => (
              <option key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
            By
          </span>
          <select name="person_id" className="select" defaultValue="">
            <option value="">No one</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
            Follow up at
          </span>
          <input type="datetime-local" name="follow_up_at" className="input" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
          Summary
        </span>
        <textarea
          name="summary"
          rows={2}
          placeholder="What you said, what they said, what's next."
          className="input resize-y"
        />
      </label>
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={14} className="spin-slow" /> : <Send size={14} />}
          Log touch
        </button>
      </div>
    </form>
  );
}
