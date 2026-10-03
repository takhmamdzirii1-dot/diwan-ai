'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** The Library's existing contained-media viewer, usable without the fullscreen
 * browser API (including iOS and embedded mobile browsers). */
export default function MediaPreviewDialog({ src, kind, label, closeLabel, onClose, children }: {
  src: string; kind: 'image' | 'video'; label: string; closeLabel: string; onClose: () => void; children?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={dialog} aria-label={label} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-5xl overflow-auto rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-popover)] p-0 text-[var(--studio-text-primary)] backdrop:bg-[var(--studio-overlay)]">
    <button type="button" autoFocus onClick={onClose} aria-label={closeLabel} className="absolute end-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-popover)] text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]"><X className="h-4 w-4" /></button>
    {kind === 'video' ? <video src={src} controls playsInline aria-label={label} className="max-h-[76dvh] w-full object-contain bg-[var(--studio-recessed)]" /> : <img src={src} alt={label} className="max-h-[76dvh] w-full object-contain bg-[var(--studio-recessed)]" />}
    {children}
  </dialog>;
}
