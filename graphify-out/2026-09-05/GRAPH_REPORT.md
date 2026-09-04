# Graph Report - diwan-ai-main  (2026-09-05)

## Corpus Check
- 207 files · ~267,350 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 1002 edges · 143 communities (92 shown, 51 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca0d31b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/SpotlightCard.tsx
- DashboardSidebar.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- src/components/LiveLedgerCard.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- useModal
- src/context/ModalContext.tsx
- HeroEntrance.tsx
- lib/supabase.ts
- graphify.js
- gold-theme.mjs
- AmbientMeshGlow.tsx
- typewriter.tsx
- أوامر المتابعة بعد تقرير التشخيص
- @paper-design/shaders-react
- express
- ImageConfigPopover.tsx
- @ai-sdk/react
- src/components/OriginalLandingPage.tsx
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- MotionStudio.tsx
- react
- dependencies
- MediaLibrary.tsx
- [locale]/layout.tsx
- LLM Council Transcript — VANTRA Localization Architecture
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- @heyputer/puter.js
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- src/components/AuthModal.tsx
- how a council session works
- transcribe/route.ts
- cn
- verify-showcase.mjs
- MessageBubble.tsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- StudioDashboard.tsx
- verify-lm3.mjs
- clsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- components/ui/logo-cloud-3.tsx
- src/components/ui/logo-cloud-3.tsx
- audit-4.mjs
- audit-crash.mjs
- audit-final.mjs
- dotenv
- @google/genai
- motion
- react-use-measure
- verify-hero-copy.mjs
- verify-marketing-locales.mjs
- verify-navbar.mjs
- lib/utils.ts
- ai
- lucide-react
- @ai-sdk/openai
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 61 edges
2. `useUser()` - 17 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `VantraLogo()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `ConnectionsPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/StudioSettingsDialog.tsx → lib/utils.ts
- `LogoCloud()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/logo-cloud-3.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (143 total, 51 thin omitted)

### Community 0 - "src/components/SpotlightCard.tsx"
Cohesion: 0.15
Nodes (7): COST_ROWS, CostTableSection(), FAQS, FEATURES, STEPS, SpotlightCard(), SpotlightCardProps

### Community 1 - "DashboardSidebar.tsx"
Cohesion: 0.18
Nodes (11): CREATE_ITEMS, DashboardSidebar(), DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS, ProfilePanel(), CreditsPanel() (+3 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.17
Nodes (7): HeroCinematicBackgroundProps, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps, LogItem, ModelInfo

### Community 6 - "router.ts"
Cohesion: 0.09
Nodes (28): LiquidMetalButton(), LiquidMetalButtonProps, mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter() (+20 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (12): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+4 more)

### Community 9 - "useModal"
Cohesion: 0.26
Nodes (6): ClosingCtaSection(), Navbar(), NavbarProps, ShimmerButton(), ShimmerButtonProps, useModal()

### Community 10 - "src/context/ModalContext.tsx"
Cohesion: 0.19
Nodes (10): DEFAULT_PLAN, TopUpModal(), TopUpModalProps, TopUpPlan, MODEL_PRICES, TOPUP_PLANS, DEFAULT_TOPUP_PLAN, ModalContext (+2 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 23 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.05
Nodes (35): CinematicScrollMockup(), FEATURE_IMAGES, GlobalFooter(), LINKS, hashSeed(), HeroSection(), HeroSectionProps, PATHS (+27 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "MotionStudio.tsx"
Cohesion: 0.23
Nodes (9): CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS, VideoConfig, VideoConfigPill(), VideoConfigPopover(), VideoDuration (+1 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): framer-motion, dependencies, framer-motion, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.21
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), FilterKey, FILTERS, formatDuration() (+4 more)

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.06
Nodes (28): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+20 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.09
Nodes (22): Council completion, Critical CSS Lessons (NEVER REPEAT), Decision threshold, Deploy, Design Rules (NEVER VIOLATE), Do NOT use Council for routine work, Duplicate-run protection, Explicit activation (+14 more)

### Community 69 - "src/components/AuthModal.tsx"
Cohesion: 0.43
Nodes (4): AuthModal(), AuthModalProps, createClient(), supabase

### Community 71 - "how a council session works"
Cohesion: 0.11
Nodes (18): 1. The Contrarian, 2. The First Principles Thinker, 3. The Expansionist, 4. The Outsider, 5. The Executor, example: counciling a product decision, how a council session works, important notes (+10 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "cn"
Cohesion: 0.31
Nodes (9): cn(), GhostButton(), PanelLabel(), PrimaryButton(), ScrollArea, Segmented(), SHELL_TOKENS, StateBlock() (+1 more)

### Community 85 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 89 - "generate-image/route.ts"
Cohesion: 0.09
Nodes (33): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+25 more)

### Community 95 - "StudioDashboard.tsx"
Cohesion: 0.06
Nodes (28): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+20 more)

### Community 117 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 118 - "src/components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): InfiniteSlider(), InfiniteSliderProps, Logo, LogoCloud(), LogoCloudProps

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "lib/utils.ts"
Cohesion: 0.29
Nodes (4): Textarea, TextareaProps, InfiniteSlider(), InfiniteSliderProps

## Knowledge Gaps
- **316 isolated node(s):** `AttachedFile`, `ClaudeSendPayload`, `ClaudeChatInputProps`, `MediaKind`, `FilterKey` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `DashboardSidebar.tsx`, `lib/utils.ts`, `router.ts`, `SettingsModal.tsx`, `MotionStudio.tsx`, `components/ui/logo-cloud-3.tsx`, `src/components/ui/logo-cloud-3.tsx`, `src/components/OriginalLandingPage.tsx`, `ImageConfigPopover.tsx`, `MessageBubble.tsx`, `MediaLibrary.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `generate-image/route.ts` to `src/components/SpotlightCard.tsx`, `src/context/ModalContext.tsx`, `MotionStudio.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `AttachedFile`, `ClaudeSendPayload`, `ClaudeChatInputProps` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/SpotlightCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09176788124156546 - nodes in this community are weakly interconnected._