'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LogIn } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';
import {
  AnimatedAIChat,
  type ModelOption,
  type AttachedFile,
} from '../ui/animated-ai-chat';
import MessageBubble from './MessageBubble';

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'z-ai/glm-5.2:free', name: 'Z.ai GLM 5.2', provider: 'Z.ai', cost: 0, tag: '0 PTS', isFree: true },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', provider: 'Nvidia', cost: 0, tag: '0 PTS', isFree: true },
  { id: 'liquid/lfm-2.5-2.6b:free', name: 'Liquid LFM 2.5', provider: 'Liquid', cost: 0, tag: '0 PTS', isFree: true },
  { id: 'cohere/north-mini-code:free', name: 'Cohere North Mini', provider: 'Cohere', cost: 0, tag: '0 PTS', isFree: true }
];

const SUGGESTED_PROMPTS = [
  {
    icon: '🇩🇿',
    title: 'Darja E-Commerce',
    prompt:
      'Write a high-converting marketing launch campaign in Algerian Darja for an apparel brand, with BaridiMob payment instructions.',
  },
  {
    icon: '⚡',
    title: 'Next.js + Chargily',
    prompt:
      'Provide a complete TypeScript server route in Next.js App Router for verifying Chargily Pay Edahabia / CIB webhooks.',
  },
  {
    icon: '🧠',
    title: 'Deep Logic & Algorithm',
    prompt:
      'Design a high-throughput cache algorithm in Python with asymptotic time and space complexity analysis.',
  },
  {
    icon: '📊',
    title: 'Compare Models',
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
  const [selectedModelId, setSelectedModelId] = useState(AVAILABLE_MODELS[1].id);
  const [lang, setLang] = useState('en');

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

  const isRtl = lang === 'ar';
  const placeholderText = lang === 'ar' ? 'اسأل أي نموذج أو اكتب مهمتك هنا...' :
                          lang === 'fr' ? 'Demandez à un modèle ou décrivez votre tâche...' :
                          'Ask any model or describe your task...';
  const badgeText = lang === 'ar' ? 'بوابة الذكاء الموحدة' :
                    lang === 'fr' ? 'PASSERELLE IA UNIFIÉE' :
                    'UNIFIED AI GATEWAY';
  const welcomeTitleA = lang === 'ar' ? 'كيف أساعدك' : lang === 'fr' ? 'Comment puis-je' : 'How can I help';
  const welcomeTitleB = lang === 'ar' ? 'اليوم؟' : lang === 'fr' ? 'vous ?' : 'you today?';
  const welcomeSub = lang === 'ar'
    ? 'نماذج رائدة عالمياً في مكان واحد — ابدأ مجاناً، وادفع بالنقاط فقط عند استخدام النماذج المتقدمة.'
    : lang === 'fr'
    ? 'Les meilleurs modèles du monde en un seul endroit — commencez gratuitement, payez des points uniquement pour les modèles premium.'
    : 'Frontier models in one place — start free, spend points only when you call premium engines.';
  const signInToChat = lang === 'ar' ? 'سجّل الدخول لبدء المحادثة' :
                       lang === 'fr' ? 'Connectez-vous pour discuter' :
                       'Sign in to start chatting';

  const { messages, setMessages, append, isLoading, error, stop } = useChat({
    id: activeSessionId || 'default-session',
    api: '/api/generate/chat',
    body: {
      model: selectedModelId || AVAILABLE_MODELS[1].id
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

  // Smart auto-scroll: only stick to bottom if user is near it
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

  const handleSendFromChatComponent = useCallback(async (
    content: string,
    modelId: string,
    _cost: number,
    _attachments?: AttachedFile[]
  ) => {
    if (!user) {
      openAuthModal('signin');
      return;
    }
    onSessionActivity?.(activeSessionId, content);
    await append(
      { role: 'user', content },
      { body: { model: modelId || selectedModelId } }
    );
  }, [user, append, openAuthModal, selectedModelId, activeSessionId, onSessionActivity]);

  // Spotlight tracking for suggestion cards
  const handleCardMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="studio-chat lux-chat-bg lux-noise flex-1 flex flex-col relative min-w-0 h-full text-white font-sans overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Ambient breathing orbs behind everything */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="lux-orb lux-orb-teal" />
        <div className="lux-orb lux-orb-violet" />
        <div className="lux-orb lux-orb-gold" />
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full custom-scrollbar relative z-[2]">
        {/* Centered conversation column */}
        <div className="w-full flex justify-center px-4 pb-64 pt-6">
          <div className="w-full max-w-[700px] flex flex-col gap-7">

            {/* ─── Welcome State ─── */}
            {isEmpty && !isLoading && (
              <div className="relative z-[2] flex flex-col items-center justify-center text-center pt-[9vh]">
                <div className="inline-flex lux-welcome-badge mb-7">
                  <span className="lux-welcome-badge-dot" />
                  {badgeText}
                </div>

                <h1 className="lux-metallic-title text-[clamp(30px,5vw,44px)]">
                  {welcomeTitleA}
                  <br />
                  {welcomeTitleB}
                </h1>

                <p className="lux-welcome-sub mt-5">{welcomeSub}</p>

                {!user && (
                  <button
                    type="button"
                    onClick={() => openAuthModal('signin')}
                    className="group mt-8 inline-flex items-center gap-2.5 px-6 h-12 rounded-full bg-gradient-to-r from-[#1FD8B8] to-[#34E2C2] text-[#050506] text-sm font-bold transition-all hover:-translate-y-0.5 shadow-[0_10px_36px_-8px_rgba(31,216,184,0.55)] hover:shadow-[0_16px_44px_-8px_rgba(31,216,184,0.65)] cursor-pointer"
                  >
                    <LogIn className="h-4 w-4" />
                    {signInToChat}
                    <span className="block h-px w-0 group-hover:w-2 bg-[#050506]/60 transition-all duration-300" />
                  </button>
                )}

                {/* Suggestion cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12 w-full">
                  {SUGGESTED_PROMPTS.map((sp) => (
                    <button
                      key={sp.title}
                      type="button"
                      onMouseMove={handleCardMouseMove}
                      onClick={() => handleSendFromChatComponent(sp.prompt, selectedModelId, 0)}
                      disabled={!!isLoading}
                      className="lux-suggest-card px-5 py-4 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2 relative z-[1]">
                        <span className="text-base leading-none">{sp.icon}</span>
                        <span className="lux-suggest-free">FREE</span>
                      </div>
                      <span className="block relative z-[1] mt-2.5 text-[13.5px] font-semibold text-white/90">
                        {sp.title}
                      </span>
                      <span className="block relative z-[1] mt-1 text-[12px] text-white/40 line-clamp-2 leading-relaxed">
                        {sp.prompt}
                      </span>
                    </button>
                  ))}
                </div>
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

            {/* Thinking indicator — golden wave */}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className={`flex w-full ${isRtl ? 'justify-end' : 'justify-start'}`}>
                <div className="lux-msg-ai rounded-2xl px-5 py-4 inline-flex items-center gap-3">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/35 me-1">
                    VANTRA
                  </span>
                  <span className="flex items-center gap-1.5 py-1">
                    <span className="lux-dot-wave" />
                    <span className="lux-dot-wave" />
                    <span className="lux-dot-wave" />
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
                          : error?.message.includes('Unauthorized')
                            ? 'Please sign in to use your AI balance.'
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

      {/* ─── Floating Input Dock — luxury shell ─── */}
      <div className="absolute bottom-0 left-0 w-full pb-6 px-4 flex justify-center z-40 pointer-events-none h-48 items-end"
        style={{ background: 'linear-gradient(to top, #050506 22%, rgba(5,5,6,0.88) 52%, transparent)' }}
      >
        <div className="w-full max-w-[700px] pointer-events-auto">
          <div className="lux-input-shell">
            <div className="lux-input-shell-inner">
              <AnimatedAIChat
                variant="lux"
                onSendMessage={handleSendFromChatComponent}
                isLoading={isLoading}
                models={AVAILABLE_MODELS}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                onStop={stop}
                isExpanded={false}
                placeholder={placeholderText}
                aiName="VANTRA"
              />
            </div>
          </div>
          <p className="text-center text-[10px] font-mono tracking-[0.14em] text-white/25 mt-3 uppercase">
            VANTRA can make mistakes · Free models cost 0 pts
          </p>
        </div>
      </div>

    </div>
  );
}
