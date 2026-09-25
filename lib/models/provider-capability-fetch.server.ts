import 'server-only';

import { getProviderConnection, type ProviderRuntimeDescriptor } from '@/lib/ai/providers/registry';
import { normalizeProviderCapabilityMetadata, type ProviderCapabilityResult } from './provider-capability-evidence';

export async function fetchProviderCapabilityMetadata(input: {
  providerId: string; providerModelId: string; runtime: ProviderRuntimeDescriptor | null;
}): Promise<{ result: ProviderCapabilityResult | null; reason: string }> {
  if (!['openrouter', 'vercel_ai_gateway', 'orca_router'].includes(input.providerId))
    return { result: null, reason: 'provider_metadata_unavailable' };
  const connection = getProviderConnection(input.providerId, input.runtime);
  if (!connection?.configured || !connection.apiKey || !connection.baseUrl)
    return { result: null, reason: 'provider_metadata_unavailable' };
  const path = input.providerId === 'openrouter'
    ? `/model/${input.providerModelId.split('/').map(encodeURIComponent).join('/')}`
    : '/models';
  try {
    const response = await fetch(`${connection.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'GET', headers: { authorization: `Bearer ${connection.apiKey}`, accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return { result: null, reason: response.status === 404 ? 'provider_model_not_found' : 'metadata_refresh_failed' };
    const result = normalizeProviderCapabilityMetadata(input.providerId, input.providerModelId, await response.json());
    return { result, reason: result.reason };
  } catch {
    return { result: null, reason: 'metadata_refresh_failed' };
  }
}
