'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, ArrowDown, Plus, Zap, Swords, Database, Settings, Sparkles, LayoutGrid, MessageSquare, Image as ImageIcon, Video, PenLine, Code2, Lightbulb, BarChart3, RefreshCw, FileText } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import DashboardSidebar, { type Workspace as DashboardView } from './DashboardSidebar';
import MessageBubble from './MessageBubble';
import ImageCanvas from './ImageCanvas';
import SettingsModal from './SettingsModal';
import MotionStudio from './MotionStudio';
import MediaLibrary from './MediaLibrary';
import { VantraLogo } from '../VantraLogo';
import { cn } from '@/lib/utils';
import { ScrollArea, GhostButton } from './AppShell';

/* Real data pulled from the OpenRouter catalog */
const MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', provider: 'NVIDIA', ctx: '1M', latency: 1200, badge: 'FREE', isFree: true },
  { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2', provider: 'Z.ai', ctx: '256K', latency: 700, badge: 'FREE', isFree: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', provider: 'Poolside', ctx: '128K', latency: 600, badge: 'FREE', isFree: true },
  { id: 'minimax/minimax-m3:free', name: 'MiniMax M3', provider: 'MiniMax', ctx: '1M', latency: 500, badge: 'FREE', isFree: true },
];

type CenterMode = 'chat' | 'image' | 'video' | 'library';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

const MAGIC_SKILLS = [
  {
    icon: Code2,
    title: 'Write Code',
    desc: 'Generate type-safe components, refactor logic, or debug complex issues.',
    prompt: 'Write a type-safe TypeScript React hook for debounced async search with abort signal cancellation.',
  },
  {
    icon: ImageIcon,
    title: 'Analyze Image',
    desc: 'Extract OCR text, critique UI designs, or diagnose layout bugs.',
    prompt: 'Analyze this UI screenshot and provide actionable CSS layout and accessibility improvements.',
  },
  {
    icon: Video,
    title: 'Generate Video',
    desc: 'Create scene prompts, cinematographic camera directions, and storyboards.',
    prompt: 'Create a 4-shot cinematic video storyboard prompt with camera movement and lighting specs.',
  },
  {
    icon: FileText,
    title: 'Summarize Doc',
    desc: 'Synthesize PDFs, technical RFCs, or documentation into concise briefs.',
    prompt: 'Synthesize the key architectural decisions, tradeoffs, and next steps from this document.',
  },
];

