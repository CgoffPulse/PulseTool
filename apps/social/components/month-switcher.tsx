'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, monthSlugToIso } from '@/lib/utils';

export function MonthSwitcher({
  slug,
  month,
  section,
}: {
  slug: string;
  month: string;
  section: 'planning' | 'production' | 'calendar' | null;
}) {
  const router = useRouter();
  const sec = section ?? 'planning';
  const iso = monthSlugToIso(month);
  const date = parseISO(iso);
  const prev = format(subMonths(date, 1), 'yyyy-MM');
  const next = format(addMonths(date, 1), 'yyyy-MM');
  const buildHref = (m: string) => `/clients/${slug}/months/${m}/${sec}`;

  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(date.getFullYear());
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
    <div ref={ref} className="relative flex items-center gap-1.5">
      <Link
        href={buildHref(prev)}
        className="grid h-9 w-9 place-items-center rounded-md border border-cream/15 bg-cream/5 text-cream/70 transition duration-fast hover:border-amber-mid/40 hover:text-cream"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </Link>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 rounded-md border border-cream/15 bg-cream/5 px-4 py-2 text-cream transition duration-fast hover:border-amber-mid/40"
      >
        <span className="font-display text-lg font-bold leading-none">
          {format(date, 'LLLL')}
        </span>
        <span className="font-display text-lg font-bold leading-none italic text-amber-mid">
          {format(date, 'yyyy')}
        </span>
      </button>

      <Link
        href={buildHref(next)}
        className="grid h-9 w-9 place-items-center rounded-md border border-cream/15 bg-cream/5 text-cream/70 transition duration-fast hover:border-amber-mid/40 hover:text-cream"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </Link>

      {open ? (
        <div className="absolute left-1/2 top-full z-40 mt-2 w-80 -translate-x-1/2 overflow-hidden rounded-lg border border-cream-dk/60 bg-white text-charcoal shadow-lift">
          <div className="flex items-center justify-between border-b border-cream-dk/60 px-4 py-3">
            <button
              type="button"
              onClick={() => setPickerYear(y => y - 1)}
              className="rounded p-1 text-charcoal/55 hover:bg-cream-lt hover:text-charcoal"
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="font-display text-xl font-bold">{pickerYear}</div>
            <button
              type="button"
              onClick={() => setPickerYear(y => y + 1)}
              className="rounded p-1 text-charcoal/55 hover:bg-cream-lt hover:text-charcoal"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {Array.from({ length: 12 }, (_, i) => {
              const m = format(new Date(pickerYear, i, 1), 'yyyy-MM');
              const label = format(new Date(pickerYear, i, 1), 'MMM');
              const isActive = m === month;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(buildHref(m));
                  }}
                  className={cn(
                    'rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-fast',
                    isActive
                      ? 'bg-green-deep text-cream'
                      : 'hover:bg-cream-lt'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
