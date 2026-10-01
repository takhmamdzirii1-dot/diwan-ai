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

export default function ChatSources({ annotation, locale }: { annotation: WebSourcesAnnotation; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const ar = locale.startsWith('ar'); const fr = locale.startsWith('fr');
  const rank = { primary: 0, news: 1, other: 2, forum: 3 };
  const sorted = [...annotation.sources].sort((a, b) => rank[a.sourceClass ?? sourceClass(a.url)!]
    - rank[b.sourceClass ?? sourceClass(b.url)!]);
  const uniqueDomains = sorted.filter((source, index) => sorted.findIndex((candidate) =>
    sourceDomain(candidate.url) === sourceDomain(source.url)) === index);
  return <section className="chat-sources" data-chat-sources="">
    <p role="status" aria-live="polite" className="chat-search-status">{annotation.state === 'searching'
      ? ar ? 'جارٍ البحث…' : fr ? 'Recherche…' : 'Searching…'
      : annotation.readCount === 0 ? annotation.sources.length > 0
        ? ar ? 'المصادر متاحة أدناه.' : fr ? 'Sources disponibles ci-dessous.' : 'Sources available below.'
        : ar ? 'لم تتوفر مصادر مقروءة.' : fr ? 'Aucune source disponible.' : 'No sources available.'
      : ar ? <>تمت قراءة <bdi>{annotation.readCount}</bdi> مصادر</> : fr ? <><bdi>{annotation.readCount}</bdi> sources lues</>
        : <>Read <bdi>{annotation.readCount}</bdi> sources</>}</p>
    {annotation.sources.length > 0 && !footerOpen &&
      <div className="chat-source-chips">{uniqueDomains.map((source) => {
        const domain = sourceDomain(source.url);
        return <a key={domain} href={source.url} target="_blank" rel="noopener noreferrer" className="chat-source-chip">
          <SourceIcon domain={domain} /><span dir="ltr">{domain}</span></a>;
      })}</div>}
      <details className="chat-source-footer" onToggle={(event) => setFooterOpen(event.currentTarget.open)}><summary>{ar ? 'المصادر' : 'Sources'} · <bdi>{uniqueDomains.length}</bdi></summary>
        <div className="chat-source-rows">{uniqueDomains.slice(0, expanded ? undefined : 5).map((source) => {
          const domain = sourceDomain(source.url);
          return <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="chat-source-row">
            <SourceIcon domain={domain} /><span className="chat-source-title" dir="auto">{source.title || domain}</span>
            <span className="chat-source-domain" dir="ltr">{domain}</span><ExternalLink size={13} aria-hidden="true" />
          </a>;
        })}</div>
        {!expanded && uniqueDomains.length > 5 && <button type="button" onClick={() => setExpanded(true)} className="chat-source-more">
          {ar ? <>عرض <bdi>{uniqueDomains.length - 5}</bdi> أخرى</> : fr ? <>Afficher <bdi>{uniqueDomains.length - 5}</bdi> de plus</>
            : <>Show <bdi>{uniqueDomains.length - 5}</bdi> more</>}</button>}
      </details>
  </section>;
}
