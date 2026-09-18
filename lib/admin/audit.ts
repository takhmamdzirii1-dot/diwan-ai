import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordAdminAudit(client: SupabaseClient, input: {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await client.rpc('write_admin_audit', {
    p_actor_user_id: input.actorUserId,
    p_action: input.action,
    p_resource_type: input.resourceType,
    p_resource_id: input.resourceId,
    p_previous_state: input.previousState ?? null,
    p_new_state: input.newState ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(error.message || 'ADMIN_AUDIT_WRITE_FAILED');
}
