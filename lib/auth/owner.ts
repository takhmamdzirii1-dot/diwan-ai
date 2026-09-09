import 'server-only';

import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/src/lib/supabase/server';

function configuredOwnerIds() {
  return new Set(
    (process.env.VANTRA_OWNER_USER_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

/**
 * Owner access must come from server-controlled data: a private user-id allowlist
 * or Supabase app_metadata. Never authorize from mutable user_metadata.
 */
export function isOwnerUser(user: Pick<User, 'id' | 'app_metadata'>) {
  return configuredOwnerIds().has(user.id) || user.app_metadata?.role === 'owner';
}

/** Request-memoized owner lookup shared by the admin layout and its data layer. */
export const getOwnerAccess = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;
  return { user, isOwner: Boolean(user && isOwnerUser(user)) };
});
