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
  Terminal,
  Loader2,
  Zap,
  Code2,
} from 'lucide-react';
import useUser from '../../hooks/useUser';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  model?: string;
  cost?: number;
  timestamp: string;
}

export const AVAILABLE_MODELS = [
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    provider: 'NVIDIA AI',
    cost: 0,
    tag: 'Ultra-Fast Reasoning (0 pts)',
    isFree: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google Gemma 4 26B (Free)',
    provider: 'Google DeepMind',
    cost: 0,
    tag: 'Advanced Instruction (0 pts)',
    isFree: true,
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

// Helper to render formatted Markdown and Code blocks with syntax copy
function FormattedMessageContent({ content }: { content: string }) {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Split by code blocks ```lang ... ```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-[#F5F6F8]">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Extract language and code
          const firstLineEnd = part.indexOf('\n');
          const lang = firstLineEnd !== -1 ? part.slice(3, firstLineEnd).trim() : '';
          const code = firstLineEnd !== -1 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);

          return (
            <div
              key={idx}
              className="my-3 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#050608] shadow-2xl"
            >
              {/* Code block header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0A0B0E] px-4 py-2 text-xs text-[#94A3B8]">
                <div className="flex items-center gap-2 font-mono text-[11px] text-[#1FD8B8]">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>{lang || 'code'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(code, idx)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
                >
                  {copiedCodeIdx === idx ? (
                    <>
                      <Check className="h-3 w-3 text-[#1FD8B8]" />
                      <span className="text-[#1FD8B8]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code content */}
              <pre className="overflow-x-auto p-4 font-mono text-xs text-[#E2E8F0] leading-relaxed custom-scrollbar">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Render regular markdown text with basic formatting
        return (
          <div key={idx} className="whitespace-pre-wrap select-text">
            {part.split('\n').map((line, lIdx) => {
              if (line.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-base font-bold text-white mt-3 mb-1">
                    {line.replace('### ', '')}
                  </h4>
                );
              }
              if (line.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-lg font-bold text-white mt-4 mb-2">
                    {line.replace('## ', '')}
                  </h3>
                );
              }
              if (line.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-xl font-bold text-white mt-4 mb-2">
                    {line.replace('# ', '')}
                  </h2>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 ml-2 my-0.5">
                    <span className="text-[#1FD8B8] font-bold mt-1 text-xs">•</span>
                    <span>{renderInlineFormatting(line.slice(2))}</span>
                  </div>
                );
              }
              return (
                <p key={lIdx} className="my-1">
                  {renderInlineFormatting(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Render bold, inline code, and emphasis
function renderInlineFormatting(text: string) {
  // Inline code `code`
  const codeParts = text.split(/(`[^`]+`)/g);
  return codeParts.map((cPart, cIdx) => {
    if (cPart.startsWith('`') && cPart.endsWith('`')) {
      return (
        <code
          key={cIdx}
          className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-xs text-[#1FD8B8] border border-white/[0.06]"
        >
          {cPart.slice(1, -1)}
        </code>
      );
    }

    // Bold text **text**
    const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIdx) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return (
          <strong key={bIdx} className="font-bold text-white">
            {bPart.slice(2, -2)}
          </strong>
        );
      }
      return bPart;
    });
  });
}

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
  const { user, balance } = useUser();
  const [input, setInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(
    'nvidia/nemotron-3.5-lightning:free'
  );
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

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050506] relative overflow-hidden">
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

      {/* Messages Canvas Feed */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 custom-scrollbar pb-36">
        {messages.length === 0 ? (
          /* Empty State / Welcome Screen */
          <div className="max-w-2xl mx-auto pt-6 sm:pt-12 space-y-8 text-center">
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
                Prompt world-class AI models directly with unified DZD credit points or free open-weights intelligence.
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
                  className="p-4 rounded-2xl border border-white/[0.08] bg-[#0A0B0E]/90 hover:bg-white/[0.04] hover:border-[#1FD8B8]/40 transition text-left space-y-1.5 cursor-pointer group shadow-md"
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
                  className={`max-w-[85%] sm:max-w-[80%] rounded-3xl p-5 space-y-3 shadow-lg ${
                    msg.sender === 'user'
                      ? 'bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-white'
                      : 'bg-[#0D0E12] border border-white/[0.08] text-[#F5F6F8]'
                  }`}
                >
                  {/* Header Meta */}
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] pb-2 border-b border-white/[0.06]">
                    <span className="font-semibold text-white/90 flex items-center gap-1.5">
                      {msg.sender === 'user' ? (
                        'You'
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 text-[#1FD8B8]" />
                          <span>{msg.model || 'VANTRA AI'}</span>
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {msg.cost !== undefined && (
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                            msg.cost === 0
                              ? 'bg-[#1FD8B8]/10 text-[#1FD8B8]'
                              : 'bg-white/[0.06] text-white/70'
                          }`}
                        >
                          {msg.cost === 0 ? 'FREE (0 pts)' : `-${msg.cost} PTS`}
                        </span>
                      )}
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Formatted Content */}
                  <FormattedMessageContent content={msg.content} />

                  {/* Actions for Assistant */}
                  {msg.sender === 'assistant' && (
                    <div className="flex items-center justify-end pt-2 border-t border-white/[0.04]">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#1FD8B8] transition cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#1FD8B8]" />
                            <span className="text-[#1FD8B8]">Copied full message</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy message</span>
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
                <div className="rounded-3xl p-5 bg-[#0D0E12] border border-white/[0.08] flex items-center gap-3 text-xs text-[#94A3B8]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#1FD8B8]" />
                  <span>{currentModel.name} is reasoning and generating response...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Redesigned Floating Bottom Toolbar & Prompt Container */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-[#050506]/85 backdrop-blur-xl border-t border-white/5 z-30">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-[#0D0E12] p-3.5 shadow-2xl focus-within:border-[#1FD8B8]/50 focus-within:ring-1 focus-within:ring-[#1FD8B8]/30 transition space-y-2">
            {/* Auto-growing Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${currentModel.name}... (Enter to send, Shift+Enter for multiline)`}
              rows={1}
              className="w-full bg-transparent px-2 py-1 text-sm text-white placeholder-white/30 outline-none resize-none max-h-44 custom-scrollbar"
            />

            {/* Bottom Toolbar inside Prompt Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] relative">
              {/* Left: Model Selector Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white text-xs font-semibold transition cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#1FD8B8]" />
                  <span className="max-w-[150px] sm:max-w-none truncate">{currentModel.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </button>

                {/* Model Selector Dropdown Popout */}
                {modelDropdownOpen && (
                  <div className="absolute left-0 bottom-11 w-72 rounded-2xl border border-white/[0.12] bg-[#0E1016] p-2 shadow-2xl z-50 space-y-1">
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer ${
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

              {/* Center: Point Cost Badge */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <span
                  className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    currentModel.cost === 0
                      ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border border-[#1FD8B8]/30'
                      : 'bg-white/[0.06] text-[#94A3B8]'
                  }`}
                >
                  {currentModel.cost === 0 ? '0 PTS (FREE)' : `${currentModel.cost} PTS`}
                </span>
              </div>

              {/* Right: Glowing Teal Submit Button */}
              <button
                type="button"
                disabled={!input.trim() || isLoading}
                onClick={handleSubmit}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1FD8B8] text-[#050506] font-bold shadow-[0_2px_15px_rgba(31,216,184,0.35)] hover:bg-[#34e2c2] disabled:opacity-40 disabled:hover:bg-[#1FD8B8] transition cursor-pointer shrink-0"
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
