# Graph Report - diwan-ai-main  (2026-09-01)

## Corpus Check
- 186 files · ~259,012 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 638 nodes · 827 edges · 134 communities (84 shown, 50 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `18da016c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- lucide-react
- devDependencies
- verify-final.mjs
- compilerOptions
- SettingsModal.tsx
- router.ts
- cn
- verify-feed.mjs
- src/components/OriginalLandingPage.tsx
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
- lib/utils.ts
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- MessageBubble.tsx
- react
- dependencies
- MediaLibrary.tsx
- StudioDashboard.tsx
- components/ui/logo-cloud-3.tsx
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- src/components/ui/logo-cloud-3.tsx
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- DashboardSidebar.tsx
- puppeteer-core
- transcribe/route.ts
- GlobalPricing.tsx
- verify-showcase.mjs
- clsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js
- verify-lm3.mjs
- ai
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
10. `StudioDashboard()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `Textarea` --calls--> `cn()`  [EXTRACTED]
  components/ui/textarea.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts
- `PrivacyPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (134 total, 50 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.07
Nodes (19): COST_ROWS, CostTableSection(), FAQS, FEATURES, HeroCinematicBackgroundProps, hashSeed(), HeroSection(), HeroSectionProps (+11 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "SettingsModal.tsx"
Cohesion: 0.11
Nodes (13): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProfilePanel(), ProviderConnections(), SettingsModal() (+5 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "cn"
Cohesion: 0.31
Nodes (9): cn(), GhostButton(), PanelLabel(), PrimaryButton(), ScrollArea, Segmented(), SHELL_TOKENS, StateBlock() (+1 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.06
Nodes (34): App(), ClosingCtaSection(), GlobalFooter(), LINKS, CinematicEnter(), FinalCta(), HowItWorks(), STEPS (+26 more)

### Community 10 - "src/context/ModalContext.tsx"
Cohesion: 0.09
Nodes (20): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, AuthModal(), AuthModalProps (+12 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 23 - "lib/utils.ts"
Cohesion: 0.20
Nodes (6): Textarea, TextareaProps, Faq(), FAQS, InfiniteSlider(), InfiniteSliderProps

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): framer-motion, dependencies, framer-motion, react-dom, react-markdown, @supabase/ssr, react-dom, react-markdown (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.19
Nodes (13): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+5 more)

### Community 32 - "StudioDashboard.tsx"
Cohesion: 0.06
Nodes (26): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+18 more)

### Community 33 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 40 - "src/components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): InfiniteSlider(), InfiniteSliderProps, Logo, LogoCloud(), LogoCloudProps

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.15
Nodes (12): Critical CSS Lessons (NEVER REPEAT), Deploy, Design Rules (NEVER VIOLATE), GIT SYNC RULES (follow every session), GIT SYNC RULES (follow every session — BOTH agents), Graphify Protocol (MANDATORY — never skip), Key Architectural Patterns, Project Structure (+4 more)

### Community 69 - "DashboardSidebar.tsx"
Cohesion: 0.33
Nodes (5): CREATE_ITEMS, DashboardSidebarProps, SidebarSession, Workspace, WORKSPACE_ITEMS

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "GlobalPricing.tsx"
Cohesion: 0.50
Nodes (3): GlobalPricing(), PricingTier, TIERS

### Community 89 - "generate-image/route.ts"
Cohesion: 0.09
Nodes (33): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+25 more)

## Knowledge Gaps
- **251 isolated node(s):** `MODELS`, `CenterMode`, `ChatSession`, `MAGIC_SKILLS`, `AmbientMotionBackgroundProps` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `StudioDashboard.tsx`, `components/ui/logo-cloud-3.tsx`, `DashboardSidebar.tsx`, `SettingsModal.tsx`, `src/components/ui/logo-cloud-3.tsx`, `src/components/OriginalLandingPage.tsx`, `GlobalPricing.tsx`, `ImageConfigPopover.tsx`, `lib/utils.ts`, `MessageBubble.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `generate-image/route.ts` to `src/components/LiveLedgerCard.tsx`, `StudioDashboard.tsx`, `src/context/ModalContext.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `MODELS`, `CenterMode`, `ChatSession` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06825396825396825 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `SettingsModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._