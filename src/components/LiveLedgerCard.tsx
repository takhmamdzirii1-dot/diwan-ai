'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, Image as ImageIcon, Video, Play, ArrowDownRight, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import SpotlightCard from './SpotlightCard';

export type CategoryType = 'chat' | 'image' | 'video';

interface ModelInfo {
  name: string;
  provider: string;
  category: string;
  cost: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  prompt: string;
  unit: string;
  tag: string;
}

const LEDGER_MODELS: Record<CategoryType, ModelInfo> = {
  chat: {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    category: 'Advanced Reasoning, Coding & Document Analysis',
    cost: 25,
    icon: MessageSquare,
    color: '#1FD8B8',
    prompt: '"Write a marketing launch plan for an e-commerce store in Algeria with ad budget allocation."',
    unit: 'pts / query',
    tag: 'Flagship LLM',
  },
  image: {
    name: 'Flux.1 Pro',
    provider: 'Black Forest Labs',
    category: 'Photorealistic & Commercial Image Generation',
    cost: 65,
    icon: ImageIcon,
    color: '#6E6BFF',
    prompt: '"Cinematic 4K photograph of Algiers Casbah at sunset with dramatic warm golden lighting."',
    unit: 'pts / image',
    tag: 'Ultra-HD Image',
  },
  video: {
    name: 'Kling AI 1.5 HD',
    provider: 'Kuaishou',
    category: 'Photorealistic & Cinematic AI Video Generation (1080p)',
    cost: 450,
    icon: Video,
    color: '#F5B942',
    prompt: '"Cinematic drone shot soaring over Jijel coastal cliffs with realistic ocean waves."',
    unit: 'pts / 5s',
    tag: 'Cinematic Video',
  },
};

interface LogItem {
  id: string;
  opName: string;
  cost: number;
  time: string;
}

