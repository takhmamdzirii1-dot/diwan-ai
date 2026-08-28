"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Terminal } from 'lucide-react'

export interface TypewriterProps {
  words: string[]
  speed?: number
  delayBetweenWords?: number
  cursor?: boolean
  cursorChar?: string
  loop?: boolean
  asMarkdown?: boolean
}

export function Typewriter({
  words,
  speed = 100,
  delayBetweenWords = 2000,
  cursor = true,
  cursorChar = "|",
  loop = true,
  asMarkdown = false,
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [wordIndex, setWordIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  const currentWord = words[wordIndex] || ""

  useEffect(() => {
    if (!currentWord) return;
    
    const timeout = setTimeout(
      () => {
        // Typing logic
        if (!isDeleting) {
          if (charIndex < currentWord.length) {
            setDisplayText(currentWord.substring(0, charIndex + 1))
            setCharIndex(charIndex + 1)
          } else {
            // Word is complete
            if (loop) {
              setTimeout(() => {
                setIsDeleting(true)
              }, delayBetweenWords)
            }
          }
        } else {
          // Deleting logic
          if (charIndex > 0) {
            setDisplayText(currentWord.substring(0, charIndex - 1))
            setCharIndex(charIndex - 1)
          } else {
            // Word is deleted, move to next word
            setIsDeleting(false)
            setWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      },
      isDeleting ? speed / 2 : speed,
    )

    return () => clearTimeout(timeout)
  }, [charIndex, currentWord, isDeleting, speed, delayBetweenWords, wordIndex, words, loop])

  // Cursor blinking effect
  useEffect(() => {
    if (!cursor) return

    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)

    return () => clearInterval(cursorInterval)
  }, [cursor])

  if (asMarkdown) {
    return (
      <div className="inline-block w-full">
        <div className="prose prose-invert prose-p:leading-[1.7] prose-pre:bg-[#050506] prose-pre:border prose-pre:border-white/10 max-w-none" dir="auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => <a {...props} className="text-[#FFFFFF] hover:underline" target="_blank" rel="noopener noreferrer" />,
              p: ({ node, children, ...props }) => <p className="mb-3 last:mb-0 text-white/90 inline" {...props}>{children}</p>,
              strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 text-white/90 marker:text-[#FFFFFF]" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 text-white/90 marker:text-[#FFFFFF]" {...props} />,
              li: ({ node, ...props }) => <li className="mb-1" {...props} />,
              h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-base font-bold text-white mt-3 mb-2" {...props} />,
              table: ({ node, ...props }) => <div className="overflow-x-auto mb-4 rounded-xl border border-white/10"><table className="w-full text-left text-sm text-white/80" {...props} /></div>,
              th: ({ node, ...props }) => <th className="bg-[#050608] px-4 py-2 font-bold text-white border-b border-white/10" {...props} />,
              td: ({ node, ...props }) => <td className="bg-[#0A0B0E] px-4 py-2 border-b border-white/5" {...props} />,
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = inline || !match;
                if (isInline) {
                  return <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-[#FFFFFF] border border-white/[0.06]" {...props}>{children}</code>;
                }
                const lang = match ? match[1] : '';
                return (
                  <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#050506] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0A0B0E] px-4 py-2 text-xs text-[#94A3B8]">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-[#FFFFFF]">
                        <Terminal className="h-3.5 w-3.5" />
                        <span>{lang || 'code'}</span>
                      </div>
                    </div>
                    <div className="p-4 overflow-x-auto custom-scrollbar">
                      <pre className="!bg-transparent !p-0 !m-0 text-[13px] leading-relaxed text-[#E2E8F0]">
                        <code className={className} {...props}>{children}</code>
                      </pre>
                    </div>
                  </div>
                );
              }
            }}
          >
            {displayText}
          </ReactMarkdown>
          {cursor && charIndex < currentWord.length && (
            <span className="ml-1 transition-opacity duration-75 inline-block w-2 h-4 bg-[#FFFFFF] align-middle translate-y-[-2px]" style={{ opacity: showCursor ? 1 : 0 }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="inline-block">
      <span>
        {displayText}
        {cursor && (
          <span className="ml-1 transition-opacity duration-75" style={{ opacity: showCursor ? 1 : 0 }}>
            {cursorChar}
          </span>
        )}
      </span>
    </div>
  )
}
