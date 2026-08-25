"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ArrowUp, X, FileText, Loader2, Check, Archive, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   VANTRA glass adaptation of the Claude chat composer.
   ------------------------------------------------------------------ */

export interface AttachedFile {
    id: string;
    file: File;
    type: string;
    preview: string | null;
    uploadStatus: string;
}

export interface ChatModelOption {
    id: string;
    name: string;
    description?: string;
    badge?: string;
    isFree?: boolean;
    requiresAuth?: boolean;
}

export interface ClaudeSendPayload {
    message: string;
    files: AttachedFile[];
    pastedContent: { id: string; content: string }[];
    model: string;
    isThinkingEnabled: boolean;
}

export interface ClaudeChatInputProps {
    onSendMessage: (data: ClaudeSendPayload) => void | Promise<void>;
    models?: ChatModelOption[];
    selectedModelId?: string;
    onSelectModel?: (id: string) => void;
    isLoading?: boolean;
    onStop?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
    onSignInClick?: () => void;
    className?: string;
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/* --- File Preview Card --- */
const FilePreviewCard: React.FC<{ file: AttachedFile; onRemove: (id: string) => void }> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith("image/") && file.preview;

    return (
        <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] animate-fade-in transition-all hover:border-[#E6C27A]/40">
            {isImage ? (
                <div className="w-full h-full relative">
                    <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/0 transition-colors" />
                </div>
            ) : (
                <div className="w-full h-full p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/[0.06] rounded">
                            <FileText className="w-4 h-4 text-[#E6C27A]/80" />
                        </div>
                        <span className="text-[10px] font-medium text-white/45 uppercase tracking-wider truncate">
                            {file.file.name.split('.').pop()}
                        </span>
                    </div>
                    <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-medium text-white/85 truncate" title={file.file.name}>
                            {file.file.name}
                        </p>
                        <p className="text-[10px] text-white/40">
                            {formatFileSize(file.file.size)}
                        </p>
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => onRemove(file.id)}
                className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
                <X className="w-3 h-3" />
            </button>

            {file.uploadStatus === "pending" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-[#E6C27A] animate-spin" />
                </div>
            )}
        </div>
    );
};

/* --- Pasted Content Card --- */
const PastedContentCard: React.FC<{ content: { id: string; content: string }; onRemove: (id: string) => void }> = ({ content, onRemove }) => {
    return (
        <div className="relative group flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] animate-fade-in p-3 flex flex-col justify-between">
            <div className="overflow-hidden w-full">
                <p className="text-[10px] text-white/40 leading-[1.4] font-mono break-words whitespace-pre-wrap line-clamp-4 select-none">
                    {content.content}
                </p>
            </div>

            <div className="flex items-center justify-between w-full mt-2">
                <span className="inline-flex items-center px-1.5 py-[2px] rounded border border-white/15 text-[9px] font-bold text-white/50 uppercase tracking-wider">
                    PASTED
                </span>
            </div>

            <button
                type="button"
                onClick={() => onRemove(content.id)}
                className="absolute top-2 right-2 p-[3px] bg-black/60 rounded-full text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            >
                <X className="w-2.5 h-2.5" />
            </button>
        </div>
    );
};

/* --- Model Selector (Claude-style, glass, grouped) --- */
const ModelSelector: React.FC<{
    models: ChatModelOption[];
    selectedModel: string;
    onSelect: (id: string) => void;
    onSignInClick?: () => void;
}> = ({ models, selectedModel, onSelect, onSignInClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentModel = models.find(m => m.id === selectedModel) || models[0];
    const freeModels = models.filter(m => m.isFree);
    const premiumModels = models.filter(m => !m.isFree);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handlePick = (model: ChatModelOption) => {
        if (model.requiresAuth && onSignInClick) {
            setIsOpen(false);
            onSignInClick();
            return;
        }
        onSelect(model.id);
        setIsOpen(false);
    };

    const renderItem = (model: ChatModelOption, locked: boolean) => (
        <button
            key={model.id}
            type="button"
            onClick={() => handlePick(model)}
            className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between transition-colors group/item",
                locked
                    ? "hover:bg-[#E6C27A]/[0.05]"
                    : "hover:bg-white/[0.06]",
                selectedModel === model.id && "bg-white/[0.05]"
            )}
        >
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[13px] font-semibold truncate",
                        locked ? "text-[#E6C27A]/90" : "text-white/95"
                    )}>
                        {model.name}
                    </span>
                    {model.badge && (
                        <span className={cn(
                            "px-1.5 py-[1px] rounded-full text-[9px] font-semibold border shrink-0",
                            model.isFree
                                ? "border-[#E6C27A]/25 text-[#E6C27A]/90 bg-[#E6C27A]/[0.06]"
                                : "border-[#E6C27A]/30 text-[#E6C27A]/90 bg-[#E6C27A]/[0.07]"
                        )}>
                            {locked ? "PRO" : model.badge}
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-white/40 truncate">
                    {locked ? "Sign in to unlock" : model.description}
                </span>
            </div>
            {selectedModel === model.id ? (
                <Check className="w-4 h-4 text-[#E6C27A] mt-1 shrink-0" />
            ) : locked ? (
                <svg className="w-3.5 h-3.5 text-[#E6C27A]/50 mt-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            ) : null}
        </button>
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "inline-flex items-center relative shrink-0 transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)] h-8 rounded-xl px-2.5 active:scale-[0.98] whitespace-nowrap text-xs gap-1 cursor-pointer max-w-[200px]",
                    isOpen
                        ? "bg-white/[0.08] text-white"
                        : "text-white/55 hover:text-white hover:bg-white/[0.06]"
                )}
            >
                {!currentModel?.isFree && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E6C27A] shadow-[0_0_6px_rgba(230,194,122,0.7)] shrink-0" />
                )}
                <span className="font-medium select-none truncate">{currentModel?.name ?? "Model"}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 opacity-70 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-[290px] glass-pop rounded-2xl overflow-hidden z-50 flex flex-col p-1.5 animate-fade-in origin-bottom-right max-h-[420px] overflow-y-auto custom-scrollbar-thin">
                    <div className="px-3 pt-2 pb-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-white/30 flex items-center justify-between">
                        <span>Free models</span>
                        <span className="text-[#E6C27A]/60">0 pts</span>
                    </div>
                    {freeModels.map(m => renderItem(m, false))}

                    {premiumModels.length > 0 && (
                        <>
                            <div className="h-px bg-white/[0.07] my-1.5 mx-2" />
                            <div className="px-3 pb-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-[#E6C27A]/50 flex items-center justify-between">
                                <span>Premium · Sign in</span>
                                <Sparkles className="h-3 w-3" />
                            </div>
                            {premiumModels.map(m => renderItem(m, !!(m.requiresAuth && onSignInClick)))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

/* --- Main Composer --- */
export const ClaudeChatInput: React.FC<ClaudeChatInputProps> = ({
    onSendMessage,
    models = [],
    selectedModelId,
    onSelectModel,
    isLoading = false,
    onStop,
    placeholder = "How can I help you today?",
    autoFocus = false,
    onSignInClick,
    className,
}) => {
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [pastedContent, setPastedContent] = useState<{ id: string; content: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.lang = document.documentElement.lang === 'ar' ? 'ar-DZ' : 'en-US';
        rec.interimResults = true;
        rec.continuous = false;
        rec.onresult = (e: any) => {
            const transcript = Array.from(e.results as any[])
                .map((r) => r[0].transcript as string)
                .join(' ');
            setMessage((prev) => (prev ? prev + ' ' : '') + transcript);
        };
        rec.onend = () => setIsListening(false);
        rec.onerror = () => setIsListening(false);
        recognitionRef.current = rec;
        rec.start();
        setIsListening(true);
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 384) + "px";
        }
    }, [message]);

    const handleFiles = useCallback((newFilesList: FileList | File[]) => {
        const newFiles: AttachedFile[] = Array.from(newFilesList).map(file => {
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
            return {
                id: Math.random().toString(36).slice(2, 11),
                file,
                type: isImage ? 'image/unknown' : (file.type || 'application/octet-stream'),
                preview: isImage ? URL.createObjectURL(file) : null,
                uploadStatus: 'pending'
            };
        });

        setFiles(prev => [...prev, ...newFiles]);

        setMessage(prev => {
            if (prev) return prev;
            if (newFiles.length === 1) {
                return newFiles[0].type.startsWith('image/') ? "Analyzed image..." : "Analyzed document...";
            }
            return `Analyzed ${newFiles.length} files...`;
        });

        newFiles.forEach(f => {
            setTimeout(() => {
                setFiles(prev => prev.map(p => p.id === f.id ? { ...p, uploadStatus: 'complete' } : p));
            }, 700 + Math.random() * 800);
        });
    }, []);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) pastedFiles.push(file);
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            handleFiles(pastedFiles);
            return;
        }

        const text = e.clipboardData.getData('text');
        if (text.length > 300) {
            e.preventDefault();
            setPastedContent(prev => [...prev, {
                id: Math.random().toString(36).slice(2, 11),
                content: text
            }]);
            if (!message) setMessage("Analyzed pasted text...");
        }
    };

    const handleSend = () => {
        if (isLoading) {
            onStop?.();
            return;
        }
        if (!message.trim() && files.length === 0 && pastedContent.length === 0) return;

        const textWithAttachments = [
            ...pastedContent.map(p => `[Pasted text]\n${p.content}`),
            ...files.map(f => `[Attachment: ${f.file.name}]`),
            message.trim()
        ].filter(Boolean).join('\n\n');

        onSendMessage({
            message: textWithAttachments,
            files,
            pastedContent,
            model: selectedModelId || models[0]?.id || "",
            isThinkingEnabled
        });
        setMessage("");
        setFiles([]);
        setPastedContent([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if ((e.nativeEvent as KeyboardEvent).isComposing) return;
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = !!(message.trim() || files.length > 0 || pastedContent.length > 0);

    return (
        <div
            className={cn("relative w-full max-w-[700px] mx-auto transition-all duration-300", className)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Glass box with luxury gradient frame */}
            <div className="lux-input-shell">
                <div className="claude-glass-inner rounded-[25px] flex flex-col px-5 pt-4 pb-3 gap-2.5">

                    {/* Attachments above input */}
                    {(files.length > 0 || pastedContent.length > 0) && (
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-1 px-1">
                            {pastedContent.map(content => (
                                <PastedContentCard
                                    key={content.id}
                                    content={content}
                                    onRemove={id => setPastedContent(prev => prev.filter(c => c.id !== id))}
                                />
                            ))}
                            {files.map(file => (
                                <FilePreviewCard
                                    key={file.id}
                                    file={file}
                                    onRemove={id => setFiles(prev => prev.filter(f => f.id !== id))}
                                />
                            ))}
                        </div>
                    )}

                    {/* Input area */}
                    <div className="relative mb-1" dir="auto">
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            dir="auto"
                            autoFocus={autoFocus}
                            className="w-full bg-transparent border-0 outline-none text-white text-[16px] placeholder:text-white/30 resize-none overflow-y-auto custom-scrollbar-thin leading-relaxed block antialiased"
                            rows={1}
                            style={{ minHeight: '2.4em', padding: '20px 24px 12px 24px' }}
                        />
                    </div>

                    {/* Action bar */}
                    <div className="flex gap-2 w-full items-center">
                        {/* Left tools */}
                        <div className="relative flex-1 flex items-center shrink min-w-0 gap-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center justify-center shrink-0 transition-colors duration-200 h-8 w-8 rounded-lg active:scale-95 text-white/40 hover:text-white hover:bg-white/[0.07] cursor-pointer"
                                aria-label="Attach files"
                            >
                                <Plus className="w-5 h-5" />
                            </button>

                            <div className="flex shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                                    className={cn(
                                        "relative transition-all duration-200 h-8 w-8 flex items-center justify-center rounded-lg active:scale-95 cursor-pointer",
                                        isThinkingEnabled
                                            ? 'text-[#E6C27A] bg-[#E6C27A]/[0.1] shadow-[0_0_18px_-4px_rgba(230,194,122,0.4)]'
                                            : 'text-white/40 hover:text-white hover:bg-white/[0.07]'
                                    )}
                                    aria-pressed={isThinkingEnabled}
                                    aria-label="Extended thinking"
                                >
                                    <ClockIcon className="w-5 h-5" />

                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 glass-pop rounded-md text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 flex items-center gap-1.5">
                                        <span className="text-white/85">Extended thinking</span>
                                        <span className="text-white/35" style={{ fontSize: '10px' }}>⇧+Ctrl+E</span>
                                    </div>
                                </button>
                            </div>

                            {/* Voice input */}
                            <div className="flex shrink-0">
                                <button
                                    type="button"
                                    onClick={toggleVoice}
                                    className={cn(
                                        "relative transition-all duration-200 h-8 w-8 flex items-center justify-center rounded-lg active:scale-95 cursor-pointer",
                                        isListening
                                            ? 'text-[#E6C27A] bg-[#E6C27A]/[0.1] shadow-[0_0_18px_-4px_rgba(230,194,122,0.5)]'
                                            : 'text-white/40 hover:text-white hover:bg-white/[0.07]'
                                    )}
                                    aria-label="Voice input"
                                >
                                    <MicIcon className={cn("w-[18px] h-[18px]", isListening && "animate-pulse")} />
                                </button>
                            </div>

                            {/* Token counter */}
                            {message.trim().length > 0 && (
                                <span
                                    className="ms-1 hidden sm:inline-flex items-center h-5 px-2 rounded-md border border-white/[0.08] bg-white/[0.03] text-[10px] font-mono text-white/40 animate-fade-in"
                                    title="Approximate token count"
                                >
                                    ≈{Math.max(1, Math.ceil(message.trim().length / 4))} tok
                                </span>
                            )}
                        </div>

                        {/* Right tools */}
                        <div className="flex flex-row items-center min-w-0 gap-1.5">
                            {models.length > 0 && (
                                <div className="shrink-0">
                                    <ModelSelector
                                        models={models}
                                        selectedModel={selectedModelId || models[0]?.id}
                                        onSelect={(id) => onSelectModel?.(id)}
                                        onSignInClick={onSignInClick}
                                    />
                                </div>
                            )}

                            {isLoading && onStop ? (
                                <button
                                    type="button"
                                    onClick={onStop}
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition-colors active:scale-95 cursor-pointer"
                                    aria-label="Stop"
                                >
                                    <span className="block w-3 h-3 rounded-[3px] bg-current" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={!hasContent}
                                    className={cn(
                                        "inline-flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-300 active:scale-95",
                                        hasContent
                                            ? 'send-ready bg-gradient-to-br from-[#E6C27A] to-[#F0DCAB] text-[#050506] hover:-translate-y-0.5 ring-1 ring-transparent hover:ring-[#E6C27A]/45 cursor-pointer'
                                            : 'bg-white/[0.07] text-white/25 cursor-default'
                                    )}
                                    aria-label="Send message"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-[#1A1C1F]/90 border-2 border-dashed border-[#E6C27A]/60 rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                    <Archive className="w-10 h-10 text-[#E6C27A] mb-2 animate-bounce" />
                    <p className="text-[#E6C27A] font-medium text-sm">Drop files to upload</p>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                }}
            />
        </div>
    );
};

/* Thinking-mode clock icon (from Claude reference) */
const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 9.72386 2.72386 9.5 3 9.5C3.27614 9.5 3.5 9.72386 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977ZM10 5.5C10.2761 5.5 10.5 5.72386 10.5 6V9.69043L13.2236 11.0527C13.4706 11.1762 13.5708 11.4766 13.4473 11.7236C13.3392 11.9397 13.0957 12.0435 12.8711 11.9834L12.7764 11.9473L9.77637 10.4473C9.60698 10.3626 9.5 10.1894 9.5 10V6C9.5 5.72386 9.72386 5.5 10 5.5ZM3.66211 6.94141C4.0273 6.94159 4.32303 7.23735 4.32324 7.60254C4.32324 7.96791 4.02743 8.26446 3.66211 8.26465C3.29663 8.26465 3 7.96802 3 7.60254C3.00021 7.23723 3.29676 6.94141 3.66211 6.94141ZM4.95605 4.29395C5.32146 4.29404 5.61719 4.59063 5.61719 4.95605C5.6171 5.3214 5.3214 5.61709 4.95605 5.61719C4.59063 5.61719 4.29403 5.32146 4.29395 4.95605C4.29395 4.59057 4.59057 4.29395 4.95605 4.29395ZM7.60254 3C7.96802 3 8.26465 3.29663 8.26465 3.66211C8.26446 4.02743 7.96791 4.32324 7.60254 4.32324C7.23736 4.32302 6.94159 4.0273 6.94141 3.66211C6.94141 3.29676 7.23724 3.00022 7.60254 3Z"></path>
    </svg>
);

export default ClaudeChatInput;

/* Mic icon for voice input */
const MicIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
);