'use client';

import React, { useRef, useState } from 'react';
import { ChevronDown, ImageIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:2'] as const;

export default function ImageCanvas() {
    const [prompt, setPrompt] = useState('');
    const [aspect, setAspect] = useState<(typeof ASPECT_RATIOS)[number]>('1:1');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow: slim when empty, grows while typing
    const autoGrow = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 220) + 'px';
    };

    return (
        <div className="absolute inset-0 flex flex-col">
            {/* ── Central immersive canvas ── */}
            <div className="flex-1 min-h-0 px-4 pt-6 pb-2 flex items-center justify-center">
                <div className="relative w-full h-full max-w-4xl mx-auto rounded-3xl border border-white/[0.07] bg-[#1A1C20]/60 backdrop-blur-sm overflow-hidden flex items-center justify-center">
                    {/* faint corner glows */}
                    <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#FFFFFF]/[0.05] blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-[#FFFFFF]/[0.04] blur-3xl pointer-events-none" />

                    {/* Elegant empty placeholder */}
                    <div className="flex flex-col items-center text-center select-none">
                        <div className="h-16 w-16 rounded-2xl border border-white/[0.07] bg-white/[0.025] flex items-center justify-center">
                            <ImageIcon className="h-7 w-7 text-white/15" />
                        </div>
                        <p className="mt-5 text-[15px] font-medium text-white/35">Canvas is ready</p>
                        <p className="mt-1.5 text-xs text-white/20">
                            Describe an image below, choose a ratio, and press Generate.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Bottom floating prompter ── */}
            <div className="shrink-0 px-4 pb-4 pt-2">
                <div className="max-w-3xl mx-auto w-full lux-input-shell">
                    <div className="claude-glass-inner rounded-[25px] flex flex-col px-5 pt-3 pb-3 gap-2">
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => { setPrompt(e.target.value); autoGrow(); }}
                            placeholder="Describe the image you want to create…"
                            dir="auto"
                            rows={2}
                            className="w-full bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-white/30 resize-none overflow-y-auto custom-scrollbar-thin leading-relaxed block antialiased"
                            style={{ minHeight: '3em', padding: '6px 4px 2px' }}
                        />

                        <div className="flex items-center gap-2 px-1 pb-1">
                            {/* Aspect ratio dropdown */}
                            <div className="relative shrink-0">
                                <select
                                    value={aspect}
                                    onChange={(e) => setAspect(e.target.value as (typeof ASPECT_RATIOS)[number])}
                                    aria-label="Aspect ratio"
                                    className="appearance-none h-8 ps-3 pe-7 rounded-lg bg-white/[0.05] border border-white/10 text-[12px] font-medium text-white/85 outline-none cursor-pointer hover:bg-white/[0.08] transition-colors focus:border-[#FFFFFF]/50"
                                >
                                    {ASPECT_RATIOS.map((r) => (
                                        <option key={r} value={r} className="bg-[#1A1C20] text-white">
                                            {r}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
                            </div>

                            <span className="text-[11px] font-mono text-white/25 hidden sm:inline">
                                {prompt.trim().length > 0 ? `${aspect} · ready` : aspect}
                            </span>

                            <div className="flex-1" />

                            {/* Generate */}
                            <button
                                type="button"
                                title="Generation engine — wiring next"
                                className={cn(
                                    'inline-flex items-center gap-2 h-9 px-5 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-[0.97]',
                                    prompt.trim()
                                        ? 'bg-[#FFFFFF] text-black cursor-pointer'
                                        : 'bg-white/[0.14] text-white/60 border border-white/[0.18] cursor-default'
                                )}
                            >
                                <Sparkles className="h-4 w-4" />
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