export default function LiveLedgerCard() {
  const [balance, setBalance] = useState<number>(10000);
  const [activeTab, setActiveTab] = useState<CategoryType>('chat');
  const [isDeducting, setIsDeducting] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogItem[]>([
    {
      id: 'init-1',
      opName: 'Initial Credit Balance Added (Edahabia/CIB)',
      cost: -10000,
      time: 'Just now',
    },
  ]);
  const [lastDeduction, setLastDeduction] = useState<number | null>(null);

  const currentModel = LEDGER_MODELS[activeTab];
  const IconComponent = currentModel.icon;

  const handleSimulate = () => {
    if (balance < currentModel.cost) {
      alert('Insufficient points for this operation. Resetting balance demo...');
      setBalance(10000);
      return;
    }

    setIsDeducting(true);
    setLastDeduction(currentModel.cost);

    setTimeout(() => {
      setBalance((prev) => Math.max(0, prev - currentModel.cost));
      setLogs((prev) => [
        {
          id: `${Date.now()}`,
          opName: `${currentModel.name} Execution`,
          cost: currentModel.cost,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev.slice(0, 4),
      ]);
      setIsDeducting(false);
    }, 450);
  };

  const handleReset = () => {
    setBalance(10000);
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
    <SpotlightCard className="w-full max-w-xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] border border-white/[0.09] bg-[#0E1017]/90 backdrop-blur-2xl">
      <div className="p-6 md:p-8 space-y-6">
        {/* Header: Title & Balance Pill */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#1FD8B8]/10 border border-[#1FD8B8]/30">
              <Sparkles className="h-5 w-5 text-[#1FD8B8] animate-pulse-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase text-white/90">
                VANTRA Live Ledger
              </h3>
              <p className="text-xs text-white/50">Unified DZD Credit Engine</p>
            </div>
          </div>

          {/* Balance Pill */}
          <div className="flex items-center gap-2.5 rounded-full bg-[#0A0B0F] px-4 py-2 border border-white/[0.08] shadow-inner">
            <span className="text-xs text-white/50">Available Balance:</span>
            <div className="relative flex items-center">
              <motion.span
                key={balance}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-base font-bold text-[#1FD8B8]"
              >
                {balance.toLocaleString()}
              </motion.span>
              <span className="ml-1 text-[11px] font-semibold text-[#F5B942]">PTS</span>

              {/* Floating deduction animation indicator */}
              <AnimatePresence>
                {isDeducting && lastDeduction && (
                  <motion.span
                    initial={{ opacity: 1, y: 0, scale: 1 }}
                    animate={{ opacity: 0, y: -24, scale: 1.1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65 }}
                    className="absolute -top-4 right-0 text-xs font-bold text-red-400 font-mono"
                  >
                    -{lastDeduction}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0A0B0F]/80 p-1.5 border border-white/[0.06]">
          {(['chat', 'image', 'video'] as CategoryType[]).map((tab) => {
            const isActive = activeTab === tab;
            const TabIcon = LEDGER_MODELS[tab].icon;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs md:text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? 'text-black shadow-lg font-bold'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-[#1FD8B8]"
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

        {/* Active Model Preview Box */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-white/[0.08] bg-[#0A0B0F]/90 p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border transition-colors"
                style={{
                  backgroundColor: `${currentModel.color}15`,
                  borderColor: `${currentModel.color}40`,
                }}
              >
                <IconComponent className="h-5 w-5" style={{ color: currentModel.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white">{currentModel.name}</h4>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    {currentModel.tag}
                  </span>
                </div>
                <p className="text-xs text-white/50">{currentModel.category}</p>
              </div>
            </div>

            {/* Cost Badge */}
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-[#1FD8B8]">
                {currentModel.cost} PTS
              </div>
              <span className="text-[10px] text-white/40">{currentModel.unit}</span>
            </div>
          </div>

          {/* Sample Prompt Container */}
          <div className="rounded-lg bg-black/40 p-3.5 border border-white/[0.04]">
            <div className="flex items-center justify-between text-[11px] text-white/40 mb-1.5 font-medium">
              <span>Simulated Execution Prompt:</span>
              <span className="text-[#1FD8B8] font-mono text-[10px]">Instant API Gateway</span>
            </div>
            <p className="text-xs text-white/80 font-mono leading-relaxed italic">
              {currentModel.prompt}
            </p>
          </div>

          {/* Trigger Simulation Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={isDeducting}
            onClick={handleSimulate}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#1FD8B8] via-[#1bbfa3] to-[#1FD8B8] py-3 text-sm font-bold text-[#0A0B0F] shadow-[0_4px_20px_rgba(31,216,184,0.3)] transition-all hover:shadow-[0_6px_25px_rgba(31,216,184,0.45)] disabled:opacity-60"
          >
            {isDeducting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-[#0A0B0F]" />
                <span>Executing API Call & Deducting Points...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current text-[#0A0B0F]" />
                <span>Simulate Deduction (-{currentModel.cost} PTS)</span>
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Real-time Ledger Log Feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-white/50 px-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Recent Ledger Events</span>
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
                className="flex items-center justify-between rounded-lg bg-[#0A0B0F]/60 px-3 py-2 text-xs border border-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <ArrowDownRight
                    className={`h-3.5 w-3.5 ${
                      log.cost < 0 ? 'text-[#1FD8B8]' : 'text-amber-400'
                    }`}
                  />
                  <span className="text-white/80 font-medium">{log.opName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 font-mono">{log.time}</span>
                  <span
                    className={`font-mono font-bold ${
                      log.cost < 0 ? 'text-[#1FD8B8]' : 'text-amber-400'
                    }`}
                  >
                    {log.cost < 0 ? `+${Math.abs(log.cost).toLocaleString()} PTS` : `-${log.cost} PTS`}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="flex items-center justify-between text-[11px] text-white/45 border-t border-white/[0.06] pt-3.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#1FD8B8]" />
            <span>Encrypted Edahabia & CIB Payment</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#6E6BFF]" />
            <span>Instant API Balance Sync</span>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

export { LiveLedgerCard };
