Task: improve the VANTRA Home page and the 3 paid landing pages
(/{ar,fr,en}/go/{all-ai,ai-in-dzd,creators}) for a Meta Ads launch.
PRESERVE the current visual design: reuse existing components, tokens,
typography, spacing, and the dark premium look. Do not redesign. Small
polish is welcome (spacing consistency, contrast, mobile layout, CLS,
44px tap targets); anything that changes the look noticeably goes into
the report as a suggestion instead.

HARD RULES
- Never invent facts, numbers, testimonials, logos, policies, links, or
  contact details. If something is missing, build the slot, keep it
  hidden until the data exists, and list it under "NEEDS FROM ME".
- Do not touch checkout, payments, credits, or DB logic, and don't change
  any price values. Read prices from the existing catalog/checkout source;
  if pages and checkout disagree (e.g. MAX 10,000 vs 10,200 DA, 7,500 vs
  7,000 credits), do NOT choose: use the checkout values and report the
  conflict.
- All 3 locales (ar/fr/en) updated together; RTL/LTR intact. Mark
  translations I should review.
- Keep it light for the Vercel free plan: static rendering, no runtime
  price fetch, no heavy new dependencies, no autoplay heavy video,
  self-host fonts/logos, lazy-load below the fold, properly sized images.
- Lite must never appear on any public surface.

PHASE 1 - BLOCKERS
1) Remove the testimonials section and its nav anchor from Home. Keep the
   component, rendered only when verified proof data exists (see 11).
2) canonical/og:url currently point to a vercel.app domain on all pages.
   Use the real site origin from one config value (joinvantra.com). /go
   stays noindex,follow. Home: indexable, correct canonical + hreflang for
   ar/fr/en; check sitemap/robots too.
3) Prices: render Pro/MAX prices at build time from one pricing config
   (single source of truth), not client-side. Remove the "—" and "not
   available yet" placeholders unless a plan is truly disabled.
4) Model claims: replace stale names (GPT-4o, Claude 3.5, Gemini 1.5) with
   names from the enabled model catalog. The logo strip shows only
   families that exist in that catalog. Add near it: "VANTRA is
   independent and not affiliated with the model providers." Replace the
   unpkg @latest logos with self-hosted pinned files.
5) Copy consistency: use one name for the balance ("VANTRA Credits" /
   its Arabic equivalent) everywhere. Read the credit-consumption code and
   fix the claim of "one balance for chat, image and video" so it matches
   reality (chat has usage limits). Replace jargon like "no recurring
   media wallet" with plain wording. Use "MAX" consistently.
6) Payment copy must match what's live: manual transfer (BaridiMob/CCP,
   reviewed before activation). Edahabia/CIB cards appear as "coming soon"
   and switch to live copy ONLY via the same availability flag the
   checkout uses. Always state: one payment, 30 days, no automatic
   renewal. Home FAQ must say the same as the /go pages.
7) Footer: remove the dead "Status" (#) link and the generic X link unless
   real URLs exist in config. Add a support contact (WhatsApp/email) from
   config; if absent, don't render and report it.
8) Hero microcopy on Home and /go: "Pay locally in DZD · One payment,
   30 days · No automatic renewal · No card needed to start". Replace the
   abstract stats row (12+, DA, 1, 3) with this.

PHASE 2 - STRUCTURE
9) /go header: logo | language | sticky "Start free". Remove anchor
   links; the footer keeps legal + support only. One primary CTA wording
   everywhere ("Start free"); pricing buttons "Choose Pro" / "Choose MAX"
   carry the plan through signup straight into checkout with the plan
   locked (no re-selection).
10) Page-specific content, reusing existing assets only:
    - ai-in-dzd: "How payment works" (3 steps + activation time + support)
      ABOVE pricing, stating honestly that it's a manual transfer with
      review. Reuse the checkout's existing activation-time wording.
    - creators: creator use cases (Reels, product ads, thumbnails, 9:16)
      and a gallery slot fed by a showcase config of real outputs; hidden
      until assets exist.
    - all-ai: model-switching demo using the real enabled models; slot for
      real screenshots.
11) ProofSection fed by a config (type: screenshot | video | quote; asset;
    caption; date; consent: true). Renders nothing when empty. Placement:
    one item after the product demo and one next to pricing.
12) Compare Plans right after the pricing cards on Home and /go: 5-6 rows
    (best for, models, chat usage using the product names Standard Chat /
    High-usage Chat / Highest Chat Access, media credits, priority,
    rollover only if values exist). Pro highlighted; no Lite. Mobile:
    compact 3-column grid (no horizontal scroll), top 4 rows + "Show full
    comparison".
13) Reassurance row directly under the pricing buttons (payment methods,
    one payment/30 days, no auto-renewal, activation info, support link).
    FAQ order: payment safety, activation time, auto-renewal, refund and
    support, data privacy. Use only facts that exist; undefined policies
    stay hidden and are listed under NEEDS FROM ME.

PHASE 3 - TRACKING
14) Persist utm_* and fbclid at first landing, and store them server-side
    at signup. Events: landing_view, cta_click (location), signup_completed,
    pricing_select (plan), checkout_start, payment_submitted,
    payment_approved, first_generation_succeeded. Use the existing
    analytics/admin events if present; else an additive table. Meta Pixel +
    Conversions API wrapper, disabled unless env vars exist (no hardcoded
    keys). Batch via sendBeacon; no heavy scripts before interaction.

DEPLOY: skip local browser testing. Run typecheck/build/existing tests,
then deploy the usual way, phase by phase. Migrations additive only.

FINAL REPORT (short):
(a) files changed per phase and commit SHAs;
(b) conflicts found (prices, copy, claims);
(c) NEEDS FROM ME, grouped: real assets (creator outputs, demo
    screenshots, consented proof screenshots, UGC video with captions);
    decisions (activation SLA, refund policy text, support contact, final
    MAX numbers, rollover values); keys/accounts (Pixel ID, CAPI token,
    real social URLs);
(d) what you could not verify.
