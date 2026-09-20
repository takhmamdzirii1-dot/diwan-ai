import 'server-only';

import { createOpenAI } from '@ai-sdk/openai';
import { getProviderConnection } from './registry';
import { createSsrfSafeFetch } from './endpoint-security';
import type { ResolvedProviderRoute } from './routes';

export class ProviderAdapterError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly retryAfterSeconds: number | null = null,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = 'ProviderAdapterError';
  }
}

export function createChatLanguageModel(route: ResolvedProviderRoute) {
  const connection = getProviderConnection(route.providerId, route.providerConfig);
  const supportsOpenAICompatibility = connection?.provider.adapter === 'openai-compatible-chat'
    || connection?.provider.adapter === 'vercel-gateway';
  if (!connection?.configured || !supportsOpenAICompatibility
    || !connection.apiKey || !connection.baseUrl) {
    throw new ProviderAdapterError('PROVIDER_NOT_CONFIGURED', false);
  }
  const provider = createOpenAI({
    baseURL: connection.baseUrl,
    apiKey: connection.apiKey,
    compatibility: 'compatible',
    fetch: connection.provider.configurable ? createSsrfSafeFetch(connection.baseUrl) : undefined,
  });
  return provider(route.providerModelId);
}

export function classifyProviderFailure(cause: unknown) {
  if (cause instanceof ProviderAdapterError) return cause;
  const message = cause instanceof Error ? cause.message : 'PROVIDER_EXECUTION_FAILED';
  const status = typeof cause === 'object' && cause
    && 'statusCode' in cause && typeof cause.statusCode === 'number'
    ? cause.statusCode
    : null;
  const responseHeaders = typeof cause === 'object' && cause
    && 'responseHeaders' in cause && cause.responseHeaders
    && typeof cause.responseHeaders === 'object'
    ? cause.responseHeaders as Record<string, string>
    : null;
  const retryAfterValue = responseHeaders?.['retry-after'] ?? responseHeaders?.['Retry-After'];
  const retryAfterSeconds = retryAfterValue && /^\d+$/.test(retryAfterValue)
    ? Math.min(300, Number(retryAfterValue))
    : null;
  const retryable = status === 408 || status === 409 || status === 429
    || (status != null && status >= 500)
    || /timeout|network|temporar|rate.?limit|unavailable/i.test(message);
  return new ProviderAdapterError(
    retryable ? 'PROVIDER_TRANSIENT_FAILURE' : 'PROVIDER_EXECUTION_FAILED',
    retryable,
    retryAfterSeconds,
    { cause }
  );
}
