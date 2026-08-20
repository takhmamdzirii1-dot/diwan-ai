import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function createClient(cookieStore?: any) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkvhumsxksxlnhsenuly.supabase.co';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdmh1bXN4a3N4bG5oc2VudWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxODM2OTUsImV4cCI6MjEwMjc1OTY5NX0.kwkAFTaQf-vERRai8X3iq7nUQptfnDBKnhb-t3wBB7w';

  let resolvedCookies = cookieStore;
  if (!resolvedCookies) {
    try {
      // Dynamic import to support Next.js App Router headers
      const { cookies } = await import('next/headers');
      resolvedCookies = await cookies();
    } catch {
      // Non-Next environment fallback
    }
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return resolvedCookies?.getAll?.() ?? [];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            resolvedCookies?.set?.(name, value, options)
          );
        } catch {
          // Server component setAll fallback
        }
      },
    },
  });
}
