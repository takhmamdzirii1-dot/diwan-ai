"use client";

import { useEffect, useRef, useCallback, useTransition, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    ImageIcon,
    Figma,
    MonitorIcon,
    Paperclip,
    SendIcon,
    XIcon,
    LoaderIcon,
    Sparkles,
    Command,
    Zap,
    ChevronDown,
    FileIcon,
    Square
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react"

export interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

export function useAutoResizeTextarea({
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

export interface CommandSuggestion {
    icon: React.ReactNode;
    label: string;
    description: string;
    prefix: string;
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-[#E6C27A]/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div 
            className="absolute bottom-2 right-2 opacity-0 w-2 h-2 bg-violet-500 rounded-full"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export interface ModelOption {
    id: string;
    name: string;
    provider: string;
    cost: number;
    tag: string;
    isFree?: boolean;
}

export interface AttachedFile {
    id: string;
    file?: File;
    name: string;
    size?: number;
    type?: string;
    previewUrl?: string;
}

export interface AnimatedAIChatProps {
    onSendMessage?: (content: string, modelId: string, cost: number, attachments?: AttachedFile[]) => Promise<void> | void;
    isLoading?: boolean;
    models?: ModelOption[];
    selectedModelId?: string;
    onSelectModel?: (modelId: string) => void;
    onStop?: () => void;
    initialValue?: string;
    isExpanded?: boolean; // Controls hero section visibility
    placeholder?: string;
    aiName?: string;
    variant?: 'default' | 'lux';
}

export function AnimatedAIChat({
    onSendMessage,
    isLoading = false,
    models = [],
    selectedModelId,
    onSelectModel,
    onStop,
    initialValue = "",
    isExpanded = true,
    placeholder = "Ask any model or describe your task...",
    aiName = "VANTRA",
    variant = "default",
}: AnimatedAIChatProps) {
    const [value, setValue] = useState(initialValue);
    const [attachments, setAttachments] = useState<AttachedFile[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [recentCommand, setRecentCommand] = useState<string | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const commandPaletteRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    const commandSuggestions: CommandSuggestion[] = [
        { 
            icon: <ImageIcon className="w-4 h-4" />, 
            label: "Clone UI", 
            description: "Generate a UI from a screenshot", 
            prefix: "/clone" 
        },
        { 
            icon: <Figma className="w-4 h-4" />, 
            label: "Import Figma", 
            description: "Import a design from Figma", 
            prefix: "/figma" 
        },
        { 
            icon: <MonitorIcon className="w-4 h-4" />, 
            label: "Create Page", 
            description: "Generate a new web page", 
            prefix: "/page" 
        },
        { 
            icon: <Sparkles className="w-4 h-4" />, 
            label: "Improve", 
            description: "Improve existing UI design", 
            prefix: "/improve" 
        },
    ];

    const currentModel = useMemo(() => {
        return models.find(m => m.id === selectedModelId) || models[0] || { id: 'default', name: 'AI Model', cost: 0, tag: '', provider: '' };
    }, [models, selectedModelId]);

    // Sync external initialValue if supplied
    useEffect(() => {
        if (initialValue !== undefined && initialValue !== value && !isExpanded) {
            setValue(initialValue);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialValue, isExpanded]);

    useEffect(() => {
        if (value.startsWith('/') && !value.includes(' ')) {
            setShowCommandPalette(true);
            
            const matchingSuggestionIndex = commandSuggestions.findIndex(
                (cmd) => cmd.prefix.startsWith(value)
            );
            
            if (matchingSuggestionIndex >= 0) {
                setActiveSuggestion(matchingSuggestionIndex);
            } else {
                setActiveSuggestion(-1);
            }
        } else {
            setShowCommandPalette(false);
        }
    }, [value]);

    useEffect(() => {
        if (!isExpanded) return;
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isExpanded]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const commandButton = document.querySelector('[data-command-button]');
            
            if (commandPaletteRef.current && 
                !commandPaletteRef.current.contains(target) && 
                !commandButton?.contains(target)) {
                setShowCommandPalette(false);
            }

            if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
                setModelDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandPalette) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev < commandSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestion(prev => 
                    prev > 0 ? prev - 1 : commandSuggestions.length - 1
                );
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (activeSuggestion >= 0) {
                    const selectedCommand = commandSuggestions[activeSuggestion];
                    setValue(selectedCommand.prefix + ' ');
                    setShowCommandPalette(false);
                    
                    setRecentCommand(selectedCommand.label);
                    setTimeout(() => setRecentCommand(null), 3500);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandPalette(false);
            }
        } else if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            if (value.trim() || attachments.length > 0) {
                handleSendMessage();
            }
        }
    };

    const handleSendMessage = () => {
        const text = value.trim();
        if ((!text && attachments.length === 0) || isLoading || isTyping) return;
        
        let finalPrompt = text;
        if (attachments.length > 0) {
            const fileSummaries = attachments.map(a => `[Attachment: ${a.name}]`).join('\n');
            finalPrompt = `${fileSummaries}\n\n${finalPrompt}`;
        }
        
        const currentAttachments = [...attachments];
        
        setValue("");
        setAttachments([]);
        setShowCommandPalette(false);
        adjustHeight(true);

        if (onSendMessage) {
            onSendMessage(finalPrompt, currentModel.id, currentModel.cost, currentAttachments);
        } else {
            startTransition(() => {
                setIsTyping(true);
                setTimeout(() => {
                    setIsTyping(false);
                }, 3000);
            });
        }
    };

    const handleAttachFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const newAttachments: AttachedFile[] = Array.from(files).map((f) => {
            const isImage = f.type.startsWith('image/');
            return {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                file: f,
                name: f.name,
                size: f.size,
                type: f.type,
                previewUrl: isImage ? URL.createObjectURL(f) : undefined,
            };
        });
        
        setAttachments(prev => [...prev, ...newAttachments]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => {
            const removed = prev[index];
            if (removed?.previewUrl) {
                URL.revokeObjectURL(removed.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    };
    
    const selectCommandSuggestion = (index: number) => {
        const selectedCommand = commandSuggestions[index];
        setValue(selectedCommand.prefix + ' ');
        setShowCommandPalette(false);
        
        setRecentCommand(selectedCommand.label);
        setTimeout(() => setRecentCommand(null), 2000);
        textareaRef.current?.focus();
    };

    const isActuallyGenerating = isLoading || isTyping;

    return (
        <div className={cn(
            "flex flex-col w-full items-center justify-center bg-transparent text-white relative overflow-visible",
            isExpanded ? "min-h-screen p-6" : "p-0"
        )}>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,text/*,application/json,application/pdf,.ts,.tsx,.js,.jsx,.py"
            />

            {isExpanded && (
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#E6C27A]/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
                    <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-fuchsia-500/10 rounded-full mix-blend-normal filter blur-[96px] animate-pulse delay-1000" />
                </div>
            )}
            
            <div className="w-full max-w-2xl mx-auto relative">
                <motion.div 
                    className="relative z-10 space-y-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    {isExpanded && (
                        <div className="text-center space-y-3">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5 }}
                                className="inline-block"
                            >
                                <h1 className="studio-hero-title text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1">
                                    How can I help today?
                                </h1>
                                <motion.div 
                                    className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 0.5, duration: 0.8 }}
                                />
                            </motion.div>
                            <motion.p 
                                className="text-sm text-white/40"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                Type a command or ask a question
                            </motion.p>
                        </div>
                    )}

                    <motion.div
                        className={cn(
                            variant === 'lux'
                                ? "relative z-10 space-y-12 bg-transparent border-0 shadow-none rounded-[25px]"
                                : "relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl space-y-12",
                            !isExpanded && "mt-0"
                        )}
                        initial={{ scale: 0.98 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AnimatePresence>
                            {showCommandPalette && (
                                <motion.div 
                                    ref={commandPaletteRef}
                                    className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="py-1 bg-black/95">
                                        {commandSuggestions.map((suggestion, index) => (
                                            <motion.div
                                                key={suggestion.prefix}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                                                    activeSuggestion === index 
                                                        ? "bg-white/10 text-white" 
                                                        : "text-white/70 hover:bg-white/5"
                                                )}
                                                onClick={() => selectCommandSuggestion(index)}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                            >
                                                <div className="w-5 h-5 flex items-center justify-center text-white/60">
                                                    {suggestion.icon}
                                                </div>
                                                <div className="font-medium">{suggestion.label}</div>
                                                <div className="text-white/40 text-xs ml-1">
                                                    {suggestion.prefix}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-4">
                            <Textarea
                                ref={textareaRef}
                                value={value}
                                dir="auto"
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    adjustHeight();
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                placeholder={placeholder}
                                containerClassName="w-full"
                                className={cn(
                                    "w-full px-4 py-3",
                                    "resize-none",
                                    "bg-transparent",
                                    "border-none",
                                    "text-white/90 text-sm",
                                    "focus:outline-none",
                                    "placeholder:text-white/30",
                                    "min-h-[60px]"
                                )}
                                style={{
                                    overflow: "hidden",
                                }}
                                showRing={false}
                            />
                        </div>

                        <AnimatePresence>
                            {attachments.length > 0 && (
                                <motion.div 
                                    className="px-4 pb-3 flex gap-2 flex-wrap"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    {attachments.map((file, index) => (
                                        <motion.div
                                            key={index}
                                            className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                        >
                                            {file.previewUrl ? (
                                                <img src={file.previewUrl} alt={file.name} className="h-4 w-4 rounded object-cover" />
                                            ) : null}
                                            <span>{file.name}</span>
                                            <button 
                                                onClick={() => removeAttachment(index)}
                                                className="text-white/40 hover:text-white transition-colors"
                                            >
                                                <XIcon className="w-3 h-3" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="p-4 border-t border-white/[0.05] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <motion.button
                                    type="button"
                                    onClick={handleAttachFile}
                                    whileTap={{ scale: 0.94 }}
                                    className="p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group"
                                >
                                    <Paperclip className="w-4 h-4" />
                                    <motion.span
                                        className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        layoutId="button-highlight"
                                    />
                                </motion.button>
                                <motion.button
                                    type="button"
                                    data-command-button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCommandPalette(prev => !prev);
                                    }}
                                    whileTap={{ scale: 0.94 }}
                                    className={cn(
                                        "p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group",
                                        showCommandPalette && "bg-white/10 text-white/90"
                                    )}
                                >
                                    <Command className="w-4 h-4" />
                                    <motion.span
                                        className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        layoutId="button-highlight"
                                    />
                                </motion.button>
                                
                                {models.length > 0 && (
                                    <div className="relative ml-2" ref={modelDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] text-white/70 hover:text-white/90 text-xs font-medium transition-colors"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-[#E6C27A]" />
                                            <span className="max-w-[100px] truncate">{currentModel.name}</span>
                                            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                                        </button>
                                        
                                        <AnimatePresence>
                                            {modelDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute left-0 bottom-full mb-2 w-64 rounded-xl border border-white/[0.1] bg-[#0A0A0B]/95 backdrop-blur-xl p-1.5 shadow-2xl z-50"
                                                >
                                                    <div className="px-3 py-2 text-[10px] font-mono uppercase text-white/40 border-b border-white/[0.05] mb-1 flex items-center justify-between">
                                                        <span>Select Model</span>
                                                        <Sparkles className="w-3 h-3 text-[#E6C27A]" />
                                                    </div>
                                                    <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                                                        {models.map((model) => (
                                                            <button
                                                                key={model.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (onSelectModel) onSelectModel(model.id);
                                                                    setModelDropdownOpen(false);
                                                                }}
                                                                className={cn(
                                                                    "w-full flex flex-col px-3 py-2 rounded-lg text-left transition-colors",
                                                                    selectedModelId === model.id
                                                                        ? "bg-[#E6C27A]/10 text-white ring-1 ring-inset ring-[#E6C27A]/25"
                                                                        : "text-white/60 hover:bg-white/5 hover:text-white"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-medium">{model.name}</span>
                                                                    <span className={cn(
                                                                        "text-[10px] font-mono",
                                                                        model.isFree ? "text-[#E6C27A]" : "text-white/30"
                                                                    )}>{model.cost} pts</span>
                                                                </div>
                                                                <span className="text-[10px] text-white/40 mt-0.5">{model.provider}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                            
                            {isActuallyGenerating ? (
                                <motion.button
                                    type="button"
                                    onClick={onStop}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                                >
                                    <Square className="w-4 h-4 fill-current" />
                                    <span>Stop</span>
                                </motion.button>
                            ) : (
                                <motion.button
                                    type="button"
                                    onClick={handleSendMessage}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!value.trim() && attachments.length === 0}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
                                        (value.trim() || attachments.length > 0)
                                            ? "bg-gradient-to-r from-[#E6C27A] to-[#F0DCAB] text-[#050506] shadow-lg shadow-[#E6C27A]/30 hover:shadow-[#E6C27A]/45 ring-1 ring-transparent hover:ring-[#E8C87A]/40"
                                            : "bg-white/[0.05] text-white/40"
                                    )}
                                >
                                    <SendIcon className={cn("w-4 h-4 transition-transform", value.trim() && "translate-y-[-1px]")} />
                                    <span>Send</span>
                                </motion.button>
                            )}
                        </div>
                    </motion.div>

                    {isExpanded && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {commandSuggestions.map((suggestion, index) => (
                                <motion.button
                                    key={suggestion.prefix}
                                    onClick={() => selectCommandSuggestion(index)}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg text-sm text-white/60 hover:text-white/90 transition-all relative group"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    {suggestion.icon}
                                    <span>{suggestion.label}</span>
                                    <motion.div
                                        className="absolute inset-0 border border-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                </motion.button>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Removed overlapping fixed Thinking indicator, moved to chat flow */}

            {isExpanded && inputFocused && (
                <motion.div 
                    className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.02] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 blur-[96px]"
                    animate={{
                        x: mousePosition.x - 400,
                        y: mousePosition.y - 400,
                    }}
                    transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 150,
                        mass: 0.5,
                    }}
                />
            )}
        </div>
    );
}

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{ 
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)"
                    }}
                />
            ))}
        </div>
    );
}

const rippleKeyframes = `
@keyframes ripple {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
`;

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = rippleKeyframes;
    document.head.appendChild(style);
}
