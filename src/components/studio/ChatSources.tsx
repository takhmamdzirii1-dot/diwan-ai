'use client';
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { sourceDomain, sourceClass, type ChatWebSource, type WebSourcesAnnotation } from '@/lib/chat/web-sources';

function SourceIcon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="chat-source-fallback" aria-hidden="true">{domain[0]?.toUpperCase()}</span>
    : <img className="chat-source-icon" src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export function CitationBadge({ source, index }: { source: ChatWebSource; index: number }) {
  return <sup className="chat-citation"><a href={source.url} target="_blank" rel="noopener noreferrer"
    dir="ltr" aria-label={`${index}: ${source.title || sourceDomain(source.url)}`} title={source.title}>
    <bdi dir="ltr">{index}</bdi></a></sup>;
}

export function CitationGroup({ sources, registry, locale }: { sources: ChatWebSource[]; registry: ChatWebSource[]; locale: string }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  const label = locale.startsWith('ar') ? 'المصادر' : 'Sources';
  return <sup className="chat-citation chat-citation-group" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
    <button type="button" dir="ltr" aria-label={`${label}: ${sources.map((s) => s.title).join('; ')}`}
      aria-expanded={open} onClick={() => setOpen(!open)}><bdi>{sources.map((source) => registry.findIndex((s) => s.id === source.id) + 1).join(', ')}</bdi></button>
    {open && <span className="chat-citation-popover" role="group" aria-label={label}>{sources.map((source) =>
      <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" dir="auto">{source.title || sourceDomain(source.url)}<ExternalLink size={12} aria-hidden="true" /></a>)}</span>}
  </sup>;
}

export default function ChatSources({ annotation, locale }: { annotation: WebSourcesAnnotation; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const ar = locale.startsWith('ar'); const fr = locale.startsWith('fr');
  const rank = { primary: 0, news: 1, other: 2, forum: 3 };
  const sorted = [...annotation.sources].sort((a, b) => rank[a.sourceClass ?? sourceClass(a.url)!]
    - rank[b.sourceClass ?? sourceClass(b.url)!]);
  const uniqueSources = sorted.filter((source, index) => sorted.findIndex((candidate) => candidate.url === source.url) === index);
  return <section className="chat-sources" data-chat-sources="">
    <p role="status" aria-live="polite" className="chat-search-status">{annotation.state === 'searching'
      ? ar ? 'جارٍ البحث…' : fr ? 'Recherche…' : 'Searching…'
      : annotation.readCount === 0 ? annotation.sources.length > 0
        ? ar ? 'المصادر متاحة أدناه.' : fr ? 'Sources disponibles ci-dessous.' : 'Sources available below.'
        : ar ? 'لم تتوفر مصادر مقروءة.' : fr ? 'Aucune source disponible.' : 'No sources available.'
      : ar ? <>تمت قراءة <bdi>{annotation.readCount}</bdi> مصادر</> : fr ? <><bdi>{annotation.readCount}</bdi> sources lues</>
        : <>Read <bdi>{annotation.readCount}</bdi> sources</>}</p>
      {uniqueSources.length > 0 && <details className="chat-source-footer"><summary>{ar ? 'المصادر' : 'Sources'} · <bdi>{uniqueSources.length}</bdi></summary>
        <div className="chat-source-rows">{uniqueSources.slice(0, expanded ? undefined : 5).map((source) => {
          const domain = sourceDomain(source.url);
          return <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="chat-source-row">
            <SourceIcon domain={domain} /><span className="chat-source-title" dir="auto">{source.title || domain}</span>
            <span className="chat-source-domain" dir="ltr">{domain}</span><ExternalLink size={13} aria-hidden="true" />
          </a>;
        })}</div>
        {!expanded && uniqueSources.length > 5 && <button type="button" onClick={() => setExpanded(true)} className="chat-source-more">
          {ar ? <>عرض <bdi>{uniqueSources.length - 5}</bdi> أخرى</> : fr ? <>Afficher <bdi>{uniqueSources.length - 5}</bdi> de plus</>
            : <>Show <bdi>{uniqueSources.length - 5}</bdi> more</>}</button>}
      </details>}
  </section>;
}
