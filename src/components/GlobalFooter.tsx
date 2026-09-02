'use client';

import React from 'react';
import { VantraLogo } from './VantraLogo';

const LINKS = [
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: 'X / Twitter', href: 'https://x.com', external: true },
  { label: 'Status', href: '#' },
];

export default function GlobalFooter() {
  return (
    <footer className="border-t border-white/[0.05] py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center">
            <VantraLogo className="w-3.5 h-3.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-[0.14em] text-white/80">VANTRA</span>
          <span className="text-[11px] text-white/30">© {new Date().getFullYear()}</span>
        </div>

        {/* Links */}
        <nav aria-label="Footer" className="flex items-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-sm text-white/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
