<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VANTRA Studio — Project Identity

You are working on **VANTRA Studio**: a premium, monochrome, multi-provider AI SaaS workspace (Chat / Image / Video / Library). The design language is strict Apple/Vercel monochrome — deep blacks (#050505 → #0A0A0B), pure white active states, neutral grays, zero gold/bronze/purple/blue/gradients. Every component must feel like Linear/Vercel: calm, minimal, expensive.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict off, but lint clean required)
- **Styling**: Tailwind CSS v4 (`@theme` in globals.css, NOT tailwind.config)
- **Fonts**: next/font/google — Inter (latin), Cairo (arabic), IBM Plex Mono (code) — self-hosted, zero CDN links
- **Auth**: Supabase (Google OAuth + email/password)
- **Database**: Supabase Postgres (profiles, credits, chat_sessions, messages, user_provider_connections)
- **Chat AI**: OpenRouter (streaming via @ai-sdk/react useChat)
- **Voice**: Groq Whisper (POST /api/transcribe)
- **Image Gen**: Provider router (Pollinations free / Puter User-Pays / Mock) via /api/generate-image
- **Design**: Framer Motion springs [0.22, 1, 0.36, 1], Lucide icons, no other icon libs

## Project Structure

```
app/                    ← Next.js routes + API
  api/generate/chat/    ← chat streaming (OpenRouter)
  api/generate-image/   ← image gen (provider router)
  api/transcribe/       ← voice-to-text (Groq whisper-large-v3)
  api/provider-connections/pollinations/  ← OAuth callback + status
components/ui/          ← shared UI (claude-style-chat-input, liquid-metal-button, etc.)
src/components/studio/  ← StudioDashboard, DashboardSidebar, MessageBubble, ImageCanvas, MotionStudio, MediaLibrary, SettingsModal, AppShell, etc.
src/components/landing/ ← HowItWorks, TerminalShowcase, Testimonials, Faq, FinalCta, PartnersSection, LandingHeader, CinematicEnter
src/components/         ← OriginalLandingPage, AuthModal, HeroSection, ShowcaseSection, VantraLogo, etc.
lib/ai/image-providers/ ← provider abstraction (types, router, pollinations, puter, mock)
lib/supabase/           ← client + server Supabase clients
context/ModalContext    ← openAuthModal / openTopUpModal
hooks/useUser.ts        ← Supabase session + balance
```

## Design Rules (NEVER VIOLATE)

1. **Monochrome only**: #050505 → #0A0A0B surfaces, pure white active, text-white/XX opacity. Zero gold/bronze/purple/blue/gradients/neon.
2. **Motion**: Framer Motion springs `[0.22, 1, 0.36, 1]`, durations < 300ms for UI, staggered delays. No bouncy effects.
3. **Buttons**: Primary = `bg-white text-black hover:bg-gray-200`. Secondary = `border-white/10 bg-white/[0.03]`. Disabled = `bg-white/10 text-white/50`.
4. **Borders**: `border-white/[0.05–0.08]` for subtle, `border-white/10` for standard.
5. **Glassmorphism**: `backdrop-blur-xl bg-black/60` — only on composer bars, popovers, action overlays.
6. **Typography**: `font-sans` (Inter/Cairo), section labels = `text-[11px] tracking-widest uppercase text-white/40`, headings `tracking-tight`.
7. **Spacing**: 4px/8px system. Rounded: `rounded-xl` for buttons/inputs, `rounded-2xl` for cards, `rounded-full` for pills.
8. **RTL**: Use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) — Arabic must mirror correctly.
9. **A11y**: `aria-label` on all icon buttons, `aria-expanded` on toggles, `aria-selected` on tabs, `focus-visible:ring-2 focus-visible:ring-white/40` everywhere.
10. **Ambient**: VantraAmbientBackground provides the living-system glow. Never add particles, stars, or neon.

## Key Architectural Patterns

