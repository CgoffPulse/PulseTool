/**
 * Direct Postgres access for the analytics tool. Self-contained on purpose so
 * the app can deploy as a standalone Vercel project (no workspace deps to resolve).
 *
 * Server-only — do NOT import from a Client Component.
 */
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
      'PG_URL is not set. Add it to apps/analytics/.env.local — see .env.example.'
    );
  }
  return new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

function pool(): Pool {
  if (!globalThis.__pulse_pg_pool) {
    globalThis.__pulse_pg_pool = makePool();
  }
  return globalThis.__pulse_pg_pool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const r = await pool().query<T>(sql, params as unknown[]);
  return r.rows;
}

export async function qOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
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
