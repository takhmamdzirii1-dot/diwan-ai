# Graph Report - diwan-ai-main  (2026-09-05)

## Corpus Check
- 207 files · ~266,698 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 782 nodes · 1015 edges · 153 communities (101 shown, 52 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8618c3e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- ui.tsx
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
- framer-motion
- WhyVantra.tsx
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
- useUser
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- how a council session works
- transcribe/route.ts
- StudioDashboard.tsx
- verify-showcase.mjs
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- StudioSettingsDialog.tsx
- verify-lm3.mjs
- clsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- src/components/OriginalLandingPage.tsx
- cn
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
- MotionStudio.tsx
- ai
- src/components/AuthModal.tsx
- lucide-react
- MessageBubble.tsx
- StudioDashboard
- src/components/ShimmerButton.tsx
- @ai-sdk/openai
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs
- components/ui/logo-cloud-3.tsx
- ImageCanvas.tsx
- src/components/TopUpModal.tsx
- HeroSection.tsx
- Faq.tsx
- @ai-sdk/react

## God Nodes (most connected - your core abstractions)
1. `cn()` - 62 edges
2. `useUser()` - 19 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `routing` - 7 edges

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

## Communities (153 total, 52 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.09
Nodes (12): FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps (+4 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.15
Nodes (11): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+3 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "ui.tsx"
Cohesion: 0.24
Nodes (6): FinalCta(), Testimonial, Testimonials(), Magnetic(), SectionHeading(), SpotlightCard()

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
Cohesion: 0.24
Nodes (9): COST_ROWS, CostTableSection(), DashboardSidebar(), TopUpPlan, DEFAULT_TOPUP_PLAN, ModalContext, ModalContextType, ModalProvider() (+1 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 23 - "WhyVantra.tsx"
Cohesion: 0.17
Nodes (5): CARD_MOTION, FEATURE_EYEBROWS, MODEL_CHIPS, SupportingFeature, WhyVantra()

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "VideoConfigPopover.tsx"
Cohesion: 0.18
Nodes (9): CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS, VideoConfig, VideoConfigPill(), VideoConfigPopover(), VideoDuration (+1 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): @heyputer/puter.js, dependencies, @heyputer/puter.js, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.21
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), FilterKey, FILTERS, formatDuration() (+4 more)

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.06
Nodes (28): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+20 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 40 - "useUser"
Cohesion: 0.25
Nodes (7): Navbar(), NavbarProps, ProfilePanel(), CreditsPanel(), GeneralPanel(), useUser(), UseUserReturn

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

### Community 79 - "StudioDashboard.tsx"
Cohesion: 0.16
Nodes (14): CinematicEnter(), GhostButton(), PanelLabel(), ScrollArea, SHELL_TOKENS, CREATE_ITEMS, DashboardSidebarProps, SidebarSession (+6 more)

### Community 89 - "generate-image/route.ts"
Cohesion: 0.08
Nodes (34): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+26 more)

### Community 95 - "StudioSettingsDialog.tsx"
Cohesion: 0.12
Nodes (15): ImageCanvas(), ConnectionsPanel(), ModelsPanel(), StudioSettingsDialog(), TabId, TABS, CHAT_MODELS, DEFAULT_CHAT_MODEL (+7 more)

### Community 117 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.24
Nodes (6): CinematicScrollMockup(), FEATURE_IMAGES, GlobalFooter(), LINKS, HowItWorks(), STEP_ICONS

### Community 118 - "cn"
Cohesion: 0.15
Nodes (15): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, cn(), LandingHeader(), LandingHeaderProps, LOCALES (+7 more)

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "MotionStudio.tsx"
Cohesion: 0.22
Nodes (7): Segmented(), ASPECT_RATIOS, CAMERA_PRESETS, DURATIONS, MotionStudio(), VideoMode, VideoRequestDraft

### Community 136 - "src/components/AuthModal.tsx"
Cohesion: 0.43
Nodes (4): AuthModal(), AuthModalProps, createClient(), supabase

### Community 138 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 140 - "src/components/ShimmerButton.tsx"
Cohesion: 0.33
Nodes (3): ClosingCtaSection(), ShimmerButton(), ShimmerButtonProps

### Community 147 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 148 - "ImageCanvas.tsx"
Cohesion: 0.29
Nodes (5): PrimaryButton(), StateBlock(), ASPECT_RATIOS, ImageRequestDraft, OUTPUT_COUNTS

### Community 149 - "src/components/TopUpModal.tsx"
Cohesion: 0.50
Nodes (3): DEFAULT_PLAN, TopUpModal(), TopUpModalProps

### Community 150 - "HeroSection.tsx"
Cohesion: 0.50
Nodes (4): hashSeed(), HeroSection(), HeroSectionProps, PATHS

### Community 151 - "Faq.tsx"
Cohesion: 0.50
Nodes (3): Faq(), FAQ_OWNER_TODOS, FaqItem

## Knowledge Gaps
- **326 isolated node(s):** `metadata`, `languageAlternates`, `dynamicParams`, `dynamic`, `metadata` (+321 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `claude-style-chat-input.tsx`, `ui.tsx`, `MotionStudio.tsx`, `SettingsModal.tsx`, `src/context/ModalContext.tsx`, `MessageBubble.tsx`, `StudioDashboard`, `VideoConfigPopover.tsx`, `StudioDashboard.tsx`, `components/ui/logo-cloud-3.tsx`, `ImageCanvas.tsx`, `ImageConfigPopover.tsx`, `Faq.tsx`, `MediaLibrary.tsx`, `StudioSettingsDialog.tsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `generate-image/route.ts` to `src/context/ModalContext.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `metadata`, `languageAlternates`, `dynamicParams` to the rest of the system?**
  _326 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1051693404634581 - nodes in this community are weakly interconnected._