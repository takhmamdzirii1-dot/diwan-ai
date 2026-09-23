'use client';

import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatCapacityWait, type ChatLevel, type ChatUsageState } from '@/lib/chat/chat-usage';

interface CapacitySnapshot {
  level: ChatLevel;
  state: ChatUsageState;
  nextAvailableAt: string | null;
}

/**
 * Slim ambient chat-capacity line. Renders nothing while plenty is
 * available; surfaces the qualitative state (never raw units) as usage
 * climbs. Refreshed whenever the parent signals a completed exchange.
 */
export default function ChatCapacityHint({ refreshSignal }: { refreshSignal: number }) {
  const t = useTranslations('studio.chat');
  const [snapshot, setSnapshot] = useState<CapacitySnapshot | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/usage/chat', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json().catch(() => null) : null))
      .then((body) => {
        if (!live || !body || body.error) return;
        setSnapshot({
          level: body.level,
          state: body.state,
          nextAvailableAt: body.nextAvailableAt ?? null,
        });
      })
      .catch(() => { /* Capacity display is optional. */ });
    return () => { live = false; };
  }, [refreshSignal]);

  if (!snapshot || snapshot.state === 'plenty') return null;
  const levelLabel = snapshot.level === 'extended'
    ? t('chatLevelExtended')
    : snapshot.level === 'high' ? t('chatLevelHigh')
      : snapshot.level === 'highest' ? t('chatLevelHighest') : t('chatLevelStandard');
  const stateLabel = snapshot.state === 'limit'
    ? t('chatCapacityLimit')
    : snapshot.state === 'near' ? t('chatCapacityNear') : t('chatCapacityHigh');
  const wait = snapshot.nextAvailableAt ? formatCapacityWait(snapshot.nextAvailableAt) : null;

  return (
    <p role="status" className="pointer-events-none mx-auto flex w-full max-w-4xl items-center justify-center gap-1.5 px-6 pb-1.5 text-center text-[11.5px] text-[var(--studio-text-muted)]">
      <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{levelLabel} · {stateLabel}{wait ? ` — ${t('chatCapacityAvailableIn', { wait })}` : ''}</span>
    </p>
  );
}
