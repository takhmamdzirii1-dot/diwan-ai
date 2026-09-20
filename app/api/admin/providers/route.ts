import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import {
  getProviderConnection,
  getServerProvider,
  providerConfigurationSummary,
  resolveServerProvider,
  type ProviderRuntimeDescriptor,
} from '@/lib/ai/providers/registry';
import { assertPublicProviderEndpoint, createSsrfSafeFetch } from '@/lib/ai/providers/endpoint-security';

const schema = z.object({
  providerId: z.string().trim().min(2).max(64),
  displayName: z.string().trim().min(1).max(80),
  adapterType: z.enum(['openai-compatible-chat', 'vercel-gateway', 'runware-media', 'microsoft-foundry-image', 'pruna-video', 'not-connected']),
  baseEndpoint: z.string().trim().min(8).max(500).nullable(),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(10_000),
  emergencyDisabled: z.boolean(),
  dailySpendLimitMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  spendCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable(),
}).strict().superRefine((value, context) => {
  if ((value.dailySpendLimitMinor == null) !== (value.spendCurrency == null)) {
    context.addIssue({ code: 'custom', message: 'INVALID_SPEND_GUARD' });
  }
});

const createSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
  displayName: z.string().trim().min(1).max(80),
  adapterType: z.literal('openai-compatible-chat'),
  baseEndpoint: z.string().trim().min(8).max(500),
}).strict();

