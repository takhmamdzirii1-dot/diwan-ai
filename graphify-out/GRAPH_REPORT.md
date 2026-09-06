# Graph Report - diwan-ai-main  (2026-09-06)

## Corpus Check
- 219 files · ~278,750 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 866 nodes · 1128 edges · 148 communities (96 shown, 52 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9e30a6e2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/SpotlightCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- cn
- router.ts
- src/hooks/useUser.ts
- verify-feed.mjs
- src/components/OriginalLandingPage.tsx
- media-repository.ts
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
- ai
- StudioDashboard.tsx
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- VideoConfigPopover.tsx
- react
- dependencies
- ImageResultCard.tsx
- [locale]/page.tsx
- LLM Council Transcript — VANTRA Localization Architecture
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- LandingHeader.tsx
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- @google/genai
- how a council session works
- transcribe/route.ts
- @ai-sdk/openai
- verify-showcase.mjs
- MessageBubble.tsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- cost-engine.ts
- verify-lm3.mjs
- ImageCanvas.tsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- fonts.ts
- StudioSettingsDialog.tsx
- audit-4.mjs
- audit-crash.mjs
- audit-final.mjs
- dotenv
- clsx
- motion
- react-use-measure
- verify-hero-copy.mjs
- verify-marketing-locales.mjs
- verify-navbar.mjs
- MotionStudio.tsx
- [workspace]/page.tsx
- @heyputer/puter.js
- @ai-sdk/react
- VANTRA Phase 8B financial boundary
- src/context/ModalContext.tsx
- lucide-react
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs
- components/ui/logo-cloud-3.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 62 edges
2. `useUser()` - 26 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `VANTRA Studio — Project Identity` - 12 edges
6. `DemoMediaRepository` - 11 edges
7. `createClient()` - 10 edges
8. `LLM Council Policy` - 10 edges
9. `VantraLogo()` - 8 edges
10. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ConnectionsPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/StudioSettingsDialog.tsx → lib/utils.ts
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
- `VideoConfigPill()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/VideoConfigPopover.tsx → lib/utils.ts
- `VideoConfigPopover()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/VideoConfigPopover.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (148 total, 52 thin omitted)

### Community 0 - "src/components/SpotlightCard.tsx"
Cohesion: 0.07
Nodes (12): AmbientMotionBackgroundProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS (+4 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.18
Nodes (9): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+1 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "cn"
Cohesion: 0.11
Nodes (23): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, cn(), Faq(), FAQ_OWNER_TODOS, FaqItem (+15 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (25): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+17 more)

### Community 7 - "src/hooks/useUser.ts"
Cohesion: 0.06
Nodes (38): CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps, LogItem, ModelInfo, Navbar(), NavbarProps (+30 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.05
Nodes (25): CinematicScrollMockup(), FEATURE_IMAGES, LiquidMetalButton(), LiquidMetalButtonProps, App(), hashSeed(), HeroSection(), HeroSectionProps (+17 more)

### Community 10 - "media-repository.ts"
Cohesion: 0.10
Nodes (18): addDemoMedia(), ASSETS, DEMO_LIBRARY_EVENT, DEMO_LIBRARY_KEY, DemoMediaItem, DemoMediaKind, downloadDemoMedia(), readDemoLibrary() (+10 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 23 - "StudioDashboard.tsx"
Cohesion: 0.15
Nodes (14): PanelLabel(), ScrollArea, CREATE_ITEMS, DashboardSidebar(), DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS (+6 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "VideoConfigPopover.tsx"
Cohesion: 0.18
Nodes (9): CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS, VideoConfig, VideoConfigPill(), VideoConfigPopover(), VideoDuration (+1 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): framer-motion, dependencies, framer-motion, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "ImageResultCard.tsx"
Cohesion: 0.40
Nodes (5): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary()

### Community 32 - "[locale]/page.tsx"
Cohesion: 0.10
Nodes (19): MarketingLocaleLayout(), metadata, dynamic, dynamicParams, generateMetadata(), languageAlternates, loadMessages(), messageLoaders (+11 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 40 - "LandingHeader.tsx"
Cohesion: 0.17
Nodes (8): AuthModal(), AuthModalProps, LINKS, LandingHeader(), LandingHeaderProps, LOCALES, NAV_LINKS, VantraLogo()

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.09
Nodes (22): Council completion, Critical CSS Lessons (NEVER REPEAT), Decision threshold, Deploy, Design Rules (NEVER VIOLATE), Do NOT use Council for routine work, Duplicate-run protection, Explicit activation (+14 more)

### Community 71 - "how a council session works"
Cohesion: 0.11
Nodes (18): 1. The Contrarian, 2. The First Principles Thinker, 3. The Expansionist, 4. The Outsider, 5. The Executor, example: counciling a product decision, how a council session works, important notes (+10 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 85 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 89 - "generate-image/route.ts"
Cohesion: 0.09
Nodes (32): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+24 more)

### Community 95 - "cost-engine.ts"
Cohesion: 0.13
Nodes (13): ceilDivide(), chargeScaled(), CostEngine, CostModality, CostQuote, MarginProtectionError, ModelPricing, PricingRates (+5 more)

### Community 104 - "ImageCanvas.tsx"
Cohesion: 0.20
Nodes (6): PrimaryButton(), CreationWorkspaceProps, ASPECT_RATIOS, ImageRequestDraft, OUTPUT_COUNTS, IMAGE_MODELS

### Community 117 - "fonts.ts"
Cohesion: 0.33
Nodes (4): cairo, ibmPlexMono, inter, rootFontClasses

### Community 118 - "StudioSettingsDialog.tsx"
Cohesion: 0.15
Nodes (10): ImageCanvas(), MotionStudio(), ConnectionsPanel(), CreditsPanel(), GeneralPanel(), ModelsPanel(), TabId, TABS (+2 more)

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "MotionStudio.tsx"
Cohesion: 0.14
Nodes (13): ASPECT_RATIOS, CAMERA_PRESETS, DURATIONS, VideoMode, VideoRequestDraft, CHAT_MODELS, DEFAULT_CHAT_MODEL, DEFAULT_VIDEO_MODEL (+5 more)

### Community 138 - "VANTRA Phase 8B financial boundary"
Cohesion: 0.40
Nodes (4): Activation prerequisites, Demo boundary, Legacy Chat boundary, VANTRA Phase 8B financial boundary

### Community 140 - "src/context/ModalContext.tsx"
Cohesion: 0.11
Nodes (19): mergeMessages(), metadata, StudioRootLayout(), StudioWorkspace(), StudioWorkspaceRoute, WORKSPACES, DEFAULT_PLAN, getVisibleCredits() (+11 more)

### Community 149 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (4): Logo, LogoCloud(), LogoCloudProps, logos

## Knowledge Gaps
- **354 isolated node(s):** `metadata`, `WORKSPACES`, `dynamicParams`, `metadata`, `dynamic` (+349 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/page.tsx`, `claude-style-chat-input.tsx`, `MotionStudio.tsx`, `src/hooks/useUser.ts`, `LandingHeader.tsx`, `src/components/OriginalLandingPage.tsx`, `ImageCanvas.tsx`, `components/ui/logo-cloud-3.tsx`, `StudioSettingsDialog.tsx`, `StudioDashboard.tsx`, `ImageConfigPopover.tsx`, `MessageBubble.tsx`, `VideoConfigPopover.tsx`, `ImageResultCard.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `useUser()` connect `src/hooks/useUser.ts` to `src/components/OriginalLandingPage.tsx`, `src/context/ModalContext.tsx`, `StudioSettingsDialog.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `useUser()` (e.g. with `getServerSnapshot()` and `getSnapshot()`) actually correct?**
  _`useUser()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `metadata`, `WORKSPACES`, `dynamicParams` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/SpotlightCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07007575757575757 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._