export default function StudioDashboard() {
  const { user, refreshBalance } = useUser();
  const { openAuthModal } = useModal();

  const [view, setView] = useState<'models' | 'chat' | 'arena' | 'datahub' | 'settings'>('chat');
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
          // Drop legacy empty placeholders â€” only sessions with real content survive
          const cleaned = parsed.filter((p: ChatSession) => {
            if (!p?.id) return false;
            if (!p.title || p.title.startsWith('New Chat')) {
              try {
                return !!localStorage.getItem(`vantra_chat_${p.id}`);
              } catch {
                return false;
              }
            }
            return true;
          });
          setSessions(cleaned);
          setActiveSessionId(cleaned.length > 0 ? cleaned[0].id : `draft-${Date.now()}`);
          return;
        }
      }
    } catch {}
    // First visit: a draft session keeps the composer live without polluting history
    setActiveSessionId(`draft-${Date.now()}`);
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

  const handleNewChat = useCallback(() => {
    // Abort any active text stream
    stop();
    // Lazy creation: no DB/list record yet â€” just a draft id so the composer stays live.
    setActiveSessionId(`draft-${Date.now()}`);
    setMessages([]);
  }, [stop, setMessages]);

  const handleSelectSession = useCallback((sessionId: string) => {
    stop();
    setView('chat');
    setCenterMode('chat');
    setActiveSessionId(sessionId);
  }, [stop]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    try {
      localStorage.removeItem(`vantra_chat_${sessionId}`);
    } catch {}
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        // Move to the newest remaining session, or start a clean draft
        setActiveSessionId(next.length > 0 ? next[0].id : `draft-${Date.now()}`);
      }
      return next;
    });
  }, [activeSessionId]);

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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  /* ---- Scroll management (ChatGPT/Claude behavior) ---- */

  // Track whether the user scrolled up to toggle Scroll to Bottom button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      userScrolledUpRef.current = distance > 240;
      setShowScrollButton(distance > 100);
      setIsNearBottom(distance <= 100);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    userScrolledUpRef.current = false;
    setShowScrollButton(false);
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

      // Lazy session creation: the record is materialised only on the first prompt
      const derivedTitle = (() => {
        const t = content.replace(/\[Attachment:[^\]]*\]/g, '').trim();
        return t.length > 42 ? `${t.slice(0, 42).trimEnd()}…` : t || 'New Chat';
      })();

      if (activeSessionId) {
        const exists = sessions.some((s) => s.id === activeSessionId);
        if (!exists) {
          setSessions((prev) =>
            [{ id: activeSessionId, title: derivedTitle, createdAt: Date.now() }, ...prev].slice(0, 30)
          );
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId && s.title.startsWith('New Chat')
                ? { ...s, title: derivedTitle }
                : s
            )
          );
        }
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
    [append, selectedModelId, activeSessionId, sessions, activeModel.isFree, user, openAuthModal]
  );

  const totalTokens = useMemo(
    () => Math.ceil(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4),
    [messages]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden obsidian-bg text-white font-sans">
      {/* Sidebar */}
      <DashboardSidebar
        activeWorkspace={centerMode}
        onWorkspaceChange={(w) => {
          setView('chat');
          setCenterMode(w);
        }}
        onNewChat={handleNewChat}
        sessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setSettingsOpen(true)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Compact Mobile Top Bar: inline hamburger + VANTRA title/logo */}
        <header className="lg:hidden shrink-0 h-14 bg-[#0D0D0D]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={isMobileNavOpen}
              className="p-2 -ms-2 rounded-lg bg-transparent border-none text-white/80 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer active:scale-95 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center bg-white/[0.04]">
                <VantraLogo className="w-3.5 h-3.5" />
              </div>
              <span className="text-[13px] font-semibold tracking-[0.14em] text-white">VANTRA</span>
              <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">Studio</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[11.5px] font-medium text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>
        </header>

        {/* Center content */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ── Chat Studio ── */}
            {centerMode === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Scrollable Message Timeline Area */}
                <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                  <ScrollArea
                    ref={scrollContainerRef}
                    className="flex-1 min-h-0"
                    style={{ overflowAnchor: 'none' }}
                  >
                    <div className={cn('w-full flex justify-center', isEmpty ? 'min-h-full items-center py-6' : 'pt-4 sm:pt-6 pb-36 sm:pb-40')}>
                      <div className="mx-auto w-full max-w-4xl px-6 flex flex-col gap-y-8">
                        {isEmpty ? (
                          <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center py-6">
                            <h2 className="text-xl font-medium text-white/90 mb-6">
                              What are we building today?
                            </h2>

                            <div className="w-full mb-6">
                              <ClaudeChatInput
                                onSendMessage={handleSend}
                                models={MODELS.map((m) => ({ id: m.id, name: m.name, description: `${m.provider} · ${m.ctx}`, badge: m.badge, isFree: m.isFree, requiresAuth: !m.isFree }))}
                                selectedModelId={selectedModelId}
                                onSelectModel={setSelectedModelId}
                                isLoading={isLoading}
                                onStop={stop}
                                placeholder="Ask anything or pick a skill below…"
                                autoFocus
                                onSignInClick={user ? undefined : () => openAuthModal('signin')}
                              />
                            </div>

                            {/* Magic Skills Grid (4 Minimalist Action Cards) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-start">
                              {MAGIC_SKILLS.map((skill) => {
                                const Icon = skill.icon;
                                return (
                                  <button
                                    key={skill.title}
                                    type="button"
                                    onClick={() => handleSend({ message: skill.prompt, isThinkingEnabled: false })}
                                    className="flex flex-col gap-2 p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer text-sm text-white/70 hover:text-white text-start"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="h-7 w-7 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center text-white/90 shrink-0">
                                        <Icon className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="font-medium text-white/90">{skill.title}</span>
                                    </div>
                                    <p className="text-[12.5px] text-white/40 leading-relaxed font-normal">
                                      {skill.desc}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {messages.map((msg, idx) => (
                          <MessageBubble
                            key={msg.id || idx}
                            message={msg}
                            isLatest={idx === messages.length - 1}
                            isStreaming={isLoading}
                            onRegenerate={isLoading ? undefined : () => reload()}
                          />
                        ))}

                        {/* Loading / Thinking */}
                        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                          <div className="flex items-center gap-2.5 py-1 text-[13.5px] text-white/60 animate-pulse" role="status" aria-live="polite">
                            <div className="ai-avatar-ring h-6 w-6 rounded-md p-[1px] shrink-0">
                              <div className="w-full h-full rounded-[calc(0.375rem-1px)] bg-[#1A1C1F] flex items-center justify-center">
                                <Sparkles className="h-3 w-3 text-white/70" />
                              </div>
                            </div>
                            <span className="font-sans antialiased text-white/70 font-normal">Thinking…</span>
                          </div>
                        )}

                        {/* Error + retry */}
                        {error && !error.message?.includes('Failed to parse stream string') && (
                          <div className="flex justify-start" role="alert">
                            <div className="max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5">
                              <p className="text-[13px] text-white/80 leading-relaxed">
                                {(() => {
                                  try {
                                    return error?.message?.includes('{')
                                      ? JSON.parse(error.message).error || error.message
                                      : error?.message || 'The engine is busy. Try again in a moment.';
                                } catch {
                                  return error?.message || 'The engine is busy. Try again in a moment.';
                                }
                              })()}
                            </p>
                            <GhostButton onClick={() => reload()} className="mt-3">
                              <RefreshCw className="h-3.5 w-3.5" />
                              Retry
                            </GhostButton>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
                    </div>
                  </div>
                </ScrollArea>

                {/* Floating "Scroll to Bottom" Action Button */}
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.9 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="absolute bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
                    >
                      <button
                        type="button"
                        onClick={() => scrollToBottom(true)}
                        aria-label="Scroll to bottom"
                        className="flex items-center justify-center p-2 rounded-full backdrop-blur-md bg-white/10 border border-white/20 text-white hover:bg-white/20 shadow-lg shadow-black/40 cursor-pointer active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Composer — strictly bottom anchored with gradient mask */}
              {!isEmpty && (
                <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-30 pointer-events-none flex justify-center bg-gradient-to-t from-background via-background/90 to-transparent pt-4 pb-6">
                  <div className="mx-auto w-full max-w-4xl px-6 pointer-events-auto">
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

          {/* ── Image Canvas ── */}
          {centerMode === 'image' && (
            <motion.div key="image" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0">
              <ImageCanvas />
            </motion.div>
          )}

            {/* ── Motion Studio ── */}
            {centerMode === 'video' && (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0">
                <MotionStudio />
              </motion.div>
            )}

            {/* ── Library ── */}
            {centerMode === 'library' && (
              <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="absolute inset-0">
                <MediaLibrary />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
