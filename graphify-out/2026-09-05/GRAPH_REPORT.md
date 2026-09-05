# Graph Report - diwan-ai-main  (2026-09-05)

## Corpus Check
- 208 files · ~267,338 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 786 nodes · 1027 edges · 141 communities (90 shown, 51 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8de2303b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- Faq.tsx
- router.ts
- SettingsModal.tsx
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
- cn
- src/components/ui/logo-cloud-3.tsx
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
- lib/utils.ts
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- @google/genai
- how a council session works
- transcribe/route.ts
- @ai-sdk/openai
- verify-showcase.mjs
- MessageBubble.tsx
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- verify-lm3.mjs
- components/ui/logo-cloud-3.tsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- audit-4.mjs
- audit-crash.mjs
- audit-final.mjs
- dotenv
- clsx
- motion
- react-use-measure
- verify-hero-copy.mjs
- verify-marketing-locales.mjs
- verify-navbar.mjs
- StudioDashboard.tsx
- ai
- @heyputer/puter.js
- @ai-sdk/react
- lucide-react
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 62 edges
2. `useUser()` - 18 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `TopUpModal()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ModelSelector()` --calls--> `cn()`  [EXTRACTED]
  components/ui/claude-style-chat-input.tsx → lib/utils.ts
- `Textarea` --calls--> `cn()`  [EXTRACTED]
  components/ui/textarea.tsx → lib/utils.ts
- `SpotlightCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/landing/ui.tsx → lib/utils.ts
- `ImageResultCard()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/ImageResultCard.tsx → lib/utils.ts
- `BillingPanel()` --calls--> `cn()`  [EXTRACTED]
  src/components/studio/SettingsModal.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (141 total, 51 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.08
Nodes (14): COST_ROWS, CostTableSection(), FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS (+6 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.18
Nodes (9): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+1 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "Faq.tsx"
Cohesion: 0.50
Nodes (3): Faq(), FAQ_OWNER_TODOS, FaqItem

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (25): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+17 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (12): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+4 more)

### Community 9 - "src/components/OriginalLandingPage.tsx"
Cohesion: 0.05
Nodes (34): CinematicScrollMockup(), FEATURE_IMAGES, LiquidMetalButton(), LiquidMetalButtonProps, GlobalFooter(), LINKS, hashSeed(), HeroSection() (+26 more)

### Community 10 - "src/context/ModalContext.tsx"
Cohesion: 0.09
Nodes (23): AuthModal(), AuthModalProps, ClosingCtaSection(), Navbar(), NavbarProps, OriginalLandingPage(), ShimmerButton(), ShimmerButtonProps (+15 more)

### Community 11 - "HeroEntrance.tsx"
Cohesion: 0.40
Nodes (3): childVariants, containerVariants, HeroEntranceProps

### Community 17 - "أوامر المتابعة بعد تقرير التشخيص"
Cohesion: 0.08
Nodes (24): Prompt إصلاح موقع Diwan AI داخل Antigravity IDE, Prompt التشغيل الرئيسي — انسخه كما هو, أ. خريطة المشروع, أوامر المتابعة بعد تقرير التشخيص, الأمر 1 — إصلاح أخطاء التشغيل والبناء, الأمر 2 — إصلاح الوظائف الأساسية, الأمر 3 — توحيد الهوية والبيانات الحساسة للثقة, الأمر 4 — إصلاح اللغة العربية وRTL (+16 more)

### Community 21 - "ImageConfigPopover.tsx"
Cohesion: 0.15
Nodes (14): ASPECT_RATIOS, AspectRatio, GEN_COUNTS, GenCount, IMAGE_MODELS, ImageConfig, ImageConfigPill(), ImageConfigPopover() (+6 more)

### Community 22 - "cn"
Cohesion: 0.21
Nodes (12): cn(), GhostButton(), PanelLabel(), ScrollArea, Segmented(), SHELL_TOKENS, WorkspaceShell(), CREATE_ITEMS (+4 more)

### Community 23 - "src/components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): InfiniteSlider(), InfiniteSliderProps, Logo, LogoCloud(), LogoCloudProps

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "VideoConfigPopover.tsx"
Cohesion: 0.18
Nodes (9): CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS, VideoConfig, VideoConfigPill(), VideoConfigPopover(), VideoDuration (+1 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): framer-motion, dependencies, framer-motion, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.21
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), FilterKey, FILTERS, formatDuration() (+4 more)

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.06
Nodes (27): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+19 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 40 - "lib/utils.ts"
Cohesion: 0.29
Nodes (4): Textarea, TextareaProps, InfiniteSlider(), InfiniteSliderProps

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

### Community 85 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

### Community 89 - "generate-image/route.ts"
Cohesion: 0.08
Nodes (34): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+26 more)

### Community 104 - "components/ui/logo-cloud-3.tsx"
Cohesion: 0.33
Nodes (5): Logo, LogoCloud(), LogoCloudProps, logos, PartnersSection()

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "StudioDashboard.tsx"
Cohesion: 0.05
Nodes (40): PrimaryButton(), StateBlock(), CreationWorkspace(), CreationWorkspaceProps, ASPECT_RATIOS, ImageCanvas(), ImageRequestDraft, OUTPUT_COUNTS (+32 more)

## Knowledge Gaps
- **327 isolated node(s):** `CreationWorkspaceProps`, `SidebarSession`, `DashboardSidebarProps`, `CREATE_ITEMS`, `WORKSPACE_ITEMS` (+322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `claude-style-chat-input.tsx`, `Faq.tsx`, `StudioDashboard.tsx`, `SettingsModal.tsx`, `components/ui/logo-cloud-3.tsx`, `lib/utils.ts`, `src/components/OriginalLandingPage.tsx`, `src/context/ModalContext.tsx`, `ImageConfigPopover.tsx`, `MessageBubble.tsx`, `src/components/ui/logo-cloud-3.tsx`, `VideoConfigPopover.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `getModelCost()` connect `generate-image/route.ts` to `src/components/LiveLedgerCard.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `CreationWorkspaceProps`, `SidebarSession`, `DashboardSidebarProps` to the rest of the system?**
  _327 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08275862068965517 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._