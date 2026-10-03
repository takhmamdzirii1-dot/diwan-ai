import { z } from 'zod';

export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'landing_variant', 'first_seen'] as const;
export type LandingAttribution = Partial<Record<typeof ATTRIBUTION_KEYS[number], string>>;

/** Acquisition is descriptive, never authority for price, plan or permissions. */
export function sanitizeAttribution(value: unknown): LandingAttribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: LandingAttribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== 'string') continue;
    const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, key === 'fbclid' ? 300 : 200);
    if (!clean) continue;
    if (key === 'first_seen' && !Number.isFinite(Date.parse(clean))) continue;
    if (key === 'fbclid' && !/^[A-Za-z0-9_.-]+$/.test(clean)) continue;
    result[key] = clean;
  }
  return result;
}

const location = z.enum(['header', 'hero', 'preview', 'pricing', 'final']);
const eventBase = { id: z.string().uuid(), variant: z.enum(['home', 'all-ai', 'ai-in-dzd', 'creators']), locale: z.enum(['en', 'fr', 'ar']) };
export const landingEventSchema = z.discriminatedUnion('event', [
  z.object({ ...eventBase, event: z.literal('landing_view') }).strict(),
  z.object({ ...eventBase, event: z.literal('cta_click'), location }).strict(),
  z.object({ ...eventBase, event: z.literal('pricing_select'), location: z.literal('pricing'), plan: z.enum(['free', 'pro', 'max']) }).strict(),
]);
export type LandingEvent = z.infer<typeof landingEventSchema>;
export type LandingEventInput = LandingEvent extends infer E ? E extends LandingEvent ? Omit<E, 'id'> : never : never;
export const landingBatchSchema = z.object({
  visitorId: z.string().uuid(), events: z.array(landingEventSchema).min(1).max(20),
  acquisition: z.unknown().optional(),
}).strict();

/** Existing account sign-ins must not become new signup conversions. */
export function isNewSignup(createdAt: string, startedAt: string, now = Date.now()): boolean {
  const created = Date.parse(createdAt), started = Date.parse(startedAt);
  return Number.isFinite(created) && Number.isFinite(started)
    && started <= now + 60_000 && started >= now - 7 * 86_400_000
    && created >= started - 60_000 && created <= started + 10 * 60_000;
}

export function isCompletedGeneration(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as Record<string, unknown>).state === 'completed';
}

export const META_EVENTS: Readonly<Record<string, string>> = {
  landing_view: 'PageView', cta_click: 'VantraCtaClick', pricing_select: 'VantraPricingSelect',
  signup_completed: 'CompleteRegistration', checkout_started: 'InitiateCheckout',
  payment_submitted: 'VantraPaymentSubmitted', payment_approved: 'Purchase',
  first_generation_succeeded: 'VantraFirstGeneration',
};

export function metaConfiguration(env: Record<string, string | undefined>) {
  const pixelId = env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = env.META_CAPI_ACCESS_TOKEN;
  const version = env.META_GRAPH_API_VERSION;
  if (!pixelId || !/^\d{5,30}$/.test(pixelId) || !token || !/^v\d+\.0$/.test(version ?? '')) return null;
  return { pixelId, token, version: version! };
}
