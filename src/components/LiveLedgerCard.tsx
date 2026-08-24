'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Play,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import SpotlightCard from './SpotlightCard';
import useUser from '../hooks/useUser';

export type CategoryType = 'chat' | 'image' | 'video';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  category: string;
  cost: number;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  unit: string;
  tag: string;
}

const LEDGER_MODELS: Record<CategoryType, ModelInfo> = {
  chat: {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    category: 'Advanced Reasoning, Coding & Document Analysis',
    cost: 25,
    icon: MessageSquare,
    prompt: 'Write a high-converting marketing plan for an Algerian e-commerce shop with BaridiMob checkout flow.',
    unit: 'pts / query',
    tag: 'Flagship LLM',
  },
  image: {
    id: 'flux-1-pro',
    name: 'Flux.1 Pro',
    provider: 'Black Forest Labs',
    category: 'Photorealistic & Commercial Image Generation',
    cost: 65,
    icon: ImageIcon,
    prompt: 'Cinematic 4K photograph of Algiers Casbah at sunset with dramatic warm golden lighting.',
    unit: 'pts / image',
    tag: 'Ultra-HD Image',
  },
  video: {
    id: 'kling-ai-1-5',
    name: 'Kling AI 1.5 HD',
    provider: 'Kuaishou',
    category: 'Photorealistic & Cinematic AI Video Generation (1080p)',
    cost: 240,
    icon: Video,
    prompt: 'Cinematic drone shot soaring over Jijel coastal cliffs with realistic ocean waves.',
    unit: 'pts / 5s',
    tag: 'Cinematic Video',
  },
};

interface LogItem {
  id: string;
  opName: string;
  cost: number;
  time: string;
  responsePreview?: string;
}

