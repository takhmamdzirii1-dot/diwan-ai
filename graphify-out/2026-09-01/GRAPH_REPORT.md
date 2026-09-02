# Graph Report - diwan-ai-main  (2026-08-31)

## Corpus Check
- 187 files · ~259,989 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 649 nodes · 850 edges · 130 communities (80 shown, 50 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1964c716`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/context/ModalContext.tsx
- lucide-react
- devDependencies
- verify-final.mjs
- compilerOptions
- SettingsModal.tsx
- router.ts
- verify-feed.mjs
- src/components/OriginalLandingPage.tsx
- MotionStudio.tsx
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
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- react
- dependencies
- MediaLibrary.tsx
- cn
- components/ui/logo-cloud-3.tsx
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- framer-motion
- puppeteer-core
- transcribe/route.ts
- verify-showcase.mjs
- clsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- translations.js
- verify-lm3.mjs
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
2. `useUser()` - 16 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 11 edges
7. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
8. `VantraLogo()` - 7 edges
9. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
10. `POST()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
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

## Communities (130 total, 50 thin omitted)

### Community 0 - "src/context/ModalContext.tsx"
Cohesion: 0.05
Nodes (28): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, ClosingCtaSection(), COST_ROWS (+20 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "SettingsModal.tsx"
Cohesion: 0.06
Nodes (26): AuthModal(), AuthModalProps, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps, LogItem, ModelInfo (+18 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.06
Nodes (35): App(), GlobalFooter(), LINKS, hashSeed(), HeroSection(), HeroSectionProps, PATHS, STATS (+27 more)

### Community 10 - "MotionStudio.tsx"
Cohesion: 0.13
Nodes (16): dynamic, maxDuration, POST(), MotionStudio(), CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS (+8 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): ai, dependencies, ai, react-dom, react-markdown, @supabase/ssr, react-dom, react-markdown (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.19
Nodes (13): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+5 more)

### Community 32 - "cn"
Cohesion: 0.05
Nodes (50): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+42 more)

### Community 33 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.15
Nodes (12): Critical CSS Lessons (NEVER REPEAT), Deploy, Design Rules (NEVER VIOLATE), GIT SYNC RULES (follow every session), GIT SYNC RULES (follow every session — BOTH agents), Graphify Protocol (MANDATORY — never skip), Key Architectural Patterns, Project Structure (+4 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 89 - "generate-image/route.ts"
Cohesion: 0.10
Nodes (28): ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt, maxDuration, POST(), PROVIDER_MODELS (+20 more)

## Knowledge Gaps
- **252 isolated node(s):** `dynamic`, `maxDuration`, `RATIO_DIMENSIONS`, `PROVIDER_MODELS`, `ALLOWED_RATIOS` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `components/ui/logo-cloud-3.tsx`, `SettingsModal.tsx`, `src/components/OriginalLandingPage.tsx`, `MotionStudio.tsx`, `ImageConfigPopover.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `createClient()` connect `generate-image/route.ts` to `MotionStudio.tsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `useUser()` connect `SettingsModal.tsx` to `src/context/ModalContext.tsx`, `src/components/OriginalLandingPage.tsx`, `cn`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `dynamic`, `maxDuration`, `RATIO_DIMENSIONS` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/context/ModalContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0512987012987013 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._