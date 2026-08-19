'use client';

import React, { useState } from 'react';
import AmbientMotionBackground from './components/AmbientMotionBackground';
import HeroSection from './components/HeroSection';
import SpotlightCard from './components/SpotlightCard';
import ShimmerButton from './components/ShimmerButton';
import { 
  Sparkles, 
  CreditCard, 
  Cpu, 
  Check, 
  ArrowUpRight
} from 'lucide-react';
import { aiModels } from './modelsData.js';

export default function App() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModels = aiModels.filter((model: any) => {
    const matchesFilter = activeFilter === 'all' || model.category === activeFilter;
    const matchesSearch = 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.superpower.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="relative min-h-screen bg-[#08090C] text-[#F5F6F8] selection:bg-[#1FD8B8] selection:text-[#08090C]">
      {/* 1. Ambient Background Layer */}
      <AmbientMotionBackground />

      {/* 2. Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.09] bg-[#08090C]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-4 md:px-8">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1FD8B8] p-2 shadow-[0_0_20px_rgba(31,216,184,0.3)]">
              <Sparkles className="h-6 w-6 text-[#08090C]" />
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-white font-heading">VANTRA</span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-[#1FD8B8]">
                Algerian AI Gateway
              </span>
            </div>
          </a>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[rgba(245,246,248,0.6)]">
            <a href="#hero" className="transition hover:text-white">Home</a>
            <a href="#models" className="transition hover:text-white">AI Models</a>
            <a href="#pricing" className="transition hover:text-white">Pricing & DZD</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.045] px-4 py-2.5 text-xs font-semibold text-[#F5F6F8] hover:bg-white/[0.08] transition duration-[250ms]"
            >
              Sign In
            </a>
            <ShimmerButton
              text="Top Up Balance"
              onClick={() => {
                const pricingElem = document.getElementById('pricing');
                if (pricingElem) pricingElem.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs px-4 py-2"
            />
          </div>
        </div>
      </header>

      {/* 3. Hero Section with Live Interactive Ledger */}
      <main>
        <HeroSection />

        {/* 4. AI Models Hub Section */}
        <section id="models" className="py-24 px-4 md:px-8 border-t border-white/[0.09]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.045] px-3.5 py-1 text-xs font-semibold text-[#1FD8B8]">
                <Cpu className="h-3.5 w-3.5" />
                <span>Global Model Catalog</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-heading">
                Discover & Run the World's Best AI Foundation Models
              </h2>
              <p className="text-sm sm:text-base text-[rgba(245,246,248,0.6)]">
                Easily compare, benchmark, and trigger frontier models with instant DZD points deduction.
              </p>
            </div>

            {/* Filter Tabs & Search: Unified Glass Pills */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All Models' },
                  { id: 'chat', label: 'Chat & Code' },
                  { id: 'image', label: 'Image Generation' },
                  { id: 'video', label: 'Cinematic Video' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition duration-[250ms] ${
                      activeFilter === tab.id
                        ? 'bg-[#1FD8B8] text-[#08090C] shadow-[0_0_14px_rgba(31,216,184,0.35)]'
                        : 'border border-white/[0.09] bg-white/[0.045] text-[rgba(245,246,248,0.6)] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models (e.g. Claude, Flux, Kling, DeepSeek)..."
                className="w-full sm:w-72 rounded-full border border-white/[0.09] bg-[#08090C] px-4 py-2.5 text-xs text-white placeholder-[rgba(245,246,248,0.45)] focus:border-[#1FD8B8] focus:outline-none"
              />
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModels.map((model: any) => (
                <SpotlightCard
                  key={model.id}
                  className="p-6 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white font-heading">{model.name}</h3>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[rgba(245,246,248,0.6)]">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#1FD8B8]">{model.superpower}</p>
                    </div>
                    <span className="rounded-full bg-[#1FD8B8]/10 px-3 py-1 text-xs font-mono font-bold text-[#F5B942] border border-[#F5B942]/30">
                      {model.costPts}
                    </span>
                  </div>

                  <p className="text-xs text-[rgba(245,246,248,0.6)] leading-relaxed">
                    {model.desc.en}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {model.capabilities?.map((cap: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-[11px] text-[rgba(245,246,248,0.6)]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  <div className="border-t border-white/[0.09] pt-4 flex items-center justify-between text-xs">
                    <span className="text-[rgba(245,246,248,0.45)]">Context: {model.contextWindow}</span>
                    <a
                      href="#pricing"
                      className="flex items-center gap-1 font-semibold text-[#1FD8B8] hover:underline"
                    >
                      <span>Run Model</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Pricing & DZD Top-Up Section (Gold only for Prices & Points) */}
        <section id="pricing" className="py-24 px-4 md:px-8 border-t border-white/[0.09]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.045] px-3.5 py-1 text-xs font-semibold text-[#F5B942]">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Transparent DZD Pricing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-heading">
                Simple Credit Packs • Pay with Edahabia & CIB
              </h2>
              <p className="text-sm text-[rgba(245,246,248,0.6)]">
                Points never expire. Use your balance across every model on demand.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  name: 'Starter Pack',
                  price: '1,500 DZD',
                  points: '10,000 Points',
                  desc: 'Perfect for students, individual developers & exploring AI models.',
                  features: [
                    'Access to all Chat & Coding Models',
                    'Up to 400 Claude 3.5 Sonnet queries',
                    'Edahabia & CIB instant verification',
                    'Points never expire',
                  ],
                  highlight: false,
                },
                {
                  name: 'Pro Creator',
                  price: '4,500 DZD',
                  points: '35,000 Points',
                  desc: 'Best for agencies, freelance designers, video creators & power users.',
                  features: [
                    'All AI Models (Chat, Flux 4K, Kling HD)',
                    'Priority GPU queue access',
                    'Dedicated BaridiMob & CIB fast gateway',
                    'Developer API Key access included',
                    'Trilingual support (EN, FR, AR)',
                  ],
                  highlight: true,
                },
                {
                  name: 'Enterprise / Agency',
                  price: '12,000 DZD',
                  points: '100,000 Points',
                  desc: 'High-volume production teams requiring team seats and custom API tokens.',
                  features: [
                    'Maximum GPU throughput & concurrency',
                    'Multi-seat workspace management',
                    'Invoice & Tax Receipt for Algerian Companies',
                    'Dedicated Account Manager on WhatsApp',
                  ],
                  highlight: false,
                },
              ].map((tier, idx) => (
                <SpotlightCard
                  key={idx}
                  className={`p-8 flex flex-col justify-between space-y-6 ${
                    tier.highlight
                      ? 'border-[#1FD8B8]/40 shadow-[0_0_40px_rgba(31,216,184,0.15)] bg-white/[0.06]'
                      : ''
                  }`}
                >
                  <div className="space-y-4">
                    {tier.highlight && (
                      <span className="inline-block rounded-full bg-[#F5B942] px-3 py-1 text-[11px] font-extrabold text-[#08090C] uppercase tracking-wider">
                        Most Popular in Algeria
                      </span>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-white font-heading">{tier.name}</h3>
                      <p className="text-xs text-[rgba(245,246,248,0.6)] mt-1">{tier.desc}</p>
                    </div>

                    <div className="border-y border-white/[0.09] py-4 space-y-1">
                      <div className="text-3xl font-extrabold text-[#F5B942] font-mono">{tier.price}</div>
                      <div className="text-sm font-bold text-[#F5B942] font-mono">{tier.points}</div>
                    </div>

                    <ul className="space-y-2.5 text-xs text-[rgba(245,246,248,0.7)]">
                      {tier.features.map((feat, i) => (
                        <li key={i} className="flex items-center gap-2.5">
                          <Check className="h-4 w-4 text-[#1FD8B8] shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <ShimmerButton
                    text={`Top Up ${tier.price}`}
                    className={`w-full py-3 text-sm ${!tier.highlight ? '!bg-white/[0.06] !text-white' : ''}`}
                    onClick={() => alert(`Starting DZD payment checkout for ${tier.name}...`)}
                  />
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.09] bg-[#08090C] py-12 px-4 md:px-8 text-center text-xs text-[rgba(245,246,248,0.45)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 VANTRA. All rights reserved. Unified AI Platform for Algeria.</p>
          <div className="flex items-center gap-6">
            <a href="#models" className="hover:text-white transition">Models Hub</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#" className="hover:text-white transition">Terms & Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
