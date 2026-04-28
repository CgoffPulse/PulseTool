#!/usr/bin/env tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', 'apps', 'social', '.env.local') });

async function main() {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: pnpm exec tsx scripts/mark-migration-applied.ts <filename>');
    process.exit(1);
  }
  const c = new Client({ connectionString: process.env.PG_URL!, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query(
      `create table if not exists public._migrations (
         filename text primary key, applied_at timestamptz not null default now()
       )`
    );
    await c.query(
      `insert into public._migrations (filename) values ($1)
       on conflict (filename) do nothing`,
      [filename]
    );
    console.log(`✔ marked ${filename} as applied`);
  } finally {
    await c.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
