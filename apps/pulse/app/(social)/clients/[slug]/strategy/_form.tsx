'use client';

import { useState, useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { upsertQuota, upsertStrategicFrame } from '@/lib/social/actions';
import type { ContentQuota, StrategicFrame } from '@/lib/social/types';

const FIELD =
  'w-full rounded-md border border-cream-dk bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25';

export function StrategyForm({
  clientSlug,
  clientId,
  initial,
}: {
  clientSlug: string;
  clientId: string;
  initial: StrategicFrame | null;
}) {
  const [quarter, setQuarter] = useState(initial?.quarter ?? '');
  const [goal, setGoal] = useState(initial?.goal_90day ?? '');
  const [audience, setAudience] = useState(initial?.primary_audience ?? '');
  const [role, setRole] = useState(initial?.role_of_social ?? '');
  const [voice, setVoice] = useState(initial?.brand_voice ?? '');
  const [avoid, setAvoid] = useState(initial?.avoid ?? '');
  const [cadence, setCadence] = useState(initial?.cadence ?? '');
  const [contracted, setContracted] = useState<string>(
    initial?.contracted_shoots_per_month?.toString() ?? ''
  );
  const [minLead, setMinLead] = useState<string>(
    (initial?.min_lead_time_days ?? 5).toString()
  );
  const [p1, setP1] = useState(initial?.pillar_1_name ?? '');
  const [p2, setP2] = useState(initial?.pillar_2_name ?? '');
  const [p3, setP3] = useState(initial?.pillar_3_name ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<'idle' | 'saved'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarter) return;
    start(async () => {
      await upsertStrategicFrame({
        client_slug: clientSlug,
        client_id: clientId,
        quarter,
        patch: {
          goal_90day: goal || null,
          primary_audience: audience || null,
          role_of_social: role || null,
          brand_voice: voice || null,
          avoid: avoid || null,
          cadence: cadence || null,
          contracted_shoots_per_month: contracted ? Number(contracted) : null,
          min_lead_time_days: Number(minLead) || 5,
          pillar_1_name: p1 || null,
          pillar_2_name: p2 || null,
          pillar_3_name: p3 || null,
        },
      });
      setSaved('saved');
      setTimeout(() => setSaved('idle'), 1500);
    });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Quarter" required>
        <input
          className={FIELD}
          value={quarter}
          onChange={e => setQuarter(e.target.value)}
          placeholder="Q2 2026"
        />
      </Field>
      <Field label="Contracted shoots / month">
        <input
          type="number"
          className={FIELD + ' tabular-nums'}
          value={contracted}
          onChange={e => setContracted(e.target.value)}
        />
      </Field>
      <Field label="90-day goal" full>
        <textarea
          rows={3}
          className={FIELD}
          value={goal}
          onChange={e => setGoal(e.target.value)}
        />
      </Field>
      <Field label="Primary audience">
        <input
          className={FIELD}
          value={audience}
          onChange={e => setAudience(e.target.value)}
        />
      </Field>
      <Field label="Role of social">
        <input
          className={FIELD}
          value={role}
          onChange={e => setRole(e.target.value)}
        />
      </Field>
      <Field label="Brand voice">
        <input
          className={FIELD}
          value={voice}
          onChange={e => setVoice(e.target.value)}
        />
      </Field>
      <Field label="Avoid">
        <input
          className={FIELD}
          value={avoid}
          onChange={e => setAvoid(e.target.value)}
        />
      </Field>
      <Field label="Cadence">
        <input
          className={FIELD}
          value={cadence}
          onChange={e => setCadence(e.target.value)}
        />
      </Field>
      <Field label="Min lead time (days)">
        <input
          type="number"
          className={FIELD + ' tabular-nums'}
          value={minLead}
          onChange={e => setMinLead(e.target.value)}
        />
      </Field>
      <Field label="Pillar 1">
        <input className={FIELD} value={p1} onChange={e => setP1(e.target.value)} />
      </Field>
      <Field label="Pillar 2">
        <input className={FIELD} value={p2} onChange={e => setP2(e.target.value)} />
      </Field>
      <Field label="Pillar 3">
        <input className={FIELD} value={p3} onChange={e => setP3(e.target.value)} />
      </Field>

      <div className="md:col-span-2 mt-3 flex items-center justify-end gap-3 border-t border-cream-dk/60 pt-5">
        {saved === 'saved' ? (
          <span className="text-[10px] uppercase tracking-eyebrow text-green-deep">
            Saved
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending || !quarter}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-4 py-2.5 text-xs uppercase tracking-label text-cream transition-colors duration-fast hover:bg-charcoal disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save frame'}
          <ArrowRight size={13} />
        </button>
      </div>
    </form>
  );
}

export function QuotaForm({
  clientSlug,
  clientId,
  month,
  initial,
}: {
  clientSlug: string;
  clientId: string;
  month: string;
  initial: ContentQuota | null;
}) {
  const [reels, setReels] = useState<string>(initial?.reels_target?.toString() ?? '');
  const [photos, setPhotos] = useState<string>(initial?.photos_target?.toString() ?? '');
  const [carousels, setCarousels] = useState<string>(
    initial?.carousels_target?.toString() ?? ''
  );
  const [stories, setStories] = useState<string>(initial?.stories_target?.toString() ?? '');
  const [videos, setVideos] = useState<string>(initial?.videos_target?.toString() ?? '');
  const [graphics, setGraphics] = useState<string>(
    initial?.graphics_target?.toString() ?? ''
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<'idle' | 'saved'>('idle');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      await upsertQuota({
        client_slug: clientSlug,
        client_id: clientId,
        month,
        patch: {
          reels_target: numOrNull(reels),
          photos_target: numOrNull(photos),
          carousels_target: numOrNull(carousels),
          stories_target: numOrNull(stories),
          videos_target: numOrNull(videos),
          graphics_target: numOrNull(graphics),
        },
      });
      setSaved('saved');
      setTimeout(() => setSaved('idle'), 1500);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Row label="Reels" value={reels} setValue={setReels} />
      <Row label="Photos" value={photos} setValue={setPhotos} />
      <Row label="Carousels" value={carousels} setValue={setCarousels} />
      <Row label="Stories" value={stories} setValue={setStories} />
      <Row label="Videos" value={videos} setValue={setVideos} />
      <Row label="Graphics" value={graphics} setValue={setGraphics} />
      <div className="flex items-center justify-end gap-3 border-t border-cream-dk/60 pt-4">
        {saved === 'saved' ? (
          <span className="text-[10px] uppercase tracking-eyebrow text-green-deep">
            Saved
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-deep px-4 py-2.5 text-xs uppercase tracking-label text-cream transition-colors duration-fast hover:bg-charcoal disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Save quotas'}
          <ArrowRight size={13} />
        </button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-cream-dk/40 pb-3 last:border-b-0 last:pb-0">
      <label className="text-xs uppercase tracking-eyebrow text-charcoal/65">{label}</label>
      <input
        type="number"
        className="w-24 rounded-md border border-cream-dk bg-white px-3 py-1.5 text-right font-display text-lg font-bold tabular-nums text-green-deep focus:border-amber-mid focus:outline-none focus:ring-2 focus:ring-amber-mid/25"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'md:col-span-2' : undefined}>
      <label className="mb-2 block text-[10px] uppercase tracking-eyebrow text-charcoal/55">
        {label}
        {required ? <span className="text-bad"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function numOrNull(v: string): number | null {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
