# Graph Report - diwan-ai-main  (2026-09-04)

## Corpus Check
- 205 files · ~265,369 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 749 nodes · 975 edges · 139 communities (87 shown, 52 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9b555d40`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- framer-motion
- devDependencies
- verify-final.mjs
- compilerOptions
- StudioDashboard.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- src/context/ModalContext.tsx
- useUser
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
- src/components/studio/StudioWorkspace.tsx
- react
- dependencies
- MediaLibrary.tsx
- [locale]/page.tsx
- LLM Council Transcript — VANTRA Localization Architecture
- @supabase/supabase-js
- tailwind-merge
- @tailwindcss/postcss
- @tailwindcss/typography
- @tailwindcss/vite
- @vitejs/plugin-react
- @heyputer/puter.js
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- DashboardSidebar.tsx
- how a council session works
- transcribe/route.ts
- cn
- verify-showcase.mjs
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- claude-style-chat-input.tsx
- verify-lm3.mjs
- clsx
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
- @google/genai
- motion
- react-use-measure
- verify-hero-copy.mjs
- verify-marketing-locales.mjs
- verify-navbar.mjs
- MessageBubble.tsx
- ai
- @ai-sdk/openai
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 57 edges
2. `useUser()` - 16 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `VantraLogo()` - 7 edges

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

## Communities (139 total, 52 thin omitted)

### Community 0 - "src/components/LiveLedgerCard.tsx"
Cohesion: 0.07
Nodes (17): ClosingCtaSection(), COST_ROWS, CostTableSection(), FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType (+9 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "StudioDashboard.tsx"
Cohesion: 0.18
Nodes (9): ClaudeChatInput(), ModelSelector(), ImageCanvas(), MediaLibrary(), SettingsModal(), CenterMode, ChatSession, MAGIC_SKILLS (+1 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (11): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), TabId, TABS (+3 more)

### Community 9 - "src/context/ModalContext.tsx"
Cohesion: 0.08
Nodes (22): cairo, ibmPlexMono, inter, rootFontClasses, metadata, metadata, AmbientMotionBackground(), AmbientMotionBackgroundProps (+14 more)

### Community 10 - "useUser"
Cohesion: 0.24
Nodes (8): Navbar(), NavbarProps, DashboardSidebar(), ProfilePanel(), StudioDashboard(), useModal(), useUser(), UseUserReturn

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
Cohesion: 0.05
Nodes (31): CinematicScrollMockup(), FEATURE_IMAGES, Logo, LogoCloud(), LogoCloudProps, GlobalFooter(), LINKS, CinematicEnter() (+23 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): lucide-react, dependencies, lucide-react, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.20
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), DUMMY_MEDIA, FilterKey, FILTERS (+4 more)

### Community 32 - "[locale]/page.tsx"
Cohesion: 0.09
Nodes (20): MarketingLocaleLayout(), dynamic, dynamicParams, generateMetadata(), languageAlternates, loadMessages(), messageLoaders, { Link, redirect, usePathname, useRouter, getPathname } (+12 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

### Community 67 - "VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)"
Cohesion: 0.33
Nodes (5): VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل), أخطاء الماضي — لا تكررها, البروتوكول الإلزامي لكل تعديل, القاعدة الذهبية, قواعد التصميم الثابتة (Nardo & Champagne v5+)

### Community 68 - "VANTRA Studio — Project Identity"
Cohesion: 0.09
Nodes (22): Council completion, Critical CSS Lessons (NEVER REPEAT), Decision threshold, Deploy, Design Rules (NEVER VIOLATE), Do NOT use Council for routine work, Duplicate-run protection, Explicit activation (+14 more)

### Community 69 - "DashboardSidebar.tsx"
Cohesion: 0.18
Nodes (10): LandingHeader(), LandingHeaderProps, LOCALES, NAV_LINKS, CREATE_ITEMS, DashboardSidebarProps, SidebarSession, Workspace (+2 more)

### Community 71 - "how a council session works"
Cohesion: 0.11
Nodes (18): 1. The Contrarian, 2. The First Principles Thinker, 3. The Expansionist, 4. The Outsider, 5. The Executor, example: counciling a product decision, how a council session works, important notes (+10 more)

### Community 78 - "transcribe/route.ts"
Cohesion: 0.40
Nodes (3): ALLOWED_MIME, dynamic, maxDuration

### Community 79 - "cn"
Cohesion: 0.14
Nodes (18): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, cn(), GhostButton(), PanelLabel(), PrimaryButton() (+10 more)

### Community 89 - "generate-image/route.ts"
Cohesion: 0.09
Nodes (33): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+25 more)

### Community 95 - "claude-style-chat-input.tsx"
Cohesion: 0.08
Nodes (22): AttachedFile, ChatModelOption, ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), LiquidMetalButton(), LiquidMetalButtonProps (+14 more)

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

### Community 134 - "MessageBubble.tsx"
Cohesion: 0.39
Nodes (4): MessageBubble(), MessageBubbleProps, useSmoothText(), detectDir()

## Knowledge Gaps
- **312 isolated node(s):** `FEATURE_IMAGES`, `HeroCinematicBackgroundProps`, `CategoryType`, `LiveLedgerCardProps`, `LogItem` (+307 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/page.tsx`, `DashboardSidebar.tsx`, `StudioDashboard.tsx`, `MessageBubble.tsx`, `SettingsModal.tsx`, `useUser`, `ImageConfigPopover.tsx`, `src/components/OriginalLandingPage.tsx`, `MediaLibrary.tsx`, `claude-style-chat-input.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `useUser()` connect `useUser` to `src/components/LiveLedgerCard.tsx`, `[locale]/page.tsx`, `DashboardSidebar.tsx`, `StudioDashboard.tsx`, `SettingsModal.tsx`, `src/context/ModalContext.tsx`, `src/components/OriginalLandingPage.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `FEATURE_IMAGES`, `HeroCinematicBackgroundProps`, `CategoryType` to the rest of the system?**
  _312 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06606606606606606 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._