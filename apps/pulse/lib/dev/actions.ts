'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, qOne } from '../db';
import { slugify } from '../utils';
import { pollAllProjects } from './monitors/github';
import { pollAllDeploys } from './monitors/deploy';

/**
 * Engineering-specific server actions for the (dev) route group.
 *
 * Project/task CRUD lives in `lib/command/actions.ts` (the canonical command
 * layer); we only keep:
 *   - bulk-create from discover (engineering-only autodiscovery flow)
 *   - refreshAllMonitors (kicks the GitHub + Vercel pollers)
 */

// ============================================================================
// Bulk import (used by /dev/projects/discover)
// ============================================================================

const DiscoveredInput = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  local_path: z.string().trim().min(1),
  github_repo: z
    .string()
    .trim()
    .nullish()
    .transform(v => v || null),
});

export async function bulkCreateProjects(formData: FormData) {
  const raw = formData.getAll('discover[]');
  const candidates: z.infer<typeof DiscoveredInput>[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string' || entry.length === 0) continue;
    try {
      const parsed = DiscoveredInput.parse(JSON.parse(entry));
      candidates.push({
        ...parsed,
        slug: slugify(parsed.slug) || slugify(parsed.name),
      });
    } catch {
      // Skip malformed rows; never crash the whole import on one bad entry.
    }
  }

  for (const c of candidates) {
    await qOne<{ id: string }>(
      `insert into command.projects
         (kind, name, slug, state, local_path, github_repo,
          department_id)
       values (
         'internal_build', $1, $2, 'active', $3, $4,
         (select id from command.departments where key = 'engineering')
       )
       on conflict (slug) do nothing
       returning id`,
      [c.name, c.slug, c.local_path, c.github_repo]
    );
  }

  revalidatePath('/dev');
  revalidatePath('/projects');
  revalidatePath('/dev/projects/discover');
  redirect('/projects');
}

// ============================================================================
// Monitor refresh — server action invoked from <RefreshButton />.
// ============================================================================

export async function refreshAllMonitors() {
  const [gh, vc] = await Promise.allSettled([
    pollAllProjects(),
    pollAllDeploys(),
  ]);

  revalidatePath('/dev');
  revalidatePath('/dev/monitors');
  revalidatePath('/projects');

  return {
    github:
      gh.status === 'fulfilled'
        ? gh.value
        : { error: (gh.reason as Error).message },
    vercel:
      vc.status === 'fulfilled'
        ? vc.value
        : { error: (vc.reason as Error).message },
  };
}

// Re-export for legacy import path used by some clients.
export { pollAllProjects, pollAllDeploys };

// Keep q imported so it doesn't trip "unused" linting if we revise this file.
void q;
