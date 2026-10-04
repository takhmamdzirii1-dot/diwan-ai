'use client';
import { ANALYTICS_CONSENT_KEY, UUID, posthogConfiguration, publicAnalyticsPath, replayAllowed, safeAnalyticsProperties, safePosthogWireEvent, safeReplayNetwork, type BrowserAnalyticsEvent } from '@/lib/analytics/posthog';
import { readAttribution } from './attribution';
import type { PostHog } from 'posthog-js';

let client: PostHog | undefined;
let loading: Promise<void> | undefined;
let userId: string | null = null;
let appliedUser: string | null = null;
let recording: Promise<void> | undefined;
let lastPage: string | null = null;
const seen = new Set<string>();
type Pending = { event: BrowserAnalyticsEvent; properties: Record<string, string>; timestamp: Date; id: string };
let pending: Pending[] = [];
const config = () => posthogConfiguration({ NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST });
export function analyticsInteractionId() { try { return crypto.randomUUID(); } catch { return ''; } }
function consent() { return !denied() && !['1', 'yes'].includes(window.navigator?.doNotTrack ?? ''); }
function denied() { return document.cookie.split('; ').includes(`${ANALYTICS_CONSENT_KEY}=denied`); }
const autocapture = {
  dom_event_allowlist: ['click', 'change', 'submit'] as ('click' | 'change' | 'submit')[],
  element_allowlist: ['a', 'button', 'form', 'select'] as ('a' | 'button' | 'form' | 'select')[],
  css_selector_ignorelist: ['.ph-no-autocapture', '[data-ph-no-autocapture]', '[data-studio-theme]', 'input', 'textarea', '[contenteditable="true"]'],
  capture_copied_text: false,
};
const performanceCapture = { web_vitals: true, web_vitals_attribution: false, network_timing: true };
function stopRecording() { try { client?.stopSessionRecording(); } catch {} }

function syncPublicPage() {
  if (!client || !consent()) return;
  const path = publicAnalyticsPath(window.location.pathname);
  client.set_config({ autocapture: path ? autocapture : false, capture_heatmaps: !!path,
    capture_performance: path ? performanceCapture : false, capture_pageleave: !!path });
  if (path && path !== lastPage) {
    client.capture('$pageview', { ...safeAnalyticsProperties({ ...readAttribution(), locale: path.split('/')[1] }),
      $current_url: `https://joinvantra.com${path}` });
  }
  lastPage = path;
  if (!replayAllowed(window.location)) { client.stopSessionRecording(); return; }
  if (!recording) {
    // Lazy recorder + lightweight (no attribution/DOM selectors) Web Vitals.
    recording = Promise.all([import('posthog-js/dist/lazy-recorder'), import('posthog-js/dist/web-vitals')]).then(() => {
      if (consent() && replayAllowed(window.location)) {
        client?.set_config({ capture_performance: performanceCapture });
        client?.startSessionRecording({ sampling: true, linked_flag: true, url_trigger: true, event_trigger: true });
      }
    }).catch(() => {}).finally(() => { recording = undefined; });
  }
}

/** Stop before SPA navigation changes the DOM; block private theme roots as a second boundary. */
export function installAnalyticsNavigation() {
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (...args: Parameters<History[typeof method]>) {
      stopRecording();
      const result = original.apply(this, args);
      syncAnalyticsConsent(); // Entering a public route can initialize after a direct private-page load.
      return result;
    };
  }
  window.addEventListener('popstate', () => { stopRecording(); syncAnalyticsConsent(); });
  window.addEventListener('hashchange', () => { stopRecording(); syncAnalyticsConsent(); });
  syncAnalyticsConsent();
}

function applyIdentity() {
  if (!client || appliedUser === userId) return;
  if (appliedUser) client.reset(); // Sign out/account switch must never reuse another user's identity.
  if (userId) client.identify(userId); // No name/email/person properties.
  appliedUser = userId;
}

export function identifyAnalyticsUser(id: string | null) {
  try {
    const next = id && UUID.test(id) ? id : null;
    if (userId && userId !== next) pending = [];
    userId = next;
    if (consent()) applyIdentity();
  } catch {}
}

export function syncAnalyticsConsent() {
  try {
    if (!consent()) {
      pending = [];
      client?.stopSessionRecording();
      client?.opt_out_capturing();
      return;
    }
    if (client) {
      client.opt_in_capturing({ captureEventName: false });
      applyIdentity();
      syncPublicPage();
      const batch = pending; pending = [];
      batch.forEach(item => client!.capture(item.event, { ...item.properties, $insert_id: item.id }, { timestamp: item.timestamp }));
      return;
    }
    const settings = config();
    if (!settings || loading || (!publicAnalyticsPath(window.location.pathname) && !pending.length)) return;
    // Official SDK's no-external entry; not shipped on the critical render path.
    // No surveys/flag evaluations. Public-only capture; explicit funnel intents can still be recorded elsewhere.
    loading = import('posthog-js/no-external').then(({ default: posthog }) => {
      if (!consent()) return;
      posthog.init(settings.key, {
        api_host: '/v-events', ui_host: settings.host.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
        autocapture: false, capture_pageview: false, capture_pageleave: false,
        disable_session_recording: true, disable_surveys: true, disable_external_dependency_loading: true,
        advanced_disable_feature_flags: true,
        capture_performance: false, capture_exceptions: false, capture_heatmaps: false, rageclick: false,
        capture_dead_clicks: false, opt_in_site_apps: false, ip: false, respect_dnt: true,
        person_profiles: 'identified_only', persistence: 'localStorage',
        mask_all_text: true, mask_all_element_attributes: true, mask_personal_data_properties: true,
        enable_recording_console_log: true,
        session_recording: {
          maskAllInputs: true, maskTextSelector: '*', maskAllElementAttributes: true,
          blockSelector: '[data-studio-theme], input[type="file"], input[type="hidden"], iframe',
          recordHeaders: false, recordBody: false, captureJsonLd: false,
          sampleRate: 1,
          maskCapturedNetworkRequestFn: data => safeReplayNetwork(data) as typeof data,
        },
        before_send: event => !consent() || (event.event.startsWith('$') && event.event !== '$identify' && !replayAllowed(window.location))
          ? null : safePosthogWireEvent(event),
      });
      client = posthog;
      syncAnalyticsConsent();
    }).catch(() => { pending = []; }).finally(() => { loading = undefined; });
  } catch { /* Optional analytics must never affect navigation/auth/payment. */ }
}

export function trackProductEvent(event: BrowserAnalyticsEvent, key: string, input: Record<string, unknown> = {}) {
  try {
    if (!key || !config() || denied()) return;
    const dedup = `${event}:${key}`;
    if (seen.has(dedup)) return;
    if (seen.size >= 200) seen.delete(seen.values().next().value!);
    seen.add(dedup);
    const locale = window.location.pathname.split('/')[1] || document.documentElement.lang.split('-')[0];
    const item: Pending = { event, id: crypto.randomUUID(), timestamp: new Date(),
      properties: safeAnalyticsProperties({ ...readAttribution(), locale, ...input }) };
    if (pending.length < 20) pending.push(item);
    if (consent()) syncAnalyticsConsent();
  } catch { /* Also handles unavailable storage, SDK and crypto. */ }
}
