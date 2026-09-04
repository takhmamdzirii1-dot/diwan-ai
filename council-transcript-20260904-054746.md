# LLM Council Transcript — VANTRA Localization Architecture

Generated: 2026-09-04 05:47:46 +01:00

## Original question

What is the best production-grade localization architecture for VANTRA's public marketing experience, considering conversion, SEO, Arabic RTL, performance, maintainability, multi-machine development, and future growth?

The Council was asked to compare native Next.js App Router localization with `next-intl`; evaluate `/fr`, `/ar`, and `/en`; define root resolution, cookie persistence, SEO, RTL, dictionaries, the unused `src/translations.js`, public-marketing scope, transcreation, Unified Credits terminology, and future Studio expansion. It was explicitly prohibited from inventing pricing, credit amounts, payment methods, model availability, or legal terms.

## Framed question

Choose the simplest production-grade localization architecture for VANTRA's existing Next.js 16.3.1 App Router application. It must serve native-quality French, Arabic, and English marketing pages at explicit locale routes; preserve conversion quality; render correct initial HTML language and direction; provide sound multilingual SEO; avoid client language flashes and unnecessary locale payloads; persist user choice with a server-readable cookie; keep Git as the multi-machine source of truth; avoid trusting legacy translations or inventing product facts; and leave the authenticated Studio unlocalized today without blocking its future localization. Give a direct choice between a narrow `next-intl` integration and a native implementation, with the first implementation step.

## Advisor responses

### The Contrarian

The “lightweight native” option has a likely fatal flaw: it looks simple only while VANTRA has one page. Hardcoded dictionary access, hand-built locale navigation, metadata alternates, cookie negotiation, missing-key handling, and mixed server/client message delivery quickly become an undocumented internal framework. The existing client-heavy homepage makes accidental shipment of all three dictionaries especially likely.

Use next-intl, narrowly scoped to public marketing. Configure /fr /ar /en; validate centrally; load only active messages; use locale-aware navigation. proxy.ts only for /: cookie, Accept-Language, French; never redirect explicit locales. Do not patch lang/dir client-side. Restructure public routes so locale is known during SSR and keep Studio in a separate route-group/root-layout boundary. Self-canonical, reciprocal hreflang, x-default /, localized OG, locale sitemap. Delete unused legacy file after recreating verified copy. Terms: Unified Credits; Crédits unifiés VANTRA; رصيد موحّد من VANTRA. Implement routing/layout first.

### The First Principles Thinker

Choose native App Router localization. The requirement is three static marketing dictionaries, deterministic locale routing, metadata, and directionality—not runtime translation machinery. Use validated /[locale], localized HTML-owning layout, separate Studio boundary, root-only proxy with cookie then Accept-Language then French, one SameSite=Lax cookie, active typed dictionary on server, shared components. Delete legacy translations after verified recovery. Per-locale SEO and sitemap. Terms: Unified Credits; Crédits unifiés; رصيد موحّد من VANTRA. This can later extend without dependency.

### The Expansionist

Adopt next-intl. Routing/navigation/messages/pluralization/formatting and future Studio leverage justify it. Explicit locale segment, root-only resolver, durable cookie, server-loaded messages, shared components, initial lang/dir, bdi/LTR isolation, localized SEO and sitemap. Delete legacy source after verified rebuild. Terms: Unified Credits; Crédits VANTRA unifiés; رصيد VANTRA الموحّد. Establish routing/request boundary first.

### The Outsider

Use next-intl because client-heavy shared components and future expansion make custom infrastructure deceptively costly. Explicit locale routes; root-only cookie/Accept-Language/French resolver; one cookie. Localized subtree owns document attributes; preserve LTR tokens. Localized self-canonicals/hreflang/x-default/sitemap. Delete or quarantine legacy after verification. Terms: Unified Credits; Crédits VANTRA unifiés; نظام أرصدة VANTRA الموحّد. Implement routing/layout first.

### The Executor

Use next-intl as fastest safe production path. Create i18n routing/request and proxy, explicit locale routes, active server dictionary, shared components, correct RTL and SEO; remove legacy; public only. No localStorage. First implement locale routing contract plus root-resolution tests. Terms: Unified Credits; Crédits unifiés VANTRA; رصيد موحّد من VANTRA.

## Anonymization mapping

- Response A — First Principles
- Response B — Outsider
- Response C — Contrarian
- Response D — Executor
- Response E — Expansionist

## Peer reviews

### Review 1

B is strongest for connecting client-heavy reality to next-intl. A is weakest because native omits client message delivery/key validation. All missed CDN caching of personalized root redirects, cookie flags, CI dictionary parity, and fresh-clone determinism.

### Review 2

C is strongest for narrow next-intl and the document boundary. D is weakest because it assumes speed without payload details. All missed CDN cache and separating immutable product facts from localized marketing strings.

### Review 3

B is strongest; A underprices custom validation/navigation/formatting. All missed CDN cache and separating immutable product facts from localized marketing strings.

### Review 4

C is strongest: it gives the clearest architectural rationale for narrowly scoped `next-intl`, active-locale server loading, SSR-owned `lang`/`dir`, route separation from Studio, and complete SEO behavior.

C’s biggest blind spot is presenting an “existing client-heavy homepage” as fact. That premise was not supplied and violates the no-invented-product-facts constraint; its bundle-risk argument should be conditional.

All five miss cache correctness for `/`: cookie/`Accept-Language` redirects can be cached incorrectly by CDNs. They should define redirect response caching explicitly—typically private/no-store or carefully varied—while allowing immutable caching for explicit `/fr`, `/ar`, and `/en` pages and message assets.

