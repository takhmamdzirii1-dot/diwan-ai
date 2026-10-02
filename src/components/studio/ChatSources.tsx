'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { sourceDomain, sourceSiteName, sourceClass, type ChatWebSource, type WebSourcesAnnotation } from '@/lib/chat/web-sources';
import { subscribeSourceCopyFallback } from '@/lib/chat/copy-content';

function SourceIcon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="chat-source-fallback" aria-hidden="true">{domain[0]?.toUpperCase()}</span>
    : <img className="chat-source-icon" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export function CitationGroup({ sources, locale, children, countLabel = false, direction }: {
  sources: ChatWebSource[]; locale: string; children?: React.ReactNode; countLabel?: boolean; direction?: 'rtl' | 'ltr';
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => subscribeSourceCopyFallback(), []);
  const label = locale.startsWith('ar') ? 'المصادر' : 'Sources';
  const unique = sources.filter((source, index) => sources.findIndex((entry) => entry.url === source.url) === index);
  useEffect(() => {
    if (!open) return;
    card.current?.querySelector<HTMLElement>('button, a')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!card.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (event.key === 'Tab') {
        const controls = Array.from(card.current?.querySelectorAll<HTMLElement>('button, a') ?? []);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', keyboard); };
  }, [open]);
  if (!unique.length) return <>{children}</>;
  const visualLabel = countLabel ? `${unique.length} ${label}` : sourceSiteName(unique[0].url);
  return <span className="chat-source-tail"><bdi dir="auto">{children}</bdi><span className="chat-source-bubble-anchor" data-source-bubble="">
    <button ref={trigger} type="button" className="chat-source-bubble" dir={countLabel ? direction : 'ltr'} data-label={visualLabel}
      data-more={!countLabel && unique.length > 1 ? `+${unique.length - 1}` : undefined}
      aria-label={`${label}: ${unique.map((source) => source.title).join('; ')}`} aria-expanded={open}
      aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={() => {
        const rect = trigger.current!.getBoundingClientRect();
        const height = Math.min(360, 66 + unique.length * 68);
        setPosition({ left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
          top: rect.bottom + height < window.innerHeight ? rect.bottom + 4 : Math.max(16, rect.top - height) });
        setOpen(!open);
      }}><SourceIcon domain={sourceDomain(unique[0].url)} /></button>
    {open && createPortal(<div className="chat-source-card-layer">
      <div ref={card} id={id} role="dialog" aria-label={label} className="chat-source-card"
        dir={direction ?? (locale.startsWith('ar') ? 'rtl' : 'ltr')} style={position}>
        <header><strong>{label}</strong><button type="button" aria-label={locale.startsWith('ar') ? 'إغلاق' : locale.startsWith('fr') ? 'Fermer' : 'Close'}
          onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={16} /></button></header>
        {unique.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">
          <SourceIcon domain={sourceDomain(source.url)} /><span><span dir="auto">{source.title || sourceDomain(source.url)}</span>
            <small dir="ltr">{new URL(source.url).hostname}</small></span><ExternalLink size={14} aria-hidden="true" />
        </a>)}
      </div>
    </div>, trigger.current?.closest('.studio-overlay-root') ?? document.body)}
  </span></span>;
}

export default function ChatSources({ annotation, locale, direction }: { annotation: WebSourcesAnnotation; locale: string; direction?: 'rtl' | 'ltr' }) {
  const ar = locale.startsWith('ar'); const fr = locale.startsWith('fr');
  const rank = { primary: 0, news: 1, other: 2, forum: 3 };
  const sorted = [...annotation.sources].sort((a, b) => rank[a.sourceClass ?? sourceClass(a.url)!]
    - rank[b.sourceClass ?? sourceClass(b.url)!]);
  return <section className="chat-sources" data-chat-sources="" dir={direction}>
    {annotation.state === 'searching'
      ? <p role="status" aria-live="polite" className="chat-search-status">{ar ? 'جارٍ البحث…' : fr ? 'Recherche…' : 'Searching…'}</p>
      : annotation.sources.length > 0 ? <CitationGroup sources={sorted} locale={locale} direction={direction} countLabel /> : null}
  </section>;
}
