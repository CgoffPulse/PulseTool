#!/usr/bin/env tsx
/**
 * Applies a single SQL migration file to the Supabase Postgres instance.
 *
 *   pnpm run migrate supabase/migrations/0002_production_hub.sql
 *
 * Reads connection from PG_URL or constructs one from SUPABASE_DB_PASSWORD
 * and the project ref derived from NEXT_PUBLIC_SUPABASE_URL.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });
import { Client } from 'pg';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: pnpm run migrate <path-to-sql>');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const directUrl = process.env.PG_URL;

  let connectionString = directUrl;
  if (!connectionString && supabaseUrl && dbPassword) {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`;
  }
  if (!connectionString) {
    console.error(
      'Missing PG_URL or SUPABASE_DB_PASSWORD. Add SUPABASE_DB_PASSWORD to .env.local.'
    );
    process.exit(1);
  }

  const sql = await readFile(path.resolve(file), 'utf8');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`✔ Applied ${file}`);
  } catch (err) {
    console.error(`✖ Migration failed: ${file}`);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
