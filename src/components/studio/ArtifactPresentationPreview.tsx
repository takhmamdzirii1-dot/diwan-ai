'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ChartArtifact, PresentationArtifact } from '@/lib/artifacts/core';

const ArtifactChart = dynamic(() => import('./ArtifactChart'), { ssr: false });
const copy = {
  en: { presentation: 'Presentation', slides: 'slides', download: 'Download PowerPoint', preparing: 'Preparing…', close: 'Close', error: 'PowerPoint export failed.', unavailable: 'Chart unavailable in this session.', previous: 'Previous', next: 'Next', slide: 'Slide' },
  fr: { presentation: 'Présentation', slides: 'diapositives', download: 'Télécharger PowerPoint', preparing: 'Préparation…', close: 'Fermer', error: 'Échec de l’export PowerPoint.', unavailable: 'Graphique indisponible dans cette session.', previous: 'Précédente', next: 'Suivante', slide: 'Diapositive' },
  ar: { presentation: 'عرض تقديمي', slides: 'شرائح', download: 'تنزيل PowerPoint', preparing: 'جارٍ التحضير…', close: 'إغلاق', error: 'فشل تصدير PowerPoint.', unavailable: 'الرسم غير متاح في هذه الجلسة.', previous: 'السابق', next: 'التالي', slide: 'شريحة' },
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${name.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'presentation'}.pptx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ArtifactPresentationPreview({ artifact, charts = [], onClose }: { artifact: PresentationArtifact; charts?: ChartArtifact[]; onClose: () => void }) {
  const t = copy[artifact.language.split('-')[0] as keyof typeof copy] ?? copy.en;
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const slide = artifact.slides[index];
  const exportPptx = async () => {
    setBusy(true); setError(false);
    try { const { presentationToPptx } = await import('@/lib/artifacts/pptx-export'); download(await presentationToPptx(artifact, charts), artifact.title); }
    catch { setError(true); } finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label={artifact.title} className="fixed inset-0 z-[110] overflow-y-auto bg-black/95 p-4 text-white sm:p-8" dir={artifact.direction}>
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-neutral-950 p-3">
        <div className="me-auto min-w-0"><h2 className="truncate text-sm font-semibold">{artifact.title}</h2><p className="text-xs text-white/50">{t.presentation} · {artifact.slides.length} {t.slides}</p></div>
        <button type="button" disabled={busy} onClick={() => void exportPptx()} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{busy ? t.preparing : t.download}</button>
        <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">{t.close}</button>
      </header>
      {error && <p role="alert" className="text-sm text-red-300">{t.error}</p>}
      <nav aria-label="Slides" className="flex gap-2 overflow-x-auto pb-1">{artifact.slides.map((item, slideIndex) => <button key={item.id} type="button" onClick={() => setIndex(slideIndex)} aria-current={index === slideIndex ? 'page' : undefined} className={`min-w-20 rounded-lg border p-2 text-start text-xs ${index === slideIndex ? 'border-white/70 bg-white/10' : 'border-white/10 text-white/60'}`}><span className="block text-white/40">{slideIndex + 1}</span><span className="line-clamp-2">{item.title}</span></button>)}</nav>
      {slide && <article lang={artifact.language} dir={artifact.direction} className="aspect-video min-h-[320px] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-6 shadow-xl sm:p-12">
        <h3 dir="auto" className="mb-6 text-2xl font-semibold sm:text-4xl">{slide.title}</h3>
        {slide.subtitle && <p dir="auto" className="mb-6 text-lg text-white/60">{slide.subtitle}</p>}
        <div className="space-y-5">{slide.blocks.map((block, blockIndex) => {
          if (block.kind === 'text') return <p key={blockIndex} dir="auto" className="text-base leading-relaxed sm:text-xl">{block.text}</p>;
          if (block.kind === 'bullets') return <ul key={blockIndex} className="list-disc space-y-2 ps-6 text-base sm:text-xl">{block.items.map((item, itemIndex) => <li key={itemIndex} dir="auto">{item}</li>)}</ul>;
          if (block.kind === 'table') return <div key={blockIndex} className="overflow-auto"><table className="w-full border-collapse text-sm"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} dir="auto" className="border border-white/20 p-2">{cell}</td>)}</tr>)}</tbody></table></div>;
          if (block.kind === 'chart') { const chart = charts.find((item) => item.id === block.chartId); return chart ? <ArtifactChart key={blockIndex} artifact={chart} /> : <p key={blockIndex} className="text-white/50">{t.unavailable}</p>; }
          return /^data:image\/(png|jpeg|webp);base64,/i.test(block.src) ? <img key={blockIndex} src={block.src} alt={block.alt ?? ''} className="max-h-72 max-w-full object-contain" /> : null;
        })}</div>
      </article>}
      <footer className="flex items-center justify-between text-sm"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40">{t.previous}</button><span>{t.slide} {index + 1} / {artifact.slides.length}</span><button type="button" disabled={index >= artifact.slides.length - 1} onClick={() => setIndex(index + 1)} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40">{t.next}</button></footer>
    </div>
  </div>;
}
