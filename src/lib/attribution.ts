/**
 * First-touch acquisition attribution for paid landing traffic.
 *
 * Stored client-side only (localStorage, never overwritten once set) and
 * attached to the signup payload so Admin can later compare landing visit
 * → signup → trial → paywall → plan funnels. No fingerprinting, no
 * third-party calls, no fabricated numbers.
 */
import { sanitizeAttribution, type LandingAttribution } from '@/lib/analytics/marketing';
export type { LandingAttribution } from '@/lib/analytics/marketing';

const STORAGE_KEY = 'vantra_attribution_v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const;

function pickParams(search: string): Partial<LandingAttribution> {
  const params = new URLSearchParams(search);
  const picked: Partial<LandingAttribution> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim().slice(0, 200);
    if (value) picked[key] = value;
  }
  return picked;
}

export function captureLandingAttribution(variant: string): void {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return; // first touch wins
    const attribution: LandingAttribution = {
      ...pickParams(window.location.search),
      landing_variant: variant.slice(0, 60),
      first_seen: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeAttribution(attribution)));
  } catch {
    /* Attribution is optional and must never break the page. */
  }
}

export function readAttribution(): LandingAttribution | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LandingAttribution;
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitizeAttribution(parsed);
  } catch {
    return null;
  }
}
