'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PenLine, GraduationCap, Code2, BarChart3, LogIn, Sparkles } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import MessageBubble from './MessageBubble';
import { VantraLogo } from '../VantraLogo';

export const AVAILABLE_MODELS = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', description: '550B flagship — strongest free model', badge: 'FREE', isFree: true },
  { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2', description: 'Balanced everyday intelligence', badge: 'FREE', isFree: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', description: 'Code-specialized free model', badge: 'FREE', isFree: true },
  { id: 'minimax/minimax-m3:free', name: 'MiniMax M3', description: 'Fast versatile free model', badge: 'FREE', isFree: true },
];

const SUGGESTED_PROMPTS = [
  {
    icon: React.createElement(PenLine, { className: 'w-4 h-4' }),
    label: 'Write',
    prompt:
      'Write a high-converting marketing launch campaign in Algerian Darja for an apparel brand, with BaridiMob payment instructions.',
  },
  {
    icon: React.createElement(GraduationCap, { className: 'w-4 h-4' }),
    label: 'Learn',
    prompt:
      'Design a high-throughput cache algorithm in Python with asymptotic time and space complexity analysis.',
  },
  {
    icon: React.createElement(Code2, { className: 'w-4 h-4' }),
    label: 'Code',
    prompt:
      'Provide a complete TypeScript server route in Next.js App Router for verifying Chargily Pay Edahabia / CIB webhooks.',
  },
  {
    icon: React.createElement(BarChart3, { className: 'w-4 h-4' }),
    label: 'Compare models',
    prompt:
      'Compare Claude 3.5 Sonnet vs DeepSeek R1 for coding complex full-stack web applications.',
  },
];

interface StudioChatProps {
  activeSessionId: string | null;
  onSessionActivity?: (sessionId: string | null, firstMessage: string) => void;
}

