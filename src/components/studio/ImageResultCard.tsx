'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GeneratedImage {
  url: string;
  width?: number;
  height?: number;
  prompt?: string;
  ratio?: string;
  model?: string;
  createdAt?: number;
}

/** Premium result card with a floating glass action bar on hover. */
export default function ImageResultCard({
  image,
  className,
}: {
  image: GeneratedImage;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Never leak blob URLs created during download
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const a = document.createElement('a');
      a.href = url;
      a.download = `vantra-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    } catch {
      // Cross-origin without CORS — fall back to opening the asset
      window.open(image.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/10 bg-[#1A1C20]',
        className
      )}
    >
      <img
        src={image.url}
        alt={image.prompt || 'Generated image'}
        loading="lazy"
        className="w-full h-auto max-h-[70vh] object-contain block"
      />

      {/* Floating glass action bar */}
      <div className="absolute top-2.5 end-2.5 flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={handleDownload}
          aria-label="Download image"
          title="Download"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy image link"
          title={copied ? 'Copied' : 'Copy link'}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {/* Meta strip */}
      {(image.prompt || image.model) && (
        <div className="px-3.5 py-2.5 border-t border-white/[0.06]">
          {image.prompt && (
            <p className="text-[12px] text-white/60 line-clamp-2 leading-relaxed">{image.prompt}</p>
          )}
          {image.model && (
            <p className="mt-1 text-[10.5px] font-mono uppercase tracking-[0.14em] text-white/25">
              {image.model}
              {image.ratio ? ` · ${image.ratio}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Shared library persistence (localStorage, capped) ───────── */

export const IMAGE_LIBRARY_KEY = 'vantra_image_library';
const LIBRARY_CAP = 60;

export function readImageLibrary(): GeneratedImage[] {
  try {
    const raw = localStorage.getItem(IMAGE_LIBRARY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendToImageLibrary(images: GeneratedImage[]) {
  try {
    const next = [...images, ...readImageLibrary()].slice(0, LIBRARY_CAP);
    localStorage.setItem(IMAGE_LIBRARY_KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — ignore */
  }
}
