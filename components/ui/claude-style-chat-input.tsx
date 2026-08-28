"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ArrowUp, Square, X, FileText, Loader2, Check, Archive, Sparkles, Image as ImageIcon, Layers } from "lucide-react";
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
        <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] animate-fade-in transition-all hover:border-[#FFFFFF]/40">
            {isImage ? (
                <div className="w-full h-full relative">
                    <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/25 group-hover:bg-black/0 transition-colors" />
                </div>
            ) : (
                <div className="w-full h-full p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white/[0.06] rounded">
                            <FileText className="w-4 h-4 text-[#FFFFFF]/80" />
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
                    <Loader2 className="w-5 h-5 text-[#FFFFFF] animate-spin" />
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
export const ModelSelector: React.FC<{
    models: ChatModelOption[];
    selectedModel: string;
    onSelect: (id: string) => void;
    onSignInClick?: () => void;
    dropdownPosition?: 'top' | 'bottom';
}> = ({ models, selectedModel, onSelect, onSignInClick, dropdownPosition = 'top' }) => {
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
                "w-full text-left px-3 py-2.5 rounded-xl flex items-start justify-between transition-colors group/item cursor-pointer",
                locked
                    ? "hover:bg-[#FFFFFF]/[0.05]"
                    : "hover:bg-white/[0.06]",
                selectedModel === model.id && "bg-white/[0.05]"
            )}
        >
            <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-[13px] font-semibold truncate",
                        locked ? "text-[#FFFFFF]/90" : "text-white/95"
                    )}>
                        {model.name}
                    </span>
                    {model.badge && (
                        <span className={cn(
                            "px-1.5 py-[1px] rounded-full text-[9px] font-semibold border shrink-0",
                            model.isFree
                                ? "border-[#FFFFFF]/25 text-[#FFFFFF]/90 bg-[#FFFFFF]/[0.06]"
                                : "border-[#FFFFFF]/30 text-[#FFFFFF]/90 bg-[#FFFFFF]/[0.07]"
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
                <Check className="w-4 h-4 text-[#FFFFFF] mt-1 shrink-0" />
            ) : locked ? (
                <svg className="w-3.5 h-3.5 text-[#FFFFFF]/50 mt-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    "inline-flex items-center relative shrink-0 transition-all duration-200 h-8 rounded-lg px-2.5 active:scale-[0.98] whitespace-nowrap text-xs gap-1.5 cursor-pointer max-w-[200px] border border-white/[0.08] hover:border-white/[0.15] bg-white/[0.03]",
                    isOpen
                        ? "bg-white/[0.08] border-white/[0.2] text-white"
                        : "text-white/70 hover:text-white"
                )}
            >
                {!currentModel?.isFree && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] shrink-0" />
                )}
                <span className="font-medium select-none truncate">{currentModel?.name ?? "Model"}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className={cn(
                    "absolute right-0 w-[290px] glass-pop rounded-2xl overflow-hidden z-50 flex flex-col p-1.5 animate-fade-in max-h-[420px] overflow-y-auto custom-scrollbar-thin border border-white/10 bg-[#0F1012]/95 shadow-2xl backdrop-blur-xl",
                    dropdownPosition === 'top'
                        ? "bottom-full mb-2 origin-bottom-right"
                        : "top-full mt-2 origin-top-right"
                )}>
                    <div className="px-3 pt-2 pb-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-white/30 flex items-center justify-between">
                        <span>Free models</span>
                        <span className="text-[#FFFFFF]/60">0 pts</span>
                    </div>
                    {freeModels.map(m => renderItem(m, false))}

                    {premiumModels.length > 0 && (
                        <>
                            <div className="h-px bg-white/[0.07] my-1.5 mx-2" />
                            <div className="px-3 pb-1.5 text-[9px] font-mono uppercase tracking-[0.22em] text-[#FFFFFF]/50 flex items-center justify-between">
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
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mediaRecorderRef = useRef<any>(null);
    const chunksRef = useRef<Blob[]>([]);

    const voiceStatusError = (msg: string) => {
        setVoiceError(msg);
        setTimeout(() => setVoiceError(null), 3500);
    };

    const toggleVoice = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            return;
        }
        if (isTranscribing) return;
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            voiceStatusError('Voice input is not supported in this browser');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                setIsRecording(false);

                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                if (blob.size < 2048) {
                    voiceStatusError('Recording too short — hold the mic longer');
                    return;
                }

                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append('audio', blob, 'recording.webm');
                    const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || 'Transcription failed');
                    const text = (data.text || '').trim();
                    if (text) setMessage((prev) => (prev ? prev + ' ' : '') + text);
                    else voiceStatusError('No speech detected');
                } catch (err: any) {
                    voiceStatusError(err?.message || 'Transcription failed');
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.onerror = () => {
                stream.getTracks().forEach((t) => t.stop());
                setIsRecording(false);
                voiceStatusError('Recording error — please try again');
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setVoiceError(null);
        } catch {
            voiceStatusError('Microphone access denied');
        }
    };

    const [multimodalMenuOpen, setMultimodalMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    // Click outside listener for multimodal dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMultimodalMenuOpen(false);
            }
        };
        if (multimodalMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [multimodalMenuOpen]);

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + "px";
        }
    }, [message]);

    // Revoke blob object URLs whenever the attachment list changes or on unmount,
    // preventing browser memory leaks from accumulated preview blobs.
    useEffect(() => {
        return () => {
            files.forEach((f) => {
                if (f.preview) URL.revokeObjectURL(f.preview);
            });
        };
    }, [files]);

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
            className={cn("relative w-full transition-all duration-300", className)}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Single refined outer container */}
            <div className="w-full rounded-2xl border border-white/[0.08] hover:border-white/[0.15] focus-within:border-white/[0.25] bg-[#111216]/90 focus-within:bg-[#15161A]/90 shadow-2xl backdrop-blur-xl flex flex-col justify-between min-h-[104px] max-h-[360px] p-3 transition-all duration-200 ease-in-out">

                {/* Attachments above input */}
                {(files.length > 0 || pastedContent.length > 0) && (
                    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 px-1">
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
                <div className="relative flex-1 min-h-[44px] flex items-center" dir="auto">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        dir="auto"
                        autoFocus={autoFocus}
                        className="w-full bg-transparent border-0 outline-none text-white text-[15px] sm:text-[16px] placeholder:text-white/30 resize-none overflow-y-auto custom-scrollbar-thin leading-relaxed block antialiased px-3 py-1.5"
                        rows={1}
                        style={{ minHeight: '2.4em', maxHeight: '240px' }}
                    />
                </div>

                {/* Action bar — bottom padding lifts buttons off the edge */}
                <div className="flex gap-2 w-full items-center px-1 pt-1">
                    {/* Left tools */}
                    <div className="relative flex-1 flex items-center shrink min-w-0 gap-1 ps-1">
                        {/* Multimodal Dropdown Menu */}
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setMultimodalMenuOpen(!multimodalMenuOpen)}
                                className={cn(
                                    "inline-flex items-center justify-center shrink-0 transition-colors duration-200 h-8 w-8 rounded-lg active:scale-95 cursor-pointer",
                                    multimodalMenuOpen
                                        ? "bg-white/10 text-white"
                                        : "text-white/40 hover:text-white hover:bg-white/[0.07]"
                                )}
                                aria-label="Multimodal attachments"
                                aria-expanded={multimodalMenuOpen}
                            >
                                <Plus className={cn("w-5 h-5 transition-transform duration-150", multimodalMenuOpen && "rotate-45")} />
                            </button>

                            {multimodalMenuOpen && (
                                <div
                                    className="absolute bottom-full left-0 mb-2 w-52 bg-[#0F1012] border border-white/[0.08] shadow-2xl rounded-lg p-1 text-sm text-white/80 z-50 flex flex-col gap-0.5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMultimodalMenuOpen(false);
                                            imageInputRef.current?.click();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.06] text-white transition-colors text-start cursor-pointer"
                                    >
                                        <ImageIcon className="w-4 h-4 text-white/60 shrink-0" />
                                        <span>Upload Image</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMultimodalMenuOpen(false);
                                            docInputRef.current?.click();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.06] text-white transition-colors text-start cursor-pointer"
                                    >
                                        <FileText className="w-4 h-4 text-white/60 shrink-0" />
                                        <span>Upload Document</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMultimodalMenuOpen(false);
                                            setMessage((prev) => (prev ? prev + ' ' : '') + '@integration: ');
                                            textareaRef.current?.focus();
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.06] text-white transition-colors text-start cursor-pointer"
                                    >
                                        <Layers className="w-4 h-4 text-white/60 shrink-0" />
                                        <span>Connect Integration</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                                className={cn(
                                    "relative transition-all duration-200 h-8 w-8 flex items-center justify-center rounded-lg active:scale-95 cursor-pointer",
                                    isThinkingEnabled
                                        ? 'text-[#FFFFFF] bg-[#FFFFFF]/[0.1]'
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

                        {/* Voice input — Groq Whisper via /api/transcribe */}
                        <div className="flex shrink-0 items-center gap-1">
                            {voiceError && (
                                <span className="text-[10.5px] text-red-400/90 max-w-[140px] truncate animate-fade-in" role="status">
                                    {voiceError}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={toggleVoice}
                                disabled={isTranscribing}
                                className={cn(
                                    "relative transition-all duration-200 h-8 w-8 flex items-center justify-center rounded-lg active:scale-95 cursor-pointer disabled:cursor-wait",
                                    isRecording
                                        ? 'bg-white text-black animate-pulse'
                                        : 'text-white/40 hover:text-white hover:bg-white/[0.07]',
                                    isTranscribing && 'opacity-70'
                                )}
                                aria-label={isRecording ? 'Stop recording' : 'Voice input'}
                            >
                                {isTranscribing ? (
                                    <Loader2 className="w-[18px] h-[18px] animate-spin text-white" />
                                ) : (
                                    <MicIcon className="w-[18px] h-[18px]" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Right tools — extra space from the right edge */}
                    <div className="flex flex-row items-center shrink-0 gap-1.5 pe-1">
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
                                className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-white text-black hover:bg-white/90 active:scale-95 transition-all cursor-pointer shadow-sm"
                                aria-label="Stop generating"
                            >
                                <Square className="w-3.5 h-3.5 fill-current" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={!hasContent}
                                className={cn(
                                    "inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-lg transition-all duration-200 active:scale-95",
                                    hasContent
                                        ? 'bg-white text-black hover:bg-white/90 cursor-pointer opacity-100 shadow-sm'
                                        : 'bg-white text-black cursor-not-allowed opacity-30'
                                )}
                                aria-label="Send message"
                            >
                                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-[#1A1C1F]/90 border-2 border-dashed border-[#FFFFFF]/60 rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                    <Archive className="w-10 h-10 text-[#FFFFFF] mb-2 animate-bounce" />
                    <p className="text-[#FFFFFF] font-medium text-sm">Drop files to upload</p>
                </div>
            )}

            {/* Hidden file inputs */}
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
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.py,.ts,.tsx,.js,.jsx,.yaml,.yml"
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