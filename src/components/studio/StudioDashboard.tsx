'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Zap, Swords, Database, Settings, Sparkles, LayoutGrid, MessageSquare, Image as ImageIcon, Video, PenLine, Code2, Lightbulb, BarChart3 } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import DashboardSidebar, { type DashboardView } from './DashboardSidebar';
import MessageBubble from './MessageBubble';
import ImageCanvas from './ImageCanvas';
import SettingsModal from './SettingsModal';
import StudioVideo from './StudioVideo';
import { cn } from '@/lib/utils';

/* Real data pulled from the OpenRouter catalog */
const MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', provider: 'NVIDIA', ctx: '1M', latency: 1200, badge: 'FREE', isFree: true },
  { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2', provider: 'Z.ai', ctx: '256K', latency: 700, badge: 'FREE', isFree: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', provider: 'Poolside', ctx: '128K', latency: 600, badge: 'FREE', isFree: true },
  { id: 'minimax/minimax-m3:free', name: 'MiniMax M3', provider: 'MiniMax', ctx: '1M', latency: 500, badge: 'FREE', isFree: true },
];

type CenterMode = 'chat' | 'image' | 'video';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

const SOON_VIEWS: Record<string, { icon: React.ElementType; title: string; desc: string }> = {
  arena: {
    icon: Swords,
    title: 'Model Arena',
    desc: 'Pit two frontier models head-to-head on the same prompt and crown a winner. Coming soon to Vantra Studio.',
  },
  datahub: {
    icon: Database,
    title: 'Data Hub',
    desc: 'Connect documents, sites and knowledge bases to ground your chats. Coming soon.',
  },
  settings: {
    icon: Settings,
    title: 'Settings',
    desc: 'Workspace preferences, billing and API keys live here soon.',
  },
};

const SUGGESTIONS = [
  {
    icon: PenLine,
    label: 'Write',
    prompt:
      'Write a punchy launch announcement in Algerian Darja for a new Algerian coffee brand, with 3 call-to-action options.',
  },
  {
    icon: Code2,
    label: 'Code',
    prompt:
      'Build a production-ready Next.js App Router API route that verifies Chargily Pay Edahabia webhooks, with zod validation.',
  },
  {
    icon: Lightbulb,
    label: 'Ideate',
    prompt:
      'Give me 10 SaaS startup ideas tailored for the Algerian market in 2026, each with a one-line monetization model.',
  },
  {
    icon: BarChart3,
    label: 'Compare',
    prompt:
      'Compare Claude Opus 5 vs GPT-5.6 Sol for long-context research and coding. End with a clear recommendation table.',
  },
];

