import 'server-only';

import type { User } from '@supabase/supabase-js';

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
