'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, UserCog } from 'lucide-react';
import { PERSON_ROLE_LABEL } from '@/lib/social/types';
import { cn } from '@/lib/social/utils';
import { usePerson } from './person-context';

export function PersonPicker() {
  const { people, active, setActiveId } = usePerson();
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
        className={cn(
          'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors duration-fast',
          active
            ? 'border-cream/15 bg-cream/5 text-cream hover:border-amber-mid/50 hover:bg-cream/10'
            : 'border-amber-mid/40 bg-amber-mid/10 text-cream hover:border-amber-mid hover:bg-amber-mid/20'
        )}
        aria-label="Pick who you are"
      >
        {active ? (
          <>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-cream/20"
              style={{ backgroundColor: active.color }}
            />
            <span className="font-medium">{active.name}</span>
            <span className="text-[10px] uppercase tracking-eyebrow text-cream/60">
              {PERSON_ROLE_LABEL[active.role]}
            </span>
          </>
        ) : (
          <>
            <UserCog size={14} />
            <span className="font-medium">Pick who you are</span>
          </>
        )}
        <ChevronDown size={14} className="opacity-60" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-lg border border-cream-dk/60 bg-white text-charcoal shadow-lift">
          <div className="border-b border-cream-dk/60 px-4 py-2.5 text-[10px] uppercase tracking-eyebrow text-amber-deep">
            Who's at the desk?
          </div>
          <ul className="max-h-72 overflow-auto p-1.5">
            {people.length === 0 ? (
              <li className="px-3 py-3 text-sm italic text-charcoal/55">
                No people yet. Add one in the database (or via /people, coming soon).
              </li>
            ) : (
              people.map(p => {
                const isActive = active?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(p.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors duration-fast hover:bg-cream-lt',
                        isActive && 'bg-cream-lt'
                      )}
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="flex-1 text-left font-medium">{p.name}</span>
                      <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                        {PERSON_ROLE_LABEL[p.role]}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {active ? (
            <div className="border-t border-cream-dk/60 p-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveId(null);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-[10px] uppercase tracking-eyebrow text-charcoal/55 hover:bg-cream-lt hover:text-charcoal"
              >
                Sign out (forget on this device)
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
