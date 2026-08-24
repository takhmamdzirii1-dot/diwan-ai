import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, Terminal } from 'lucide-react';
import type { Message } from '@ai-sdk/react';

export interface MessageBubbleProps {
  message: Message;
  isLatest: boolean;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isLatest, isStreaming }: MessageBubbleProps) {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const codeBlockCounter = useRef(0);

  // Stable ids per render pass: incrementing counter instead of Math.random()
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

  const isUser = message.role === 'user';
  const showStreamingCursor =
    !isUser && isStreaming && isLatest && message.content.length > 0;

  return (
    <div className="group/msg flex flex-col gap-2.5 w-full min-w-0">
      {/* Header meta */}
      <div className={`flex items-center gap-3 w-full px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/40">You</span>
            <div className="h-7 w-7 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white/80 shadow-sm">
              <User className="h-3.5 w-3.5" />
            </div>
          </>
        ) : (
          <>
            <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-[#1FD8B8]/25 to-transparent border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8] shadow-[0_0_16px_rgba(31,216,184,0.18)]">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/55">
              VANTRA
            </span>
            {!isStreaming && (
              <button
                type="button"
                onClick={handleCopyMessage}
                title="Copy message"
                className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-md text-white/30 hover:text-white hover:bg-white/[0.07] cursor-pointer"
              >
                {copiedMessage ? <Check className="h-3 w-3 text-[#E8C87A]" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Bubble / Panel */}
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <div
            className="lux-msg-user max-w-[85%] min-w-0 rounded-2xl rounded-tr-md px-5 py-4"
            dir="auto"
          >
            <p className="text-[15px] leading-[1.75] text-white whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        ) : (
          <div className="lux-msg-ai w-full min-w-0 rounded-2xl px-6 py-5 md:px-7 md:py-6" dir="auto">
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
                          <div className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#E8C87A]/85 shrink-0">
                            <Terminal className="h-3 w-3" />
                            <span>{langName || 'code'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(codeString, blockId)}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/55 hover:bg-white/[0.06] hover:text-white transition cursor-pointer shrink-0"
                          >
                            {copiedCodeId === blockId ? (
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
                  className="inline-block w-[7px] h-[17px] ms-1 align-middle bg-[#E8C87A] animate-pulse rounded-[2px] shadow-[0_0_10px_rgba(232,200,122,0.5)]"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
