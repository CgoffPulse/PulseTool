'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Camera, Link2, Plus, X } from 'lucide-react';
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABEL,
  type ContentType,
  type Person,
  type Pillar,
  type Post,
  type PostStatus,
  type ShootTemplate,
  type ShootWithTemplate,
} from '@/lib/social/types';
import { StatusPipeline } from './status-pipeline';
import {
  assignShootToPerson,
  bulkAddDriveUrlsAsExtras,
  createPost,
  createShoot,
  deletePost,
  updatePost,
  updateShoot,
} from '@/lib/social/actions';
import { AiCaptionHelper } from './ai-caption-helper';
import { cn } from '@/lib/social/utils';

const CELL =
  'w-full rounded-md border border-transparent bg-transparent px-2.5 py-2 text-sm text-charcoal placeholder:text-charcoal/35 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none focus:ring-2 focus:ring-amber-mid/20 transition-colors duration-fast';
const PANEL_FIELD =
  'w-full rounded-md border border-cream-dk bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal/35 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/20';

const TYPE_CHIP: Record<ContentType, string> = {
  reel: 'border-rust-100 bg-rust-100/15 text-rust-300',
  photo: 'border-green-light/60 bg-green-light/15 text-green-deep',
  carousel: 'border-amber-light bg-amber-light/30 text-amber-deep',
  story: 'border-green-mid/60 bg-green-mid/15 text-green-deep',
  video: 'border-rust-200 bg-rust-200/15 text-rust-300',
  graphic: 'border-amber-mid/60 bg-amber-mid/15 text-amber-deep',
};

