import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createTemplate } from '@/lib/actions';

export default function NewTemplatePage() {
  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-eyebrow text-charcoal/60 hover:text-amber-deep"
      >
        <ChevronLeft size={14} /> Templates
      </Link>

      <header className="flex flex-col gap-3">
        <span className="eyebrow">New template</span>
        <h1 className="font-display text-3xl font-bold tracking-display text-green-deep">
          Add a <span className="italic-amber">prompt</span> to the library.
        </h1>
        <p className="max-w-2xl text-sm text-charcoal/65">
          Slug is what calling apps pass to <code className="font-mono text-charcoal/85">/api/llm/run</code>.
          Use Mustache-style <code className="font-mono text-charcoal/85">{'{{var}}'}</code> placeholders in
          either system or user template — they get filled from the
          <code className="font-mono text-charcoal/85"> vars</code> object on the request.
        </p>
      </header>

      <form
        action={createTemplate}
        className="flex flex-col gap-5 rounded-md border border-cream-dk/60 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="Human readable.">
            <input
              type="text"
              name="name"
              required
              className="input"
              placeholder="Post caption rewriter"
            />
          </Field>
          <Field label="Slug" hint="Lowercase, dashes. Used in API calls.">
            <input
              type="text"
              name="slug"
              required
              className="input"
              placeholder="post-caption"
            />
          </Field>
        </div>
        <Field label="Description" hint="One-liner for the template card.">
          <input
            type="text"
            name="description"
            className="input"
            placeholder="Rewrites a draft caption in the client brand voice."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Applies to" hint="Free-form bucket: post_caption, sales_email, ...">
            <input
              type="text"
              name="applies_to"
              defaultValue="custom"
              className="input"
            />
          </Field>
          <Field label="Default model">
            <input
              type="text"
              name="default_model"
              defaultValue="claude-sonnet-4-5-20250929"
              className="input"
            />
          </Field>
        </div>
        <Field label="System prompt" hint="Voice + role. Use {{vars}} liberally.">
          <textarea
            name="system_md"
            rows={6}
            className="input font-mono text-xs"
            placeholder="You are a senior copywriter for Pulse..."
          />
        </Field>
        <Field
          label="User template"
          hint="Goes into the user role each call. Insert {{vars}}."
        >
          <textarea
            name="user_md_template"
            rows={6}
            className="input font-mono text-xs"
            placeholder={'BRAND BRIEF:\n{{brand_brief}}\n\nDRAFT:\n{{draft}}'}
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/templates" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Create template
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-green-deep">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-charcoal/55">{hint}</span>}
    </label>
  );
}
