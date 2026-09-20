import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import type { EffectiveRuntimeModel } from '@/lib/models/runtime-config';
import { getProviderConnection, type ProviderRuntimeDescriptor } from './registry';

export type ResolvedProviderRoute = {
  id: string;
  modelKey: string;
  modelId: string;
  modality: 'chat' | 'image' | 'video';
  providerId: string;
  providerModelId: string;
  priority: number;
  fallback: boolean;
  providerConfig: ProviderRuntimeDescriptor;
};

type ProviderConfigRow = {
  provider_id: string;
  enabled: boolean;
  priority: number;
  emergency_disabled: boolean;
  daily_spend_limit_minor: number | string | null;
  spend_currency: string | null;
  circuit_open_until: string | null;
  display_name: string | null;
  adapter_type: string | null;
  base_endpoint: string | null;
  archived: boolean;
};

export class ProviderRoutingError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ProviderRoutingError';
  }
}

async function isSpendLimitReached(client: SupabaseClient, config: ProviderConfigRow) {
  if (config.daily_spend_limit_minor == null || !config.spend_currency) return false;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await client.from('provider_cost_records')
    .select('actual_cost_minor')
    .eq('provider', config.provider_id)
    .eq('currency', config.spend_currency)
    .gte('created_at', start.toISOString());
  if (error) throw new ProviderRoutingError('PROVIDER_SPEND_GUARD_UNAVAILABLE');
  const spent = (data ?? []).reduce(
    (sum, row) => sum + BigInt(row.actual_cost_minor == null ? 0 : String(row.actual_cost_minor)),
    0n
  );
  return spent >= BigInt(String(config.daily_spend_limit_minor));
}

export async function resolveProviderRoutes(
  model: EffectiveRuntimeModel,
  client?: SupabaseClient
): Promise<ResolvedProviderRoute[]> {
  const serverClient = client ?? getSupabaseAdminClient();
  if (!serverClient) throw new ProviderRoutingError('PROVIDER_ROUTING_UNAVAILABLE');

  const [{ data: routeRows, error: routeError }, { data: configRows, error: configError }] =
    await Promise.all([
      serverClient.from('model_provider_routes').select(
        'id,model_key,model_id,modality,provider_id,provider_model_id,enabled,priority,fallback'
      ).eq('model_key', model.key).eq('enabled', true),
      serverClient.from('provider_runtime_configs').select(
        'provider_id,enabled,priority,emergency_disabled,daily_spend_limit_minor,spend_currency,circuit_open_until,display_name,adapter_type,base_endpoint,archived'
      ),
    ]);
  if (routeError || configError) throw new ProviderRoutingError('PROVIDER_ROUTING_UNAVAILABLE');

  const configs = new Map(
    ((configRows ?? []) as ProviderConfigRow[]).map((row) => [row.provider_id, row])
  );
  const now = Date.now();
  const candidates: Array<ResolvedProviderRoute & { providerPriority: number }> = [];
  for (const row of routeRows ?? []) {
    if (row.model_id !== model.modelId || row.modality !== model.modality) continue;
    const config = configs.get(row.provider_id);
    const connection = getProviderConnection(row.provider_id, config);
    if (!config?.enabled || config.archived || config.emergency_disabled || !connection?.configured) continue;
    if (config.circuit_open_until && Date.parse(config.circuit_open_until) > now) continue;
    if (await isSpendLimitReached(serverClient, config)) continue;
    candidates.push({
      id: row.id,
      modelKey: row.model_key,
      modelId: row.model_id,
      modality: row.modality,
      providerId: row.provider_id,
      providerModelId: row.provider_model_id,
      priority: Number(row.priority),
      fallback: Boolean(row.fallback),
      providerConfig: config,
      providerPriority: Number(config.priority),
    });
  }
  candidates.sort((a, b) =>
    Number(a.fallback) - Number(b.fallback)
    || a.priority - b.priority
    || a.providerPriority - b.providerPriority
  );
  if (!candidates.length) throw new ProviderRoutingError('NO_CONFIGURED_PROVIDER_ROUTE');
  return candidates.map(({ providerPriority: _providerPriority, ...route }) => route);
}

export function routeSnapshot(route: ResolvedProviderRoute) {
  return {
    routeId: route.id,
    provider: route.providerId,
    providerModel: route.providerModelId,
    priority: route.priority,
    fallback: route.fallback,
  };
}
