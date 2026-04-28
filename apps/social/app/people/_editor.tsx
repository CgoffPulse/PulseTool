'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  PERSON_ROLE_LABEL,
  type Person,
  type PersonRole,
} from '@/lib/types';
import { upsertPerson } from '@/lib/actions';
import { cn } from '@/lib/utils';

const CELL =
  'w-full rounded-md border border-transparent bg-transparent px-2.5 py-2 text-sm text-charcoal placeholder:text-charcoal/40 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none focus:ring-2 focus:ring-amber-mid/25';

const ROLE_OPTIONS: PersonRole[] = ['field', 'strategy', 'producer', 'editor', 'approver'];

/** Six-swatch palette pulled from the Pulse tokens. */
const PALETTE: Array<{ value: string; label: string }> = [
  { value: '#d9c4ac', label: 'cream-dk' },
  { value: '#e89e50', label: 'amber-mid' },
  { value: '#c96f1f', label: 'amber-deep' },
  { value: '#af764b', label: 'rust-200' },
  { value: '#4d6d4f', label: 'green-mid' },
  { value: '#27452b', label: 'green-deep' },
];

export function PeopleEditor({ initial }: { initial: Person[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const list = initial;

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
          color: PALETTE[0].value,
          archived: false,
        },
      });
      router.refresh();
    });

  const activeCount = list.filter(p => !p.archived).length;
  const archivedCount = list.length - activeCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-dk/60 px-7 py-5">
        <div>
          <div className="eyebrow">Records</div>
          <div className="mt-2 font-display text-2xl font-bold text-green-deep">
            <span className="tabular-nums">{activeCount}</span>{' '}
            <span className="italic text-amber-deep">active</span>
            {archivedCount > 0 ? (
              <span className="ml-3 text-sm font-normal text-charcoal/55">
                · <span className="tabular-nums">{archivedCount}</span> archived
              </span>
            ) : null}
          </div>
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
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-dk/60 bg-cream-lt/60 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
              <th className="px-5 py-3 text-left font-semibold">Name</th>
              <th className="px-3 py-3 text-left font-semibold">Role</th>
              <th className="px-3 py-3 text-left font-semibold">Color</th>
              <th className="px-3 py-3 text-left font-semibold">Archived</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-dk/40">
            {list.map(p => (
              <tr
                key={p.id}
                className={cn(
                  'group hover:bg-cream-lt/50',
                  p.archived && 'opacity-60'
                )}
              >
                <td className="px-4 py-2.5 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-cream-lt"
                      style={{ backgroundColor: p.color }}
                    />
                    <input
                      className={CELL + ' font-display italic'}
                      defaultValue={p.name}
                      onBlur={e =>
                        e.target.value !== p.name &&
                        patch(p.id, { name: e.target.value })
                      }
                    />
                  </div>
                </td>
                <td className="px-2 py-2.5 min-w-[160px]">
                  <select
                    className={CELL}
                    defaultValue={p.role}
                    onChange={e => patch(p.id, { role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>
                        {PERSON_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5 min-w-[220px]">
                  <ColorSwatches
                    value={p.color}
                    onChange={c => patch(p.id, { color: c })}
                  />
                </td>
                <td className="px-3 py-2.5 min-w-[140px]">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-charcoal/65">
                    <input
                      type="checkbox"
                      defaultChecked={p.archived}
                      className="h-4 w-4 rounded border-cream-dk text-green-deep focus:ring-amber-mid/40"
                      onChange={e => patch(p.id, { archived: e.target.checked })}
                    />
                    <span className="uppercase tracking-eyebrow text-[10px]">
                      {p.archived ? 'Archived' : 'Active'}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-16 text-center text-sm italic text-charcoal/55"
                >
                  No people yet. Click{' '}
                  <strong className="text-green-deep not-italic">+ Add person</strong>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PALETTE.map(swatch => {
        const active = swatch.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={swatch.value}
            type="button"
            aria-label={swatch.label}
            title={swatch.label}
            onClick={() => onChange(swatch.value)}
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full transition-transform duration-fast ease-pulse',
              active
                ? 'ring-2 ring-green-deep ring-offset-2 ring-offset-white scale-110'
                : 'ring-1 ring-cream-dk hover:scale-110'
            )}
            style={{ backgroundColor: swatch.value }}
          >
            {active ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M2.5 6.5L5 9L9.5 3.5"
                  stroke={swatch.value === '#27452b' || swatch.value === '#4d6d4f' || swatch.value === '#af764b' || swatch.value === '#c96f1f' ? '#f4ede4' : '#27452b'}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
