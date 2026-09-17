import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions — reads/writes the auth cookie via Next's cookies() store.
 * Still uses the anon key (RLS-bounded), NOT the service_role key: this is
 * "the current logged-in user acting through the server," not an admin
 * client. The `setAll` no-op/catch below is the standard Next.js App Router
 * pattern — a Server Component is allowed to read cookies but not write
 * them, so a session refresh triggered from one is safely ignored there
 * (middleware is what actually refreshes the session cookie).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — no-op, middleware handles
            // session refresh instead.
          }
        },
      },
    },
  );
}
