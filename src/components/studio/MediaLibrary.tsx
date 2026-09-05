'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Download, Grid2X2, Image as ImageIcon, List, Search, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { IMAGE_LIBRARY_KEY, type GeneratedImage } from './ImageResultCard';
import { GhostButton, StateBlock } from './AppShell';

type FilterKey = 'all' | 'images' | 'videos';
type SortKey = 'newest' | 'oldest';
type ViewKey = 'grid' | 'list';
type MediaItem = GeneratedImage & { id: string; kind: 'image' };

export default function MediaLibrary() {
  const t = useTranslations('studio.library');
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<GeneratedImage[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewKey>('grid');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(IMAGE_LIBRARY_KEY) || '[]');
      if (!Array.isArray(parsed)) throw new Error('Invalid library data');
      setSaved(parsed);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const items = useMemo<MediaItem[]>(() => saved.map((image, index) => ({ ...image, id: `${image.createdAt ?? index}-${image.url}`, kind: 'image' })), [saved]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter(() => filter !== 'videos').filter((item) => !normalized || `${item.prompt ?? ''} ${item.model ?? ''}`.toLocaleLowerCase().includes(normalized)).sort((a, b) => sort === 'newest' ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }, [filter, items, query, sort]);

  const toggleSelected = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const deleteSelected = () => {
    const next = items.filter((item) => !selected.has(item.id)).map(({ id: _id, kind: _kind, ...image }) => image);
    localStorage.setItem(IMAGE_LIBRARY_KEY, JSON.stringify(next));
    setSaved(next); setSelected(new Set()); setConfirmDelete(false);
  };
  const download = (item: MediaItem) => window.open(item.url, '_blank', 'noopener,noreferrer');

  return <div className="custom-scrollbar absolute inset-0 overflow-y-auto bg-[var(--studio-bg)]">
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-16 sm:px-6 sm:pt-8 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-[var(--studio-border-subtle)] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('eyebrow')}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1><p className="mt-1.5 text-[13px] text-[var(--studio-text-secondary)]">{t('count', { count: visible.length })}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (confirmDelete ? <div className="flex items-center gap-2" role="alert"><span className="text-xs text-white/65">{t('confirmDelete', { count: selected.size })}</span><GhostButton onClick={deleteSelected} className="border-red-400/20 text-red-200 hover:bg-red-400/10"><Trash2 className="h-3.5 w-3.5" />{t('delete')}</GhostButton><GhostButton onClick={() => setConfirmDelete(false)}>{t('cancel')}</GhostButton></div> : <GhostButton onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />{t('deleteSelected', { count: selected.size })}</GhostButton>)}
            <div className="flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1" role="group" aria-label={t('viewLabel')}>{(['grid', 'list'] as const).map((option) => { const Icon = option === 'grid' ? Grid2X2 : List; return <button key={option} type="button" aria-label={t(option)} aria-pressed={view === option} onClick={() => setView(option)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-[color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none', view === option ? 'bg-white text-black' : 'text-white/50 hover:bg-white/[0.06] hover:text-white')}><Icon className="h-4 w-4" /></button>; })}</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto_auto]">
          <label className="relative block"><span className="sr-only">{t('searchLabel')}</span><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchPlaceholder')} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] ps-10 pe-3 text-[13px] text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-white/40" /></label>
          <div className="flex rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-1" role="group" aria-label={t('filterLabel')}>{(['all', 'images', 'videos'] as const).map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn('h-8 rounded-lg px-3 text-xs font-medium transition-[color,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none', filter === key ? 'bg-white text-black' : 'text-white/55 hover:bg-white/[0.06] hover:text-white')}>{t(key)}</button>)}</div>
          <label><span className="sr-only">{t('sortLabel')}</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="h-10 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"><option value="newest">{t('newest')}</option><option value="oldest">{t('oldest')}</option></select></label>
        </div>
      </header>

      {status === 'loading' && <div className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('loading')}>{[0,1,2].map((item) => <div key={item} className="aspect-[4/3] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025] motion-reduce:animate-none" />)}</div>}
      {status === 'error' && <StateBlock className="min-h-[52vh]" icon={<ImageIcon className="h-6 w-6" />} title={t('errorTitle')} description={t('errorDescription')} action={<GhostButton onClick={() => location.reload()}>{t('retry')}</GhostButton>} />}
      {status === 'ready' && visible.length === 0 && <StateBlock className="min-h-[52vh]" icon={<ImageIcon className="h-6 w-6" />} title={query ? t('noResults') : filter === 'videos' ? t('noVideos') : t('emptyTitle')} description={query ? t('noResultsDescription') : t('emptyDescription')} />}
      {status === 'ready' && visible.length > 0 && <motion.div layout className={cn('pt-6', view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3')}>
        {visible.map((item) => <motion.article layout key={item.id} transition={{ duration: reduceMotion ? 0 : 0.16 }} className={cn('group relative overflow-hidden rounded-2xl border bg-[var(--studio-surface)] transition-[border-color,background-color] duration-150 motion-reduce:transition-none', selected.has(item.id) ? 'border-white/30 bg-white/[0.06]' : 'border-[var(--studio-border-subtle)] hover:border-white/15', view === 'list' && 'flex min-h-24 items-center')}>
          <button type="button" onClick={() => setPreview(item)} aria-label={t('openPreview')} className={cn('block min-w-0 text-start focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40', view === 'grid' ? 'w-full' : 'flex flex-1 items-center')}><img src={item.url} alt={item.prompt || t('generatedImage')} loading="lazy" className={cn('object-cover', view === 'grid' ? 'aspect-[4/3] w-full' : 'h-24 w-28 shrink-0')} /><div className="min-w-0 p-3.5"><p className="line-clamp-2 text-[13px] leading-relaxed text-white/80">{item.prompt || t('untitled')}</p><p className="mt-1 truncate text-[10.5px] uppercase tracking-[0.12em] text-white/40">{item.model || t('image')}</p></div></button>
          <div className="absolute end-2.5 top-2.5 flex gap-1 rounded-xl border border-white/10 bg-black/70 p-1 opacity-100 backdrop-blur-xl sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"><button type="button" onClick={() => toggleSelected(item.id)} aria-label={t('select')} aria-pressed={selected.has(item.id)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-white/40', selected.has(item.id) ? 'bg-white text-black' : 'text-white/65 hover:bg-white/10 hover:text-white')}><Check className="h-4 w-4" /></button><button type="button" onClick={() => download(item)} aria-label={t('download')} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"><Download className="h-4 w-4" /></button></div>
        </motion.article>)}
      </motion.div>}
    </div>

    <AnimatePresence>{preview && <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--studio-overlay)] p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} onMouseDown={(event) => event.target === event.currentTarget && setPreview(null)}><motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('preview')} tabIndex={-1} initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: reduceMotion ? 0 : 0.16 }} className="studio-overlay-root relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface-elevated)] shadow-[var(--studio-shadow)]"><button type="button" onClick={() => setPreview(null)} aria-label={t('closePreview')} className="absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/70 text-white/70 backdrop-blur-xl hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"><X className="h-4 w-4" /></button><img src={preview.url} alt={preview.prompt || t('generatedImage')} className="max-h-[76dvh] w-full object-contain bg-black" /><div className="flex items-center justify-between gap-4 border-t border-white/[0.07] p-4"><div className="min-w-0"><p className="line-clamp-2 text-sm text-white/80">{preview.prompt || t('untitled')}</p><p className="mt-1 text-xs text-white/45">{preview.model || t('image')}</p></div><GhostButton onClick={() => download(preview)}><Download className="h-4 w-4" />{t('download')}</GhostButton></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
}
