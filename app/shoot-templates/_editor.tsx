'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { ShootTemplate } from '@/lib/types';
import { deleteShootTemplate, upsertShootTemplate } from '@/lib/actions';

const FIELD =
  'w-full rounded-md border border-cream-dk bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25';
const NUM =
  'w-full rounded-md border border-cream-dk bg-cream-lt px-2 py-1.5 text-center font-display text-lg font-bold tabular-nums text-green-deep focus:border-amber-mid focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-mid/25';

export function ShootTemplatesEditor({ initial }: { initial: ShootTemplate[] }) {
  const router = useRouter();
  const [, start] = useTransition();

  const patch = (id: string, p: Record<string, any>) =>
    start(async () => {
      await upsertShootTemplate({ id, patch: p });
      router.refresh();
    });

  const add = () =>
    start(async () => {
      await upsertShootTemplate({
        patch: { name: 'New shoot type', client_scope: 'either' },
      });
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      await deleteShootTemplate(id);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-eyebrow text-charcoal/55">
          {initial.length} templates
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
        >
          <Plus size={13} />
          Add type
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {initial.map(t => (
          <article
            key={t.id}
            className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white p-7 shadow-card"
          >
            <div className="grid grid-cols-[1fr,auto] items-start gap-4">
              <div className="space-y-3">
                <input
                  className={FIELD + ' font-display text-xl font-bold text-green-deep'}
                  defaultValue={t.name}
                  onBlur={e =>
                    e.target.value !== t.name && patch(t.id, { name: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={FIELD}
                    defaultValue={t.duration ?? ''}
                    placeholder="Duration"
                    onBlur={e =>
                      e.target.value !== (t.duration ?? '') &&
                      patch(t.id, { duration: e.target.value || null })
                    }
                  />
                  <select
                    className={FIELD}
                    defaultValue={t.client_scope}
                    onChange={e => patch(t.id, { client_scope: e.target.value })}
                  >
                    <option value="either">Either client</option>
                    <option value="onsc">ONSC only</option>
                    <option value="el_pueblito">El Pueblito only</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="grid h-9 w-9 place-items-center rounded-md border border-cream-dk text-charcoal/55 transition-colors duration-fast hover:border-bad hover:text-bad"
                aria-label="Delete shoot type"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                Required capture list (one item per line)
              </span>
              <textarea
                className={FIELD}
                rows={6}
                defaultValue={t.required_capture_list ?? ''}
                placeholder="1× hero photo, 1× B-roll, ..."
                onBlur={e =>
                  e.target.value !== (t.required_capture_list ?? '') &&
                  patch(t.id, { required_capture_list: e.target.value || null })
                }
              />
            </label>

            <div className="mt-5">
              <div className="mb-3 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                Capacity per shoot
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {(['reels', 'photos', 'carousels', 'stories', 'videos', 'graphics'] as const).map(
                  k => (
                    <label
                      key={k}
                      className="flex flex-col items-center gap-1.5 rounded-md border border-cream-dk/60 bg-cream-lt px-2 py-2.5"
                    >
                      <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/60">
                        {k}
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={NUM + ' border-transparent bg-transparent shadow-none'}
                        defaultValue={(t as any)[`produces_${k}`] ?? 0}
                        onBlur={e => {
                          const v = Number(e.target.value);
                          if (Number.isFinite(v)) patch(t.id, { [`produces_${k}`]: v });
                        }}
                      />
                    </label>
                  )
                )}
              </div>
            </div>
          </article>
        ))}
        {initial.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-green-deep/25 bg-cream-lt p-12 text-center text-sm italic text-charcoal/55">
            No shoot templates yet. Click{' '}
            <strong className="text-green-deep not-italic">+ Add type</strong>.
          </div>
        ) : null}
      </div>
    </div>
  );
}
