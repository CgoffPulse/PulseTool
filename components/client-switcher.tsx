'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Client } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ClientSwitcher({
  clients,
  active,
}: {
  clients: Client[];
  active: Client | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-md border border-cream/15 bg-cream/5 px-3 py-2 text-sm text-cream transition-colors duration-fast hover:border-amber-mid/50 hover:bg-cream/10"
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-cream/20"
          style={{ backgroundColor: active?.color ?? '#a8a29e' }}
        />
        <span className="font-medium">
          {active ? active.name : 'Select client'}
        </span>
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-lg border border-cream-dk/60 bg-white text-charcoal shadow-lift">
          <div className="border-b border-cream-dk/60 px-4 py-2.5 text-[10px] uppercase tracking-eyebrow text-amber-deep">
            Roster
          </div>
          <ul className="max-h-72 overflow-auto p-1.5">
            {clients.map(c => {
              const isActive = active?.id === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/clients/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors duration-fast hover:bg-cream-lt',
                      isActive && 'bg-cream-lt'
                    )}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 font-medium">{c.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                      /{c.slug}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-cream-dk/60 p-1.5">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55 hover:bg-cream-lt hover:text-charcoal"
            >
              ← Back to all clients
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
