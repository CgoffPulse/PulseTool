'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { BUSINESS_TYPES, LEAD_HEATS, SERVICE_LINES, type Lead, type LeadHeat } from '@/lib/crm/types';
import type { LostReason, Person, Source } from '@/lib/crm/types';

/**
 * Shared multi-section lead form. Used by both /crm/leads/new (create) and
 * /crm/leads/[id]/edit (update). The server action is passed in by the
 * caller; the form just submits a FormData with every field as a named input.
 *
 * Design quality bar held: sectioned layout, tabular nums on numbers,
 * generous spacing, eyebrow uppercase 11px tracked, neutral foundation,
 * color earned only by required/heat markers.
 */
export function LeadForm({
  action,
  mode,
  initial,
  sources,
  people,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  mode: 'create' | 'edit';
  initial?: Partial<Lead> | null;
  sources: Source[];
  people: Person[];
  cancelHref: string;
}) {
  const i = initial ?? {};
  // Multi-select services_interested needs controlled state so the user can
  // toggle pills. The form submits each selected key as a separate
  // `services_interested` form field.
  const [services, setServices] = useState<string[]>(
    Array.isArray(i.services_interested) ? i.services_interested : []
  );
  function toggleService(key: string) {
    setServices(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }
  const valueDollars =
    typeof i.value_cents === 'number'
      ? (i.value_cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : '';

  return (
    <form action={action} className="flex flex-col gap-10">
      {mode === 'edit' && i.id && <input type="hidden" name="id" value={i.id} />}

      {/* hidden inputs that mirror the controlled services state */}
      {services.map(key => (
        <input key={key} type="hidden" name="services_interested" value={key} />
      ))}

      {/* ─── 1. Identity ──────────────────────────────────────────────── */}
      <Section title="Who is this" eyebrow="Identity">
        <Grid>
          <Field label="Lead name" required>
            <input
              name="name"
              type="text"
              required
              defaultValue={i.name ?? ''}
              autoFocus={mode === 'create'}
              className="input"
              placeholder="The person you're talking to"
            />
          </Field>
          <Field label="Company / business">
            <input
              name="company"
              type="text"
              defaultValue={i.company ?? ''}
              className="input"
              placeholder="The business they run"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={i.email ?? ''}
              className="input"
              placeholder="name@business.com"
            />
          </Field>
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              defaultValue={i.phone ?? ''}
              className="input"
              placeholder="(555) 123-4567"
            />
          </Field>
        </Grid>
      </Section>

      {/* ─── 2. Business profile ─────────────────────────────────────── */}
      <Section title="About the business" eyebrow="Profile">
        <Grid>
          <Field label="Business type">
            <input
              name="business_type"
              type="text"
              list="business-type-options"
              defaultValue={i.business_type ?? ''}
              className="input"
              placeholder="Restaurant, contractor, salon…"
            />
            <datalist id="business-type-options">
              {BUSINESS_TYPES.map(b => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Industry / niche">
            <input
              name="industry"
              type="text"
              defaultValue={i.industry ?? ''}
              className="input"
              placeholder="Optional — a finer category"
            />
          </Field>
          <Field label="City">
            <input
              name="city"
              type="text"
              defaultValue={i.city ?? ''}
              className="input"
              placeholder="Eureka Springs"
            />
          </Field>
          <Field label="State / region">
            <input
              name="region"
              type="text"
              defaultValue={i.region ?? ''}
              className="input"
              placeholder="AR"
            />
          </Field>
          <Field label="Website">
            <input
              name="website_url"
              type="url"
              defaultValue={i.website_url ?? ''}
              className="input"
              placeholder="https://"
            />
          </Field>
          <Field label="Instagram handle">
            <input
              name="instagram_handle"
              type="text"
              defaultValue={i.instagram_handle ?? ''}
              className="input"
              placeholder="@handle"
            />
          </Field>
          <Field label="Facebook URL">
            <input
              name="facebook_url"
              type="url"
              defaultValue={i.facebook_url ?? ''}
              className="input"
              placeholder="facebook.com/…"
            />
          </Field>
          <Field label="Google Business Profile URL">
            <input
              name="google_business_url"
              type="url"
              defaultValue={i.google_business_url ?? ''}
              className="input"
              placeholder="https://g.page/…"
            />
          </Field>
        </Grid>
      </Section>

      {/* ─── 3. Stakeholders ──────────────────────────────────────── */}
      <Section title="Who calls the shots" eyebrow="Stakeholders">
        <Grid>
          <Field label="Decision-maker name">
            <input
              name="decision_maker_name"
              type="text"
              defaultValue={i.decision_maker_name ?? ''}
              className="input"
              placeholder="If different from the primary contact"
            />
          </Field>
          <Field label="Their title / role">
            <input
              name="decision_maker_title"
              type="text"
              defaultValue={i.decision_maker_title ?? ''}
              className="input"
              placeholder="Owner, GM, marketing manager…"
            />
          </Field>
          <Field label="Owner (Pulse side)">
            <select
              name="owner_person_id"
              defaultValue={i.owner_person_id ?? ''}
              className="select"
            >
              <option value="">Unassigned</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referrer">
            <input
              name="referrer"
              type="text"
              defaultValue={i.referrer ?? ''}
              className="input"
              placeholder="Who pointed them at us"
            />
          </Field>
        </Grid>
      </Section>

      {/* ─── 4. Opportunity shape ─────────────────────────────────── */}
      <Section title="What they're shopping for" eyebrow="Opportunity">
        <div className="flex flex-col gap-5">
          <Field label="Services interested in" hint="Pick any that came up.">
            <div className="flex flex-wrap gap-2">
              {SERVICE_LINES.map(s => {
                const on = services.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleService(s.key)}
                    className={
                      'rounded-full border px-3 py-1 text-[13px] transition-colors duration-150 ' +
                      (on
                        ? 'border-green-deep bg-green-deep text-cream'
                        : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50')
                    }
                    aria-pressed={on}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Grid>
            <Field label="Estimated value (USD)" hint="Monthly retainer or one-time, your call.">
              <input
                name="value"
                type="text"
                inputMode="decimal"
                defaultValue={valueDollars}
                placeholder="$5,000"
                className="input tabular-nums"
              />
            </Field>
            <Field label="Budget signal" hint="What they actually said.">
              <input
                name="budget_signal"
                type="text"
                defaultValue={i.budget_signal ?? ''}
                placeholder='e.g. "around $2k/mo" or "no budget set yet"'
                className="input"
              />
            </Field>
            <Field label="Timeline / urgency">
              <input
                name="timeline"
                type="text"
                defaultValue={i.timeline ?? ''}
                placeholder='"ASAP" / "next month" / "Q3"'
                className="input"
              />
            </Field>
            <Field label="Expected close">
              <input
                name="expected_close_date"
                type="date"
                defaultValue={i.expected_close_date ?? ''}
                className="input"
              />
            </Field>
            <Field label="Heat" hint="Your gut, not a science.">
              <HeatPicker initial={i.heat ?? null} />
            </Field>
            <Field label="Source">
              <select name="source_id" defaultValue={i.source_id ?? ''} className="select">
                <option value="">No source</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </Grid>
        </div>
      </Section>

      {/* ─── 5. Discovery ─────────────────────────────────────────── */}
      <Section title="What we learned" eyebrow="Discovery">
        <div className="flex flex-col gap-5">
          <Field label="Pain points" hint="What's not working for them right now.">
            <textarea
              name="pain_points"
              rows={3}
              defaultValue={i.pain_points ?? ''}
              className="input resize-y"
              placeholder="Ex: posts get no reach, no system for replying to reviews, no time to do their own marketing"
            />
          </Field>
          <Field label="Current solution" hint="Who or what they use now.">
            <textarea
              name="current_solution"
              rows={2}
              defaultValue={i.current_solution ?? ''}
              className="input resize-y"
              placeholder="Doing it themselves / a freelancer / a different agency / nothing"
            />
          </Field>
          <Field label="Goals" hint="Where they want to be in 90 days.">
            <textarea
              name="goals"
              rows={2}
              defaultValue={i.goals ?? ''}
              className="input resize-y"
              placeholder="More foot traffic, fill the catering pipeline, hire a second location, etc."
            />
          </Field>
          <Field label="Tags" hint="Comma-separated. Free-form labels.">
            <input
              name="tags"
              type="text"
              defaultValue={(i.tags ?? []).join(', ')}
              className="input"
              placeholder="vip, local-favorite, slow-decision"
            />
          </Field>
          <Field label="Free-form notes" hint="Anything else.">
            <textarea
              name="notes"
              rows={4}
              defaultValue={i.notes ?? ''}
              className="input resize-y"
              placeholder="Future-you's brain dump."
            />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-md border border-stone-200 bg-white/95 px-4 py-3 shadow-[0_2px_6px_rgb(0_0_0_/0.06)] backdrop-blur">
        <a href={cancelHref} className="btn-ghost">
          Cancel
        </a>
        <SubmitButton mode={mode} />
      </div>
    </form>
  );
}

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? <Loader2 size={14} className="spin-slow" /> : <Save size={14} />}
      {pending ? 'Saving…' : mode === 'create' ? 'Create lead' : 'Save changes'}
    </button>
  );
}

function HeatPicker({ initial }: { initial: LeadHeat | null }) {
  const [val, setVal] = useState<LeadHeat | ''>(initial ?? '');
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name="heat" value={val} />
      {LEAD_HEATS.map(h => {
        const on = val === h;
        const tone =
          h === 'hot'
            ? on
              ? 'border-bad bg-bad text-cream'
              : 'border-bad/40 bg-bad/5 text-bad hover:bg-bad/10'
            : h === 'warm'
              ? on
                ? 'border-amber-deep bg-amber-deep text-cream'
                : 'border-amber-deep/40 bg-amber/10 text-amber-deep hover:bg-amber/20'
              : on
                ? 'border-stone-700 bg-stone-700 text-cream'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50';
        return (
          <button
            key={h}
            type="button"
            onClick={() => setVal(val === h ? '' : h)}
            className={'rounded-full border px-3 py-1 text-[13px] uppercase tracking-wide transition-colors duration-150 ' + tone}
            aria-pressed={on}
          >
            {h}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
          {eyebrow}
        </span>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
          {title}
        </h2>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0_/0.04)]">
        {children}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600">
        {label}
        {required && <span className="ml-1 text-bad">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
    </label>
  );
}
