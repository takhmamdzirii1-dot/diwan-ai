# Graph Report - diwan-ai-main  (2026-09-02)

## Corpus Check
- 187 files · ~259,389 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 646 nodes · 832 edges · 134 communities (84 shown, 50 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d774ddc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- cn
- devDependencies
- verify-final.mjs
- compilerOptions
- MotionStudio.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- DashboardSidebar.tsx
- StudioDashboard.tsx
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
- claude-style-chat-input.tsx
- react
- dependencies
- MediaLibrary.tsx
- lib/utils.ts
- LandingHeader.tsx
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- lucide-react
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- MessageBubble.tsx
- puppeteer-core
- transcribe/route.ts
- components/ui/logo-cloud-3.tsx
- verify-showcase.mjs
- ai
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js
- verify-lm3.mjs
- clsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
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
- @ai-sdk/openai

## God Nodes (most connected - your core abstractions)
1. `cn()` - 57 edges
2. `compilerOptions` - 16 edges
3. `useUser()` - 15 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 11 edges
7. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
8. `VantraLogo()` - 7 edges
9. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
10. `ImageGenerateParams` - 6 edges

## Surprising Connections (you probably didn't know these)
- `LandingHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/LandingHeader.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `Textarea` --calls--> `cn()`  [EXTRACTED]
  components/ui/textarea.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (134 total, 50 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.06
Nodes (18): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, FAQS, FEATURES (+10 more)

### Community 1 - "cn"
Cohesion: 0.23
Nodes (11): cn(), GhostButton(), PanelLabel(), PrimaryButton(), ScrollArea, Segmented(), SHELL_TOKENS, StateBlock() (+3 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "MotionStudio.tsx"
Cohesion: 0.11
Nodes (18): LiquidMetalButton(), LiquidMetalButtonProps, PROVIDER_REGISTRY, hashSeed(), HeroSection(), HeroSectionProps, PATHS, STATS (+10 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (11): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), TabId, TABS (+3 more)

### Community 9 - "DashboardSidebar.tsx"
Cohesion: 0.06
Nodes (36): dynamic, maxDuration, POST(), AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection() (+28 more)

### Community 10 - "StudioDashboard.tsx"
Cohesion: 0.18
Nodes (7): SettingsModal(), CenterMode, ChatSession, MAGIC_SKILLS, MODELS, StudioDashboard(), StudioWorkspace()

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
Cohesion: 0.06
Nodes (24): CinematicScrollMockup(), FEATURES, App(), GlobalPricing(), PricingTier, SHARED_PRODUCT_BENEFITS, TIERS, Faq() (+16 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "claude-style-chat-input.tsx"
Cohesion: 0.18
Nodes (8): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector()

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): framer-motion, dependencies, framer-motion, react-dom, react-markdown, @supabase/ssr, react-dom, react-markdown (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.19
Nodes (13): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+5 more)

### Community 32 - "lib/utils.ts"
Cohesion: 0.22
Nodes (7): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, Logo, LogoCloud(), LogoCloudProps

### Community 33 - "LandingHeader.tsx"
Cohesion: 0.24
Nodes (5): LINKS, LandingHeader(), LandingHeaderProps, NAV_LINKS, VantraLogo()

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.15
Nodes (12): Critical CSS Lessons (NEVER REPEAT), Deploy, Design Rules (NEVER VIOLATE), GIT SYNC RULES (follow every session), GIT SYNC RULES (follow every session — BOTH agents), Graphify Protocol (MANDATORY — never skip), Key Architectural Patterns, Project Structure (+4 more)

### Community 69 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (4): Logo, LogoCloud(), LogoCloudProps, logos

### Community 89 - "generate-image/route.ts"
Cohesion: 0.11
Nodes (28): ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt, maxDuration, POST(), PROVIDER_MODELS (+20 more)

## Knowledge Gaps
- **255 isolated node(s):** `PricingTier`, `SHARED_PRODUCT_BENEFITS`, `TIERS`, `FaqItem`, `FAQS` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `lib/utils.ts`, `LandingHeader.tsx`, `MotionStudio.tsx`, `MessageBubble.tsx`, `SettingsModal.tsx`, `DashboardSidebar.tsx`, `StudioDashboard.tsx`, `components/ui/logo-cloud-3.tsx`, `ImageConfigPopover.tsx`, `src/components/OriginalLandingPage.tsx`, `claude-style-chat-input.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `createClient()` connect `generate-image/route.ts` to `DashboardSidebar.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `DashboardSidebar.tsx` to `MotionStudio.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `PricingTier`, `SHARED_PRODUCT_BENEFITS`, `TIERS` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06456456456456457 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._