Repository inspection independently verified that the homepage is client-heavy, resolving the factual concern in this review.

### Review 5

C is strongest: it gives the clearest rationale, contains the dependency to public marketing, prevents multi-dictionary client bundles, preserves SSR `lang`/`dir`, isolates Studio, and covers routing, negotiation, SEO, legacy cleanup, and rollout order.

C’s biggest blind spot is conversion operations. It does not define localized analytics, experiment parity, or a transcreation review workflow, so architectural correctness alone may not protect conversion quality.

All five miss the production delivery contract: source-controlled dictionaries and lockfiles for reproducible multi-machine development; CI checks for schema/key parity, missing messages, RTL rendering, and SEO routes; plus cache-safe root negotiation so CDN caching cannot serve a cookie- or `Accept-Language`-derived redirect to the wrong visitor.

## Chairman synthesis

### Where the Council Agrees

The verdict did not change materially after revalidation against all five peer reviews.

Four of five advisors recommend `next-intl`; the peer reviews consistently favor the narrowly scoped `next-intl` proposals over the native implementation.

The Council agrees that VANTRA should:

- Expose `/fr`, `/ar`, and `/en` as stable, directly accessible routes.
- Resolve only `/` using `vantra_locale` → `Accept-Language` → French.
- Persist explicit choice in a server-readable `SameSite=Lax` cookie.
- Render Arabic with `lang="ar"` and `dir="rtl"` in the initial HTML.
- Share components across locales while isolating LTR brand, model, and technical names.
- Load only the active locale’s messages.
- Keep `/studio` unlocalized and outside this task.
- Provide localized metadata, self-canonicals, reciprocal `hreflang`, `x-default`, and sitemap entries.
- Treat translations as transcreated sales content, not literal copies.
- Refuse to invent pricing, availability, payment, legal, or other product facts.

### Where the Council Clashes

The sole material disagreement is native App Router localization versus `next-intl`.

The native proposal correctly values dependency restraint, but it underestimates the system VANTRA would need to maintain itself: validated navigation, server/client message delivery, missing-key handling, formatting, metadata alternates, bundle discipline, and eventual Studio expansion.

The Council rejects the native implementation as the primary solution. Avoiding one reasonable dependency would create an undocumented internal localization framework whose cost grows with every page and client component.

### Blind Spots the Council Caught

The complete review set adds several requirements that strengthen—but do not reverse—the original verdict:

- Root negotiation must be cache-safe. A personalized redirect must never be cached and served to visitors with different cookies or language headers.
- Cookie attributes, unsupported-locale handling, redirect-loop prevention, and fresh-clone determinism need explicit tests.
- Public marketing and Studio require separate root-layout boundaries because the current global layout cannot obtain the descendant locale reliably for initial `<html lang dir>`.
- Product facts should be separated from transcreated marketing copy so facts remain identical across languages.
- All dictionaries, configuration, and the dependency lockfile must be Git-tracked for reproducible multi-machine development.
- CI should detect missing messages, dictionary-shape drift, RTL regressions, invalid canonicals, broken `hreflang`, and root-routing failures.
- Localized analytics and conversion experiments must use equivalent event semantics across FR, AR, and EN.
- Transcreated copy needs a deliberate review workflow, particularly native-quality French and Arabic review.
- Client-heavy implementation is verified repository context, not an unsupported Council assumption.

### The Recommendation

Adopt `next-intl`, narrowly scoped to VANTRA’s public marketing experience.

Use a localized marketing route group containing `[locale]`; a separate unlocalized Studio route group; a localized root layout that owns `<html lang>` and `<html dir>`; central locale validation and locale-aware navigation; a root-only resolver implementing cookie → browser language → French; server-loaded structured dictionaries; shared components with targeted logical CSS and LTR isolation; static explicit locale routes; localized metadata, self-canonicals, reciprocal `hreflang`, `x-default="/"`, and locale sitemap variants.

`next-intl` compatibility with Next.js 16.3.1 is an implementation gate, not an owner decision. If no compatible supported release exists, implement the same architecture natively.

The main rejected alternative is a bespoke native App Router dictionary and routing layer.

The important tradeoff is accepting one framework dependency and separate root layouts. Navigation between marketing and Studio may perform a full document load; that is acceptable at the public-to-authenticated boundary and preserves correct initial document language and direction.

Unified Credits terminology:

- EN: **Unified Credits**
- FR: **Crédits VANTRA unifiés**
- AR: **أرصدة VANTRA الموحّدة**

Delete `src/translations.js` after independently evaluating any wording worth retaining. Do not import it, bulk-migrate it, or trust its claims.

No genuine owner decision blocks implementation. Unverified marketing claims must be omitted or marked for later owner review rather than guessed.

### The One Thing to Do First

Implement and test the locale routing and document boundary before migrating copy: create the separate localized marketing and unlocalized Studio root layouts; validate `/fr`, `/ar`, and `/en`; implement cache-safe root resolution; confirm correct initial `lang` and `dir`; and add routing, redirect, and crawler-access tests.

## Completion

🧠 LLM COUNCIL COMPLETE

- Final recommendation: narrow `next-intl` integration for public marketing.
- Highest-confidence agreement: explicit stable locale routes with server-rendered language/direction and active-locale messages.
- Biggest disagreement: `next-intl` versus a custom native dictionary layer.
- Most important blind spot: cache-safe root negotiation and the root-layout document boundary.
- The one thing to do first: implement and test the routing/document boundary.
