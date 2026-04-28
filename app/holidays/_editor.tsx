'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { Client, Holiday } from '@/lib/types';
import { deleteHoliday, upsertHoliday } from '@/lib/actions';

const CELL =
  'w-full rounded-md border border-transparent bg-transparent px-2.5 py-2 text-sm text-charcoal placeholder:text-charcoal/40 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none focus:ring-2 focus:ring-amber-mid/25';

export function HolidaysEditor({
  initial,
  clients,
}: {
  initial: Holiday[];
  clients: Client[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const list = initial;

  const patch = (id: string, p: Record<string, any>) =>
    start(async () => {
      await upsertHoliday({ id, patch: p });
      router.refresh();
    });

  const add = () =>
    start(async () => {
      await upsertHoliday({
        patch: { date_label: 'New', event: 'Untitled', client_fit: 'both' },
      });
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      await deleteHoliday(id);
      router.refresh();
    });

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-cream-dk/60 px-7 py-5">
        <div>
          <div className="eyebrow">Records</div>
          <div className="mt-2 font-display text-2xl font-bold text-green-deep">
            {list.length} <span className="italic text-amber-deep">dates</span>
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
        >
          <Plus size={13} />
          Add date
        </button>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-dk/60 bg-cream-lt/60 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
              <th className="px-5 py-3 text-left font-semibold">Date</th>
              <th className="px-3 py-3 text-left font-semibold">Event</th>
              <th className="px-3 py-3 text-left font-semibold">Client fit</th>
              <th className="px-3 py-3 text-left font-semibold">Content angle</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-dk/40">
            {list.map(h => (
              <tr key={h.id} className="group hover:bg-cream-lt/50">
                <td className="px-4 py-2.5 min-w-[140px]">
                  <input
                    className={CELL + ' tabular-nums font-medium text-green-deep'}
                    defaultValue={h.date_label}
                    onBlur={e =>
                      e.target.value !== h.date_label &&
                      patch(h.id, { date_label: e.target.value })
                    }
                  />
                </td>
                <td className="px-2 py-2.5 min-w-[200px]">
                  <input
                    className={CELL + ' font-display italic'}
                    defaultValue={h.event}
                    onBlur={e =>
                      e.target.value !== h.event &&
                      patch(h.id, { event: e.target.value })
                    }
                  />
                </td>
                <td className="px-2 py-2.5 min-w-[150px]">
                  <select
                    className={CELL}
                    defaultValue={h.client_fit}
                    onChange={e => patch(h.id, { client_fit: e.target.value })}
                  >
                    <option value="both">Both</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5">
                  <input
                    className={CELL}
                    defaultValue={h.content_angle ?? ''}
                    onBlur={e =>
                      e.target.value !== (h.content_angle ?? '') &&
                      patch(h.id, { content_angle: e.target.value || null })
                    }
                  />
                </td>
                <td className="px-3 py-2.5 text-right opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => remove(h.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-bad hover:bg-bad/10"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm italic text-charcoal/55">
                  No holidays yet. Click{' '}
                  <strong className="text-green-deep not-italic">+ Add date</strong>.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
