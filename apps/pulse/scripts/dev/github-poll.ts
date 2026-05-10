#!/usr/bin/env tsx
/**
 * Polls GitHub for each engineering project that has `github_repo` set:
 * default branch, latest commit, open PR + issue counts.
 * Writes one row per project to `dev.repo_activity`.
 *
 *   pnpm --filter @pulse/pulse dev:gh:poll
 *
 * Requires GITHUB_TOKEN in env (.env.local). Same logic runs server-side
 * via POST /api/monitor/github.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { pollAllProjects } from '../../lib/dev/monitors/github';

async function main() {
  const result = await pollAllProjects();
  console.log(
    `✔ polled ${result.polled} project(s) (${result.skipped} skipped — no github_repo).`
  );
  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} error(s):`);
    for (const e of result.errors) console.error(`  · ${e}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
