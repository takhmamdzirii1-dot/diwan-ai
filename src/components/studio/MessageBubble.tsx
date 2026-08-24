import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Terminal, Share, RefreshCw, Sparkles, User } from 'lucide-react';
import type { Message } from '@ai-sdk/react';

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

  const isUser = message.role === 'user';
  const showStreamingCursor = !isUser && isStreaming && isLatest && message.content.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="group/msg flex flex-col gap-2.5 w-full min-w-0"
    >
      {/* Header meta */}
      <div className={`flex items-center gap-3 w-full px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#00F5D4]/60">You</span>
            <div className="h-7 w-7 rounded-lg bg-white/[0.06] border border-[#00F5D4]/25 flex items-center justify-center text-[#00F5D4]/90 shadow-[0_0_14px_-4px_rgba(0,245,212,0.5)]">
              <User className="h-3.5 w-3.5" />
            </div>
          </>
        ) : (
          <>
            {/* Animated gradient avatar */}
            <div className="ai-avatar-ring h-7 w-7 rounded-lg p-[1.5px] shadow-[0_0_18px_-2px_rgba(0,229,255,0.4)]">
              <div className="w-full h-full rounded-[calc(0.5rem-1.5px)] bg-[#0D0E12] flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-[#00E5FF]" />
              </div>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/55">VANTRA</span>
            {!isStreaming && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  title="Copy"
                  className="p-1.5 rounded-md text-white/30 hover:text-[#00F5D4] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                >
                  {copiedMessage ? <Check className="h-3 w-3 text-[#00F5D4]" /> : <Copy className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  title="Share"
                  className="p-1.5 rounded-md text-white/30 hover:text-[#9D4EDD] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                >
                  {shared ? <Check className="h-3 w-3 text-[#00F5D4]" /> : <Share className="h-3 w-3" />}
                </button>
                {isLatest && onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    title="Regenerate"
                    className="p-1.5 rounded-md text-white/30 hover:text-[#E8C87A] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-90"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bubble / Panel */}
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <div className="user-bubble-cyan max-w-[85%] min-w-0 rounded-2xl rounded-tr-md px-5 py-4 backdrop-blur-xl" dir="auto">
            <p className="text-[15px] leading-[1.75] text-white whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        ) : (
          <div className="w-full min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl px-6 py-5 md:px-7 md:py-6 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.9)] relative overflow-hidden" dir="auto">
            {/* top gradient hairline: cyan -> violet */}
            <span className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/40 to-transparent pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.45), rgba(157,78,221,0.35), transparent)' }} />
            <div className="lux-prose">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre: ({ children }) => <>{children}</>,
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
                      <div className="my-5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#060609] shadow-2xl flex flex-col w-full" dir="ltr">
                        <div className="flex flex-wrap items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-4 py-2.5 gap-4">
                          <div className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#00E5FF]/85 shrink-0">
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
                                <Check className="h-3 w-3 text-[#00F5D4]" />
                                <span className="text-[#00F5D4]">Copied</span>
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
                {message.content}
              </ReactMarkdown>

              {showStreamingCursor && (
                <span
                  aria-hidden
                  className="inline-block w-[7px] h-[17px] ms-1 align-middle bg-[#00E5FF] animate-pulse rounded-[2px] shadow-[0_0_10px_rgba(0,229,255,0.6)]"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
