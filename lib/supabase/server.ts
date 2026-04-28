import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-side Supabase client. Uses the service-role key when present
 * (server-only contexts: Server Components, Server Actions, scripts).
 *
 * v1 has no auth; this client is the only writer. Do NOT import this from
 * Client Components.
 */
export function supabaseServer() {
  if (!url || !anon) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill in values.'
    );
  }
  return createClient(url, service ?? anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
