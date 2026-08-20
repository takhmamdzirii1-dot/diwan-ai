'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Terminal,
  Sparkles,
  ChevronDown,
  X,
  FileText,
  ImageIcon,
  Code2,
  Globe,
  Layers,
  Wand2,
  Check,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CommandItem {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  prefix: string;
  category?: string;
}

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
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

export const DEFAULT_COMMANDS: CommandItem[] = [
  {
    id: 'clone',
    command: '/clone',
    name: 'Clone Website / UI',
    description: 'Replicate structure, typography, and interactive components of a target site.',
    icon: Globe,
    prefix: '[TASK: WEBSITE CLONE & REPLICATION]\nAnalyze and replicate the visual structure, layout, typography, and interactive components:\n',
    category: 'Architecture',
  },
  {
    id: 'figma',
    command: '/figma',
    name: 'Figma to Code',
    description: 'Convert Figma designs, vectors, and tokens to production React + Tailwind.',
    icon: Layers,
    prefix: '[TASK: FIGMA TO REACT/TAILWIND TRANSLATION]\nConvert the following Figma design specification or layout description into pixel-perfect React + Tailwind CSS code:\n',
    category: 'Design Engineering',
  },
  {
    id: 'page',
    command: '/page',
    name: 'Generate Full Page',
    description: 'Architect and generate a complete multi-section landing page or app view.',
    icon: Wand2,
    prefix: '[TASK: COMPLETE LANDING PAGE / APPLICATION GENERATION]\nArchitect and write complete, modular, production-ready code for a full page:\n',
    category: 'Generation',
  },
  {
    id: 'improve',
    command: '/improve',
    name: 'Optimize & Refactor',
    description: 'Elevate code quality, runtime efficiency, and modern luxury UI styling.',
    icon: Code2,
    prefix: '[TASK: CODE OPTIMIZATION & REFACTORING]\nAnalyze, refactor, and elevate the provided code for maximum performance, clean architecture, and modern luxury UI styling:\n',
    category: 'Optimization',
  },
  {
    id: 'darja',
    command: '/darja',
    name: 'Algerian Darja Copy',
    description: 'High-converting marketing copy and localized messaging in Algerian Darja.',
    icon: Sparkles,
    prefix: '[TASK: ALGERIAN DARJA LOCALIZATION]\nWrite authentic, high-converting Algerian Darja text tailored for local e-commerce and audience:\n',
    category: 'Localization',
  },
  {
    id: 'chargily',
    command: '/chargily',
    name: 'Chargily Pay Webhook',
    description: 'Next.js & TypeScript route for verifying Chargily Pay Edahabia / CIB webhooks.',
    icon: Terminal,
    prefix: '[TASK: CHARGILY PAY INTEGRATION]\nProvide complete backend integration and signature verification for Chargily Pay:\n',
    category: 'Payments',
  },
];

export interface AnimatedAIChatProps {
  onSendMessage: (
    content: string,
    modelId: string,
    cost: number,
    attachments?: AttachedFile[]
  ) => Promise<void> | void;
  isLoading: boolean;
  models?: ModelOption[];
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
}

