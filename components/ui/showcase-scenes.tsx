import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Library,
  Maximize2,
  Mic,
  MessageSquare,
  MoreVertical,
  Play,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Video as VideoIcon,
  Volume2,
} from "lucide-react";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function BrandIcon({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt="" aria-hidden="true" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" />;
}

function Sidebar({ active, credits, creditsLabel }: {
  active: "chat" | "image" | "video";
  credits: string;
  creditsLabel: string;
}) {
  const row = (isActive: boolean, icon: React.ReactNode, label: string) => (
    <div className={`flex items-center gap-2 rounded-md px-2 py-[7px] text-[11px] ${isActive ? "bg-white/[0.07] font-medium text-white" : "text-white/55"}`}>
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] p-2.5">
      <p className="px-1 pb-1 text-[10px] font-semibold tracking-[0.22em] text-white">
        VANTRA <span className="font-normal text-white/45">STUDIO</span>
      </p>
      <div className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-[7px] text-[11px] text-white/80">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New chat
      </div>
      <p className="px-1 pt-2 text-[8.5px] font-semibold tracking-[0.2em] text-white/35">CREATE</p>
      {row(active === "chat", <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />, "Chat")}
      {row(active === "image", <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />, "Image")}
      {row(active === "video", <VideoIcon className="h-3.5 w-3.5" aria-hidden="true" />, "Video")}
      <p className="px-1 pt-2 text-[8.5px] font-semibold tracking-[0.2em] text-white/35">WORKSPACE</p>
      {row(false, <Library className="h-3.5 w-3.5" aria-hidden="true" />, "Library")}
      <p className="px-1 pt-2 text-[8.5px] font-semibold tracking-[0.2em] text-white/35">SYSTEM</p>
      {row(false, <Settings className="h-3.5 w-3.5" aria-hidden="true" />, "Settings")}
      <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.03] p-2">
        <p className="text-[8px] font-semibold tracking-[0.18em] text-white/40">{creditsLabel}</p>
        <p className="mt-1 text-[13px] font-semibold tabular-nums text-white">{credits}</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg px-1 py-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[9px] font-semibold text-white">VU</span>
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-medium text-white">Vantra User</p>
          <p className="text-[9px] text-white/45">Free plan</p>
        </div>
      </div>
    </div>
  );
}

function GenerateButton() {
  return (
    <div className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f5f5f5] text-[13px] font-semibold text-black">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Generate
    </div>
  );
}

function ModelPill({ icon, name, sub }: { icon?: string; name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      {icon ? <BrandIcon src={icon} alt={name} /> : <Sparkles className="h-3.5 w-3.5 text-white/80" aria-hidden="true" />}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[11.5px] font-medium text-white">{name}</p>
        {sub && <p className="truncate text-[9px] text-white/45">{sub}</p>}
      </div>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
    </div>
  );
}

