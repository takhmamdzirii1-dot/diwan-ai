# Phase 3 — acquisition and conversion tracking

No schema migration, dependency, price or financial-function changes. Records
reuse the existing service-role-only, immutable `admin_audit_log` / `user_funnel`
path and existing Admin funnel aggregation. Anonymous views have no actor and
are not counted as authenticated users.
The existing Admin report retains its 7/30-day query window and 5,000-row limit,
including its truncation indicator; this is not a full analytics warehouse.

## Events and authority

- `landing_view`: Home / three paid landings, locale, anonymous visitor ID.
- `cta_click`: header / hero / preview / final location.
- `pricing_select`: public Free / Pro / MAX only.
- `signup_completed`: authenticated new account, not a sign-in to an old account.
- `checkout_started`: existing event name retained (brief's `checkout_start`).
- `payment_submitted`, `payment_approved`: existing server payment hooks retained.
- `first_generation_succeeded`: once per account after canonical completed
  finalization (including free successful generations), never on failure.

First-touch UTM and fbclid stay in local storage, then in Supabase Auth acquisition
metadata at email signup or after authenticated OAuth signup. Acquisition is
descriptive, not authority for eligibility, credits, prices or permissions. The
post-login completion intent expires after seven days; late confirmations or
blocked browser storage can miss a conversion. No historical signup backfill.

Landing events are queued into batches (max 20), flushed after one second and on
page hide, using `sendBeacon` with keepalive fetch fallback. The intake requires
same origin, allowlisted intent schemas, bounded input and per-instance visitor
limits. It cannot accept actors or payment/signup/generation outcomes. UUID
idempotency preserves historical records on beacon/approval/finalizer replays.
Ad blockers, disabled storage, offline navigation or process termination can
drop optional telemetry; analytics is not billing authority.

## Optional Meta setup (enter privately in Vercel Production)

1. `NEXT_PUBLIC_META_PIXEL_ID`: real Pixel/dataset ID (public identifier only).
2. `META_CAPI_ACCESS_TOKEN`: Conversions API access token, **server-only**.
3. `META_GRAPH_API_VERSION`: currently supported Graph API version, e.g. the
   `vN.0` value shown in the official Meta integration instructions; no version
   is hardcoded or guessed by VANTRA.
4. Redeploy via Git after configuration. No production environment values were
   added or changed by this implementation.

With a configured Pixel, a small EN/FR/AR opt-in prompt appears after interaction.
No Meta script loads before interaction and consent. Default/declined visitors
are not forwarded to Meta. CAPI additionally requires all three valid variables
and stored consent. Existing accounts are not retroactively opted in. Browser
consent changes synchronize only the signed-in account's measurement preference;
declining clears pending Pixel events and disables future CAPI forwarding.
Browser and server conversions share event IDs where both exist. Server-only approval
and first-generation events are not sent as invented browser outcomes.

CAPI uses one bounded post-response attempt, no retry queue/cron. No email, IP,
prompts, payment proofs, tokens or private content are included. Purchase values
come only from the approved immutable payment-order snapshot. Failed Meta
delivery does not alter payment approval, credit settlement or the audit event.

Official contracts: [Meta server-side SDK](https://github.com/facebook/facebook-nodejs-business-sdk/tree/main/src/objects/serverside),
[Pixel conversion tracking](https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/).

## Needs / verification limits

- Real Pixel ID, CAPI token and supported API version; review advertising consent
  wording/privacy policy before enabling measurement.
- Meta Events Manager Test Events validation after setup (not claimed live here).
- Real signup/email/OAuth, checkout/payment conversion and generation conversion
  cannot be live-verified without creating account/payment/provider activity;
  deterministic fixtures cover validation and deduplication instead.
- Phase 2 missing real proof/showcase assets, support/policy/SLA decisions remain
  unchanged. Lite stays hidden. Checkout and snapshot values are not modified.
