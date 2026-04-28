import { notFound } from 'next/navigation';
import {
  buildMonthContext,
  getClientBySlug,
  listShootTemplates,
} from '@/lib/queries';
import { monthSlugToIso } from '@/lib/utils';
import { PlanningGrid } from '@/components/planning-grid';
import { CoveragePanel } from '@/components/coverage-panel';

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

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr,320px]">
      <PlanningGrid
        clientSlug={slug}
        monthSlug={month}
        monthId={ctx.month.id}
        posts={ctx.posts}
        shoots={ctx.shoots}
        templates={templates}
      />
      <aside className="hidden xl:block">
        <div className="sticky top-20">
          <CoveragePanel ctx={ctx} variant="rail" />
        </div>
      </aside>
    </div>
  );
}
