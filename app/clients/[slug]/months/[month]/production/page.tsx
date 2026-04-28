import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronDown,
  ExternalLink,
  Layers,
  Link2,
  MapPin,
  User,
} from 'lucide-react';
import { CoveragePanel } from '@/components/coverage-panel';
import {
  buildMonthContext,
  getClientBySlug,
  listAllShoots,
  listClients,
  listShootTemplates,
} from '@/lib/queries';
import { leadTimeStatus } from '@/lib/computations';
import { cn, fmtDate, monthSlugToIso } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProductionPage({
  params,
}: {
  params: Promise<{ slug: string; month: string }>;
}) {
  const { slug, month } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const iso = monthSlugToIso(month);
  const ctx = await buildMonthContext(client, iso);
  const [templates, allShoots, allClients] = await Promise.all([
    listShootTemplates(),
    listAllShoots(),
    listClients(),
  ]);
  const tplById = new Map(templates.map(t => [t.id, t]));
  const shootById = new Map(allShoots.map(s => [s.id, s]));
  const clientById = new Map(allClients.map(c => [c.id, c]));
  // Build a quick map: shoot id → host client (for shoots in OTHER months/clients)
  const monthsForLookup = new Map<string, { client_id: string }>();
  // For other-client lookups we only need client info; the queries module does
  // not expose a "fetch month by id" so we fall back to the host's own data
  // when possible. A piggyback inside the same month is the common case.
  const minLead = ctx.strategic_frame?.min_lead_time_days ?? 5;
  const piggybacksByHost = new Map<string, typeof ctx.shoots>();
  for (const s of ctx.shoots) {
    if (s.piggyback_on_shoot_id) {
      const arr = piggybacksByHost.get(s.piggyback_on_shoot_id) ?? [];
      arr.push(s);
      piggybacksByHost.set(s.piggyback_on_shoot_id, arr);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr,380px]">
      <ShootSchedule
        shoots={ctx.shoots}
        posts={ctx.posts}
        minLead={minLead}
        slug={slug}
        month={month}
        tplById={tplById}
        piggybacksByHost={piggybacksByHost}
        shootById={shootById}
        clientById={clientById}
      />

      <aside>
        <div className="sticky top-24">
          <CoveragePanel ctx={ctx} variant="full" />
        </div>
      </aside>
    </div>
  );
}

