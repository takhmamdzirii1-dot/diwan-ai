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
}

export default function StudioChat({
  onClearChat,
}: StudioChatProps) {
  const { user, refreshBalance } = useUser();
  const [selectedModelId, setSelectedModelId] = useState(
    'google/gemini-3.1-pro'
  );
  const [stagedPrompt, setStagedPrompt] = useState<string>('');
  
  const { messages, setMessages, append, isLoading, error } = useChat({
    api: '/api/generate/chat',
    onFinish: () => {
      refreshBalance();
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistence: Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vantra_chat_history');
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e) {}
  }, [setMessages]);

  // Persistence: Save on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('vantra_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

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
    <div className="flex-1 flex flex-col h-full bg-[#050506] relative overflow-hidden">
      {/* Ambient Radial Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6E6BFF]/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[350px] bg-[#1FD8B8]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Unobtrusive Top Alert Banner */}
      {error && (
        <div className="mx-4 md:mx-8 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between text-xs text-red-300 shadow-lg z-20">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Notice:</span>
            <span>{error.message}</span>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <AnimatedAIChat
          onSendMessage={handleSendFromChatComponent}
          isLoading={isLoading}
          models={AVAILABLE_MODELS}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          initialValue={stagedPrompt}
          isExpanded={true}
        />
      ) : (
        /* Active Session State */
        <>
          <div className="absolute top-4 right-4 md:right-8 z-30">
            <button
              onClick={() => {
                setMessages([]);
                localStorage.removeItem('vantra_chat_history');
                if (onClearChat) onClearChat();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 rounded-full transition-all backdrop-blur-md cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full custom-scrollbar pb-48 px-4 md:px-12 pt-8">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isLatest={idx === messages.length - 1} 
                  isStreaming={isLoading} 
                />
              ))}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Masking Gradient */}
          <div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-[#050506] via-[#050506]/90 to-transparent z-40 pointer-events-none" />

          {/* Floating Input Dock */}
          <div className="absolute bottom-6 left-0 right-0 max-w-4xl mx-auto px-4 z-50">
            <AnimatedAIChat
              onSendMessage={handleSendFromChatComponent}
              isLoading={isLoading}
              models={AVAILABLE_MODELS}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              initialValue={stagedPrompt}
              isExpanded={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
