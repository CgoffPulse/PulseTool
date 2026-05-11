import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  Edit3,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
  Target,
  User,
  Users,
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
import {
  ArchiveLeadButton,
  InlineHeatEditor,
  InlineOwnerEditor,
  InlineValueEditor,
} from './_inline-editors';

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
  const subTitleParts: string[] = [];
  if (lead.company) subTitleParts.push(lead.company);
  if (lead.business_type) subTitleParts.push(lead.business_type);
  if (location) subTitleParts.push(location);

  const hasProfile =
    lead.industry ||
    lead.business_type ||
    location ||
    lead.website_url ||
    lead.instagram_handle ||
    lead.facebook_url ||
    lead.google_business_url ||
    lead.decision_maker_name ||
    lead.decision_maker_title ||
    lead.referrer;

  const hasDiscovery = lead.pain_points || lead.current_solution || lead.goals;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Breadcrumb + top actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Pipeline
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/leads/${lead.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 transition-colors hover:border-amber-deep hover:text-amber-deep"
          >
            <Edit3 size={12} /> Edit lead
          </Link>
        </div>
      </div>

      {/* Compact neutral header */}
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StageChip stage={lead.stage} />
          {lead.heat && <HeatBadge heat={lead.heat} />}
          {lead.source_label && (
            <span className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-stone-600">
              {lead.source_label}
            </span>
          )}
          {lead.client_id && (
            <span className="rounded-full border border-green-deep/30 bg-green-deep/5 px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-green-deep">
              Client onboarded
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">
          {lead.name}
        </h1>
        {subTitleParts.length > 0 && (
          <div className="text-[14px] text-stone-600">{subTitleParts.join(' · ')}</div>
        )}
      </header>

      {/* Two-column layout: sticky left summary + activity-first main */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ─── LEFT SUMMARY RAIL ────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <SummaryCard title="At a glance">
            <SummaryRow label="Deal value">
              <InlineValueEditor leadId={lead.id} initial={lead.value_cents} />
            </SummaryRow>
            <SummaryRow label="Heat">
              <InlineHeatEditor leadId={lead.id} initial={lead.heat} />
            </SummaryRow>
            <SummaryRow label="Owner">
              <InlineOwnerEditor
                leadId={lead.id}
                initial={{ id: lead.owner_person_id, name: lead.owner_name }}
                people={people}
              />
            </SummaryRow>
            <SummaryRow label="Stage">
              <div className="flex items-center gap-2">
                <StageChip stage={lead.stage} size="sm" />
                <span className="text-[12px] text-stone-500">{stageLabel(lead.stage)}</span>
              </div>
            </SummaryRow>
            {lead.expected_close_date && (
              <SummaryRow label="Expected close">
                <span className="inline-flex items-center gap-1.5 text-[14px] text-stone-800">
                  <CalendarClock size={12} className="text-stone-400" />
                  {formatDate(lead.expected_close_date)}
                </span>
              </SummaryRow>
            )}
            {lead.timeline && (
              <SummaryRow label="Timeline">
                <span className="text-[14px] text-stone-800">{lead.timeline}</span>
              </SummaryRow>
            )}
            {lead.budget_signal && (
              <SummaryRow label="Budget signal">
                <span className="text-[13px] text-stone-700">{lead.budget_signal}</span>
              </SummaryRow>
            )}
          </SummaryCard>

          <SummaryCard title="Move stage" compact>
            <StageControl leadId={lead.id} current={lead.stage} lostReasons={lostReasons} />
          </SummaryCard>

          {(lead.email || lead.phone) && (
            <SummaryCard title="Contact" compact>
              <div className="flex flex-col gap-2 text-[13px]">
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex items-center gap-2 text-stone-800 hover:text-amber-deep"
                  >
                    <Mail size={12} className="shrink-0 text-stone-400" />
                    <span className="truncate">{lead.email}</span>
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="inline-flex items-center gap-2 text-stone-800 hover:text-amber-deep"
                  >
                    <Phone size={12} className="shrink-0 text-stone-400" />
                    {lead.phone}
                  </a>
                )}
              </div>
            </SummaryCard>
          )}

          {(lead.decision_maker_name || lead.referrer) && (
            <SummaryCard title="Stakeholders" compact>
              <div className="flex flex-col gap-2 text-[13px]">
                {lead.decision_maker_name && (
                  <div className="flex items-start gap-2">
                    <User size={12} className="mt-0.5 shrink-0 text-stone-400" />
                    <div className="flex flex-col">
                      <span className="text-stone-800">{lead.decision_maker_name}</span>
                      {lead.decision_maker_title && (
                        <span className="text-[12px] text-stone-500">
                          {lead.decision_maker_title}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {lead.referrer && (
                  <div className="flex items-start gap-2">
                    <Users size={12} className="mt-0.5 shrink-0 text-stone-400" />
                    <div className="flex flex-col">
                      <span className="text-[12px] uppercase tracking-[0.08em] text-stone-500">
                        Referred by
                      </span>
                      <span className="text-stone-800">{lead.referrer}</span>
                    </div>
                  </div>
                )}
              </div>
            </SummaryCard>
          )}

          {lead.services_interested && lead.services_interested.length > 0 && (
            <SummaryCard title="Services interested" compact>
              <div className="flex flex-wrap gap-1.5">
                {lead.services_interested.map(key => (
                  <span
                    key={key}
                    className="rounded-full border border-green-deep/20 bg-green-deep/5 px-2 py-0.5 text-[11px] text-green-deep"
                  >
                    {serviceLabels.get(key as never) ?? key}
                  </span>
                ))}
              </div>
            </SummaryCard>
          )}

          {(lead.website_url ||
            lead.instagram_handle ||
            lead.facebook_url ||
            lead.google_business_url) && (
            <SummaryCard title="Links" compact>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {lead.website_url && (
                  <LinkRow icon={<Globe size={12} />} href={lead.website_url}>
                    {prettyUrl(lead.website_url)}
                  </LinkRow>
                )}
                {lead.instagram_handle && (
                  <LinkRow
                    icon={<ExternalLink size={12} />}
                    href={instagramUrl(lead.instagram_handle)}
                  >
                    {lead.instagram_handle}
                  </LinkRow>
                )}
                {lead.facebook_url && (
                  <LinkRow icon={<ExternalLink size={12} />} href={lead.facebook_url}>
                    {prettyUrl(lead.facebook_url)}
                  </LinkRow>
                )}
                {lead.google_business_url && (
                  <LinkRow icon={<MapPin size={12} />} href={lead.google_business_url}>
                    Google Business
                  </LinkRow>
                )}
              </div>
            </SummaryCard>
          )}

          {location && (
            <SummaryCard title="Location" compact>
              <div className="inline-flex items-center gap-2 text-[14px] text-stone-800">
                <MapPin size={12} className="shrink-0 text-stone-400" />
                {location}
              </div>
            </SummaryCard>
          )}

          {lead.tags && lead.tags.length > 0 && (
            <SummaryCard title="Tags" compact>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map(t => (
                  <span
                    key={t}
                    className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </SummaryCard>
          )}

          <SummaryCard title="Meta" compact>
            <div className="flex flex-col gap-1.5 text-[12px]">
              <MetaRow label="Created" value={timeAgo(lead.created_at)} />
              <MetaRow label="Updated" value={timeAgo(lead.updated_at)} />
              {lead.last_touch_at && (
                <MetaRow label="Last touch" value={timeAgo(lead.last_touch_at)} />
              )}
              {lead.next_followup_at && (
                <MetaRow label="Next follow-up" value={formatDate(lead.next_followup_at)} />
              )}
            </div>
          </SummaryCard>

          <SummaryCard title="Lifecycle" compact>
            <ArchiveLeadButton leadId={lead.id} />
          </SummaryCard>
        </aside>

        {/* ─── MAIN COLUMN ──────────────────────────────────── */}
        <div className="flex flex-col gap-8 min-w-0">
          {/* Activity composer + feed */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Activity</SectionHeading>
            <div className="text-[12px] text-stone-500">
              Log a touch — email, call, meeting, note. Each one stamps the timeline below.
            </div>
            <TouchForm leadId={lead.id} people={people} />
            {timeline.length > 0 ? (
              <ol className="flex flex-col gap-2 border-l border-stone-200 pl-5">
                {timeline.map((entry, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-3 h-2 w-2 rounded-full bg-stone-300"
                    />
                    {entry.node}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-md border border-dashed border-stone-200 bg-white p-6 text-center text-[13px] text-stone-500">
                No activity yet. Log your first touch above.
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="flex flex-col gap-3">
            <SectionHeading>Notes</SectionHeading>
            <NotesForm leadId={lead.id} initial={lead.notes} />
          </section>

          {/* Discovery */}
          {hasDiscovery && (
            <section className="flex flex-col gap-4">
              <SectionHeading>Discovery</SectionHeading>
              <div className="grid gap-4 rounded-md border border-stone-200 bg-white p-5 text-[14px] leading-[1.55] text-stone-700">
                {lead.pain_points && <Block icon={<Target size={12} />} label="Pain points">{lead.pain_points}</Block>}
                {lead.current_solution && <Block icon={<Building2 size={12} />} label="Current solution">{lead.current_solution}</Block>}
                {lead.goals && <Block icon={<Star size={12} />} label="Goals">{lead.goals}</Block>}
              </div>
            </section>
          )}

          {/* Profile summary (fields not already in left rail) */}
          {hasProfile && (
            <section className="flex flex-col gap-4">
              <SectionHeading>
                <span>Business profile</span>
                <Link
                  href={`/crm/leads/${lead.id}/edit`}
                  className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
                >
                  Edit
                </Link>
              </SectionHeading>
              <div className="grid gap-4 rounded-md border border-stone-200 bg-white p-5">
                <DefinitionGrid>
                  <DT label="Business type" value={lead.business_type} />
                  <DT label="Industry / niche" value={lead.industry} />
                  <DT label="Location" value={location || null} />
                </DefinitionGrid>
              </div>
            </section>
          )}

          {/* Bridge to social */}
          {(lead.stage === 'won' || lead.client_id) && (
            <section className="flex flex-col gap-4">
              <SectionHeading>Bridge to social</SectionHeading>
              <div className="flex flex-col gap-3 rounded-md border border-amber-mid/40 bg-amber/5 p-5">
                <p className="text-[13px] text-stone-700">
                  Stamp this lead as an active client in Pulse Social so we can start strategy +
                  cadence work over there.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <PromoteButton leadId={lead.id} alreadyPromoted={!!lead.client_id} />
                  {lead.client_id && (
                    <a
                      href={socialClientUrl(slugifyClient(lead))}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Open in Pulse Social
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────

function SummaryCard({
  title,
  compact,
  children,
}: {
  title: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
      <header className="border-b border-stone-100 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          {title}
        </span>
      </header>
      <div className={compact ? 'px-4 py-3' : 'flex flex-col gap-3 px-4 py-3'}>
        {children}
      </div>
    </section>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {label}
      </span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-800">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-stone-900">
        {typeof children === 'string' ? children : children}
      </h2>
    </div>
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

function Block({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {icon && <span className="text-stone-400">{icon}</span>}
        {label}
      </span>
      <p className="whitespace-pre-wrap">{children}</p>
    </div>
  );
}

function LinkRow({
  icon,
  href,
  children,
}: {
  icon: React.ReactNode;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-stone-800 hover:text-amber-deep"
    >
      <span className="shrink-0 text-stone-400">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────

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

function renderTouch(t: import('@/lib/crm/types').Touch) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-deep">
          {t.kind}
        </span>
        <span className="text-[11px] text-stone-500">{timeAgo(t.happened_at)}</span>
      </div>
      {t.summary && <p className="mt-1.5 text-[13px] text-stone-800">{t.summary}</p>}
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
    <div className="flex items-center justify-between rounded-md border border-stone-200/60 bg-stone-50 px-3 py-2 text-[12px]">
      <span className="font-semibold uppercase tracking-[0.08em] text-green-deep">
        Stage · {detail}
      </span>
      <span className="text-stone-500">{timeAgo(e.at)}</span>
    </div>
  );
}
