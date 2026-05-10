'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { refreshAllMonitors } from '@/lib/dev/actions';

interface RefreshButtonProps {
  tone?: 'light' | 'dark';
  label?: string;
}

export function RefreshButton({ tone = 'light', label = 'Refresh now' }: RefreshButtonProps) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const base =
    'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50';

  // Light tone — used on cream backgrounds.
  // Dark tone — used on green-deep backgrounds; ensure light text per UX rules.
  const palette =
    tone === 'dark'
      ? 'border-cream-dk/40 bg-green-deep/40 text-cream hover:bg-cream-dk/20'
      : 'border-cream-dk bg-cream text-green-deep hover:bg-cream-dk/30';

  const onClick = () => {
    if (pending) return;
    start(async () => {
      try {
        await refreshAllMonitors();
        setFlash('Refreshed just now');
        setTimeout(() => setFlash(null), 2400);
      } catch (err) {
        setFlash((err as Error).message ?? 'Refresh failed');
        setTimeout(() => setFlash(null), 3500);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`${base} ${palette}`}
      aria-busy={pending}
      aria-label={label}
    >
      <RefreshCw
        size={14}
        className={pending ? 'animate-spin' : undefined}
        aria-hidden
      />
      <span>{pending ? 'Refreshing…' : (flash ?? label)}</span>
    </button>
  );
}
