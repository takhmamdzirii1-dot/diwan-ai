'use client';

import React, { useState, useEffect, useRef } from 'react';
import { VantraLogo } from './VantraLogo';
import { Check, ShieldCheck, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import useUser from '../hooks/useUser';
import HeroCinematicBackground from './HeroCinematicBackground';
import { aiModels } from '../modelsData.js';
import { translations } from '../translations.js';
import { TOPUP_PLANS } from '../config/pricing';

export default function OriginalLandingPage() {
  const { user, balance, signOut, refreshBalance } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();

  // Language state: 'en' | 'fr' | 'ar'
  const [lang, setLang] = useState<'en' | 'fr' | 'ar'>('en');

  // Ledger state
  const [simBalance, setSimBalance] = useState(10000);
  const [ledgerCategory, setLedgerCategory] = useState<'chat' | 'image' | 'video'>('chat');
  const [ledgerLogs, setLedgerLogs] = useState<Array<{ op: string; pts: string; color: string }>>([
    { op: '[Initial Balance Credited]', pts: '+10,000 pts', color: 'var(--teal)' },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Models Explorer state
  const [modelFilter, setModelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cost table filter state
  const [tableFilter, setTableFilter] = useState('all');

  // FAQ open index state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User dropdown state
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const t = translations[lang] || translations.en;

  // Change HTML dir on language change
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Card spotlight cursor tracking
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      const cards = document.querySelectorAll(
        '.feature-card, .step-card, .ticket-card, .ledger-device, .floating-card, .model-card, .closing-card'
      );
      cards.forEach((card) => {
        const rect = (card as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        (card as HTMLElement).style.setProperty('--mouse-x', `${x}px`);
        (card as HTMLElement).style.setProperty('--mouse-y', `${y}px`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  const claudeCost = 25;
  const fluxCost = 65;
  const klingCost = 240;

  // Ledger configuration by category & language
  const ledgerConfigs = {
    en: {
      chat: {
        name: 'Claude 3.5 Sonnet',
        category: 'Advanced Reasoning, Coding & Document Analysis',
        icon: 'fa-brain',
        cost: claudeCost,
        prompt: '"Write a marketing launch plan for an e-commerce store in Algeria with ad budget allocation."',
        btnText: `Simulate Chat Query (-${claudeCost} pts)`,
        opName: 'Claude 3.5 Query (Chat)',
        unit: 'pts / request',
      },
      image: {
        name: 'Flux.1 Pro (Black Forest Labs)',
        category: 'Photorealistic & Commercial Image Generation',
        icon: 'fa-image',
        cost: fluxCost,
        prompt: '"Cinematic 4K photograph of Algiers Casbah at sunset with dramatic warm lighting."',
        btnText: `Simulate Image Render (-${fluxCost} pts)`,
        opName: 'Flux.1 Pro Render (Image)',
        unit: 'pts / image',
      },
      video: {
        name: 'Kling AI 1.5 HD (1080p)',
        category: 'Photorealistic & Cinematic AI Video Generation',
        icon: 'fa-video',
        cost: klingCost,
        prompt: '"Cinematic drone shot soaring over Jijel coastal cliffs with realistic ocean waves."',
        btnText: `Simulate 5s Video Cut (-${klingCost} pts)`,
        opName: 'Kling AI Video (5s)',
        unit: 'pts / 5s',
      },
    },
    fr: {
      chat: {
        name: 'Claude 3.5 Sonnet',
        category: 'Raisonnement Avancé, Code & Analyse de Documents',
        icon: 'fa-brain',
        cost: claudeCost,
        prompt: '"Rédigez un plan de lancement marketing pour une boutique e-commerce en Algérie avec budget publicitaire."',
        btnText: `Tester l'appel Chat (-${claudeCost} pts)`,
        opName: 'Appel Claude 3.5 (Chat)',
        unit: 'pts / requête',
      },
      image: {
        name: 'Flux.1 Pro (Black Forest Labs)',
        category: "Génération d'Images Photoréalistes et Commerciales",
        icon: 'fa-image',
        cost: fluxCost,
        prompt: '"Photographie 4K cinématique de la Casbah d\'Alger au coucher du soleil avec lumière dorée."',
        btnText: `Tester le rendu Image (-${fluxCost} pts)`,
        opName: 'Rendu Flux.1 Pro (Image)',
        unit: 'pts / image',
      },
      video: {
        name: 'Kling AI 1.5 HD (1080p)',
        category: 'Génération Vidéo IA Photoréaliste et Cinématique',
        icon: 'fa-video',
        cost: klingCost,
        prompt: '"Prise de vue cinématique par drone au-dessus des falaises de Jijel avec vagues réalistes."',
        btnText: `Tester la vidéo 5s (-${klingCost} pts)`,
        opName: 'Production Kling AI (5s)',
        unit: 'pts / 5s',
      },
    },
    ar: {
      chat: {
        name: 'Claude 3.5 Sonnet',
        category: 'محادثة فائقة الذكاء وتحليل المستندات',
        icon: 'fa-brain',
        cost: claudeCost,
        prompt: '"اكتب لي خطة تسويقية لمشروع متجر إلكتروني في الجزائر بالدارجة مع ميزانية الإعلانات."',
        btnText: `جرّب استدعاء نموذج المحادثة (-${claudeCost} نقطة)`,
        opName: 'استدعاء Claude 3.5 (محادثة)',
        unit: 'نقطة / طلب',
      },
      image: {
        name: 'Flux.1 Pro (Black Forest Labs)',
        category: 'توليد صور فوتوغرافية وإعلانية واقعية',
        icon: 'fa-image',
        cost: fluxCost,
        prompt: '"صورة فوتوغرافية احترافية لقصبة الجزائر وقت الغروب، إضاءة سينمائية دقيقة بدقة 4K."',
        btnText: `جرّب توليد صورة سينمائية (-${fluxCost} نقطة)`,
        opName: 'توليد صورة Flux.1 Pro',
        unit: 'نقطة / صورة',
      },
      video: {
        name: 'Kling AI 1.5 HD (1080p)',
        category: 'توليد مقاطع فيديو واقعية وحركة سينمائية',
        icon: 'fa-video',
        cost: klingCost,
        prompt: '"مشهد درون سينمائي يحلق فوق شواطئ جيجل الخلابة مع حركة أمواج واقعية."',
        btnText: `جرّب إنتاج فيديو 5 ثوانٍ (-${klingCost} نقطة)`,
        opName: 'إنتاج فيديو Kling AI (5s)',
        unit: 'نقطة / 5 ثوانٍ',
      },
    },
  };

  const currentLedger = ledgerConfigs[lang][ledgerCategory];

  const handleSimulateLedger = async () => {
    if (isExecuting) return;
    setIsExecuting(true);

    const cost = currentLedger.cost;
    setSimBalance((prev) => Math.max(0, prev - cost));

    const newLog = {
      op: `${currentLedger.opName}`,
      pts: `-${cost} ${t.pointsUnit || 'pts'}`,
      color: 'var(--gold)',
    };

    setLedgerLogs((prev) => [newLog, ...prev.slice(0, 7)]);

    // If logged in, refresh real balance
    if (user) {
      refreshBalance();
    }

    setTimeout(() => {
      setIsExecuting(false);
    }, 400);
  };

  // Filter models
  const filteredModels = aiModels.filter((model: any) => {
    const matchesCat =
      modelFilter === 'all' ||
      (modelFilter === 'darja' ? model.badgeType === 'darja' || model.arabicDarjaScore === '99%' : model.category === modelFilter);
    const matchesQuery =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.superpower.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="vantra-app-root">
      {/* Ambient glowing removed to keep design clean */}
      <div className="ambient-bg-clean">
        <div className="noise-overlay" />
      </div>

      {/* Mobile Menu Overlay & Sheet */}
      <div
        className={`mobile-menu-overlay ${mobileMenuOpen ? 'active' : ''}`}
        id="mobile-menu-overlay"
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className={`mobile-sheet ${mobileMenuOpen ? 'active' : ''}`} id="mobile-sheet">
        <div className="mobile-sheet-header">
          <div className="brand-logo">
            <div className="logo-badge">
              <VantraLogo className="w-full h-full" />
            </div>
            <span className="brand-name">VANTRA</span>
          </div>
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Menu"
          >
            ✕
          </button>
        </div>

        {/* Mobile Language Selector */}
        <div className="mobile-lang-wrap">
          <span className="mobile-lang-label">
            <i className="fa-solid fa-globe" /> Language:
          </span>
          <div className="lang-switcher mobile-lang-switcher">
            <button
              type="button"
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
              onClick={() => setLang('fr')}
            >
              FR
            </button>
            <button
              type="button"
              className={`lang-btn ${lang === 'ar' ? 'active' : ''}`}
              onClick={() => setLang('ar')}
            >
              عربي
            </button>
          </div>
        </div>

        <ul className="mobile-nav-links">
          <li>
            <a href="#hero" onClick={() => setMobileMenuOpen(false)}>
              {t.navHome || 'Home'}
            </a>
          </li>
          <li>
            <a href="#models" onClick={() => setMobileMenuOpen(false)}>
              {t.navModels || 'Models'}
            </a>
          </li>
          <li>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>
              {t.navFeatures || 'Features'}
            </a>
          </li>
          <li>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
              {t.navHowItWorks || 'How It Works'}
            </a>
          </li>
          <li>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>
              {t.navPricing || 'Pricing'}
            </a>
          </li>
          <li>
            <a href="#cost-table" onClick={() => setMobileMenuOpen(false)}>
              {t.navCostTable || 'Cost Table'}
            </a>
          </li>
          <li>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>
              {t.navFaq || 'FAQ'}
            </a>
          </li>
        </ul>

        <div className="mobile-sheet-actions">
          {user ? (
            <button
              className="btn-primary"
              onClick={() => {
                setMobileMenuOpen(false);
                openTopUpModal();
              }}
            >
              <i className="fa-solid fa-wallet" />
              <span>
                {balance.toLocaleString()} {t.pointsUnit || 'PTS'} • Top Up
              </span>
            </button>
          ) : (
            <>
              <button
                className="btn-ghost"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('signin');
                }}
              >
                {t.btnLogin || 'Login'}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('signup');
                }}
              >
                <i className="fa-solid fa-bolt" />
                <span>{t.btnTopup || 'Get Started'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ==========================================================================
         1. STICKY HEADER
         ========================================================================== */}
      <header className="header" id="main-header">
        <div className="container header-inner">
          {/* Logo */}
          <a href="#hero" className="brand-logo" aria-label="VANTRA Home">
            <div className="logo-badge">
              <VantraLogo className="w-full h-full" />
            </div>
            <div className="brand-name-group">
              <span className="brand-name">VANTRA</span>
              <span className="brand-sub">{t.brandSubtitle || 'Algerian AI Platform'}</span>
            </div>
          </a>

          {/* Actions — minimal: Sign In + Get Started */}
          <div className="header-actions">
            {user ? (
              <div className="flex items-center gap-3 relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 pr-3 text-xs font-semibold text-white hover:bg-white/[0.08] transition"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black font-bold text-xs">
                    {(user.user_metadata?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <span className="max-w-[90px] truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="user-dropdown absolute right-0 top-12 w-52 rounded-2xl border border-white/[0.06] bg-[#0A0B0D] p-2 shadow-2xl z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
                    >
                      <i className="fa-solid fa-arrow-right-from-bracket" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  className="text-[13.5px] font-medium text-white/60 hover:text-white transition-colors cursor-pointer px-2"
                  onClick={() => openAuthModal('signin')}
                >
                  Sign In
                </button>
                <button
                  className="h-10 px-5 rounded-xl bg-white text-black text-[13.5px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98]"
                  onClick={() => openAuthModal('signup')}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ==========================================================================
         2. HERO SECTION & LIVE INTERACTIVE LEDGER
         ========================================================================== */}
      <section className="hero" id="hero">
        {/* Clean Background instead of Cinematic Quantum Wave */}
        <div className="absolute inset-0 bg-[#050506] pointer-events-none z-0" />

        <div className="container hero-grid relative z-10">
          {/* Hero Text Content */}
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              <span className="hero-badge-text">
                {t.heroBadge || '100% Algerian Platform — Pay directly in DZD'}
              </span>
            </div>

            <h1 className="hero-title text-white">
              <span>Every AI model. One balance.</span>
            </h1>

            <p className="hero-subtitle">
              Chat, image, and video generation from the world's best models — pay locally with Edahabia &amp; CIB.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                className="h-12 px-8 rounded-xl bg-white text-black text-[15px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98]"
                onClick={() => (user ? openTopUpModal() : openAuthModal('signup'))}
              >
                Get Started
              </button>
              <a
                href="#cost-table"
                className="h-12 px-7 inline-flex items-center rounded-xl border border-white/15 bg-white/[0.03] text-[14.5px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Explore Cost Table
              </a>
            </div>

            <div className="hero-guarantee">
              <div className="guarantee-item">
                <Check className="h-3.5 w-3.5 text-white/80" />
                <span>{t.guaranteeEdahabia || 'Secure Payment via Edahabia & CIB'}</span>
              </div>
              <div className="guarantee-item">
                <ShieldCheck className="h-3.5 w-3.5 text-white/80" />
                <span>{t.guaranteeExpiry || 'Non-expiring Credit Points'}</span>
              </div>
              <div className="guarantee-item">
                <RefreshCw className="h-3.5 w-3.5 text-white/80" />
                <span>{t.guaranteeNoLockin || 'Zero Monthly Commitment'}</span>
              </div>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-num">12+</span>
                <span className="stat-label">{t.statModels || 'Global Models'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">100%</span>
                <span className="stat-label">{t.statPayment || 'Local Payment'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">0s</span>
                <span className="stat-label">{t.statActivation || 'Instant Activation'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-num">99.9%</span>
                <span className="stat-label">{t.statUptime || 'High Availability'}</span>
              </div>
            </div>
          </div>

          {/* Premium product mockup — quiet, no simulation noise */}
          <div className="ledger-device" id="interactive-ledger">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 px-5 pt-4 pb-3 border-b border-white/[0.06]">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ms-auto text-[10px] font-mono tracking-[0.18em] uppercase text-white/30">
                VANTRA Studio
              </span>
            </div>

            <div className="p-5 space-y-3">
              {/* Prompt row */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <p className="text-[12.5px] text-white/70 leading-relaxed">
                  "Cinematic 4K photograph of Algiers Casbah at sunset."
                </p>
              </div>

              {/* Rendered frame placeholder */}
              <div className="relative rounded-xl border border-white/[0.07] bg-[#121212] aspect-[16/10] overflow-hidden flex items-center justify-center">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/[0.04] blur-3xl" />
                <div className="flex flex-col items-center gap-2.5 text-white/25">
                  <ImageIcon style={{ fontSize: 22 }} />
                  <span className="text-[11px] font-mono tracking-[0.14em] uppercase">Render 4K · 00:12</span>
                </div>
              </div>

              {/* Balance chip */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
                <span className="text-[11.5px] text-white/45">Credit Balance</span>
                <span className="text-[13px] font-semibold text-white mono-num">
                  {(user ? balance : simBalance).toLocaleString()} PTS
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         3. INTERACTIVE AI MODEL EXPLORER & DIRECTORY
         ========================================================================== */}
      <section className="models-hub-section" id="models">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag">
              <i className="fa-solid fa-compass" />
              <span>{t.modelsHubTag || 'Comprehensive AI Model Hub'}</span>
            </span>
            <h2 className="section-title">
              {t.modelsHubTitle || "Discover & Run the World's Best AI Foundation Models"}
            </h2>
            <p className="section-desc">
              {t.modelsHubDesc ||
                'Easily search, compare, and launch top-tier models for Coding, Image Design, Cinematic Video, Audio Dubbing, and Algerian Darja understanding in one click.'}
            </p>
          </div>

          {/* Smart Search & Filter Control Bar */}
          <div className="models-hub-controls">
            {/* Search Bar */}
            <div className="model-search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                type="text"
                id="model-search-input"
                className="model-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any model by name, provider or task (e.g. Claude, Flux, DeepSeek, Coding, Darja, Video)..."
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear Search"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="model-filter-tabs">
              <button
                type="button"
                className={`model-filter-tab ${modelFilter === 'all' ? 'active' : ''}`}
                onClick={() => setModelFilter('all')}
              >
                <span>{t.filterAll || 'All Models'}</span>
              </button>
              <button
                type="button"
                className={`model-filter-tab ${modelFilter === 'chat' ? 'active' : ''}`}
                onClick={() => setModelFilter('chat')}
              >
                <i className="fa-solid fa-brain" style={{ color: 'var(--teal)', marginInlineEnd: '6px' }} />
                <span>{t.filterChat || '💬 Text, Code & Reasoning'}</span>
              </button>
              <button
                type="button"
                className={`model-filter-tab ${modelFilter === 'image' ? 'active' : ''}`}
                onClick={() => setModelFilter('image')}
              >
                <i className="fa-solid fa-palette" style={{ color: 'var(--teal)', marginInlineEnd: '6px' }} />
                <span>{t.filterImage || '🎨 Images & Art'}</span>
              </button>
              <button
                type="button"
                className={`model-filter-tab ${modelFilter === 'video' ? 'active' : ''}`}
                onClick={() => setModelFilter('video')}
              >
                <i className="fa-solid fa-video" style={{ color: 'var(--teal)', marginInlineEnd: '6px' }} />
                <span>{t.filterVideo || '🎥 Video & Motion'}</span>
              </button>
              <button
                type="button"
                className={`model-filter-tab darja-pill-tab ${modelFilter === 'darja' ? 'active' : ''}`}
                onClick={() => setModelFilter('darja')}
              >
                <i className="fa-solid fa-star" style={{ color: 'var(--teal)', marginInlineEnd: '6px' }} />
                <span>{t.tagDarjaFilter || '🇩🇿 Darja & Arabic Elite'}</span>
              </button>
            </div>
          </div>

          {/* Result Counter & Quick Tag Bar */}
          <div className="models-stats-bar">
            <div className="models-count-label">
              <span className="pulse-dot" />
              <span className="mono-num">{filteredModels.length}</span>{' '}
              <span>{t.modelsFoundCount || 'AI Models Available'}</span>
            </div>
            <div className="quick-tags">
              <span className="quick-tag" onClick={() => setSearchQuery('Coding')}>
                #Coding
              </span>
              <span className="quick-tag" onClick={() => setSearchQuery('Darja')}>
                #Darja
              </span>
              <span className="quick-tag" onClick={() => setSearchQuery('Photorealism')}>
                #Photorealism
              </span>
              <span className="quick-tag" onClick={() => setSearchQuery('Video')}>
                #1080pVideo
              </span>
              <span className="quick-tag" onClick={() => setSearchQuery('Reasoning')}>
                #Reasoning
              </span>
            </div>
          </div>

          {/* Dynamic AI Models Grid Container */}
          <div className="models-grid" id="models-grid-container">
            {filteredModels.map((model: any) => (
              <div key={model.id} className="model-card">
                <div className="model-card-header">
                  <div className="model-card-left">
                    <div className="model-card-avatar">
                      <i className={`fa-solid ${model.icon || 'fa-microchip'}`} />
                    </div>
                    <div>
                      <div className="model-card-title">{model.name}</div>
                      <div className="model-card-provider">{model.provider}</div>
                    </div>
                  </div>
                  <div className="model-card-cost mono-num">{model.costPts}</div>
                </div>

                <div className="model-card-superpower">{model.superpower}</div>

                <p className="model-card-desc">
                  {model.desc?.[lang] || model.desc?.en || model.desc}
                </p>

                <div className="model-card-badges">
                  {model.capabilities?.map((cap: string, i: number) => (
                    <span key={i} className="model-cap-pill">
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="model-card-footer">
                  <span className="model-context-window">
                    <i className="fa-solid fa-microchip" style={{ marginInlineEnd: '4px' }} />
                    {model.contextWindow}
                  </span>
                  <button
                    type="button"
                    className="model-run-btn"
                    onClick={() => {
                      if (!user) {
                        openAuthModal('signup');
                      } else {
                        const ledger = document.getElementById('interactive-ledger');
                        if (ledger) ledger.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <span>Run Model</span>
                    <i className="fa-solid fa-arrow-right" style={{ marginInlineStart: '4px' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Request A Model Banner */}
          <div className="request-model-banner">
            <div className="request-model-left">
              <div className="request-icon">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <div>
                <h4 className="request-title">{t.requestModelTitle || 'Looking for a model not listed here?'}</h4>
                <p className="request-desc">
                  {t.requestModelDesc ||
                    'We continuously add the latest AI models. Submit your desired model, and our engineering team will activate it in your dashboard within 24 hours.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary request-btn"
              onClick={() => openAuthModal('signup')}
            >
              <i className="fa-solid fa-plus" />
              <span>{t.btnRequestModel || 'Request an AI Model'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         4. FEATURES SECTION (4 CARDS)
         ========================================================================== */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag">
              <i className="fa-solid fa-shapes" />
              <span>{t.featuresTag || 'Platform Advantages'}</span>
            </span>
            <h2 className="section-title">
              {t.featuresTitle || 'Engineered specifically for the Algerian workflow'}
            </h2>
            <p className="section-desc">
              {t.featuresDesc ||
                'Say goodbye to foreign credit card hassles and managing dozens of subscriptions. A frictionless platform built for speed, affordability, and crystal-clear transparency.'}
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-credit-card" />
              </div>
              <h3 className="feature-title">{t.feat1Title || 'Instant Local Payment in Dinar'}</h3>
              <p className="feature-desc">
                {t.feat1Desc ||
                  "Recharge your balance in seconds using your postal Edahabia card or bank CIB cards through Algeria's official secure payment gateway, without needing Wise or Paysera."}
              </p>
              <div className="feature-badge-row">
                <span className="feature-chip">{t.feat1Chip1 || 'Edahabia Card'}</span>
                <span className="feature-chip">{t.feat1Chip2 || 'CIB Cards'}</span>
                <span className="feature-chip">{t.feat1Chip3 || 'BaridiMob App'}</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="feature-card gold-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-book-bookmark" />
              </div>
              <h3 className="feature-title">{t.feat2Title || 'Full Credit Ledger Transparency'}</h3>
              <p className="feature-desc">
                {t.feat2Desc ||
                  'No hidden fees, no recurring auto-renewals debited without your knowledge. Every AI prompt is logged in real-time in your ledger with exact point consumption.'}
              </p>
              <div className="feature-badge-row">
                <span className="feature-chip">{t.feat2Chip1 || 'Real-time Ledger'}</span>
                <span className="feature-chip">{t.feat2Chip2 || 'Precise Point Tracking'}</span>
                <span className="feature-chip">{t.feat2Chip3 || 'Zero Hidden Fees'}</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-wand-magic-sparkles" />
              </div>
              <h3 className="feature-title">{t.feat3Title || 'All Top Models in One Interface'}</h3>
              <p className="feature-desc">
                {t.feat3Desc ||
                  'Access leading text LLMs (Claude 3.5 & GPT-4o), photorealistic image generators (Flux.1 & Midjourney), and cinematic video models (Kling & Runway) without leaving your workspace.'}
              </p>
              <div className="feature-badge-row">
                <span className="feature-chip">{t.feat3Chip1 || 'Text & Coding'}</span>
                <span className="feature-chip">{t.feat3Chip2 || 'Ultra-HD Images'}</span>
                <span className="feature-chip">{t.feat3Chip3 || 'Cinematic Videos'}</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <i className="fa-solid fa-hourglass-half" />
              </div>
              <h3 className="feature-title">{t.feat4Title || 'Full Flexibility & Non-Expiring Points'}</h3>
              <p className="feature-desc">
                {t.feat4Desc ||
                  'Your points are 100% yours. Unlike traditional monthly subscriptions where unused quotas expire, VANTRA points never expire. Use them whenever you need.'}
              </p>
              <div className="feature-badge-row">
                <span className="feature-chip">{t.feat4Chip1 || 'Lifetime Validity'}</span>
                <span className="feature-chip">{t.feat4Chip2 || 'No Forced Monthly Fee'}</span>
                <span className="feature-chip">{t.feat4Chip3 || 'Total Budget Control'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         5. HOW IT WORKS (3 NUMBERED STEPS)
         ========================================================================== */}
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag gold">
              <i className="fa-solid fa-route" />
              <span>{t.howTag || 'Workflow Steps'}</span>
            </span>
            <h2 className="section-title">
              {t.howTitle || 'How to get started with VANTRA in 3 simple steps?'}
            </h2>
            <p className="section-desc">
              {t.howDesc ||
                'A smooth and fast onboarding process from registration to AI generation in under 2 minutes.'}
            </p>
          </div>

          <div className="steps-grid">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-num-badge">01</div>
              <h3 className="step-title">{t.step1Title || 'Create your VANTRA account'}</h3>
              <p className="step-desc">
                {t.step1Desc ||
                  'Sign up for free using your email or Google account to instantly activate your ledger and receive free trial points.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-num-badge">02</div>
              <h3 className="step-title">{t.step2Title || 'Top up your balance in DZD'}</h3>
              <p className="step-desc">
                {t.step2Desc ||
                  'Choose the credit pack that fits your workflow and pay securely with your Edahabia or CIB card with instant automated credit.'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-num-badge">03</div>
              <h3 className="step-title">{t.step3Title || 'Generate & create with elite models'}</h3>
              <p className="step-desc">
                {t.step3Desc ||
                  'Prompt chat models, render ultra-detailed images, and direct cinematic videos while monitoring your exact point balance in real time.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         6. PRICING SECTION (TICKET DESIGN)
         ========================================================================== */}
      <section className="pricing-section" id="pricing">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag">
              <i className="fa-solid fa-tags" />
              <span>{t.pricingTag || 'Credit Packs'}</span>
            </span>
            <h2 className="section-title">
              {t.pricingTitle || 'Transparent packs for students, creators & enterprises'}
            </h2>
            <p className="section-desc">
              {t.pricingDesc ||
                'Choose your balance in Algerian Dinar. Points never expire and are valid across all AI models without restriction.'}
            </p>
          </div>

          <div className="pricing-grid">
            {/* Plan 1: Starter */}
            <div className="ticket-card">
              <div className="ticket-header">
                <div className="ticket-plan-name">{t.planStarterName || 'Starter Pack • Beginner'}</div>
                <div className="ticket-plan-desc">
                  {t.planStarterDesc || 'Ideal for students and quick exploratory prompts'}
                </div>
                <div className="ticket-price-wrap">
                  <span className="ticket-price mono-num">1,800</span>
                  <span className="ticket-currency">{t.currencyDzd || 'DZD (دج)'}</span>
                </div>
                <div className="ticket-points-badge">
                  <span className="mono-num">2,500</span>
                  <span>{t.pointsUnit || 'Points'}</span>
                </div>
              </div>

              <div className="ticket-perforation">
                <div className="perforation-line" />
              </div>

              <div className="ticket-body">
                <ul className="ticket-features-list">
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      Approx. <b>100 Chat requests</b> with Claude 3.5 & GPT-4o
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      Generate up to <b>35 Ultra-HD images</b> with Flux.1
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Permanent balance validity with no expiration</span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Standard Email technical support</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="ticket-cta-btn"
                  onClick={() =>
                    openTopUpModal({
                      name: TOPUP_PLANS.starter.name,
                      price: TOPUP_PLANS.starter.priceFormatted,
                      points: TOPUP_PLANS.starter.pointsFormatted,
                      ptsNum: TOPUP_PLANS.starter.points,
                    })
                  }
                >
                  <span>{t.planStarterBtn || 'Top up 1,800 DZD Pack'}</span>
                  <i className="fa-solid fa-arrow-right icon-dir" />
                </button>
              </div>
            </div>

            {/* Plan 2: Pro Creator (Popular) */}
            <div className="ticket-card popular">
              <div className="ticket-popular-badge">
                {t.planProPopular || 'Most Popular • Recommended'}
              </div>
              <div className="ticket-header">
                <div className="ticket-plan-name">{t.planProName || 'Creator Pack • Pro'}</div>
                <div className="ticket-plan-desc">
                  {t.planProDesc || 'The ultimate choice for content creators, designers & freelancers'}
                </div>
                <div className="ticket-price-wrap">
                  <span className="ticket-price mono-num">4,500</span>
                  <span className="ticket-currency">{t.currencyDzd || 'DZD (دج)'}</span>
                </div>
                <div className="ticket-points-badge">
                  <span className="mono-num">7,500</span>
                  <span>{t.planProBonus || '+20% Bonus Points'}</span>
                </div>
              </div>

              <div className="ticket-perforation">
                <div className="perforation-line" />
              </div>

              <div className="ticket-body">
                <ul className="ticket-features-list">
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      <b>300+ Advanced reasoning prompts</b> with Claude 3.5 Sonnet
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      Render up to <b>110 Images</b> with Midjourney & Flux Pro
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      Generate up to <b>15 Cinematic Videos</b> with Kling & Runway
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Top priority GPU processing queue</span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Dedicated support via WhatsApp & Telegram</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="ticket-cta-btn"
                  onClick={() =>
                    openTopUpModal({
                      name: TOPUP_PLANS.creatorPro.name,
                      price: TOPUP_PLANS.creatorPro.priceFormatted,
                      points: TOPUP_PLANS.creatorPro.pointsFormatted,
                      ptsNum: TOPUP_PLANS.creatorPro.points,
                    })
                  }
                >
                  <span>{t.planProBtn || 'Top up 4,500 DZD Pack'}</span>
                  <i className="fa-solid fa-bolt" />
                </button>
              </div>
            </div>

            {/* Plan 3: Studio / Enterprise */}
            <div className="ticket-card">
              <div className="ticket-header">
                <div className="ticket-plan-name">{t.planEntName || 'Studio Pack • Enterprise'}</div>
                <div className="ticket-plan-desc">
                  {t.planEntDesc || 'For agencies, software teams & high-volume production'}
                </div>
                <div className="ticket-price-wrap">
                  <span className="ticket-price mono-num">12,000</span>
                  <span className="ticket-currency">{t.currencyDzd || 'DZD (دج)'}</span>
                </div>
                <div className="ticket-points-badge">
                  <span className="mono-num">22,000</span>
                  <span>{t.planEntBonus || '+35% Bonus Points'}</span>
                </div>
              </div>

              <div className="ticket-perforation">
                <div className="perforation-line" />
              </div>

              <div className="ticket-body">
                <ul className="ticket-features-list">
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      <b>1,000+ Deep reasoning & coding sessions</b> and document analysis
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      <b>350+ Commercial 4K images</b> for marketing & branding
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>
                      <b>50+ Full cinematic video scenes</b> with Runway Gen-3
                    </span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Dedicated API keys and application integration</span>
                  </li>
                  <li className="ticket-feature-item">
                    <i className="fa-solid fa-check" />
                    <span>Official commercial invoice + Dedicated Account Manager</span>
                  </li>
                </ul>
                <button
                  type="button"
                  className="ticket-cta-btn"
                  onClick={() =>
                    openTopUpModal({
                      name: TOPUP_PLANS.enterprise.name,
                      price: TOPUP_PLANS.enterprise.priceFormatted,
                      points: TOPUP_PLANS.enterprise.pointsFormatted,
                      ptsNum: TOPUP_PLANS.enterprise.points,
                    })
                  }
                >
                  <span>{t.planEntBtn || 'Top up 12,000 DZD Pack'}</span>
                  <i className="fa-solid fa-arrow-right icon-dir" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         7. TRANSPARENT CREDIT COST LEDGER TABLE
         ========================================================================== */}
      <section className="ledger-table-section" id="cost-table">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag">
              <i className="fa-solid fa-table-list" />
              <span>{t.costTableTag || 'Fair & Transparent Billing'}</span>
            </span>
            <h2 className="section-title">
              {t.costTableTitle || 'Point consumption per model operation'}
            </h2>
            <p className="section-desc">
              {t.costTableDesc ||
                'Know the precise cost in points for each AI call before generating, with guaranteed rate stability.'}
            </p>
          </div>

          <div className="table-card">
            <div className="table-filter-bar">
              <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                {t.filterLabel || 'Filter by model type:'}
              </div>
              <div className="filter-btn-group">
                <button
                  type="button"
                  className={`filter-tab ${tableFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTableFilter('all')}
                >
                  {t.filterAll || 'All'}
                </button>
                <button
                  type="button"
                  className={`filter-tab ${tableFilter === 'chat' ? 'active' : ''}`}
                  onClick={() => setTableFilter('chat')}
                >
                  {t.filterChat || 'Chat & LLMs'}
                </button>
                <button
                  type="button"
                  className={`filter-tab ${tableFilter === 'image' ? 'active' : ''}`}
                  onClick={() => setTableFilter('image')}
                >
                  {t.filterImage || 'Image Gen'}
                </button>
                <button
                  type="button"
                  className={`filter-tab ${tableFilter === 'video' ? 'active' : ''}`}
                  onClick={() => setTableFilter('video')}
                >
                  {t.filterVideo || 'Video Gen'}
                </button>
                <button
                  type="button"
                  className={`filter-tab ${tableFilter === 'audio' ? 'active' : ''}`}
                  onClick={() => setTableFilter('audio')}
                >
                  {t.filterAudio || 'Audio & Speech'}
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>{t.thModel || 'Model / Engine'}</th>
                    <th>{t.thCategory || 'Category & Function'}</th>
                    <th>{t.thUnit || 'Billing Unit'}</th>
                    <th>{t.thCostPoints || 'Cost in VANTRA Points'}</th>
                    <th>{t.thEquivalentDzd || 'Estimated Equivalent (DZD)'}</th>
                  </tr>
                </thead>
                <tbody id="cost-table-body">
                  {/* Chat Rows */}
                  {(tableFilter === 'all' || tableFilter === 'chat') && (
                    <>
                      <tr data-category="chat">
                        <td className="model-name-td">
                          <i className="fa-solid fa-brain" style={{ color: 'var(--teal)' }} />
                          <span>Claude 3.5 Sonnet</span>
                        </td>
                        <td>
                          <span className="model-type-badge">{t.badgeChatCoding || 'Chat & Code'}</span>
                        </td>
                        <td>{t.unitTokens1k || 'Per 1,000 Input/Output Tokens'}</td>
                        <td className="cost-highlight mono-num">25 pts</td>
                        <td className="mono-num">~ 18 DZD</td>
                      </tr>
                      <tr data-category="chat">
                        <td className="model-name-td">
                          <i className="fa-solid fa-robot" style={{ color: 'var(--teal)' }} />
                          <span>GPT-4o (OpenAI)</span>
                        </td>
                        <td>
                          <span className="model-type-badge">{t.badgeMultimodal || 'Multimodal Chat'}</span>
                        </td>
                        <td>{t.unitTokens1k || 'Per 1,000 Input/Output Tokens'}</td>
                        <td className="cost-highlight mono-num">20 pts</td>
                        <td className="mono-num">~ 14 DZD</td>
                      </tr>
                      <tr data-category="chat">
                        <td className="model-name-td">
                          <i className="fa-solid fa-microchip" style={{ color: 'var(--teal)' }} />
                          <span>DeepSeek V3 / R1</span>
                        </td>
                        <td>
                          <span className="model-type-badge">{t.badgeDeepReasoning || 'Deep Reasoning & Logic'}</span>
                        </td>
                        <td>{t.unitTokens1k || 'Per 1,000 Input/Output Tokens'}</td>
                        <td className="cost-highlight mono-num">10 pts</td>
                        <td className="mono-num">~ 7 DZD</td>
                      </tr>
                    </>
                  )}

                  {/* Image Rows */}
                  {(tableFilter === 'all' || tableFilter === 'image') && (
                    <>
                      <tr data-category="image">
                        <td className="model-name-td">
                          <i className="fa-solid fa-image" style={{ color: 'var(--gold)' }} />
                          <span>Flux.1 Pro (Schnell/Dev)</span>
                        </td>
                        <td>
                          <span
                            className="model-type-badge"
                            style={{ color: '#F5B942', background: 'rgba(245, 185, 66, 0.12)' }}
                          >
                            {t.badgeRealisticImages || 'Photorealistic Images'}
                          </span>
                        </td>
                        <td>{t.unitImage1k || 'Per Image (1024×1024)'}</td>
                        <td className="cost-highlight mono-num">65 pts</td>
                        <td className="mono-num">~ 45 DZD</td>
                      </tr>
                      <tr data-category="image">
                        <td className="model-name-td">
                          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--gold)' }} />
                          <span>Midjourney V6.1</span>
                        </td>
                        <td>
                          <span
                            className="model-type-badge"
                            style={{ color: '#F5B942', background: 'rgba(245, 185, 66, 0.12)' }}
                          >
                            {t.badgeCinematicArt || 'Cinematic Art & Design'}
                          </span>
                        </td>
                        <td>{t.unitImageDetail || 'Per High-Detail Render'}</td>
                        <td className="cost-highlight mono-num">80 pts</td>
                        <td className="mono-num">~ 55 DZD</td>
                      </tr>
                    </>
                  )}

                  {/* Video Rows */}
                  {(tableFilter === 'all' || tableFilter === 'video') && (
                    <>
                      <tr data-category="video">
                        <td className="model-name-td">
                          <i className="fa-solid fa-video" style={{ color: '#60A5FA' }} />
                          <span>Kling AI 1.5 HD</span>
                        </td>
                        <td>
                          <span
                            className="model-type-badge"
                            style={{ color: '#93C5FD', background: 'rgba(59, 130, 246, 0.12)' }}
                          >
                            {t.badgeVideoGen || 'AI Video Generation'}
                          </span>
                        </td>
                        <td>{t.unitVideo5s || 'Per 5-second video (1080p)'}</td>
                        <td className="cost-highlight mono-num">450 pts</td>
                        <td className="mono-num">~ 310 DZD</td>
                      </tr>
                      <tr data-category="video">
                        <td className="model-name-td">
                          <i className="fa-solid fa-clapperboard" style={{ color: '#60A5FA' }} />
                          <span>Runway Gen-3 Alpha</span>
                        </td>
                        <td>
                          <span
                            className="model-type-badge"
                            style={{ color: '#93C5FD', background: 'rgba(59, 130, 246, 0.12)' }}
                          >
                            {t.badgeHollywoodVideo || 'Hollywood Cinematic Video'}
                          </span>
                        </td>
                        <td>{t.unitVideoCinema || 'Per 5-second cinematic cut'}</td>
                        <td className="cost-highlight mono-num">520 pts</td>
                        <td className="mono-num">~ 360 DZD</td>
                      </tr>
                    </>
                  )}

                  {/* Audio Rows */}
                  {(tableFilter === 'all' || tableFilter === 'audio') && (
                    <tr data-category="audio">
                      <td className="model-name-td">
                        <i className="fa-solid fa-microphone-lines" style={{ color: '#A78BFA' }} />
                        <span>Whisper Large v3</span>
                      </td>
                      <td>
                        <span
                          className="model-type-badge"
                          style={{ color: '#C4B5FD', background: 'rgba(167, 139, 250, 0.12)' }}
                        >
                          {t.badgeAudioTranscription || 'Speech-to-Text & Transcription'}
                        </span>
                      </td>
                      <td>{t.unitAudioMin || 'Per minute of audio recording'}</td>
                      <td className="cost-highlight mono-num">15 pts</td>
                      <td className="mono-num">~ 10 DZD</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         8. FAQ SECTION (COLLAPSIBLE ACCORDION)
         ========================================================================== */}
      <section className="faq-section" id="faq">
        <div className="container">
          <div className="section-intro">
            <span className="section-tag gold">
              <i className="fa-solid fa-circle-question" />
              <span>{t.faqTag || 'Frequently Asked Questions'}</span>
            </span>
            <h2 className="section-title">
              {t.faqTitle || 'Everything you need to know about VANTRA'}
            </h2>
            <p className="section-desc">
              {t.faqDesc ||
                'Clear and straightforward answers about local payments, points system, and service reliability.'}
            </p>
          </div>

          <div className="faq-accordion">
            {[
              {
                q:
                  t.faq1Q ||
                  'Do I need an international bank card (Visa / Mastercard) to register and top up?',
                a:
                  t.faq1A ||
                  'Not at all! The foundational mission of VANTRA is to empower every Algerian with access to premier global AI using everyday local payment methods: Edahabia Card (Algérie Poste), CIB Bank Cards, and direct payments via the BaridiMob app.',
              },
              {
                q:
                  t.faq2Q ||
                  "Do my VANTRA points expire if I don't use them by the end of the month?",
                a:
                  t.faq2A ||
                  'They never expire! Your points remain securely stored in your VANTRA account until you use them up entirely, with zero time pressure, zero recurring fees, and zero auto-debits from your bank account.',
              },
              {
                q:
                  t.faq3Q ||
                  'How are points calculated for text, image, and video generation?',
                a:
                  t.faq3A ||
                  'Points are calculated based on raw AI compute consumption (Tokens for text, image counts at 1024px, and generation seconds for video). You can always refer to the transparent Cost Table above to check exact rates for every model.',
              },
              {
                q:
                  t.faq4Q ||
                  'Do the AI models available on VANTRA support Arabic and Algerian Darja?',
                a:
                  t.faq4A ||
                  'Yes! Flagship models such as Claude 3.5 Sonnet, GPT-4o, and DeepSeek excel in Modern Standard Arabic and Algerian Darja, understanding local cultural nuances, dialects, and generating tailored content for the Algerian market.',
              },
              {
                q:
                  t.faq5Q ||
                  "What should I do if I encounter an issue during payment or points aren't credited immediately?",
                a:
                  t.faq5A ||
                  'Top-ups are fully automated and complete in under 30 seconds. If any bank network delay occurs, our local Algerian support team is available 24/7 via WhatsApp and Telegram to assist you and verify your transaction ID instantly.',
              },
            ].map((faqItem, idx) => (
              <div
                key={idx}
                className={`faq-item ${openFaq === idx ? 'open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span>{faqItem.q}</span>
                  <div className="faq-toggle-icon">
                    <i
                      className={`fa-solid fa-chevron-down transition-transform ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>
                {openFaq === idx && (
                  <div className="faq-answer">
                    <div
                      className="faq-answer-inner"
                      dangerouslySetInnerHTML={{ __html: faqItem.a }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==========================================================================
         9. CLOSING CTA BAND
         ========================================================================== */}
      <section className="closing-cta-section">
        <div className="container">
          <div className="closing-card">
            <h2 className="closing-title">
              {t.closingTitle || 'Ready to unleash the power of global AI in DZD?'}
            </h2>
            <p className="closing-desc">
              {t.closingDesc ||
                'Join thousands of Algerian students, creators, and developers who rely on VANTRA daily to build their projects and accelerate their workflow.'}
            </p>
            <div className="closing-cta-btns">
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '15px 34px', fontSize: '15.5px' }}
                onClick={() => (user ? openTopUpModal() : openAuthModal('signup'))}
              >
                <i className="fa-solid fa-wallet" />
                <span>{t.btnClosingTopup || 'Top up your VANTRA now with Edahabia'}</span>
              </button>
              <a
                href="#cost-table"
                className="btn-ghost"
                style={{
                  padding: '15px 26px',
                  fontSize: '15px',
                  background: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <span>{t.btnClosingCompare || 'Compare Models & Pricing'}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
         10. FOOTER WITH LOCAL PAYMENT BADGES
         ========================================================================== */}
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            {/* Col 1: Brand Info */}
            <div>
              <div className="brand-logo" style={{ marginBottom: '10px' }}>
                <div className="logo-badge">
                  <VantraLogo className="w-full h-full" />
                </div>
                <span className="brand-name">VANTRA</span>
              </div>
              <p className="footer-brand-desc">
                {t.footerBrandDesc ||
                  'The leading Algerian platform unifying top generative AI foundation models with local currency payment.'}
              </p>
            </div>

            {/* Col 2: Navigation Links */}
            <div>
              <div className="footer-heading">{t.footerQuickLinks || 'Quick Links'}</div>
              <ul className="footer-links">
                <li>
                  <a href="#hero" className="footer-link">
                    {t.navHome || 'Home'}
                  </a>
                </li>
                <li>
                  <a href="#models" className="footer-link">
                    {t.footerLinkModels || 'AI Models & Engines'}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="footer-link">
                    {t.footerLinkPricing || 'Recharge Packs'}
                  </a>
                </li>
                <li>
                  <a href="#cost-table" className="footer-link">
                    {t.footerLinkCostTable || 'Point Consumption Table'}
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Legal & Support */}
            <div>
              <div className="footer-heading">{t.footerSupportLegal || 'Support & Security'}</div>
              <ul className="footer-links">
                <li>
                  <a href="#faq" className="footer-link">
                    {t.footerLinkFaq || 'FAQ'}
                  </a>
                </li>
                <li>
                  <a href="mailto:support@vantra.dz" className="footer-link">
                    {t.footerLinkSupportEmail || 'Support: support@vantra.dz'}
                  </a>
                </li>
                <li>
                  <a href="#terms" className="footer-link">
                    {t.footerLinkTerms || 'Terms of Service & Privacy'}
                  </a>
                </li>
                <li>
                  <a href="#security" className="footer-link">
                    {t.footerLinkSecurity || 'Transaction Security Standards'}
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Payment Badges */}
            <div>
              <div className="footer-heading">{t.footerPaymentsTitle || 'Accepted Local Payment Methods'}</div>
              <div className="payment-badges-wrap">
                <div className="payment-badges-row">
                  <div className="payment-pill edahabia">
                    <i className="fa-solid fa-credit-card" />
                    <span>{t.footerEdahabiaBadge || 'Edahabia Card (Algérie Poste)'}</span>
                  </div>
                </div>
                <div className="payment-badges-row">
                  <div className="payment-pill cib">
                    <i className="fa-solid fa-building-columns" />
                    <span>{t.footerCibBadge || 'Certified CIB Bank Cards'}</span>
                  </div>
                </div>
                <div className="payment-badges-row">
                  <div className="payment-pill">
                    <i className="fa-solid fa-mobile-screen" />
                    <span>{t.footerBaridiBadge || 'BaridiMob Mobile App'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="footer-bottom">
            <div>
              {t.footerCopyright ||
                'All rights reserved © 2026 VANTRA (VANTRA AI Algeria) • Certified for local electronic payments.'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--teal)' }}>
              {t.footerSecuredVia || 'v2.5.0-dz • Secured via SATIM & Algérie Poste'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
