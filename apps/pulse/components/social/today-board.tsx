'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Coffee,
  MapPin,
  Sparkles,
  UserCog,
} from 'lucide-react';
import {
  CONTENT_TYPE_LABEL,
  PERSON_ROLE_LABEL,
  type Client,
  type MonthRow,
  type NotificationRow,
  type Post,
  type Shoot,
} from '@/lib/social/types';
import { cn, monthSlug } from '@/lib/social/utils';
import { usePerson } from './person-context';

export function TodayBoard({
  todayIso,
  weekStartIso,
  weekEndIso,
  clients,
  months,
  notifications,
  todayShoots,
  weekShoots,
  todayPosts,
  weekPosts,
}: {
  todayIso: string;
  weekStartIso: string;
  weekEndIso: string;
  clients: Client[];
  months: MonthRow[];
  notifications: NotificationRow[];
  todayShoots: Shoot[];
  weekShoots: Shoot[];
  todayPosts: Post[];
  weekPosts: Post[];
}) {
  const { active } = usePerson();
  const today = parseISO(todayIso);

  const clientById = new Map(clients.map(c => [c.id, c]));
  const monthById = new Map(months.map(m => [m.id, m]));

  if (!active) {
    return <PickerPrompt />;
  }

  // Filter for the active person.
  const yourTodayShoots = todayShoots.filter(s => s.assigned_person_id === active.id);
  const yourWeekShoots = weekShoots
    .filter(s => s.assigned_person_id === active.id)
    .sort((a, b) => (a.scheduled_date! < b.scheduled_date! ? -1 : 1));
  const yourTodayPosts = todayPosts.filter(p => p.owner_person_id === active.id);
  const yourWeekPosts = weekPosts
    .filter(p => p.owner_person_id === active.id)
    .sort((a, b) => (a.post_date < b.post_date ? -1 : 1));

  const yourNotifications = notifications.filter(
    n =>
      (n.audience_person_id == null && n.audience_role == null) ||
      n.audience_person_id === active.id ||
      n.audience_role === active.role
  );
  const yourBad = yourNotifications.filter(n => n.severity === 'bad');
  const yourWarn = yourNotifications.filter(n => n.severity === 'warn');

  const teamWatching = notifications.filter(
    n =>
      n.audience_person_id != null &&
      n.audience_person_id !== active.id &&
      n.audience_role !== active.role
  );

  const greeting = greet(today);

  return (
    <div className="space-y-12">
      <Hero
        name={active.name}
        roleLabel={PERSON_ROLE_LABEL[active.role]}
        color={active.color}
        greeting={greeting}
        today={today}
        priorityCount={yourBad.length}
        warnCount={yourWarn.length}
      />

      {/* TODAY */}
      <Section
        eyebrow="Today"
        title={`${greeting}, ${active.name.split(' ')[0]}.`}
        tag="What needs to happen by end of day."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LaneCard
            tone="bad"
            title="Priorities"
            empty="Inbox zero. Nice."
            items={yourBad.map(n => ({
              id: n.id,
              title: n.title,
              detail: n.detail,
              link: n.link_url,
              meta: 'Action needed',
            }))}
          />
          <LaneCard
            tone="warn"
            title="Watch this"
            empty="Nothing on the radar."
            items={yourWarn.map(n => ({
              id: n.id,
              title: n.title,
              detail: n.detail,
              link: n.link_url,
              meta: 'Heads up',
            }))}
          />
          <LaneCard
            tone="ok"
            title="On the schedule"
            empty="No shoots or posts due today."
            items={[
              ...yourTodayShoots.map(s => {
                const m = monthById.get(s.month_id);
                const c = m ? clientById.get(m.client_id) : null;
                return {
                  id: s.id,
                  title: `${c?.name ?? '—'} · Shoot ${s.bundle_number}`,
                  detail: [s.scheduled_time, s.location].filter(Boolean).join(' · ') || null,
                  link:
                    c && m
                      ? `/clients/${c.slug}/months/${monthSlug(m.month)}/shoots/${s.bundle_number}/shotlist`
                      : null,
                  meta: 'Shoot today',
                  color: c?.color,
                };
              }),
              ...yourTodayPosts.map(p => {
                const m = monthById.get(p.month_id);
                const c = m ? clientById.get(m.client_id) : null;
                return {
                  id: p.id,
                  title: `${c?.name ?? '—'} · ${CONTENT_TYPE_LABEL[p.content_type]} live`,
                  detail: p.description?.slice(0, 80) ?? null,
                  link:
                    c && m
                      ? `/clients/${c.slug}/months/${monthSlug(m.month)}/planning`
                      : null,
                  meta: p.post_time ?? 'Today',
                  color: c?.color,
                };
              }),
            ]}
          />
        </div>
      </Section>

      {/* THIS WEEK */}
      <Section
        eyebrow="This week"
        title={
          <>
            What's <span className="italic text-amber-deep">coming up</span>
          </>
        }
        tag={`Week of ${format(parseISO(weekStartIso), 'MMM d')} → ${format(parseISO(weekEndIso), 'MMM d')}.`}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ListCard title="Your shoots" icon={<Calendar size={14} />}>
            {yourWeekShoots.length === 0 ? (
              <Empty text="No shoots assigned to you this week." />
            ) : (
              <ul className="divide-y divide-cream-dk/40">
                {yourWeekShoots.map(s => {
                  const m = monthById.get(s.month_id);
                  const c = m ? clientById.get(m.client_id) : null;
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <DateBadge date={s.scheduled_date!} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: c?.color ?? '#999' }}
                          />
                          {c?.name ?? '—'}
                        </div>
                        <div className="font-display text-base font-bold text-green-deep">
                          Shoot {s.bundle_number}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-charcoal/65">
                          {s.scheduled_time ? <span className="tabular-nums">{s.scheduled_time}</span> : null}
                          {s.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} className="text-amber-deep" />
                              {s.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {c && m ? (
                        <Link
                          href={`/clients/${c.slug}/months/${monthSlug(m.month)}/shoots/${s.bundle_number}/shotlist`}
                          className="rounded-md bg-green-deep px-2.5 py-1.5 text-[10px] uppercase tracking-label text-cream hover:bg-charcoal"
                        >
                          Shot list →
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </ListCard>

          <ListCard title="Your posts going live" icon={<Sparkles size={14} />}>
            {yourWeekPosts.length === 0 ? (
              <Empty text="No posts owned by you this week." />
            ) : (
              <ul className="divide-y divide-cream-dk/40">
                {yourWeekPosts.slice(0, 8).map(p => {
                  const m = monthById.get(p.month_id);
                  const c = m ? clientById.get(m.client_id) : null;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <DateBadge date={p.post_date} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: c?.color ?? '#999' }}
                          />
                          {c?.name ?? '—'}
                          <span aria-hidden className="text-cream-dk">·</span>
                          {CONTENT_TYPE_LABEL[p.content_type]}
                        </div>
                        <div className="truncate text-sm text-charcoal">
                          {p.description ?? <span className="italic text-charcoal/45">—</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {yourWeekPosts.length > 8 ? (
                  <li className="py-2 text-[11px] italic text-charcoal/55">
                    +{yourWeekPosts.length - 8} more
                  </li>
                ) : null}
              </ul>
            )}
          </ListCard>
        </div>
      </Section>

      {/* WATCHING */}
      <Section
        eyebrow="Watching"
        title={
          <>
            Team work that <span className="italic text-amber-deep">touches you</span>
          </>
        }
        tag="Items owned by others where your input may be needed."
      >
        <div className="rounded-2xl border border-cream-dk/60 bg-white p-5 shadow-card">
          {teamWatching.length === 0 ? (
            <Empty text="The rest of the team is unblocked." />
          ) : (
            <ul className="divide-y divide-cream-dk/40">
              {teamWatching.slice(0, 6).map(n => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <SeverityDot severity={n.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-charcoal">{n.title}</div>
                    {n.detail ? (
                      <div className="text-xs text-charcoal/60">{n.detail}</div>
                    ) : null}
                  </div>
                  {n.link_url ? (
                    <Link
                      href={n.link_url}
                      className="text-[11px] font-medium uppercase tracking-eyebrow text-amber-deep hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function PickerPrompt() {
  return (
    <div className="grid place-items-center py-24">
      <div className="w-full max-w-md rounded-2xl border border-cream-dk/60 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-mid/15 text-amber-deep">
          <UserCog size={20} />
        </div>
        <div className="eyebrow justify-center">Tell us who you are</div>
        <h1 className="mt-3 font-display text-3xl font-black tracking-display text-green-deep">
          Pick yourself in the top bar.
        </h1>
        <p className="mt-3 text-sm leading-body text-charcoal/65">
          Your "Today" view changes based on who's at the desk. Trey gets the field
          schedule. Christian gets strategy gaps. Nobody gets a feed that's not theirs.
        </p>
        <p className="mt-2 text-xs italic text-charcoal/55">
          Your choice is remembered on this device only. No login required.
        </p>
      </div>
    </div>
  );
}

function Hero({
  name,
  roleLabel,
  color,
  greeting,
  today,
  priorityCount,
  warnCount,
}: {
  name: string;
  roleLabel: string;
  color: string;
  greeting: string;
  today: Date;
  priorityCount: number;
  warnCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cream-dk/60">
      <div className="grain bg-green-deep px-8 py-10 text-cream md:px-12 md:py-14">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-eyebrow text-cream/65">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-cream/30"
            style={{ backgroundColor: color }}
          />
          {name} · {roleLabel} · {format(today, 'EEEE, MMMM d')}
        </div>
        <h1 className="mt-4 font-display text-5xl font-black leading-display tracking-display text-cream md:text-6xl">
          {greeting},{' '}
          <span className="italic text-amber-mid">{name.split(' ')[0]}.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-body text-cream/80">
          {priorityCount === 0 && warnCount === 0
            ? "Nothing's on fire. Use the open hours well."
            : priorityCount > 0
            ? `${priorityCount} item${priorityCount === 1 ? '' : 's'} need attention before EOD${warnCount > 0 ? `, plus ${warnCount} on the watch list` : ''}.`
            : `${warnCount} item${warnCount === 1 ? '' : 's'} on the watch list — nothing burning.`}
        </p>
      </div>
    </section>
  );
}

function Section({
  eyebrow,
  title,
  tag,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-cream-dk/60 pb-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-display text-green-deep">
            {title}
          </h2>
        </div>
        <p className="max-w-md text-sm italic leading-body text-charcoal/65 md:text-right">
          {tag}
        </p>
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function LaneCard({
  tone,
  title,
  empty,
  items,
}: {
  tone: 'bad' | 'warn' | 'ok';
  title: string;
  empty: string;
  items: Array<{
    id: string;
    title: string;
    detail: string | null;
    link: string | null;
    meta?: string;
    color?: string;
  }>;
}) {
  const TONES = {
    bad: 'border-bad/30 bg-bad/5',
    warn: 'border-amber-mid/40 bg-amber-light/20',
    ok: 'border-green-light/50 bg-green-light/10',
  };
  const ICONS: Record<string, React.ReactNode> = {
    bad: <AlertCircle size={14} className="text-bad" />,
    warn: <Sparkles size={14} className="text-amber-deep" />,
    ok: <CheckCircle2 size={14} className="text-green-deep" />,
  };
  return (
    <div className={cn('rounded-2xl border p-5 shadow-card', TONES[tone])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/65">
          {ICONS[tone]}
          <span className="font-semibold">{title}</span>
        </div>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal/60">
          {items.length === 0 ? 'clear' : items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm italic text-charcoal/55">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-cream-dk/40">
          {items.slice(0, 5).map(it => (
            <li key={it.id} className="flex items-start gap-2 py-2.5">
              {it.color ? (
                <span
                  className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: it.color }}
                />
              ) : null}
              <div className="flex-1 min-w-0">
                {it.meta ? (
                  <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                    {it.meta}
                  </div>
                ) : null}
                <div className="truncate text-sm font-medium text-charcoal">{it.title}</div>
                {it.detail ? (
                  <div className="line-clamp-2 text-xs text-charcoal/65">{it.detail}</div>
                ) : null}
              </div>
              {it.link ? (
                <Link
                  href={it.link}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-amber-deep hover:bg-amber-mid/15"
                  aria-label="Open"
                >
                  <ChevronRight size={14} />
                </Link>
              ) : null}
            </li>
          ))}
          {items.length > 5 ? (
            <li className="py-2 text-[11px] italic text-charcoal/55">
              +{items.length - 5} more
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function ListCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cream-dk/60 bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
        {icon}
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function DateBadge({ date }: { date: string }) {
  const d = parseISO(date);
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-cream-dk bg-cream-lt text-center">
      <span className="text-[9px] uppercase tracking-eyebrow text-charcoal/55">
        {format(d, 'EEE')}
      </span>
      <span className="font-display text-base font-bold leading-none text-green-deep">
        {format(d, 'd')}
      </span>
    </div>
  );
}

function SeverityDot({ severity }: { severity: NotificationRow['severity'] }) {
  const cls =
    severity === 'bad'
      ? 'bg-bad'
      : severity === 'warn'
      ? 'bg-amber-mid'
      : 'bg-green-light';
  return <span className={cn('mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full', cls)} />;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-3 text-sm italic text-charcoal/55">
      <Coffee size={14} className="text-charcoal/35" />
      {text}
    </div>
  );
}

function greet(today: Date): string {
  const h = today.getHours();
  if (h < 5) return 'Up early';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Evening';
  return 'Late shift';
}
