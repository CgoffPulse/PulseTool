import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Mail, Phone } from 'lucide-react';
import {
  getLead,
  listEvents,
  listLostReasons,
  listPeople,
  listTouches,
} from '@/lib/queries';
import { socialClientUrl } from '@/lib/social-bridge';
import { StageChip, stageLabel } from '@/components/stage-chip';
import { formatDate, formatMoneyFull } from '@/lib/format';
import { timeAgo } from '@/lib/utils';
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
    ...touches.map(t => ({
      kind: 'touch' as const,
      at: t.happened_at,
      node: renderTouch(t),
    })),
    ...events.map(e => ({
      kind: 'event' as const,
      at: e.at,
      node: renderEvent(e),
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Pipeline
        </Link>

        <header className="grain relative mt-4 overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-8 text-cream shadow-card">
          <span aria-hidden className="watermark cream pointer-events-none absolute -top-6 right-4 text-[140px] leading-none">
            {(lead.company || lead.name).slice(0, 3).toUpperCase()}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <StageChip stage={lead.stage} />
            {lead.source_label && (
              <span className="chip-on-dark">{lead.source_label}</span>
            )}
            {lead.client_id && (
              <span className="chip-on-dark">Client onboarded</span>
            )}
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-display sm:text-5xl">
            {lead.name}
          </h1>
          {lead.company && (
            <div className="mt-1 font-display text-xl text-cream/75">
              {lead.company}
            </div>
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
            <span>
              Value:{' '}
              <span className="italic-amber">
                {formatMoneyFull(lead.value_cents)}
              </span>
            </span>
            {lead.expected_close_date && (
              <span>
                Closing <span className="italic-amber">{formatDate(lead.expected_close_date)}</span>
              </span>
            )}
            {lead.owner_name && (
              <span>
                Owner: <span className="italic-amber">{lead.owner_name}</span>
              </span>
            )}
          </div>
        </header>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left column: actions + timeline */}
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <span className="eyebrow">Log a touch</span>
            <TouchForm leadId={lead.id} people={people} />
          </section>

          <section className="flex flex-col gap-3">
            <span className="eyebrow">Notes</span>
            <NotesForm leadId={lead.id} initial={lead.notes} />
          </section>

          <section className="flex flex-col gap-3">
            <span className="eyebrow">Timeline</span>
            {timeline.length === 0 ? (
              <div className="rounded-md border border-cream-dk/60 bg-white p-6 text-center text-sm text-charcoal/55">
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

        {/* Right column: stage controls + promote + meta */}
        <aside className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-md border border-cream-dk/60 bg-white p-4 shadow-sm">
            <span className="eyebrow">Stage</span>
            <div className="flex items-center gap-3">
              <StageChip stage={lead.stage} />
              <span className="text-xs text-charcoal/55">{stageLabel(lead.stage)}</span>
            </div>
            <StageControl
              leadId={lead.id}
              current={lead.stage}
              lostReasons={lostReasons}
            />
          </div>

          {(lead.stage === 'won' || lead.client_id) && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-mid/40 bg-cream/40 p-4">
              <span className="eyebrow">Bridge to social</span>
              <p className="text-xs text-charcoal/65">
                Stamp this lead as an active client in Pulse Social so we can
                start strategy + cadence work over there.
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

          <div className="flex flex-col gap-2 rounded-md border border-cream-dk/60 bg-white p-4 text-xs text-charcoal/65 shadow-sm">
            <span className="eyebrow">Meta</span>
            <Row label="Created" value={timeAgo(lead.created_at)} />
            <Row label="Updated" value={timeAgo(lead.updated_at)} />
            <Row label="Source" value={lead.source_label ?? '—'} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-charcoal/55">{label}</span>
      <span className="text-charcoal/85">{value}</span>
    </div>
  );
}

function renderTouch(t: import('@/lib/types').Touch) {
  return (
    <div className="rounded-md border border-cream-dk/60 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-amber-deep">
          {t.kind}
        </span>
        <span className="text-[11px] text-charcoal/55">{timeAgo(t.happened_at)}</span>
      </div>
      {t.summary && <p className="mt-1.5 text-sm text-charcoal/85">{t.summary}</p>}
      {t.follow_up_at && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-amber-deep">
          Next nudge {formatDate(t.follow_up_at)}
        </div>
      )}
    </div>
  );
}

function renderEvent(e: import('@/lib/types').Event) {
  const detail = e.from_stage
    ? `${e.from_stage} → ${e.to_stage}`
    : `→ ${e.to_stage}`;
  return (
    <div className="flex items-center justify-between rounded-md border border-cream-dk/40 bg-cream/30 px-3 py-2 text-xs">
      <span className="font-semibold uppercase tracking-eyebrow text-green-deep">
        Stage · {detail}
      </span>
      <span className="text-charcoal/55">{timeAgo(e.at)}</span>
    </div>
  );
}
