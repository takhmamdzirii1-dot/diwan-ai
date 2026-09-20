import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { providerConfigurationSummary, resolveServerProvider } from '@/lib/ai/providers/registry';
import { resolveRuntimeModelReference } from '@/lib/models/runtime-config';

const schema = z.object({
  routeId: z.string().uuid(),
  providerModelId: z.string().trim().min(1).max(300),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(10_000),
  fallback: z.boolean(),
}).strict();

const createSchema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  providerId: z.string().trim().min(2).max(64),
  providerModelId: z.string().trim().min(1).max(300),
  priority: z.number().int().min(0).max(10_000),
  fallback: z.boolean(),
}).strict();

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_ROUTE_CONFIG' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const model = await resolveRuntimeModelReference(client, parsed.data.modelKey);
  const { data: providerConfig, error: providerLoadError } = await client.from('provider_runtime_configs')
    .select('provider_id,display_name,adapter_type,base_endpoint,enabled,emergency_disabled,archived')
    .eq('provider_id', parsed.data.providerId).maybeSingle();
  const provider = resolveServerProvider(parsed.data.providerId, providerConfig);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  const { data: modelConfig } = await client.from('model_runtime_configs')
    .select('archived').eq('model_key', model.key).maybeSingle();
  if (modelConfig?.archived) return NextResponse.json({ error: 'MODEL_ARCHIVED' }, { status: 409 });
  if (providerLoadError || providerConfig?.archived) return NextResponse.json({ error: 'PROVIDER_NOT_ACTIVE' }, { status: 409 });
  if (!provider) return NextResponse.json({ error: 'PROVIDER_CODE_ADAPTER_REQUIRED' }, { status: 409 });
  if (!provider.modalities.some((modality) => modality === model.modality)) {
    return NextResponse.json({ error: 'PROVIDER_ROUTE_INCOMPATIBLE' }, { status: 409 });
  }
  const { data, error } = await client.from('model_provider_routes').insert({
    model_key: model.key,
    model_id: model.modelId,
    modality: model.modality,
    provider_id: provider.id,
    provider_model_id: parsed.data.providerModelId,
    enabled: false,
    priority: parsed.data.priority,
    fallback: parsed.data.fallback,
    updated_by: access.user.id,
  }).select('id,provider_id,provider_model_id,enabled,priority,fallback').single();
  if (error) {
    const duplicate = error.code === '23505';
    return NextResponse.json({ error: duplicate ? 'PROVIDER_ROUTE_EXISTS' : 'PROVIDER_ROUTE_CREATE_FAILED' }, { status: 409 });
  }
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  const configuration = providerConfigurationSummary(provider.id, providerConfig);
  return NextResponse.json({ route: {
    id: String(data.id),
    providerId: String(data.provider_id),
    providerModelId: String(data.provider_model_id),
    enabled: Boolean(data.enabled),
    priority: Number(data.priority),
    fallback: Boolean(data.fallback),
    configured: configuration.configured,
    providerEnabled: Boolean(providerConfig?.enabled) && !Boolean(providerConfig?.emergency_disabled),
  } }, { status: 201 });
}

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
  const model = await resolveRuntimeModelReference(client, route.model_key);
  if (!model || model.modelId !== route.model_id || model.modality !== route.modality) {
    return NextResponse.json({ error: 'PROVIDER_ROUTE_NOT_REGISTERED' }, { status: 409 });
  }
  const { data: modelConfig } = await client.from('model_runtime_configs')
    .select('archived').eq('model_key', model.key).maybeSingle();
  if (modelConfig?.archived) return NextResponse.json({ error: 'MODEL_ARCHIVED' }, { status: 409 });
  if (parsed.data.enabled) {
    const { data: providerConfig, error: providerError } = await client.from('provider_runtime_configs')
      .select('provider_id,display_name,adapter_type,base_endpoint,enabled,emergency_disabled,archived').eq('provider_id', route.provider_id).maybeSingle();
    const configuration = providerConfigurationSummary(route.provider_id, providerConfig);
    if (!configuration.configured) return NextResponse.json({ error: 'PROVIDER_CREDENTIALS_MISSING' }, { status: 409 });
    if (providerError || !providerConfig?.enabled || providerConfig.emergency_disabled || providerConfig.archived) {
      return NextResponse.json({ error: 'PROVIDER_NOT_ACTIVE' }, { status: 409 });
    }
  }

  const { data, error } = await client.rpc('admin_update_model_provider_route_v2', {
    p_route_id: route.id,
    p_provider_model_id: parsed.data.providerModelId,
    p_enabled: parsed.data.enabled,
    p_priority: parsed.data.priority,
    p_fallback: parsed.data.fallback,
    p_updated_by: access.user.id,
  });
  if (error) {
    const known = /PRIMARY_PROVIDER_ROUTE_EXISTS|FALLBACK_REQUIRES_PRIMARY_ROUTE|DISABLE_ROUTE_BEFORE_REMAP/.test(error.message);
    return NextResponse.json({ error: known ? error.message : 'PROVIDER_ROUTE_UPDATE_FAILED' }, { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'PROVIDER_ROUTE_UPDATE_FAILED' }, { status: 409 });
  revalidatePath('/admin');
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  return NextResponse.json({ route: {
    id: String(row.id),
    providerModelId: String(row.provider_model_id),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority),
    fallback: Boolean(row.fallback),
  } });
}
