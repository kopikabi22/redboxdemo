import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client — safe to use in Client Components. Uses the
 * anon key, so every query it makes is still bounded by RLS (see
 * supabase/migrations/20260915000010_rls.sql); this client never bypasses
 * anything on its own.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
