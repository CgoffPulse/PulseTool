import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface SupabaseServerOptions {
  /**
   * Postgres schema this client targets. Defaults to 'public' so existing
   * social-tool callers keep working unchanged.
   */
  schema?: string;
}

/**
 * Server-side Supabase client. Uses the service-role key when present
 * (server-only contexts: Server Components, Server Actions, scripts).
 *
 * Pass `{ schema }` to bind every query to a specific Postgres schema —
 * a hard guard against a tool accidentally writing to another tool's tables.
 *
 * NOTE: This is an inlined copy of what used to live in `@pulse/db/server`.
 * The package still exists for `pnpm migrate` + the schema-isolation linter,
 * but apps/pulse imports the supabase client directly to stay deployable
 * as a single Vercel project (no workspace dep on @pulse/db at runtime).
 */
export function supabaseServer(opts: SupabaseServerOptions = {}) {
  if (!url || !anon) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill in values.'
    );
  }
  if (opts.schema) {
    return createClient(url, service ?? anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: opts.schema },
    });
  }
  return createClient(url, service ?? anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
