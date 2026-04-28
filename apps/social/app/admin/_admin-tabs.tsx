'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  CADENCE_LABEL,
  EXTENDED_ROLES,
  EXTENDED_ROLE_LABEL,
  type ExpectationCadence,
  type ExpectationCompletion,
  type ExtendedRole,
  type Person,
  type RecurringExpectation,
} from '@/lib/types';
import {
  deleteRecurringExpectation,
  markExpectationComplete,
  unmarkExpectationComplete,
  upsertPerson,
  upsertRecurringExpectation,
} from '@/lib/actions';
import { cn } from '@/lib/utils';
import { computePeriodKey, computeDueDate } from '@/lib/action-engine';

const CELL =
  'w-full rounded-md border border-transparent bg-transparent px-2.5 py-2 text-sm text-charcoal placeholder:text-charcoal/40 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none focus:ring-2 focus:ring-amber-mid/25';
const PANEL_FIELD =
  'w-full rounded-md border border-cream-dk bg-white px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25';

const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#d9c4ac', label: 'cream-dk' },
  { value: '#e89e50', label: 'amber-mid' },
  { value: '#c96f1f', label: 'amber-deep' },
  { value: '#af764b', label: 'rust-200' },
  { value: '#4d6d4f', label: 'green-mid' },
  { value: '#27452b', label: 'green-deep' },
];

type Tab = 'people' | 'expectations';

