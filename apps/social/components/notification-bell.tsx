'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { NotificationRow } from '@/lib/types';
import { usePerson } from './person-context';

export function NotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const { active } = usePerson();

  // Filter "for me" if a person is active: targeted to them, their role, or untargeted.
  const visible = active
    ? notifications.filter(
        n =>
          (n.audience_person_id == null && n.audience_role == null) ||
          n.audience_person_id === active.id ||
          n.audience_role === active.role
      )
    : notifications;

  const open = visible.filter(n => !n.dismissed_at && !n.resolved_at);
  const bad = open.filter(n => n.severity === 'bad').length;
  const warn = open.filter(n => n.severity === 'warn').length;
  const total = open.length;

  return (
    <Link
      href="/notifications"
      className="relative flex items-center gap-1.5 rounded-md px-3 py-2 text-cream/70 transition-colors duration-fast hover:bg-cream/5 hover:text-cream"
      aria-label={`${total} open notifications`}
    >
      <Bell size={16} />
      {total > 0 ? (
        <span
          className={
            'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ' +
            (bad > 0
              ? 'bg-bad text-cream'
              : warn > 0
              ? 'bg-amber-mid text-green-deep'
              : 'bg-cream/15 text-cream')
          }
        >
          {total}
        </span>
      ) : null}
    </Link>
  );
}
