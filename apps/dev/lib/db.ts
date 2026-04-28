/**
 * Dev hub data access — direct Postgres via @pulse/db/pg, schema-bound to `dev`.
 *
 * Bypasses Supabase's REST gateway entirely so we don't depend on the
 * "Exposed schemas" project setting. Server-only — do not import from a
 * Client Component.
 */
export { pgQuery as q, pgQueryOne as qOne, pgTx as tx } from '@pulse/db/pg';
