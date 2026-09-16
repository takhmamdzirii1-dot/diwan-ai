import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getServerProvider, providerConfigurationSummary } from '@/lib/ai/providers/registry';

const schema = z.object({
  providerId: z.string().trim().min(2).max(64),
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

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROVIDER_CONFIG' }, { status: 400 });
  const provider = getServerProvider(parsed.data.providerId);
  if (!provider) return NextResponse.json({ error: 'PROVIDER_NOT_REGISTERED' }, { status: 404 });
  const configuration = providerConfigurationSummary(provider.id);
  if (parsed.data.enabled && !configuration.configured) {
    return NextResponse.json({ error: 'PROVIDER_CREDENTIALS_MISSING' }, { status: 409 });
  }

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.rpc('admin_upsert_provider_runtime_config', {
    p_provider_id: provider.id,
    p_enabled: parsed.data.enabled,
    p_priority: parsed.data.priority,
    p_emergency_disabled: parsed.data.emergencyDisabled,
    p_daily_spend_limit_minor: parsed.data.dailySpendLimitMinor,
    p_spend_currency: parsed.data.spendCurrency,
    p_updated_by: access.user.id,
  });
  if (error) {
    console.error('[admin providers] update failed', { code: error.code, providerId: provider.id });
    return NextResponse.json({ error: 'PROVIDER_CONFIG_UPDATE_FAILED' }, { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'PROVIDER_CONFIG_UPDATE_FAILED' }, { status: 409 });
  revalidatePath('/admin');
  revalidatePath('/admin/providers');
  return NextResponse.json({
    config: {
      providerId: provider.id,
      enabled: Boolean(row.enabled),
      configured: configuration.configured,
      priority: Number(row.priority),
      emergencyDisabled: Boolean(row.emergency_disabled),
      dailySpendLimitMinor: row.daily_spend_limit_minor == null
        ? null : String(row.daily_spend_limit_minor),
      spendCurrency: row.spend_currency == null ? null : String(row.spend_currency),
    },
  });
}
