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
import useUser from '../../hooks/useUser';
import {
  AnimatedAIChat,
  type ModelOption,
  type AttachedFile,
} from '../ui/animated-ai-chat';
import MessageBubble from './MessageBubble';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  model?: string;
  cost?: number;
  timestamp: string;
}

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
  messages: ChatMessage[];
  onSendMessage: (content: string, model: string, cost: number) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  onDismissError?: () => void;
}

export default function StudioChat({
  messages,
  onSendMessage,
  isLoading,
  errorMessage,
  onDismissError,
}: StudioChatProps) {
  const { user } = useUser();
  const [selectedModelId, setSelectedModelId] = useState(
    'google/gemini-3.1-pro'
  );
  const [stagedPrompt, setStagedPrompt] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendFromChatComponent = async (
    content: string,
    modelId: string,
    cost: number,
    _attachments?: AttachedFile[]
  ) => {
    setStagedPrompt('');
    await onSendMessage(content, modelId, cost);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050506] relative overflow-hidden">
      {/* Ambient Radial Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#6E6BFF]/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[350px] bg-[#1FD8B8]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Unobtrusive Top Alert Banner */}
      {errorMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-between text-xs text-red-300 shadow-lg z-20">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Notice:</span>
            <span>{errorMessage}</span>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="text-red-400 hover:text-white p-1 transition cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          )}
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
          <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8 pb-40 scroll-smooth custom-scrollbar">
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

          <div className="absolute bottom-6 left-0 right-0 z-50 px-4 max-w-3xl mx-auto flex justify-center">
            <div className="w-full">
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
          </div>
        </>
      )}
    </div>
  );
}
