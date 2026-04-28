#!/usr/bin/env tsx
/* Quick probe to find which Supabase pooler region your project lives in. */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { Client } from 'pg';

async function main() {
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  const password = process.env.SUPABASE_DB_PASSWORD!;
  const regions = [
    'ap-northeast-1','ap-northeast-2','ap-south-1','ap-southeast-1','ap-southeast-2',
    'ca-central-1','eu-central-1','eu-central-2','eu-north-1','eu-west-1','eu-west-2','eu-west-3',
    'sa-east-1','us-east-1','us-east-2','us-west-1','us-west-2',
  ];
  const prefixes = ['aws-0', 'aws-1'];
  for (const prefix of prefixes) for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const cs = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:6543/postgres`;
    const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 4000 });
    try {
      await c.connect();
      await c.query('select 1');
      console.log(`✔ Pooler: ${host}`);
      console.log(`Connection string: postgresql://postgres.${ref}:***@${host}:6543/postgres`);
      await c.end();
      return;
    } catch (e: any) {
      console.log(`  ${region}: ${(e.message || e).split('\n')[0]}`);
      try { await c.end(); } catch {}
    }
  }
  console.error('No pooler region matched.');
  process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
