'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';

const STORAGE_KEY = 'pulse-huddle-last-viewed';

export function SinceControl({ initialSince }: { initialSince: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [since, setSince] = useState(() => initialSince);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!searchParams?.get('since') && stored) {
      const url = new URL(window.location.href);
      url.searchParams.set('since', stored);
      router.replace(url.pathname + url.search);
    }
  }, [router, searchParams]);

  function applyPreset(hoursAgo: number) {
    const iso = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    setSince(iso);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, iso);
    }
    router.push(`/morning?since=${encodeURIComponent(iso)}`);
  }

  function markNow() {
    const iso = new Date().toISOString();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, iso);
    }
    setSince(iso);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
          <Clock size={12} className="mr-1 inline" /> Show changes since
        </span>
        <code className="font-mono text-[10px] text-charcoal/55">
          {new Date(since).toLocaleString()}
        </code>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyPreset(1)}
          className="btn-ghost text-[11px]"
        >
          Last hour
        </button>
        <button
          type="button"
          onClick={() => applyPreset(24)}
          className="btn-ghost text-[11px]"
        >
          Last 24h
        </button>
        <button
          type="button"
          onClick={() => applyPreset(24 * 7)}
          className="btn-ghost text-[11px]"
        >
          Last 7d
        </button>
        <span aria-hidden className="h-4 w-px bg-cream-dk/60" />
        <button
          type="button"
          onClick={markNow}
          className="btn-secondary text-[11px]"
        >
          Mark caught-up now
        </button>
      </div>
    </div>
  );
}
