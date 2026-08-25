"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    ArrowUpIcon,
    Paperclip,
    Square,
    Loader2,
    ChevronDown,
    Sparkles,
} from "lucide-react";

/* ------------------------------------------------------------------
   VANTRA luxury adaptation of the v0 chat composer.
   Champagne + teal glow, breathing light, glass pills.
   ------------------------------------------------------------------ */

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                textarea.scrollTop = 0;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );
            textarea.style.height = `${newHeight}px`;

            // If all content fits, snap back to top so text never stays clipped
            if (textarea.scrollHeight <= textarea.clientHeight + 2) {
                textarea.scrollTop = 0;
            }
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export interface ChatModelOption {
    id: string;
    name: string;
    provider?: string;
    cost?: number;
    isFree?: boolean;
}

export interface ComposerAction {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

export interface V0AIChatProps {
    /** Heading above the box. Pass null to hide (mid-conversation). */
    title?: string | null;
    subtitle?: string | null;
    /** Optional node rendered above the title (e.g. brand badge). */
    header?: React.ReactNode;
    placeholder?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    onSendMessage?: (message: string) => void | Promise<void>;
    isLoading?: boolean;
    onStop?: () => void;
    disabled?: boolean;
    models?: ChatModelOption[];
    selectedModelId?: string;
    onSelectModel?: (id: string) => void;
    actions?: ComposerAction[];
    className?: string;
}

export function VercelV0Chat(props: V0AIChatProps) {
    const {
        title = null,
        subtitle = null,
        header = null,
        placeholder = "Ask anything...",
        value: controlledValue,
        onValueChange,
        onSendMessage,
        isLoading = false,
        onStop,
        disabled = false,
        models = [],
        selectedModelId,
        onSelectModel,
        actions = [],
        className,
    } = props;

    const [internalValue, setInternalValue] = useState("");
    const value = controlledValue ?? internalValue;
    const setValue = (v: string) => {
        setInternalValue(v);
        onValueChange?.(v);
    };

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    const [modelOpen, setModelOpen] = useState(false);
    const modelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
                setModelOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const currentModel =
        models.find((m) => m.id === selectedModelId) || models[0];

    const submit = () => {
        const text = value.trim();
        if (!text || isLoading || disabled) return;
        setValue("");
        adjustHeight(true);
        onSendMessage?.(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            submit();
        }
    };

    const hasText = !!value.trim();

    return (
        <div className={cn("flex flex-col items-center w-full max-w-[700px] mx-auto", className)}>
            {/* ── Header ── */}
            {(header || title) && (
                <div className="flex flex-col items-center text-center mb-8">
                    {header}
                    {title && (
                        <h1 className="lux-metallic-title text-[clamp(30px,5vw,44px)]">
                            {title}
                        </h1>
                    )}
                    {subtitle && <p className="lux-welcome-sub mt-4">{subtitle}</p>}
                </div>
            )}

            {/* ── Composer with soft breathing glow ── */}
            <div className="relative w-full">
                {/* light effects — very subtle, slow */}
                <div
                    aria-hidden
                    className="lux-orb lux-orb-teal"
                    style={{ top: "-46px", left: "12%", width: 260, height: 200 }}
                />
                <div
                    aria-hidden
                    className="lux-orb lux-orb-gold"
                    style={{ bottom: "-40px", right: "10%", width: 220, height: 180 }}
                />

                <div className="lux-input-shell relative">
                    <div className="lux-input-shell-inner">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => {
                                // never allow stale scroll offsets to clip text
                                const el = e.currentTarget;
                                if (el.scrollHeight <= el.clientHeight + 2) el.scrollTop = 0;
                            }}
                            placeholder={placeholder}
                            dir="auto"
                            rows={1}
                            className={cn(
                                "block w-full px-5 pt-4 pb-2",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-[15px] leading-relaxed",
                                "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-white/30",
                                "min-h-[60px]",
                                "overflow-y-auto custom-scrollbar"
                            )}
                            style={{ overflowX: "hidden" }}
                        />

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-3.5 pb-3 pt-1 gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                                {/* Attach */}
                                <button
                                    type="button"
                                    onClick={() => {/* wire via prop later */}}
                                    className="group p-2 hover:bg-white/[0.06] rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Paperclip className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                                </button>

                                {/* Model selector */}
                                {models.length > 0 && (
                                    <div className="relative" ref={modelRef}>
                                        <button
                                            type="button"
                                            onClick={() => setModelOpen((o) => !o)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/15 hover:border-[#E6C27A]/40 hover:bg-white/[0.04] text-xs text-white/60 hover:text-white/90 transition-all cursor-pointer max-w-[190px]"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-[#E6C27A]/80 shrink-0" />
                                            <span className="truncate">{currentModel?.name ?? "Model"}</span>
                                            <ChevronDown className={cn(
                                                "w-3 h-3 opacity-60 shrink-0 transition-transform duration-200",
                                                modelOpen && "rotate-180"
                                            )} />
                                        </button>

                                        {modelOpen && (
                                            <div className="absolute left-0 bottom-full mb-2 w-64 rounded-xl border border-white/[0.1] bg-[#212326]/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                <div className="px-3 py-2 text-[9px] font-mono uppercase tracking-[0.22em] text-white/35 border-b border-white/[0.06] mb-1 flex items-center justify-between">
                                                    <span>Select model</span>
                                                    <span className="text-[#E6C27A]/70">pts</span>
                                                </div>
                                                <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
                                                    {models.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            onClick={() => {
                                                                onSelectModel?.(m.id);
                                                                setModelOpen(false);
                                                            }}
                                                            className={cn(
                                                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer",
                                                                selectedModelId === m.id
                                                                    ? "bg-[#E6C27A]/10 text-white ring-1 ring-inset ring-[#E6C27A]/25"
                                                                    : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                                                            )}
                                                        >
                                                            <span className="text-xs font-medium truncate">{m.name}</span>
                                                            <span className={cn(
                                                                "text-[10px] font-mono shrink-0 ms-3",
                                                                m.isFree ? "text-[#E6C27A]/85" : "text-white/30"
                                                            )}>
                                                                {m.cost ?? 0}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Send / Stop */}
                            <div className="flex items-center gap-2 shrink-0">
                                {isLoading && onStop ? (
                                    <button
                                        type="button"
                                        onClick={onStop}
                                        className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                        <Square className="w-3.5 h-3.5 fill-current" />
                                        <span className="sr-only">Stop</span>
                                    </button>
                                ) : isLoading ? (
                                    <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 text-[#E6C27A] animate-spin" />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={submit}
                                        disabled={!hasText || disabled}
                                        className={cn(
                                            "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer",
                                            hasText && !disabled
                                                ? "bg-gradient-to-br from-[#E6C27A] to-[#F0DCAB] text-[#050506] shadow-[0_0_24px_-4px_rgba(230,194,122,0.55)] hover:shadow-[0_0_32px_-2px_rgba(230,194,122,0.7)] hover:-translate-y-0.5 ring-1 ring-transparent hover:ring-[#E6C27A]/45"
                                                : "bg-white/[0.05] text-white/30"
                                        )}
                                    >
                                        <ArrowUpIcon className={cn(
                                            "w-4 h-4 transition-transform duration-300",
                                            hasText && "translate-y-[-0.5px]"
                                        )} />
                                        <span className="sr-only">Send</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Glass action pills ── */}
            {actions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
                    {actions.map((action, i) => (
                        <button
                            key={`${action.label}-${i}`}
                            type="button"
                            onClick={action.onClick}
                            className="group flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#E6C27A]/30 text-white/50 hover:text-white/90 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(230,194,122,0.4)] cursor-pointer"
                        >
                            <span className="text-sm leading-none">{action.icon}</span>
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default VercelV0Chat;