export function AdminTabs({
  initialTab,
  people,
  expectations,
  completions,
}: {
  initialTab: Tab;
  people: Person[];
  expectations: RecurringExpectation[];
  completions: ExpectationCompletion[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="space-y-6">
      <nav className="flex gap-2 border-b border-cream-dk/60">
        <TabButton active={tab === 'people'} onClick={() => setTab('people')}>
          <Users size={14} />
          People & roles
        </TabButton>
        <TabButton active={tab === 'expectations'} onClick={() => setTab('expectations')}>
          <CalendarClock size={14} />
          Recurring expectations
        </TabButton>
      </nav>
      {tab === 'people' ? (
        <PeoplePanel people={people} />
      ) : (
        <ExpectationsPanel
          expectations={expectations}
          completions={completions}
          people={people}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs uppercase tracking-label transition-colors duration-fast',
        active
          ? 'border-green-deep text-green-deep'
          : 'border-transparent text-charcoal/55 hover:text-charcoal'
      )}
    >
      {children}
    </button>
  );
}

// ─── People & roles ────────────────────────────────────────────────────────

function PeoplePanel({ people }: { people: Person[] }) {
  const router = useRouter();
  const [, start] = useTransition();

  const patch = (id: string, p: Record<string, unknown>) =>
    start(async () => {
      await upsertPerson({ id, patch: p });
      router.refresh();
    });

  const add = () =>
    start(async () => {
      await upsertPerson({
        patch: {
          name: 'New teammate',
          role: 'field',
          roles: ['field'],
          responsibilities: [],
          color: PALETTE[0].value,
          archived: false,
        },
      });
      router.refresh();
    });

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-dk/60 px-7 py-5">
        <div>
          <div className="eyebrow">Team</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-green-deep">
            Who does <span className="italic text-amber-deep">what</span>
          </h2>
          <p className="mt-1.5 text-sm italic text-charcoal/65">
            One person can wear multiple hats. Free-form responsibilities for
            everything that doesn't map to a named role.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
        >
          <Plus size={13} />
          Add person
        </button>
      </div>
      <div className="divide-y divide-cream-dk/50">
        {people.length === 0 ? (
          <div className="px-7 py-16 text-center text-sm italic text-charcoal/55">
            No people yet. Click <strong className="text-green-deep not-italic">+ Add person</strong>.
          </div>
        ) : (
          people.map(p => <PersonRow key={p.id} person={p} onPatch={pp => patch(p.id, pp)} />)
        )}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  onPatch,
}: {
  person: Person;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const roles = (person.roles && person.roles.length > 0
    ? person.roles
    : [person.role]) as string[];
  const responsibilities = person.responsibilities ?? [];
  const [respDraft, setRespDraft] = useState('');

  const toggleRole = (r: ExtendedRole) => {
    const next = roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r];
    onPatch({ roles: next });
  };

  const removeResponsibility = (r: string) => {
    onPatch({ responsibilities: responsibilities.filter(x => x !== r) });
  };

  const addResponsibility = () => {
    const v = respDraft.trim().toLowerCase();
    if (!v || responsibilities.includes(v)) return;
    setRespDraft('');
    onPatch({ responsibilities: [...responsibilities, v] });
  };

  return (
    <div className={cn('grid gap-5 px-7 py-5 lg:grid-cols-[260px,1fr,180px]', person.archived && 'opacity-55')}>
      {/* Identity */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-cream-lt"
            style={{ backgroundColor: person.color }}
          />
          <input
            className={CELL + ' font-display italic'}
            defaultValue={person.name}
            onBlur={e => e.target.value !== person.name && onPatch({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PALETTE.map(swatch => {
            const active = swatch.value.toLowerCase() === person.color.toLowerCase();
            return (
              <button
                key={swatch.value}
                type="button"
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => onPatch({ color: swatch.value })}
                className={cn(
                  'h-5 w-5 rounded-full transition-transform duration-fast ease-pulse',
                  active
                    ? 'ring-2 ring-green-deep ring-offset-2 ring-offset-white scale-110'
                    : 'ring-1 ring-cream-dk hover:scale-110'
                )}
                style={{ backgroundColor: swatch.value }}
              />
            );
          })}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-charcoal/65">
          <input
            type="checkbox"
            defaultChecked={person.archived}
            className="h-4 w-4 rounded border-cream-dk text-green-deep focus:ring-amber-mid/40"
            onChange={e => onPatch({ archived: e.target.checked })}
          />
          <span className="uppercase tracking-eyebrow text-[10px]">
            {person.archived ? 'Archived' : 'Active'}
          </span>
        </label>
      </div>

      {/* Roles + responsibilities */}
      <div className="space-y-4">
        <div>
          <div className="eyebrow">Hats</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXTENDED_ROLES.map(r => {
              const on = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-label transition-colors duration-fast',
                    on
                      ? 'border-green-deep bg-green-deep text-cream'
                      : 'border-cream-dk bg-white text-charcoal/65 hover:border-amber-mid hover:text-charcoal'
                  )}
                >
                  {EXTENDED_ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="eyebrow">Responsibilities</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {responsibilities.map(r => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-md border border-amber-mid/40 bg-amber-light/30 px-2 py-1 text-[11px] text-amber-deep"
              >
                {r}
                <button
                  type="button"
                  onClick={() => removeResponsibility(r)}
                  className="text-amber-deep/55 hover:text-bad"
                  aria-label={`Remove ${r}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={respDraft}
              onChange={e => setRespDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addResponsibility();
                }
              }}
              placeholder="e.g. photographer, drone, social_media"
              className="flex-1 min-w-[180px] rounded-md border border-cream-dk bg-white px-2 py-1 text-xs placeholder:text-charcoal/40 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25"
            />
            {respDraft.trim() ? (
              <button
                type="button"
                onClick={addResponsibility}
                className="rounded-md bg-amber-deep px-2 py-1 text-[10px] uppercase tracking-eyebrow text-cream-lt hover:bg-charcoal"
              >
                Add
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Single-role legacy field — keep editable as the canonical for routing */}
      <div>
        <div className="eyebrow">Primary role</div>
        <select
          className={PANEL_FIELD + ' mt-2'}
          defaultValue={person.role}
          onChange={e => onPatch({ role: e.target.value })}
          title="Used for notification audience routing (existing enum)."
        >
          <option value="field">Field</option>
          <option value="strategy">Strategy</option>
          <option value="producer">Producer</option>
          <option value="editor">Editor</option>
          <option value="approver">Approver</option>
        </select>
        <p className="mt-1.5 text-[10px] uppercase tracking-eyebrow text-charcoal/45">
          Used for role-based audience filters.
        </p>
      </div>
    </div>
  );
}

// ─── Recurring expectations ────────────────────────────────────────────────

function ExpectationsPanel({
  expectations,
  completions,
  people,
}: {
  expectations: RecurringExpectation[];
  completions: ExpectationCompletion[];
  people: Person[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const today = new Date();
  const completionsByExp = new Map<string, ExpectationCompletion[]>();
  for (const c of completions) {
    const arr = completionsByExp.get(c.expectation_id) ?? [];
    arr.push(c);
    completionsByExp.set(c.expectation_id, arr);
  }

  const add = () =>
    start(async () => {
      await upsertRecurringExpectation({
        patch: {
          title: 'New standard',
          cadence: 'monthly',
          due_rule: 'eom',
          warn_days: 7,
          severity_warn: 'warn',
          severity_overdue: 'bad',
          active: true,
        },
      });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm italic text-charcoal/65">
          Each row is an SOP-grade standard with a known cadence. The action
          engine surfaces it before the deadline and escalates if the period
          ends without a completion. Mark complete to silence the alert for
          this period.
        </p>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
        >
          <Plus size={13} />
          Add expectation
        </button>
      </div>

      {expectations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-dk px-7 py-16 text-center text-sm italic text-charcoal/55">
          No expectations yet. Click <strong className="text-green-deep not-italic">+ Add expectation</strong> to define one.
        </div>
      ) : (
        <div className="space-y-3">
          {expectations.map(exp => (
            <ExpectationCard
              key={exp.id}
              expectation={exp}
              completions={completionsByExp.get(exp.id) ?? []}
              people={people}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpectationCard({
  expectation: e,
  completions,
  people,
  today,
}: {
  expectation: RecurringExpectation;
  completions: ExpectationCompletion[];
  people: Person[];
  today: Date;
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const patch = (p: Record<string, unknown>) =>
    start(async () => {
      await upsertRecurringExpectation({ id: e.id, patch: p });
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`Delete "${e.title}"? Completion history goes with it.`)) return;
      await deleteRecurringExpectation(e.id);
      router.refresh();
    });

  const periodKey = computePeriodKey(today, e.cadence);
  const dueDate = computeDueDate(today, e.cadence, e.due_rule);
  const completedThisPeriod = completions.find(c => c.period_key === periodKey);

  const markComplete = () =>
    start(async () => {
      await markExpectationComplete({
        expectation_id: e.id,
        period_key: periodKey,
      });
      router.refresh();
    });

  const undoComplete = () =>
    start(async () => {
      await unmarkExpectationComplete({
        expectation_id: e.id,
        period_key: periodKey,
      });
      router.refresh();
    });

  return (
    <article
      className={cn(
        'rounded-2xl border bg-white p-6 shadow-card transition-colors duration-fast',
        e.active ? 'border-cream-dk/60' : 'border-cream-dk/40 opacity-60'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[280px] space-y-2">
          <input
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 font-display text-xl font-bold text-green-deep placeholder:text-charcoal/40 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none"
            defaultValue={e.title}
            onBlur={ev => ev.target.value !== e.title && patch({ title: ev.target.value })}
          />
          <textarea
            rows={2}
            className={CELL + ' resize-y leading-snug text-charcoal/85'}
            defaultValue={e.description ?? ''}
            placeholder="Brief description of what done means."
            onBlur={ev => ev.target.value !== (e.description ?? '') && patch({ description: ev.target.value || null })}
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          <PeriodBadge dueDate={dueDate} today={today} completedThisPeriod={!!completedThisPeriod} />
          {completedThisPeriod ? (
            <button
              type="button"
              onClick={undoComplete}
              className="inline-flex items-center gap-1.5 rounded-md border border-green-deep/30 bg-cream-lt px-3 py-1.5 text-[10px] uppercase tracking-eyebrow text-green-deep hover:bg-green-deep hover:text-cream"
            >
              Undo {periodKey}
            </button>
          ) : (
            <button
              type="button"
              onClick={markComplete}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3 py-1.5 text-[10px] uppercase tracking-eyebrow text-cream hover:bg-charcoal"
            >
              <CheckCircle2 size={12} />
              Mark {periodKey} done
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Cadence">
          <select
            className={PANEL_FIELD}
            defaultValue={e.cadence}
            onChange={ev => patch({ cadence: ev.target.value })}
          >
            {(['daily', 'weekly', 'monthly', 'quarterly'] as ExpectationCadence[]).map(c => (
              <option key={c} value={c}>
                {CADENCE_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due rule">
          <input
            type="text"
            className={PANEL_FIELD}
            defaultValue={e.due_rule ?? ''}
            placeholder={dueRulePlaceholder(e.cadence)}
            onBlur={ev => patch({ due_rule: ev.target.value || null })}
          />
        </Field>
        <Field label="Warn days before">
          <input
            type="number"
            min={0}
            max={60}
            className={PANEL_FIELD + ' tabular-nums'}
            defaultValue={e.warn_days}
            onBlur={ev => patch({ warn_days: Math.max(0, Number(ev.target.value) || 0) })}
          />
        </Field>
        <Field label="Owner">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              className={PANEL_FIELD}
              defaultValue={e.owner_role ?? ''}
              placeholder="role (e.g. producer, founder)"
              onBlur={ev => patch({ owner_role: ev.target.value || null })}
            />
            <select
              className={PANEL_FIELD}
              defaultValue={e.owner_person_id ?? ''}
              onChange={ev => patch({ owner_person_id: ev.target.value || null })}
            >
              <option value="">— No specific person —</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cream-dk/50 pt-3 text-[11px] uppercase tracking-eyebrow text-charcoal/55">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={e.active}
            className="h-4 w-4 rounded border-cream-dk text-green-deep focus:ring-amber-mid/40"
            onChange={ev => patch({ active: ev.target.checked })}
          />
          {e.active ? 'Active' : 'Inactive'}
        </label>
        {completions.length > 0 ? (
          <span className="text-charcoal/45">
            Completed periods: {completions.slice(0, 4).map(c => c.period_key).join(', ')}
            {completions.length > 4 ? ` … +${completions.length - 4}` : ''}
          </span>
        ) : null}
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-1 text-bad hover:text-bad/80"
        >
          <Trash2 size={11} />
          Delete
        </button>
      </div>
    </article>
  );
}

function PeriodBadge({
  dueDate,
  today,
  completedThisPeriod,
}: {
  dueDate: Date | null;
  today: Date;
  completedThisPeriod: boolean;
}) {
  if (!dueDate) {
    return (
      <span className="rounded-md border border-cream-dk px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
        Set a due rule
      </span>
    );
  }
  const days = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  if (completedThisPeriod) {
    return (
      <span className="rounded-md border border-green-deep/40 bg-green-light/20 px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-green-deep">
        Done · this period
      </span>
    );
  }
  if (days < 0) {
    return (
      <span className="rounded-md border border-bad/40 bg-bad/10 px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-bad">
        Overdue {Math.abs(days)}d · {format(dueDate, 'MMM d')}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded-md border border-amber-mid/40 bg-amber-light/30 px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-amber-deep">
        Due today
      </span>
    );
  }
  return (
    <span className="rounded-md border border-cream-dk px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-charcoal/65">
      Due in {days}d · {format(dueDate, 'MMM d')}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-eyebrow text-charcoal/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function dueRulePlaceholder(c: ExpectationCadence): string {
  if (c === 'monthly') return 'eom or d25';
  if (c === 'weekly') return 'monday | tuesday | …';
  if (c === 'quarterly') return 'eoq';
  return '(none — fires daily)';
}
