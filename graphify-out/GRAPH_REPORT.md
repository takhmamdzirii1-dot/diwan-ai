# Graph Report - diwan-ai-main  (2026-08-30)

## Corpus Check
- 186 files · ~65,638 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 642 nodes · 833 edges · 133 communities (83 shown, 50 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c92e4a1c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- @paper-design/shaders-react
- devDependencies
- verify-final.mjs
- compilerOptions
- src/context/ModalContext.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- src/components/OriginalLandingPage.tsx
- @ai-sdk/openai
- HeroEntrance.tsx
- lib/supabase.ts
- graphify.js
- gold-theme.mjs
- AmbientMeshGlow.tsx
- typewriter.tsx
- أوامر المتابعة بعد تقرير التشخيص
- claude-style-chat-input.tsx
- express
- ImageConfigPopover.tsx
- @ai-sdk/react
- lucide-react
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- GlobalPricing.tsx
- react
- dependencies
- MediaLibrary.tsx
- ai
- lib/utils.ts
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- react-dom
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- cn
- @supabase/ssr
- transcribe/route.ts
- VideoConfigPopover.tsx
- verify-showcase.mjs
- clsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js
- verify-lm3.mjs
- framer-motion
- verify-journey.mjs
- StudioDashboard.tsx
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- MessageBubble.tsx
- @heyputer/puter.js
- rehype-raw
- audit-4.mjs
- audit-crash.mjs
- audit-final.mjs
- dotenv
- @google/genai
- motion
- react-use-measure
- verify-hero-copy.mjs
- verify-navbar.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 59 edges
2. `compilerOptions` - 16 edges
3. `useModal()` - 14 edges
4. `useUser()` - 13 edges
5. `VANTRA Studio — Project Identity` - 9 edges
6. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
7. `VantraLogo()` - 7 edges
8. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
9. `ImageGenerateParams` - 6 edges
10. `getUserPollinationsConnection()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `BentoCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/ShowcaseSection.tsx → lib/utils.ts
- `Toggle()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `ProviderConnections()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `PrivacyPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (133 total, 50 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.06
Nodes (17): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackgroundProps, FAQS, FEATURES, HeroCinematicBackgroundProps (+9 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "src/context/ModalContext.tsx"
Cohesion: 0.07
Nodes (28): AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton() (+20 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (11): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), TabId, TABS (+3 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.07
Nodes (29): App(), GlobalFooter(), LINKS, CinematicEnter(), Faq(), FAQS, FinalCta(), HowItWorks() (+21 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 19 - "claude-style-chat-input.tsx"
Cohesion: 0.18
Nodes (8): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector()

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "GlobalPricing.tsx"
Cohesion: 0.50
Nodes (3): GlobalPricing(), PricingTier, TIERS

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, puppeteer-core, react-markdown, remark-gfm, zod, puppeteer-core, react-markdown, remark-gfm (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.19
Nodes (13): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+5 more)

### Community 33 - "lib/utils.ts"
Cohesion: 0.18
Nodes (10): InfiniteSlider(), InfiniteSliderProps, Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection(), Logo (+2 more)

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.18
Nodes (10): Critical CSS Lessons (NEVER REPEAT), Deploy, Design Rules (NEVER VIOLATE), Graphify Protocol (MANDATORY — never skip), Key Architectural Patterns, Project Structure, Tech Stack, This is NOT the Next.js you know (+2 more)

### Community 69 - "cn"
Cohesion: 0.18
Nodes (13): Textarea, TextareaProps, cn(), GhostButton(), PanelLabel(), PrimaryButton(), ScrollArea, Segmented() (+5 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "VideoConfigPopover.tsx"
Cohesion: 0.11
Nodes (17): LiquidMetalButton(), LiquidMetalButtonProps, PROVIDER_REGISTRY, hashSeed(), HeroSection(), HeroSectionProps, PATHS, STATS (+9 more)

### Community 89 - "generate-image/route.ts"
Cohesion: 0.08
Nodes (33): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+25 more)

### Community 109 - "StudioDashboard.tsx"
Cohesion: 0.15
Nodes (11): CREATE_ITEMS, DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS, ImageCanvas(), SettingsModal(), CenterMode (+3 more)

### Community 116 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

## Knowledge Gaps
- **250 isolated node(s):** `This is NOT the Next.js you know`, `Tech Stack`, `Project Structure`, `Design Rules (NEVER VIOLATE)`, `Key Architectural Patterns` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `lib/utils.ts`, `src/context/ModalContext.tsx`, `SettingsModal.tsx`, `src/components/OriginalLandingPage.tsx`, `StudioDashboard.tsx`, `VideoConfigPopover.tsx`, `claude-style-chat-input.tsx`, `MessageBubble.tsx`, `ImageConfigPopover.tsx`, `GlobalPricing.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `useModal()` connect `src/context/ModalContext.tsx` to `src/components/OriginalLandingPage.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `react-use-measure`, `@paper-design/shaders-react`, `devDependencies`, `@ai-sdk/openai`, `express`, `@ai-sdk/react`, `lucide-react`, `next`, `react`, `ai`, `@supabase/supabase-js`, `tailwind-merge`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `react-dom`, `@supabase/ssr`, `clsx`, `framer-motion`, `@heyputer/puter.js`, `rehype-raw`, `dotenv`, `@google/genai`, `motion`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `This is NOT the Next.js you know`, `Tech Stack`, `Project Structure` to the rest of the system?**
  _250 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06306306306306306 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._