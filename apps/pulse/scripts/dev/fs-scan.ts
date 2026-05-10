#!/usr/bin/env tsx
/**
 * Walks every engineering project's `local_path`, captures git status +
 * last-modified time, and writes one row per project to `dev.fs_snapshots`.
 *
 *   pnpm --filter @pulse/pulse dev:fs:scan
 *
 * Local-only by design — needs the actual repo checkouts on this machine.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

import { scanAllProjects } from '../../lib/dev/monitors/fs-watcher';

async function main() {
  const result = await scanAllProjects();
  console.log(
    `✔ scanned ${result.scanned} project(s) (${result.skipped} skipped — no local_path).`
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
