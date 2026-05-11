import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createLead } from '@/lib/crm/actions';
import { listPeople, listSources } from '@/lib/crm/queries';
import { LeadForm } from '@/components/crm/lead-form';

export default async function NewLeadPage() {
  const [sources, people] = await Promise.all([listSources(), listPeople()]);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
      <div>
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Pipeline
        </Link>
        <span className="mt-3 inline-block text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          New lead
        </span>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-stone-900">
          Add to <span className="italic text-amber-deep">pipeline</span>.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-[1.55] text-stone-600">
          Capture what you know now. Everything except the name is optional —
          you can fill in detail any time on the lead&rsquo;s page.
        </p>
      </div>

      <LeadForm
        action={createLead}
        mode="create"
        sources={sources}
        people={people}
        cancelHref="/crm"
      />
    </div>
  );
}
