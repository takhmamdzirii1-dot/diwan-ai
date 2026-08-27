# Graph Report - diwan-ai-main  (2026-08-26)

## Corpus Check
- 119 files · ~48,583 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 510 edges · 83 communities (51 shown, 32 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47d1ea5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- StudioDashboard.tsx
- cn
- devDependencies
- src/components/HeroSection.tsx
- compilerOptions
- src/components/AuthModal.tsx
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- createClient
- src/components/OriginalLandingPage.tsx
- dependencies
- HeroEntrance.tsx
- lib/supabase.ts
- graphify.js
- gold-theme.mjs
- AmbientMeshGlow.tsx
- typewriter.tsx
- أوامر المتابعة بعد تقرير التشخيص
- src/components/studio/StudioWorkspace.tsx
- dotenv
- express
- framer-motion
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
- @ai-sdk/react
- transcribe/route.ts
- @ai-sdk/openai

## God Nodes (most connected - your core abstractions)
1. `useModal()` - 24 edges
2. `useUser()` - 22 edges
3. `cn()` - 17 edges
4. `compilerOptions` - 16 edges
5. `getModelCost()` - 8 edges
6. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
7. `المرحلة الأولى: إنشاء تقرير تشخيص فقط` - 7 edges
8. `SpotlightCard()` - 6 edges
9. `createClient()` - 6 edges
10. `include` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `POST()` --calls--> `createClient()`  [EXTRACTED]
  app/api/generate/chat/route.ts → src/lib/supabase/server.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  app/auth/callback/route.ts → src/lib/supabase/server.ts
- `ClaudeChatInput()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `DashboardSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/DashboardSidebar.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (83 total, 32 thin omitted)

### Community 0 - "StudioDashboard.tsx"
Cohesion: 0.06
Nodes (47): dynamic, maxDuration, POST(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, OriginalLandingPage() (+39 more)

### Community 1 - "cn"
Cohesion: 0.11
Nodes (20): Textarea, TextareaProps, ChatModelOption, ComposerAction, useAutoResizeTextarea(), UseAutoResizeTextareaProps, V0AIChatProps, VercelV0Chat() (+12 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 3 - "src/components/HeroSection.tsx"
Cohesion: 0.11
Nodes (11): metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps, ClosingCtaSection(), containerVariants, floatingCardVariants, HeroSection(), HeroSectionProps (+3 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "src/components/AuthModal.tsx"
Cohesion: 0.39
Nodes (4): AuthModal(), AuthModalProps, createClient(), supabase

### Community 6 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.11
Nodes (11): FAQS, FEATURES, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps, LogItem (+3 more)

### Community 7 - "claude-style-chat-input.tsx"
Cohesion: 0.11
Nodes (15): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+7 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.18
Nodes (5): App(), HeroCinematicBackground(), HeroCinematicBackgroundProps, aiModels, translations

### Community 10 - "dependencies"
Cohesion: 0.29
Nodes (7): ai, clsx, dependencies, ai, clsx, react-markdown, react-markdown

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "AGENTS.md"
Cohesion: 0.50
Nodes (3): Graphify Protocol (MANDATORY — never skip), This is NOT the Next.js you know, Work Protocol (from SELF_RULES.md)

## Knowledge Gaps
- **166 isolated node(s):** `dynamic`, `maxDuration`, `dynamic`, `maxDuration`, `metadata` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useModal()` connect `StudioDashboard.tsx` to `src/components/OriginalLandingPage.tsx`, `src/components/HeroSection.tsx`, `claude-style-chat-input.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `dotenv`, `express`, `framer-motion`, `@google/genai`, `lucide-react`, `motion`, `next`, `puppeteer-core`, `react`, `react-dom`, `rehype-raw`, `remark-gfm`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwind-merge`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `zod`, `@ai-sdk/react`, `@ai-sdk/openai`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `StudioDashboard.tsx`, `claude-style-chat-input.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `dynamic`, `maxDuration`, `dynamic` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `StudioDashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061507936507936505 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._