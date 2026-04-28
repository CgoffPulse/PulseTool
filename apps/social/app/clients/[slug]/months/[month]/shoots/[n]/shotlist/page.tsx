import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, MapPin, User } from 'lucide-react';
import {
  buildMonthContext,
  getClientBySlug,
  listCaptureItems,
} from '@/lib/queries';
import { CONTENT_TYPE_LABEL, type ContentType } from '@/lib/types';
import { fmtDate, fmtMonth, monthSlugToIso } from '@/lib/utils';
import { PrintButton } from '@/components/print-button';
import { CaptureChecklist } from './_checklist';

export const dynamic = 'force-dynamic';

const TYPE_FIELD: Record<ContentType, string> = {
  reel: 'produces_reels',
  photo: 'produces_photos',
  carousel: 'produces_carousels',
  story: 'produces_stories',
  video: 'produces_videos',
  graphic: 'produces_graphics',
};

export default async function ShotListPage({
  params,
}: {
  params: Promise<{ slug: string; month: string; n: string }>;
}) {
  const { slug, month, n } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const iso = monthSlugToIso(month);
  const ctx = await buildMonthContext(client, iso);
  const bundle = Number(n);
  const shoot = ctx.shoots.find(s => s.bundle_number === bundle);
  if (!shoot) notFound();

  const linkedPosts = ctx.posts.filter(p => p.shoot_id === shoot.id);
  const tpl = shoot.template;
  const captureItems = await listCaptureItems(shoot.id);

  return (
    <article className="mx-auto max-w-3xl print:max-w-none">
      <div className="no-print mb-8 flex items-center justify-between">
        <a
          href={`/clients/${slug}/months/${month}/production`}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-label text-charcoal/55 hover:text-amber-deep"
        >
          <ArrowLeft size={13} />
          Back to production
        </a>
        <PrintButton />
      </div>

      <header className="grid grid-cols-[auto,1fr] items-end gap-7 border-b-2 border-green-deep pb-7">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg bg-green-deep text-cream">
          <span className="text-[10px] uppercase tracking-eyebrow text-cream/65">
            Shoot
          </span>
          <span className="font-display text-5xl font-black leading-none">
            {bundle}
          </span>
        </div>
        <div>
          <div className="eyebrow">
            {client.name} · {fmtMonth(iso)}
          </div>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight tracking-display text-green-deep md:text-5xl">
            {tpl ? tpl.name : 'No shoot type assigned'}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-charcoal/75">
            {shoot.scheduled_date ? (
              <span className="font-semibold text-green-deep">
                {fmtDate(shoot.scheduled_date)}
              </span>
            ) : (
              <span className="italic text-bad">No date set</span>
            )}
            {shoot.scheduled_time ? (
              <>
                <Sep />
                <span className="tabular-nums">{shoot.scheduled_time}</span>
              </>
            ) : null}
            {tpl?.duration ? (
              <>
                <Sep />
                <span>{tpl.duration}</span>
              </>
            ) : null}
            {shoot.location ? (
              <>
                <Sep />
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-amber-deep" />
                  {shoot.location}
                </span>
              </>
            ) : null}
            {shoot.assigned_to ? (
              <>
                <Sep />
                <span className="inline-flex items-center gap-1">
                  <User size={12} className="text-amber-deep" />
                  Assigned · {shoot.assigned_to}
                </span>
              </>
            ) : null}
          </div>
          {shoot.drive_folder_url ? (
            <a
              href={shoot.drive_folder_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-deep hover:underline"
            >
              Drive folder
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </header>

      <CaptureChecklist
        clientSlug={slug}
        monthSlug={month}
        shootId={shoot.id}
        bundleNumber={bundle}
        templateText={tpl?.required_capture_list ?? null}
        items={captureItems}
        linkedPosts={linkedPosts}
      />

      <Section eyebrow="02" title="Capacity">
        {tpl ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {(['reel', 'photo', 'carousel', 'story', 'video', 'graphic'] as ContentType[]).map(
              t => {
                const cap = tpl[TYPE_FIELD[t] as keyof typeof tpl] as number;
                return (
                  <div
                    key={t}
                    className="rounded-lg border border-cream-dk/60 bg-white p-4 text-center"
                  >
                    <div className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                      {CONTENT_TYPE_LABEL[t]}
                    </div>
                    <div className="mt-2 font-display text-3xl font-black tabular-nums text-green-deep">
                      {cap}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <p className="text-sm italic text-charcoal/55">
            Pick a shoot type on the planning page to see capacity.
          </p>
        )}
      </Section>

      <Section
        eyebrow="03"
        title={`Posts depending on this shoot · ${linkedPosts.length}`}
      >
        {linkedPosts.length === 0 ? (
          <p className="text-sm italic text-charcoal/55">
            No posts assigned yet. On Planning, set a post's Shoot column to "Shoot {bundle}".
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-dk/60 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                <th className="py-3 pr-3 text-left font-semibold">Date</th>
                <th className="py-3 pr-3 text-left font-semibold">Type</th>
                <th className="py-3 text-left font-semibold">Description / hook</th>
              </tr>
            </thead>
            <tbody>
              {linkedPosts.map(p => (
                <tr key={p.id} className="border-b border-cream-dk/40 align-top">
                  <td className="py-3.5 pr-4 text-charcoal/75 tabular-nums">
                    {fmtDate(p.post_date)}
                  </td>
                  <td className="py-3.5 pr-4 font-medium text-charcoal">
                    {CONTENT_TYPE_LABEL[p.content_type]}
                  </td>
                  <td className="py-3.5 leading-body text-charcoal">
                    {p.description || (
                      <span className="italic text-charcoal/45">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {shoot.notes ? (
        <Section eyebrow="04" title="Notes">
          <p className="whitespace-pre-wrap text-sm leading-body text-charcoal/80">
            {shoot.notes}
          </p>
        </Section>
      ) : null}

      <footer className="mt-14 border-t border-cream-dk/60 pt-5 text-[10px] uppercase tracking-eyebrow text-charcoal/45 print:mt-10">
        Pulse Community Agency · {client.name} · {fmtMonth(iso)} · Shoot {bundle}
      </footer>
    </article>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end gap-3 border-b border-cream-dk/60 pb-3">
        <span className="font-display text-sm font-bold tabular-nums text-charcoal/45">
          {eyebrow}
        </span>
        <h2 className="font-display text-2xl font-bold text-green-deep">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Sep() {
  return <span aria-hidden className="text-cream-dk">·</span>;
}
