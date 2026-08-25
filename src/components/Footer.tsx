'use client';

import React from 'react';
import { Sparkles, CreditCard, Building2, Smartphone, ShieldCheck, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050506] pt-16 pb-12 px-4 md:px-8 text-xs text-[rgba(245,246,248,0.6)]">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1: Brand */}
          <div className="space-y-4">
            <a href="#hero" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6C27A] text-[#050506]">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-wider text-white font-heading">VANTRA</span>
            </a>
            <p className="text-xs leading-relaxed text-[rgba(245,246,248,0.55)]">
              The premier Algerian gateway unifying frontier generative AI foundation models with local currency payment via Edahabia & CIB.
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-heading">
              Quick Navigation
            </h4>
            <ul className="space-y-2">
              <li><a href="#hero" className="hover:text-white transition">Home</a></li>
              <li><a href="#models" className="hover:text-white transition">AI Foundation Models</a></li>
              <li><a href="#features" className="hover:text-white transition">Platform Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition">How It Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition">DZD Recharge Packs</a></li>
              <li><a href="#cost-table" className="hover:text-white transition">Points Yield Matrix</a></li>
            </ul>
          </div>

          {/* Col 3: Support & Security */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-heading">
              Support & Security
            </h4>
            <ul className="space-y-2">
              <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
              <li className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#E6C27A]" />
                <a href="mailto:support@vantra.dz" className="hover:text-white transition">
                  support@vantra.dz
                </a>
              </li>
              <li><a href="#faq" className="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="#faq" className="hover:text-white transition">Terms of Service</a></li>
            </ul>
          </div>

          {/* Col 4: Accepted Payment Methods */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white uppercase tracking-wider text-[11px] font-heading">
              Accepted Local Payments
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <CreditCard className="h-4 w-4 text-[#F5B942]" />
                <div>
                  <p className="font-semibold text-white text-[11px]">Edahabia Card</p>
                  <p className="text-[10px] text-[rgba(245,246,248,0.4)]">Algérie Poste</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <Building2 className="h-4 w-4 text-[#E6C27A]" />
                <div>
                  <p className="font-semibold text-white text-[11px]">CIB Bank Cards</p>
                  <p className="text-[10px] text-[rgba(245,246,248,0.4)]">SATIM Certified Banks</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <Smartphone className="h-4 w-4 text-[#E6C27A]" />
                <div>
                  <p className="font-semibold text-white text-[11px]">BaridiMob App</p>
                  <p className="text-[10px] text-[rgba(245,246,248,0.4)]">Instant Notification & OTP</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[rgba(245,246,248,0.45)]">
          <p>© 2026 VANTRA (VANTRA AI Algeria). All rights reserved.</p>
          <div className="flex items-center gap-2 font-mono text-[#E6C27A]">
            <span className="h-2 w-2 rounded-full bg-[#E6C27A] animate-pulse" />
            <span>v2.5.0-dz • Secured via SATIM & Algérie Poste</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
