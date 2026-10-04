import 'server-only';
import { after } from 'next/server';
import { UUID, posthogConfiguration, safeAnalyticsProperties } from './posthog';

export function schedulePosthogConversion(input: {
  event: 'signup_completed' | 'payment_success' | 'payment_failed';
  userId: string; id: string; consent: boolean;
  properties: Record<string, unknown> | (() => Promise<Record<string, unknown> | null>); occurredAt?: string;
}) {
  const config = posthogConfiguration({ NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST });
  if (!config || !input.consent || !UUID.test(input.userId) || !UUID.test(input.id)) return;
  const timestamp = input.occurredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(timestamp))) return;
  try {
    after(async () => {
      try {
        const properties = typeof input.properties === 'function' ? await input.properties() : input.properties;
        if (!properties) return;
        const payload = { api_key: config.key, event: input.event, timestamp,
          properties: { ...safeAnalyticsProperties(properties), distinct_id: input.userId,
            $insert_id: input.id, $geoip_disable: true, $ip: null } };
        const response = await fetch(`${config.host}/capture/`, { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000) });
        if (!response.ok) console.warn('[analytics] PostHog conversion unavailable', { event: input.event, status: response.status });
      } catch { console.warn('[analytics] PostHog conversion unavailable', { event: input.event }); }
    });
  } catch { /* No request lifetime: no unbounded fire-and-forget request. */ }
}
