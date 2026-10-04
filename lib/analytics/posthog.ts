/** Shared allowlist for browser and trusted server conversions. Never forward
 * arbitrary SDK, URL, form, authentication or payment metadata. */
export const POSTHOG_EVENTS = ['landing_view', 'pricing_view', 'cta_click', 'signup_started',
  'signup_completed', 'plan_selected', 'checkout_started', 'payment_method_selected',
  'payment_success', 'payment_failed'] as const;
export type AnalyticsEvent = typeof POSTHOG_EVENTS[number];
export type BrowserAnalyticsEvent = Exclude<AnalyticsEvent, 'signup_completed' | 'payment_success'>;
export const ANALYTICS_CONSENT_KEY = 'vantra_marketing_consent';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeAnalyticsProxyHeaders(input: Headers): Headers {
  const headers = new Headers();
  for (const name of ['accept', 'accept-encoding', 'content-type', 'content-encoding', 'content-length', 'cache-control']) {
    const value = input.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/** Only static public paths. Never forward IDs, OAuth/payment query strings or hashes. */
export function publicAnalyticsPath(path: string): string | null {
  const normalized = path.replace(/\/$/, '') || '/';
  return /^(?:\/|\/(?:en|fr|ar)(?:\/go\/(?:all-ai|ai-in-dzd|creators)|\/(?:signup|pricing|checkout))?|\/(?:signup|pricing|checkout))$/.test(normalized)
    ? normalized : null;
}

export function replayAllowed(location: { pathname: string; search: string; hash: string }) {
  if (!publicAnalyticsPath(location.pathname) || (location.hash && !/^#(?:pricing|faq|showcase|models|why-vantra|how)$/.test(location.hash))) return false;
  // OAuth codes, payment references, names and arbitrary campaign values must not enter rrweb metadata.
  return [...new URLSearchParams(location.search)].every(([key, value]) =>
    (['utm_source', 'utm_campaign', 'utm_content', 'utm_medium'].includes(key) && /^[A-Za-z0-9_-]{1,100}$/.test(value))
    || (['fbclid', 'gclid', 'msclkid'].includes(key) && /^[A-Za-z0-9_-]{1,500}$/.test(value)));
}

/** Replay diagnostics retain only status/timing, never request URLs or payloads. */
export function safeReplayNetwork(input: Record<string, unknown>) {
  const output: Record<string, unknown> = { name: 'https://joinvantra.com/network/request', entryType: 'resource', duration: 0, startTime: 0 };
  for (const key of ['duration', 'startTime', 'endTime', 'timeOrigin', 'timestamp', 'status']) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0) output[key] = input[key];
  }
  if (typeof input.method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(input.method)) output.method = input.method;
  if (input.isInitial === true) output.isInitial = true;
  return output;
}

/** DOM text/attributes are masked by rrweb; sanitize its non-DOM channels too. */
export function safeReplaySnapshots(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap(snapshot => {
    if (!snapshot || typeof snapshot !== 'object') return [];
    if (snapshot.type === 4) return [{ ...snapshot, data: { ...snapshot.data, href: 'https://joinvantra.com' } }];
    if (snapshot.type === 5) return []; // Custom customer/plugin payloads are not needed.
    if (snapshot.type === 6) {
      if (snapshot.data?.plugin === 'rrweb/console@1') {
        if (snapshot.data.payload?.level !== 'error') return [];
        return [{ ...snapshot, data: { plugin: 'rrweb/console@1', payload: { level: 'error', trace: [], payload: ['"[redacted console error]"'] } } }];
      }
      if (snapshot.data?.plugin === 'rrweb/network@1') {
        const payload = snapshot.data.payload;
        const requests = Array.isArray(payload?.requests) ? payload.requests : Array.isArray(payload) ? payload : [payload];
        return [{ ...snapshot, data: { plugin: 'rrweb/network@1', payload: {
          requests: requests.filter(item => item && typeof item === 'object').slice(0, 100).map(safeReplayNetwork),
        } } }];
      }
      return []; // Never forward an unknown recorder plugin's arbitrary data.
    }
    return [snapshot];
  });
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
  const ambient = ['$pageview', '$pageleave', '$autocapture', '$rageclick', '$dead_click', '$web_vitals', '$$heatmap'];
  if (!POSTHOG_EVENTS.includes(event.event as AnalyticsEvent) && !['$identify', '$snapshot', ...ambient].includes(event.event)) return null;
  const properties: Record<string, unknown> = { ...safeAnalyticsProperties(event.properties), $geoip_disable: true };
  for (const key of ['distinct_id', '$anon_distinct_id', '$insert_id', '$session_id', '$window_id']) {
    const value = event.properties[key];
    if (typeof value === 'string' && UUID.test(value)) properties[key] = value;
  }
  if (event.event === '$identify' && !UUID.test(String(properties.distinct_id ?? ''))) return null;
  const token = event.properties.token;
  if (typeof token === 'string' && /^phc_[A-Za-z0-9_-]{8,200}$/.test(token)) properties.token = token;
  if (ambient.includes(event.event)) {
    try {
      const url = new URL(String(event.properties.$current_url));
      const path = publicAnalyticsPath(url.pathname);
      if (url.origin !== 'https://joinvantra.com' || !path || !replayAllowed(url)) return null;
      properties.$current_url = `${url.origin}${path}`;
      properties.$pathname = path;
      properties.$host = url.host;
    } catch { return null; }
  }
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  if (['$autocapture', '$rageclick', '$dead_click'].includes(event.event)) {
    if (['click', 'change', 'submit'].includes(String(event.properties.$event_type))) properties.$event_type = event.properties.$event_type;
    const elements = event.properties.$elements;
    if (Array.isArray(elements)) properties.$elements = elements.slice(0, 12).map(element => ({
      tag_name: /^[a-z]{1,16}$/.test(element.tag_name) ? element.tag_name : 'div',
      ...(finite(element.nth_child) ? { nth_child: element.nth_child } : {}),
      ...(finite(element.nth_of_type) ? { nth_of_type: element.nth_of_type } : {}),
    }));
    properties.$elements_chain = (properties.$elements as { tag_name: string; nth_child?: number }[] ?? [])
      .map(element => `${element.tag_name}:nth-child="${element.nth_child ?? 1}"`).join(';');
  }
  if (event.event === '$web_vitals') {
    for (const metric of ['LCP', 'CLS', 'FCP', 'INP', 'TTFB']) {
      const value = event.properties[`$web_vitals_${metric}_value`];
      if (finite(value)) {
        properties[`$web_vitals_${metric}_value`] = value;
        const detail = event.properties[`$web_vitals_${metric}_event`] as Record<string, unknown> | undefined;
        properties[`$web_vitals_${metric}_event`] = { name: metric, value,
          ...(detail && ['good', 'needs-improvement', 'poor'].includes(String(detail.rating)) ? { rating: detail.rating } : {}) };
      }
    }
  }
  if (event.event === '$$heatmap') {
    const data = event.properties.$heatmap_data;
    if (!data || typeof data !== 'object') return null;
    properties.$heatmap_data = Object.fromEntries(Object.entries(data).flatMap(([url, points]) => {
      try {
        const parsed = new URL(url); const path = publicAnalyticsPath(parsed.pathname);
        if (parsed.origin !== 'https://joinvantra.com' || !path || !Array.isArray(points)) return [];
        return [[`https://joinvantra.com${path}`, points.slice(0, 500).filter(point => finite(point.x) && finite(point.y)
          && ['click', 'mousemove', 'rageclick', 'deadclick'].includes(point.type)).map(point => ({ x: point.x, y: point.y, type: point.type, target_fixed: point.target_fixed === true }))]];
      } catch { return []; }
    }));
    if (!Object.keys(properties.$heatmap_data).length) return null;
  }
  if (event.event === '$snapshot') {
    // rrweb data is already masked by the recorder. No arbitrary event/person properties.
    if (!UUID.test(String(properties.$session_id ?? '')) || !UUID.test(String(properties.$window_id ?? ''))) return null;
    properties.$snapshot_data = safeReplaySnapshots(event.properties.$snapshot_data);
    if (!(properties.$snapshot_data as unknown[]).length) return null;
    if (finite(event.properties.$snapshot_bytes)) properties.$snapshot_bytes = event.properties.$snapshot_bytes;
  }
  return { ...event, $set: undefined, $set_once: undefined, properties };
}
