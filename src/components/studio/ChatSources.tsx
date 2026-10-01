'use client';
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { sourceDomain, type ChatWebSource, type WebSourcesAnnotation } from '@/lib/chat/web-sources';

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
  const ar = locale.startsWith('ar'); const fr = locale.startsWith('fr');
  const uniqueDomains = [...new Map(annotation.sources.map((source) => [sourceDomain(source.url), source])).values()];
  return <section className="chat-sources" data-chat-sources="">
    <p role="status" aria-live="polite" className="chat-search-status">{annotation.state === 'searching'
      ? ar ? 'جارٍ البحث…' : fr ? 'Recherche…' : 'Searching…'
      : ar ? <>تمت قراءة <bdi>{annotation.readCount}</bdi> مصادر</> : fr ? <><bdi>{annotation.readCount}</bdi> sources lues</>
        : <>Read <bdi>{annotation.readCount}</bdi> sources</>}</p>
    {annotation.sources.length > 0 &&
      <div className="chat-source-chips">{uniqueDomains.map((source) => {
        const domain = sourceDomain(source.url);
        return <a key={domain} href={source.url} target="_blank" rel="noopener noreferrer" className="chat-source-chip">
          <SourceIcon domain={domain} /><span dir="ltr">{domain}</span></a>;
      })}</div>}
      <details className="chat-source-footer"><summary>{ar ? 'المصادر' : 'Sources'} · <bdi>{annotation.sources.length}</bdi></summary>
        <div className="chat-source-rows">{annotation.sources.slice(0, expanded ? undefined : 5).map((source) => {
          const domain = sourceDomain(source.url);
          return <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="chat-source-row">
            <SourceIcon domain={domain} /><span className="chat-source-title" dir="auto">{source.title || domain}</span>
            <span className="chat-source-domain" dir="ltr">{domain}</span><ExternalLink size={13} aria-hidden="true" />
          </a>;
        })}</div>
        {!expanded && annotation.sources.length > 5 && <button type="button" onClick={() => setExpanded(true)} className="chat-source-more">
          {ar ? <>عرض <bdi>{annotation.sources.length - 5}</bdi> أخرى</> : fr ? <>Afficher <bdi>{annotation.sources.length - 5}</bdi> de plus</>
            : <>Show <bdi>{annotation.sources.length - 5}</bdi> more</>}</button>}
      </details>
  </section>;
}
