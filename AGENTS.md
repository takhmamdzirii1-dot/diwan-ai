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

## Work Protocol

1. Never claim "done" without proof: screenshot + computed-style numbers from the live page.
2. Run `npm run lint` and `npm run build` before any deploy.
3. Follow installed skills (emil-design-eng values, improve-animations audit values) — never invent motion values.
4. Always `git add` + `git commit` after completing significant work (user approved this standing instruction).
5. Always `graphify update .` after code changes (post-commit hook also does this).
6. AUTO-DEPLOY ALWAYS (user standing instruction): after completing any code change — run `npm run lint` + `npm run build`, then immediately `vercel deploy --prod --yes` WITHOUT waiting for the user to ask. Retry once on transient `fetch failed`. Verify the production URL afterwards.