/* ── Chat state ─────────────────────────────────────────── */
function ChatScene() {
  const group = (label: string, rows: { icon: string; name: string }[]) => (
    <div>
      <p className="px-2 pb-1 text-[9px] font-medium text-white/40">{label}</p>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2 rounded-md px-2 py-[7px] text-[11.5px] text-white/85">
          <BrandIcon src={row.icon} alt={row.name} />
          <span className="truncate">{row.name}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="grid h-full min-w-[600px] grid-cols-[150px_minmax(0,1fr)_200px] gap-2 bg-[#08080a] p-2.5">
      <Sidebar active="chat" credits="2,500" creditsLabel="UNIFIED CREDITS" />
      <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-white/10 bg-[#0c0c0e] p-5">
        <h3 className="mt-6 text-[26px] font-semibold tracking-tight text-white">Good evening</h3>
        <p className="mt-1 text-[15px] text-white/70">What will you explore today?</p>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            ["Summarize a document", "Get key insights"],
            ["Brainstorm ideas", "Explore new angles"],
            ["Improve my writing", "Make it clearer"],
          ].map(([title, sub]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
              <p className="truncate text-[10.5px] font-medium text-white/85">{title}</p>
              <p className="mt-0.5 truncate text-[9.5px] text-white/45">{sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-2 ps-3">
          <Plus className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <Mic className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate px-1 text-[12px] text-white/40">Ask anything…</span>
          <span className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10.5px] text-white/80">
            <Sparkles className="h-3 w-3" aria-hidden="true" /> Auto <ChevronDown className="h-3 w-3 text-white/40" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] p-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
          <Sparkles className="h-3.5 w-3.5 text-white/80" aria-hidden="true" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11.5px] font-medium text-white">Auto</p>
            <p className="text-[9px] text-white/45">Recommended</p>
          </div>
          <Check className="h-3.5 w-3.5 text-white/70" aria-hidden="true" />
        </div>
        {group("GPT", [
          { icon: "/brand/models/openai.svg", name: "GPT Astra" },
          { icon: "/brand/models/openai.svg", name: "GPT Sol" },
          { icon: "/brand/models/openai.svg", name: "GPT Terra" },
          { icon: "/brand/models/openai.svg", name: "GPT Luna" },
        ])}
        {group("Claude", [
          { icon: "/brand/models/claude-color.svg", name: "Sonnet 5.1" },
          { icon: "/brand/models/claude-color.svg", name: "Opus 5" },
          { icon: "/brand/models/claude-color.svg", name: "Fable" },
        ])}
        {group("Gemini", [
          { icon: "/brand/models/gemini-color.svg", name: "Gemini 3.8 Flash" },
          { icon: "/brand/models/gemini-color.svg", name: "Gemini 3.1 Pro" },
        ])}
        {group("Grok", [{ icon: "/brand/models/grok.svg", name: "Grok 4.6" }])}
        {group("Kimi", [{ icon: "/brand/models/kimi.svg", name: "Kimi K3" }])}
      </div>
    </div>
  );
}

