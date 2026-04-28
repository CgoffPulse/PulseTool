import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createLead } from '@/lib/actions';
import { listPeople, listSources } from '@/lib/queries';

export default async function NewLeadPage() {
  const [sources, people] = await Promise.all([listSources(), listPeople()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
        >
          <ChevronLeft size={14} /> Pipeline
        </Link>
        <span className="eyebrow mt-3">New lead</span>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-display text-green-deep">
          Add to <span className="italic-amber">pipeline</span>.
        </h1>
        <p className="mt-2 text-sm text-charcoal/65">
          Capture what you know now — fields are optional. You can fill in detail
          on the lead's detail page after.
        </p>
      </div>

      <form action={createLead} className="flex flex-col gap-5 rounded-md border border-cream-dk/60 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lead name" required>
            <input name="name" type="text" required className="input" />
          </Field>
          <Field label="Company">
            <input name="company" type="text" className="input" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" className="input" />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" className="input" />
          </Field>
          <Field label="Source">
            <select name="source_id" className="select" defaultValue="">
              <option value="">No source</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Owner">
            <select name="owner_person_id" className="select" defaultValue="">
              <option value="">Unassigned</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estimated value (USD)">
            <input
              name="value"
              type="text"
              inputMode="decimal"
              placeholder="$5,000"
              className="input"
            />
          </Field>
          <Field label="Expected close">
            <input name="expected_close_date" type="date" className="input" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            name="notes"
            rows={4}
            placeholder="Anything you want future-you to know about this lead."
            className="input resize-y"
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          <Link href="/" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Create lead
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
        {label}
        {required && <span className="ml-1 text-bad">*</span>}
      </span>
      {children}
    </label>
  );
}
