import 'server-only';
import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { META_EVENTS, metaConfiguration, sanitizeAttribution } from './marketing';

export function scheduleMetaConversion(input: {
  event: string; id: string; subject: string; consent: boolean; acquisition?: unknown;
  valueDzd?: number; occurredAt?: string;
}) {
  const config = metaConfiguration(process.env);
  const eventName = META_EVENTS[input.event];
  if (!config || !eventName || !input.consent) return;
  const attribution = sanitizeAttribution(input.acquisition);
  const firstSeen = Date.parse(attribution.first_seen ?? '');
  const eventTime = input.occurredAt ? Date.parse(input.occurredAt) : Date.now();
  const event = {
    event_name: eventName, event_id: input.id, event_time: Math.floor(eventTime / 1000),
    action_source: 'website', event_source_url: 'https://joinvantra.com',
    user_data: {
      external_id: [createHash('sha256').update(input.subject).digest('hex')],
      ...(attribution.fbclid && Number.isFinite(firstSeen) ? { fbc: `fb.1.${firstSeen}.${attribution.fbclid}` } : {}),
    },
    ...(typeof input.valueDzd === 'number' && Number.isFinite(input.valueDzd) && input.valueDzd >= 0
      ? { custom_data: { currency: 'DZD', value: input.valueDzd } } : {}),
  };
  // No email, IP, prompts, proof URLs or credentials in event data. One bounded
  // best-effort attempt after response; never blocks authoritative settlement.
  try {
    after(async () => {
      try {
        const response = await fetch(`https://graph.facebook.com/${config.version}/${config.pixelId}/events`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ access_token: config.token, data: [event] }),
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) console.warn('[marketing] Meta delivery failed', { event: input.event, status: response.status });
      } catch { console.warn('[marketing] Meta delivery unavailable', { event: input.event }); }
    });
  } catch { /* No request lifetime (e.g. CLI): do not launch an unawaited request. */ }
}
