# Graph Report - diwan-ai-main  (2026-08-29)

## Corpus Check
- 174 files · ~61,335 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 603 nodes · 793 edges · 131 communities (83 shown, 48 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88af14cd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- layout.tsx
- @paper-design/shaders-react
- devDependencies
- verify-final.mjs
- compilerOptions
- DashboardSidebar.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- ui.tsx
- dependencies
- HeroEntrance.tsx
- lib/supabase.ts
- graphify.js
- gold-theme.mjs
- AmbientMeshGlow.tsx
- typewriter.tsx
- أوامر المتابعة بعد تقرير التشخيص
- dotenv
- express
- ImageConfigPopover.tsx
- StudioDashboard.tsx
- lucide-react
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- puppeteer-core
- react
- react-dom
- react-markdown
- remark-gfm
- @supabase/ssr
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- zod
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- AGENTS.md
- MediaLibrary.tsx
- transcribe/route.ts
- src/components/LiveLedgerCard.tsx
- verify-showcase.mjs
- clsx
- generate-image/route.ts
- MotionStudio.tsx
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js
- verify-lm3.mjs
- framer-motion
- verify-journey.mjs
- @ai-sdk/react
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- @ai-sdk/openai
- @heyputer/puter.js
- rehype-raw
- audit-4.mjs
- audit-crash.mjs
- audit-final.mjs
- cn
- src/components/OriginalLandingPage.tsx
- ShowcaseSection.tsx
- App.tsx
- TerminalShowcase.tsx
- GlobalPricing.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 51 edges
2. `useUser()` - 16 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 10 edges
6. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
7. `VantraLogo()` - 7 edges
8. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
9. `POST()` - 6 edges
10. `ImageGenerateParams` - 6 edges

## Surprising Connections (you probably didn't know these)
- `BentoCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/ShowcaseSection.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `PrivacyPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `ProviderConnections()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (131 total, 48 thin omitted)

### Community 0 - "layout.tsx"
Cohesion: 0.22
Nodes (6): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "DashboardSidebar.tsx"
Cohesion: 0.07
Nodes (31): AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton() (+23 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (12): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+4 more)

### Community 9 - "ui.tsx"
Cohesion: 0.18
Nodes (9): FinalCta(), HowItWorks(), STEPS, Quote, ROW_ONE, ROW_TWO, Testimonials(), Magnetic() (+1 more)

### Community 10 - "dependencies"
Cohesion: 0.29
Nodes (7): ai, @google/genai, motion, dependencies, ai, @google/genai, motion

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 22 - "StudioDashboard.tsx"
Cohesion: 0.09
Nodes (18): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+10 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "AGENTS.md"
Cohesion: 0.50
Nodes (3): Graphify Protocol (MANDATORY — never skip), This is NOT the Next.js you know, Work Protocol (from SELF_RULES.md)

### Community 69 - "MediaLibrary.tsx"
Cohesion: 0.19
Nodes (13): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+5 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.09
Nodes (12): FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps (+4 more)

### Community 89 - "generate-image/route.ts"
Cohesion: 0.10
Nodes (29): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+21 more)

### Community 90 - "MotionStudio.tsx"
Cohesion: 0.11
Nodes (18): LiquidMetalButton(), LiquidMetalButtonProps, PROVIDER_REGISTRY, hashSeed(), HeroSection(), HeroSectionProps, PATHS, STATS (+10 more)

### Community 125 - "cn"
Cohesion: 0.19
Nodes (13): Textarea, TextareaProps, cn(), Faq(), FAQS, GhostButton(), PanelLabel(), PrimaryButton() (+5 more)

### Community 126 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.29
Nodes (6): GlobalFooter(), LINKS, CinematicEnter(), LandingHeader(), LandingHeaderProps, VantraLogo()

### Community 127 - "ShowcaseSection.tsx"
Cohesion: 0.29
Nodes (4): SpotlightCard(), BENTO, BentoCard(), ShowcaseSection()

### Community 129 - "TerminalShowcase.tsx"
Cohesion: 0.40
Nodes (5): cn2(), Line, SCRIPT, TerminalShowcase(), TONE_CLASS

### Community 130 - "GlobalPricing.tsx"
Cohesion: 0.50
Nodes (3): GlobalPricing(), PricingTier, TIERS

## Knowledge Gaps
- **230 isolated node(s):** `dynamic`, `maxDuration`, `RATIO_DIMENSIONS`, `PROVIDER_MODELS`, `ALLOWED_RATIOS` (+225 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `GlobalPricing.tsx`, `DashboardSidebar.tsx`, `MediaLibrary.tsx`, `SettingsModal.tsx`, `ui.tsx`, `ImageConfigPopover.tsx`, `StudioDashboard.tsx`, `MotionStudio.tsx`, `src/components/OriginalLandingPage.tsx`, `ShowcaseSection.tsx`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `useUser()` connect `DashboardSidebar.tsx` to `App.tsx`, `SettingsModal.tsx`, `src/components/LiveLedgerCard.tsx`, `StudioDashboard.tsx`, `src/components/OriginalLandingPage.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `dynamic`, `maxDuration`, `RATIO_DIMENSIONS` to the rest of the system?**
  _230 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `DashboardSidebar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07020408163265306 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._