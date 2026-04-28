'use client';

import Link from 'next/link';
import { ArrowUpRight, Sun } from 'lucide-react';
import type { NotificationRow } from '@/lib/types';
import { usePerson } from './person-context';

/**
 * Compact "today rail" surfaced at the top of the main hub when a person
 * is picked. Two-line summary + a CTA to the full /today view. Hides itself
 * when nobody is signed in (the picker prompt shows on /today instead).
 */
export function TodayRail({ notifications }: { notifications: NotificationRow[] }) {
  const { active } = usePerson();
  if (!active) return null;
  const yours = notifications.filter(
    n =>
      !n.dismissed_at &&
      !n.resolved_at &&
      ((n.audience_person_id == null && n.audience_role == null) ||
        n.audience_person_id === active.id ||
        n.audience_role === active.role)
  );
  const bad = yours.filter(n => n.severity === 'bad').length;
  const warn = yours.filter(n => n.severity === 'warn').length;

  const message =
    bad > 0
      ? `${bad} priority item${bad === 1 ? '' : 's'} for you`
      : warn > 0
      ? `${warn} item${warn === 1 ? '' : 's'} on your watch list`
      : "You're clear — focus mode.";

  return (
    <Link
      href="/today"
      className="group flex items-center gap-4 rounded-2xl border border-cream-dk/60 bg-white px-5 py-4 shadow-card transition-all duration-fast hover:-translate-y-0.5 hover:border-amber-mid/50 hover:shadow-lift"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-mid/15 text-amber-deep"
        aria-hidden
      >
        <Sun size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: active.color }}
          />
          Today · {active.name}
        </div>
        <div className="font-display text-lg font-bold text-green-deep">{message}</div>
      </div>
      {(bad > 0 || warn > 0) && (
        <div className="hidden items-center gap-2 md:flex">
          {bad > 0 ? (
            <span className="rounded-full bg-bad/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-label text-bad ring-1 ring-bad/30">
              {bad} priority
            </span>
          ) : null}
          {warn > 0 ? (
            <span className="rounded-full bg-amber-light/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-label text-amber-deep ring-1 ring-amber-mid/40">
              {warn} watch
            </span>
          ) : null}
        </div>
      )}
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-eyebrow text-amber-deep">
        Open
        <ArrowUpRight
          size={12}
          className="transition-transform duration-fast group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </span>
    </Link>
  );
}
