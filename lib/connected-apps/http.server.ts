import 'server-only';

/** Fixed-origin adapters only. Never forward credentials through a redirect. */
export async function connectedBody(response: Response, maxBytes = 120_000): Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel(); throw new Error('resource_not_found');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('provider_unavailable');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('resource_not_found'); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export function connectedHttp(origin: string, fetcher: typeof fetch = fetch) {
  return async (path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<Response> => {
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin || url.username || url.password) throw new Error('permission_missing');
    const response = await fetcher(url.toString(), { ...options, cache: 'no-store', redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
    if (!response.ok) {
      if (response.status === 400) {
        let code: unknown;
        try { code = JSON.parse(await connectedBody(response, 8_000)).error; } catch { /* no upstream body/log exposure */ }
        throw new Error(code === 'invalid_grant' || code === 'invalid_token' ? 'authorization_expired' : 'provider_unavailable');
      }
      await response.body?.cancel();
      throw new Error(response.status === 401 ? 'authorization_expired' : response.status === 403 ? 'permission_missing'
        : response.status === 404 ? 'resource_not_found' : response.status === 429 ? 'provider_rate_limited' : 'provider_unavailable');
    }
    return response;
  };
}
