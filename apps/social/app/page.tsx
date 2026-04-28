import Link from 'next/link';
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  ArrowUpRight,
  Calendar,
  Camera,
  Layers,
  Link2,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react';
import {
  listAllMonths,
  listAllPostsForMonths,
  listAllShootsForMonths,
  listClients,
  listShootTemplates,
} from '@/lib/queries';
import {
  POST_PIPELINE,
  POST_STATUS_LABEL,
  PULSE_HOUSE_SLUG,
  type Client,
  type ContentType,
  type Post,
  type PostStatus,
  CONTENT_TYPE_LABEL,
  type Shoot,
} from '@/lib/types';
import {
  groupShootsByDay,
  isColocated,
  isPulseHouse,
  normalizeLocation,
  rideAlongCandidates,
} from '@/lib/field-plan';
import { fmtDate, fmtMonth, monthSlug } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  let connError: string | null = null;
  let clients: Client[] = [];
  let months: Awaited<ReturnType<typeof listAllMonths>> = [];
  let shoots: Shoot[] = [];
  let posts: Post[] = [];
  let templates: Awaited<ReturnType<typeof listShootTemplates>> = [];
  try {
    [clients, months, templates] = await Promise.all([
      listClients(),
      listAllMonths(),
      listShootTemplates(),
    ]);
    const monthIds = months.map(m => m.id);
    [shoots, posts] = await Promise.all([
      listAllShootsForMonths(monthIds),
      listAllPostsForMonths(monthIds),
    ]);
  } catch (err) {
    connError = err instanceof Error ? err.message : String(err);
  }

  const tplById = new Map(templates.map(t => [t.id, t]));
  const clientById = new Map(clients.map(c => [c.id, c]));
  const monthById = new Map(months.map(m => [m.id, m]));
  const pulseClient = clients.find(c => c.slug === PULSE_HOUSE_SLUG) ?? null;
  const houseClients = clients.filter(c => c.slug !== PULSE_HOUSE_SLUG);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const next14End = addDays(today, 14);
  const next7End = addDays(today, 7);

  const upcomingShoots = shoots
    .filter(s => s.scheduled_date && !isBefore(parseISO(s.scheduled_date), today))
    .sort((a, b) => (a.scheduled_date! < b.scheduled_date! ? -1 : 1));

  const next14Shoots = upcomingShoots.filter(s =>
    isWithinInterval(parseISO(s.scheduled_date!), { start: today, end: next14End })
  );

  const fieldDays = groupShootsByDay(next14Shoots);

  // Pulse posts in the next 14 days that aren't on a shoot — ride-along candidates.
  const pulseMonthIds = pulseClient
    ? months.filter(m => m.client_id === pulseClient.id).map(m => m.id)
    : [];
  const pulsePosts = posts.filter(p => pulseMonthIds.includes(p.month_id));
  const pulseFreePosts = pulsePosts.filter(p => !p.shoot_id);

  // Pipeline counts (across everyone, including Pulse).
  const stageCounts: Record<PostStatus, number> = {
    planned: 0,
    captured: 0,
    edited: 0,
    approved: 0,
    ready: 0,
    scheduled: 0,
    posted: 0,
  };
  for (const p of posts) stageCounts[p.status]++;
  stageCounts.approved += stageCounts.ready;
  stageCounts.ready = 0;

  const postsThisWeek = posts.filter(p =>
    isWithinInterval(parseISO(p.post_date), { start: weekStart, end: weekEnd })
  );
  const postsNext7 = posts.filter(p =>
    isWithinInterval(parseISO(p.post_date), { start: today, end: next7End })
  );
  const stuckPlanned = postsThisWeek.filter(p => p.status === 'planned' && p.shoot_id);
  const stuckCaptured = posts.filter(
    p =>
      p.status === 'captured' &&
      isBefore(parseISO(p.post_date), addDays(today, 14))
  );
  const goingLive = postsNext7.filter(
    p => p.status === 'approved' || p.status === 'scheduled' || p.status === 'ready'
  );

  return (
    <div className="space-y-14">
      <Hero
        clientCount={houseClients.length}
        totalPosts={posts.length}
        pulsePresent={!!pulseClient}
      />

      {connError ? (
        <div className="rounded-lg border border-amber-deep/30 bg-amber-light/30 px-5 py-4 text-sm text-charcoal">
          <div className="font-semibold">Can't connect to Supabase.</div>
          <div className="mt-1 font-mono text-xs">{connError}</div>
        </div>
      ) : null}

      {/* PIPELINE STRIP */}
      <section>
        <SectionHead
          eyebrow="Pipeline"
          title="Where every post stands"
          tag="A live count across all clients."
        />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {POST_PIPELINE.map(s => (
            <PipelineCell
              key={s}
              status={s}
              count={stageCounts[s] ?? 0}
              total={posts.length}
            />
          ))}
        </div>
      </section>

      {/* FIELD SCHEDULE — the brain of the dashboard */}
      <section>
        <SectionHead
          eyebrow="Field schedule"
          title="The next 14 days, in the field"
          tag="Every shoot, every client, every chance to batch."
        />
        <div className="mt-6">
          <FieldSchedule
            fieldDays={fieldDays}
            clientById={clientById}
            monthById={monthById}
            tplById={tplById}
            pulseClient={pulseClient}
            pulseFreePosts={pulseFreePosts}
            shoots={shoots}
          />
        </div>
      </section>

      {/* PULSE HOUSE LANE */}
      {pulseClient ? (
        <PulseHouseLane
          pulseClient={pulseClient}
          months={months}
          posts={pulsePosts}
          shoots={shoots.filter(s =>
            months
              .filter(m => m.client_id === pulseClient.id)
              .map(m => m.id)
              .includes(s.month_id)
          )}
        />
      ) : null}

      {/* WHAT NEEDS ATTENTION */}
      <section>
        <SectionHead
          eyebrow="Attention"
          title="What's stuck or shipping"
          tag="Cross-client signal, ranked by urgency."
        />
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <AttentionCard
            tone="bad"
            title="Stuck before capture"
            tag="Posts due this week with a shoot, still 'planned'"
            posts={stuckPlanned.slice(0, 4)}
            clientById={clientById}
            monthById={monthById}
          />
          <AttentionCard
            tone="warn"
            title="Captured, not yet edited"
            tag="Captured posts with their go-live date approaching"
            posts={stuckCaptured.slice(0, 4)}
            clientById={clientById}
            monthById={monthById}
          />
          <AttentionCard
            tone="ok"
            title="Going live next 7 days"
            tag="Approved or scheduled and on the calendar"
            posts={goingLive.slice(0, 4)}
            clientById={clientById}
            monthById={monthById}
          />
        </div>
      </section>

      {/* PER-CLIENT */}
      <section>
        <SectionHead
          eyebrow="Workspaces"
          title="Per-client overview"
          tag="Jump to any client's current month."
        />
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {clients.map(c => {
            const cMonths = months.filter(m => m.client_id === c.id);
            const current =
              cMonths.find(
                m => format(parseISO(m.month), 'yyyy-MM') === format(today, 'yyyy-MM')
              ) ?? cMonths[0];
            const cPosts = current ? posts.filter(p => p.month_id === current.id) : [];
            const cShoots = current ? shoots.filter(s => s.month_id === current.id) : [];
            return (
              <ClientCard
                key={c.id}
                client={c}
                month={current?.month}
                posts={cPosts}
                shootCount={cShoots.length}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────

function Hero({
  clientCount,
  totalPosts,
  pulsePresent,
}: {
  clientCount: number;
  totalPosts: number;
  pulsePresent: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cream-dk/60">
      <div className="grain bg-green-deep px-8 py-12 text-cream md:px-14 md:py-16">
        <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[1.5fr,1fr]">
          <div>
            <div className="eyebrow cream">
              Production hub · Issue {format(new Date(), 'yyyy.MM')}
            </div>
            <h1 className="mt-5 font-display text-5xl font-black leading-display tracking-display text-cream md:text-6xl">
              Today's <span className="italic text-amber-mid">production desk.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-body text-cream/80">
              Every social deliverable, every shoot, every status — across {clientCount}{' '}
              client{clientCount === 1 ? '' : 's'}
              {pulsePresent ? ' plus our own house content' : ''}, {totalPosts} planned
              posts.
            </p>
          </div>
          <div className="rounded-lg border border-cream/10 bg-cream/5 p-5 text-sm leading-body text-cream/80">
            <div className="eyebrow cream no-bar text-amber-mid">Workflow</div>
            <ol className="mt-4 space-y-2">
              <Step n="01" label="Plan" tone="bg-cream-dk text-charcoal" />
              <Step n="02" label="Capture" tone="bg-amber-mid text-green-deep" />
              <Step n="03" label="Edit" tone="bg-amber-deep text-cream" />
              <Step n="04" label="Approve" tone="bg-green-light text-green-deep" />
              <Step n="05" label="Schedule" tone="bg-green-mid text-cream" />
              <Step
                n="06"
                label="Posted"
                tone="bg-green-deep text-cream ring-1 ring-amber-mid"
              />
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ n, label, tone }: { n: string; label: string; tone: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid h-6 w-9 place-items-center rounded-sm font-mono text-[11px] font-semibold ${tone}`}
      >
        {n}
      </span>
      <span>{label}</span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline strip
// ─────────────────────────────────────────────────────────────────────────

function PipelineCell({
  status,
  count,
  total,
}: {
  status: PostStatus;
  count: number;
  total: number;
}) {
  const TONE: Record<PostStatus, string> = {
    planned: 'border-cream-dk bg-white',
    captured: 'border-amber-mid bg-amber-light/20',
    edited: 'border-amber-deep bg-amber-deep/5',
    approved: 'border-green-light bg-green-light/15',
    ready: 'border-green-light bg-green-light/15',
    scheduled: 'border-green-mid bg-green-mid/10',
    posted: 'border-green-deep bg-green-deep text-cream',
  };
  const isPosted = status === 'posted';
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`rounded-2xl border p-4 ${TONE[status]}`}>
      <div
        className={
          'flex items-center justify-between text-[10px] uppercase tracking-eyebrow ' +
          (isPosted ? 'text-cream/65' : 'text-charcoal/55')
        }
      >
        <span>{POST_STATUS_LABEL[status]}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div
        className={
          'mt-2 font-display text-4xl font-black leading-none tabular-nums ' +
          (isPosted ? 'text-cream' : 'text-green-deep')
        }
      >
        {count}
      </div>
      <div
        className={
          'mt-1 text-[11px] ' + (isPosted ? 'text-cream/60' : 'text-charcoal/55')
        }
      >
        of {total} posts
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field Schedule — the optimization layer
// ─────────────────────────────────────────────────────────────────────────

function FieldSchedule({
  fieldDays,
  clientById,
  monthById,
  tplById,
  pulseClient,
  pulseFreePosts,
  shoots,
}: {
  fieldDays: ReturnType<typeof groupShootsByDay>;
  clientById: Map<string, Client>;
  monthById: Map<string, Awaited<ReturnType<typeof listAllMonths>>[number]>;
  tplById: Map<string, Awaited<ReturnType<typeof listShootTemplates>>[number]>;
  pulseClient: Client | null;
  pulseFreePosts: Post[];
  shoots: Shoot[];
}) {
  if (fieldDays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-green-deep/25 bg-cream-lt p-12 text-center">
        <Camera size={28} className="mx-auto mb-3 text-charcoal/30" />
        <p className="text-sm italic text-charcoal/65">
          No shoots scheduled in the next 14 days. Quiet on the field.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {fieldDays.map(day => (
        <FieldDayCard
          key={day.date}
          day={day}
          clientById={clientById}
          monthById={monthById}
          tplById={tplById}
          pulseClient={pulseClient}
          pulseFreePosts={pulseFreePosts}
          allShoots={shoots}
        />
      ))}
    </div>
  );
}

function FieldDayCard({
  day,
  clientById,
  monthById,
  tplById,
  pulseClient,
  pulseFreePosts,
  allShoots,
}: {
  day: ReturnType<typeof groupShootsByDay>[number];
  clientById: Map<string, Client>;
  monthById: Map<string, Awaited<ReturnType<typeof listAllMonths>>[number]>;
  tplById: Map<string, Awaited<ReturnType<typeof listShootTemplates>>[number]>;
  pulseClient: Client | null;
  pulseFreePosts: Post[];
  allShoots: Shoot[];
}) {
  const date = parseISO(day.date);
  const isToday = date.toDateString() === new Date().toDateString();
  const numShoots = day.shoots.length;

  return (
    <article className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <header className="grid grid-cols-[auto,1fr,auto] items-center gap-5 border-b border-cream-dk/60 px-7 py-5">
        <div
          className={
            isToday
              ? 'flex h-16 w-16 flex-col items-center justify-center rounded-md bg-green-deep text-cream'
              : 'flex h-16 w-16 flex-col items-center justify-center rounded-md border border-cream-dk bg-cream-lt'
          }
        >
          <span
            className={
              'text-[10px] uppercase tracking-eyebrow ' +
              (isToday ? 'text-cream/65' : 'text-charcoal/55')
            }
          >
            {format(date, 'EEE')}
          </span>
          <span
            className={
              'font-display text-3xl font-black leading-none ' +
              (isToday ? 'text-cream' : 'text-green-deep')
            }
          >
            {format(date, 'd')}
          </span>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
            {isToday ? 'Today' : format(date, 'EEEE, MMM d')}
          </div>
          <div className="font-display text-xl font-bold text-green-deep">
            {numShoots} shoot{numShoots === 1 ? '' : 's'} on the books
            {day.colocations.length > 0 ? (
              <span className="ml-2 italic text-amber-deep">
                · {day.colocations.length} co-located
              </span>
            ) : null}
          </div>
        </div>
        <div className="hidden md:block">
          {day.colocations.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-light/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-label text-amber-deep ring-1 ring-amber-mid/40">
              <Layers size={12} />
              Batch opportunity
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-lt px-3 py-1.5 text-[11px] font-semibold uppercase tracking-label text-charcoal/60 ring-1 ring-cream-dk">
              <Calendar size={12} />
              Single outing
            </span>
          )}
        </div>
      </header>

      {/* Co-location alerts at top */}
      {day.colocations.map((group, gi) => {
        const loc = group[0].location;
        return (
          <div
            key={gi}
            className="mx-7 mt-5 rounded-lg border border-amber-mid/40 bg-amber-light/20 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-label text-amber-deep">
              <Layers size={13} />
              Same location
              <span aria-hidden className="text-amber-deep/40">
                ·
              </span>
              <span className="font-display normal-case italic">{loc}</span>
            </div>
            <p className="mt-1 text-sm text-charcoal/75">
              {group.length} shoots can run as one outing —{' '}
              {group
                .map(s => {
                  const c = clientById.get(monthById.get(s.month_id)?.client_id ?? '');
                  return `${c?.name ?? '—'} · Shoot ${s.bundle_number}`;
                })
                .join(' + ')}
              .
            </p>
          </div>
        );
      })}

      {/* Shoots for the day */}
      <ul className="divide-y divide-cream-dk/40">
        {day.shoots.map(s => {
          const m = monthById.get(s.month_id);
          const c = m ? clientById.get(m.client_id) : null;
          const tpl = s.shoot_template_id ? tplById.get(s.shoot_template_id) : null;
          const colocatedHere = day.shoots.some(
            o => o.id !== s.id && isColocated(o, s)
          );
          const isPulse = isPulseHouse(c);
          const piggybacks = allShoots.filter(o => o.piggyback_on_shoot_id === s.id);
          const rideAlongs = !isPulse
            ? rideAlongCandidates({
                hostShoot: s,
                pulseClient,
                pulsePosts: pulseFreePosts,
                windowDays: 14,
              })
            : [];

          return (
            <li key={s.id} className="px-7 py-5">
              <div className="grid grid-cols-[auto,1fr,auto] items-start gap-5">
                <div
                  className={
                    'flex h-12 w-12 flex-col items-center justify-center rounded-md ' +
                    (isPulse
                      ? 'bg-green-deep text-cream ring-2 ring-amber-mid'
                      : 'border border-cream-dk bg-cream-lt text-green-deep')
                  }
                >
                  <span
                    className={
                      'text-[9px] uppercase tracking-eyebrow ' +
                      (isPulse ? 'text-cream/65' : 'text-charcoal/55')
                    }
                  >
                    Shoot
                  </span>
                  <span className="font-display text-xl font-black leading-none">
                    {s.bundle_number}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                    {c ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className={isPulse ? 'text-green-deep font-bold' : ''}>
                          {c.name}
                        </span>
                      </span>
                    ) : null}
                    {isPulse ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-mid/20 px-1.5 py-0.5 font-semibold text-amber-deep">
                        <Sparkles size={10} />
                        House
                      </span>
                    ) : null}
                    {s.piggyback_on_shoot_id ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-cream-dk/60 px-1.5 py-0.5 font-semibold text-charcoal">
                        <Link2 size={10} />
                        Rides along
                      </span>
                    ) : null}
                    {colocatedHere ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-mid/20 px-1.5 py-0.5 font-semibold text-amber-deep">
                        <Layers size={10} />
                        Co-located
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-green-deep">
                    {tpl ? (
                      tpl.name
                    ) : (
                      <span className="italic font-normal text-charcoal/45">
                        No type set
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal/65">
                    {s.scheduled_time ? (
                      <span className="tabular-nums">{s.scheduled_time}</span>
                    ) : null}
                    {s.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} className="text-amber-deep" />
                        {s.location}
                      </span>
                    ) : null}
                    {s.assigned_to ? (
                      <span className="inline-flex items-center gap-1">
                        <User size={11} className="text-amber-deep" />
                        {s.assigned_to}
                      </span>
                    ) : null}
                  </div>

                  {piggybacks.length > 0 ? (
                    <div className="mt-3 rounded-md border border-green-light/40 bg-green-light/10 px-3 py-2 text-xs text-charcoal/75">
                      <span className="font-semibold uppercase tracking-eyebrow text-green-deep">
                        Riding along
                      </span>
                      <ul className="mt-1.5 space-y-1">
                        {piggybacks.map(pb => {
                          const pbm = monthById.get(pb.month_id);
                          const pbc = pbm ? clientById.get(pbm.client_id) : null;
                          const pbtpl = pb.shoot_template_id
                            ? tplById.get(pb.shoot_template_id)
                            : null;
                          return (
                            <li
                              key={pb.id}
                              className="flex items-center gap-2"
                            >
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: pbc?.color ?? '#999' }}
                              />
                              <span className="font-medium text-charcoal">
                                {pbc?.name ?? '—'}
                              </span>
                              <span className="text-charcoal/50">
                                Shoot {pb.bundle_number}
                                {pbtpl ? ` · ${pbtpl.name}` : ''}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {rideAlongs.length > 0 ? (
                    <div className="mt-3 rounded-md border border-amber-mid/40 bg-amber-light/20 px-3 py-2 text-xs text-charcoal/75">
                      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-eyebrow text-amber-deep">
                        <Sparkles size={11} />
                        Pulse content to grab while you're here
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {rideAlongs.slice(0, 3).map(p => (
                          <li key={p.id} className="flex items-center gap-2">
                            <span className="font-mono tabular-nums text-charcoal/55">
                              {format(parseISO(p.post_date), 'MMM d')}
                            </span>
                            <span className="font-semibold text-green-deep">
                              {CONTENT_TYPE_LABEL[p.content_type]}
                            </span>
                            <span className="truncate text-charcoal">
                              {p.description ?? '—'}
                            </span>
                          </li>
                        ))}
                        {rideAlongs.length > 3 ? (
                          <li className="text-[11px] italic text-charcoal/55">
                            +{rideAlongs.length - 3} more options
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {c && m ? (
                  <Link
                    href={`/clients/${c.slug}/months/${monthSlug(m.month)}/shoots/${s.bundle_number}/shotlist`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3 py-2 text-[11px] uppercase tracking-label text-cream hover:bg-charcoal"
                  >
                    Shot list →
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Pulse house lane
// ─────────────────────────────────────────────────────────────────────────

function PulseHouseLane({
  pulseClient,
  months,
  posts,
  shoots,
}: {
  pulseClient: Client;
  months: Awaited<ReturnType<typeof listAllMonths>>;
  posts: Post[];
  shoots: Shoot[];
}) {
  const today = new Date();
  const pulseMonths = months.filter(m => m.client_id === pulseClient.id);
  const current =
    pulseMonths.find(
      m => format(parseISO(m.month), 'yyyy-MM') === format(today, 'yyyy-MM')
    ) ?? pulseMonths[0];
  const monthIso = current?.month ?? format(startOfMonth(today), 'yyyy-MM-01');
  const monthSlugStr = monthSlug(monthIso);
  const monthPosts = current ? posts.filter(p => p.month_id === current.id) : [];
  const ridingAlong = shoots.filter(s => s.piggyback_on_shoot_id);
  const stages: Record<PostStatus, number> = {
    planned: 0,
    captured: 0,
    edited: 0,
    approved: 0,
    ready: 0,
    scheduled: 0,
    posted: 0,
  };
  for (const p of monthPosts) stages[p.status]++;
  stages.approved += stages.ready;

  return (
    <section>
      <SectionHead
        eyebrow="Our own house"
        title="Pulse content this month"
        tag="Treat ourselves like a client. Mostly captured while we're already in the field."
      />

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr,1fr]">
        <Link
          href={`/clients/${pulseClient.slug}/months/${monthSlugStr}/planning`}
          className="group grain relative overflow-hidden rounded-2xl border border-green-deep/40 bg-green-deep p-7 text-cream shadow-card transition-all duration-base ease-pulse hover:-translate-y-1 hover:shadow-lift"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow cream no-bar text-amber-mid">
                {fmtMonth(monthIso)} · House content
              </div>
              <h3 className="mt-3 font-display text-3xl font-black leading-tight tracking-display text-cream">
                {pulseClient.name}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-body text-cream/75">
                BTS, brand pieces, ride-alongs. Plan our own posts here so they get
                captured during client outings, not as a separate scramble.
              </p>
            </div>
            <ArrowUpRight
              size={20}
              className="text-amber-mid transition-transform duration-fast group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <HouseStat label="Planned" value={monthPosts.length} />
            <HouseStat label="Riding along" value={ridingAlong.length} />
            <HouseStat
              label="Captured"
              value={stages.captured + stages.edited + stages.approved + stages.scheduled + stages.posted}
            />
          </div>

          <div className="mt-6 flex items-center gap-1">
            {POST_PIPELINE.map((s, i) => {
              const c = stages[s] ?? 0;
              const pct = monthPosts.length > 0 ? c / monthPosts.length : 0;
              const tone =
                i === 0
                  ? 'bg-cream/30'
                  : i === 1
                  ? 'bg-amber-mid'
                  : i === 2
                  ? 'bg-amber-deep'
                  : i === 3
                  ? 'bg-green-light'
                  : i === 4
                  ? 'bg-green-mid'
                  : 'bg-cream';
              return (
                <div
                  key={s}
                  className="flex-1 overflow-hidden rounded-sm bg-cream/10"
                  title={`${POST_STATUS_LABEL[s]} · ${c}`}
                >
                  <div
                    className={`h-2 ${tone}`}
                    style={{
                      width: `${Math.max(pct * 100, c > 0 ? 12 : 0)}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Link>

        <div className="rounded-2xl border border-cream-dk/60 bg-white p-6 shadow-card">
          <div className="eyebrow">Ride-along principle</div>
          <p className="mt-3 font-display text-2xl italic leading-snug text-green-deep">
            "If we're already going to the ranch for ONSC,{' '}
            <span className="text-amber-deep not-italic font-bold">grab Pulse BTS too.</span>"
          </p>
          <p className="mt-3 text-sm leading-body text-charcoal/70">
            On any client shoot in the planning grid, set the Pulse shoot's{' '}
            <em>piggyback</em> to that host shoot. The shot list shows both
            capture lists side by side — same crew, same outing.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/clients/${pulseClient.slug}/months/${monthSlugStr}/planning`}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-[11px] uppercase tracking-label text-cream hover:bg-charcoal"
            >
              Plan Pulse posts →
            </Link>
            <Link
              href={`/clients/${pulseClient.slug}/strategy`}
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-dk bg-white px-3.5 py-2 text-[11px] uppercase tracking-label text-charcoal hover:border-amber-mid hover:text-amber-deep"
            >
              House strategy
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HouseStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/5 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-eyebrow text-cream/55">{label}</div>
      <div className="mt-1 font-display text-3xl font-black tabular-nums leading-none text-cream">
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Attention cards
// ─────────────────────────────────────────────────────────────────────────

function AttentionCard({
  tone,
  title,
  tag,
  posts,
  clientById,
  monthById,
}: {
  tone: 'bad' | 'warn' | 'ok';
  title: string;
  tag: string;
  posts: Post[];
  clientById: Map<string, Client>;
  monthById: Map<string, Awaited<ReturnType<typeof listAllMonths>>[number]>;
}) {
  const TONES = {
    bad: 'border-bad/30 bg-bad/5',
    warn: 'border-amber-mid/40 bg-amber-light/20',
    ok: 'border-green-light/50 bg-green-light/10',
  };
  const TITLE_TONE = {
    bad: 'text-bad',
    warn: 'text-amber-deep',
    ok: 'text-green-deep',
  };
  return (
    <div className={`rounded-2xl border p-5 ${TONES[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="eyebrow">{title}</div>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal/60">
          {posts.length === 0 ? 'clear' : posts.length}
        </span>
      </div>
      <p className={`mt-1.5 font-display italic ${TITLE_TONE[tone]}`}>{tag}</p>
      {posts.length === 0 ? (
        <p className="mt-3 text-sm italic text-charcoal/55">Nothing here. Nice.</p>
      ) : (
        <ul className="mt-3 divide-y divide-cream-dk/50">
          {posts.map(p => {
            const m = monthById.get(p.month_id);
            const c = m ? clientById.get(m.client_id) : null;
            return (
              <li key={p.id} className="flex items-start gap-2 py-2 text-sm">
                {c ? (
                  <span
                    className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                ) : null}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                    <span>{c?.name ?? '—'}</span>
                    <span aria-hidden className="text-cream-dk">·</span>
                    <span className="tabular-nums">{fmtDate(p.post_date)}</span>
                    <span aria-hidden className="text-cream-dk">·</span>
                    <span>{CONTENT_TYPE_LABEL[p.content_type as ContentType]}</span>
                  </div>
                  <div className="truncate text-charcoal">
                    {p.description ?? <span className="italic text-charcoal/45">—</span>}
                  </div>
                </div>
                {c && m ? (
                  <Link
                    href={`/clients/${c.slug}/months/${monthSlug(m.month)}/planning`}
                    className="text-[11px] font-medium uppercase tracking-eyebrow text-amber-deep hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Per-client cards (now Pulse-aware)
// ─────────────────────────────────────────────────────────────────────────

function ClientCard({
  client,
  month,
  posts,
  shootCount,
}: {
  client: Client;
  month: string | undefined;
  posts: Post[];
  shootCount: number;
}) {
  const stages: Record<PostStatus, number> = {
    planned: 0,
    captured: 0,
    edited: 0,
    approved: 0,
    ready: 0,
    scheduled: 0,
    posted: 0,
  };
  for (const p of posts) stages[p.status]++;
  stages.approved += stages.ready;

  const monthIso = month ?? format(startOfMonth(new Date()), 'yyyy-MM-01');
  const isHouse = isPulseHouse(client);
  return (
    <Link
      href={`/clients/${client.slug}/months/${monthSlug(monthIso)}/planning`}
      className={
        'group flex flex-col overflow-hidden rounded-2xl border p-6 shadow-card transition-all duration-base ease-pulse hover:-translate-y-1 hover:shadow-lift ' +
        (isHouse
          ? 'grain border-green-deep bg-green-deep text-cream hover:border-amber-mid'
          : 'border-cream-dk/60 bg-white hover:border-amber-mid/40')
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={
              'inline-block h-2.5 w-2.5 rounded-full ' +
              (isHouse ? 'ring-2 ring-amber-mid' : 'ring-2 ring-cream-dk/60')
            }
            style={{ backgroundColor: client.color }}
          />
          <span
            className={
              'font-display text-xl font-bold ' +
              (isHouse ? 'text-cream' : 'text-green-deep')
            }
          >
            {client.name}
          </span>
          {isHouse ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-amber-mid/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-amber-mid">
              <Sparkles size={10} />
              House
            </span>
          ) : null}
        </div>
        <ArrowUpRight
          size={16}
          className={
            'transition-transform duration-fast group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ' +
            (isHouse ? 'text-amber-mid' : 'text-amber-deep')
          }
        />
      </div>
      <div
        className={
          'mt-1 text-[10px] uppercase tracking-eyebrow ' +
          (isHouse ? 'text-cream/65' : 'text-charcoal/55')
        }
      >
        {fmtMonth(monthIso)}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <Mini
          icon={<Calendar size={12} />}
          label="Posts"
          value={posts.length}
          isHouse={isHouse}
        />
        <Mini
          icon={<Camera size={12} />}
          label="Shoots"
          value={shootCount}
          isHouse={isHouse}
        />
        <Mini icon={null} label="Posted" value={stages.posted} isHouse={isHouse} />
      </div>

      <div className="mt-5 flex items-center gap-1">
        {POST_PIPELINE.map((s, i) => {
          const c = stages[s] ?? 0;
          const pct = posts.length > 0 ? c / posts.length : 0;
          const tone =
            i === 0
              ? isHouse
                ? 'bg-cream/40'
                : 'bg-cream-dk'
              : i === 1
              ? 'bg-amber-mid'
              : i === 2
              ? 'bg-amber-deep'
              : i === 3
              ? 'bg-green-light'
              : i === 4
              ? 'bg-green-mid'
              : isHouse
              ? 'bg-cream'
              : 'bg-green-deep';
          return (
            <div
              key={s}
              className={
                'flex-1 overflow-hidden rounded-sm ' +
                (isHouse ? 'bg-cream/10' : 'bg-cream-dk/40')
              }
              title={`${POST_STATUS_LABEL[s]} · ${c}`}
            >
              <div
                className={`h-2 ${tone}`}
                style={{ width: `${Math.max(pct * 100, c > 0 ? 12 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function Mini({
  icon,
  label,
  value,
  isHouse,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isHouse: boolean;
}) {
  return (
    <div
      className={
        'rounded-md px-2 py-2.5 ' + (isHouse ? 'bg-cream/10' : 'bg-cream-lt')
      }
    >
      <div
        className={
          'flex items-center justify-center gap-1 text-[10px] uppercase tracking-eyebrow ' +
          (isHouse ? 'text-cream/55' : 'text-charcoal/55')
        }
      >
        {icon}
        {label}
      </div>
      <div
        className={
          'mt-1 font-display text-2xl font-black tabular-nums leading-none ' +
          (isHouse ? 'text-cream' : 'text-green-deep')
        }
      >
        {value}
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  tag,
}: {
  eyebrow: string;
  title: string;
  tag: string;
}) {
  return (
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
  );
}
