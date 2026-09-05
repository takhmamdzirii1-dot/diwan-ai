'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Download, FolderOpen, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  IMAGE_LIBRARY_KEY,
  readImageLibrary,
  type GeneratedImage,
} from './ImageResultCard';

type MediaKind = 'image' | 'video';
type FilterKey = 'all' | 'images' | 'videos';

interface MediaItem {
  id: string;
  kind: MediaKind;
  url: string;
  poster?: string;
  prompt?: string;
  model?: string;
  ratio?: string;
  /** seconds — videos only */
  duration?: number;
  createdAt?: number;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'images', label: 'Images' },
  { key: 'videos', label: 'Videos' },
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Media card ─────────────────────────────────────────── */

function MediaCard({ item }: { item: MediaItem }) {
  const [copied, setCopied] = useState(false);
  const src = item.kind === 'video' ? item.poster || '' : item.url;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.url === '#' ? item.poster || '' : item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleDownload = () => {
    const target = item.url === '#' ? item.poster : item.url;
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#1A1C20]">
      <img
        src={src}
        alt={item.prompt || 'Generated media'}
        loading="lazy"
        className="w-full h-auto block object-cover"
      />

      {/* Bottom gradient overlay on hover */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Video affordance — always visible so kind reads instantly */}
      {item.kind === 'video' && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-12 w-12 rounded-full border border-white/25 bg-black/40 backdrop-blur-md flex items-center justify-center">
              <Play className="h-5 w-5 text-white/90 ms-0.5" fill="currentColor" />
            </div>
          </div>
          {typeof item.duration === 'number' && (
            <span className="absolute bottom-2.5 end-2.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10.5px] font-mono text-white/80">
              {formatDuration(item.duration)}
            </span>
          )}
        </>
      )}

      {/* Hover action bar */}
      <div className="absolute top-2.5 end-2.5 flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={handleDownload}
          aria-label="Download"
          title="Download"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link"
          title={copied ? 'Copied' : 'Copy link'}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {/* Meta revealed with the gradient */}
      <div className="absolute inset-x-0 bottom-0 p-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        {item.prompt && (
          <p className="text-[12px] text-white/90 line-clamp-2 leading-relaxed">{item.prompt}</p>
        )}
        {item.model && (
          <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
            {item.model}
            {item.ratio ? ` · ${item.ratio}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Library ────────────────────────────────────────────── */

export default function MediaLibrary() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [saved, setSaved] = useState<GeneratedImage[]>([]);

  useEffect(() => {
    setSaved(readImageLibrary());
  }, []);

  const items: MediaItem[] = useMemo(() => {
    const real: MediaItem[] = saved.map((img, i) => ({
      id: `saved-${i}-${img.url}`,
      kind: 'image',
      url: img.url,
      prompt: img.prompt,
      model: img.model,
      ratio: img.ratio,
      createdAt: img.createdAt,
    }));
    return real;
  }, [saved]);

  const visible = useMemo(() => {
    if (filter === 'images') return items.filter((i) => i.kind === 'image');
    if (filter === 'videos') return items.filter((i) => i.kind === 'video');
    return items;
  }, [items, filter]);

  const clearSaved = () => {
    try {
      localStorage.removeItem(IMAGE_LIBRARY_KEY);
    } catch {}
    setSaved([]);
  };

  return (
    <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="max-w-6xl mx-auto w-full px-5 pt-8 pb-12">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-white">Library</h2>
            <p className="text-[12.5px] text-white/55 mt-1">
              {visible.length} item{visible.length === 1 ? '' : 's'}
            </p>
          </div>
          {saved.length > 0 && (
            <button
              type="button"
              onClick={clearSaved}
              className="shrink-0 inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-white/10 text-[12.5px] font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear saved
            </button>
          )}
        </div>

        {/* Segmented filter */}
        <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/[0.07]">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={cn(
                  'relative h-8 px-4 rounded-full text-[12.5px] font-medium cursor-pointer transition-colors duration-200',
                  active ? 'text-black' : 'text-white/50 hover:text-white/80'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="library-filter-indicator"
                    className="absolute inset-0 z-0 bg-white rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="min-h-[46vh] flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-2xl border border-white/[0.07] bg-white/[0.025] flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-white/15" />
            </div>
            <p className="mt-5 text-[14.5px] font-medium text-white/55">Your creations will appear here.</p>
            <p className="mt-1.5 text-xs text-white/50 max-w-xs">
              Saved images and videos will collect in this library.
            </p>
          </div>
        ) : (
          <div className="mt-7 columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            <AnimatePresence initial={false}>
              {visible.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 30,
                    delay: Math.min(i, 8) * 0.035,
                  }}
                  className="mb-4 break-inside-avoid"
                >
                  <MediaCard item={item} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