- **Lazy sessions**: `+ New Chat` creates a draft (`draft-{ts}`), not a DB record. Record is created on first message only.
- **Provider router**: `lib/ai/image-providers/router.ts` — free ↔ free auto-fallback. Puter (user-funded) never silently falls back. Paid requires explicit user permission.
- **BYOP tokens**: encrypted with AES-256-GCM (`PROVIDER_TOKEN_ENCRYPTION_KEY`), stored in `user_provider_connections`, decrypted server-side only.
- **localStorage cap**: sessions max 30, messages max 50/session, debounced 400ms.
- **No secrets in client**: `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `POLLINATIONS_APP_KEY`, `PROVIDER_TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all server-side only.

## Critical CSS Lessons (NEVER REPEAT)

1. **Never use unlayered element selectors** (`p { ... }`, `button { ... }`) — they beat ALL Tailwind utilities via cascade layers. Use `@layer base { ... }` or class-based selectors.
2. **No `transition: all`** — specify exact properties. Unintended props animate off-GPU.
3. **Tailwind v4 @theme**: custom fonts go in `@theme { --font-sans: ... }` in globals.css, NOT tailwind.config.
4. **`bg-white` doesn't work on buttons** if a base `background: none` rule is unlayered. Always check cascade conflicts.

## Deploy

- **Vercel**: `vercel deploy --prod --yes` from project root (linked to `ai-alpha` project)
- **URL**: https://ai-alpha-delta-six.vercel.app
- **Env vars on Vercel**: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, POLLINATIONS_APP_KEY, PROVIDER_TOKEN_ENCRYPTION_KEY

## Graphify Protocol (MANDATORY — never skip)

Before reading ANY project files, query the Graphify graph first and prefer its scoped answers:

- Locate code: `graphify query "<what am I looking for>"` (run from project root)
- Impact check before edits: `graphify affected "<file/component>"`
- Explain a component: `graphify explain "<name>"`
- After finishing edits, refresh the graph: `graphify update .`

Read full files ONLY when the graph lacks the detail. This saves tokens and speeds up every session.

## GIT SYNC RULES (follow every session)

1. START: `git pull origin main` — if conflicts: `git stash` → `git pull` → `git stash pop`
2. WORK: make your changes
3. CHECK: `git diff` — review what changed, make sure nothing is broken
4. COMMIT: `git add .` → `git commit -m "clear description of what changed"`
5. PUSH: `git push origin main`
6. NEVER skip step 1. NEVER sit on uncommitted changes. NEVER force push.

If `git pull` causes conflicts:

- Read the conflicted files carefully.
- Keep BOTH changes if they don't overlap.
- Keep the NEWER change if they do.
- Ask the team lead if unsure.

If a build fails after pulling:

- Run `npm run build` to find the error.
- Fix it before pushing.
- If you cannot fix it: `git revert` and ask for help.

## GIT SYNC RULES (follow every session — BOTH agents)

1. **START**: `git pull origin main` — if conflicts: `git stash` → `git pull` → `git stash pop`
2. **WORK**: make your changes
3. **CHECK**: `git diff` — review what changed, make sure nothing is broken
4. **COMMIT**: `git add .` → `git commit -m "clear description of what changed"`
5. **PUSH**: `git push origin main`
6. **NEVER skip step 1.** NEVER sit on uncommitted changes. NEVER force push.

If git pull causes conflicts:
- Read the conflicted files carefully
- Keep BOTH changes if they don't overlap
- Keep the NEWER change if they do
- Ask the team lead if unsure

If a build fails after pulling:
- Run `npm run build` to find the error
- Fix it before pushing
- If you cannot fix it: `git revert` and ask for help

## Work Protocol

1. Never claim "done" without proof: screenshot + computed-style numbers from the live page.
2. Run `npm run lint` and `npm run build` before any deploy.
3. Follow installed skills (emil-design-eng values, improve-animations audit values) — never invent motion values.
4. Always `git add` + `git commit` + `git push origin main` after completing significant work. **Push is NOT optional.** The user approved this as a standing instruction. Forgetting push = forgetting the work.
5. Always `graphify update .` after code changes (post-commit hook also does this).
6. AUTO-DEPLOY ALWAYS (user standing instruction): after completing any code change — run `npm run lint` + `npm run build`, then immediately `vercel deploy --prod --yes` WITHOUT waiting for the user to ask. Retry once on transient `fetch failed`. Verify the production URL afterwards.
7. **After EVERY deploy**: `graphify update .` must also run. Never deploy without updating the graph.

