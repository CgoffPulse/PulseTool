import { supabaseServer as base } from '@pulse/db/server';

/**
 * Dev hub's Supabase client — schema-bound to `dev`. Every query targets
 * `dev.*`. To read a social-tool table, construct a separate client:
 *
 *   import { supabaseServer } from '@pulse/db/server';
 *   const social = supabaseServer({ schema: 'public' });
 */
export function supabaseServer() {
  return base({ schema: 'dev' });
}