export interface LiveLedgerCardProps {
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export default function LiveLedgerCard({ onOpenAuth }: LiveLedgerCardProps) {
  const { user, session, balance: userBalance, refreshBalance } = useUser();
  const [localBalance, setLocalBalance] = useState<number>(10000);
  const [activeTab, setActiveTab] = useState<CategoryType>('chat');
  const [isDeducting, setIsDeducting] = useState<boolean>(false);
  const [lastDeduction, setLastDeduction] = useState<number | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 'init-1',
      opName: 'Initial Credit Balance Added (Edahabia/CIB)',
      cost: -10000,
      time: 'Just now',
    },
  ]);

  const activeBalance = user ? userBalance : localBalance;
  const currentModel = LEDGER_MODELS[activeTab];
  const IconComponent = currentModel.icon;

  const handleExecute = async () => {
    setError(null);
    const promptToRun = customPrompt.trim() || currentModel.prompt;

    if (activeBalance < currentModel.cost) {
      setError('Insufficient points! Please top up your balance.');
      if (onOpenAuth && !user) {
        onOpenAuth('signup');
      }
      return;
    }

    setIsDeducting(true);
    setLastDeduction(currentModel.cost);

    try {
      // If user is logged in, call real API route
      if (user && session?.access_token) {
        const response = await fetch('/api/generate/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt: promptToRun,
            model: currentModel.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate response');
        }

        setAiOutput(data.response || 'Success');
        setShowOutput(true);
        await refreshBalance();

        setLogs((prev) => [
          {
            id: `${Date.now()}`,
            opName: `${currentModel.name} Live Query`,
            cost: currentModel.cost,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            responsePreview: data.response?.slice(0, 80) + '...',
          },
          ...prev.slice(0, 4),
        ]);
      } else {
        // Instant simulated response for guest preview
        await new Promise((r) => setTimeout(r, 600));
        setLocalBalance((prev) => Math.max(0, prev - currentModel.cost));
        const simOutput = `[${currentModel.name} Output]\n\nAnalysis for prompt: "${promptToRun}"\n\n✓ Verification: 200 OK\n✓ Context: Processed in 340ms\n✓ Deduction: -${currentModel.cost} PTS\n✓ Languages: English, French & Algerian Darja.`;
        setAiOutput(simOutput);
        setShowOutput(true);

        setLogs((prev) => [
          {
            id: `${Date.now()}`,
            opName: `${currentModel.name} Query`,
            cost: currentModel.cost,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            responsePreview: simOutput.slice(0, 80) + '...',
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (err: any) {
      setError(err?.message || 'Execution error');
    } finally {
      setIsDeducting(false);
    }
  };

  const handleReset = () => {
    if (user) {
      refreshBalance();
    } else {
      setLocalBalance(10000);
    }
    setAiOutput(null);
    setShowOutput(false);
    setError(null);
    setLogs([
      {
        id: `reset-${Date.now()}`,
        opName: 'Demo Balance Reset',
        cost: -10000,
        time: 'Just now',
      },
    ]);
  };

  return (
    <SpotlightCard className="w-full max-w-xl shadow-[0_24px_60px_rgba(0,0,0,0.7)] border border-white/[0.06] bg-white/[0.035] backdrop-blur-xl">
      <div className="p-7 md:p-9 space-y-6">
        {/* Header: Title & Balance Pill */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#1FD8B8]/10 border border-[#1FD8B8]/25">
              <Sparkles className="h-4 w-4 text-[#1FD8B8]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide uppercase text-[#F5F6F8]">
                VANTRA Live Ledger
              </h3>
              <p className="text-xs text-[rgba(245,246,248,0.6)] font-sans">
                Unified DZD Credit Engine
              </p>
            </div>
          </div>

          {/* Balance Pill */}
          <div className="flex items-center gap-2.5 rounded-full bg-[#050506] px-4 py-2 border border-white/[0.06]">
            <span className="text-xs text-[rgba(245,246,248,0.6)]">Available Balance:</span>
            <div className="relative flex items-center">
              <motion.span
                key={activeBalance}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-base font-bold text-[#1FD8B8]"
              >
                {activeBalance.toLocaleString()}
              </motion.span>
              <span className="ml-1 text-[11px] font-semibold text-[#1FD8B8] font-mono">PTS</span>

              {/* Floating deduction indicator */}
              <AnimatePresence>
                {isDeducting && lastDeduction && (
                  <motion.span
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -24, scale: 1.05 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65 }}
                    className="absolute -top-4 right-0 text-xs font-bold text-[#1FD8B8] font-mono"
                  >
                    -{lastDeduction}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-full bg-[#050506]/80 p-1.5 border border-white/[0.06]">
          {(['chat', 'image', 'video'] as CategoryType[]).map((tab) => {
            const isActive = activeTab === tab;
            const TabIcon = LEDGER_MODELS[tab].icon;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setCustomPrompt('');
                  setShowOutput(false);
                }}
                className={`relative flex items-center justify-center gap-2 rounded-full py-2 text-xs md:text-sm font-medium transition-all duration-[250ms] ${
                  isActive
                    ? 'text-[#050506] font-bold'
                    : 'text-[rgba(245,246,248,0.6)] hover:text-[#F5F6F8] hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 rounded-full bg-[#1FD8B8]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <TabIcon className="h-4 w-4" />
                  <span className="capitalize">
                    {tab === 'chat' ? 'Chat' : tab === 'image' ? 'Image Gen' : 'Video Gen'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Model Interactive Box */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-white/[0.06] bg-[#050506]/90 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1FD8B8]/25 bg-[#1FD8B8]/10 text-[#1FD8B8]">
                <IconComponent className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#F5F6F8]">{currentModel.name}</h4>
                  <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-[rgba(245,246,248,0.6)]">
                    {currentModel.tag}
                  </span>
                </div>
                <p className="text-xs text-[rgba(245,246,248,0.6)]">{currentModel.category}</p>
              </div>
            </div>

            {/* Cost Badge */}
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-[#1FD8B8]">
                {currentModel.cost} PTS
              </div>
              <span className="text-[10px] text-[rgba(245,246,248,0.4)]">{currentModel.unit}</span>
            </div>
          </div>

          {/* Interactive Prompt Input */}
          <div className="rounded-lg bg-black/40 p-3.5 border border-white/[0.03] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[rgba(245,246,248,0.4)] font-medium">
              <span>Interactive Live Prompt:</span>
              <span className="text-[#1FD8B8] font-mono text-[10px]">
                {user ? 'Authenticated Session' : 'Instant Preview'}
              </span>
            </div>
            <textarea
              rows={2}
              value={customPrompt || currentModel.prompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full resize-none bg-transparent text-xs text-[rgba(245,246,248,0.85)] font-mono leading-relaxed outline-none focus:text-white"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Trigger Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={isDeducting}
            onClick={handleExecute}
            className="w-full flex items-center justify-center gap-2.5 rounded-full bg-[#1FD8B8] h-12 text-sm font-bold text-[#050506] shadow-[0_4px_16px_rgba(31,216,184,0.25)] transition-all hover:bg-[#34e2c2] disabled:opacity-60"
          >
            {isDeducting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-[#050506]" />
                <span>Executing Model & Deducting Balance...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current text-[#050506]" />
                <span>Execute & Deduct (-{currentModel.cost} PTS)</span>
              </>
            )}
          </motion.button>

          {/* AI Response Output Terminal */}
          {aiOutput && (
            <div className="rounded-xl border border-[#1FD8B8]/25 bg-black/60 p-4 space-y-2">
              <div
                className="flex items-center justify-between cursor-pointer text-xs font-semibold text-[#1FD8B8]"
                onClick={() => setShowOutput(!showOutput)}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  <span>Model Response ({currentModel.name})</span>
                </div>
                {showOutput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>

              {showOutput && (
                <motion.pre
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-[rgba(245,246,248,0.9)] max-h-48 overflow-y-auto leading-relaxed border-t border-white/[0.06] pt-2"
                >
                  {aiOutput}
                </motion.pre>
              )}
            </div>
          )}
        </motion.div>

        {/* Real-time Ledger Log Feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[rgba(245,246,248,0.6)] px-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Recent Ledger Events
            </span>
            <button
              onClick={handleReset}
              className="text-[11px] text-[#1FD8B8] hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Reset Demo
            </button>
          </div>

          <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-lg bg-[#050506]/60 px-3 py-2 text-xs border border-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-3.5 w-3.5 text-[#1FD8B8]" />
                  <span className="text-[rgba(245,246,248,0.8)] font-medium">{log.opName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[rgba(245,246,248,0.4)] font-mono">{log.time}</span>
                  <span className="font-mono font-bold text-[#1FD8B8]">
                    {log.cost < 0
                      ? `+${Math.abs(log.cost).toLocaleString()} PTS`
                      : `-${log.cost} PTS`}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Trust Badges */}
        <div className="flex items-center justify-between text-[11px] text-[rgba(245,246,248,0.4)] border-t border-white/[0.06] pt-3.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1FD8B8]" />
            <span>Encrypted Edahabia & CIB Payment</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD8B8]" />
            <span>Instant API Balance Sync</span>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

export { LiveLedgerCard };
