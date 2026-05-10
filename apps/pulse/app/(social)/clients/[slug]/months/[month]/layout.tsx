import { notFound } from 'next/navigation';
import { getClientBySlug } from '@/lib/social/queries';
import { MonthTabs } from '@/components/social/month-tabs';

export default async function MonthLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string; month: string }>;
  children: React.ReactNode;
}) {
  const { slug, month } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const base = `/clients/${slug}/months/${month}`;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between border-b border-cream-dk/60">
        <MonthTabs base={base} />
        <div className="pb-3 text-xs uppercase tracking-eyebrow text-charcoal/45">
          Issue · {month}
        </div>
      </div>
      {children}
    </div>
  );
}
