# Graph Report - diwan-ai-main  (2026-09-06)

## Corpus Check
- 217 files · ~277,876 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 844 nodes · 1116 edges · 151 communities (100 shown, 51 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d6b63bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- cn
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- WhyVantra.tsx
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
- DashboardSidebar.tsx
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- VideoConfigPopover.tsx
- react
- dependencies
- ImageResultCard.tsx
- [locale]/layout.tsx
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
- StudioDashboard.tsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- ui.tsx
- ImageCanvas.tsx
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
- AppShell.tsx
- @heyputer/puter.js
- @ai-sdk/react
- VANTRA Phase 8B financial boundary
- studio-registry.ts
- src/context/ModalContext.tsx
- HeroSection.tsx
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs
- lucide-react
- src/components/OriginalLandingPage.tsx
- components/ui/logo-cloud-3.tsx
- TerminalShowcase.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 62 edges
2. `useUser()` - 18 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `DemoMediaRepository` - 11 edges
8. `LLM Council Policy` - 10 edges
9. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
10. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `ConnectionsPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/StudioSettingsDialog.tsx → lib/utils.ts
- `WorkspaceShell()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/AppShell.tsx → lib/utils.ts
- `VideoConfigPill()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/VideoConfigPopover.tsx → lib/utils.ts
- `VideoConfigPopover()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/VideoConfigPopover.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (151 total, 51 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.09
Nodes (12): FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps (+4 more)

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
Cohesion: 0.16
Nodes (14): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, cn(), Faq(), FAQ_OWNER_TODOS, FaqItem (+6 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (25): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+17 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (11): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+3 more)

### Community 9 - "WhyVantra.tsx"
Cohesion: 0.17
Nodes (5): CARD_MOTION, FEATURE_EYEBROWS, MODEL_CHIPS, SupportingFeature, WhyVantra()

### Community 10 - "media-repository.ts"
Cohesion: 0.10
Nodes (19): addDemoMedia(), ASSETS, DEMO_LIBRARY_EVENT, DEMO_LIBRARY_KEY, DemoMediaItem, DemoMediaKind, downloadDemoMedia(), readDemoLibrary() (+11 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 23 - "DashboardSidebar.tsx"
Cohesion: 0.25
Nodes (7): PanelLabel(), ScrollArea, CREATE_ITEMS, DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS

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

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.07
Nodes (27): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+19 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 40 - "LandingHeader.tsx"
Cohesion: 0.21
Nodes (8): GlobalFooter(), LINKS, CinematicEnter(), LandingHeader(), LandingHeaderProps, LOCALES, NAV_LINKS, VantraLogo()

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
Cohesion: 0.11
Nodes (28): ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt, maxDuration, POST(), PROVIDER_MODELS (+20 more)

### Community 95 - "cost-engine.ts"
Cohesion: 0.13
Nodes (13): ceilDivide(), chargeScaled(), CostEngine, CostModality, CostQuote, MarginProtectionError, ModelPricing, PricingRates (+5 more)

### Community 104 - "StudioDashboard.tsx"
Cohesion: 0.16
Nodes (9): CenterMode, ChatSession, MAGIC_SKILLS, ConnectionsPanel(), StudioSettingsDialog(), TabId, TABS, CHAT_MODELS (+1 more)

### Community 117 - "ui.tsx"
Cohesion: 0.24
Nodes (6): FinalCta(), Testimonial, Testimonials(), Magnetic(), SectionHeading(), SpotlightCard()

### Community 118 - "ImageCanvas.tsx"
Cohesion: 0.22
Nodes (8): ASPECT_RATIOS, ImageCanvas(), ImageRequestDraft, OUTPUT_COUNTS, MotionStudio(), ModelsPanel(), IMAGE_MODELS, isModelSelectable()

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "MotionStudio.tsx"
Cohesion: 0.18
Nodes (7): CreationWorkspaceProps, ASPECT_RATIOS, CAMERA_PRESETS, DURATIONS, VideoMode, VideoRequestDraft, VIDEO_MODELS

### Community 135 - "AppShell.tsx"
Cohesion: 0.18
Nodes (10): GhostButton(), PrimaryButton(), Segmented(), SHELL_TOKENS, StateBlock(), WorkspaceShell(), FilterKey, MediaItem (+2 more)

### Community 138 - "VANTRA Phase 8B financial boundary"
Cohesion: 0.40
Nodes (4): Activation prerequisites, Demo boundary, Legacy Chat boundary, VANTRA Phase 8B financial boundary

### Community 139 - "studio-registry.ts"
Cohesion: 0.29
Nodes (6): DEFAULT_CHAT_MODEL, DEFAULT_VIDEO_MODEL, STUDIO_MODELS, StudioControl, StudioModality, StudioModelDefinition

### Community 140 - "src/context/ModalContext.tsx"
Cohesion: 0.05
Nodes (39): dynamic, maxDuration, POST(), App(), AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS (+31 more)

### Community 141 - "HeroSection.tsx"
Cohesion: 0.28
Nodes (7): LiquidMetalButton(), LiquidMetalButtonProps, hashSeed(), HeroSection(), HeroSectionProps, PATHS, HERO_STAT_VALUES

### Community 148 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.32
Nodes (4): CinematicScrollMockup(), FEATURE_IMAGES, HowItWorks(), STEP_ICONS

### Community 149 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 150 - "TerminalShowcase.tsx"
Cohesion: 0.40
Nodes (5): cn2(), Line, SCRIPT, TerminalShowcase(), TONE_CLASS

## Knowledge Gaps
- **345 isolated node(s):** `LandingHeaderProps`, `NAV_LINKS`, `LOCALES`, `SidebarSession`, `DashboardSidebarProps` (+340 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `claude-style-chat-input.tsx`, `MotionStudio.tsx`, `AppShell.tsx`, `LandingHeader.tsx`, `SettingsModal.tsx`, `media-repository.ts`, `StudioDashboard.tsx`, `src/context/ModalContext.tsx`, `ui.tsx`, `components/ui/logo-cloud-3.tsx`, `DashboardSidebar.tsx`, `ImageCanvas.tsx`, `ImageConfigPopover.tsx`, `MessageBubble.tsx`, `VideoConfigPopover.tsx`, `ImageResultCard.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `createClient()` connect `generate-image/route.ts` to `src/context/ModalContext.tsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `LandingHeaderProps`, `NAV_LINKS`, `LOCALES` to the rest of the system?**
  _345 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._