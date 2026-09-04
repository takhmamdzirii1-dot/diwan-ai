# Graph Report - diwan-ai-main  (2026-09-05)

## Corpus Check
- 207 files · ~267,350 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 773 nodes · 1010 edges · 141 communities (90 shown, 51 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c5d0a738`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/components/LiveLedgerCard.tsx
- claude-style-chat-input.tsx
- devDependencies
- verify-final.mjs
- compilerOptions
- ui.tsx
- router.ts
- SettingsModal.tsx
- verify-feed.mjs
- TerminalShowcase.tsx
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
- framer-motion
- src/components/OriginalLandingPage.tsx
- audit-1.mjs
- next.config.mjs
- next-env.d.ts
- next
- MotionStudio.tsx
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
- @heyputer/puter.js
- VANTRA — SELF WORK RULES (متعهد أنفذها في كل تعديل)
- VANTRA Studio — Project Identity
- how a council session works
- transcribe/route.ts
- cn
- verify-showcase.mjs
- generate-image/route.ts
- verify-stats-polish.mjs
- verify-motion-studio.mjs
- verify-library.mjs
- modelsData.js
- StudioDashboard.tsx
- verify-lm3.mjs
- clsx
- verify-journey.mjs
- remark-gfm
- verify-standard.mjs
- verify-std2.mjs
- audit-2.mjs
- audit-3.mjs
- zod
- lib/utils.ts
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
- ai
- lucide-react
- @ai-sdk/openai
- next-intl
- react-markdown
- @supabase/ssr
- verify-rtl.mjs

## God Nodes (most connected - your core abstractions)
1. `cn()` - 61 edges
2. `useUser()` - 19 edges
3. `compilerOptions` - 16 edges
4. `useModal()` - 14 edges
5. `createClient()` - 12 edges
6. `VANTRA Studio — Project Identity` - 12 edges
7. `LLM Council Policy` - 10 edges
8. `أوامر المتابعة بعد تقرير التشخيص` - 8 edges
9. `LLM Council Transcript — VANTRA Localization Architecture` - 8 edges
10. `routing` - 7 edges

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
Cohesion: 0.09
Nodes (12): FAQS, FEATURES, HeroCinematicBackgroundProps, STEPS, CategoryType, LEDGER_MODELS, LiveLedgerCard(), LiveLedgerCardProps (+4 more)

### Community 1 - "claude-style-chat-input.tsx"
Cohesion: 0.10
Nodes (17): AttachedFile, ChatModelOption, ClaudeChatInput(), ClaudeChatInputProps, ClaudeSendPayload, FilePreviewCard(), formatFileSize(), ModelSelector() (+9 more)

### Community 2 - "devDependencies"
Cohesion: 0.06
Nodes (30): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 5 - "ui.tsx"
Cohesion: 0.18
Nodes (9): Faq(), FAQ_OWNER_TODOS, FaqItem, FinalCta(), Testimonial, Testimonials(), Magnetic(), SectionHeading() (+1 more)

### Community 6 - "router.ts"
Cohesion: 0.11
Nodes (24): mockMeta, mockProvider, POLLINATIONS_MODELS, pollinationsMeta, pollinationsProvider, generateWithPuter(), loadPuter(), PUTER_MODELS (+16 more)

### Community 7 - "SettingsModal.tsx"
Cohesion: 0.12
Nodes (12): BillingPanel(), IMAGE_MODEL_HINTS, IMAGE_MODELS, INSTRUCTION_SUGGESTIONS, PrivacyPanel(), ProviderConnections(), SettingsModal(), TabId (+4 more)

### Community 9 - "TerminalShowcase.tsx"
Cohesion: 0.40
Nodes (5): cn2(), Line, SCRIPT, TerminalShowcase(), TONE_CLASS

### Community 10 - "src/context/ModalContext.tsx"
Cohesion: 0.07
Nodes (33): AuthModal(), AuthModalProps, ClosingCtaSection(), COST_ROWS, CostTableSection(), Navbar(), NavbarProps, ShimmerButton() (+25 more)

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
Cohesion: 0.07
Nodes (21): CinematicScrollMockup(), FEATURE_IMAGES, Logo, LogoCloud(), LogoCloudProps, App(), CinematicEnter(), HowItWorks() (+13 more)

### Community 24 - "audit-1.mjs"
Cohesion: 0.50
Nodes (3): errors, out, t0

### Community 28 - "MotionStudio.tsx"
Cohesion: 0.23
Nodes (9): CAMERA_MOTIONS, CameraMotion, DURATIONS, VIDEO_MODELS, VideoConfig, VideoConfigPill(), VideoConfigPopover(), VideoDuration (+1 more)

### Community 30 - "dependencies"
Cohesion: 0.22
Nodes (9): @ai-sdk/react, dependencies, @ai-sdk/react, puppeteer-core, react-dom, rehype-raw, puppeteer-core, react-dom (+1 more)

### Community 31 - "MediaLibrary.tsx"
Cohesion: 0.21
Nodes (12): appendToImageLibrary(), GeneratedImage, IMAGE_LIBRARY_KEY, ImageResultCard(), readImageLibrary(), FilterKey, FILTERS, formatDuration() (+4 more)

### Community 32 - "[locale]/layout.tsx"
Cohesion: 0.07
Nodes (26): cairo, ibmPlexMono, inter, rootFontClasses, MarketingLocaleLayout(), metadata, dynamic, dynamicParams (+18 more)

### Community 33 - "LLM Council Transcript — VANTRA Localization Architecture"
Cohesion: 0.08
Nodes (23): Advisor responses, Anonymization mapping, Blind Spots the Council Caught, Chairman synthesis, Completion, Framed question, LLM Council Transcript — VANTRA Localization Architecture, Original question (+15 more)

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

### Community 79 - "cn"
Cohesion: 0.23
Nodes (11): cn(), GhostButton(), PanelLabel(), PrimaryButton(), ScrollArea, Segmented(), SHELL_TOKENS, StateBlock() (+3 more)

### Community 89 - "generate-image/route.ts"
Cohesion: 0.08
Nodes (33): dynamic, maxDuration, POST(), ALLOWED_PROVIDERS, ALLOWED_RATIOS, dynamic, inFlight, lastRequestAt (+25 more)

### Community 95 - "StudioDashboard.tsx"
Cohesion: 0.07
Nodes (26): GlobalFooter(), LINKS, MessageBubble(), MessageBubbleProps, CenterMode, ChatSession, MAGIC_SKILLS, StudioDashboard() (+18 more)

### Community 118 - "lib/utils.ts"
Cohesion: 0.22
Nodes (7): InfiniteSlider(), InfiniteSliderProps, Textarea, TextareaProps, Logo, LogoCloud(), LogoCloudProps

### Community 132 - "verify-marketing-locales.mjs"
Cohesion: 0.25
Nodes (5): failures, locales, observations, screenshotDirectory, widths

## Knowledge Gaps
- **316 isolated node(s):** `metadata`, `languageAlternates`, `dynamicParams`, `dynamic`, `metadata` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `[locale]/layout.tsx`, `claude-style-chat-input.tsx`, `ui.tsx`, `SettingsModal.tsx`, `src/context/ModalContext.tsx`, `ImageConfigPopover.tsx`, `lib/utils.ts`, `src/components/OriginalLandingPage.tsx`, `MotionStudio.tsx`, `StudioDashboard.tsx`, `MediaLibrary.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `useUser()` connect `src/context/ModalContext.tsx` to `src/components/LiveLedgerCard.tsx`, `SettingsModal.tsx`, `StudioDashboard.tsx`, `src/components/OriginalLandingPage.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `metadata`, `languageAlternates`, `dynamicParams` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/components/LiveLedgerCard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `claude-style-chat-input.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._