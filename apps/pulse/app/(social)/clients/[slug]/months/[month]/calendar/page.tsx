import { notFound } from 'next/navigation';
import {
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { Camera } from 'lucide-react';
import { buildMonthContext, getClientBySlug } from '@/lib/social/queries';
import { CONTENT_TYPE_LABEL, type ContentType } from '@/lib/social/types';
import { cn, monthSlugToIso } from '@/lib/social/utils';

export const dynamic = 'force-dynamic';

const TYPE_DOT: Record<ContentType, string> = {
  reel: 'bg-rust-300',
  photo: 'bg-green-light',
  carousel: 'bg-amber-mid',
  story: 'bg-green-mid',
  video: 'bg-rust-200',
  graphic: 'bg-amber-deep',
};

const TYPE_BG: Record<ContentType, string> = {
  reel: 'bg-rust-100/15 text-rust-300 border-rust-100/40',
  photo: 'bg-green-light/15 text-green-deep border-green-light/40',
  carousel: 'bg-amber-mid/15 text-amber-deep border-amber-mid/40',
  story: 'bg-green-mid/15 text-green-deep border-green-mid/40',
  video: 'bg-rust-200/15 text-rust-300 border-rust-200/40',
  graphic: 'bg-amber-deep/10 text-amber-deep border-amber-deep/30',
};

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ slug: string; month: string }>;
}) {
  const { slug, month } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const iso = monthSlugToIso(month);
  const ctx = await buildMonthContext(client, iso);

  const monthStart = startOfMonth(parseISO(iso));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const postsByDay = new Map<string, typeof ctx.posts>();
  for (const p of ctx.posts) {
    const arr = postsByDay.get(p.post_date) ?? [];
    arr.push(p);
    postsByDay.set(p.post_date, arr);
  }
  const shootsByDay = new Map<string, typeof ctx.shoots>();
  for (const s of ctx.shoots) {
    if (!s.scheduled_date) continue;
    const arr = shootsByDay.get(s.scheduled_date) ?? [];
    arr.push(s);
    shootsByDay.set(s.scheduled_date, arr);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <div className="grid grid-cols-7 border-b border-cream-dk/60 bg-cream-lt/60">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div
            key={d}
            className="border-r border-cream-dk/60 px-4 py-3 text-[10px] uppercase tracking-eyebrow text-charcoal/55 last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-[repeat(6,minmax(140px,auto))]">
        {days.map((d, i) => {
          const isoDay = format(d, 'yyyy-MM-dd');
          const inMonth = isSameMonth(d, monthStart);
          const today = isToday(d);
          const posts = postsByDay.get(isoDay) ?? [];
          const shoots = shootsByDay.get(isoDay) ?? [];
          return (
            <div
              key={isoDay}
              className={cn(
                'border-b border-r border-cream-dk/60 p-2.5 last:border-r-0',
                (i + 1) % 7 === 0 && 'border-r-0',
                !inMonth && 'bg-cream-lt/40'
              )}
            >
              <div className="mb-2 flex items-start justify-between">
                <span
                  className={cn(
                    'font-display font-bold tabular-nums leading-none',
                    today && inMonth
                      ? 'grid h-7 w-7 place-items-center rounded-full bg-green-deep text-cream'
                      : !inMonth
                      ? 'text-charcoal/35'
                      : 'text-green-deep'
                  )}
                >
                  {format(d, 'd')}
                </span>
                {shoots.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-mid/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-amber-deep ring-1 ring-amber-mid/40">
                    <Camera size={10} />
                    {shoots.map(s => `S${s.bundle_number}`).join(' ')}
                  </span>
                ) : null}
              </div>
              {posts.length === 0 ? null : (
                <ul className="space-y-1">
                  {posts.slice(0, 4).map(p => (
                    <li
                      key={p.id}
                      title={p.description ?? ''}
                      className={cn(
                        'flex items-center gap-1.5 truncate rounded border px-1.5 py-1 text-[11px]',
                        TYPE_BG[p.content_type]
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                          TYPE_DOT[p.content_type]
                        )}
                      />
                      <span className="truncate">
                        <span className="font-semibold">
                          {CONTENT_TYPE_LABEL[p.content_type].slice(0, -1)}
                        </span>
                        {p.description ? ` · ${p.description.slice(0, 36)}` : ''}
                      </span>
                    </li>
                  ))}
                  {posts.length > 4 ? (
                    <li className="text-[10px] italic text-charcoal/55">
                      +{posts.length - 4} more
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const types: ContentType[] = ['reel', 'photo', 'carousel', 'story', 'video', 'graphic'];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-cream-dk/60 bg-cream-lt/40 px-5 py-3 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
      <span className="font-semibold">Legend</span>
      {types.map(t => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn('inline-block h-2 w-2 rounded-full', TYPE_DOT[t])} />
          {CONTENT_TYPE_LABEL[t]}
        </span>
      ))}
    </div>
  );
}
