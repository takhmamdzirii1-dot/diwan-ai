import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { providerConfigurationSummary } from '@/lib/ai/providers/registry';
import { findRegistryModel } from '@/lib/models/runtime-config';

const schema = z.object({
  routeId: z.string().uuid(),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(10_000),
  fallback: z.boolean(),
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
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_ROUTE_CONFIG' }, { status: 400 });

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data: route, error: routeError } = await client.from('model_provider_routes')
    .select('id,model_key,model_id,modality,provider_id,provider_model_id')
    .eq('id', parsed.data.routeId).maybeSingle();
  if (routeError || !route) return NextResponse.json({ error: 'PROVIDER_ROUTE_NOT_FOUND' }, { status: 404 });
  const model = findRegistryModel(route.model_key);
  if (!model || model.modelId !== route.model_id || model.modality !== route.modality) {
    return NextResponse.json({ error: 'PROVIDER_ROUTE_NOT_REGISTERED' }, { status: 409 });
  }
  if (parsed.data.enabled) {
    const configuration = providerConfigurationSummary(route.provider_id);
    if (!configuration.configured) {
      return NextResponse.json({ error: 'PROVIDER_CREDENTIALS_MISSING' }, { status: 409 });
    }
    const { data: providerConfig, error: providerError } = await client.from('provider_runtime_configs')
      .select('enabled,emergency_disabled').eq('provider_id', route.provider_id).maybeSingle();
    if (providerError || !providerConfig?.enabled || providerConfig.emergency_disabled) {
      return NextResponse.json({ error: 'PROVIDER_NOT_ACTIVE' }, { status: 409 });
    }
  }

  const { data, error } = await client.rpc('admin_update_model_provider_route', {
    p_route_id: route.id,
    p_enabled: parsed.data.enabled,
    p_priority: parsed.data.priority,
    p_fallback: parsed.data.fallback,
    p_updated_by: access.user.id,
  });
  if (error) {
    const known = /PRIMARY_PROVIDER_ROUTE_EXISTS|FALLBACK_REQUIRES_PRIMARY_ROUTE/.test(error.message);
    return NextResponse.json({ error: known ? error.message : 'PROVIDER_ROUTE_UPDATE_FAILED' }, { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'PROVIDER_ROUTE_UPDATE_FAILED' }, { status: 409 });
  revalidatePath('/admin');
  revalidatePath('/admin/models');
  return NextResponse.json({ route: {
    id: String(row.id),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority),
    fallback: Boolean(row.fallback),
  } });
}
