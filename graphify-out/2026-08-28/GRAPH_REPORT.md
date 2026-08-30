# Graph Report - diwan-ai-main  (2026-08-28)

## Corpus Check
- 140 files · ~51,063 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 501 nodes · 637 edges · 100 communities (64 shown, 36 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88af14cd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/context/ModalContext.tsx
- layout.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- ImageConfigPopover.tsx
- SettingsModal.tsx
- cn
- verify-feed.mjs
- src/components/OriginalLandingPage.tsx
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
- generate-image/route.ts
- @google/genai
- lucide-react
- motion
- next.config.mjs
- next-env.d.ts
- next
- puppeteer-core
- react
- react-dom
- rehype-raw
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
- src/components/SpotlightCard.tsx
- verify-showcase.mjs
- clsx
- src/components/AuthModal.tsx
- @ai-sdk/openai
- VideoConfigPopover.tsx
- @ai-sdk/react
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js

## God Nodes (most connected - your core abstractions)
1. `cn()` - 49 edges
2. `useUser()` - 16 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
6. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
7. `SpotlightCard()` - 6 edges
8. `SectionHeading()` - 6 edges
9. `getModelCost()` - 6 edges
10. `createClient()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `BentoCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/ShowcaseSection.tsx → lib/utils.ts
- `ImageConfigPill()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageConfigPopover.tsx → lib/utils.ts
- `ImageConfigPopover()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageConfigPopover.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (100 total, 36 thin omitted)

### Community 0 - "src/context/ModalContext.tsx"
Cohesion: 0.09
Nodes (18): ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton(), ShimmerButtonProps, StudioDashboard() (+10 more)

### Community 1 - "layout.tsx"
Cohesion: 0.14
Nodes (7): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, HeroCinematicBackgroundProps

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "ImageConfigPopover.tsx"
Cohesion: 0.17
Nodes (10): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+2 more)

### Community 6 - "SettingsModal.tsx"
Cohesion: 0.09
Nodes (19): CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps, LogItem, ModelInfo, BillingPanel(), IMAGE_MODEL_HINTS (+11 more)

### Community 7 - "cn"
Cohesion: 0.07
Nodes (39): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+31 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.07
Nodes (28): App(), GlobalFooter(), LINKS, HeroSection(), HeroSectionProps, PATHS, STATS, Faq() (+20 more)

### Community 10 - "dependencies"
Cohesion: 0.29
Nodes (7): ai, framer-motion, dependencies, ai, framer-motion, react-markdown, react-markdown

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "generate-image/route.ts"
Cohesion: 0.17
Nodes (12): ALLOWED_COUNTS, ALLOWED_MODELS, ALLOWED_RATIOS, dynamic, maxDuration, POST(), Provider, RATIO_DIMENSIONS (+4 more)

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

### Community 79 - "src/components/SpotlightCard.tsx"
Cohesion: 0.18
Nodes (5): FAQS, FEATURES, STEPS, SpotlightCard(), SpotlightCardProps

### Community 86 - "src/components/AuthModal.tsx"
Cohesion: 0.43
Nodes (4): AuthModal(), AuthModalProps, createClient(), supabase

### Community 89 - "VideoConfigPopover.tsx"
Cohesion: 0.11
Nodes (18): dynamic, maxDuration, POST(), GET(), MotionStudio(), CAMERA_MOTIONS, CameraMotion, DURATIONS (+10 more)

## Knowledge Gaps
- **198 isolated node(s):** `dynamic`, `maxDuration`, `Provider`, `ALLOWED_MODELS`, `ALLOWED_RATIOS` (+193 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `src/context/ModalContext.tsx`, `MediaLibrary.tsx`, `ImageConfigPopover.tsx`, `SettingsModal.tsx`, `src/components/OriginalLandingPage.tsx`, `VideoConfigPopover.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `useUser()` connect `SettingsModal.tsx` to `src/context/ModalContext.tsx`, `src/components/OriginalLandingPage.tsx`, `cn`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `dotenv`, `express`, `@google/genai`, `lucide-react`, `motion`, `next`, `puppeteer-core`, `react`, `react-dom`, `rehype-raw`, `remark-gfm`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwind-merge`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `zod`, `clsx`, `@ai-sdk/openai`, `@ai-sdk/react`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `dynamic`, `maxDuration`, `Provider` to the rest of the system?**
  _198 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/context/ModalContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0928030303030303 - nodes in this community are weakly interconnected._
- **Should `layout.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._