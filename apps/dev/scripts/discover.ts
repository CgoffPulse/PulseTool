#!/usr/bin/env tsx
/**
 * Walks DEV_PROJECTS_ROOT one level deep, prints the candidate repos as a
 * table, and (optionally) inserts new rows into `dev.projects`.
 *
 *   pnpm --filter @pulse/dev discover            # dry-run, prints the table
 *   pnpm --filter @pulse/dev discover --apply    # actually insert new rows
 *
 * Idempotent on `slug` — running with `--apply` repeatedly is safe.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { discoverProjects, type DiscoveredProject } from '../lib/discovery';
import { qOne } from '../lib/db';
import { markdownSync } from '../lib/sync/markdown';
import type { Project } from '../lib/types';

function trunc(s: string, n: number): string {
  if (s.length <= n) return s.padEnd(n, ' ');
  return `${s.slice(0, Math.max(0, n - 1))}…`;
}

function printTable(rows: DiscoveredProject[]): void {
  const headers = ['', 'name', 'slug', 'github_repo', 'branch', 'state', 'path'];
  const widths = [3, 22, 22, 32, 18, 8, 48];

  const sep = '─'.repeat(widths.reduce((a, b) => a + b + 3, 0));
  console.log(sep);
  console.log(
    headers.map((h, i) => trunc(h, widths[i])).join(' │ ')
  );
  console.log(sep);

  for (const r of rows) {
    const mark = r.already_imported ? '·' : '+';
    const state = r.is_dirty === true ? 'dirty' : r.is_dirty === false ? 'clean' : '—';
    const cells = [
      trunc(mark, widths[0]),
      trunc(r.name, widths[1]),
      trunc(r.slug, widths[2]),
      trunc(r.github_repo ?? '—', widths[3]),
      trunc(r.current_branch ?? '—', widths[4]),
      trunc(state, widths[5]),
      trunc(r.local_path, widths[6]),
    ];
    console.log(cells.join(' │ '));
  }

  console.log(sep);
  const fresh = rows.filter(r => !r.already_imported).length;
  console.log(
    `${rows.length} candidate(s) · ${fresh} new · ${rows.length - fresh} already imported`
  );
}

async function applyImport(rows: DiscoveredProject[]): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.already_imported) {
      skipped++;
      continue;
    }
    const p = await qOne<Project>(
      `insert into dev.projects (name, slug, state, local_path, github_repo)
       values ($1, $2, 'active', $3, $4)
       on conflict (slug) do nothing
       returning *`,
      [r.name, r.slug, r.local_path, r.github_repo]
    );
    if (!p) {
      skipped++;
      continue;
    }
    await markdownSync.upsert(
      'project',
      p.id,
      {
        type: 'project',
        id: p.id,
        name: p.name,
        slug: p.slug,
        state: p.state,
        github_repo: p.github_repo,
        local_path: p.local_path,
        updated_at: p.updated_at,
      },
      p.summary ?? ''
    );
    inserted++;
  }
  console.log(`✔ inserted ${inserted} project(s) · ${skipped} skipped.`);
}

async function main() {
  const root = process.env.DEV_PROJECTS_ROOT;
  if (!root) {
    console.error(
      'DEV_PROJECTS_ROOT is not set. Add it to apps/dev/.env.local, e.g.:\n' +
        '  DEV_PROJECTS_ROOT=/Users/you/Developer'
    );
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');

  const rows = await discoverProjects(root);
  printTable(rows);

  if (apply) {
    console.log('\nApplying — inserting new rows…');
    await applyImport(rows);
  } else {
    console.log('\nDry run. Re-run with --apply to insert.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
