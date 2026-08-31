import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, Terminal, Share, RefreshCw, Sparkles, Image as ImageIcon, FileImage, FileText } from 'lucide-react';
import type { Message } from '@ai-sdk/react';
import { useSmoothText } from '../../hooks/useSmoothText';
import { detectDir } from '../../lib/direction';
import { cn } from '@/lib/utils';

export interface MessageBubbleProps {
  message: Message;
  isLatest: boolean;
  isStreaming?: boolean;
  isThinking?: boolean;
  onRegenerate?: () => void;
}

function AttachmentThumbnail({ attachment }: { attachment: { name: string; url?: string | File | Blob } }) {
  const [hasError, setHasError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.url) return;
    if (typeof attachment.url === 'string') {
      setObjectUrl(attachment.url);
      setHasError(false);
    } else if (typeof window !== 'undefined' && attachment.url && typeof attachment.url === 'object') {
      try {
        const raw = attachment.url as Blob;
        if (raw instanceof Blob || (raw as any) instanceof File) {
          const url = URL.createObjectURL(raw);
          setObjectUrl(url);
          setHasError(false);
          return () => {
            URL.revokeObjectURL(url);
          };
        }
      } catch {
        setHasError(true);
      }
    }
  }, [attachment.url]);

  if (hasError || (!objectUrl && !attachment.url)) {
    return (
      <div
        className="size-20 flex flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/70"
        title={attachment.name}
      >
        <FileImage className="size-6 text-white/40 shrink-0" />
        <span className="text-[10px] font-mono text-white/45 truncate max-w-[64px] text-center">
          {attachment.name || 'image'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={objectUrl || (typeof attachment.url === 'string' ? attachment.url : '')}
      alt="upload"
      onError={() => setHasError(true)}
      className="size-20 object-cover rounded-lg border border-white/10 bg-white/[0.02]"
    />
  );
}

export default function MessageBubble({ message, isLatest, isStreaming, isThinking, onRegenerate }: MessageBubbleProps) {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [shared, setShared] = useState(false);
  const codeBlockCounter = useRef(0);
  codeBlockCounter.current = 0;

  const isUser = message.role === 'user';
  const isRTL = detectDir(message.content) === 'rtl';

  // Visual Attachment Rendering parser for user messages
  const attachmentRegex = /\[Attachment:\s*([^\]]+)\]/g;
  const pastedTextRegex = /\[Pasted text\]\n?/g;
  
  const rawAttachments = isUser ? Array.from(message.content.matchAll(attachmentRegex)).map(m => m[1].trim()) : [];
  const expAttachments = isUser ? (((message as any).experimental_attachments || []) as Array<{ name?: string; url?: string | File | Blob; contentType?: string }>) : [];
  
  const cleanContent = isUser 
    ? message.content.replace(attachmentRegex, '').replace(pastedTextRegex, '').trim()
    : message.content;

  const userImageAttachments: Array<{ name: string; url?: string | File | Blob }> = [];
  const userOtherAttachments: Array<{ name: string; url?: string | File | Blob }> = [];

  expAttachments.forEach(att => {
    const isImg = att.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(att.name || '');
    if (isImg) {
      userImageAttachments.push({ name: att.name || 'image', url: att.url });
    } else {
      userOtherAttachments.push({ name: att.name || 'file', url: att.url });
    }
  });

  rawAttachments.forEach(name => {
    if (!userImageAttachments.some(a => a.name === name) && !userOtherAttachments.some(a => a.name === name)) {
      const isImg = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(name);
      if (isImg) {
        userImageAttachments.push({ name });
      } else {
        userOtherAttachments.push({ name });
      }
    }
  });

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
      className="group relative flex flex-col gap-2 w-full min-w-0"
    >
      {/* Header meta - AI only (Claude style with RTL support) */}
      {!isUser && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="flex items-center gap-2.5 w-full justify-start"
        >
          {/* Animated gradient avatar */}
          <div className="ai-avatar-ring h-7 w-7 rounded-lg p-[1.5px] shrink-0">
            <div className="w-full h-full rounded-[calc(0.5rem-1.5px)] bg-[#1A1C1F] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[#FFFFFF]" />
            </div>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/55 shrink-0">
            VANTRA
          </span>
        </div>
      )}

      {/* Bubble / Panel */}
      <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? (
          <div
            className="w-fit flex flex-col gap-3 ml-auto self-end bg-white/[0.05] border border-white/[0.02] text-white/90 px-5 py-3 rounded-3xl rounded-br-sm shadow-sm backdrop-blur-sm max-w-[80%]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Visual Attachment Rendering */}
            {(userImageAttachments.length > 0 || userOtherAttachments.length > 0) && (
              <div className="flex flex-row flex-wrap gap-2 w-full justify-end">
                {userImageAttachments.map((img, idx) => (
                  <AttachmentThumbnail key={idx} attachment={img} />
                ))}
                {userOtherAttachments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/80"
                  >
                    <FileText className="w-4 h-4 text-white/60 shrink-0" />
                    <span className="truncate max-w-[160px] font-medium">{doc.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Text Content */}
            {cleanContent && (
              <p
                dir={isRTL ? 'rtl' : 'ltr'}
                className={cn(
                  "text-[14.5px] sm:text-[15px] text-white/90 font-normal font-sans antialiased leading-relaxed whitespace-pre-wrap break-words",
                  isRTL ? "text-right" : "text-left"
                )}
              >
                {cleanContent}
              </p>
            )}
          </div>
        ) : (
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-full max-w-full min-w-0 bg-transparent shadow-none border-none pt-0.5"
          >
            {/* Thinking state indicator */}
            {isThinking && (
              <div className="flex items-center gap-2 text-[13.5px] text-white/60 animate-pulse mb-3" role="status">
                <span className="font-sans antialiased text-white/70 font-normal">Thinking…</span>
              </div>
            )}

            <div className={cn(
              "prose prose-invert max-w-none font-sans antialiased text-white/90 text-[15px] font-normal leading-relaxed",
              "prose-p:text-white/90 prose-p:text-[15px] prose-p:font-sans prose-p:antialiased prose-p:leading-relaxed prose-p:font-normal",
              "prose-headings:text-white/90 prose-headings:font-semibold prose-strong:text-white/90 prose-strong:font-semibold",
              "prose-li:text-white/90 prose-li:text-[15px] prose-li:font-sans prose-code:text-white/90",
              isRTL ? "text-right" : "text-left"
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  pre: ({ children }) => <>{children}</>,
                  p: ({ children }) => (
                    <p dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-[15px] font-sans antialiased leading-relaxed font-normal mb-3.5 last:mb-0", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </p>
                  ),
                  span: ({ children }) => (
                    <span className="text-white/90 font-sans antialiased">
                      {children}
                    </span>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white/90 font-semibold font-sans antialiased">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-white/90 italic font-sans antialiased">
                      {children}
                    </em>
                  ),
                  h1: ({ children }) => (
                    <h1 dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-xl font-semibold font-sans antialiased mt-6 mb-3", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-lg font-semibold font-sans antialiased border-b border-white/10 pb-1.5 mt-5 mb-2.5", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-base font-semibold font-sans antialiased mt-4 mb-2", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-sm font-semibold font-sans antialiased mt-3 mb-1.5", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </h4>
                  ),
                  ul: ({ children }) => (
                    <ul dir={isRTL ? 'rtl' : 'ltr'} className="my-3 flex flex-col gap-1.5 ps-5 list-disc text-white/90 font-sans antialiased text-[15px] leading-relaxed">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol dir={isRTL ? 'rtl' : 'ltr'} className="my-3 flex flex-col gap-1.5 ps-5 list-decimal text-white/90 font-sans antialiased text-[15px] leading-relaxed">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li dir={isRTL ? 'rtl' : 'auto'} className={cn("text-white/90 text-[15px] font-sans antialiased leading-relaxed font-normal", isRTL ? "text-right" : "text-left")}>
                      {children}
                    </li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote dir={isRTL ? 'rtl' : 'auto'} className={cn("my-4 py-2 px-4 bg-white/[0.03] rounded-r-lg font-sans antialiased text-white/90", isRTL ? "text-right border-r-2 border-white/20" : "text-left border-l-2 border-white/20")}>
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-white/90 underline underline-offset-4 hover:text-white transition-colors font-sans antialiased">
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="my-6 overflow-x-auto custom-scrollbar rounded-xl border border-white/[0.1] bg-[#1A1C1F]" dir="ltr">
                      <table className="w-full text-[14px] font-sans text-white/90 border-collapse min-w-[520px]">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-white/[0.045] font-sans text-white/90">{children}</thead>,
                  th: ({ children }) => (
                    <th dir="auto" className="px-4 py-3.5 text-start font-sans text-[12.5px] font-semibold uppercase tracking-wider text-white/90 border-b border-white/[0.12]">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td dir="auto" className="px-4 py-3.5 align-top font-sans text-white/90 text-[14px] leading-relaxed border-b border-white/[0.05]">
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => <tr className="transition-colors hover:bg-white/[0.02]">{children}</tr>,
                  code: ({ node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    if (isInline) {
                      return <code className="font-mono text-[13px] text-white/90 bg-white/10 px-1.5 py-0.5 rounded border border-white/10" {...props}>{children}</code>;
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

              {/* Streaming Cursor */}
              {showStreamingCursor && (
                <span
                  aria-hidden
                  className="inline-block text-white/90 animate-pulse select-none ms-0.5 align-baseline font-mono text-[14px]"
                >
                  ▮
                </span>
              )}
            </div>

            {/* Message-Level Hover Controls */}
            {!isStreaming && (
              <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  title="Copy message"
                  className="size-8 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors cursor-pointer active:scale-90"
                >
                  {copiedMessage ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {isLatest && onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    title="Regenerate response"
                    className="size-8 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors cursor-pointer active:scale-90"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleShare}
                  title="Share"
                  className="size-8 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-white/60 hover:text-white transition-colors cursor-pointer active:scale-90"
                >
                  {shared ? <Check className="h-3.5 w-3.5 text-white" /> : <Share className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