function ShootSchedule({
  shoots,
  posts,
  minLead,
  slug,
  month,
  tplById,
  piggybacksByHost,
  shootById,
  clientById,
}: {
  shoots: Awaited<ReturnType<typeof buildMonthContext>>['shoots'];
  posts: Awaited<ReturnType<typeof buildMonthContext>>['posts'];
  minLead: number;
  slug: string;
  month: string;
  tplById: Map<string, Awaited<ReturnType<typeof listShootTemplates>>[number]>;
  piggybacksByHost: Map<string, Awaited<ReturnType<typeof buildMonthContext>>['shoots']>;
  shootById: Map<string, Awaited<ReturnType<typeof listAllShoots>>[number]>;
  clientById: Map<string, Awaited<ReturnType<typeof listClients>>[number]>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <header className="border-b border-cream-dk/60 px-7 py-5">
        <div className="eyebrow">Production</div>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-green-deep">
          Shoot <span className="italic text-amber-deep">schedule</span>
        </h2>
        <p className="mt-2 text-sm italic text-charcoal/65">
          Each shoot's required capture list is auto-populated from its shoot type.
        </p>
      </header>

      <ul className="divide-y divide-cream-dk/60">
        {shoots.length === 0 ? (
          <li className="px-7 py-16 text-center text-sm text-charcoal/55">
            No shoots planned. Add one from the Planning tab.
          </li>
        ) : (
          shoots.map(s => {
            const lt = leadTimeStatus(s, posts, minLead);
            const linked = posts.filter(p => p.shoot_id === s.id).length;
            const tpl = s.shoot_template_id ? tplById.get(s.shoot_template_id) : null;
            const piggybacks = piggybacksByHost.get(s.id) ?? [];
            const host = s.piggyback_on_shoot_id
              ? shootById.get(s.piggyback_on_shoot_id) ?? null
              : null;
            const ltLabel =
              lt.kind === 'ok'
                ? `${lt.days}d · OK`
                : lt.kind === 'tight'
                ? `${lt.days}d · Tight`
                : lt.kind === 'no_date'
                ? 'No date'
                : 'No posts';
            const ltTone =
              lt.kind === 'ok'
                ? 'text-green-deep bg-green-light/15 ring-green-light/40'
                : lt.kind === 'tight'
                ? 'text-bad bg-bad/10 ring-bad/30'
                : 'text-charcoal/55 bg-cream-lt ring-cream-dk';
            return (
              <li key={s.id} className="px-7 py-6">
                <div className="grid grid-cols-[auto,1fr,auto] items-start gap-6">
                  <div className="flex h-16 w-16 flex-col items-center justify-center rounded-md bg-green-deep text-cream">
                    <span className="text-[9px] uppercase tracking-eyebrow text-cream/65">
                      Shoot
                    </span>
                    <span className="font-display text-3xl font-black leading-none">
                      {s.bundle_number}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="font-display text-xl font-bold text-green-deep">
                      {tpl ? (
                        tpl.name
                      ) : (
                        <span className="italic font-normal text-charcoal/45">
                          No type set
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-charcoal/65">
                      <span className="font-medium text-charcoal">
                        {s.scheduled_date ? fmtDate(s.scheduled_date) : 'No date'}
                      </span>
                      {s.scheduled_time ? (
                        <>
                          <Sep />
                          <span className="tabular-nums">{s.scheduled_time}</span>
                        </>
                      ) : null}
                      {s.location ? (
                        <span className="inline-flex items-center gap-1">
                          <Sep />
                          <MapPin size={11} className="text-amber-deep" />
                          {s.location}
                        </span>
                      ) : null}
                      {s.assigned_to ? (
                        <span className="inline-flex items-center gap-1">
                          <Sep />
                          <User size={11} className="text-amber-deep" />
                          {s.assigned_to}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] uppercase tracking-label">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset',
                          ltTone
                        )}
                      >
                        Lead · {ltLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-lt px-2.5 py-1 font-semibold text-charcoal/65 ring-1 ring-inset ring-cream-dk">
                        Posts ·{' '}
                        <span className="font-display tabular-nums text-green-deep">
                          {linked}
                        </span>
                      </span>
                      {host ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-dk/30 px-2.5 py-1 font-semibold text-charcoal ring-1 ring-inset ring-cream-dk">
                          <Link2 size={11} />
                          Rides along on Shoot {host.bundle_number}
                        </span>
                      ) : null}
                      {piggybacks.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-light/40 px-2.5 py-1 font-semibold text-amber-deep ring-1 ring-inset ring-amber-mid/40">
                          <Layers size={11} />
                          {piggybacks.length} ride
                          {piggybacks.length === 1 ? '' : 's'} along
                        </span>
                      ) : null}
                    </div>

                    {piggybacks.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 rounded-md border border-green-light/40 bg-green-light/10 px-3 py-2 text-xs text-charcoal/75">
                        <li className="font-semibold uppercase tracking-eyebrow text-green-deep">
                          Riding along
                        </li>
                        {piggybacks.map(pb => {
                          const pbtpl = pb.shoot_template_id
                            ? tplById.get(pb.shoot_template_id)
                            : null;
                          return (
                            <li
                              key={pb.id}
                              className="flex items-center gap-2"
                            >
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-mid" />
                              <span className="font-medium text-charcoal">
                                Shoot {pb.bundle_number}
                              </span>
                              <span className="text-charcoal/55">
                                {pbtpl ? pbtpl.name : '— No type set —'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}

                    {tpl?.required_capture_list ? (
                      <details className="group mt-4">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] uppercase tracking-label text-amber-deep hover:text-charcoal">
                          Required capture list
                          <ChevronDown
                            size={12}
                            className="transition-transform duration-fast group-open:rotate-180"
                          />
                        </summary>
                        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-cream-dk/60 bg-cream-lt p-5 font-body text-sm leading-loose text-charcoal/85">
                          {tpl.required_capture_list}
                        </pre>
                      </details>
                    ) : null}
                  </div>

                  <Link
                    href={`/clients/${slug}/months/${month}/shoots/${s.bundle_number}/shotlist`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream transition-colors duration-fast hover:bg-charcoal"
                  >
                    Shot list
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function Sep() {
  return <span aria-hidden className="text-cream-dk">·</span>;
}