export function AnimatedAIChat({
  onSendMessage,
  isLoading,
  models = [],
  selectedModelId,
  onSelectModel,
  placeholder,
  initialValue = '',
  className,
}: AnimatedAIChatProps) {
  const [input, setInput] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [activeCommand, setActiveCommand] = useState<CommandItem | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Sync initialValue if changed externally
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
      }
    }
  }, [initialValue]);

  // Current active model
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

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Filter commands if user typed slash
  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/') && !showCommands) return DEFAULT_COMMANDS;
    if (input.startsWith('/')) {
      const query = input.slice(1).toLowerCase();
      return DEFAULT_COMMANDS.filter(
        (c) =>
          c.command.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query)
      );
    }
    return DEFAULT_COMMANDS;
  }, [input, showCommands]);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !textareaRef.current?.contains(target)
      ) {
        setShowCommands(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    adjustTextareaHeight();

    if (val.startsWith('/') && !val.includes(' ')) {
      setShowCommands(true);
      setSelectedCommandIndex(0);
    } else if (showCommands && !val.startsWith('/')) {
      setShowCommands(false);
    }
  };

  const selectCommand = (cmd: CommandItem) => {
    setActiveCommand(cmd);
    // Strip command from text input and focus
    const remainingText = input.startsWith('/') ? input.replace(/^\/\S*\s*/, '') : input;
    setInput(remainingText);
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
    }
  };

  const removeActiveCommand = () => {
    setActiveCommand(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = async () => {
    if (isLoading) return;
    const trimmedInput = input.trim();
    if (!trimmedInput && attachments.length === 0) return;

    let finalPrompt = trimmedInput;

    // Prepend active slash command prefix
    if (activeCommand) {
      finalPrompt = `${activeCommand.prefix}${finalPrompt}`;
    }

    // Attach file descriptions/metadata if present
    if (attachments.length > 0) {
      const fileSummaries = attachments
        .map((a) => `[Attachment: ${a.name} (${Math.round(a.size / 1024)} KB, ${a.type || 'file'})]`)
        .join('\n');
      finalPrompt = `${fileSummaries}\n\n${finalPrompt}`;
    }

    const currentAttachments = [...attachments];

    // Reset input states
    setInput('');
    setActiveCommand(null);
    setAttachments([]);
    setShowCommands(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(
      finalPrompt,
      currentModel.id,
      currentModel.cost,
      currentAttachments
    );
  };

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;

  return (
    <div className={cn('relative w-full max-w-4xl mx-auto', className)}>
      {/* Floating Thinking Indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          >
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#0D0E12]/90 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/80">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: 'easeInOut',
                    }}
                    className="h-1.5 w-1.5 rounded-full bg-[#1FD8B8]"
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-white/80 font-mono tracking-tight">
                {currentModel.name} reasoning...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Slash Command Palette Modal */}
      <AnimatePresence>
        {showCommands && (
          <motion.div
            ref={commandPaletteRef}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute bottom-[calc(100%+12px)] left-0 right-0 z-40 rounded-2xl border border-white/10 bg-[#0D0E12]/95 backdrop-blur-2xl p-2 shadow-2xl shadow-black/90 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] text-[11px] text-white/40">
              <span className="font-mono uppercase tracking-wider flex items-center gap-1.5 text-white/60">
                <Terminal className="h-3.5 w-3.5 text-[#1FD8B8]" />
                Command Palette
              </span>
              <span className="font-mono text-[10px]">
                ↑↓ to navigate • Enter to select • Esc to dismiss
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto p-1 space-y-1 custom-scrollbar">
              {filteredCommands.length === 0 ? (
                <div className="p-4 text-center text-xs text-white/40">
                  No matching commands found.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedCommandIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => selectCommand(cmd)}
                      onMouseEnter={() => setSelectedCommandIndex(idx)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer group',
                        isSelected
                          ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border-l-2 border-[#1FD8B8]'
                          : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition',
                            isSelected
                              ? 'bg-[#1FD8B8]/20 border-[#1FD8B8]/40 text-[#1FD8B8] shadow-[0_0_10px_rgba(31,216,184,0.3)]'
                              : 'bg-white/[0.04] border-white/[0.08] text-white/70 group-hover:text-[#1FD8B8] group-hover:border-[#1FD8B8]/30'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">
                              {cmd.command}
                            </span>
                            <span className="text-xs font-semibold text-white/90 truncate">
                              {cmd.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40 truncate leading-relaxed">
                            {cmd.description}
                          </p>
                        </div>
                      </div>

                      {cmd.category && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-white/40 shrink-0 ml-2">
                          {cmd.category}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Glassmorphic Chat Card Container */}
      <div className="relative group">
        {/* Subtle Ambient Background Glows */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#1FD8B8]/10 via-[#6E6BFF]/10 to-[#1FD8B8]/10 blur-3xl opacity-60 pointer-events-none -z-10 transition-opacity duration-500 group-hover:opacity-90" />

        <div
          className={cn(
            'relative rounded-2xl border bg-[#0A0B0D]/90 backdrop-blur-2xl p-3 sm:p-4 shadow-2xl transition-all duration-200',
            isFocused
              ? 'border-[#1FD8B8]/40 ring-2 ring-[#1FD8B8]/30 shadow-[0_0_30px_rgba(31,216,184,0.15)]'
              : 'border-white/[0.08] hover:border-white/[0.12]'
          )}
        >
          {/* Active Command Badge & Attachments Preview Area */}
          {(activeCommand || attachments.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 pb-2.5 mb-2 border-b border-white/[0.06]">
              {/* Active Command Chip */}
              {activeCommand && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-[#1FD8B8] text-xs font-mono font-medium shadow-[0_0_10px_rgba(31,216,184,0.15)]"
                >
                  <Terminal className="h-3 w-3" />
                  <span>{activeCommand.command}</span>
                  <span className="text-white/60 font-sans text-[11px]">
                    ({activeCommand.name})
                  </span>
                  <button
                    type="button"
                    onClick={removeActiveCommand}
                    className="ml-1 hover:text-white transition p-0.5 rounded cursor-pointer"
                    aria-label="Remove command"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              )}

              {/* Attachments Chips */}
              {attachments.map((att) => (
                <motion.div
                  key={att.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/80 text-xs shadow-sm max-w-[220px]"
                >
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="h-4 w-4 rounded object-cover"
                    />
                  ) : att.type.includes('image') ? (
                    <ImageIcon className="h-3.5 w-3.5 text-[#1FD8B8]" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-[#1FD8B8]" />
                  )}
                  <span className="truncate text-[11px] font-medium">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-white/40 hover:text-white transition p-0.5 rounded cursor-pointer"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Textarea Input */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                placeholder ||
                `Message ${currentModel.name}... Type / for commands, Enter to send`
              }
              rows={1}
              className="w-full bg-transparent px-1 py-1 text-sm sm:text-[15px] text-white placeholder-white/30 outline-none resize-none max-h-48 custom-scrollbar leading-relaxed"
            />
          </div>

          {/* Bottom Interactive Toolbar */}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/[0.06] gap-2">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* File Attachment Button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,text/*,application/json,application/pdf,.ts,.tsx,.js,.jsx,.py"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files or images"
                className="flex items-center justify-center h-8 w-8 rounded-xl text-white/40 hover:text-[#1FD8B8] hover:bg-white/5 transition cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Slash Command Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setShowCommands((prev) => !prev);
                  if (!showCommands && textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }}
                title="Open slash command palette"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer',
                  showCommands || activeCommand
                    ? 'bg-[#1FD8B8]/15 text-[#1FD8B8] border border-[#1FD8B8]/30'
                    : 'text-white/40 hover:text-[#1FD8B8] hover:bg-white/5 border border-transparent'
                )}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Commands</span>
                <span className="text-[10px] opacity-70">(/)</span>
              </button>

              {/* Model Selector Pill */}
              {models.length > 0 && (
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] text-white text-xs font-medium transition cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#1FD8B8]" />
                    <span className="max-w-[110px] sm:max-w-[160px] md:max-w-none truncate font-semibold">
                      {currentModel.name}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                  </button>

                  {/* Model Dropdown Popover */}
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
                                    ? 'bg-[#1FD8B8]/10 text-white border border-[#1FD8B8]/30 shadow-[0_0_12px_rgba(31,216,184,0.1)]'
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

            {/* Right Action: Point Badge & Send Button */}
            <div className="flex items-center gap-2">
              {/* Cost Badge */}
              <div className="hidden md:flex items-center">
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

              {/* Glowing VANTRA Teal Send Button */}
              <motion.button
                type="button"
                whileTap={canSend ? { scale: 0.94 } : {}}
                disabled={!canSend}
                onClick={handleSend}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl font-semibold transition duration-200 shrink-0 cursor-pointer',
                  canSend
                    ? 'bg-[#1FD8B8] text-[#050506] shadow-[0_0_20px_rgba(31,216,184,0.25)] hover:brightness-110 hover:shadow-[0_0_25px_rgba(31,216,184,0.4)]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/[0.04]'
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimatedAIChat;
