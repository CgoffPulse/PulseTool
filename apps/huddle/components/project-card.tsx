import Link from 'next/link';
import { ArrowUpRight, CalendarClock, Users } from 'lucide-react';
import type { ProjectSummary } from '@/lib/types';
import { ProjectStateChip, WorkKindChip } from './state-chip';

export function ProjectCard({ row }: { row: ProjectSummary }) {
  const ship = row.target_ship_date;
  const days = ship
    ? Math.ceil((new Date(ship).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <Link
      href={`/projects/${row.slug}`}
      className="group block rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] transition-colors duration-150 hover:border-stone-300 hover:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <WorkKindChip kind={row.kind} />
            <ProjectStateChip state={row.state} />
          </div>
          <h3 className="font-display text-xl font-semibold tracking-tight text-stone-900">
            {row.name}
          </h3>
          {row.client_name && row.kind !== 'internal_build' && (
            <div className="mt-1 text-[12px] text-stone-500">{row.client_name}</div>
          )}
          {row.current_focus && (
            <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-stone-600">
              {row.current_focus}
            </p>
          )}
        </div>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 pt-4 text-[12px] text-stone-500">
        {row.assigned_person_name && (
          <span className="flex items-center gap-1.5">
            <Users size={13} />
            {row.assigned_person_name}
          </span>
        )}
        {ship && (
          <span className="flex items-center gap-1.5 tabular-nums">
            <CalendarClock size={13} />
            {ship}
            {days !== null && days >= 0 && days <= 14 && (
              <span className="ml-1 text-amber-deep">· {days}d</span>
            )}
          </span>
        )}
        {row.open_task_count > 0 && (
          <span className="tabular-nums">
            <span className="font-medium text-stone-700">{row.open_task_count}</span>{' '}
            open
            {row.in_progress_task_count > 0 && (
              <>
                {' · '}
                <span className="font-medium text-stone-700">{row.in_progress_task_count}</span>{' '}
                active
              </>
            )}
          </span>
        )}
      </div>
    </Link>
  );
}
