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
lazy-loaded only after the existing optional marketing consent is granted.
Surveys, flags, autocapture, exceptions, heatmaps and performance capture are
disabled. Canonical public pageviews support PostHog Web Analytics; private
paths, query strings and referrers are not forwarded. SDK-generated properties are removed at
`before_send`; no emails, names, payment references, files,
prompts, IP or device properties are sent. GeoIP enrichment is disabled.
Only authenticated VANTRA user UUIDs are identified; logout resets identity.

Session Replay loads its separate recorder only after consent on `/`, EN/FR/AR
landing pages, the three `/go/*` variants, and public signup/pricing/checkout
paths. Studio/Admin and all other paths are excluded. SPA navigation stops
recording before changing the page; private theme roots are also blocked.
Inputs, text and element attributes are masked (including signed-in identities).
File/hidden inputs and iframes are blocked; console and network payload recording
are disabled. OAuth/payment query strings disable recording altogether.
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
intents stay in memory until consent; denial discards them. Signup completion
and approved/rejected payment outcomes are **server-only**, after the existing
unique audit insert and owned canonical order verification. Replays do not
emit another conversion. Stable insert IDs also provide PostHog deduplication.
No client return page reports successful payment. Failures to create, submit
or start payment are coarse, allowlisted failure categories, never raw errors.

Delivery is best effort, not a financial authority: one bounded server attempt
after response, no retries/queue/vendor changes. A network outage can lose an
analytics event; it cannot affect a payment or grant.

In PostHog create a funnel from landing → pricing → signup → plan → checkout
→ method → payment_success. Use the event timestamps for conversion time and
funnel drop-off for abandonment. No “abandoned” event is emitted. Optional
measurement includes only consenting visitors; it is not a total-traffic count.
Disable unwanted project-side automatic enrichment/integrations as well.

## Task file manifest

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
