# Graph Report - diwan-ai-main  (2026-09-05)

## Corpus Check
- 207 files · ~266,743 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 780 nodes · 1013 edges · 145 communities (93 shown, 52 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `636fc2b8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- ImageCanvas.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- TerminalShowcase.tsx
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
- ui.tsx
- LandingHeader.tsx
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- VideoConfigPopover.tsx
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
- WhyVantra.tsx
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- @google/genai
- how a council session works
- transcribe/route.ts
- DashboardSidebar.tsx
- verify-showcase.mjs
- src/components/OriginalLandingPage.tsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- StudioDashboard.tsx
- verify-lm3.mjs
- HeroSection.tsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- framer-motion
- cn
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
- ai
- @heyputer/puter.js
- src/components/studio/StudioWorkspace.tsx
- @ai-sdk/openai
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs
- @ai-sdk/react

## God Nodes (most connected - your core abstractions)
1. `cn()` - 62 edges
2. `useUser()` - 18 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `isModelSelectable()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `PrivacyPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (145 total, 52 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.09
Nodes (12): FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps (+4 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.18
Nodes (8): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector()

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "ImageCanvas.tsx"
Cohesion: 0.33
Nodes (4): ASPECT_RATIOS, ImageRequestDraft, OUTPUT_COUNTS, IMAGE_MODELS

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (25): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+17 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (12): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+4 more)

### Community 9 - "TerminalShowcase.tsx"
Cohesion: 0.40
Nodes (5): cn2(), Line, SCRIPT, TerminalShowcase(), TONE_CLASS

### Community 10 - "src/context/ModalContext.tsx"
Cohesion: 0.09
Nodes (22): AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton() (+14 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 22 - "ui.tsx"
Cohesion: 0.18
Nodes (9): Faq(), FAQ_OWNER_TODOS, FaqItem, FinalCta(), Testimonial, Testimonials(), Magnetic(), SectionHeading() (+1 more)

### Community 23 - "LandingHeader.tsx"
Cohesion: 0.21
Nodes (8): GlobalFooter(), LINKS, CinematicEnter(), LandingHeader(), LandingHeaderProps, LOCALES, NAV_LINKS, VantraLogo()

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "VideoConfigPopover.tsx"
Cohesion: 0.09
Nodes (18): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection(), MessageBubble(), MessageBubbleProps, CAMERA_MOTIONS (+10 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): lucide-react, dependencies, lucide-react, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.21
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), FilterKey, FILTERS, formatDuration() (+4 more)

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.06
Nodes (28): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+20 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 40 - "WhyVantra.tsx"
Cohesion: 0.17
Nodes (5): CARD_MOTION, FEATURE_EYEBROWS, MODEL_CHIPS, SupportingFeature, WhyVantra()

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

### Community 79 - "DashboardSidebar.tsx"
Cohesion: 0.15
Nodes (12): CREATE_ITEMS, DashboardSidebar(), DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS, ProfilePanel(), StudioDashboard() (+4 more)

### Community 85 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.32
Nodes (4): CinematicScrollMockup(), FEATURE_IMAGES, HowItWorks(), STEP_ICONS

### Community 89 - "generate-image/route.ts"
Cohesion: 0.09
Nodes (32): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+24 more)

### Community 95 - "StudioDashboard.tsx"
Cohesion: 0.11
Nodes (19): ImageCanvas(), MotionStudio(), CenterMode, ChatSession, MAGIC_SKILLS, ConnectionsPanel(), ModelsPanel(), StudioSettingsDialog() (+11 more)

### Community 104 - "HeroSection.tsx"
Cohesion: 0.32
Nodes (6): LiquidMetalButton(), LiquidMetalButtonProps, hashSeed(), HeroSection(), HeroSectionProps, PATHS

### Community 118 - "cn"
Cohesion: 0.14
Nodes (18): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, cn(), GhostButton(), PanelLabel(), PrimaryButton() (+10 more)

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "MotionStudio.tsx"
Cohesion: 0.22
Nodes (7): ASPECT_RATIOS, CAMERA_PRESETS, DURATIONS, VideoMode, VideoRequestDraft, DEFAULT_VIDEO_MODEL, VIDEO_MODELS

## Knowledge Gaps
- **327 isolated node(s):** `AttachedFile`, `ChatModelOption`, `ClaudeSendPayload`, `ClaudeChatInputProps`, `SHELL_TOKENS` (+322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `claude-style-chat-input.tsx`, `ImageCanvas.tsx`, `MotionStudio.tsx`, `SettingsModal.tsx`, `MediaLibrary.tsx`, `DashboardSidebar.tsx`, `ImageConfigPopover.tsx`, `ui.tsx`, `LandingHeader.tsx`, `VideoConfigPopover.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `generate-image/route.ts` to `src/context/ModalContext.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `AttachedFile`, `ChatModelOption`, `ClaudeSendPayload` to the rest of the system?**
  _327 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._