export function PlanningGrid({
  clientSlug,
  monthSlug,
  monthId,
  posts: initialPosts,
  shoots,
  templates,
  clientId,
  people = [],
}: {
  clientSlug: string;
  monthSlug: string;
  monthId: string;
  posts: Post[];
  shoots: ShootWithTemplate[];
  templates: ShootTemplate[];
  clientId?: string | null;
  people?: Person[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [filter, setFilter] = useState<'all' | 'shoot' | 'no_shoot'>('all');

  const sortedPosts = useMemo(
    () =>
      [...initialPosts].sort(
        (a, b) =>
          a.post_date.localeCompare(b.post_date) || a.sort_index - b.sort_index
      ),
    [initialPosts]
  );

  const filtered = sortedPosts.filter(p => {
    if (filter === 'shoot') return p.shoot_id !== null;
    if (filter === 'no_shoot') return p.shoot_id === null;
    return true;
  });

  const groups: Array<{ date: string; rows: Post[] }> = [];
  for (const p of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.date === p.post_date) last.rows.push(p);
    else groups.push({ date: p.post_date, rows: [p] });
  }

  const onPatch = (id: string, patch: Partial<Post>) => {
    start(async () => {
      await updatePost({ id, client_slug: clientSlug, month_slug: monthSlug, patch });
      router.refresh();
    });
  };

  const onAddPost = () => {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    start(async () => {
      await createPost({
        month_id: monthId,
        post_date: iso,
        content_type: 'photo',
        client_slug: clientSlug,
        month_slug: monthSlug,
      });
      router.refresh();
    });
  };

  const onDelete = (id: string) => {
    start(async () => {
      await deletePost({ id, client_slug: clientSlug, month_slug: monthSlug });
      router.refresh();
    });
  };

  const onAddShoot = () => {
    const next = (shoots.reduce((max, s) => Math.max(max, s.bundle_number), 0) || 0) + 1;
    start(async () => {
      await createShoot({
        month_id: monthId,
        bundle_number: next,
        client_slug: clientSlug,
        month_slug: monthSlug,
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white shadow-card">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-cream-dk/60 px-7 py-5">
          <div>
            <div className="eyebrow">Calendar</div>
            <h2 className="mt-3 font-display text-2xl font-bold text-green-deep">
              {sortedPosts.length}{' '}
              <span className="italic text-amber-deep">planned</span> posts
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterToggle value={filter} onChange={setFilter} />
            <button
              type="button"
              onClick={onAddShoot}
              className="inline-flex items-center gap-1.5 rounded-md border border-cream-dk bg-white px-3.5 py-2 text-xs uppercase tracking-label text-charcoal hover:border-amber-mid hover:text-amber-deep"
            >
              <Camera size={13} />
              Shoot bundle
            </button>
            <button
              type="button"
              onClick={onAddPost}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-3.5 py-2 text-xs uppercase tracking-label text-cream hover:bg-charcoal"
            >
              <Plus size={13} />
              Post
            </button>
          </div>
        </header>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-dk/60 bg-cream-lt/60 text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                <th className="px-5 py-3 text-left font-semibold">Date</th>
                <th className="px-3 py-3 text-left font-semibold">Time</th>
                <th className="px-3 py-3 text-left font-semibold">Pillar</th>
                <th className="px-3 py-3 text-left font-semibold">Type</th>
                <th className="px-3 py-3 text-left font-semibold">Description / hook</th>
                <th className="px-3 py-3 text-left font-semibold">Shoot</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-sm text-charcoal/55">
                    {sortedPosts.length === 0 ? (
                      <>
                        <CalendarDays
                          size={28}
                          className="mx-auto mb-3 text-charcoal/30"
                        />
                        <p>
                          No posts yet. Click{' '}
                          <strong className="text-charcoal">+ Post</strong> to start planning.
                        </p>
                      </>
                    ) : (
                      'No posts match the current filter.'
                    )}
                  </td>
                </tr>
              ) : (
                groups.flatMap(g =>
                  g.rows.map((p, i) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      shoots={shoots}
                      onPatch={patch => onPatch(p.id, patch)}
                      onDelete={() => onDelete(p.id)}
                      showDate={i === 0}
                      clientId={clientId}
                    />
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ShootBundles
        shoots={shoots}
        templates={templates}
        clientSlug={clientSlug}
        monthSlug={monthSlug}
        posts={sortedPosts}
        people={people}
      />
    </div>
  );
}

function FilterToggle({
  value,
  onChange,
}: {
  value: 'all' | 'shoot' | 'no_shoot';
  onChange: (v: 'all' | 'shoot' | 'no_shoot') => void;
}) {
  const opts: Array<{ key: 'all' | 'shoot' | 'no_shoot'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'shoot', label: 'Shoot' },
    { key: 'no_shoot', label: 'No shoot' },
  ];
  return (
    <div className="flex rounded-md border border-cream-dk bg-cream-lt p-0.5 text-[11px] uppercase tracking-label">
      {opts.map(o => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded px-3 py-1.5 transition-colors duration-fast',
            value === o.key
              ? 'bg-green-deep text-cream'
              : 'text-charcoal/55 hover:text-charcoal'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PostRow({
  post,
  shoots,
  onPatch,
  onDelete,
  showDate,
  clientId,
}: {
  post: Post;
  shoots: ShootWithTemplate[];
  onPatch: (patch: Partial<Post>) => void;
  onDelete: () => void;
  showDate: boolean;
  clientId?: string | null;
}) {
  const [description, setDescription] = useState(post.description ?? '');
  return (
    <tr
      className={cn(
        'group border-b border-cream-dk/40 align-middle hover:bg-cream-lt/50',
        showDate && 'border-t border-t-cream-dk/80'
      )}
    >
      <td className="px-4 py-3 align-middle">
        {showDate ? (
          <DateBadge date={post.post_date} />
        ) : (
          <input
            type="date"
            className={CELL + ' tabular-nums'}
            defaultValue={post.post_date}
            onBlur={e => {
              const v = e.target.value;
              if (v && v !== post.post_date) onPatch({ post_date: v });
            }}
          />
        )}
      </td>
      <td className="px-2 py-3 align-middle min-w-[100px]">
        <input
          type="text"
          className={CELL + ' tabular-nums'}
          defaultValue={post.post_time ?? ''}
          placeholder="—"
          onBlur={e => {
            const v = e.target.value || null;
            if (v !== post.post_time) onPatch({ post_time: v });
          }}
        />
      </td>
      <td className="px-2 py-3 align-middle min-w-[80px]">
        <select
          className={CELL}
          defaultValue={post.pillar ?? ''}
          onChange={e =>
            onPatch({ pillar: (e.target.value || null) as Pillar | null })
          }
        >
          <option value="">—</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </select>
      </td>
      <td className="px-2 py-3 align-middle min-w-[120px]">
        <TypeSelect
          value={post.content_type}
          onChange={t => onPatch({ content_type: t })}
        />
      </td>
      <td className="px-2 py-3 min-w-[280px]">
        <div className="relative">
          <textarea
            rows={2}
            className={CELL + ' resize-y leading-snug pr-10'}
            value={description}
            placeholder="Caption / hook"
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              const v = description || null;
              if (v !== post.description) onPatch({ description: v });
            }}
          />
          <div className="pointer-events-none absolute right-1.5 top-1.5">
            <div className="pointer-events-auto">
              <AiCaptionHelper
                draft={description}
                clientId={clientId}
                onAccept={caption => {
                  setDescription(caption);
                  onPatch({ description: caption });
                }}
              />
            </div>
          </div>
        </div>
        <AssetUrlInput
          value={post.asset_url}
          onChange={v => onPatch({ asset_url: v })}
        />
      </td>
      <td className="px-2 py-3 align-middle min-w-[180px]">
        <select
          className={CELL}
          defaultValue={post.shoot_id ?? ''}
          onChange={e => onPatch({ shoot_id: e.target.value || null })}
        >
          <option value="">No shoot</option>
          {shoots.map(s => (
            <option key={s.id} value={s.id}>
              Shoot {s.bundle_number}
              {s.template ? ` · ${s.template.name}` : ''}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-3 align-middle min-w-[180px]">
        <StatusPipeline
          status={post.status}
          onChange={s => onPatch({ status: s })}
        />
      </td>
      <td className="px-2 py-3 text-right opacity-0 transition-opacity duration-fast group-hover:opacity-100">
        <button
          type="button"
          onClick={onDelete}
          className="grid h-7 w-7 place-items-center rounded-md text-bad hover:bg-bad/10"
          aria-label="Delete post"
          title="Delete"
        >
          <X size={14} />
        </button>
      </td>
    </tr>
  );
}

function AssetUrlInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-charcoal/55">
      <Link2 size={11} className="shrink-0 text-amber-deep" />
      <span className="uppercase tracking-eyebrow">Asset</span>
      <input
        type="url"
        className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[12px] text-charcoal placeholder:text-charcoal/30 hover:border-cream-dk focus:border-amber-mid focus:bg-cream-lt focus:outline-none focus:ring-2 focus:ring-amber-mid/20"
        defaultValue={value ?? ''}
        placeholder="Paste Drive / DAM link"
        onBlur={e => {
          const v = e.target.value.trim() || null;
          if (v !== (value ?? null)) onChange(v);
        }}
      />
    </label>
  );
}

function TypeSelect({
  value,
  onChange,
}: {
  value: ContentType;
  onChange: (t: ContentType) => void;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-label',
        TYPE_CHIP[value]
      )}
    >
      <select
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        value={value}
        onChange={e => onChange(e.target.value as ContentType)}
        aria-label="Content type"
      >
        {CONTENT_TYPES.map(t => (
          <option key={t} value={t}>
            {CONTENT_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      {CONTENT_TYPE_LABEL[value]}
      <svg width="9" height="9" viewBox="0 0 9 9" className="opacity-60">
        <path
          d="M2 3.5L4.5 6L7 3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function DateBadge({ date }: { date: string }) {
  const d = parseISO(date);
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-md border border-cream-dk bg-cream-lt text-center">
        <span className="text-[9px] uppercase tracking-eyebrow text-charcoal/55">
          {format(d, 'EEE')}
        </span>
        <span className="font-display text-lg font-bold leading-none text-green-deep">
          {format(d, 'd')}
        </span>
      </div>
      <div className="hidden text-[10px] uppercase tracking-eyebrow text-charcoal/45 lg:block">
        {format(d, 'MMM')}
      </div>
    </div>
  );
}

function ShootBundles({
  shoots,
  templates,
  clientSlug,
  monthSlug,
  posts,
  people,
}: {
  shoots: ShootWithTemplate[];
  templates: ShootTemplate[];
  clientSlug: string;
  monthSlug: string;
  posts: Post[];
  people: Person[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  if (shoots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-green-deep/25 bg-cream-lt p-12 text-center">
        <Camera size={28} className="mx-auto mb-3 text-charcoal/30" />
        <p className="text-sm text-charcoal/65">
          No shoot bundles yet. Add one with{' '}
          <strong className="text-green-deep">+ Shoot bundle</strong>.
        </p>
      </div>
    );
  }

  const patch = (id: string, p: Record<string, any>) =>
    start(async () => {
      await updateShoot({
        id,
        client_slug: clientSlug,
        month_slug: monthSlug,
        patch: p,
      });
      router.refresh();
    });

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-cream-dk/60 pb-4">
        <div>
          <div className="eyebrow">Bundles</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-green-deep">
            Shoots <span className="italic text-amber-deep">({shoots.length})</span>
          </h2>
        </div>
        <p className="hidden max-w-md text-right text-sm italic text-charcoal/65 md:block">
          Pick a shoot type to auto-populate the capture list and capacity.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {shoots.map(s => {
          const used = posts.filter(p => p.shoot_id === s.id).length;
          return (
            <article
              key={s.id}
              className="overflow-hidden rounded-2xl border border-cream-dk/60 bg-white p-7 shadow-card transition-all duration-base ease-pulse hover:-translate-y-1 hover:border-amber-mid/40 hover:shadow-lift"
            >
              <header className="flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] uppercase tracking-eyebrow text-charcoal/55">
                    Shoot
                  </span>
                  <span className="font-display text-4xl font-black leading-none text-green-deep">
                    {s.bundle_number}
                  </span>
                </div>
                <span className="rounded-md bg-cream-lt px-2.5 py-1 text-[10px] uppercase tracking-eyebrow text-charcoal/60">
                  {used} post{used === 1 ? '' : 's'}
                </span>
              </header>

              <div className="mt-5 space-y-3">
                <Field label="Shoot type">
                  <select
                    className={PANEL_FIELD}
                    defaultValue={s.shoot_template_id ?? ''}
                    onChange={e =>
                      patch(s.id, { shoot_template_id: e.target.value || null })
                    }
                  >
                    <option value="">— Pick a shoot type —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date">
                    <input
                      type="date"
                      className={PANEL_FIELD + ' tabular-nums'}
                      defaultValue={s.scheduled_date ?? ''}
                      onBlur={e =>
                        patch(s.id, { scheduled_date: e.target.value || null })
                      }
                    />
                  </Field>
                  <Field label="Time">
                    <input
                      type="text"
                      placeholder="2:00 PM"
                      className={PANEL_FIELD}
                      defaultValue={s.scheduled_time ?? ''}
                      onBlur={e =>
                        patch(s.id, { scheduled_time: e.target.value || null })
                      }
                    />
                  </Field>
                </div>

                <Field label="Location">
                  <input
                    type="text"
                    placeholder="OAK Steak House"
                    className={PANEL_FIELD}
                    defaultValue={s.location ?? ''}
                    onBlur={e =>
                      patch(s.id, { location: e.target.value || null })
                    }
                  />
                </Field>

                <Field label="Assigned to">
                  {people.length > 0 ? (
                    <select
                      className={PANEL_FIELD}
                      defaultValue={s.assigned_person_id ?? ''}
                      onChange={e => {
                        const personId = e.target.value || null;
                        start(async () => {
                          await assignShootToPerson({
                            shoot_id: s.id,
                            client_slug: clientSlug,
                            month_slug: monthSlug,
                            person_id: personId,
                          });
                          router.refresh();
                        });
                      }}
                    >
                      <option value="">— Unassigned —</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {' · '}
                          {p.role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Add team members on /people"
                      className={PANEL_FIELD}
                      defaultValue={s.assigned_to ?? ''}
                      onBlur={e =>
                        patch(s.id, { assigned_to: e.target.value || null })
                      }
                    />
                  )}
                  {s.assigned_to && !s.assigned_person_id ? (
                    <p className="mt-1 text-[10px] uppercase tracking-eyebrow text-charcoal/45">
                      Legacy: {s.assigned_to}
                    </p>
                  ) : null}
                </Field>

                <Field label="Drive folder URL">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/…"
                    className={PANEL_FIELD}
                    defaultValue={s.drive_folder_url ?? ''}
                    onBlur={e =>
                      patch(s.id, { drive_folder_url: e.target.value || null })
                    }
                  />
                </Field>

                <Field label="Rides along on (optional)">
                  <select
                    className={PANEL_FIELD}
                    defaultValue={s.piggyback_on_shoot_id ?? ''}
                    onChange={e =>
                      patch(s.id, {
                        piggyback_on_shoot_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— Standalone shoot —</option>
                    {shoots
                      .filter(o => o.id !== s.id)
                      .map(o => (
                        <option key={o.id} value={o.id}>
                          Shoot {o.bundle_number}
                          {o.template ? ` · ${o.template.name}` : ''}
                          {o.scheduled_date ? ` · ${o.scheduled_date}` : ''}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>

              <BulkDrivePaste
                shootId={s.id}
                clientSlug={clientSlug}
                monthSlug={monthSlug}
              />

              <a
                href={`/clients/${clientSlug}/months/${monthSlug}/shoots/${s.bundle_number}/shotlist`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block rounded-md bg-green-deep py-3 text-center text-xs uppercase tracking-label text-cream transition-colors duration-fast hover:bg-charcoal"
              >
                Open shot list →
              </a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BulkDrivePaste({
  shootId,
  clientSlug,
  monthSlug,
}: {
  shootId: string;
  clientSlug: string;
  monthSlug: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const urls = text
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setBusy(true);
    start(async () => {
      try {
        await bulkAddDriveUrlsAsExtras({
          shoot_id: shootId,
          client_slug: clientSlug,
          month_slug: monthSlug,
          urls,
        });
        setText('');
        setOpen(false);
        router.refresh();
      } finally {
        setBusy(false);
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-amber-mid/50 bg-cream-lt px-3 py-2 text-[11px] uppercase tracking-eyebrow text-amber-deep hover:bg-amber-light/40"
      >
        <Link2 size={11} />
        Bulk-paste Drive URLs
      </button>
    );
  }
  return (
    <div className="mt-5 rounded-md border border-amber-mid/40 bg-amber-light/15 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-eyebrow text-amber-deep">
          Drop in Drive links — one per line
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] uppercase tracking-eyebrow text-charcoal/55 hover:text-charcoal"
        >
          Cancel
        </button>
      </div>
      <textarea
        rows={3}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="https://drive.google.com/...&#10;https://drive.google.com/..."
        className="mt-2 w-full rounded-md border border-cream-dk bg-white px-3 py-2 text-xs text-charcoal placeholder:text-charcoal/35 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/20"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || text.trim().length === 0}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-deep px-3 py-2 text-[11px] uppercase tracking-eyebrow text-cream-lt hover:bg-charcoal disabled:opacity-40"
      >
        {busy ? 'Adding…' : 'Add as captured extras'}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-eyebrow text-charcoal/50">
        {label}
      </span>
      {children}
    </label>
  );
}
