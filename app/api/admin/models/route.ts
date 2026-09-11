import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { findRegistryModel } from '@/lib/models/runtime-config';

const schema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  enabled: z.boolean(),
  routingRole: z.enum(['primary', 'backup', 'unassigned']),
  customerCreditPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict();

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_MODEL_CONFIG' }, { status: 400 });

  const registryModel = findRegistryModel(parsed.data.modelKey);
  if (!registryModel) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  if (parsed.data.enabled && !registryModel.activationSupported) {
    return NextResponse.json({ error: 'MODEL_ACTIVATION_UNSUPPORTED' }, { status: 409 });
  }
  if (parsed.data.routingRole !== 'unassigned' && !parsed.data.enabled) {
    return NextResponse.json({ error: 'MODEL_ROLE_REQUIRES_ENABLED' }, { status: 400 });
  }
  if (parsed.data.routingRole !== 'unassigned' && !registryModel.activationSupported) {
    return NextResponse.json({ error: 'MODEL_ROUTING_UNSUPPORTED' }, { status: 409 });
  }

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.rpc('admin_upsert_model_runtime_config', {
    p_model_key: registryModel.key,
    p_model_id: registryModel.modelId,
    p_modality: registryModel.modality,
    p_enabled: parsed.data.enabled,
    p_routing_role: parsed.data.routingRole,
    p_customer_credit_price: parsed.data.customerCreditPrice,
    p_updated_by: access.user.id,
  });

  if (error) {
    console.error('[admin models] update failed', { code: error.code, modelKey: registryModel.key });
    return NextResponse.json({
      error: error.code === '23505' ? 'MODEL_PRIMARY_CONFLICT' : 'MODEL_CONFIG_UPDATE_FAILED',
    }, { status: 409 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'MODEL_CONFIG_UPDATE_FAILED' }, { status: 409 });
  revalidatePath('/admin');
  revalidatePath('/admin/models');

  return NextResponse.json({
    config: {
      modelKey: registryModel.key,
      enabled: Boolean(row.enabled),
      routingRole: row.routing_role,
      customerCreditPrice: row.customer_credit_price == null ? null : Number(row.customer_credit_price),
      updatedAt: row.updated_at,
    },
  });
}
