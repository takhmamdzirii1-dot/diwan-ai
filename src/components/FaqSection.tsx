'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown, Sparkles } from 'lucide-react';
import SpotlightCard from './SpotlightCard';

const FAQS = [
  {
    q: 'How do I pay with Edahabia or CIB Bank Cards in DZD?',
    a: 'Simply select your preferred recharge package (Starter 1,500 DZD, Pro 4,500 DZD, or Enterprise 12,000 DZD). You will be directed to the SATIM-certified gateway. Enter your card number and confirm with the SMS OTP code sent by Algérie Poste or your bank. Your points are added immediately upon verification.',
  },
  {
    q: 'Do my purchased points ever expire?',
    a: 'Never. Points purchased on VANTRA remain in your account balance indefinitely with zero time limit. You can use them whenever you need across any model.',
  },
  {
    q: 'Can I integrate VANTRA into Cursor, VS Code, or my Next.js / Python apps?',
    a: 'Yes! VANTRA provides an OpenAI-compatible API endpoint. Simply set your API client baseURL to https://api.vantra.dz/v1 and supply your VANTRA developer key to route all requests through your DZD balance.',
  },
  {
    q: 'Are my prompts, code, and images confidential?',
    a: '100%. We enforce strict zero-data-retention agreements with our foundation model partners. Your inputs and outputs are never stored permanently or used for training machine learning models.',
  },
  {
    q: 'Can I switch between Claude, GPT-4o, Flux, and Kling freely?',
    a: 'Yes. All 25+ frontier models draw from the exact same unified point balance. You can generate a Claude code snippet, create an image with Flux 1 Pro, and render a video with Kling AI all within the same session.',
  },
  {
    q: 'What if an API request or video generation fails?',
    a: 'Our balance deduction engine is atomic. If a generation fails or times out, the points are automatically refunded back to your live ledger balance instantly.',
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-28 px-4 md:px-8 border-t border-white/[0.06] relative">
      <div className="max-w-4xl mx-auto space-y-14">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#1FD8B8]">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[rgba(245,246,248,0.6)]">
            Everything you need to know about VANTRA DZD payments, point deductions, and API integration.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0B0D]/80 backdrop-blur-xl transition duration-200 hover:border-white/[0.12]"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-sm sm:text-base font-semibold text-white font-heading">
                    {faq.q}
                  </span>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[#1FD8B8] transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-[#1FD8B8]/10' : ''
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-[rgba(245,246,248,0.65)] leading-relaxed border-t border-white/[0.04]">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
