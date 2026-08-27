# Graph Report - diwan-ai-main  (2026-08-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 352 nodes · 469 edges · 68 communities (39 shown, 29 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47d1ea5c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useModal
- claude-style-chat-input.tsx
- devDependencies
- src/components/HeroSection.tsx
- compilerOptions
- src/context/ModalContext.tsx
- StudioDashboard.tsx
- src/components/SpotlightCard.tsx
- src/components/OriginalLandingPage.tsx
- dependencies
- HeroEntrance.tsx
- lib/supabase.ts
- graphify.js
- gold-theme.mjs
- AmbientMeshGlow.tsx
- typewriter.tsx
- @ai-sdk/react
- clsx
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

## God Nodes (most connected - your core abstractions)
1. `useModal()` - 24 edges
2. `useUser()` - 22 edges
3. `compilerOptions` - 16 edges
4. `cn()` - 15 edges
5. `getModelCost()` - 8 edges
6. `createClient()` - 6 edges
7. `SpotlightCard()` - 6 edges
8. `include` - 6 edges
9. `StudioImage()` - 5 edges
10. `StudioVideo()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  app/auth/callback/route.ts → src/lib/supabase/server.ts
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `DashboardSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/DashboardSidebar.tsx → lib/utils.ts
- `StudioDashboard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/StudioDashboard.tsx → lib/utils.ts
- `Textarea` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/animated-ai-chat.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (68 total, 29 thin omitted)

### Community 0 - "useModal"
Cohesion: 0.07
Nodes (32): dynamic, maxDuration, POST(), GET(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps (+24 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.08
Nodes (26): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+18 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+21 more)

### Community 3 - "src/components/HeroSection.tsx"
Cohesion: 0.09
Nodes (17): AmbientMotionBackgroundProps, ClosingCtaSection(), HeroCinematicBackground(), HeroCinematicBackgroundProps, containerVariants, floatingCardVariants, HeroSection(), HeroSectionProps (+9 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "src/context/ModalContext.tsx"
Cohesion: 0.12
Nodes (14): metadata, AmbientMotionBackground(), AuthModal(), AuthModalProps, DEFAULT_PLAN, TopUpModal(), TopUpModalProps, TopUpPlan (+6 more)

### Community 6 - "StudioDashboard.tsx"
Cohesion: 0.12
Nodes (15): DashboardSidebar(), DashboardSidebarProps, DashboardView, NAV_ITEMS, MessageBubble(), MessageBubbleProps, CenterMode, ChatSession (+7 more)

### Community 7 - "src/components/SpotlightCard.tsx"
Cohesion: 0.18
Nodes (5): FAQS, FEATURES, STEPS, SpotlightCard(), SpotlightCardProps

### Community 8 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.24
Nodes (4): App(), OriginalLandingPage(), aiModels, translations

### Community 9 - "dependencies"
Cohesion: 0.29
Nodes (7): ai, @ai-sdk/openai, dependencies, ai, @ai-sdk/openai, react-markdown, react-markdown

### Community 10 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

## Knowledge Gaps
- **135 isolated node(s):** `NavbarProps`, `StudioChatProps`, `GeneratedImage`, `ChatSession`, `StudioMode` (+130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useModal()` connect `useModal` to `src/components/OriginalLandingPage.tsx`, `src/components/HeroSection.tsx`, `src/context/ModalContext.tsx`, `StudioDashboard.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `@ai-sdk/react`, `clsx`, `dotenv`, `express`, `framer-motion`, `@google/genai`, `lucide-react`, `motion`, `next`, `puppeteer-core`, `react`, `react-dom`, `rehype-raw`, `remark-gfm`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwind-merge`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `zod`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `cn()` connect `claude-style-chat-input.tsx` to `StudioDashboard.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `NavbarProps`, `StudioChatProps`, `GeneratedImage` to the rest of the system?**
  _135 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useModal` be split into smaller, more focused modules?**
  _Cohesion score 0.07227891156462585 - nodes in this community are weakly interconnected._
- **Should `claude-style-chat-input.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07936507936507936 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._