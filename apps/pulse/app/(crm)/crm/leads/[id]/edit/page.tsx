import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { updateLead } from '@/lib/crm/actions';
import { getLead, listPeople, listSources } from '@/lib/crm/queries';
import { LeadForm } from '@/components/crm/lead-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLeadPage({ params }: Props) {
  const { id } = await params;
  const [lead, sources, people] = await Promise.all([
    getLead(id),
    listSources(),
    listPeople(),
  ]);
  if (!lead) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
      <div>
        <Link
          href={`/crm/leads/${id}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Back to lead
        </Link>
        <span className="mt-3 inline-block text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          Edit lead
        </span>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-stone-900">
          {lead.name}
        </h1>
        {lead.company && (
          <div className="mt-1 font-display text-xl text-stone-600">{lead.company}</div>
        )}
        <p className="mt-2 max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Every section saves together. Changes go live when you hit Save.
        </p>
      </div>

      <LeadForm
        action={updateLead}
        mode="edit"
        initial={lead}
        sources={sources}
        people={people}
        cancelHref={`/crm/leads/${id}`}
      />
    </div>
  );
}
