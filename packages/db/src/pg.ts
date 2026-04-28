import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// Return DATE columns as ISO strings (yyyy-mm-dd) instead of Date objects so
// they round-trip cleanly through JSON without timezone shifts.
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, v => v);

declare global {
  // eslint-disable-next-line no-var
  var __pulse_pg_pool: Pool | undefined;
}

function makePool(): Pool {
  const cs = process.env.PG_URL;
  if (!cs) {
    throw new Error(
      'PG_URL is not set. Add it to your app .env.local — see apps/social/.env.local for the canonical Supabase pooler URL.'
    );
  }
  return new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

/**
 * Returns a process-wide Pool. In Next.js dev the module is re-evaluated on
 * hot reload; stashing the pool on `globalThis` prevents connection leaks.
 */
export function pgPool(): Pool {
  if (!globalThis.__pulse_pg_pool) {
    globalThis.__pulse_pg_pool = makePool();
  }
  return globalThis.__pulse_pg_pool;
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const r = await pgPool().query<T>(sql, params as unknown[]);
  return r.rows;
}

export async function pgQueryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Run a callback in a single transaction. Commits on success, rolls back on
 * throw. Use when several writes must be atomic.
 */
export async function pgTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pgPool().connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (err) {
    await c.query('rollback');
    throw err;
  } finally {
    c.release();
  }
}