const lifecycleSchema = z.object({
  providerId: z.string().trim().min(2).max(64),
  action: z.enum(['archive', 'delete']),
}).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function refreshProviderPaths() {
  revalidatePath('/admin');
  revalidatePath('/admin/providers');
  revalidatePath('/admin/models');
  revalidatePath('/admin/audit');
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_CONFIG' }, { status: 400 });
  let endpoint: string;
  try { endpoint = await assertPublicProviderEndpoint(parsed.data.baseEndpoint); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : 'PROVIDER_ENDPOINT_UNSAFE' }, { status: 400 }); }
  if (getServerProvider(parsed.data.slug)) return NextResponse.json({ error: 'PROVIDER_IDENTITY_EXISTS' }, { status: 409 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.from('provider_runtime_configs').insert({
    provider_id: parsed.data.slug, display_name: parsed.data.displayName,
    adapter_type: parsed.data.adapterType, base_endpoint: endpoint,
    enabled: false, archived: false, priority: 100, updated_by: access.user.id,
  }).select('provider_id,display_name,adapter_type,base_endpoint').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'PROVIDER_IDENTITY_EXISTS' : 'PROVIDER_CREATE_FAILED' }, { status: 409 });
  refreshProviderPaths();
  const configuration = providerConfigurationSummary(data.provider_id, data);
  return NextResponse.json({ provider: {
    id: data.provider_id, name: data.display_name, adapterType: data.adapter_type,
    baseEndpoint: data.base_endpoint, modalities: ['chat'], enabled: false,
    configured: configuration.configured, priority: 100, emergencyDisabled: false,
    dailySpendLimitMinor: null, spendCurrency: null, archived: false,
  } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_CONFIG' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data: current, error: loadError } = await client.from('provider_runtime_configs')
    .select('provider_id,display_name,adapter_type,base_endpoint,archived').eq('provider_id', parsed.data.providerId).maybeSingle();
  if (loadError || !current) return NextResponse.json({ error: 'PROVIDER_NOT_FOUND' }, { status: 404 });
  const registered = getServerProvider(parsed.data.providerId);
  const expectedAdapter = registered?.adapter ?? current.adapter_type;
  if (parsed.data.adapterType !== expectedAdapter || (!registered && expectedAdapter !== 'openai-compatible-chat')) {
    return NextResponse.json({ error: 'PROVIDER_CODE_ADAPTER_REQUIRED' }, { status: 409 });
  }
  let endpoint = current.base_endpoint as string | null;
  if (parsed.data.baseEndpoint) {
    if (expectedAdapter !== 'openai-compatible-chat') return NextResponse.json({ error: 'PROVIDER_CODE_ADAPTER_REQUIRED' }, { status: 409 });
    try { endpoint = await assertPublicProviderEndpoint(parsed.data.baseEndpoint); }
    catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : 'PROVIDER_ENDPOINT_UNSAFE' }, { status: 400 }); }
  }
  const descriptor: ProviderRuntimeDescriptor = { ...current, display_name: parsed.data.displayName, base_endpoint: endpoint };
  const provider = resolveServerProvider(parsed.data.providerId, descriptor);
  if (!provider) return NextResponse.json({ error: 'PROVIDER_CODE_ADAPTER_REQUIRED' }, { status: 409 });
  const configuration = providerConfigurationSummary(provider.id, descriptor);
  if (parsed.data.enabled && !configuration.configured) return NextResponse.json({ error: 'PROVIDER_CREDENTIALS_MISSING' }, { status: 409 });
  if (current.archived && parsed.data.enabled) return NextResponse.json({ error: 'PROVIDER_ARCHIVED' }, { status: 409 });
  const { data: row, error } = await client.from('provider_runtime_configs').update({
    display_name: parsed.data.displayName, adapter_type: expectedAdapter, base_endpoint: endpoint,
    enabled: parsed.data.enabled, priority: parsed.data.priority,
    emergency_disabled: parsed.data.emergencyDisabled,
    daily_spend_limit_minor: parsed.data.dailySpendLimitMinor,
    spend_currency: parsed.data.spendCurrency, updated_by: access.user.id,
  }).eq('provider_id', provider.id)
    .select('display_name,adapter_type,base_endpoint,enabled,priority,emergency_disabled,daily_spend_limit_minor,spend_currency,archived').single();
  if (error) return NextResponse.json({ error: 'PROVIDER_CONFIG_UPDATE_FAILED' }, { status: 409 });
  if (!row) return NextResponse.json({ error: 'PROVIDER_CONFIG_UPDATE_FAILED' }, { status: 409 });
  refreshProviderPaths();
  return NextResponse.json({
    config: {
      providerId: provider.id,
      displayName: row.display_name,
      adapterType: row.adapter_type,
      baseEndpoint: row.base_endpoint,
      enabled: Boolean(row.enabled),
      configured: configuration.configured,
      priority: Number(row.priority),
      emergencyDisabled: Boolean(row.emergency_disabled),
      dailySpendLimitMinor: row.daily_spend_limit_minor == null
        ? null : String(row.daily_spend_limit_minor),
      spendCurrency: row.spend_currency == null ? null : String(row.spend_currency),
      archived: Boolean(row.archived),
    },
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = z.object({ providerId: z.string().trim().min(2).max(64) }).strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_TEST' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data: config, error } = await client.from('provider_runtime_configs')
    .select('provider_id,display_name,adapter_type,base_endpoint,archived').eq('provider_id', parsed.data.providerId).maybeSingle();
  if (error || !config) return NextResponse.json({ error: 'PROVIDER_NOT_FOUND' }, { status: 404 });
  const connection = getProviderConnection(parsed.data.providerId, config);
  if (!connection || connection.provider.adapter !== 'openai-compatible-chat') return NextResponse.json({ error: 'PROVIDER_TEST_UNSUPPORTED' }, { status: 409 });
  if (!connection.configured || !connection.apiKey || !connection.baseUrl) return NextResponse.json({ error: 'PROVIDER_CREDENTIALS_MISSING' }, { status: 409 });
  try {
    const response = await createSsrfSafeFetch(connection.baseUrl)(`${connection.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${connection.apiKey}` }, signal: AbortSignal.timeout(8_000), cache: 'no-store',
    });
    await response.body?.cancel();
    if (!response.ok) return NextResponse.json({ error: 'PROVIDER_TEST_FAILED' }, { status: 409 });
    return NextResponse.json({ status: 'ready' });
  } catch (cause) {
    const code = cause instanceof Error && /^PROVIDER_/.test(cause.message) ? cause.message : 'PROVIDER_TEST_FAILED';
    return NextResponse.json({ error: code }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = lifecycleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_LIFECYCLE_ACTION' }, { status: 400 });
  if (parsed.data.action === 'delete' && getServerProvider(parsed.data.providerId)) return NextResponse.json({ error: 'PROVIDER_CODE_REGISTERED_ARCHIVE_REQUIRED' }, { status: 409 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.rpc('admin_archive_or_delete_provider', {
    p_provider_id: parsed.data.providerId, p_hard_delete: parsed.data.action === 'delete', p_updated_by: access.user.id,
  });
  if (error) {
    const known = /PROVIDER_(?:REFERENCED_ARCHIVE_REQUIRED|NOT_FOUND)/.exec(error.message)?.[0];
    return NextResponse.json({ error: known ?? 'PROVIDER_LIFECYCLE_UPDATE_FAILED' }, { status: known === 'PROVIDER_NOT_FOUND' ? 404 : 409 });
  }
  refreshProviderPaths();
  return NextResponse.json({ action: data });
}
