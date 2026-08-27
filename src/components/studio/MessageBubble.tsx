import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, Terminal, Share, RefreshCw, Sparkles } from 'lucide-react';
import type { Message } from '@ai-sdk/react';
import { useSmoothText } from '../../hooks/useSmoothText';
import { detectDir } from '../../lib/direction';

export interface MessageBubbleProps {
  message: Message;
  isLatest: boolean;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export default function MessageBubble({ message, isLatest, isStreaming, onRegenerate }: MessageBubbleProps) {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [shared, setShared] = useState(false);
  const codeBlockCounter = useRef(0);
  codeBlockCounter.current = 0;

  const isUser = message.role === 'user';

  // Fluid typewriter reveal while the assistant is streaming
  const smoothActive = !isUser && isStreaming && isLatest;
  const smoothContent = useSmoothText(message.content, smoothActive);
  const displayContent = smoothActive ? smoothContent : message.content;
  const showStreamingCursor = smoothActive && displayContent.length > 0;

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'VANTRA AI', text: message.content });
      } else {
        await navigator.clipboard.writeText(message.content);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="group/msg flex flex-col gap-2.5 w-full min-w-0"
    >
      {/* Header meta - AI only (Claude style) */}
      {!isUser && (
      <div className="flex items-center gap-3 w-full px-1 justify-start">
        {
          <>
            {/* Animated gradient avatar */}
            <div className="ai-avatar-ring h-7 w-7 rounded-lg p-[1.5px]">
              <div className="w-full h-full rounded-[calc(0.5rem-1.5px)] bg-[#1A1C1F] flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[#FFFFFF]" />
              </div>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/55">VANTRA</span>
            {!isStreaming && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  title="Copy"
                  className="p-1.5 rounded-md text-white/30 hover:text-[#FFFFFF] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                >
                  {copiedMessage ? <Check className="h-3 w-3 text-[#FFFFFF]" /> : <Copy className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  title="Share"
                  className="p-1.5 rounded-md text-white/30 hover:text-[#D1D5DB] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                >
                  {shared ? <Check className="h-3 w-3 text-[#FFFFFF]" /> : <Share className="h-3 w-3" />}
                </button>
                {isLatest && onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    title="Regenerate"
                    className="p-1.5 rounded-md text-white/30 hover:text-[#FFFFFF] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </>
        }
      </div>
      )}

      {/* Bubble / Panel */}
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <div className="user-bubble-gloss max-w-[80%] min-w-0 rounded-2xl px-5 py-4" dir={detectDir(message.content)}>
            <p className="text-[15px] text-white/90 font-medium leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        ) : (
          <div className="w-fit max-w-full min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl px-6 py-5 md:px-7 md:py-6 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.9)] relative">
            {/* top gradient hairline: cyan -> violet */}
            <span className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#FFFFFF]/40 to-transparent pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)' }} />
            <div className="lux-prose font-sans antialiased text-white/90">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  pre: ({ children }) => <>{children}</>,
                  p: ({ children }) => <p dir="auto">{children}</p>,
                  h1: ({ children }) => <h1 dir="auto">{children}</h1>,
                  h2: ({ children }) => <h2 dir="auto">{children}</h2>,
                  h3: ({ children }) => <h3 dir="auto">{children}</h3>,
                  h4: ({ children }) => <h4 dir="auto">{children}</h4>,
                  li: ({ children }) => <li dir="auto">{children}</li>,
                  blockquote: ({ children }) => <blockquote dir="auto">{children}</blockquote>,
                  table: ({ children }) => (
                    <div className="my-6 overflow-x-auto custom-scrollbar rounded-xl border border-white/[0.1] bg-[#1A1C1F]" dir="ltr">
                      <table className="w-full text-[14px] border-collapse min-w-[520px]">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-white/[0.045]">{children}</thead>,
                  th: ({ children }) => (
                    <th dir="auto" className="px-4 py-3.5 text-start text-[12.5px] font-semibold uppercase tracking-wider text-[#FFFFFF]/85 border-b border-white/[0.12]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td dir="auto" className="px-4 py-3.5 align-top text-white/85 leading-relaxed border-b border-white/[0.05]">
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => <tr className="transition-colors hover:bg-white/[0.02]">{children}</tr>,
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return <code className="lux-code-inline" {...props}>{children}</code>;
                    }
                    const langName = match[1];
                    const codeString = String(children).replace(/\n$/, '');
                    const blockId = `blk-${message.id}-${codeBlockCounter.current++}`;
                    return (
                      <div className="my-5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#1A1C1F] shadow-2xl flex flex-col w-full" dir="ltr">
                        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 gap-4">
                          <div className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#FFFFFF]/85 shrink-0">
                            <Terminal className="h-3 w-3" />
                            <span>{langName || 'code'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(codeString, blockId)}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white transition cursor-pointer shrink-0 active:scale-95"
                          >
                            {copiedCodeId === blockId ? (
                              <>
                                <Check className="h-3 w-3 text-[#FFFFFF]" />
                                <span className="text-[#FFFFFF]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="p-4 overflow-x-auto custom-scrollbar w-full min-w-0">
                          <pre className="!bg-transparent !p-0 !m-0 font-mono text-[13.5px] leading-[1.72] text-[#DDE3EC] min-w-max">
                            <code className={className} {...props}>{children}</code>
                          </pre>
                        </div>
                      </div>
                    );
                  }
                }}
              >
                {displayContent}
              </ReactMarkdown>

              {showStreamingCursor && (
                <span
                  aria-hidden
                  className="inline-block w-[7px] h-[17px] ms-1 align-middle bg-[#FFFFFF] animate-pulse rounded-[2px]"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
