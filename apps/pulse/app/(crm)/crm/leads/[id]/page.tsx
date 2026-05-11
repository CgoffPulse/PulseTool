import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Edit3,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import {
  getLead,
  listEvents,
  listLostReasons,
  listPeople,
  listTouches,
} from '@/lib/crm/queries';
import { socialClientUrl } from '@/lib/crm/social-bridge';
import { StageChip, stageLabel } from '@/components/crm/stage-chip';
import { formatDate, formatMoneyFull, timeAgo } from '@/lib/crm/format';
import { SERVICE_LINES } from '@/lib/crm/types';
import { StageControl } from './_stage-control';
import { TouchForm } from './_touch-form';
import { PromoteButton } from './_promote-button';
import { NotesForm } from './_notes-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const [touches, events, people, lostReasons] = await Promise.all([
    listTouches(id),
    listEvents(id),
    listPeople(),
    listLostReasons(),
  ]);

  type TimelineEntry =
    | { kind: 'touch'; at: string; node: ReturnType<typeof renderTouch> }
    | { kind: 'event'; at: string; node: ReturnType<typeof renderEvent> };
  const timeline: TimelineEntry[] = [
    ...touches.map(t => ({ kind: 'touch' as const, at: t.happened_at, node: renderTouch(t) })),
    ...events.map(e => ({ kind: 'event' as const, at: e.at, node: renderEvent(e) })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const serviceLabels = new Map(SERVICE_LINES.map(s => [s.key, s.label]));
  const location = [lead.city, lead.region].filter(Boolean).join(', ');
  const hasBusinessProfile =
    lead.business_type || lead.industry || location || lead.website_url ||
    lead.instagram_handle || lead.facebook_url || lead.google_business_url;
  const hasOpportunity =
    (lead.services_interested && lead.services_interested.length > 0) ||
    lead.budget_signal || lead.timeline || lead.heat || lead.value_cents;
  const hasDiscovery = lead.pain_points || lead.current_solution || lead.goals;

  return (
    <div className="flex flex-col gap-10 pb-12">
      <div>
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Pipeline
        </Link>

        <header className="grain relative mt-4 overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-8 text-cream shadow-card">
          <span aria-hidden className="watermark cream pointer-events-none absolute -top-6 right-4 text-[140px] leading-none">
            {(lead.company || lead.name).slice(0, 3).toUpperCase()}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <StageChip stage={lead.stage} />
            {lead.heat && <HeatBadge heat={lead.heat} />}
            {lead.source_label && <span className="chip-on-dark">{lead.source_label}</span>}
            {lead.business_type && <span className="chip-on-dark">{lead.business_type}</span>}
            {lead.client_id && <span className="chip-on-dark">Client onboarded</span>}
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-display sm:text-5xl">
            {lead.name}
          </h1>
          {lead.company && (
            <div className="mt-1 font-display text-xl text-cream/75">{lead.company}</div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/75">
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 hover:text-amber-light"
              >
                <Mail size={14} /> {lead.email}
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-amber-light"
              >
                <Phone size={14} /> {lead.phone}
              </a>
            )}
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} /> {location}
              </span>
            )}
            <span>
              Value:{' '}
              <span className="italic text-amber-light tabular-nums">
                {formatMoneyFull(lead.value_cents)}
              </span>
            </span>
            {lead.expected_close_date && (
              <span>
                Closing{' '}
                <span className="italic text-amber-light">
                  {formatDate(lead.expected_close_date)}
                </span>
              </span>
            )}
            {lead.owner_name && (
              <span>
                Owner: <span className="italic text-amber-light">{lead.owner_name}</span>
              </span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/crm/leads/${lead.id}/edit`}
              className="inline-flex items-center gap-2 rounded-md bg-amber-deep px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-cream shadow-sm transition-colors hover:bg-amber-deep/90"
            >
              <Edit3 size={14} /> Edit lead details
            </Link>
            <span className="text-[12px] leading-[36px] text-cream/65">
              Update value, services, notes, and everything else here.
            </span>
          </div>
        </header>
      </div>

      {/* Loud edit CTA outside the hero — Christian can't miss it. */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-mid/40 bg-amber/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <Edit3 size={18} className="shrink-0 text-amber-deep" />
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-stone-900">
              Update anything about this lead
            </span>
            <span className="text-[12px] text-stone-600">
              Value, services interested, decision-maker, pain points, contact info — all on one page.
            </span>
          </div>
        </div>
        <Link
          href={`/crm/leads/${lead.id}/edit`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-deep bg-white px-3 py-1.5 text-[13px] font-medium text-amber-deep transition-colors hover:bg-amber-deep hover:text-cream"
        >
          <Edit3 size={14} /> Edit lead
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="flex flex-col gap-8">
          {hasBusinessProfile && (
            <ProfileSection eyebrow="Business profile" title="About the business">
              <DefinitionGrid>
                <DT label="Business type" value={lead.business_type} />
                <DT label="Industry / niche" value={lead.industry} />
                <DT label="Location" value={location || null} />
                <DT
                  label="Website"
                  value={
                    lead.website_url ? (
                      <ExtLink href={lead.website_url}>
                        <Globe size={12} /> {prettyUrl(lead.website_url)}
                      </ExtLink>
                    ) : null
                  }
                />
                <DT
                  label="Instagram"
                  value={
                    lead.instagram_handle ? (
                      <ExtLink href={instagramUrl(lead.instagram_handle)}>
                        <ExternalLink size={12} /> {lead.instagram_handle}
                      </ExtLink>
                    ) : null
                  }
                />
                <DT
                  label="Facebook"
                  value={
                    lead.facebook_url ? (
                      <ExtLink href={lead.facebook_url}>
                        <ExternalLink size={12} /> {prettyUrl(lead.facebook_url)}
                      </ExtLink>
                    ) : null
                  }
                />
                <DT
                  label="Google Business"
                  value={
                    lead.google_business_url ? (
                      <ExtLink href={lead.google_business_url}>
                        <ExternalLink size={12} /> Open profile
                      </ExtLink>
                    ) : null
                  }
                />
              </DefinitionGrid>
            </ProfileSection>
          )}

          {(lead.decision_maker_name || lead.decision_maker_title || lead.referrer) && (
            <ProfileSection eyebrow="Stakeholders" title="Who calls the shots">
              <DefinitionGrid>
                <DT label="Decision-maker" value={lead.decision_maker_name} />
                <DT label="Their title" value={lead.decision_maker_title} />
                <DT label="Referrer" value={lead.referrer} />
                <DT label="Owner (Pulse)" value={lead.owner_name} />
              </DefinitionGrid>
            </ProfileSection>
          )}

          {hasOpportunity && (
            <ProfileSection eyebrow="Opportunity" title="What they&rsquo;re shopping for">
              <div className="flex flex-col gap-4">
                {lead.services_interested && lead.services_interested.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                      Services interested in
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {lead.services_interested.map(key => (
                        <span
                          key={key}
                          className="rounded-full border border-green-deep/30 bg-green-deep/5 px-3 py-1 text-[12px] text-green-deep"
                        >
                          {serviceLabels.get(key as never) ?? key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <DefinitionGrid>
                  <DT
                    label="Estimated value"
                    value={
                      lead.value_cents !== null ? (
                        <span className="tabular-nums">{formatMoneyFull(lead.value_cents)}</span>
                      ) : null
                    }
                  />
                  <DT label="Budget signal" value={lead.budget_signal} />
                  <DT label="Timeline" value={lead.timeline} />
                  <DT
                    label="Expected close"
                    value={lead.expected_close_date ? formatDate(lead.expected_close_date) : null}
                  />
                </DefinitionGrid>
              </div>
            </ProfileSection>
          )}

          {hasDiscovery && (
            <ProfileSection eyebrow="Discovery" title="What we learned">
              <div className="flex flex-col gap-4 text-[14px] leading-[1.55] text-stone-700">
                {lead.pain_points && (
                  <Block label="Pain points">{lead.pain_points}</Block>
                )}
                {lead.current_solution && (
                  <Block label="Current solution">{lead.current_solution}</Block>
                )}
                {lead.goals && <Block label="Goals">{lead.goals}</Block>}
              </div>
            </ProfileSection>
          )}

          {lead.tags && lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lead.tags.map(t => (
                <span
                  key={t}
                  className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-[12px] text-stone-700"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              Log a touch
            </span>
            <TouchForm leadId={lead.id} people={people} />
          </section>

          <section className="flex flex-col gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              Free-form notes
            </span>
            <NotesForm leadId={lead.id} initial={lead.notes} />
          </section>

          <section className="flex flex-col gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              Timeline
            </span>
            {timeline.length === 0 ? (
              <div className="rounded-md border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
                Nothing here yet. Log your first touch above.
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {timeline.map((entry, i) => (
                  <li key={i}>{entry.node}</li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Right column */}
        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-md border border-stone-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              Stage
            </span>
            <div className="flex items-center gap-3">
              <StageChip stage={lead.stage} />
              <span className="text-xs text-stone-500">{stageLabel(lead.stage)}</span>
            </div>
            <StageControl leadId={lead.id} current={lead.stage} lostReasons={lostReasons} />
          </div>

          {(lead.stage === 'won' || lead.client_id) && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-mid/40 bg-cream/40 p-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                Bridge to social
              </span>
              <p className="text-xs text-stone-600">
                Stamp this lead as an active client in Pulse Social so we can start strategy +
                cadence work over there.
              </p>
              <PromoteButton leadId={lead.id} alreadyPromoted={!!lead.client_id} />
              {lead.client_id && (
                <a
                  href={socialClientUrl(slugifyClient(lead))}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost"
                >
                  Open in Pulse Social
                </a>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-md border border-stone-200 bg-white p-4 text-xs text-stone-600 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              Meta
            </span>
            <Row label="Created" value={timeAgo(lead.created_at)} />
            <Row label="Updated" value={timeAgo(lead.updated_at)} />
            <Row label="Source" value={lead.source_label ?? '—'} />
            {lead.last_touch_at && <Row label="Last touch" value={timeAgo(lead.last_touch_at)} />}
            {lead.next_followup_at && (
              <Row label="Next follow-up" value={formatDate(lead.next_followup_at)} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function slugifyClient(lead: { name: string; company: string | null }): string {
  return (lead.company ?? lead.name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function instagramUrl(h: string): string {
  const handle = h.replace(/^@/, '').trim();
  return `https://instagram.com/${handle}`;
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url;
  }
}

function ProfileSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          {eyebrow}
        </span>
        <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
        {children}
      </div>
    </section>
  );
}

function DefinitionGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

function DT({ label, value }: { label: string; value: React.ReactNode | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">{label}</dt>
      <dd className="text-[14px] text-stone-800">{value}</dd>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </span>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-green-deep hover:text-amber-deep"
    >
      {children}
    </a>
  );
}

function HeatBadge({ heat }: { heat: 'cold' | 'warm' | 'hot' }) {
  const cls =
    heat === 'hot'
      ? 'bg-bad text-cream'
      : heat === 'warm'
        ? 'bg-amber-deep text-cream'
        : 'bg-stone-500 text-cream';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}
    >
      <Star size={10} /> {heat}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}

function renderTouch(t: import('@/lib/crm/types').Touch) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-deep">
          {t.kind}
        </span>
        <span className="text-[11px] text-stone-500">{timeAgo(t.happened_at)}</span>
      </div>
      {t.summary && <p className="mt-1.5 text-sm text-stone-800">{t.summary}</p>}
      {t.follow_up_at && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-deep">
          Next nudge {formatDate(t.follow_up_at)}
        </div>
      )}
    </div>
  );
}

function renderEvent(e: import('@/lib/crm/types').Event) {
  const detail = e.from_stage ? `${e.from_stage} → ${e.to_stage}` : `→ ${e.to_stage}`;
  return (
    <div className="flex items-center justify-between rounded-md border border-stone-200/60 bg-stone-50 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-[0.08em] text-green-deep">
        Stage · {detail}
      </span>
      <span className="text-stone-500">{timeAgo(e.at)}</span>
    </div>
  );
}
