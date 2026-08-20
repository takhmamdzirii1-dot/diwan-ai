import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, Terminal, Sparkles } from 'lucide-react';
import type { ChatMessage } from './StudioChat';

export interface MessageBubbleProps {
  message: ChatMessage;
  isLatest: boolean;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isLatest, isStreaming }: MessageBubbleProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isUser = message.sender === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex gap-3 sm:gap-4 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shrink-0 mt-1 shadow-[0_0_12px_rgba(31,216,184,0.15)]">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={`max-w-[92%] sm:max-w-[85%] rounded-3xl p-4 sm:p-5 shadow-lg ${
          isUser
            ? 'bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-white rounded-tr-md'
            : 'bg-[#0D0E12]/95 border border-white/[0.08] text-[#F5F6F8] backdrop-blur-xl rounded-tl-md'
        }`}
      >
        {/* Header Meta */}
        <div className="flex items-center justify-between text-[10px] text-[#64748B] pb-2 mb-3 border-b border-white/[0.06] gap-3">
          <span className="font-semibold text-white/90 flex items-center gap-1.5 truncate min-w-0">
            {isUser ? (
              'You'
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-[#1FD8B8] shrink-0" />
                <span className="truncate">{message.model || 'VANTRA AI'}</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {message.cost !== undefined && (
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                  message.cost === 0
                    ? 'bg-[#1FD8B8]/10 text-[#1FD8B8]'
                    : 'bg-white/[0.06] text-white/70'
                }`}
              >
                {message.cost === 0 ? 'FREE (0 pts)' : `-${message.cost} PTS`}
              </span>
            )}
            <span>{message.timestamp}</span>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a {...props} className="text-[#1FD8B8] hover:underline" target="_blank" rel="noopener noreferrer" />
              ),
              p: ({ node, children, ...props }) => (
                <p className="mb-3 last:mb-0 text-white/90" {...props}>{children}</p>
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-bold text-white" {...props} />
              ),
              ul: ({ node, ...props }) => (
                <ul className="list-disc pl-5 mb-3 text-white/90 marker:text-[#1FD8B8]" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal pl-5 mb-3 text-white/90 marker:text-[#1FD8B8]" {...props} />
              ),
              li: ({ node, ...props }) => (
                <li className="mb-1" {...props} />
              ),
              h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-base font-bold text-white mt-3 mb-2" {...props} />,
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto mb-4 rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm text-white/80" {...props} />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th className="bg-[#050608] px-4 py-2 font-bold text-white border-b border-white/10" {...props} />
              ),
              td: ({ node, ...props }) => (
                <td className="bg-[#0A0B0E] px-4 py-2 border-b border-white/5" {...props} />
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = inline || !match;
                
                if (isInline) {
                  return (
                    <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-[#1FD8B8] border border-white/[0.06]" {...props}>
                      {children}
                    </code>
                  );
                }

                const lang = match ? match[1] : '';
                const codeString = String(children).replace(/\n$/, '');
                const blockId = Math.random().toString(36).substring(7);

                return (
                  <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#050506] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0A0B0E] px-4 py-2 text-xs text-[#94A3B8]">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-[#1FD8B8]">
                        <Terminal className="h-3.5 w-3.5" />
                        <span>{lang || 'code'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(codeString, blockId)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
                      >
                        {copiedId === blockId ? (
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
                    <div className="p-4 overflow-x-auto custom-scrollbar">
                      <pre className="!bg-transparent !p-0 !m-0 text-[13px] leading-relaxed text-[#E2E8F0]">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  </div>
                );
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
          
          {isLatest && !isUser && isStreaming && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2 h-4 bg-[#1FD8B8] ml-1 align-middle translate-y-[-2px]"
            />
          )}
        </div>
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-white shrink-0 mt-1">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}
