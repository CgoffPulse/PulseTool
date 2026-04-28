import Link from 'next/link';
import { ArrowRight, Check, FolderGit2, GitBranch } from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import { bulkCreateProjects } from '@/lib/actions';
import { discoverProjects, type DiscoveredProject } from '@/lib/discovery';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DiscoverProjectsPage() {
  const root = process.env.DEV_PROJECTS_ROOT;

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="flex items-center gap-1 text-xs text-green-deep/70 hover:text-amber-deep font-body"
      >
        <ChevronLeft size={14} />
        Projects
      </Link>

      <header className="space-y-3">
        <span className="eyebrow">
          <span>Project autodiscovery</span>
        </span>
        <h1 className="font-display text-4xl font-black tracking-display text-green-deep sm:text-5xl">
          Discover <span className="italic-amber">projects.</span>
        </h1>
        {root ? (
          <p className="text-sm font-body text-charcoal/70">
            Pulled from{' '}
            <code className="rounded bg-cream/60 px-1.5 py-0.5 font-mono text-xs text-green-deep">
              {root}
            </code>{' '}
            — one level deep.
          </p>
        ) : null}
      </header>

      {!root ? <MissingEnvPanel /> : <DiscoverBody root={root} />}
    </div>
  );
}

function MissingEnvPanel() {
  return (
    <section className="grain rounded-2xl border border-cream-dk bg-cream-lt p-10 text-center">
      <FolderGit2 className="mx-auto text-amber-deep" size={28} />
      <h2 className="mt-4 text-2xl font-display text-green-deep">
        Set <code className="font-mono">DEV_PROJECTS_ROOT</code> in your{' '}
        <code className="font-mono">.env.local</code> first
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm font-body text-green-deep/80">
        Point it at the directory that holds your project folders. We&apos;ll walk
        it one level deep, find git repos, and let you import them in one shot.
      </p>
      <pre className="mx-auto mt-5 max-w-md rounded-md bg-green-deep px-4 py-3 text-left font-mono text-xs text-cream">
        DEV_PROJECTS_ROOT=/Users/you/Developer
      </pre>
    </section>
  );
}

async function DiscoverBody({ root }: { root: string }) {
  let candidates: DiscoveredProject[] = [];
  let walkError: string | null = null;
  try {
    candidates = await discoverProjects(root);
  } catch (err) {
    walkError = (err as Error).message;
  }

  if (walkError) {
    return (
      <section className="rounded-2xl border border-cream-dk bg-cream-lt p-8">
        <p className="font-body text-sm text-green-deep">
          Couldn&apos;t walk that directory. {walkError}
        </p>
      </section>
    );
  }

  if (candidates.length === 0) {
    return (
      <section className="rounded-2xl border border-cream-dk bg-cream-lt p-10 text-center">
        <p className="font-body text-sm text-green-deep/80">
          No git repositories found at that level.
        </p>
      </section>
    );
  }

  const fresh = candidates.filter(c => !c.already_imported);
  const importedCount = candidates.length - fresh.length;

  return (
    <form action={bulkCreateProjects} className="space-y-6">
      <div className="flex items-baseline justify-between">
        <p className="font-body text-sm text-green-deep/80">
          Found <span className="font-mono text-green-deep">{candidates.length}</span> repo
          {candidates.length === 1 ? '' : 's'}
          {importedCount > 0 ? (
            <>
              {' '}
              · <span className="font-mono">{importedCount}</span> already in your hub
            </>
          ) : null}
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md bg-green-deep px-4 py-2 font-body text-sm text-cream transition-colors hover:bg-amber-deep"
        >
          Import selected
          <ArrowRight size={14} />
        </button>
      </div>

      <ul className="divide-y divide-cream-dk overflow-hidden rounded-2xl border border-cream-dk bg-cream-lt">
        {candidates.map(c => (
          <Row key={c.local_path} c={c} />
        ))}
      </ul>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/projects"
          className="font-body text-sm text-green-deep/70 hover:text-amber-deep"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md bg-green-deep px-4 py-2 font-body text-sm text-cream transition-colors hover:bg-amber-deep"
        >
          Import selected
          <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
}

function Row({ c }: { c: DiscoveredProject }) {
  const payload = JSON.stringify({
    name: c.name,
    slug: c.slug,
    local_path: c.local_path,
    github_repo: c.github_repo,
  });

  return (
    <li className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5">
      <label className="flex flex-1 items-start gap-4 cursor-pointer">
        <input
          type="checkbox"
          name="discover[]"
          value={payload}
          defaultChecked={!c.already_imported}
          disabled={c.already_imported}
          className="mt-1.5 h-4 w-4 accent-amber-deep"
        />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-xl text-green-deep">{c.name}</h3>
            <span className="font-mono text-xs text-green-deep/60">/{c.slug}</span>
            {c.already_imported ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-deep px-2 py-0.5 font-body text-2xs uppercase tracking-eyebrow text-cream">
                <Check size={10} />
                Already imported
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-green-deep/70">
            {c.github_repo ? (
              <span className="inline-flex items-center gap-1.5">
                <FolderGit2 size={12} className="text-amber-deep" />
                <code className="font-mono">{c.github_repo}</code>
              </span>
            ) : (
              <span className="italic text-green-deep/50">no GitHub remote</span>
            )}

            {c.current_branch ? (
              <span className="inline-flex items-center gap-1.5">
                <GitBranch size={12} className="text-amber-deep" />
                <code className="font-mono">{c.current_branch}</code>
                {c.is_dirty ? (
                  <span className="ml-1 rounded-full border border-amber-deep px-1.5 py-0.5 font-body text-2xs uppercase tracking-eyebrow text-amber-deep">
                    dirty
                    {c.uncommitted_files != null
                      ? ` · ${c.uncommitted_files}`
                      : ''}
                  </span>
                ) : (
                  <span className="ml-1 rounded-full border border-cream-dk px-1.5 py-0.5 font-body text-2xs uppercase tracking-eyebrow text-green-deep/60">
                    clean
                  </span>
                )}
              </span>
            ) : null}

            <span>
              touched{' '}
              <span className="text-green-deep">{timeAgo(c.last_modified_at)}</span>
            </span>
          </div>

          <p className="truncate font-mono text-2xs text-green-deep/50">
            {c.local_path}
          </p>

          {c.error ? (
            <p className="font-body text-xs text-amber-deep/80">
              git inspection failed: <span className="font-mono">{c.error}</span>
            </p>
          ) : null}
        </div>
      </label>
    </li>
  );
}
