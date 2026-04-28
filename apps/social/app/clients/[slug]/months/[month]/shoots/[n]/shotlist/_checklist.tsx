'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, Wand2, X } from 'lucide-react';
import {
  addCaptureItem,
  deleteCaptureItem,
  seedCaptureItemsFromTemplate,
  updateCaptureItem,
} from '@/lib/actions';
import type { CaptureItem, Post } from '@/lib/types';
import { CONTENT_TYPE_LABEL } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CaptureChecklist({
  clientSlug,
  monthSlug,
  shootId,
  bundleNumber,
  templateText,
  items,
  linkedPosts,
}: {
  clientSlug: string;
  monthSlug: string;
  shootId: string;
  bundleNumber: number;
  templateText: string | null;
  items: CaptureItem[];
  linkedPosts: Post[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [extraText, setExtraText] = useState('');
  const [extraLink, setExtraLink] = useState<string>('');

  const required = items.filter(i => i.is_required);
  const extras = items.filter(i => !i.is_required);

  const requiredCaptured = required.filter(i => i.is_captured).length;
  const extrasCaptured = extras.filter(i => i.is_captured).length;

  const seed = () =>
    start(async () => {
      await seedCaptureItemsFromTemplate({
        shoot_id: shootId,
        client_slug: clientSlug,
        month_slug: monthSlug,
      });
      router.refresh();
    });

  const toggle = (id: string, captured: boolean) =>
    start(async () => {
      await updateCaptureItem({
        id,
        client_slug: clientSlug,
        month_slug: monthSlug,
        patch: { is_captured: captured },
      });
      router.refresh();
    });

  const link = (id: string, postId: string | null) =>
    start(async () => {
      await updateCaptureItem({
        id,
        client_slug: clientSlug,
        month_slug: monthSlug,
        patch: { linked_post_id: postId },
      });
      router.refresh();
    });

  const editLabel = (id: string, label: string) =>
    start(async () => {
      await updateCaptureItem({
        id,
        client_slug: clientSlug,
        month_slug: monthSlug,
        patch: { label },
      });
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      await deleteCaptureItem({ id, client_slug: clientSlug, month_slug: monthSlug });
      router.refresh();
    });

  const addExtra = () => {
    const label = extraText.trim();
    if (!label) return;
    start(async () => {
      await addCaptureItem({
        shoot_id: shootId,
        client_slug: clientSlug,
        month_slug: monthSlug,
        label,
        is_required: false,
        linked_post_id: extraLink || null,
      });
      setExtraText('');
      setExtraLink('');
      router.refresh();
    });
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-cream-dk/60 pb-3">
        <div className="flex items-end gap-3">
          <span className="font-display text-sm font-bold tabular-nums text-charcoal/45">
            01
          </span>
          <h2 className="font-display text-2xl font-bold text-green-deep">
            Capture <span className="italic text-amber-deep">checklist</span>
          </h2>
        </div>
        <p className="hidden max-w-sm text-right text-xs italic text-charcoal/65 md:block">
          The required list keeps the social plan covered. Extras are yours to capture
          freely on site.
        </p>
      </div>

      {/* REQUIRED — drives the social plan */}
      <div className="rounded-2xl border border-green-deep/15 bg-cream-lt p-5 no-print:shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="eyebrow green">Required · drives the plan</div>
            <p className="mt-1.5 text-sm font-display italic text-green-deep">
              Lock these in first. Everything else is bonus.
            </p>
          </div>
          {required.length > 0 ? (
            <span className="rounded-full bg-green-deep px-3 py-1 text-[10px] font-semibold uppercase tracking-eyebrow text-cream tabular-nums">
              {requiredCaptured} / {required.length}
            </span>
          ) : null}
        </header>

        {required.length === 0 ? (
          <div className="rounded-lg border border-dashed border-green-deep/30 bg-white p-6 text-center">
            {templateText ? (
              <>
                <p className="text-sm text-charcoal/65">
                  This shoot has a template capture list but the checklist isn't seeded yet.
                </p>
                <button
                  type="button"
                  onClick={seed}
                  className="no-print mt-3 inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
                >
                  <Wand2 size={13} />
                  Seed from template
                </button>
              </>
            ) : (
              <p className="text-sm italic text-charcoal/55">
                Pick a shoot type on the planning page to populate the required list.
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {required.map(it => (
              <ChecklistRow
                key={it.id}
                item={it}
                linkedPosts={linkedPosts}
                onToggle={c => toggle(it.id, c)}
                onLink={pid => link(it.id, pid)}
                onEditLabel={l => editLabel(it.id, l)}
                onDelete={() => remove(it.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* EXTRAS — bonus content & on-site pivots */}
      <div className="mt-6 rounded-2xl border border-amber-mid/30 bg-amber-light/15 p-5 no-print:shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="eyebrow">Extras · bonus & pivots</div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-display italic text-amber-deep">
              <Sparkles size={14} />
              Anything you capture beyond the plan. Add freely.
            </p>
          </div>
          {extras.length > 0 ? (
            <span className="rounded-full bg-amber-mid px-3 py-1 text-[10px] font-semibold uppercase tracking-eyebrow text-green-deep tabular-nums">
              {extrasCaptured} / {extras.length}
            </span>
          ) : null}
        </header>

        {extras.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {extras.map(it => (
              <ChecklistRow
                key={it.id}
                item={it}
                linkedPosts={linkedPosts}
                onToggle={c => toggle(it.id, c)}
                onLink={pid => link(it.id, pid)}
                onEditLabel={l => editLabel(it.id, l)}
                onDelete={() => remove(it.id)}
                accent="amber"
              />
            ))}
          </ul>
        ) : null}

        {/* Add extra */}
        <div className="no-print rounded-lg border border-dashed border-amber-mid/50 bg-white p-3.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
            <input
              type="text"
              value={extraText}
              onChange={e => setExtraText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addExtra())}
              className="min-w-[200px] flex-1 rounded-md border border-cream-dk bg-white px-3 py-3 text-base placeholder:text-charcoal/40 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25 md:py-2 md:text-sm"
              placeholder="What did you capture? (e.g. unscripted owner soundbite)"
            />
            <select
              value={extraLink}
              onChange={e => setExtraLink(e.target.value)}
              className="rounded-md border border-cream-dk bg-white px-3 py-3 text-base focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25 md:py-2 md:text-sm"
            >
              <option value="">Link to post… (optional)</option>
              {linkedPosts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.post_date} · {CONTENT_TYPE_LABEL[p.content_type]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addExtra}
              disabled={!extraText.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-deep px-3.5 py-3 text-sm uppercase tracking-label text-cream-lt hover:bg-charcoal disabled:opacity-40 md:py-2 md:text-xs"
            >
              <Plus size={13} />
              Add extra
            </button>
          </div>
          <p className="mt-2 text-[11px] italic text-charcoal/55">
            Pivots and bonus shots live here. They never block the required list.
          </p>
        </div>
      </div>
    </section>
  );
}

function ChecklistRow({
  item,
  linkedPosts,
  onToggle,
  onLink,
  onEditLabel,
  onDelete,
  accent = 'green',
}: {
  item: CaptureItem;
  linkedPosts: Post[];
  onToggle: (captured: boolean) => void;
  onLink: (postId: string | null) => void;
  onEditLabel: (label: string) => void;
  onDelete: () => void;
  accent?: 'green' | 'amber';
}) {
  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-white p-3.5 transition-colors duration-fast',
        item.is_captured
          ? accent === 'amber'
            ? 'border-amber-mid/50 bg-amber-light/30'
            : 'border-green-light/50 bg-green-light/10'
          : 'border-cream-dk/70'
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!item.is_captured)}
        aria-label={item.is_captured ? 'Mark not captured' : 'Mark captured'}
        className={cn(
          'no-print mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border-2 transition-colors duration-fast md:h-7 md:w-7',
          item.is_captured
            ? accent === 'amber'
              ? 'border-amber-deep bg-amber-deep text-cream-lt'
              : 'border-green-deep bg-green-deep text-cream'
            : 'border-cream-dk hover:border-green-deep'
        )}
      >
        {item.is_captured ? (
          <svg width="18" height="18" viewBox="0 0 14 14" className="md:h-3.5 md:w-3.5">
            <path
              d="M3 7.5L5.5 10L11 4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>

      {/* Print fallback box */}
      <span className="hidden h-5 w-5 rounded border border-charcoal print:inline-block" />

      <div className="flex-1 min-w-0">
        <input
          type="text"
          defaultValue={item.label}
          onBlur={e => {
            const v = e.target.value.trim();
            if (v && v !== item.label) onEditLabel(v);
          }}
          className={cn(
            'no-print w-full bg-transparent text-sm leading-snug text-charcoal placeholder:text-charcoal/40 focus:outline-none',
            item.is_captured && 'line-through decoration-charcoal/30'
          )}
        />
        <span
          className={cn(
            'hidden text-base leading-body text-charcoal print:inline',
            item.is_captured && 'line-through'
          )}
        >
          {item.label}
        </span>

        {linkedPosts.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-charcoal/55">
            <span className="uppercase tracking-eyebrow">Links to</span>
            <select
              value={item.linked_post_id ?? ''}
              onChange={e => onLink(e.target.value || null)}
              className="no-print rounded-md border border-cream-dk bg-white px-2 py-1 text-[11px] focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25"
            >
              <option value="">— No post —</option>
              {linkedPosts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.post_date} · {CONTENT_TYPE_LABEL[p.content_type]}
                </option>
              ))}
            </select>
            <span className="hidden print:inline">
              {item.linked_post_id
                ? linkedPosts.find(p => p.id === item.linked_post_id)?.post_date ?? ''
                : '— No post —'}
            </span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="no-print grid h-7 w-7 shrink-0 place-items-center rounded-md text-charcoal/45 opacity-0 hover:bg-bad/10 hover:text-bad group-hover:opacity-100"
        aria-label="Delete item"
        title="Delete"
      >
        <X size={13} />
      </button>
    </li>
  );
}
