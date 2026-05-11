#!/usr/bin/env tsx
/**
 * Applies all migrations under packages/db/migrations/ in lexicographic order.
 *
 * Runs the schema-isolation linter first; aborts before any SQL executes if
 * any migration fails the check.
 *
 * Connection: PG_URL takes precedence; otherwise constructed from
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD.
 *
 * Tracks applied migrations in a `_migrations` table in `public` so reruns
 * are idempotent. Pass `--file <path>` to apply just one file (still gated
 * by the linter against the full directory).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

// Load env from each app's .env.local (whichever has the credentials).
// Post-consolidation the canonical home is apps/pulse/.env.local; the
// legacy social/dev paths are kept as a fallback for older worktrees.
loadEnv({ path: path.join(ROOT, 'apps', 'pulse', '.env.local') });
loadEnv({ path: path.join(ROOT, 'apps', 'social', '.env.local') });
loadEnv({ path: path.join(ROOT, 'apps', 'dev', '.env.local') });
loadEnv({ path: path.join(ROOT, '.env') });

function getConnectionString(): string {
  const direct = process.env.PG_URL;
  if (direct) return direct;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !dbPassword) {
    throw new Error(
      'Missing PG_URL or (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD). ' +
        'Set one in apps/social/.env.local or apps/dev/.env.local.'
    );
  }
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`;
}

async function ensureMigrationsTable(client: Client) {
  await client.query(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedSet(client: Client): Promise<Set<string>> {
  const r = await client.query<{ filename: string }>(
    'select filename from public._migrations'
  );
  return new Set(r.rows.map(x => x.filename));
}

async function main() {
  // Phase 1: lint everything before connecting to DB.
  const lintResult = spawnSync(
    'tsx',
    [path.join(__dirname, 'check-migration-isolation.ts')],
    { stdio: 'inherit' }
  );
  if (lintResult.status !== 0) {
    console.error('\nMigration linter failed — aborting before any SQL runs.');
    process.exit(lintResult.status ?? 1);
  }

  const argFile = (() => {
    const i = process.argv.indexOf('--file');
    return i > 0 ? process.argv[i + 1] : null;
  })();

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();
  const targets = argFile ? [path.basename(argFile)] : files;

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedSet(client);
    let ran = 0;
    for (const file of targets) {
      if (applied.has(file)) {
        console.log(`· skip  ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query(
          'insert into public._migrations (filename) values ($1)',
          [file]
        );
        await client.query('commit');
        console.log(`✔ apply ${file}`);
        ran++;
      } catch (err) {
        await client.query('rollback');
        console.error(`✖ failed ${file}`);
        throw err;
      }
    }
    console.log(`\nDone. ${ran} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
