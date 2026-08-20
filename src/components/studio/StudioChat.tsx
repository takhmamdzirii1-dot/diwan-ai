'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import useUser from '../../hooks/useUser';
import {
  AnimatedAIChat,
  type ModelOption,
  type AttachedFile,
} from '../ui/animated-ai-chat';
import MessageBubble from './MessageBubble';

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'NVIDIA AI',
    cost: 0,
    tag: 'Ultra-Fast Reasoning (0 pts)',
    isFree: true,
  },
  {
    id: 'google/gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'Google DeepMind',
    cost: 15,
    tag: 'Advanced Multimodal',
    isFree: false,
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'Liquid LFM 2.5 (Free)',
    provider: 'Liquid AI',
    cost: 0,
    tag: 'High Throughput Logic (0 pts)',
    isFree: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'DeepSeek AI',
    cost: 0,
    tag: 'Deep Reasoning & Logic (0 pts)',
    isFree: true,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    cost: 25,
    tag: 'Flagship Coding & Reasoning',
    isFree: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'OpenAI',
    cost: 30,
    tag: 'Multimodal Master',
    isFree: false,
  },
];

const SUGGESTED_PROMPTS = [
  {
    title: '🇩🇿 Algerian Darja E-Commerce',
    prompt:
      'Write a high-converting marketing launch campaign in Algerian Darja for an apparel brand, with BaridiMob payment instructions.',
  },
  {
    title: '⚡ Next.js + Chargily Integration',
    prompt:
      'Provide a complete TypeScript server route in Next.js App Router for verifying Chargily Pay Edahabia / CIB webhooks.',
  },
  {
    title: '🧠 Deep Logic & Algorithm',
    prompt:
      'Design a high-throughput cache algorithm in Python with asymptotic time and space complexity analysis.',
  },
  {
    title: '📊 Compare Model Capabilities',
    prompt:
      'Compare Claude 3.5 Sonnet vs DeepSeek R1 for coding complex full-stack web applications.',
  },
];



interface StudioChatProps {
  onClearChat?: () => void;
  activeSessionId: string | null;
}

export default function StudioChat({
  onClearChat,
  activeSessionId,
}: StudioChatProps) {
  const { user, refreshBalance } = useUser();
  const [selectedModelId, setSelectedModelId] = useState(
    'google/gemini-3.1-pro'
  );
  const [stagedPrompt, setStagedPrompt] = useState<string>('');
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

  const placeholderText = lang === 'ar' ? 'اسأل أي نموذج أو اكتب مهمتك هنا...' :
                          lang === 'fr' ? 'Demandez à un modèle ou décrivez votre tâche...' :
                          'Ask any model or describe your task...';
  
  const { messages, setMessages, append, isLoading, error } = useChat({
    id: activeSessionId || 'default-session',
    api: '/api/generate/chat',
    onFinish: () => {
      refreshBalance();
    },
    onError: (err) => {
      console.error("AI Generation Error:", err);
    }
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendFromChatComponent = async (
    content: string,
    modelId: string,
    cost: number,
    _attachments?: AttachedFile[]
  ) => {
    setStagedPrompt('');
    await append({ role: 'user', content }, { data: { model: modelId } });
  };

  return (
    <div className="flex-1 flex flex-col relative min-w-0 h-full bg-[#050506] text-white font-sans overflow-hidden">
      
      {/* 3. SCROLLABLE MESSAGES CONTAINER */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        
        {/* THIS IS THE CENTERED WRAPPER FOR MESSAGES */}
        <div className="max-w-3xl mx-auto w-full px-4 pt-12 pb-48 flex flex-col gap-8">
          
          {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 w-full">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 shadow-xl">
                  <Bot className="w-6 h-6 text-[#1FD8B8]" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Welcome to VANTRA Studio</h3>
                <p className="text-sm text-white/40 mb-8 text-center max-w-md">
                  Select a model below and start your conversation, or try one of these examples:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  {SUGGESTED_PROMPTS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setStagedPrompt(suggestion.prompt)}
                      className="flex flex-col text-left p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-white/90 mb-1">{suggestion.title}</span>
                      <span className="text-xs text-white/40 line-clamp-2">{suggestion.prompt}</span>
                    </button>
                  ))}
                </div>
             </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                {/* FIXED BUBBLE STYLING */}
                <div className={`relative px-5 py-3.5 text-[15px] leading-relaxed max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-[#1FD8B8]/15 text-white border border-[#1FD8B8]/20 rounded-2xl rounded-br-sm'
                    : 'bg-transparent text-white/90'
                }`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <MessageBubble 
                      message={msg} 
                      isLatest={idx === messages.length - 1} 
                      isStreaming={isLoading} 
                    />
                  )}
                </div>

              </div>
            ))
          )}

          {error && (
            <div className="flex justify-start w-full">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm max-w-lg flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>The AI engine is currently experiencing high demand. Please try again in a moment.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4 w-full shrink-0" />
        </div>
      </div>

      {/* 4. PERFECTLY CENTERED FLOATING INPUT DOCK */}
      <div className="absolute bottom-0 left-0 w-full pt-20 pb-8 px-4 flex justify-center bg-gradient-to-t from-[#050506] via-[#050506]/95 to-transparent z-50 pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto shadow-2xl">
          {/* YOUR INPUT COMPONENT */}
          <AnimatedAIChat
            onSendMessage={handleSendFromChatComponent}
            isLoading={isLoading}
            models={AVAILABLE_MODELS}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            initialValue={stagedPrompt}
            isExpanded={messages.length === 0}
            placeholder={placeholderText}
            aiName="VANTRA"
          />
        </div>
      </div>

    </div>
  );
}
