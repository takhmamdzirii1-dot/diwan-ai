'use client';

import React, { useState } from 'react';
import AmbientMotionBackground from './components/AmbientMotionBackground';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import SpotlightCard from './components/SpotlightCard';
import ShimmerButton from './components/ShimmerButton';
import AuthModal from './components/AuthModal';
import TopUpModal, { type TopUpPlan } from './components/TopUpModal';
import useUser from './hooks/useUser';
import { 
  CreditCard, 
  Cpu, 
  Check, 
  ArrowUpRight
} from 'lucide-react';
import { aiModels } from './modelsData.js';

const PRICING_TIERS: (TopUpPlan & { desc: string; features: string[]; highlight: boolean })[] = [
  {
    name: 'Starter Pack',
    price: '1,500 DZD',
    points: '10,000 Points',
    ptsNum: 10000,
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
    ptsNum: 35000,
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
    ptsNum: 10000,
    desc: 'High-volume production teams requiring team seats and custom API tokens.',
    features: [
      'Maximum GPU throughput & concurrency',
      'Multi-seat workspace management',
      'Invoice & Tax Receipt for Algerian Companies',
      'Dedicated Account Manager on WhatsApp',
    ],
    highlight: false,
  },
];

export default function App() {
  const { user } = useUser();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [selectedTopUpPlan, setSelectedTopUpPlan] = useState<TopUpPlan>(PRICING_TIERS[1]);

  const openAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  React.useEffect(() => {
    const handleOpenAuth = (e: any) => {
      const mode = e.detail?.mode || 'signin';
      openAuth(mode);
    };
    window.addEventListener('vantra-open-auth', handleOpenAuth);
    return () => window.removeEventListener('vantra-open-auth', handleOpenAuth);
  }, []);

  const openTopUp = (plan?: TopUpPlan) => {
    if (!user) {
      // If user is not logged in, prompt sign up/sign in first
      openAuth('signup');
      return;
    }
    if (plan) {
      setSelectedTopUpPlan(plan);
    }
    setIsTopUpOpen(true);
  };

  const filteredModels = aiModels.filter((model: any) => {
    const matchesFilter = activeFilter === 'all' || model.category === activeFilter;
    const matchesSearch = 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.superpower.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="relative min-h-screen bg-[#050506] text-[#F5F6F8] selection:bg-[#1FD8B8] selection:text-[#050506]">
      {/* 1. Ambient Background Layer */}
      <AmbientMotionBackground />

      {/* 2. Navigation Header with Supabase Auth & Live Points */}
      <Navbar onOpenAuth={openAuth} onOpenTopUp={() => openTopUp()} />

      {/* 3. Hero Section with Live Interactive Ledger */}
      <main>
        <HeroSection onOpenAuth={openAuth} />

        {/* 4. AI Models Hub Section */}
        <section id="models" className="py-28 px-4 md:px-8 border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto space-y-14">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#1FD8B8]">
                <Cpu className="h-3.5 w-3.5" />
                <span>Global Model Catalog</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
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
                    className={`rounded-full px-4 py-2 text-xs font-medium transition duration-[250ms] ${
                      activeFilter === tab.id
                        ? 'bg-[#1FD8B8] text-[#050506] font-bold'
                        : 'border border-white/[0.06] bg-white/[0.035] text-[rgba(245,246,248,0.6)] hover:bg-white/[0.065] hover:text-white'
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
                className="w-full sm:w-72 rounded-full border border-white/[0.06] bg-[#050506] px-4 py-2.5 text-xs text-white placeholder-[rgba(245,246,248,0.4)] focus:border-[#1FD8B8] focus:outline-none"
              />
            </div>

            {/* Models Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredModels.map((model: any) => (
                <SpotlightCard
                  key={model.id}
                  className="p-7 space-y-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white font-heading">{model.name}</h3>
                        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[rgba(245,246,248,0.6)]">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#1FD8B8]">{model.superpower}</p>
                    </div>
                    <span className="rounded-full bg-[#1FD8B8]/10 px-3 py-1 text-xs font-mono font-bold text-[#1FD8B8] border border-[#1FD8B8]/25">
                      {model.costPts}
                    </span>
                  </div>

                  <p className="text-xs text-[rgba(245,246,248,0.6)] leading-relaxed">
                    {model.desc.en}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {model.capabilities?.map((cap: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 text-[11px] text-[rgba(245,246,248,0.6)]"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  <div className="border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs">
                    <span className="text-[rgba(245,246,248,0.4)]">Context: {model.contextWindow}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          openAuth('signup');
                        } else {
                          const ledgerElem = document.getElementById('interactive-ledger') || document.getElementById('hero');
                          if (ledgerElem) ledgerElem.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="flex items-center gap-1 font-medium text-[#1FD8B8] hover:underline"
                    >
                      <span>Run Model</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Pricing & DZD Top-Up Section */}
        <section id="pricing" className="py-28 px-4 md:px-8 border-t border-white/[0.06]">
          <div className="max-w-7xl mx-auto space-y-14">
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#1FD8B8]">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Transparent DZD Pricing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
                Simple Credit Packs • Pay with Edahabia & CIB
              </h2>
              <p className="text-sm text-[rgba(245,246,248,0.6)]">
                Points never expire. Use your balance across every model on demand.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-9">
              {PRICING_TIERS.map((tier, idx) => (
                <SpotlightCard
                  key={idx}
                  className={`p-9 flex flex-col justify-between space-y-6 ${
                    tier.highlight
                      ? 'border-[#1FD8B8]/35 bg-white/[0.05]'
                      : ''
                  }`}
                >
                  <div className="space-y-4">
                    {tier.highlight && (
                      <span className="inline-block rounded-full bg-[#F5B942] px-3 py-1 text-[10px] font-extrabold text-[#050506] uppercase tracking-wider">
                        Most Popular in Algeria
                      </span>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-white font-heading">{tier.name}</h3>
                      <p className="text-xs text-[rgba(245,246,248,0.6)] mt-1">{tier.desc}</p>
                    </div>

                    <div className="border-y border-white/[0.06] py-4 space-y-1">
                      <div className="text-3xl font-bold text-[#F5F6F8] font-mono">{tier.price}</div>
                      <div className="text-sm font-semibold text-[#1FD8B8] font-mono">{tier.points}</div>
                    </div>

                    <ul className="space-y-3 text-xs text-[rgba(245,246,248,0.7)]">
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
                    className={`w-full py-3 text-sm ${!tier.highlight ? '!bg-white/[0.05] !text-white' : ''}`}
                    onClick={() => openTopUp(tier)}
                  />
                </SpotlightCard>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#050506] py-14 px-4 md:px-8 text-center text-xs text-[rgba(245,246,248,0.4)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 VANTRA. All rights reserved. Unified AI Platform for Algeria.</p>
          <div className="flex items-center gap-6">
            <a href="#models" className="hover:text-white transition">Models Hub</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#" className="hover:text-white transition">Terms & Privacy</a>
          </div>
        </div>
      </footer>

      {/* 6. Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialMode={authMode}
        onSuccess={() => setIsAuthOpen(false)}
      />

      {/* 7. Chargily Top-Up Payment Modal */}
      <TopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        plan={selectedTopUpPlan}
        onSuccess={() => setIsTopUpOpen(false)}
      />
    </div>
  );
}
