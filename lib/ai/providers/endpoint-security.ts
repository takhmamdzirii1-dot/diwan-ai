import 'server-only';

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const blockedNames = new Set([
  'localhost', 'localhost.localdomain', 'metadata', 'metadata.google.internal',
  'instance-data', 'instance-data.ec2.internal',
]);

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

function isBlockedIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  if (isIP(normalized) === 4) return isBlockedIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fe8')
    || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')
    || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isBlockedIpv4(mapped) : false;
}

export function validateProviderEndpoint(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('PROVIDER_ENDPOINT_INVALID'); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || !hostname
    || blockedNames.has(hostname) || hostname.endsWith('.localhost')
    || hostname.endsWith('.local') || hostname.endsWith('.internal')
    || (isIP(hostname) !== 0 && isBlockedIp(hostname))) {
    throw new Error('PROVIDER_ENDPOINT_UNSAFE');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export async function assertPublicProviderEndpoint(value: string) {
  const endpoint = validateProviderEndpoint(value);
  const hostname = new URL(endpoint).hostname;
  const results = await lookup(hostname, { all: true, verbatim: true });
  if (!results.length || results.some((result) => isBlockedIp(result.address))) {
    throw new Error('PROVIDER_ENDPOINT_UNSAFE');
  }
  return endpoint;
}

export function createSsrfSafeFetch(configuredEndpoint: string): typeof fetch {
  const configured = new URL(validateProviderEndpoint(configuredEndpoint));
  return async (input, init) => {
    const requested = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (requested.origin !== configured.origin) throw new Error('PROVIDER_ENDPOINT_UNSAFE');
    await assertPublicProviderEndpoint(requested.toString());
    const response = await fetch(input, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) throw new Error('PROVIDER_UNSAFE_REDIRECT');
    return response;
  };
}
