import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTemplateBySlug } from '@/lib/voice/queries';
import {
  archiveTemplate,
  unarchiveTemplate,
  updateTemplate,
} from '@/lib/voice/actions';
import { formatDateTime } from '@/lib/voice/format';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TemplateDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  if (!t) notFound();

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/voice/templates"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
      >
        <ChevronLeft size={14} /> Templates
      </Link>

      <header className="grain relative overflow-hidden rounded-lg border border-green-deep/10 bg-green-deep px-8 py-8 text-cream shadow-card">
        <span
          aria-hidden
          className="watermark cream pointer-events-none absolute -top-6 right-4 text-[140px] leading-none"
        >
          {t.slug.slice(0, 3).toUpperCase()}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip-on-dark">{t.applies_to}</span>
          <span className="chip-on-dark">v{t.version}</span>
          {t.archived && (
            <span className="chip-on-dark text-amber-light">archived</span>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-display sm:text-4xl">
          {t.name}
        </h1>
        <div className="mt-1 font-mono text-sm text-cream/70">{t.slug}</div>
        {t.description && (
          <p className="mt-3 max-w-2xl text-sm text-cream/75">{t.description}</p>
        )}
        <div className="mt-4 text-xs text-cream/55">
          Updated {formatDateTime(t.updated_at)} · default model{' '}
          <span className="italic-amber">{t.default_model}</span>
        </div>
      </header>

      <form
        action={updateTemplate}
        className="flex flex-col gap-5 rounded-md border border-cream-dk/60 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="slug" value={t.slug} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              type="text"
              name="name"
              defaultValue={t.name}
              required
              className="input"
            />
          </Field>
          <Field label="Applies to">
            <input
              type="text"
              name="applies_to"
              defaultValue={t.applies_to}
              required
              className="input"
            />
          </Field>
        </div>
        <Field label="Description">
          <input
            type="text"
            name="description"
            defaultValue={t.description ?? ''}
            className="input"
          />
        </Field>
        <Field label="Default model">
          <input
            type="text"
            name="default_model"
            defaultValue={t.default_model}
            required
            className="input"
          />
        </Field>
        <Field label="System prompt">
          <textarea
            name="system_md"
            rows={8}
            defaultValue={t.system_md}
            className="input font-mono text-xs"
          />
        </Field>
        <Field label="User template">
          <textarea
            name="user_md_template"
            rows={8}
            defaultValue={t.user_md_template}
            className="input font-mono text-xs"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            {t.archived ? (
              <ArchiveButton action={unarchiveTemplate} slug={t.slug}>
                Restore
              </ArchiveButton>
            ) : (
              <ArchiveButton action={archiveTemplate} slug={t.slug}>
                Archive
              </ArchiveButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/voice/templates" className="btn-ghost">
              Back
            </Link>
            <button type="submit" className="btn-primary">
              Save changes
            </button>
          </div>
        </div>
      </form>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
        {label}
      </span>
      {children}
    </label>
  );
}

function ArchiveButton({
  action,
  slug,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <button type="submit" className="btn-ghost text-xs">
        {children}
      </button>
    </form>
  );
}
