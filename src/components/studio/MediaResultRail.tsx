'use client';

import { ImageIcon, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type SessionResult = { libraryAssetId: string; src: string; thumbnail: string | null };

/** Capture a small in-memory preview from media already loaded in the main canvas. */
export function captureSessionThumbnail(source: HTMLImageElement | HTMLVideoElement): string | null {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  const scale = Math.min(160 / width, 100 / height);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.68);
  } catch {
    // Private storage can disallow canvas reads. Keep a lightweight icon tile.
    return null;
  }
}

export default function MediaResultRail({ items, selectedId, kind, onSelect }: {
  items: SessionResult[];
  selectedId: string;
  kind: 'image' | 'video';
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('studio.mediaViewer');
  if (!items.length) return null;
  return <div className="w-full border-t border-[var(--studio-border-subtle)] pt-3">
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-text-muted)]">{t('sessionResults')}</p>
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label={t('sessionResults')}>
      {items.map((item, index) => <button key={item.libraryAssetId} type="button" onClick={() => onSelect(item.libraryAssetId)}
        aria-label={t('showResult', { number: items.length - index })} aria-pressed={selectedId === item.libraryAssetId}
        className={`relative flex h-[70px] w-[94px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[var(--studio-surface)] transition-[border-color,transform] duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none ${selectedId === item.libraryAssetId ? 'border-[var(--studio-text-primary)]' : 'border-[var(--studio-border)] hover:border-[var(--studio-border-strong)]'}`}>
        {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
          : kind === 'video' ? <Video className="h-5 w-5 text-[var(--studio-text-muted)]" aria-hidden="true" />
            : <ImageIcon className="h-5 w-5 text-[var(--studio-text-muted)]" aria-hidden="true" />}
        <span className="absolute bottom-1 end-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-white">{items.length - index}</span>
      </button>)}
    </div>
  </div>;
}
