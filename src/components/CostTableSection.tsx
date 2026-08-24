'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Table, Search, Sparkles, Check, ArrowRight, Zap } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import SpotlightCard from './SpotlightCard';
import { getModelCost } from '../config/pricing';

const COST_ROWS = [
  {
    model: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    category: 'Chat & Code',
    ptsCost: `${getModelCost('anthropic/claude-3.5-sonnet')} pts`,
    dzdEquiv: '~15.00 DZD / query',
    yieldPer1000DZD: '66 Deep Code Audits',
    benchmark: '92.0% HumanEval',
  },
  {
    model: 'GPT-4o (Omni)',
    provider: 'OpenAI',
    category: 'Vision & Reasoning',
    ptsCost: `${getModelCost('openai/gpt-4o')} pts`,
    dzdEquiv: '~18.00 DZD / query',
    yieldPer1000DZD: '55 Multimodal Queries',
    benchmark: '88.7% MMLU',
  },
  {
    model: 'DeepSeek R1 / V3',
    provider: 'DeepSeek AI',
    category: 'Deep Reasoning',
    ptsCost: `${getModelCost('deepseek/deepseek-chat')} pts`,
    dzdEquiv: '~3.00 DZD / query',
    yieldPer1000DZD: '333 Math & Logic Tasks',
    benchmark: '96.3% MATH-500',
  },
  {
    model: 'Flux.1 Pro',
    provider: 'Black Forest Labs',
    category: '4K Image Generation',
    ptsCost: `${getModelCost('flux-1-pro')} pts`,
    dzdEquiv: '~39.00 DZD / image',
    yieldPer1000DZD: '25 Ultra-HD 4K Artworks',
    benchmark: 'Top Photorealism',
  },
  {
    model: 'Kling AI 1.5 HD',
    provider: 'Kuaishou',
    category: 'Cinematic 1080p Video',
    ptsCost: `${getModelCost('kling-ai-1-5')} pts`,
    dzdEquiv: '~144.00 DZD / 5s video',
    yieldPer1000DZD: '7 Cinematic Video Clips',
    benchmark: '60fps Fluid Motion',
  },
  {
    model: 'Llama 3.3 70B Instruct',
    provider: 'Meta',
    category: 'High-Speed Chat',
    ptsCost: `${getModelCost('meta-llama/llama-3.2-3b-instruct:free')} pts`,
    dzdEquiv: 'Free',
    yieldPer1000DZD: 'Unlimited Fast Summaries',
    benchmark: 'Open-Source King',
  },
];

export default function CostTableSection() {
  const { openAuthModal } = useModal();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredRows = COST_ROWS.filter(
    (row) =>
      row.model.toLowerCase().includes(filterQuery.toLowerCase()) ||
      row.provider.toLowerCase().includes(filterQuery.toLowerCase()) ||
      row.category.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <section id="cost-table" className="py-28 px-4 md:px-8 border-t border-white/[0.06] relative">
      <div className="max-w-7xl mx-auto space-y-14">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#1FD8B8]">
              <Table className="h-3.5 w-3.5" />
              <span>Transparent Yield Matrix</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
              How Much Can You Build with 1,000 DZD?
            </h2>
            <p className="text-sm text-[rgba(245,246,248,0.6)]">
              Direct point cost mapping. No subscription lock-in, no hidden overhead fees.
            </p>
          </div>

          <div className="w-full md:w-72">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-[rgba(245,246,248,0.4)]" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter models or providers..."
                className="w-full rounded-full border border-white/[0.06] bg-[#050506] py-2 pl-10 pr-4 text-xs text-white placeholder-[rgba(245,246,248,0.4)] focus:border-[#1FD8B8] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0B0D]/75 backdrop-blur-xl shadow-2xl">
          <table className="hidden md:table w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] uppercase tracking-wider text-[rgba(245,246,248,0.5)]">
                <th className="py-4 px-6 font-semibold">AI Model</th>
                <th className="py-4 px-6 font-semibold">Provider</th>
                <th className="py-4 px-6 font-semibold">Category</th>
                <th className="py-4 px-6 font-semibold">Point Cost</th>
                <th className="py-4 px-6 font-semibold">Estimated DZD Cost</th>
                <th className="py-4 px-6 font-semibold text-[#1FD8B8]">Yield per 1,000 DZD</th>
                <th className="py-4 px-6 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-white/[0.025] transition duration-150"
                >
                  <td className="py-4 px-6 font-bold text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-[#1FD8B8]" />
                      <span>{row.model}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-[rgba(245,246,248,0.7)] whitespace-nowrap">
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-[rgba(245,246,248,0.6)]">
                      {row.provider}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[rgba(245,246,248,0.6)] whitespace-nowrap">
                    {row.category}
                  </td>
                  <td className="py-4 px-6 font-mono font-bold text-[#1FD8B8] whitespace-nowrap">
                    {row.ptsCost}
                  </td>
                  <td className="py-4 px-6 font-mono text-[rgba(245,246,248,0.8)] whitespace-nowrap">
                    {row.dzdEquiv}
                  </td>
                  <td className="py-4 px-6 font-medium text-[#1FD8B8] whitespace-nowrap">
                    {row.yieldPer1000DZD}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openAuthModal('signup')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1FD8B8] hover:underline"
                    >
                      <span>Try Now</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col divide-y divide-white/[0.04]">
            {filteredRows.map((row, idx) => (
              <div key={idx} className="p-4 space-y-3 hover:bg-white/[0.025] transition duration-150">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#1FD8B8]" />
                    <span className="font-bold text-white text-sm">{row.model}</span>
                  </div>
                  <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-[rgba(245,246,248,0.6)]">
                    {row.provider}
                  </span>
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.5)]">Category</span>
                  <span className="text-[rgba(245,246,248,0.8)]">{row.category}</span>
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.5)]">Point Cost</span>
                  <span className="font-mono font-bold text-[#1FD8B8]">{row.ptsCost}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.5)]">Est. DZD Cost</span>
                  <span className="font-mono text-[rgba(245,246,248,0.8)]">{row.dzdEquiv}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.5)] text-[#1FD8B8]/70">Yield / 1000 DZD</span>
                  <span className="font-medium text-[#1FD8B8] text-right max-w-[150px]">{row.yieldPer1000DZD}</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1FD8B8] hover:underline"
                  >
                    <span>Try Now</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
