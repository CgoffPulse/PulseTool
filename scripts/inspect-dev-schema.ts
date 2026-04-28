#!/usr/bin/env tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', 'apps', 'social', '.env.local') });

async function main() {
  const c = new Client({ connectionString: process.env.PG_URL!, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const tables = await c.query(
      `select c.relname as table from pg_class c
       join pg_namespace n on c.relnamespace=n.oid
       where n.nspname='dev' and c.relkind in ('r','v') order by c.relname`
    );
    console.log('dev tables:', tables.rows.map(r => r.table));

    const types = await c.query(
      `select t.typname from pg_type t
       join pg_namespace n on t.typnamespace=n.oid
       where n.nspname='dev' order by t.typname`
    );
    console.log('dev types:', types.rows.map(r => r.typname));

    const schemas = await c.query(
      `select schema_name from information_schema.schemata where schema_name in ('dev','public')`
    );
    console.log('schemas present:', schemas.rows.map(r => r.schema_name));
  } finally {
    await c.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
