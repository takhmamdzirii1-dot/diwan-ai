# PostHog funnel analytics

Set **only** these two variables in Vercel → VANTRA project → Settings →
Environment Variables → Production (and locally in ignored `.env.local` for QA):

- `NEXT_PUBLIC_POSTHOG_KEY`: project API key (`phc_…`) from PostHog Project settings.
- `NEXT_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`, matching the project's region.

Do not enter a personal API key. The project ingestion key is intentionally public.
Public environment values are embedded at build time; a new Git deployment is
required after setting them. No database migration is needed.

## Events and consent

The SDK uses Next.js `instrumentation-client.ts`, with its no-external bundle
lazy-loaded automatically on public marketing/conversion routes. The blocking
consent prompt is disabled, not deleted. Explicit previous opt-outs and Do Not
Track remain respected. Meta Pixel/CAPI retain their existing consent behavior.
Public autocapture, heatmaps and lightweight Web Vitals are enabled; surveys,
feature-flag evaluation, copied-text capture and exception capture are disabled.
Canonical public pageviews support PostHog Web Analytics; private
paths, query strings and referrers are not forwarded. SDK-generated properties are removed at
`before_send`; no emails, names, payment references, files,
prompts, IP or device properties are sent. GeoIP enrichment is disabled.
Only authenticated VANTRA user UUIDs are identified; logout resets identity.

Session Replay loads its separate recorder on `/`, EN/FR/AR
landing pages, the three `/go/*` variants, and public signup/pricing/checkout
paths. Studio/Admin and all other paths are excluded. SPA navigation stops
recording before changing the page; private theme roots are also blocked.
Inputs, text and element attributes are masked (including signed-in identities).
File/hidden inputs and iframes are blocked. Sampling is 100% of eligible public
sessions (explicit opt-outs/DNT are excluded). Console error occurrences retain
only a fixed redacted message; network diagnostics retain status/timing/method,
never URLs, headers, bodies or credentials. OAuth/payment query strings disable
recording altogether. Safe ad-click identifiers may enter the page but are
stripped from analytics URLs and replay metadata. Autocapture retains only
element tags/positions, not text, attributes or form values.
Replay needs Session Replay enabled in PostHog Project settings; the SDK fetches
recording configuration, but feature flag evaluation remains disabled.

Events: `landing_view`, `pricing_view` (pricing enters the viewport),
`cta_click`, `signup_started` (signup modal opens), `signup_completed`,
`plan_selected`, `checkout_started`, `payment_method_selected`,
`payment_success`, `payment_failed`.

Only campaign identifier tokens are accepted for UTM properties; free text,
URLs and email-like values are rejected. First-touch attribution survives the
existing signup/OAuth/checkout path. No additional customer fields are tracked.

Browser intents are deduplicated per turn/checkout attempt; timestamps record
the original interaction, even if SDK loading is delayed. Up to 20 pending
intents stay in memory during lazy initialization; denial discards them. Signup completion
and approved/rejected payment outcomes are **server-only**, after the existing
unique audit insert and owned canonical order verification. Replays do not
emit another conversion. Stable insert IDs also provide PostHog deduplication.
No client return page reports successful payment. Failures to create, submit
or start payment are coarse, allowlisted failure categories, never raw errors.

Delivery is best effort, not a financial authority: one bounded server attempt
after response, no retries/queue/vendor changes. A network outage can lose an
analytics event; it cannot affect a payment or grant.

In PostHog create the main funnel from landing_view → cta_click → signup_started
→ signup_completed → plan_selected → checkout_started → payment_success.
Pricing and payment-method events are available as secondary breakdowns. Use the event timestamps for conversion time and
funnel drop-off for abandonment. No “abandoned” event is emitted. Optional
measurement excludes opt-outs/DNT and blocked/failed delivery; it is not a guaranteed total-traffic count.
Disable unwanted project-side automatic enrichment/integrations as well.

## Same-origin proxy and deployment

The browser uses `/v-events`; ordered Next.js rewrites send assets to the matching
PostHog regional assets host and ingestion to the configured regional host.
The existing request proxy intercepts this prefix before locale handling and
forwards only allowlisted transport headers, not VANTRA cookies or credentials.
There is no new ingestion function or vendor. Vercel transfer/request charges
can apply, especially at 100% replay; monitor usage. A proxy reduces common
third-party blocking but cannot guarantee delivery. Configure Session Replay
and Heatmaps in the PostHog project; this code does not change dashboard settings.

## Cleanup candidates — approval required, nothing deleted

- Dormant consent banner JSX, copy/state and interaction branch in
  `LandingTracking.tsx`: disabled by `consentPromptEnabled`; no longer shown.
- `productAnalyticsConfigured()` export/import: only referenced by that dormant
  banner branch. Remove only together with the approved banner cleanup.

Keep consent cookie/helpers, attribution, first-party marketing events and
Meta hooks: they remain referenced by Pixel/CAPI, explicit opt-outs and funnels.
Keep the SDK dependency, server outcomes and privacy pages.

## Original integration file manifest

- `instrumentation-client.ts`
- `lib/analytics/posthog.ts`
- `lib/analytics/posthog.server.ts`
- `lib/analytics/posthog.test.ts`
- `lib/analytics/posthog.server.test.ts`
- `lib/analytics/funnel-events.ts`
- `src/lib/product-analytics.ts`
- `src/lib/marketing-analytics.ts`
- `src/lib/funnel-analytics.ts`
- `src/components/landing/LandingTracking.tsx`
- `src/components/AuthModal.tsx`
- `src/components/TopUpModal.tsx`
- `src/context/ModalContext.tsx`
- `package.json` (SDK dependency and production build command)
- `package-lock.json` (SDK dependency entries only)
- `docs/posthog-analytics.md`
- `next.config.mjs` (honor PptxGenJS browser exclusions only)

The build uses Webpack to avoid the Windows Turbopack Google-font loader failure.
No PPTX export or font source code is changed.
