# Landing Phase 2

Scope: items 9–13 of `landing-brief.md`. Phase 3 tracking is unchanged.

## Reused product sources

- Prices, allowances and access days: existing build-time checkout catalog.
- Models: enabled, visible, non-archived runtime catalog; comparison includes
  included/trial models according to its existing plan-access matrix.
- Chat labels: Standard / High-usage / Highest, matching the current product tiers.
- Payment availability: existing checkout gateway flags.
- Activation wording: existing checkout `payments.reviewedWithinHours`.

Public pricing remains Free / Pro / MAX. No payment/credit/API/database logic
or historical values were changed. Comparison does not publish priority or
rollover promises: there is no verified public catalog value for these fields.

## Signup continuation

Choosing an active public Pro/MAX plan saves only its non-secret catalog ID
in a versioned, 30-minute browser UI intent. Authentication is unchanged.
On authenticated Studio arrival the intent is consumed once and opens the
existing preselected checkout; the server still resolves the plan and price.
Free opens signup/Studio, not paid checkout. No order is created automatically.

**Brief conflict:** preselected checkout skips selection and disables Back,
but still offers its existing Change plan action. Strictly locking that action
would change checkout, forbidden by the brief's hard rules. It remains unchanged.
Browser storage denied by privacy settings cannot persist this UI intent.

## Owner-supplied slots

`src/content/landing-phase-two.ts` holds empty proof, creator-output and
model-screenshot configs. No placeholder output is shown as real evidence.
Proof requires dated consent, captions in EN/FR/AR, and local dimensioned media
or an actual quote. Video is user-played, with no autoplay or eager download.
Proof positions: after the demo, and next to pricing. Empty configs render nothing.
The model switcher is explicitly a UI demonstration, not an AI generation.

## Needs from owner

- Assets: real creator outputs, demo screenshots, consented dated proof,
  user-generated video and captions.
- Decisions: confirm existing activation-time wording, refund policy,
  real support contact/URL, and public priority/rollover wording/values.
  Review all EN/FR/AR copy before running ads.
- Future Phase 3 only: Pixel ID, CAPI token, real social URLs. Not implemented here.

The existing legal billing policy includes recurring/cancellation wording that
conflicts with the manual-payment product. No legal policy was rewritten.
An existing checkout support address is not verified; it was not promoted onto
marketing pages. Support/refund FAQ entries stay hidden until confirmed.

Local browser tests are explicitly excluded by the brief. Deterministic tests,
task-only type/build checks and production HTML smoke cover published content;
real signup/OAuth/email-confirmation, checkout interaction and pixel-level
mobile appearance still require owner acceptance.
