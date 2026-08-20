'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Zap,
  Code2,
  Terminal,
  Loader2,
} from 'lucide-react';
import useUser from '../../hooks/useUser';
import { supabase } from '../../lib/supabase/client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  model?: string;
  cost?: number;
  timestamp: string;
}

const AVAILABLE_MODELS = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    cost: 25,
    tag: 'Flagship Logic & Code',
    isFree: false,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta AI',
    cost: 0,
    tag: '100% FREE',
    isFree: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    provider: 'DeepSeek AI',
    cost: 0,
    tag: '100% FREE',
    isFree: true,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'OpenAI',
    cost: 30,
    tag: 'Multimodal Master',
    isFree: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3 Chat',
    provider: 'DeepSeek AI',
    cost: 5,
    tag: 'Ultra-Fast Reasoning',
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
}

export default function StudioChat({
  messages,
  onSendMessage,
  isLoading,
}: StudioChatProps) {
  const { user, balance } = useUser();
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('anthropic/claude-3.5-sonnet');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel =
    AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(text, currentModel.id, currentModel.cost);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050506] relative overflow-hidden">
      {/* Top Header / Model Bar */}
      <header className="h-14 border-b border-white/[0.08] bg-[#0A0B0E]/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
        {/* Model Picker */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white text-xs font-semibold transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#1FD8B8]" />
              <span className="font-bold">{currentModel.name}</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                currentModel.isFree
                  ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border border-[#1FD8B8]/30 font-bold'
                  : 'bg-white/[0.06] text-white/70'
              }`}
            >
              {currentModel.cost === 0 ? 'FREE (0 pts)' : `${currentModel.cost} PTS`}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
          </button>

          {/* Dropdown Menu */}
          {modelDropdownOpen && (
            <div className="absolute left-0 top-11 w-72 rounded-2xl border border-white/[0.1] bg-[#0E1016] p-2 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#64748B] tracking-wider">
                Select Intelligence Engine
              </div>
              {AVAILABLE_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                    selectedModelId === model.id
                      ? 'bg-[#1FD8B8]/10 text-white border border-[#1FD8B8]/30'
                      : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {model.name}
                      {model.isFree && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1FD8B8]/20 text-[#1FD8B8] font-bold">
                          FREE
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#64748B]">{model.tag}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#1FD8B8]">
                    {model.cost === 0 ? '0 pts' : `${model.cost} pts`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Active Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-[#1FD8B8] animate-pulse" />
            <span>OpenRouter Ultra Gateway</span>
          </div>
        </div>
      </header>

      {/* Messages Canvas Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar pb-32">
        {messages.length === 0 ? (
          /* Empty State / Welcome Screen */
          <div className="max-w-2xl mx-auto pt-8 sm:pt-16 space-y-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1FD8B8]/10 border border-[#1FD8B8]/25 text-[#1FD8B8] shadow-[0_0_30px_rgba(31,216,184,0.2)]">
              <Sparkles className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2
                className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                What will you build with VANTRA today?
              </h2>
              <p className="text-sm text-[#94A3B8] max-w-md mx-auto">
                Prompt world-class LLMs in English, French or Algerian Darja. Deductions are
                processed atomically with local DZD credit points.
              </p>
            </div>

            {/* Starter Prompt Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {SUGGESTED_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInput(item.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-4 rounded-2xl border border-white/[0.08] bg-[#0A0B0E]/80 hover:bg-white/[0.04] hover:border-[#1FD8B8]/40 transition text-left space-y-1.5 cursor-pointer group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-[#1FD8B8] transition">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Feed */
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shrink-0 mt-1 shadow-[0_0_12px_rgba(31,216,184,0.15)]">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-3xl p-5 space-y-3 ${
                    msg.sender === 'user'
                      ? 'bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-white'
                      : 'bg-[#0E1016] border border-white/[0.08] text-[#F5F6F8] shadow-lg'
                  }`}
                >
                  {/* Header Meta */}
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] pb-1 border-b border-white/[0.04]">
                    <span className="font-semibold text-white/80">
                      {msg.sender === 'user' ? 'You' : msg.model || 'VANTRA AI'}
                    </span>
                    <div className="flex items-center gap-2">
                      {msg.cost !== undefined && (
                        <span className="font-mono text-[#1FD8B8] font-bold">
                          {msg.cost === 0 ? 'FREE (0 pts)' : `-${msg.cost} PTS`}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap select-text font-sans">
                    {msg.content}
                  </div>

                  {/* Actions for Assistant */}
                  {msg.sender === 'assistant' && (
                    <div className="flex items-center justify-end pt-2 border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#1FD8B8] transition cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#1FD8B8]" />
                            <span className="text-[#1FD8B8]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-white shrink-0 mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="h-8 w-8 rounded-xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shrink-0 mt-1 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-3xl p-5 bg-[#0E1016] border border-white/[0.08] flex items-center gap-3 text-xs text-[#94A3B8]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#1FD8B8]" />
                  <span>{currentModel.name} is reasoning and generating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Prompt Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-[#050506] via-[#050506]/95 to-transparent z-30">
        <div className="max-w-3xl mx-auto relative">
          <div className="rounded-3xl border border-white/[0.12] bg-[#0E1016]/95 p-2 sm:p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition focus-within:border-[#1FD8B8]/80 focus-within:ring-1 focus-within:ring-[#1FD8B8]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentModel.name}... (Press Enter to send, Shift+Enter for new line)`}
              rows={1}
              className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none max-h-44 custom-scrollbar"
            />

            <div className="flex items-center justify-between pt-2 px-2 border-t border-white/[0.04]">
              <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                <span className="font-mono text-[#1FD8B8] font-bold">
                  {currentModel.cost === 0 ? '0 PTS (FREE)' : `${currentModel.cost} PTS / Query`}
                </span>
              </div>

              <button
                type="button"
                disabled={!input.trim() || isLoading}
                onClick={handleSubmit}
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#1FD8B8] text-[#050506] font-bold shadow-[0_2px_15px_rgba(31,216,184,0.35)] hover:bg-[#34e2c2] disabled:opacity-40 disabled:hover:bg-[#1FD8B8] transition cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#050506]" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
