import 'server-only';

import type { User } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { ensureInstallationIdentity } from '@/lib/access/free-device.server';
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
  const basicAccess = deriveStudioAccess({
    createdAt: user.created_at,
    entitlements: (data ?? []) as unknown as AccessEntitlement[],
    hasSeenLiteOffer: user.user_metadata?.has_seen_lite_offer === true,
  });
  if (basicAccess.kind === 'paid_active') return basicAccess;
  const installationHash = await ensureInstallationIdentity();
  const linkage = await admin.rpc('link_free_device_identity', {
    p_user_id: user.id, p_identity_kind: 'installation', p_identity_hash: installationHash,
  });
  if (linkage.error && !['PGRST202', '42883'].includes(linkage.error.code)) {
    throw new Error('STUDIO_ACCESS_UNAVAILABLE');
  }
  const eligibility = await admin.rpc('assess_free_access', { p_user_id: user.id });
  if (eligibility.error) {
    // Allow the existing Free path until the forward migration is installed.
    if (['PGRST202', '42883'].includes(eligibility.error.code)) return basicAccess;
    throw new Error('STUDIO_ACCESS_UNAVAILABLE');
  }
  return { ...basicAccess, freeEligibility: eligibility.data as StudioAccessState['freeEligibility'] };
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