export default function StudioDashboard() {
  const { user, refreshBalance } = useUser();
  const { openAuthModal } = useModal();

  const [view, setView] = useState<DashboardView>('chat');
  const [centerMode, setCenterMode] = useState<CenterMode>('chat');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const sendStartRef = useRef<number>(0);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const activeModel = MODELS.find((m) => m.id === selectedModelId) || MODELS[0];

  useEffect(() => {
    try {
      const s = localStorage.getItem('vantra_sessions_v2');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
    } catch {}
    // First visit: bootstrap a session so the composer is always live
    const id = `session-${Date.now()}`;
    setSessions([{ id, title: 'New Chat Session', createdAt: Date.now() }]);
    setActiveSessionId(id);
  }, []);

  useEffect(() => {
    // Debounced + capped: keep max 30 sessions, never block main thread per keystroke
    const t = setTimeout(() => {
      try {
        localStorage.setItem('vantra_sessions_v2', JSON.stringify(sessions.slice(0, 30)));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [sessions]);

  const {
    messages,
    setMessages,
    append,
    reload,
    isLoading,
    error,
    stop,
  } = useChat({
    id: activeSessionId || 'default-session',
    api: '/api/generate/chat',
    onFinish: () => {
      if (sendStartRef.current) setLastLatencyMs(performance.now() - sendStartRef.current);
      refreshBalance();
    },
    onError: () => {},
  });

  // Persistence per session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`vantra_chat_${activeSessionId}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
  }, [activeSessionId, setMessages]);

  useEffect(() => {
    if (!activeSessionId) return;
    // Debounced + capped: persist only the last 50 messages per session
    const t = setTimeout(() => {
      try {
        if (messages.length > 0) {
          localStorage.setItem(`vantra_chat_${activeSessionId}`, JSON.stringify(messages.slice(-50)));
        } else {
          localStorage.removeItem(`vantra_chat_${activeSessionId}`);
        }
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [messages, activeSessionId]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  /* ---- Scroll management (ChatGPT/Claude behavior) ---- */

  // Track whether the user intentionally scrolled up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      userScrolledUpRef.current = distance > 420;
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    userScrolledUpRef.current = false;
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Bulletproof stick: rAF loop pins to bottom every frame while AI responds
  // (immune to missed events, smooth-scroll races, or fast-growing code blocks)
  useEffect(() => {
    if (!isLoading) return;
    let raf = 0;
    const stick = () => {
      if (!userScrolledUpRef.current) {
        const container = scrollContainerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      }
      raf = requestAnimationFrame(stick);
    };
    raf = requestAnimationFrame(stick);
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  // Force bottom the moment a new exchange starts (send / regenerate)
  useEffect(() => {
    if (isLoading) {
      scrollToBottom(false);
      const t = setTimeout(() => scrollToBottom(false), 80);
      return () => clearTimeout(t);
    }
  }, [isLoading, scrollToBottom]);

  // Stick to bottom on every message update unless the user scrolled up
  useEffect(() => {
    if (userScrolledUpRef.current || isLoading) return; // rAF loop handles streaming
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance < 420) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, scrollToBottom]);

  // Jump to bottom when switching sessions
  useEffect(() => {
    const t = setTimeout(() => scrollToBottom(false), 120);
    return () => clearTimeout(t);
  }, [activeSessionId, scrollToBottom]);

  const handleSend = useCallback(
    async (data: { message: string; isThinkingEnabled: boolean }) => {
      if (!user && !activeModel.isFree) {
        openAuthModal('signin');
        return;
      }
      let content = data.message;
      if (data.isThinkingEnabled) {
        content = `Think through this step-by-step with careful reasoning before answering.\n\n${content}`;
      }
      // Auto-title session from the first message
      if (activeSessionId) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            if (!s.title.startsWith('New Chat')) return s;
            const t = content.replace(/\[Attachment:[^\]]*\]/g, '').trim();
            return { ...s, title: t.length > 42 ? `${t.slice(0, 42).trimEnd()}…` : t || s.title };
          })
        );
      }
      sendStartRef.current = performance.now();
      await append(
        { role: 'user', content },
        {
          body: {
            model: selectedModelId,
          },
        }
      );
    },
    [append, selectedModelId, activeSessionId, activeModel.isFree, user, openAuthModal]
  );

  const handleNewChat = useCallback(() => {
    const id = `session-${Date.now()}`;
    setSessions((prev) => [{ id, title: 'New Chat Session', createdAt: Date.now() }, ...prev]);
    setActiveSessionId(id);
    setView('chat');
    setCenterMode('chat');
  }, []);

  const totalTokens = useMemo(
    () => Math.ceil(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4),
    [messages]
  );

  const isEmpty = messages.length === 0;
  const soon = SOON_VIEWS[view];

  return (
    <div className="obsidian-bg relative flex h-screen w-full overflow-hidden text-white font-sans">
      {/* Wing glows */}
      <div className="wing-glow-left" />
      <div className="wing-glow-right" />
      <div className="lux-noise absolute inset-0 pointer-events-none" />

      {/* Floating glass hamburger — immersive, no header wrapper */}
      <button
        type="button"
        onClick={() => setIsMobileNavOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[#2A2D33]/80 backdrop-blur-md border border-white/10 text-white/90 shadow-lg cursor-pointer active:scale-95 transition-transform"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── 1. Left navigation ── */}
      <DashboardSidebar
        activeView={view}
        onViewChange={setView}
        activeWorkspace={centerMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onWorkspaceChange={(w) => {
          setView('chat');
          setCenterMode(w);
        }}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* ── 2. Center studio ── */}
      <main className="flex-1 flex flex-col relative h-full min-w-0 z-[2]">
        {/* Top area intentionally empty — immersive minimalism */}

        {/* Center content */}
        <div className="flex-1 relative min-h-0">
          <AnimatePresence mode="wait">
            {/* ── Chat view ── */}
            {view === 'chat' && centerMode === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col"
              >
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar relative" style={{ overflowAnchor: 'none' }}>
                  <div className={`w-full flex justify-center px-4 ${isEmpty ? "min-h-full items-center py-8" : "pt-8 pb-4"}`}>
                    <div className="w-full max-w-[820px] flex flex-col gap-7">
                      {isEmpty && (
                        <div className="flex flex-col items-center text-center stagger-2">
                          <div className="ai-avatar-ring h-16 w-16 rounded-2xl p-[2px]">
                            <div className="w-full h-full rounded-[14px] bg-[#1A1C1F] flex items-center justify-center">
                              <Sparkles className="h-7 w-7 text-[#FFFFFF]" />
                            </div>
                          </div>
                          <h1 className="font-serif-lux text-[clamp(28px,4vw,40px)] text-white/95 mt-6 tracking-tight">
                            The Studio is ready
                          </h1>
                          <p className="lux-welcome-sub mt-3">
                            Pick a model from the composer below and create.
                          </p>

                          {/* Composer — always visible so users can start chatting */}
                          <div className="w-full mt-10 composer-in">
                            <ClaudeChatInput
                              onSendMessage={handleSend}
                              models={MODELS.map((m) => ({ id: m.id, name: m.name, description: `${m.provider} · ${m.ctx}`, badge: m.badge, isFree: m.isFree, requiresAuth: !m.isFree }))}
                              selectedModelId={selectedModelId}
                              onSelectModel={setSelectedModelId}
                              isLoading={isLoading}
                              onStop={stop}
                              placeholder="How can I help you today?"
                              autoFocus
                              onSignInClick={user ? undefined : () => openAuthModal('signin')}
                            />
                          {/* Suggestion pills */}
                          <div className="flex flex-wrap justify-center gap-2.5 mt-7 stagger-4">
                            {SUGGESTIONS.map((s) => (
                              <button
                                key={s.label}
                                type="button"
                                onClick={() => handleSend({ message: s.prompt, isThinkingEnabled: false })}
                                className="glass-pill inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] text-white/55 cursor-pointer"
                              >
                                <s.icon className="h-3.5 w-3.5 text-[#FFFFFF]/80" />
                                {s.label}
                              </button>
                            ))}
                          </div>
                          </div>
                        </div>
                      )}

                      {messages.map((msg, idx) => (
                        <MessageBubble
                          key={msg.id || idx}
                          message={msg}
                          isLatest={idx === messages.length - 1}
                          isStreaming={isLoading}
                          onRegenerate={isLoading ? undefined : () => reload()}
                        />
                      ))}

                      {/* Typing: three pulsing neon dots */}
                      {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                          <div className="inline-flex items-center gap-3 px-5 py-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
                            <span className="flex items-center gap-1.5">
                              <span className="neon-dot" />
                              <span className="neon-dot" />
                              <span className="neon-dot" />
                            </span>
                            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">
                              {activeModel.name}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {error && !error.message?.includes('Failed to parse stream string') && (
                        <div className="flex justify-start">
                          <div className="bg-red-500/[0.07] border border-red-500/20 text-red-300 px-5 py-4 rounded-2xl text-[13.5px] leading-relaxed max-w-lg backdrop-blur-sm">
                            {(() => {
                              try {
                                return error?.message?.includes('{')
                                  ? JSON.parse(error.message).error || error.message
                                  : error?.message || 'The engine is busy. Try again in a moment.';
                              } catch {
                                return error?.message || 'The engine is busy. Try again in a moment.';
                              }
                            })()}
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Composer — IN-FLOW below the scroll area (root fix: content can never slide under it) */}
                {!isEmpty && (
                  <div
                    className="shrink-0 w-full px-6 pb-4 pt-1 relative z-30 flex justify-center"
                    style={{ background: 'linear-gradient(to top, #16181A 55%, rgba(22,24,26,0.9) 82%, transparent)' }}
                  >
                    <div className="w-full max-w-[760px]">
                      <ClaudeChatInput
                        onSendMessage={handleSend}
                        models={MODELS.map((m) => ({ id: m.id, name: m.name, description: `${m.provider} · ${m.ctx}`, badge: m.badge, isFree: m.isFree, requiresAuth: !m.isFree }))}
                        selectedModelId={selectedModelId}
                        onSelectModel={setSelectedModelId}
                        isLoading={isLoading}
                        onStop={stop}
                        placeholder="How can I help you today?"
                        onSignInClick={user ? undefined : () => openAuthModal('signin')}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Image / Video studios ── */}
            {view === 'chat' && centerMode === 'image' && (
              <motion.div key="image" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                <ImageCanvas />
              </motion.div>
            )}
            {view === 'chat' && centerMode === 'video' && (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto custom-scrollbar">
                <StudioVideo />
              </motion.div>
            )}

            {/* ── All Models ── */}
            {view === 'models' && (
              <motion.div
                key="models"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 overflow-y-auto custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto px-6 py-10">
                  <div className="flex items-center gap-3 mb-2">
                    <LayoutGrid className="h-5 w-5 text-[#FFFFFF]" />
                    <h1 className="text-2xl font-semibold tracking-tight">All Models</h1>
                  </div>
                  <p className="text-[13px] text-white/40 mb-8">
                    {MODELS.length} engines unified in one gateway. Free models cost 0 points.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24">
                    {MODELS.map((m, i) => (
                      <motion.button
                        key={m.id}
                        type="button"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => {
                          if (!m.isFree && !user) {
                            openAuthModal('signin');
                            return;
                          }
                          setSelectedModelId(m.id);
                          setView('chat');
                          setCenterMode('chat');
                        }}
                        className={cn(
                          'text-start glass-panel rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 cursor-pointer active:scale-[0.99] relative overflow-hidden group',
                          selectedModelId === m.id ? 'nav-pill-active' : 'border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]'
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className={cn('text-[9px] font-mono font-bold tracking-[0.18em] px-2 py-1 rounded-full border', m.isFree ? 'border-[#FFFFFF]/30 text-[#FFFFFF]/90' : 'border-[#FFFFFF]/35 text-[#FFFFFF]')}>
                            {m.badge}
                          </span>
                          <span className="text-[10px] font-mono text-white/30">{m.provider}</span>
                        </div>
                        <p className="text-[15px] font-semibold text-white/95 mb-1">{m.name}</p>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-white/40">
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-[#9CA3AF]" />~{m.latency}ms</span>
                          <span className="flex items-center gap-1 text-[#D1D5DB]/80">{m.ctx} ctx</span>
                          {!m.isFree && <span className="text-[#FFFFFF]/70">{m.id.includes('opus') ? '60' : '50'} pts</span>}
                        </div>
                        <span className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-[#D1D5DB]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Soon views ── */}
            {soon && (
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center px-6"
              >
                <div className="border border-white/10 rounded-3xl p-10 max-w-md text-center relative overflow-hidden">
                  <span className="absolute top-0 left-8 right-8 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)' }} />
                  {React.createElement(soon.icon, { className: 'h-10 w-10 text-[#D1D5DB] mx-auto mb-5' })}
                  <h2 className="font-serif-lux text-3xl text-white/95 mb-3">{soon.title}</h2>
                  <p className="text-[13px] text-white/45 leading-relaxed mb-6">{soon.desc}</p>
                  <button
                    type="button"
                    onClick={() => setView('chat')}
                    className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-gradient-to-r from-[#9CA3AF]/20 to-[#6B7280]/20 border border-white/[0.1] text-[12.5px] font-semibold text-white/85 hover:text-white hover:border-[#FFFFFF]/40 transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <MessageSquare className="h-4 w-4" /> Back to Studio Chat
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
