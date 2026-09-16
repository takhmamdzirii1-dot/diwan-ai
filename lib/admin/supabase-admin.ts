import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null | undefined;

const createSecretKeyFetch = (secret: string): typeof fetch => {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (
      secret.startsWith('sb_secret_')
      && headers.get('authorization') === `Bearer ${secret}`
    ) {
      headers.delete('authorization');
    }
    headers.set('apikey', secret);
    return nativeFetch(input, { ...init, headers });
  };
};

/** Dedicated cookie-free server client. It must never be imported by client code. */
export function getSupabaseAdminClient() {
  if (adminClient !== undefined) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createSecretKeyFetch(secret) },
  });
  return adminClient;
}
