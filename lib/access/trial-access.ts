import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { deriveStudioAccess, generationAccessError, type AccessEntitlement, type StudioAccessState } from '@/lib/access/trial-state';
export type { StudioAccessState } from '@/lib/access/trial-state';

export async function getStudioAccess(user: User): Promise<StudioAccessState> {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error('STUDIO_ACCESS_UNAVAILABLE');
  // The new service-only RPC activates a due period for cookie and bearer
  // requests. Its absence is expected until the migration is applied.
  const { error: refreshError } = await admin.rpc('activate_due_subscription_period_for_access', { p_user_id: user.id });
  if (refreshError && !['PGRST202', '42883'].includes(refreshError.code)) {
    throw new Error('STUDIO_ACCESS_UNAVAILABLE');
  }
  const { data, error } = await admin
    .from('user_entitlements')
    .select('plan_id,status,starts_at,ends_at,payment_plans!inner(plan_code,name)')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: false });
  if (error) throw new Error('STUDIO_ACCESS_UNAVAILABLE');
  return deriveStudioAccess({
    createdAt: user.created_at,
    entitlements: (data ?? []) as unknown as AccessEntitlement[],
    hasSeenLiteOffer: user.user_metadata?.has_seen_lite_offer === true,
  });
}

export async function requireStudioGenerationAccess(user: User) {
  const access = await getStudioAccess(user);
  const error = generationAccessError(access, 'chat');
  if (error) throw new Error(error);
  return access;
}

export async function requireMediaGenerationAccess(user: User) {
  const access = await getStudioAccess(user);
  const error = generationAccessError(access, 'image');
  if (error) throw new Error(error);
  return access;
}