/* ── Image state ────────────────────────────────────────── */
function ArchVisual() {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#232326] via-[#141416] to-[#0a0a0c]">
      {/* light shaft */}
      <div aria-hidden="true" className="absolute inset-y-0 left-[16%] w-[26%] bg-gradient-to-b from-white/[0.13] via-white/[0.05] to-transparent blur-md" />
      {/* arch */}
      <div aria-hidden="true" className="absolute bottom-[16%] left-1/2 h-[86%] w-[62%] -translate-x-1/2 rounded-t-[999px] bg-gradient-to-b from-[#3a3a3e] via-[#232326] to-[#101012] shadow-[inset_0_18px_40px_rgba(255,255,255,0.08),inset_0_-24px_48px_rgba(0,0,0,0.7)]" />
      <div aria-hidden="true" className="absolute bottom-[16%] left-1/2 h-[86%] w-[62%] -translate-x-1/2 rounded-t-[999px] border border-white/[0.07]" />
      {/* arch inner glow */}
      <div aria-hidden="true" className="absolute bottom-[16%] left-1/2 h-[60%] w-[30%] -translate-x-1/2 rounded-t-[999px] bg-gradient-to-b from-white/[0.09] to-transparent blur-sm" />
      {/* floor */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-b from-white/[0.06] to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[16%] h-px bg-white/15" />
      {/* floor glow */}
      <div aria-hidden="true" className="absolute bottom-[4%] left-1/2 h-[10%] w-[46%] -translate-x-1/2 rounded-[100%] bg-white/[0.07] blur-xl" />
      {/* grain */}
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

function ImageScene() {
  const aspect = (label: string, sub: string, active?: boolean, box?: "square" | "wide" | "tall") => (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${active ? "border-white/40 bg-white/[0.05]" : "border-white/10"}`}>
      <span aria-hidden="true" className={`shrink-0 rounded-[3px] border ${active ? "border-white/80" : "border-white/40"} ${box === "square" ? "h-3.5 w-3.5" : box === "wide" ? "h-2.5 w-4" : box === "tall" ? "h-4 w-2.5" : "h-3 w-3 border-dashed"}`} />
      <span className="leading-tight">
        <span className="block text-[10.5px] font-medium text-white">{label}</span>
        <span className="block text-[9px] text-white/45">{sub}</span>
      </span>
    </div>
  );
  return (
    <div className="grid h-full min-w-[600px] grid-cols-[150px_minmax(0,1fr)_250px] gap-2 bg-[#08080a] p-2.5">
      <Sidebar active="image" credits="2,500" creditsLabel="UNIFIED CREDITS" />
      <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] p-4">
        <div>
          <p className="text-[8.5px] font-semibold tracking-[0.2em] text-white/40">IMAGE</p>
          <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-white">Create an image</h3>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/50">Describe what you want to create, then refine the result with focused controls.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="min-h-[54px] text-[10.5px] leading-relaxed text-white/45">Describe the subject, setting, light, and composition…</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/60"><Mic className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/60"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/60"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <span className="ms-auto text-[9px] tabular-nums text-white/35">0/2000</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10.5px] text-white/60">Model</span>
          <div className="flex-1"><ModelPill icon="/brand/models/openai.svg" name="Auto" sub="Recommended" /></div>
        </div>
        <div>
          <p className="mb-1.5 text-[10.5px] text-white/60">Aspect ratio</p>
          <div className="grid grid-cols-2 gap-1.5">
            {aspect("1:1", "Square", true, "square")}
            {aspect("16:9", "Widescreen", false, "wide")}
            {aspect("9:16", "Portrait", false, "tall")}
            {aspect("More", "", false)}
          </div>
        </div>
        <div className="mt-auto"><GenerateButton /></div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <div className="min-h-0 flex-1"><ArchVisual /></div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <div className="aspect-square rounded-lg border border-white/25 bg-gradient-to-br from-[#3d3d41] via-[#17171a] to-black" aria-hidden="true" />
          <div className="aspect-square rounded-lg border border-white/10 bg-gradient-to-br from-[#2a2c26] via-[#141412] to-black" aria-hidden="true" />
          <div className="aspect-square rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#3f3f43_0%,#17171a_55%,#000_100%)]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ── Video state ────────────────────────────────────────── */
function NightCityVisual({ playSize = "h-14 w-14" }: { playSize?: string }) {
  const dots = [
    { left: "8%", top: "18%", size: 5, color: "bg-white/80", blur: "blur-[1px]" },
    { left: "18%", top: "32%", size: 3, color: "bg-red-400/80", blur: "" },
    { left: "28%", top: "14%", size: 4, color: "bg-white/70", blur: "blur-[1px]" },
    { left: "42%", top: "26%", size: 3, color: "bg-amber-200/70", blur: "" },
    { left: "55%", top: "12%", size: 6, color: "bg-white/60", blur: "blur-[2px]" },
    { left: "68%", top: "30%", size: 3, color: "bg-red-400/70", blur: "" },
    { left: "76%", top: "16%", size: 4, color: "bg-white/80", blur: "blur-[1px]" },
    { left: "88%", top: "28%", size: 5, color: "bg-white/50", blur: "blur-[2px]" },
    { left: "12%", top: "52%", size: 4, color: "bg-red-500/60", blur: "blur-[1px]" },
    { left: "84%", top: "55%", size: 3, color: "bg-amber-100/70", blur: "" },
  ];
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#0d1420] via-[#070a10] to-black">
      {dots.map((dot, i) => (
        <span key={i} aria-hidden="true" className={`absolute rounded-full ${dot.color} ${dot.blur}`} style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size }} />
      ))}
      {/* light streaks */}
      <div aria-hidden="true" className="absolute left-[6%] top-[38%] h-px w-[30%] bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      <div aria-hidden="true" className="absolute right-[8%] top-[46%] h-px w-[24%] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      {/* wet reflective floor */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: GRAIN }} />
      <span className={`absolute left-1/2 top-1/2 flex ${playSize} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/45`}>
        <Play className="ms-0.5 h-5 w-5 fill-white text-white" aria-hidden="true" />
      </span>
    </div>
  );
}

function VideoScene() {
  return (
    <div className="grid h-full min-w-[600px] grid-cols-[150px_minmax(0,220px)_minmax(0,1fr)] gap-2 bg-[#08080a] p-2.5">
      <Sidebar active="video" credits="12,450" creditsLabel="VANTRA CREDITS" />
      <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] p-3.5">
        <div>
          <p className="text-[8.5px] font-semibold tracking-[0.2em] text-white/40">VIDEO</p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-white">Create a video</h3>
          <p className="mt-1 text-[9.5px] leading-relaxed text-white/50">Build a scene from a prompt, then refine its motion, format, and source image.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1 text-center text-[10px] font-medium">
          <span className="rounded-md bg-white px-2 py-1.5 text-black">Text to Video</span>
          <span className="px-2 py-1.5 text-white/55">Image to Video</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[8.5px] font-semibold tracking-[0.18em] text-white/40">SCENE PROMPT</p>
          <p className="mt-1.5 min-h-[64px] text-[10px] leading-relaxed text-white/75">A cinematic shot of a black sports car speeding through a rainy city at night, with neon lights and reflections on the wet road, high detail, dramatic lighting.</p>
          <p className="mt-1 text-end text-[8.5px] tabular-nums text-white/35">124/2000</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 text-[9.5px] font-medium tracking-wide text-white/55">MODEL</span>
          <div className="min-w-0 flex-1"><ModelPill icon="/brand/models/kling-color.svg" name="Kling 3.0 Pro" /></div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          {[
            { icon: "/brand/models/gemini-color.svg", name: "Gemini Omni Flash" },
            { icon: "/brand/models/kling-color.svg", name: "Kling 3.0 Pro", check: true },
            { icon: "/brand/models/bytedance-color.svg", name: "Seedance 2.5" },
          ].map((row) => (
            <div key={row.name} className="flex items-center gap-2 rounded-md px-1.5 py-[5px] text-[10.5px] text-white/85">
              <BrandIcon src={row.icon} alt={row.name} />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {row.check && <Check className="h-3 w-3 text-white/70" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-white/10 px-2 py-1.5"><p className="text-[8px] font-semibold tracking-[0.14em] text-white/40">DURATION</p><p className="mt-0.5 text-[10.5px] text-white/85">5 seconds</p></div>
          <div className="rounded-md border border-white/10 px-2 py-1.5"><p className="text-[8px] font-semibold tracking-[0.14em] text-white/40">ASPECT RATIO</p><p className="mt-0.5 text-[10.5px] text-white/85">16:9</p></div>
        </div>
        <div className="rounded-md border border-white/10 px-2 py-1.5"><p className="text-[8px] font-semibold tracking-[0.14em] text-white/40">RESOLUTION</p><p className="mt-1 flex gap-1 text-[9.5px]"><span className="flex-1 rounded bg-white/[0.06] px-1 py-1 text-center text-white/55">480p</span><span className="flex-1 rounded bg-white/[0.06] px-1 py-1 text-center text-white/55">720p</span><span className="flex-1 rounded bg-white px-1 py-1 text-center font-semibold text-black">1080p</span></p></div>
        <div className="mt-auto"><GenerateButton /></div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
          <NightCityVisual />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/90 to-transparent px-2.5 pb-2 pt-6 text-white">
            <Play className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" />
            <span className="shrink-0 text-[8.5px] tabular-nums text-white/80">00:00 / 00:05</span>
            <span className="relative mx-1 h-[3px] min-w-0 flex-1 rounded-full bg-white/30"><span className="absolute left-0 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-white" /></span>
            <Volume2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <Maximize2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <MoreVertical className="h-3 w-3 shrink-0" aria-hidden="true" />
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {["00:05", "00:08", "00:06"].map((dur, i) => (
            <div key={dur} className={`relative aspect-video overflow-hidden rounded-lg border ${i === 0 ? "border-white/40" : "border-white/10"}`}>
              <div className={`absolute inset-0 ${i === 0 ? "bg-gradient-to-br from-[#101722] via-[#05070c] to-black" : i === 1 ? "bg-gradient-to-br from-[#15161a] via-[#0a0a0c] to-black" : "bg-gradient-to-br from-[#1a2027] via-[#0b0e13] to-black"}`} aria-hidden="true" />
              <div aria-hidden="true" className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: GRAIN }} />
              <span className="absolute bottom-1 end-1 rounded bg-black/70 px-1 text-[8.5px] tabular-nums text-white">{dur}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShowcaseScene({ index, alt }: { index: 0 | 1 | 2; alt: string }) {
  return (
    <div role="img" aria-label={alt} className="h-full w-full">
      <div aria-hidden="true" className="flex h-full w-full justify-center overflow-hidden">
        {index === 0 ? <ChatScene /> : index === 1 ? <ImageScene /> : <VideoScene />}
      </div>
    </div>
  );
}
