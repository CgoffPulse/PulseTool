import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createProject } from '@/lib/actions';
import { PROJECT_STATES, PROJECT_STATE_LABEL } from '@/lib/types';

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Link
        href="/projects"
        className="flex items-center gap-1 text-xs text-charcoal/60 hover:text-amber-deep"
      >
        <ChevronLeft size={14} />
        Projects
      </Link>

      <header>
        <span className="eyebrow">
          <span>New project</span>
        </span>
        <h1 className="mt-3 font-display text-4xl font-black tracking-display text-green-deep">
          What are you{' '}
          <span className="italic-amber">building?</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-charcoal/65">
          Anything you&rsquo;re building. The monitors will pick it up once you
          wire a GitHub repo, local path, or Vercel project ID.
        </p>
      </header>

      <form
        action={createProject}
        className="space-y-5 rounded-xl border border-cream-dk/60 bg-white p-6 shadow-sm"
      >
        <Field label="Name" required>
          <input
            name="name"
            required
            className="input"
            placeholder="Pulse Tool"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Slug" hint="optional · auto-derived from name">
            <input name="slug" className="input" placeholder="pulse-tool" />
          </Field>
          <Field label="State">
            <select name="state" defaultValue="active" className="input">
              {PROJECT_STATES.map(s => (
                <option key={s} value={s}>
                  {PROJECT_STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Current focus"
          hint="What you're working on right now."
        >
          <input
            name="current_focus"
            className="input"
            placeholder="Wiring up the production hub"
          />
        </Field>

        <Field label="Summary">
          <textarea
            name="summary"
            rows={3}
            className="input resize-y"
            placeholder="One paragraph: what this project is and why it matters."
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="GitHub repo" hint="owner/name">
            <input
              name="github_repo"
              className="input font-mono"
              placeholder="acme/pulse-tool"
            />
          </Field>
          <Field label="Owner">
            <input name="owner" className="input" placeholder="christian" />
          </Field>
        </div>

        <Field label="Local path" hint="for fs:scan + Open in Finder/Cursor">
          <input
            name="local_path"
            className="input font-mono text-xs"
            placeholder="/Users/christian/Developer/pulse-tool"
          />
        </Field>

        <Field
          label="Vercel project ID"
          hint="from the Vercel dashboard — used for deploy polling + webhook routing"
        >
          <input
            name="vercel_project_id"
            className="input font-mono text-xs"
          />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Link href="/projects" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn-primary">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal/65">
        {label}
        {required && <span className="ml-1 text-bad">*</span>}
        {hint && (
          <span className="ml-2 normal-case tracking-normal text-charcoal/40">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
