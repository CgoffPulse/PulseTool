import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendarMonth, listClients } from '@/lib/command/queries';
import type { CalendarEvent, Client } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SearchParams {
  y?: string;
  m?: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  let year = sp.y ? parseInt(sp.y, 10) : now.getFullYear();
  let month = sp.m ? parseInt(sp.m, 10) : now.getMonth() + 1;
  if (Number.isNaN(year) || Number.isNaN(month)) {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const [events, clients] = await Promise.all([
    getCalendarMonth(year, month),
    listClients(),
  ]);

  const grid = buildMonthGrid(year, month);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = eventsByDate.get(e.date) ?? [];
    arr.push(e);
    eventsByDate.set(e.date, arr);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Calendar
        </span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
            {monthLabel}
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?y=${prev.y}&m=${prev.m}`}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50"
            >
              <ChevronLeft size={14} />
              Prev
            </Link>
            <Link
              href="/calendar"
              className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50"
            >
              Today
            </Link>
            <Link
              href={`/calendar?y=${next.y}&m=${next.m}`}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[12px] text-stone-600 hover:bg-stone-50"
            >
              Next
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        <p className="max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Cross-client calendar — shoots, posts, project ship dates, and holidays. Each client gets
          a stable color so the agency&rsquo;s rhythm reads at a glance.
        </p>
      </header>

      <ClientLegend clients={clients} />

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-3 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell, i) => {
            const isCurrentMonth = cell.month === month;
            const isToday =
              cell.year === now.getFullYear() &&
              cell.month === now.getMonth() + 1 &&
              cell.day === now.getDate();
            const dateKey = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
            const dayEvents = eventsByDate.get(dateKey) ?? [];
            return (
              <div
                key={i}
                className={`min-h-[120px] border-b border-r border-stone-100 p-2 ${
                  isCurrentMonth ? 'bg-white' : 'bg-stone-50/50'
                }`}
              >
                <div className="mb-1 flex items-center gap-1">
                  <span
                    className={
                      isToday
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-[12px] font-medium tabular-nums text-white'
                        : `text-[12px] font-medium tabular-nums ${
                            isCurrentMonth ? 'text-stone-700' : 'text-stone-400'
                          }`
                    }
                  >
                    {cell.day}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {dayEvents.slice(0, 4).map(e => (
                    <CalendarPill key={e.id} event={e} />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="px-1 text-[10px] tabular-nums text-stone-500">
                      +{dayEvents.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalendarPill({ event }: { event: CalendarEvent }) {
  const color = event.client_color || (event.source === 'holiday' ? '#a8a29e' : '#6e9973');
  const inner = (
    <span
      className="block w-full truncate rounded-sm border-l-2 bg-stone-50 px-1.5 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100"
      style={{ borderLeftColor: color }}
      title={[event.client_name, event.title, event.detail].filter(Boolean).join(' · ')}
    >
      {event.client_name && (
        <span className="font-medium" style={{ color }}>
          {event.client_name}{' · '}
        </span>
      )}
      <span>{event.title}</span>
    </span>
  );
  if (event.href) {
    return (
      <Link href={event.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function ClientLegend({ clients }: { clients: Client[] }) {
  if (clients.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-white p-3">
      <span className="self-center text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        Clients
      </span>
      {clients.slice(0, 25).map(c => (
        <Link
          key={c.id}
          href={`/clients/${c.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-50"
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: c.color }}
            aria-hidden
          />
          {c.name}
        </Link>
      ))}
    </div>
  );
}

function buildMonthGrid(year: number, month: number) {
  // Sunday-start grid covering the month, padded with prev/next month days.
  const first = new Date(year, month - 1, 1);
  const startDay = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ year: number; month: number; day: number }> = [];

  // Previous month tail
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    cells.push({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d });
  }
  // Pad to 6 weeks
  while (cells.length < 42) {
    const d = new Date(year, month, cells.length - startDay - daysInMonth + 1);
    cells.push({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  }
  return cells;
}
