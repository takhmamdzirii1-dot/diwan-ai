'use client';
import { META_EVENTS, type LandingEvent, type LandingEventInput } from '@/lib/analytics/marketing';
import { readAttribution } from './attribution';

export const SIGNUP_INTENT_KEY = 'vantra_signup_tracking_v1';
export const CONSENT_KEY = 'vantra_marketing_consent';
type Pixel = ((...args: unknown[]) => void) & { queue: unknown[][]; loaded: boolean; version: string; push: Pixel; callMethod?: (...args: unknown[]) => void };
type PixelWindow = Window & { fbq?: Pixel; _fbq?: Pixel };
let queue: LandingEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let installed = false;
let interacted = false;
let pendingPixel: { event: string; key: string }[] = [];
const sentPixel = new Set<string>();
function installListeners() {
  if (installed) return;
  installed = true;
  window.addEventListener('pagehide', flushMarketingEvents);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushMarketingEvents(); });
  window.addEventListener('pointerdown', markMarketingInteraction, { once: true, passive: true });
  window.addEventListener('keydown', markMarketingInteraction, { once: true });
}

function visitorId() {
  try {
    const key = 'vantra_marketing_visitor_v1';
    const saved = localStorage.getItem(key);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const id = crypto.randomUUID(); localStorage.setItem(key, id); return id;
  } catch { return null; }
}

export function flushMarketingEvents() {
  clearTimeout(timer); timer = undefined;
  const visitor = visitorId();
  if (!visitor || !queue.length) return;
  const events = queue.splice(0, 20);
  const body = JSON.stringify({ visitorId: visitor, acquisition: readAttribution(), events });
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon?.('/api/analytics/landing', blob)) return;
  void fetch('/api/analytics/landing', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}

export function setMarketingConsent(granted: boolean) {
  const value = granted ? 'granted' : 'denied';
  try { localStorage.setItem(CONSENT_KEY, value); } catch {}
  document.cookie = `${CONSENT_KEY}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  (window as PixelWindow).fbq?.('consent', granted ? 'grant' : 'revoke');
  if (!granted) pendingPixel = [];
  else flushPixelEvents();
  // Anonymous visitors receive 401; signed-in visitors can also withdraw their
  // own server-side consent. Never send an actor ID from the browser.
  void fetch('/api/analytics/consent', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ granted }), keepalive: true }).catch(() => undefined);
  // Consent changes are isolated from authentication; no profile/settings edits.
}

function pixelReady(): Pixel | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!interacted || !id || !/^\d{5,30}$/.test(id) || !document.cookie.split('; ').includes(`${CONSENT_KEY}=granted`)) return null;
  const target = window as PixelWindow;
  if (!target.fbq) {
    const fn = ((...args: unknown[]) => { if (fn.callMethod) fn.callMethod(...args); else fn.queue.push(args); }) as Pixel;
    fn.queue = []; fn.loaded = true; fn.version = '2.0'; fn.push = fn;
    target.fbq = target._fbq = fn;
    fn('consent', 'grant');
    fn('init', id);
    const script = document.createElement('script');
    script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  return target.fbq;
}

export function trackMarketingPixel(event: string, key: string) {
  const name = META_EVENTS[event];
  if (!name) return;
  if (sentPixel.has(key)) return;
  try {
    installListeners();
    const standard = ['PageView', 'CompleteRegistration', 'InitiateCheckout', 'Purchase'].includes(name);
    const pixel = pixelReady();
    if (pixel) {
      if (sentPixel.size >= 100) sentPixel.delete(sentPixel.values().next().value!);
      sentPixel.add(key);
      pixel(standard ? 'track' : 'trackCustom', name, {}, { eventID: key });
    }
    else if (pendingPixel.length < 20 && process.env.NEXT_PUBLIC_META_PIXEL_ID
      && !document.cookie.split('; ').includes(`${CONSENT_KEY}=denied`)) pendingPixel.push({ event, key });
  } catch { /* Optional advertising must not interfere with actions. */ }
}

function flushPixelEvents() {
  if (!pixelReady()) return;
  const events = pendingPixel; pendingPixel = [];
  events.forEach(item => trackMarketingPixel(item.event, item.key));
}
export function markMarketingInteraction() { interacted = true; flushPixelEvents(); }

export function trackLandingEvent(input: LandingEventInput) {
  try {
    installListeners();
    const event = { ...input, id: crypto.randomUUID() } as LandingEvent;
    if (queue.length >= 20) flushMarketingEvents();
    queue.push(event);
    trackMarketingPixel(event.event, event.id);
    timer ??= setTimeout(flushMarketingEvents, 1000);
  } catch { /* Optional first-party analytics cannot block navigation. */ }
}

export function beginSignupTracking() {
  try { localStorage.setItem(SIGNUP_INTENT_KEY, new Date().toISOString()); } catch {}
}

export async function finishSignupTracking() {
  try {
    const startedAt = localStorage.getItem(SIGNUP_INTENT_KEY);
    if (!startedAt) return;
    const response = await fetch('/api/analytics/signup', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startedAt, acquisition: readAttribution() }), keepalive: true });
    if (response.ok) {
      localStorage.removeItem(SIGNUP_INTENT_KEY);
      const result = await response.json();
      if (result.recorded && typeof result.eventId === 'string') trackMarketingPixel('signup_completed', result.eventId);
    }
  } catch { /* Retain the intent for a later owned-authenticated request. */ }
}
