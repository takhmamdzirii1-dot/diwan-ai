# Graph Report - diwan-ai-main  (2026-08-27)

## Corpus Check
- 125 files · ~48,790 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 448 nodes · 560 edges · 88 communities (55 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `40fdd308`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/context/ModalContext.tsx
- framer-motion
- devDependencies
- verify-final.mjs
- compilerOptions
- StudioDashboard.tsx
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
- cn
- transcribe/route.ts
- src/components/HeroSection.tsx
- @ai-sdk/openai
- VideoConfigPopover.tsx
- @ai-sdk/react
- verify-motion-studio.mjs
- verify-library.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 29 edges
2. `useModal()` - 16 edges
3. `useUser()` - 16 edges
4. `compilerOptions` - 16 edges
5. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
6. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
7. `SpotlightCard()` - 6 edges
8. `readImageLibrary()` - 6 edges
9. `getModelCost()` - 6 edges
10. `createClient()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  app/auth/callback/route.ts → src/lib/supabase/server.ts
- `ClaudeChatInput()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `Textarea` --calls--> `cn()`  [EXTRACTED]
  components/ui/textarea.tsx → lib/utils.ts
- `DashboardSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/DashboardSidebar.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (88 total, 33 thin omitted)

### Community 0 - "src/context/ModalContext.tsx"
Cohesion: 0.07
Nodes (29): AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton() (+21 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 7 - "StudioDashboard.tsx"
Cohesion: 0.08
Nodes (19): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+11 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.17
Nodes (6): App(), HeroCinematicBackground(), HeroCinematicBackgroundProps, OriginalLandingPage(), aiModels, translations

### Community 10 - "dependencies"
Cohesion: 0.29
Nodes (7): ai, clsx, dependencies, ai, clsx, react-markdown, react-markdown

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

### Community 69 - "cn"
Cohesion: 0.07
Nodes (38): Textarea, TextareaProps, cn(), ImageCanvas(), ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount (+30 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "src/components/HeroSection.tsx"
Cohesion: 0.06
Nodes (22): cairo, ibmPlexMono, inter, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, FAQS, FEATURES (+14 more)

### Community 89 - "VideoConfigPopover.tsx"
Cohesion: 0.11
Nodes (18): dynamic, maxDuration, POST(), GET(), MotionStudio(), CAMERA_MOTIONS, CameraMotion, DURATIONS (+10 more)

## Knowledge Gaps
- **183 isolated node(s):** `dynamic`, `maxDuration`, `Provider`, `ALLOWED_MODELS`, `ALLOWED_RATIOS` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `src/context/ModalContext.tsx`, `VideoConfigPopover.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `framer-motion`, `devDependencies`, `dotenv`, `express`, `@google/genai`, `lucide-react`, `motion`, `next`, `puppeteer-core`, `react`, `react-dom`, `rehype-raw`, `remark-gfm`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwind-merge`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `zod`, `@ai-sdk/openai`, `@ai-sdk/react`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `useUser()` connect `src/context/ModalContext.tsx` to `src/components/OriginalLandingPage.tsx`, `StudioDashboard.tsx`, `cn`, `src/components/HeroSection.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `dynamic`, `maxDuration`, `Provider` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/context/ModalContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07358156028368794 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._