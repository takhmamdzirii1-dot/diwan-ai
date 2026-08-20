'use client';

import React, {
  useEffect,
  useRef,
  useCallback,
  useTransition,
  useState,
  useMemo,
} from 'react';
import { cn } from '@/lib/utils';
import {
  ImageIcon,
  Figma,
  MonitorIcon,
  Sparkles,
  Paperclip,
  SendIcon,
  XIcon,
  LoaderIcon,
  Command,
  Globe,
  Terminal,
  Layers,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
  category?: string;
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <textarea
          className={cn(
            'flex min-h-[60px] w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-sm text-white/90',
            'transition-all duration-200 ease-in-out',
            'placeholder:text-white/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            showRing
              ? 'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0'
              : '',
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
            className="absolute inset-0 rounded-xl pointer-events-none ring-2 ring-offset-0 ring-[#1FD8B8]/30 border border-[#1FD8B8]/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div
            className="absolute bottom-2 right-2 opacity-0 w-2 h-2 bg-[#1FD8B8] rounded-full pointer-events-none"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

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
  onSendMessage?: (
    content: string,
    modelId: string,
    cost: number,
    attachments?: AttachedFile[]
  ) => Promise<void> | void;
  isLoading?: boolean;
  models?: ModelOption[];
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  embedded?: boolean;
}

export function AnimatedAIChat({
  onSendMessage,
  isLoading = false,
  models = [],
  selectedModelId,
  onSelectModel,
  placeholder,
  initialValue = '',
  className,
  embedded = true,
}: AnimatedAIChatProps) {
  const [value, setValue] = useState(initialValue);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [recentCommand, setRecentCommand] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });

  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external initialValue if supplied
  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
      }
    }
  }, [initialValue, textareaRef]);

  const commandSuggestions: CommandSuggestion[] = [
    {
      icon: <ImageIcon className="w-4 h-4 text-[#1FD8B8]" />,
      label: 'Clone UI',
      description: 'Analyze and replicate visual layout from screenshot or site',
      prefix: '/clone',
      category: 'Replication',
    },
    {
      icon: <Figma className="w-4 h-4 text-[#6E6BFF]" />,
      label: 'Import Figma',
      description: 'Convert Figma designs and vectors to React + Tailwind',
      prefix: '/figma',
      category: 'Design',
    },
    {
      icon: <MonitorIcon className="w-4 h-4 text-[#1FD8B8]" />,
      label: 'Create Page',
      description: 'Architect a full multi-section web page or dashboard',
      prefix: '/page',
      category: 'Full Page',
    },
    {
      icon: <Sparkles className="w-4 h-4 text-[#F5B942]" />,
      label: 'Improve',
      description: 'Refactor code for performance, architecture & luxury UI',
      prefix: '/improve',
      category: 'Optimization',
    },
  ];

  const currentModel = useMemo(() => {
    return (
      models.find((m) => m.id === selectedModelId) ||
      models[0] || {
        id: 'nvidia/nemotron-3.5-lightning:free',
        name: 'Nemotron 3.5 Lightning (Free)',
        provider: 'NVIDIA AI',
        cost: 0,
        tag: 'Ultra-Fast Reasoning (0 pts)',
        isFree: true,
      }
    );
  }, [models, selectedModelId]);

  useEffect(() => {
    if (value.startsWith('/') && !value.includes(' ')) {
      setShowCommandPalette(true);
      const matchingSuggestionIndex = commandSuggestions.findIndex((cmd) =>
        cmd.prefix.startsWith(value)
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
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const commandButton = document.querySelector('[data-command-button]');

      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !commandButton?.contains(target) &&
        !textareaRef.current?.contains(target)
      ) {
        setShowCommandPalette(false);
      }

      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(target)
      ) {
        setModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [textareaRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev < commandSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev > 0 ? prev - 1 : commandSuggestions.length - 1
        );
        return;
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          selectCommandSuggestion(activeSuggestion);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || attachments.length > 0) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = () => {
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading || isTyping) return;

    let finalPrompt = text;

    // Attach file descriptions/metadata if present
    if (attachments.length > 0) {
      const fileSummaries = attachments
        .map(
          (a) =>
            `[Attachment: ${a.name} (${Math.round((a.size || 1024) / 1024)} KB, ${a.type || 'file'})]`
        )
        .join('\n');
      finalPrompt = `${fileSummaries}\n\n${finalPrompt}`;
    }

    const currentAttachments = [...attachments];

    // Clear input
    setValue('');
    setAttachments([]);
    setShowCommandPalette(false);
    adjustHeight(true);

    if (onSendMessage) {
      onSendMessage(
        finalPrompt,
        currentModel.id,
        currentModel.cost,
        currentAttachments
      );
    } else {
      // Standalone demo simulated typing state
      startTransition(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
        }, 2500);
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

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
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
    setTimeout(() => setRecentCommand(null), 2500);
    textareaRef.current?.focus();
  };

  const isActuallyGenerating = isLoading || isTyping;
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isActuallyGenerating;

  return (
    <div
      className={cn(
        'w-full relative',
        !embedded &&
          'min-h-screen flex flex-col items-center justify-center bg-[#050506] text-white p-4 sm:p-6 overflow-hidden',
        className
      )}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,text/*,application/json,application/pdf,.ts,.tsx,.js,.jsx,.py"
      />

      {/* Mouse Glow / Ambient Lights (when standalone or focused) */}
      {!embedded && (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#6E6BFF]/15 rounded-full filter blur-[128px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#1FD8B8]/15 rounded-full filter blur-[128px] animate-pulse delay-700" />
          <div className="absolute top-1/4 right-1/3 w-64 h-64 bg-[#6E6BFF]/10 rounded-full filter blur-[96px] animate-pulse delay-1000" />
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-3xl mx-auto relative">
        <motion.div
          className="relative z-10 space-y-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Main Glassmorphic Input Card */}
          <div className="relative group">
            {/* Subtle Ambient Radial Glow */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#1FD8B8]/10 via-[#6E6BFF]/10 to-[#1FD8B8]/10 blur-2xl opacity-60 pointer-events-none -z-10 transition-opacity duration-500 group-hover:opacity-90" />

            <div
              className={cn(
                'relative backdrop-blur-2xl bg-[#0A0B0D]/90 rounded-2xl border p-2 shadow-2xl transition-all duration-200',
                inputFocused
                  ? 'border-[#1FD8B8]/40 ring-2 ring-[#1FD8B8]/30 shadow-[0_0_30px_rgba(31,216,184,0.15)]'
                  : 'border-white/[0.08] hover:border-white/[0.12]'
              )}
            >
              {/* Command Palette Popover */}
              <AnimatePresence>
                {showCommandPalette && (
                  <motion.div
                    ref={commandPaletteRef}
                    className="absolute left-2 right-2 bottom-full mb-3 backdrop-blur-2xl bg-[#0D0E12]/95 rounded-2xl z-50 shadow-2xl border border-white/10 overflow-hidden p-1.5"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] text-[10px] font-mono text-white/40 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5 text-white/70">
                        <Terminal className="h-3.5 w-3.5 text-[#1FD8B8]" />
                        VANTRA Commands
                      </span>
                      <span>↑↓ Navigate • Enter Select</span>
                    </div>
                    <div className="py-1 max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
                      {commandSuggestions.map((suggestion, index) => (
                        <motion.div
                          key={suggestion.prefix}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all cursor-pointer group',
                            activeSuggestion === index
                              ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border-l-2 border-[#1FD8B8]'
                              : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                          )}
                          onClick={() => selectCommandSuggestion(index)}
                          onMouseEnter={() => setActiveSuggestion(index)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/70 group-hover:text-[#1FD8B8] transition">
                              {suggestion.icon}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span>{suggestion.label}</span>
                                <span className="text-white/40 font-mono text-[11px]">
                                  {suggestion.prefix}
                                </span>
                              </div>
                              <div className="text-white/40 text-[11px] truncate">
                                {suggestion.description}
                              </div>
                            </div>
                          </div>

                          {suggestion.category && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 shrink-0 ml-2">
                              {suggestion.category}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea */}
              <div className="px-2 pt-1">
                <Textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={
                    placeholder ||
                    `Message ${currentModel.name}... (Type / for quick commands)`
                  }
                  containerClassName="w-full"
                  className={cn(
                    'w-full px-2 py-2 resize-none bg-transparent border-none text-white/90 text-sm focus:outline-none placeholder:text-white/25 min-h-[52px]'
                  )}
                  style={{
                    overflow: 'hidden',
                  }}
                  showRing={false}
                />
              </div>

              {/* Attachments Preview Chips */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    className="px-2 pb-2 flex gap-2 flex-wrap"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {attachments.map((file, index) => (
                      <motion.div
                        key={file.id || index}
                        className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/[0.08] py-1.5 px-3 rounded-xl text-white/80"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        {file.previewUrl ? (
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="h-4 w-4 rounded object-cover"
                          />
                        ) : (
                          <span className="text-[#1FD8B8] font-mono text-[10px]">
                            FILE
                          </span>
                        )}
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-white/40 hover:text-white transition p-0.5 rounded cursor-pointer"
                          aria-label={`Remove ${file.name}`}
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Action Bar */}
              <div className="p-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Paperclip Attachment Button */}
                  <motion.button
                    type="button"
                    onClick={handleAttachFile}
                    whileTap={{ scale: 0.94 }}
                    className="p-2 text-white/40 hover:text-[#1FD8B8] hover:bg-white/5 rounded-xl transition cursor-pointer relative group"
                    title="Attach image or file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </motion.button>

                  {/* Slash Command Palette Trigger Button */}
                  <motion.button
                    type="button"
                    data-command-button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommandPalette((prev) => !prev);
                      textareaRef.current?.focus();
                    }}
                    whileTap={{ scale: 0.94 }}
                    className={cn(
                      'p-2 rounded-xl transition cursor-pointer text-xs font-mono flex items-center gap-1',
                      showCommandPalette
                        ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border border-[#1FD8B8]/30'
                        : 'text-white/40 hover:text-[#1FD8B8] hover:bg-white/5'
                    )}
                    title="Open Command Palette (/)"
                  >
                    <Command className="w-4 h-4" />
                    <span className="hidden sm:inline text-[11px]">Commands</span>
                  </motion.button>

                  {/* Model Selector Dropdown Popover */}
                  {models.length > 0 && (
                    <div className="relative" ref={modelDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setModelDropdownOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white text-xs font-medium transition cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#1FD8B8]" />
                        <span className="max-w-[120px] sm:max-w-[160px] truncate font-semibold">
                          {currentModel.name}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                      </button>

                      <AnimatePresence>
                        {modelDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 bottom-11 w-72 sm:w-80 rounded-2xl border border-white/[0.12] bg-[#0E1016]/95 backdrop-blur-2xl p-2 shadow-2xl z-50 space-y-1"
                          >
                            <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-white/40 tracking-wider flex items-center justify-between border-b border-white/[0.06]">
                              <span>Select Intelligence Engine</span>
                              <Zap className="h-3 w-3 text-[#1FD8B8]" />
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-1 p-1 custom-scrollbar">
                              {models.map((model) => {
                                const isSelected = selectedModelId === model.id;
                                return (
                                  <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => {
                                      if (onSelectModel) onSelectModel(model.id);
                                      setModelDropdownOpen(false);
                                    }}
                                    className={cn(
                                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition cursor-pointer',
                                      isSelected
                                        ? 'bg-[#1FD8B8]/10 text-white border border-[#1FD8B8]/30'
                                        : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                                    )}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <span className="truncate">{model.name}</span>
                                        {model.isFree && (
                                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1FD8B8]/20 text-[#1FD8B8] font-bold shrink-0">
                                            FREE
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-white/40 truncate">
                                        {model.tag || model.provider}
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-[#1FD8B8] shrink-0">
                                      {model.cost === 0 ? '0 pts' : `${model.cost} pts`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Point Badge */}
                  {currentModel && (
                    <div className="hidden sm:flex items-center">
                      <span
                        className={cn(
                          'font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border',
                          currentModel.cost === 0
                            ? 'bg-[#1FD8B8]/10 text-[#1FD8B8] border-[#1FD8B8]/30'
                            : 'bg-white/[0.06] text-white/70 border-white/10'
                        )}
                      >
                        {currentModel.cost === 0 ? '0 PTS (FREE)' : `${currentModel.cost} PTS`}
                      </span>
                    </div>
                  )}

                  {/* Send Button */}
                  <motion.button
                    type="button"
                    onClick={handleSendMessage}
                    whileHover={canSend ? { scale: 1.02 } : {}}
                    whileTap={canSend ? { scale: 0.96 } : {}}
                    disabled={!canSend}
                    className={cn(
                      'px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                      canSend
                        ? 'bg-[#1FD8B8] text-[#050506] shadow-[0_0_20px_rgba(31,216,184,0.25)] hover:brightness-110'
                        : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                    )}
                  >
                    {isActuallyGenerating ? (
                      <LoaderIcon className="w-3.5 h-3.5 animate-[spin_2s_linear_infinite]" />
                    ) : (
                      <SendIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Send</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Suggestion Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {commandSuggestions.map((suggestion, index) => (
              <motion.button
                key={suggestion.prefix}
                type="button"
                onClick={() => selectCommandSuggestion(index)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0A0B0D]/80 hover:bg-white/[0.05] border border-white/[0.06] hover:border-[#1FD8B8]/30 rounded-xl text-xs text-white/60 hover:text-white transition-all cursor-pointer shadow-sm group"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {suggestion.icon}
                <span className="font-medium group-hover:text-white transition">
                  {suggestion.label}
                </span>
                <span className="text-[10px] text-white/30 font-mono">
                  {suggestion.prefix}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Floating Thinking Indicator */}
      <AnimatePresence>
        {isActuallyGenerating && (
          <motion.div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 backdrop-blur-2xl bg-[#0D0E12]/90 rounded-full px-4 py-2 shadow-2xl border border-white/[0.08] z-40"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-center">
                <span className="text-[10px] font-mono font-bold text-[#1FD8B8]">
                  AI
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className="font-medium">{currentModel.name} Thinking</span>
                <TypingDots />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Mouse Glow */}
      {inputFocused && (
        <motion.div
          className="fixed w-[40rem] h-[40rem] rounded-full pointer-events-none z-0 opacity-[0.035] bg-gradient-to-r from-[#1FD8B8] via-[#6E6BFF] to-[#1FD8B8] blur-[120px]"
          animate={{
            x: mousePosition.x - 320,
            y: mousePosition.y - 320,
          }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 150,
            mass: 0.5,
          }}
        />
      )}
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-center ml-1">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 bg-[#1FD8B8] rounded-full mx-0.5 shadow-[0_0_6px_rgba(31,216,184,0.6)]"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.85, 1.2, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: dot * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
}

export function ActionButton({ icon, label }: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="flex items-center gap-2 px-4 py-2 bg-[#0A0B0D] hover:bg-[#0E1016] rounded-full border border-white/[0.08] text-white/60 hover:text-white transition-all relative overflow-hidden group cursor-pointer"
    >
      <div className="relative z-10 flex items-center gap-2">
        {icon}
        <span className="text-xs relative z-10">{label}</span>
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-[#1FD8B8]/10 to-[#6E6BFF]/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <motion.span
        className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#1FD8B8] to-[#6E6BFF]"
        initial={{ width: 0 }}
        whileHover={{ width: '100%' }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
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

export function Demo() {
  return (
    <div className="flex w-screen overflow-x-hidden">
      <AnimatedAIChat embedded={false} />
    </div>
  );
}

export default AnimatedAIChat;