## LLM Council Policy

The LLM Council is an optional, high-cost reasoning workflow for important decisions.

It must NEVER run silently.

### Explicit activation

Run the Council when the user explicitly requests it with phrases such as:

- council this
- run the council
- pressure-test this
- stress-test this
- war room this
- debate this

Equivalent Arabic requests count as explicit activation, including:

- شغل المجلس
- خل المجلس يحلل هذا
- اعمل council لهذا
- اختبر هذا بالمجلس
- شغل LLM Council

Before an actual Council session begins, visibly announce:

🧠 LLM COUNCIL ACTIVATED

Then state:

Decision:
[short decision being analyzed]

Reason:
[why Council-level reasoning is justified]

Process:
5 Advisors → Anonymous Peer Review → Chairman

Never run the Council invisibly.

### Smart recommendation mode

For genuinely high-impact decisions, recommend the Council BEFORE implementation but do NOT automatically activate it.

Use wording similar to:

🧠 Council recommended: this is a high-impact decision.
Would you like me to run the LLM Council before we proceed?

A recommendation is NOT authorization.

Wait for explicit user approval before running the full Council.

### Recommend Council when appropriate for

- pricing strategy
- subscription plans
- credit economics
- shared balance economics
- unit economics
- business model
- monetization
- launch strategy
- major product positioning
- major go-to-market decisions
- important provider/model strategy
- major architecture decisions
- expensive infrastructure decisions
- major irreversible data-model decisions
- major security architecture
- significant product pivots
- adding/removing core capabilities
- major UX/product-direction changes that are expensive to reverse

For VANTRA specifically, strongly consider recommending it for:

- Hobby / Pro / Studio structure
- DZD pricing
- shared balance design
- credit consumption rules
- model cost allocation
- margin protection
- free vs paid usage
- launch pricing
- Algeria-first vs international expansion
- core AI model/provider selection
- major changes to the unified Chat / Image / Video proposition

### Do NOT use Council for routine work

Do not run or recommend Council for:

- CSS
- padding/spacing
- typography tweaks
- small copy edits
- normal frontend components
- lint problems
- TypeScript errors
- ordinary bugs
- small refactors
- dependency maintenance
- file renaming
- minor responsive fixes
- routine implementation
- simple factual questions
- questions with one objectively correct technical answer

Examples that should NOT trigger Council:

"Make this navbar responsive."
"Fix this TypeScript error."
"Should this padding be 48px or 56px?"
"Change this button text."
"Fix this component bug."

### Decision threshold

Before recommending Council, ask internally:

"If this choice is wrong, could it materially cost money, customers, time, positioning, architecture stability, or be expensive to reverse?"

If no:
continue normally.

If yes:
recommend Council.

Do not over-trigger.

### Token protection

The full Council may run ONLY when:

1. the user explicitly requests it,

or

2. the agent recommends it and the user explicitly approves.

Never interpret silence as approval.

Normal work should use normal reasoning.

### Duplicate-run protection

Before running Council, check existing Council reports/transcripts if available.

If essentially the same decision was already analyzed and no material inputs changed, tell the user instead of automatically repeating it.

Offer:

- show/use the previous verdict
- or run a fresh Council if explicitly requested

### VANTRA factual grounding

When Council is used for VANTRA, inspect repository context first.

Use factual information from:

- AGENTS.md
- actual code/configuration
- project documentation
- previous Council reports
- user-provided business facts

Do not invent:

- revenue
- margins
- customer counts
- conversion rates
- provider agreements
- partnerships
- AI model costs
- pricing
- payment capabilities
- launch metrics

Clearly identify missing information.

### Council completion

Every completed Council session should clearly end with:

🧠 LLM COUNCIL COMPLETE

and surface:

- Final recommendation
- Highest-confidence agreement
- Biggest disagreement
- Most important blind spot
- The one thing to do first

Preserve the report/transcript behavior defined by the installed skill.
