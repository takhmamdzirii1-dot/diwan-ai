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
import AnimatedAIChat, {
  type ModelOption,
  type AttachedFile,
} from '../ui/animated-ai-chat';

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
        /* Empty State / Welcome Screen */
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10 w-full h-full space-y-8">
          <div className="space-y-4 text-center mt-[-8vh]">
            <h2
              className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/50 tracking-tight font-heading"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              What will you create today?
            </h2>
            <p className="text-sm md:text-base text-[#94A3B8] max-w-xl mx-auto">
              Prompt world-class AI models directly with unified credits.
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <AnimatedAIChat
              onSendMessage={handleSendFromChatComponent}
              isLoading={isLoading}
              models={AVAILABLE_MODELS}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              initialValue={stagedPrompt}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mt-4">
            {SUGGESTED_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStagedPrompt(item.prompt)}
                className="px-4 py-2 rounded-full border border-white/[0.08] bg-[#0A0B0E]/60 backdrop-blur-md hover:bg-white/[0.04] hover:border-[#1FD8B8]/40 transition text-xs font-medium text-[#94A3B8] hover:text-white cursor-pointer shadow-md"
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Active Session State */
        <>
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-6 space-y-6 custom-scrollbar pb-44 md:pb-48">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 sm:gap-4 ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="h-8 w-8 rounded-xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shrink-0 mt-1 shadow-[0_0_12px_rgba(31,216,184,0.15)]">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg ${
                      msg.sender === 'user'
                        ? 'bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-white'
                        : 'bg-[#0D0E12]/95 border border-white/[0.08] text-[#F5F6F8] backdrop-blur-xl'
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

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 md:p-6 bg-gradient-to-t from-[#050506] via-[#050506]/95 to-transparent backdrop-blur-xl border-t border-white/[0.04] z-30 flex justify-center">
            <div className="w-full max-w-3xl">
              <AnimatedAIChat
                onSendMessage={handleSendFromChatComponent}
                isLoading={isLoading}
                models={AVAILABLE_MODELS}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                initialValue={stagedPrompt}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
