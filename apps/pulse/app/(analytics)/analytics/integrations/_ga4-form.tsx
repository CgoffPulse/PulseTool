'use client';

import { useState, useTransition } from 'react';
import { connectGa4Property } from '@/lib/analytics/actions';

export function Ga4Form({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    formData.set('client_id', clientId);
    setFeedback(null);
    startTransition(async () => {
      try {
        await connectGa4Property(formData);
        setFeedback(`Connected GA4 property for ${clientName}.`);
        setPropertyId('');
      } catch (err) {
        setFeedback(`Failed: ${(err as Error).message}`);
      }
    });
  };

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      <input
        name="property_id"
        placeholder="GA4 property ID (e.g. 312345678)"
        value={propertyId}
        onChange={e => setPropertyId(e.target.value)}
        className="input flex-1 py-1.5 text-xs"
        pattern="[a-zA-Z0-9_:-]+"
        maxLength={40}
        required
      />
      <button
        type="submit"
        disabled={isPending || propertyId.length === 0}
        className="inline-flex items-center gap-1 rounded-md border border-green-deep/20 bg-green-mid px-3 py-1.5 text-[11px] font-semibold uppercase tracking-eyebrow text-cream-lt disabled:opacity-50"
      >
        Connect
      </button>
      {feedback && (
        <span className="text-[11px] text-charcoal/55">{feedback}</span>
      )}
    </form>
  );
}
