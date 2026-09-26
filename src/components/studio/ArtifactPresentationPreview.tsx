'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ChartArtifact, PresentationArtifact } from '@/lib/artifacts/core';
import { formatPresentationCell, presentationChart, presentationMetricRows, presentationTheme, presentationVariant } from '@/lib/artifacts/presentation-design';

const ArtifactChart = dynamic(() => import('./ArtifactChart'), { ssr: false });
const copy = {
  en: { presentation: 'Presentation', slides: 'slides', download: 'Download PowerPoint', preparing: 'Preparing…', close: 'Close', error: 'PowerPoint export failed.', unavailable: 'Chart unavailable in this session.', chartLimited: 'Showing the first 12 categories and up to 4 series.', previous: 'Previous', next: 'Next', slide: 'Slide', cover: 'Overview', kpi: 'Key metrics', chart: 'Trend', table: 'Metrics', insights: 'Insights' },
  fr: { presentation: 'Présentation', slides: 'diapositives', download: 'Télécharger PowerPoint', preparing: 'Préparation…', close: 'Fermer', error: 'Échec de l’export PowerPoint.', unavailable: 'Graphique indisponible dans cette session.', chartLimited: 'Affichage des 12 premières catégories et de 4 séries maximum.', previous: 'Précédente', next: 'Suivante', slide: 'Diapositive', cover: 'Vue d’ensemble', kpi: 'Indicateurs clés', chart: 'Tendance', table: 'Mesures', insights: 'Constats' },
  ar: { presentation: 'عرض تقديمي', slides: 'شرائح', download: 'تنزيل PowerPoint', preparing: 'جارٍ التحضير…', close: 'إغلاق', error: 'فشل تصدير PowerPoint.', unavailable: 'الرسم غير متاح في هذه الجلسة.', chartLimited: 'تُعرض أول 12 فئة وما يصل إلى 4 سلاسل.', previous: 'السابق', next: 'التالي', slide: 'شريحة', cover: 'نظرة عامة', kpi: 'مؤشرات رئيسية', chart: 'اتجاه', table: 'مقاييس', insights: 'أبرز النتائج' },
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${name.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'presentation'}.pptx`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ArtifactPresentationPreview({ artifact, charts = [], onClose, inline = false }: { artifact: PresentationArtifact; charts?: ChartArtifact[]; onClose: () => void; inline?: boolean }) {
  const t = copy[artifact.language.split('-')[0] as keyof typeof copy] ?? copy.en;
  const theme = presentationTheme(artifact);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const slide = artifact.slides[index];
  const variant = slide && presentationVariant(slide);
  const exportPptx = async () => {
    setBusy(true); setError(false);
    try { const { presentationToPptx } = await import('@/lib/artifacts/pptx-export'); download(await presentationToPptx(artifact, charts), artifact.title); }
    catch { setError(true); } finally { setBusy(false); }
  };
  return <div role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={artifact.title} className={inline ? 'w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 sm:p-4' : 'fixed inset-0 z-[110] overflow-y-auto bg-black/95 p-4 sm:p-8'} dir={artifact.direction}>
    <div className="mx-auto max-w-6xl space-y-3">
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-white">
        <span aria-hidden="true" className="h-8 w-1 rounded-full" style={{ backgroundColor: theme.accent }} />
        <div className="me-auto min-w-0"><h2 className="truncate text-sm font-semibold tracking-tight">{artifact.title}</h2><p className="text-xs text-white/55">{t.presentation} · {artifact.slides.length} {t.slides}</p></div>
        <button type="button" disabled={busy} onClick={() => void exportPptx()} className="rounded-lg border border-white/25 px-3 py-2 text-xs font-medium transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">{busy ? t.preparing : t.download}</button>
        {!inline && <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition-colors duration-150 hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t.close}</button>}
      </header>
      {error && <p role="alert" className="text-sm text-red-300">{t.error}</p>}
      <nav aria-label={t.slides} className="flex gap-2 overflow-x-auto pb-1">{artifact.slides.map((item, slideIndex) => {
        const active = index === slideIndex;
        return <button key={item.id} type="button" onClick={() => setIndex(slideIndex)} aria-current={active ? 'page' : undefined} className={`min-w-28 max-w-44 rounded-lg border px-3 py-2 text-start text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active ? 'border-white/55 bg-white/10 text-white' : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white'}`}>
          <span className="mb-1 block text-[10px] font-semibold tabular-nums tracking-widest" style={{ color: active ? theme.accent : undefined }}>{String(slideIndex + 1).padStart(2, '0')} · {t[presentationVariant(item)]}</span>
          <span className="line-clamp-2 font-medium">{item.title}</span>
        </button>;
      })}</nav>
      {slide && <article lang={artifact.language} dir={artifact.direction} data-slide-variant={variant} className={`relative overflow-y-auto rounded-xl border p-5 sm:p-8 ${inline ? 'min-h-56 max-h-[34rem]' : 'aspect-video min-h-[360px] max-h-[75vh]'}`} style={{ backgroundColor: theme.canvas, borderColor: theme.border, color: theme.text }}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.muted }}><span>VANTRA / {t[variant!]}</span><span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span></div>
          <div className={variant === 'cover' ? 'my-auto max-w-3xl py-8 sm:py-14' : 'mb-6 max-w-4xl'}>
            <span aria-hidden="true" className="mb-5 block h-1 w-12 rounded-full" style={{ backgroundColor: theme.accent }} />
            <h3 dir="auto" className={variant === 'cover' ? 'text-3xl font-semibold leading-tight tracking-tight sm:text-5xl' : 'text-2xl font-semibold leading-tight tracking-tight sm:text-3xl'}>{slide.title}</h3>
            {slide.subtitle && <p dir="auto" className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: theme.muted }}>{slide.subtitle}</p>}
          </div>
          <div className={variant === 'cover' ? 'space-y-4' : 'space-y-5'}>{variant === 'kpi' && presentationMetricRows(slide).length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{presentationMetricRows(slide).map((metric, metricIndex) => <div key={`${metric.label}-${metricIndex}`} className="min-w-0 rounded-lg border p-3 sm:p-4" style={{ backgroundColor: theme.surface, borderColor: theme.border }}><p className="text-xs leading-snug" style={{ color: theme.muted }}>{metric.label}</p><p dir="auto" className="mt-2 break-words text-lg font-semibold tabular-nums sm:text-2xl">{formatPresentationCell(metric.value, artifact.language)}</p></div>)}</div>}
            {slide.blocks.map((block, blockIndex) => {
              if (variant === 'kpi' && block.kind === 'table') return null;
              if (block.kind === 'text') return <p key={blockIndex} dir="auto" className="max-w-4xl text-sm leading-relaxed sm:text-lg">{block.text}</p>;
              if (block.kind === 'bullets') return <ul key={blockIndex} className="grid gap-2 sm:grid-cols-2">{block.items.map((item, itemIndex) => <li key={itemIndex} dir="auto" className="rounded-lg border px-4 py-3 text-sm leading-relaxed sm:text-base" style={{ backgroundColor: theme.surface, borderColor: theme.border }}><span aria-hidden="true" className="me-2 font-bold" style={{ color: theme.accent }}>•</span>{item}</li>)}</ul>;
              if (block.kind === 'table') return <div key={blockIndex} className="overflow-x-auto rounded-lg border" style={{ borderColor: theme.border }}><table className="w-full border-collapse text-xs sm:text-sm"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} style={{ backgroundColor: rowIndex === 0 ? theme.surfaceAlt : rowIndex % 2 === 0 ? theme.surface : theme.canvas }}>{row.map((cell, cellIndex) => {
                const numeric = rowIndex > 0 && /^\s*[€$£]?\s*-?[\d,]+(?:\.\d+)?\s*(?:%|DA|DZD)?\s*$/i.test(cell);
                const Tag = rowIndex === 0 ? 'th' : 'td';
                return <Tag key={cellIndex} dir="auto" scope={rowIndex === 0 ? 'col' : undefined} className={`border-b px-3 py-2.5 ${numeric ? 'text-end tabular-nums' : 'text-start'} ${rowIndex === 0 || cellIndex === 0 ? 'font-semibold' : 'font-normal'}`} style={{ borderColor: theme.border, color: rowIndex === 0 ? theme.text : undefined }}>{rowIndex === 0 ? cell : formatPresentationCell(cell, artifact.language)}</Tag>;
              })}</tr>)}</tbody></table></div>;
              if (block.kind === 'chart') { const chart = charts.find((item) => item.id === block.chartId); return chart ? <div key={blockIndex} className="rounded-lg border p-3" style={{ backgroundColor: theme.surface, borderColor: theme.border }}><ArtifactChart artifact={presentationChart(chart)} presentationColors={theme.chart} presentationMuted={theme.muted} presentationBorder={theme.border} />{(chart.categories.length > 12 || chart.series.length > 4) && <p className="mt-2 text-xs" style={{ color: theme.muted }}>{t.chartLimited}</p>}</div> : <p key={blockIndex} className="text-sm" style={{ color: theme.muted }}>{t.unavailable}</p>; }
              return /^data:image\/(png|jpeg|webp);base64,/i.test(block.src) ? <img key={blockIndex} src={block.src} alt={block.alt ?? ''} className="max-h-72 max-w-full rounded-lg object-contain" /> : null;
            })}</div>
          <div className="mt-auto pt-6 text-[10px] font-medium tracking-widest" style={{ color: theme.muted }}>VANTRA <span className="mx-2">/</span> {String(index + 1).padStart(2, '0')} — {String(artifact.slides.length).padStart(2, '0')}</div>
        </div>
      </article>}
      <footer className="flex items-center justify-between gap-3 text-xs text-white/70"><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg border border-white/20 px-3 py-2 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40">{t.previous}</button><span className="tabular-nums">{t.slide} {index + 1} / {artifact.slides.length}</span><button type="button" disabled={index >= artifact.slides.length - 1} onClick={() => setIndex(index + 1)} className="rounded-lg border border-white/20 px-3 py-2 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40">{t.next}</button></footer>
    </div>
  </div>;
}