export default function StudioChat({
  activeSessionId,
  onSessionActivity,
}: StudioChatProps) {
  const { user, refreshBalance } = useUser();
  const { openAuthModal } = useModal();
  const [selectedModelId, setSelectedModelId] = useState(AVAILABLE_MODELS[0].id);
  const [lang, setLang] = useState('en');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setLang(document.documentElement.lang || 'en');
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'lang') {
            setLang(document.documentElement.lang || 'en');
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  // Time-based greeting (client-only to avoid hydration mismatch)
  useEffect(() => {
    const hour = new Date().getHours();
    if (lang === 'ar') {
      setGreeting(hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء النور' : 'مساء الخير');
    } else if (lang === 'fr') {
      setGreeting(hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir');
    } else {
      setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    }
  }, [lang]);

  const isRtl = lang === 'ar';
  const placeholderText = lang === 'ar' ? 'كيف أساعدك اليوم؟' :
                          lang === 'fr' ? 'Comment puis-je vous aider ?' :
                          'How can I help you today?';

  const userName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    (lang === 'ar' ? 'صديقي' : lang === 'fr' ? 'cher ami' : 'friend');

  const { messages, setMessages, append, isLoading, error, stop } = useChat({
    id: activeSessionId || 'default-session',
    api: '/api/generate/chat',
    body: {
      model: selectedModelId || AVAILABLE_MODELS[0].id
    },
    onFinish: () => {
      refreshBalance();
    },
    onError: (err) => {
      console.error("AI Generation Error:", err);
    }
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistence: Load on mount or session change
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`vantra_chat_${activeSessionId}`);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([]);
      }
    } catch (e) {}
  }, [setMessages, activeSessionId]);

  // Persistence: Save on change
  useEffect(() => {
    if (activeSessionId) {
      if (messages.length > 0) {
        localStorage.setItem(`vantra_chat_${activeSessionId}`, JSON.stringify(messages));
      } else {
        localStorage.removeItem(`vantra_chat_${activeSessionId}`);
      }
    }
  }, [messages, activeSessionId]);

  // Smart auto-scroll
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 240) {
      el.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth', block: 'end' });
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(async (data: {
    message: string;
    isThinkingEnabled: boolean;
    model: string;
  }) => {
    const content = data.isThinkingEnabled
      ? `Think through this step-by-step with careful reasoning before answering.\n\n${data.message}`
      : data.message;
    onSessionActivity?.(activeSessionId, data.message);
    await append(
      { role: 'user', content },
      { body: { model: data.model || selectedModelId } }
    );
  }, [append, selectedModelId, activeSessionId, onSessionActivity]);

  const isEmpty = messages.length === 0;

  return (
    <div className="studio-chat lux-chat-bg lux-noise flex-1 flex flex-col relative min-w-0 h-full text-white font-sans overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Ambient breathing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="lux-orb lux-orb-teal" />
        <div className="lux-orb lux-orb-violet" />
        <div className="lux-orb lux-orb-gold" />
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full custom-scrollbar relative z-[2]">
        <div className="w-full flex justify-center px-4 pb-80 pt-6">
          <div className="w-full max-w-[700px] flex flex-col gap-7">

            {/* ─── Claude-style Welcome ─── */}
            {isEmpty && !isLoading && (
              <div className="flex flex-col items-center text-center pt-[6vh]">
                {/* Brandmark with soft glow */}
                <div className="relative w-16 h-16 mb-6 flex items-center justify-center stagger-1">
                  <div className="absolute inset-0 bg-[#FFFFFF]/15 blur-2xl rounded-full scale-125" />
                  <VantraLogo className="relative w-12 h-12 drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]" />
                </div>

                {/* Serif greeting with hand-drawn underline */}
                <h1 className="stagger-2 font-serif-lux text-[clamp(30px,4.5vw,42px)] font-normal text-white/95 tracking-tight mb-10" dir="ltr">
                  {greeting}
                  {lang !== 'ar' && ', '}
                  <span className="relative inline-block">
                    {userName}
                    <svg
                      className="lux-squiggle absolute w-[130%] h-[16px] -bottom-1.5 -left-[6%] text-[#FFFFFF]"
                      viewBox="0 0 140 24"
                      fill="none"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 16 Q 70 24, 134 14"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </span>
                </h1>

                {/* Composer */}
                <div className="w-full composer-in">
                  <ClaudeChatInput
                    onSendMessage={handleSend}
                    models={AVAILABLE_MODELS}
                    selectedModelId={selectedModelId}
                    onSelectModel={setSelectedModelId}
                    placeholder={placeholderText}
                    autoFocus
                    onSignInClick={user ? undefined : () => openAuthModal('signin')}
                  />
                </div>

                {/* Glass action pills */}
                <div className="flex flex-wrap justify-center gap-2.5 mt-6 max-w-[700px] px-2 stagger-3">
                  {SUGGESTED_PROMPTS.map((sp) => (
                    <button
                      key={sp.label}
                      type="button"
                      onClick={() => handleSend({ message: sp.prompt, isThinkingEnabled: false, model: selectedModelId })}
                      className="glass-pill inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] text-white/55 cursor-pointer"
                    >
                      <span className="text-[#FFFFFF]/80">{sp.icon}</span>
                      {sp.label}
                    </button>
                  ))}
                </div>

                {/* Optional sign-in hint */}
                {!user && (
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="stagger-4 mt-7 inline-flex items-center gap-2 px-4 h-9 rounded-full border border-[#FFFFFF]/25 bg-[#FFFFFF]/[0.06] text-[#FFFFFF]/90 text-xs font-semibold transition-all hover:bg-[#FFFFFF]/[0.12] hover:-translate-y-0.5 cursor-pointer"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign in to unlock premium models
                  </button>
                )}
              </div>
            )}

            {/* ─── Messages ─── */}
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <MessageBubble
                  message={msg}
                  isLatest={idx === messages.length - 1}
                  isStreaming={isLoading}
                />
              </div>
            ))}

            {/* Thinking indicator — Claude-style shimmer */}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className={`flex w-full ${isRtl ? 'justify-end' : 'justify-start'}`}>
                <div className="inline-flex items-center gap-3 px-1 py-2 animate-fade-in">
                  <Sparkles className="h-4 w-4 text-[#FFFFFF] animate-pulse" />
                  <span className="lux-shimmer-text text-[14px] font-medium tracking-wide">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && !error.message?.includes('Failed to parse stream string') && (
              <div className={`flex w-full ${isRtl ? 'justify-end' : 'justify-start'}`}>
                <div className="bg-red-500/[0.07] border border-red-500/20 text-red-300 px-5 py-4 rounded-2xl text-[13.5px] leading-relaxed max-w-lg flex items-start gap-3 backdrop-blur-sm">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    {(() => {
                      try {
                        return error?.message?.includes('{')
                          ? JSON.parse(error.message).error || error.message
                          : error?.message.includes('Unauthorized') || error?.message.includes('Sign in')
                            ? 'Sign in to use premium models. Free models need no account.'
                            : error?.message || 'The AI engine is currently experiencing high demand. Please try again in a moment.';
                      } catch {
                        return error?.message || 'The AI engine is currently experiencing high demand. Please try again in a moment.';
                      }
                    })()}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
          </div>
        </div>
      </div>

      {/* ─── Floating Composer Dock (mid-conversation) ─── */}
      {!isEmpty && (
        <div className="absolute bottom-0 left-0 w-full pb-5 px-4 flex justify-center z-40 pointer-events-none h-52 items-end"
          style={{ background: 'linear-gradient(to top, #16181A 38%, rgba(22,24,26,0.94) 58%, rgba(22,24,26,0.6) 78%, transparent)' }}
        >
          <div className="w-full max-w-[700px] pointer-events-auto">
            <ClaudeChatInput
              onSendMessage={handleSend}
              models={AVAILABLE_MODELS}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              placeholder={placeholderText}
              onSignInClick={user ? undefined : () => openAuthModal('signin')}
            />
          </div>
        </div>
      )}

    </div>
  );
}
