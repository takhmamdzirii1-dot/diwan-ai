/** Shared allowlist for browser and trusted server conversions. Never forward
 * arbitrary SDK, URL, form, authentication or payment metadata. */
export const POSTHOG_EVENTS = ['landing_view', 'pricing_view', 'cta_click', 'signup_started',
  'signup_completed', 'plan_selected', 'checkout_started', 'payment_method_selected',
  'payment_success', 'payment_failed'] as const;
export type AnalyticsEvent = typeof POSTHOG_EVENTS[number];
export type BrowserAnalyticsEvent = Exclude<AnalyticsEvent, 'signup_completed' | 'payment_success'>;
export const ANALYTICS_CONSENT_KEY = 'vantra_marketing_consent';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only static public paths. Never forward IDs, OAuth/payment query strings or hashes. */
export function publicAnalyticsPath(path: string): string | null {
  const normalized = path.replace(/\/$/, '') || '/';
  return /^(?:\/|\/(?:en|fr|ar)(?:\/go\/(?:all-ai|ai-in-dzd|creators)|\/(?:signup|pricing|checkout))?|\/(?:signup|pricing|checkout))$/.test(normalized)
    ? normalized : null;
}

export function replayAllowed(location: { pathname: string; search: string; hash: string }) {
  if (!publicAnalyticsPath(location.pathname) || location.hash) return false;
  // OAuth codes, payment references, names and arbitrary campaign values must not enter rrweb metadata.
  return [...new URLSearchParams(location.search)].every(([key, value]) =>
    ['utm_source', 'utm_campaign', 'utm_content', 'utm_medium'].includes(key) && /^[A-Za-z0-9_-]{1,100}$/.test(value));
}

export function posthogConfiguration(env: { NEXT_PUBLIC_POSTHOG_KEY?: string; NEXT_PUBLIC_POSTHOG_HOST?: string }) {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !/^phc_[A-Za-z0-9_-]{8,200}$/.test(key)
    || !['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host ?? '')) return null;
  return { key, host: host! };
}

export function safeAnalyticsProperties(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const value = input as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_campaign', 'utm_content', 'utm_medium']) {
    // Campaign identifiers only. Reject URLs, email addresses, free text,
    // filenames and control characters rather than attempting to redact them.
    if (typeof value[key] === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value[key])) result[key] = value[key];
  }
  const enums: Record<string, string[]> = {
    landing_variant: ['home', 'all-ai', 'ai-in-dzd', 'creators'], locale: ['en', 'fr', 'ar'],
    plan: ['free', 'lite', 'pro', 'max'], payment_method: ['baridimob', 'ccp', 'cib', 'edahabia'],
    error_code: ['PAYMENT_REJECTED', 'PAYMENT_ORDER_CREATE_FAILED', 'PAYMENT_SUBMISSION_FAILED', 'GATEWAY_UNAVAILABLE'],
  };
  for (const [key, allowed] of Object.entries(enums)) {
    if (typeof value[key] === 'string' && allowed.includes(value[key])) result[key] = value[key];
  }
  return result;
}

/** Defense in depth: also strip PostHog's automatically attached URLs,
 * referrers, browser/device properties and person properties at the wire. */
export function safePosthogWireEvent<T extends { event: string; properties: Record<string, unknown> }>(event: T): T | null {
  if (event.event === 'payment_success' || event.event === 'signup_completed') return null; // Server outcomes only.
  if (!POSTHOG_EVENTS.includes(event.event as AnalyticsEvent) && !['$identify', '$pageview', '$snapshot'].includes(event.event)) return null;
  const properties: Record<string, unknown> = { ...safeAnalyticsProperties(event.properties), $geoip_disable: true };
  for (const key of ['distinct_id', '$anon_distinct_id', '$insert_id', '$session_id', '$window_id']) {
    const value = event.properties[key];
    if (typeof value === 'string' && UUID.test(value)) properties[key] = value;
  }
  if (event.event === '$identify' && !UUID.test(String(properties.distinct_id ?? ''))) return null;
  const token = event.properties.token;
  if (typeof token === 'string' && /^phc_[A-Za-z0-9_-]{8,200}$/.test(token)) properties.token = token;
  if (event.event === '$pageview') {
    try {
      const url = new URL(String(event.properties.$current_url));
      const path = publicAnalyticsPath(url.pathname);
      if (url.origin !== 'https://joinvantra.com' || !path || url.search || url.hash) return null;
      properties.$current_url = `${url.origin}${path}`;
      properties.$pathname = path;
      properties.$host = url.host;
    } catch { return null; }
  }
  if (event.event === '$snapshot') {
    // rrweb data is already masked by the recorder. No arbitrary event/person properties.
    if (!UUID.test(String(properties.$session_id ?? '')) || !UUID.test(String(properties.$window_id ?? ''))) return null;
    for (const key of ['$snapshot_data', '$snapshot_bytes']) {
      if (event.properties[key] !== undefined) properties[key] = event.properties[key];
    }
  }
  return { ...event, $set: undefined, $set_once: undefined, properties };
}
