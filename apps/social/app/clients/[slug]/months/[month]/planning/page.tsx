import { notFound } from 'next/navigation';
import {
  buildMonthContext,
  getClientBySlug,
  listHolidays,
  listPeople,
  listShootTemplates,
} from '@/lib/queries';
import { monthSlugToIso } from '@/lib/utils';
import { PlanningGrid } from '@/components/planning-grid';
import { CoveragePanel } from '@/components/coverage-panel';
import { AiMonthDrafter } from '@/components/ai-month-drafter';
import { NotificationBanner } from '@/components/notification-banner';
import { CONTENT_TYPE_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PlanningPage({
  params,
}: {
  params: Promise<{ slug: string; month: string }>;
}) {
  const { slug, month } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const iso = monthSlugToIso(month);
  const ctx = await buildMonthContext(client, iso);
  const templates = await listShootTemplates();
  const holidays = await listHolidays();
  const people = await listPeople();

  // Build the var bundles the month drafter sends to Voice.
  const pillarMix = formatPillarMix(ctx.strategic_frame);
  const quotas = formatQuotas(ctx.quota);
  const holidaysFor = formatHolidays(holidays, month, client.slug);
  const monthNotes = formatNotes(ctx.posts.length, ctx.shoots.length);

  return (
    <div className="space-y-6">
      <NotificationBanner clientId={client.id} monthId={ctx.month.id} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AiMonthDrafter
          monthId={ctx.month.id}
          monthSlug={month}
          clientSlug={slug}
          clientId={client.id}
          month={month}
          pillarMix={pillarMix}
          quotas={quotas}
          holidays={holidaysFor}
          notes={monthNotes}
          hasExistingPosts={ctx.posts.length > 0}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,320px]">
        <PlanningGrid
          clientSlug={slug}
          monthSlug={month}
          monthId={ctx.month.id}
          posts={ctx.posts}
          shoots={ctx.shoots}
          templates={templates}
          clientId={client.id}
          people={people}
        />
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <CoveragePanel ctx={ctx} variant="rail" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function formatPillarMix(frame: Awaited<ReturnType<typeof buildMonthContext>>['strategic_frame']): string {
  if (!frame) return '(no strategic frame yet — Voice will draft a balanced default)';
  const lines: string[] = [];
  if (frame.pillar_1_name) {
    lines.push(`p1 (${frame.pillar_1_name}) — ${frame.pillar_mix.p1}%${frame.pillar_1_desc ? ` · ${frame.pillar_1_desc}` : ''}`);
  }
  if (frame.pillar_2_name) {
    lines.push(`p2 (${frame.pillar_2_name}) — ${frame.pillar_mix.p2}%${frame.pillar_2_desc ? ` · ${frame.pillar_2_desc}` : ''}`);
  }
  if (frame.pillar_3_name) {
    lines.push(`p3 (${frame.pillar_3_name}) — ${frame.pillar_mix.p3}%${frame.pillar_3_desc ? ` · ${frame.pillar_3_desc}` : ''}`);
  }
  return lines.length > 0 ? lines.join('\n') : '(pillars defined but unnamed)';
}

function formatQuotas(quota: Awaited<ReturnType<typeof buildMonthContext>>['quota']): string {
  if (!quota) return '(no monthly quota set)';
  const targets: Array<[keyof typeof CONTENT_TYPE_LABEL, number | null]> = [
    ['reel', quota.reels_target],
    ['photo', quota.photos_target],
    ['carousel', quota.carousels_target],
    ['story', quota.stories_target],
    ['video', quota.videos_target],
    ['graphic', quota.graphics_target],
  ];
  return targets
    .filter(([, n]) => n != null && n > 0)
    .map(([t, n]) => `${CONTENT_TYPE_LABEL[t]}: ${n}`)
    .join(', ');
}

function formatHolidays(
  holidays: Awaited<ReturnType<typeof listHolidays>>,
  monthSlug: string,
  _clientSlug: string
): string {
  // monthSlug is like "2026-05"; date_label is free-form text in the source data.
  // We can't reliably filter by date in the schema, so pass them all and let
  // Voice decide what's relevant for the month.
  if (holidays.length === 0) return '(no holidays in the global table)';
  return holidays
    .slice(0, 30)
    .map(h => `${h.date_label} — ${h.event}${h.content_angle ? ` (${h.content_angle})` : ''}`)
    .join('\n');
}

function formatNotes(postCount: number, shootCount: number): string {
  if (postCount === 0 && shootCount === 0) return 'Empty month — no posts or shoots planned yet.';
  return `${postCount} post${postCount === 1 ? '' : 's'} already drafted, ${shootCount} shoot bundle${shootCount === 1 ? '' : 's'} scheduled.`;
}
