import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { emptyModelCapabilities } from '@/lib/models/capabilities';
import { resolveRuntimeModelReference } from '@/lib/models/runtime-config';
import { providerConfigurationSummary } from '@/lib/ai/providers/registry';
import { isHierarchicalAllowedPlans, MODEL_PLAN_CODES } from '@/lib/models/plan-entitlements';

const schema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  enabled: z.boolean(),
  routingRole: z.enum(['primary', 'backup', 'unassigned']),
  customerCreditPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  allowedPlans: z.array(z.enum(MODEL_PLAN_CODES)).min(1).max(MODEL_PLAN_CODES.length),
}).strict().refine((value) => new Set(value.allowedPlans).size === value.allowedPlans.length
  && isHierarchicalAllowedPlans(value.allowedPlans), { path: ['allowedPlans'] });

const createSchema = z.object({
  stableId: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(80),
  modality: z.enum(['chat', 'image', 'video']),
  brand: z.string().trim().max(60).optional(),
}).strict();

const lifecycleSchema = z.object({
  modelKey: z.string().trim().min(1).max(300),
  action: z.enum(['archive', 'delete']),
}).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_MODEL_IDENTITY' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const modelKey = `custom:${parsed.data.modality}:${parsed.data.stableId}`;
  const modelId = `vantra-${parsed.data.stableId}`;
  const { data, error } = await client.from('model_runtime_configs').insert({
    model_key: modelKey,
    model_id: modelId,
    modality: parsed.data.modality,
    enabled: false,
    routing_role: 'unassigned',
    customer_credit_price: null,
    customer_display_name: parsed.data.displayName,
    customer_category: parsed.data.brand?.length ? parsed.data.brand : null,
    customer_sort_order: 100,
    studio_visible: false,
    capabilities: emptyModelCapabilities(parsed.data.modality),
    allowed_plans: ['max'],
    updated_by: access.user.id,
  }).select('model_key,model_id,modality,customer_display_name,capabilities,updated_at').single();
  if (error) {
    return NextResponse.json({ error: error.code === '23505' ? 'MODEL_IDENTITY_EXISTS' : 'MODEL_CREATE_FAILED' }, { status: 409 });
  }
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  return NextResponse.json({ model: {
    key: String(data.model_key), modelId: String(data.model_id), modality: data.modality,
    displayName: String(data.customer_display_name), capabilities: data.capabilities,
    updatedAt: String(data.updated_at),
  } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_MODEL_CONFIG' }, { status: 400 });

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const registryModel = await resolveRuntimeModelReference(client, parsed.data.modelKey);
  if (!registryModel) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  const { data: lifecycle } = await client.from('model_runtime_configs')
    .select('archived').eq('model_key', registryModel.key).maybeSingle();
  if (lifecycle?.archived) return NextResponse.json({ error: 'MODEL_ARCHIVED' }, { status: 409 });
  if (parsed.data.enabled && !registryModel.activationSupported) {
    return NextResponse.json({ error: 'MODEL_ACTIVATION_UNSUPPORTED' }, { status: 409 });
  }
  if (parsed.data.routingRole !== 'unassigned' && !parsed.data.enabled) {
    return NextResponse.json({ error: 'MODEL_ROLE_REQUIRES_ENABLED' }, { status: 400 });
  }
  if (parsed.data.routingRole !== 'unassigned' && !registryModel.activationSupported) {
    return NextResponse.json({ error: 'MODEL_ROUTING_UNSUPPORTED' }, { status: 409 });
  }

  if (parsed.data.enabled) {
    const { data: routes, error: routeError } = await client.from('model_provider_routes')
      .select('provider_id').eq('model_key', registryModel.key).eq('enabled', true);
    if (routeError) return NextResponse.json({ error: 'MODEL_ROUTE_CHECK_FAILED' }, { status: 503 });
    const providerIds = [...new Set((routes ?? []).map((route) => String(route.provider_id)))];
    const { data: providers, error: providerError } = providerIds.length
      ? await client.from('provider_runtime_configs').select('provider_id,enabled,emergency_disabled,display_name,adapter_type,base_endpoint,archived').in('provider_id', providerIds)
      : { data: [], error: null };
    if (providerError) return NextResponse.json({ error: 'MODEL_ROUTE_CHECK_FAILED' }, { status: 503 });
    const activeProviders = new Set((providers ?? [])
      .filter((provider) => provider.enabled && !provider.archived && !provider.emergency_disabled)
      .map((provider) => String(provider.provider_id)));
    const readyRoute = providerIds.some((providerId) =>
      activeProviders.has(providerId)
        && providerConfigurationSummary(providerId, providers?.find((provider) => provider.provider_id === providerId)).configured);
    if (!readyRoute) return NextResponse.json({ error: 'MODEL_REQUIRES_CONFIGURED_ROUTE' }, { status: 409 });
  }
  const { data, error } = await client.rpc('admin_upsert_model_runtime_config_v2', {
    p_model_key: registryModel.key,
    p_model_id: registryModel.modelId,
    p_modality: registryModel.modality,
    p_enabled: parsed.data.enabled,
    p_routing_role: parsed.data.routingRole,
    p_customer_credit_price: parsed.data.customerCreditPrice,
    p_allowed_plans: parsed.data.allowedPlans,
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
  revalidatePath('/admin/audit');

  return NextResponse.json({
    config: {
      modelKey: registryModel.key,
      enabled: Boolean(row.enabled),
      routingRole: row.routing_role,
      customerCreditPrice: row.customer_credit_price == null ? null : Number(row.customer_credit_price),
      allowedPlans: row.allowed_plans,
      updatedAt: row.updated_at,
    },
  });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_MODEL_LIFECYCLE_ACTION' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const model = await resolveRuntimeModelReference(client, parsed.data.modelKey);
  if (!model) return NextResponse.json({ error: 'MODEL_NOT_REGISTERED' }, { status: 404 });
  if (parsed.data.action === 'delete' && !model.key.startsWith('custom:')) {
    return NextResponse.json({ error: 'MODEL_CODE_REGISTERED_ARCHIVE_REQUIRED' }, { status: 409 });
  }
  const { data, error } = await client.rpc('admin_archive_or_delete_model', {
    p_model_key: model.key, p_model_id: model.modelId, p_modality: model.modality,
    p_hard_delete: parsed.data.action === 'delete', p_updated_by: access.user.id,
  });
  if (error) {
    const known = /MODEL_(?:REFERENCED_ARCHIVE_REQUIRED|NOT_FOUND)/.exec(error.message)?.[0];
    return NextResponse.json({ error: known ?? 'MODEL_LIFECYCLE_UPDATE_FAILED' }, { status: known === 'MODEL_NOT_FOUND' ? 404 : 409 });
  }
  revalidatePath('/admin');
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
  return NextResponse.json({ action: data });
}
